import { db, optionsPositionsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { TRADING_RULES } from "./tradingRules.js";
import { executeExit, fetchOptionQuotes } from "./tradierExecutor.js";
import { sendTarsAlert } from "./tarsDiscord.js";
import { recordTradeLoss, recordTradeWin } from "./signalReviewer.js";
import { logger } from "./logger.js";

const POLL_INTERVAL_MS = 5 * 60 * 1_000; // 5 minutes

let monitorInterval: ReturnType<typeof setInterval> | null = null;

// ── Peak price tracker (in-memory, resets on restart) ─────────────────────────
// positionId → highest price seen after T1 hit
const peakPriceMap = new Map<number, number>();

function calculateDTE(expiry: string): number {
  // expiry format: YYYY-MM-DD
  const now = new Date();
  const exp = new Date(expiry + "T16:00:00"); // market close
  const diffMs = exp.getTime() - now.getTime();
  return Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)));
}

async function checkPositions(): Promise<void> {
  try {
    const openPositions = await db
      .select()
      .from(optionsPositionsTable)
      .where(eq(optionsPositionsTable.status, "open"));

    if (openPositions.length === 0) return;

    const symbols = openPositions.map((p) => p.optionSymbol);
    const quotes = await fetchOptionQuotes(symbols);

    for (const position of openPositions) {
      const currentPrice = quotes.get(position.optionSymbol);
      if (currentPrice == null || currentPrice <= 0) {
        logger.warn({ positionId: position.id, symbol: position.optionSymbol }, "No quote — skipping");
        continue;
      }

      const entryPrice = parseFloat(position.entryPrice);
      const stopPrice = parseFloat(position.stopPrice);
      const t1Price = parseFloat(position.t1Price);
      const t2Price = parseFloat(position.t2Price);
      const t1Hit = (position.t1Hit ?? 0) === 1;
      const dte = calculateDTE(position.expiry);

      // Update current price in DB
      await db
        .update(optionsPositionsTable)
        .set({ currentPrice: String(currentPrice) })
        .where(eq(optionsPositionsTable.id, position.id));

      // ── Trailing stop logic (active after T1 hit) ────────────────────────
      let effectiveStop = stopPrice;
      if (t1Hit) {
        const currentPeak = peakPriceMap.get(position.id) ?? currentPrice;
        const newPeak = Math.max(currentPeak, currentPrice);
        peakPriceMap.set(position.id, newPeak);

        // Trailing stop = max(entryPrice, peak * (1 - trailingStopBelowPeakPct))
        const trailingStop = +(Math.max(
          entryPrice,
          newPeak * (1 - TRADING_RULES.trailingStopBelowPeakPct),
        ).toFixed(2));

        // Only ratchet up (never lower the stop)
        if (trailingStop > stopPrice) {
          effectiveStop = trailingStop;
          await db
            .update(optionsPositionsTable)
            .set({ stopPrice: String(trailingStop) })
            .where(eq(optionsPositionsTable.id, position.id));
          logger.debug({ positionId: position.id, trailingStop, peak: newPeak }, "Trailing stop updated");
        }
      }

      // ── DTE cutoff ───────────────────────────────────────────────────────
      if (dte <= TRADING_RULES.timeDteCutoff) {
        logger.info({ positionId: position.id, dte }, "DTE cutoff — exiting position");
        const pnl = (currentPrice - entryPrice) * 100 * position.contracts;
        await closeAndRecord(position.id, "TIME_CUTOFF", pnl, position, currentPrice);
        continue;
      }

      // ── Hard stop ────────────────────────────────────────────────────────
      if (currentPrice <= effectiveStop) {
        logger.info(
          { positionId: position.id, currentPrice, effectiveStop, t1Hit },
          `Stop hit (${t1Hit ? "trailing" : "hard"})`,
        );
        const pnl = (currentPrice - entryPrice) * 100 * position.contracts;
        await closeAndRecord(position.id, t1Hit ? "TRAILING_STOP" : "STOP_LOSS", pnl, position, currentPrice);
        continue;
      }

      // ── T2 full exit ──────────────────────────────────────────────────────
      if (currentPrice >= t2Price) {
        logger.info({ positionId: position.id, currentPrice, t2Price }, "T2 target hit — full exit");
        const pnl = (currentPrice - entryPrice) * 100 * position.contracts;
        await closeAndRecord(position.id, "T2_TARGET", pnl, position, currentPrice);
        continue;
      }

      // ── T1 — sell half, move stop to breakeven, start trailing ───────────
      if (currentPrice >= t1Price && !t1Hit) {
        logger.info({ positionId: position.id, currentPrice, t1Price }, "T1 target hit — partial exit");

        const halfContracts = Math.max(1, Math.floor(position.contracts / 2));
        const remainingContracts = position.contracts - halfContracts;
        const partialPnl = +((currentPrice - entryPrice) * 100 * halfContracts).toFixed(2);
        const partialPnlPct = +(((currentPrice - entryPrice) / entryPrice) * 100).toFixed(2);

        // Move stop to breakeven, mark T1 hit, initialize peak
        peakPriceMap.set(position.id, currentPrice);
        await db
          .update(optionsPositionsTable)
          .set({
            t1Hit: 1,
            stopPrice: String(entryPrice), // breakeven stop
            contracts: remainingContracts,
          })
          .where(eq(optionsPositionsTable.id, position.id));

        await sendTarsAlert("TRADE_CLOSED", {
          ticker: position.ticker,
          optionSymbol: position.optionSymbol,
          closeReason: `T1_PARTIAL — sold ${halfContracts} contracts, ${remainingContracts} remaining (stop → breakeven, trailing active)`,
          entryPrice: position.entryPrice,
          closePrice: currentPrice.toFixed(2),
          pnlDollars: String(partialPnl),
          pnlPct: String(partialPnlPct),
        });

        // Record partial win for circuit breaker tracking
        if (partialPnl >= 0) recordTradeWin();
        else recordTradeLoss(Math.abs(partialPnl));

        logger.info(
          { positionId: position.id, halfContracts, remainingContracts, partialPnl },
          "T1 partial close complete",
        );
      }
    }
  } catch (err) {
    logger.error({ err }, "positionMonitor error");
  }
}

async function closeAndRecord(
  positionId: number,
  reason: string,
  pnlDollars: number,
  position: { ticker: string; optionSymbol: string; entryPrice: string; id: number },
  closePrice: number,
): Promise<void> {
  peakPriceMap.delete(positionId);
  await executeExit(positionId, reason);
  await sendTarsAlert("TRADE_CLOSED", {
    ticker: position.ticker,
    optionSymbol: position.optionSymbol,
    closeReason: reason,
    entryPrice: position.entryPrice,
    closePrice: closePrice.toFixed(2),
    pnlDollars: pnlDollars.toFixed(2),
    pnlPct: (((closePrice - parseFloat(position.entryPrice)) / parseFloat(position.entryPrice)) * 100).toFixed(2),
  });

  if (pnlDollars >= 0) {
    recordTradeWin();
  } else {
    recordTradeLoss(Math.abs(pnlDollars));
  }
}

export function startPositionMonitor(): void {
  if (monitorInterval) return;
  logger.info("Position monitor started (5 min interval)");
  void checkPositions();
  monitorInterval = setInterval(() => void checkPositions(), POLL_INTERVAL_MS);
}

export function stopPositionMonitor(): void {
  if (monitorInterval) {
    clearInterval(monitorInterval);
    monitorInterval = null;
    logger.info("Position monitor stopped");
  }
}
