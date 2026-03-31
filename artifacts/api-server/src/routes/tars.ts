import { Router, type IRouter, type Request, type Response } from "express";
import { isOptionSymbol, parseOptionSymbol } from "./stocks";

const router: IRouter = Router();

// TARS engine running on Kowalski droplet — replaces old tars-ai.replit.app
const TARS_URL = process.env.TARS_ENGINE_URL ?? "http://167.71.108.57:7655";

async function tarsGet(path: string): Promise<unknown> {
  const res = await fetch(`${TARS_URL}${path}`, {
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) throw new Error(`TARS ${path}: ${res.status}`);
  return res.json();
}

async function fetchTradierPositions() {
  const apiToken = process.env.TRADIER_API_TOKEN;
  if (!apiToken) return null;

  const baseUrl = process.env.TRADIER_API_URL ?? "https://sandbox.tradier.com/v1";
  const accountId = process.env.TRADIER_ACCOUNT_ID ?? "VA1575604";

  const posRes = await fetch(`${baseUrl}/accounts/${accountId}/positions`, {
    headers: { Authorization: `Bearer ${apiToken}`, Accept: "application/json" },
    signal: AbortSignal.timeout(10_000),
  });
  if (!posRes.ok) return null;

  const posData = await posRes.json() as {
    positions?: {
      position?: {
        symbol: string; quantity: number; cost_basis: number; date_acquired: string;
      }[] | { symbol: string; quantity: number; cost_basis: number; date_acquired: string; };
    };
  };

  const raw = posData.positions?.position;
  const list = raw ? (Array.isArray(raw) ? raw : [raw]) : [];
  if (list.length === 0) return { positions: [], totalValue: 0, totalCostBasis: 0, totalGainLoss: 0 };

  const symbols = list.map((p) => p.symbol).join(",");
  const qRes = await fetch(`${baseUrl}/markets/quotes?symbols=${encodeURIComponent(symbols)}`, {
    headers: { Authorization: `Bearer ${apiToken}`, Accept: "application/json" },
    signal: AbortSignal.timeout(10_000),
  });

  const priceMap: Record<string, number> = {};
  const changeMap: Record<string, number> = {};
  if (qRes.ok) {
    const qData = await qRes.json() as {
      quotes?: { quote?: { symbol: string; last: number; change_percentage: number }[] | { symbol: string; last: number; change_percentage: number } };
    };
    const rawQ = qData.quotes?.quote;
    const quotes = rawQ ? (Array.isArray(rawQ) ? rawQ : [rawQ]) : [];
    for (const q of quotes) { priceMap[q.symbol] = q.last; changeMap[q.symbol] = q.change_percentage; }
  }

  let totalValue = 0, totalCostBasis = 0;
  const positions = list.map((p) => {
    const price = priceMap[p.symbol] ?? 0;
    const isOpt = isOptionSymbol(p.symbol);
    const multiplier = isOpt ? 100 : 1;
    const value = price * p.quantity * multiplier;
    const costBasis = p.cost_basis;
    totalValue += value;
    totalCostBasis += costBasis;
    return {
      symbol: p.symbol,
      quantity: p.quantity,
      currentPrice: price,
      value,
      costBasis,
      gainLoss: value - costBasis,
      gainLossPct: costBasis > 0 ? ((value - costBasis) / costBasis) * 100 : 0,
      dayChangePct: changeMap[p.symbol] ?? 0,
      isOption: isOpt,
      optionDetails: isOpt ? parseOptionSymbol(p.symbol) : null,
      dateAcquired: p.date_acquired,
    };
  });

  return { positions, totalValue, totalCostBasis, totalGainLoss: totalValue - totalCostBasis };
}

router.get("/tars/snapshot", async (_req: Request, res: Response) => {
  try {
    const [status, metrics, signals, positions, tradierData] = await Promise.all([
      tarsGet("/api/trading/status") as Promise<Record<string, unknown>>,
      tarsGet("/api/trading/metrics") as Promise<Record<string, unknown>>,
      tarsGet("/api/trading/signals") as Promise<{ signals: unknown[] }>,
      tarsGet("/api/trading/positions") as Promise<{ positions: unknown[] }>,
      fetchTradierPositions().catch(() => null),
    ]);

    res.json({
      engine: status,
      metrics,
      positions: (positions as { positions: unknown[] }).positions ?? [],
      recentAnalyses: (signals as { signals: unknown[] }).signals?.slice(0, 50) ?? [],
      tradierHoldings: tradierData,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(502).json({ error: msg });
  }
});

// Pass-through routes for BenAdmin TARS page
router.get("/trading/status",    async (_req, res) => { try { res.json(await tarsGet("/api/trading/status")); } catch (e) { res.status(502).json({ error: String(e) }); }});
router.get("/trading/metrics",   async (_req, res) => { try { res.json(await tarsGet("/api/trading/metrics")); } catch (e) { res.status(502).json({ error: String(e) }); }});
router.get("/trading/signals",   async (_req, res) => { try { res.json(await tarsGet("/api/trading/signals")); } catch (e) { res.status(502).json({ error: String(e) }); }});
router.get("/trading/positions", async (_req, res) => { try { res.json(await tarsGet("/api/trading/positions")); } catch (e) { res.status(502).json({ error: String(e) }); }});

export default router;
