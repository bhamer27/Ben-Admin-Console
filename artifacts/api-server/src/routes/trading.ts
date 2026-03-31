import { Router, type IRouter, type Request, type Response } from "express";
import { db, optionsPositionsTable, signalDecisionsTable, flowAlertsTable } from "@workspace/db";
import { eq, desc, sql } from "drizzle-orm";
import { executeExit } from "../lib/tradierExecutor.js";
import { sendTarsAlert } from "../lib/tarsDiscord.js";
import { engineRunning, lastPollAt, alertsProcessed } from "../lib/uwPoller.js";

const router: IRouter = Router();

// GET /api/trading/positions — open positions
router.get("/trading/positions", async (_req: Request, res: Response) => {
  try {
    const positions = await db
      .select()
      .from(optionsPositionsTable)
      .where(eq(optionsPositionsTable.status, "open"))
      .orderBy(desc(optionsPositionsTable.openedAt));
    res.json({ positions });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

// GET /api/trading/signals — recent signal decisions (limit 50)
router.get("/trading/signals", async (_req: Request, res: Response) => {
  try {
    const signals = await db
      .select({
        id: signalDecisionsTable.id,
        alertId: signalDecisionsTable.alertId,
        decision: signalDecisionsTable.decision,
        reasoning: signalDecisionsTable.reasoning,
        score: signalDecisionsTable.score,
        rejectionReason: signalDecisionsTable.rejectionReason,
        createdAt: signalDecisionsTable.createdAt,
        ticker: flowAlertsTable.ticker,
        direction: flowAlertsTable.direction,
        premium: flowAlertsTable.premium,
        dte: flowAlertsTable.dte,
        strike: flowAlertsTable.strike,
        expiry: flowAlertsTable.expiry,
      })
      .from(signalDecisionsTable)
      .leftJoin(flowAlertsTable, eq(signalDecisionsTable.alertId, flowAlertsTable.id))
      .orderBy(desc(signalDecisionsTable.createdAt))
      .limit(50);
    res.json({ signals });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

// GET /api/trading/metrics — win rate, total P&L, trade count
router.get("/trading/metrics", async (_req: Request, res: Response) => {
  try {
    const allPositions = await db.select().from(optionsPositionsTable);
    const closed = allPositions.filter((p) => p.status === "closed");
    const open = allPositions.filter((p) => p.status === "open");

    const wins = closed.filter((p) => parseFloat(p.pnlDollars ?? "0") >= 0);
    const winRate = closed.length > 0 ? (wins.length / closed.length) * 100 : 0;
    const totalPnl = closed.reduce((sum, p) => sum + parseFloat(p.pnlDollars ?? "0"), 0);

    const totalSignals = await db.select({ count: sql<number>`count(*)` }).from(signalDecisionsTable);
    const takenSignals = await db
      .select({ count: sql<number>`count(*)` })
      .from(signalDecisionsTable)
      .where(eq(signalDecisionsTable.decision, "TAKE"));

    const avgScore = await db
      .select({ avg: sql<number>`avg(score)` })
      .from(signalDecisionsTable);

    res.json({
      totalTrades: closed.length,
      openPositions: open.length,
      winRate: +winRate.toFixed(1),
      totalPnlDollars: +totalPnl.toFixed(2),
      winningTrades: wins.length,
      losingTrades: closed.length - wins.length,
      totalSignalsAnalyzed: Number(totalSignals[0]?.count ?? 0),
      totalTaken: Number(takenSignals[0]?.count ?? 0),
      avgScore: +(avgScore[0]?.avg ?? 0).toFixed(1),
    });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

// POST /api/trading/positions/:id/close — manual close
router.post("/trading/positions/:id/close", async (req: Request, res: Response) => {
  const id = parseInt(String(req.params.id), 10);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid position id" });
    return;
  }

  try {
    await executeExit(id, "MANUAL_CLOSE");
    const [position] = await db
      .select()
      .from(optionsPositionsTable)
      .where(eq(optionsPositionsTable.id, id));

    if (position) {
      await sendTarsAlert("TRADE_CLOSED", {
        ticker: position.ticker,
        optionSymbol: position.optionSymbol,
        closeReason: "MANUAL_CLOSE",
        entryPrice: position.entryPrice,
        closePrice: position.currentPrice ?? "unknown",
        pnlDollars: position.pnlDollars ?? undefined,
        pnlPct: position.pnlPct ?? undefined,
      });
    }

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

// GET /api/trading/status — engine status
router.get("/trading/status", async (_req: Request, res: Response) => {
  try {
    const openCount = await db
      .select({ count: sql<number>`count(*)` })
      .from(optionsPositionsTable)
      .where(eq(optionsPositionsTable.status, "open"));

    res.json({
      running: engineRunning,
      lastPollAt: lastPollAt?.toISOString() ?? null,
      alertsProcessed,
      openPositions: Number(openCount[0]?.count ?? 0),
    });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

export default router;
