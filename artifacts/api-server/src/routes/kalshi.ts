import { Router, type IRouter, type Request, type Response } from "express";
import * as kalshi from "../lib/kalshiClient.js";

const router: IRouter = Router();

// ── Stats snapshot ──────────────────────────────────────────────────────────
router.get("/kalshi/stats", async (_req: Request, res: Response) => {
  if (!process.env.KALSHI_PRIVATE_KEY) {
    res.status(503).json({ error: "KALSHI_PRIVATE_KEY not configured", configured: false });
    return;
  }
  try {
    const stats = await kalshi.getStats();
    res.json(stats);
  } catch (err) {
    res.status(502).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

// ── Positions ───────────────────────────────────────────────────────────────
router.get("/kalshi/positions", async (_req: Request, res: Response) => {
  if (!process.env.KALSHI_PRIVATE_KEY) {
    res.status(503).json({ error: "KALSHI_PRIVATE_KEY not configured", configured: false });
    return;
  }
  try {
    const positions = await kalshi.getPositions();
    res.json({ positions });
  } catch (err) {
    res.status(502).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

// ── Market search ───────────────────────────────────────────────────────────
router.get("/kalshi/markets", async (req: Request, res: Response) => {
  if (!process.env.KALSHI_PRIVATE_KEY) {
    res.status(503).json({ error: "KALSHI_PRIVATE_KEY not configured", configured: false });
    return;
  }
  try {
    const query = typeof req.query.q === "string" ? req.query.q : "";
    const limit = Math.min(Number(req.query.limit ?? 10), 50);
    const markets = await kalshi.searchMarkets(query, limit);
    res.json({ markets });
  } catch (err) {
    res.status(502).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

// ── Open orders ─────────────────────────────────────────────────────────────
router.get("/kalshi/orders", async (_req: Request, res: Response) => {
  if (!process.env.KALSHI_PRIVATE_KEY) {
    res.status(503).json({ error: "KALSHI_PRIVATE_KEY not configured", configured: false });
    return;
  }
  try {
    const orders = await kalshi.getOpenOrders();
    res.json({ orders });
  } catch (err) {
    res.status(502).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

// ── Place order ─────────────────────────────────────────────────────────────
router.post("/kalshi/orders", async (req: Request, res: Response) => {
  if (!process.env.KALSHI_PRIVATE_KEY) {
    res.status(503).json({ error: "KALSHI_PRIVATE_KEY not configured", configured: false });
    return;
  }
  try {
    const { ticker, side, count, limitPrice, action } = req.body as {
      ticker: string;
      side: "yes" | "no";
      count: number;
      limitPrice: number;
      action: "buy" | "sell";
    };
    if (!ticker || !side || !count || !limitPrice || !action) {
      res.status(400).json({ error: "Missing required fields: ticker, side, count, limitPrice, action" });
      return;
    }
    const result = await kalshi.placeOrder({ ticker, side, count, limitPrice, action });
    res.json(result);
  } catch (err) {
    res.status(502).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

// ── Cancel order ────────────────────────────────────────────────────────────
router.delete("/kalshi/orders/:orderId", async (req: Request, res: Response) => {
  if (!process.env.KALSHI_PRIVATE_KEY) {
    res.status(503).json({ error: "KALSHI_PRIVATE_KEY not configured", configured: false });
    return;
  }
  try {
    await kalshi.cancelOrder(req.params.orderId);
    res.json({ ok: true });
  } catch (err) {
    res.status(502).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

export default router;
