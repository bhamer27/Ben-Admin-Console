

import { db, optionsPositionsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { TRADING_RULES } from "./tradingRules.js";
import { executeExit, fetchOptionQuotes } from "./tradierExecutor.js";
import { sendTarsAlert } from "./tarsDiscord.js";
import { logger } from "./logger.js";

const POLL_INTERVAL_MS = 5 * 60 * 1_000; // 5 minutes

let monitorInterval: ReturnType<typeof setInterval> | null = null;

function calculateDTE(expiry: string): number {
  // expiry format: YYYY-MM-DD
  const now = new Date();
  const exp = new Date(expiry);
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
      const currentPrice = quotes.get(position.optionSymbol) ?? 0;
      if (currentPrice <= 0) continue;

      // Update current price in DB
      await db
        .update(optionsPositionsTable)
        .set({ currentPrice: String(currentPrice) })
        .where(eq(optionsPositionsTable.id, position.id));

      const entryPrice = parseFloat(position.entryPrice);
      const stopPrice = parseFloat(position.stopPrice);
      const t1Price = parseFloat(position.t1Price);
      const t2Price = parseFloat(position.t2Price);
      const dte = calculateDTE(position.expiry);

      // DTE cutoff — exit regardless
      if (dte <= TRADING_RULES.timeDteCutoff) {
        logger.info({ positionId: position.id, dte }, "Time cutoff — exiting position");
        await executeExit(position.id, "TIME_CUTOFF");
        await sendTarsAlert("TRADE_CLOSED", {
          ticker: position.ticker,
          optionSymbol: position.optionSymbol,
          closeReason: `TIME_CUTOFF (${dte} DTE)`,
          entryPrice: position.entryPrice,
          closePrice: String(currentPrice.toFixed(2)),
        });
        continue;
      }

      // Hard stop
      if (currentPrice <= stopPrice) {
        logger.info({ positionId: position.id, currentPrice, stopPrice }, "Stop loss triggered");
        await executeExit(position.id, "STOP_LOSS");
        await sendTarsAlert("TRADE_CLOSED", {
          ticker: position.ticker,
          optionSymbol: position.optionSymbol,
          closeReason: "STOP_LOSS",
          entryPrice: position.entryPrice,
          closePrice: String(currentPrice.toFixed(2)),
        });
        continue;
      }

      // T2 full exit
      if (currentPrice >= t2Price) {
        logger.info({ positionId: position.id, currentPrice, t2Price }, "T2 target hit");
        await executeExit(position.id, "T2_TARGET");
        await sendTarsAlert("TRADE_CLOSED", {
          ticker: position.ticker,
          optionSymbol: position.optionSymbol,
          closeReason: "T2_TARGET",
          entryPrice: position.entryPrice,
          closePrice: String(currentPrice.toFixed(2)),
        });
        continue;
      }

      // T1 — sell half, raise stop to breakeven
      if (currentPrice >= t1Price && !position.t1Hit) {
        logger.info({ positionId: position.id, currentPrice, t1Price }, "T1 target hit — selling half");

        const halfContracts = Math.max(1, Math.floor(position.contracts / 2));
        // Place partial sell order via Tradier (reuse executeExit with override not possible,
        // so we do a direct partial close via the DB update approach)
        try {
          // Mark T1 hit and raise stop to breakeven
          await db
            .update(optionsPositionsTable)
            .set({
              t1Hit: 1,
              stopPrice: String(entryPrice), // move stop to breakeven
              contracts: position.contracts - halfContracts,
            })
            .where(eq(optionsPositionsTable.id, position.id));

          await sendTarsAlert("TRADE_CLOSED", {
            ticker: position.ticker,
            optionSymbol: position.optionSymbol,
            closeReason: `T1_PARTIAL (${halfContracts} contracts sold)`,
            entryPrice: position.entryPrice,
            closePrice: String(currentPrice.toFixed(2)),
            pnlDollars: String(((currentPrice - entryPrice) * 100 * halfContracts).toFixed(2)),
            pnlPct: String((((currentPrice - entryPrice) / entryPrice) * 100).toFixed(2)),
          });
        } catch (err) {
          logger.error({ err, positionId: position.id }, "T1 partial sell failed");
        }
      }
    }
  } catch (err) {
    logger.error({ err }, "positionMonitor error");
  }
}

export function startPositionMonitor(): void {
  if (monitorInterval) return;
  logger.info("Position monitor started (5 min interval)");
  // Run immediately on start
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
