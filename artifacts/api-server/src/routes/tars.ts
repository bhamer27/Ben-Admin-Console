import { Router, type IRouter, type Request, type Response } from "express";
import { isOptionSymbol, parseOptionSymbol } from "./stocks";

const router: IRouter = Router();

const TARS_URL = "https://tars-ai.replit.app";

// Cache the session cookie so we don't login every request
let sessionCookie = "";
let cookieExpiresAt = 0;

async function tarsLogin(): Promise<string> {
  const password = process.env.TARS_PASSWORD;
  if (!password) throw new Error("TARS_PASSWORD not configured");

  const res = await fetch(`${TARS_URL}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ password }),
    signal: AbortSignal.timeout(10_000),
  });

  if (!res.ok) throw new Error(`Tars login failed: ${res.status}`);

  const setCookie = res.headers.get("set-cookie") ?? "";
  const match = setCookie.match(/tars_session=([^;]+)/);
  if (!match) throw new Error("No session cookie from Tars login");

  sessionCookie = `tars_session=${match[1]}`;
  cookieExpiresAt = Date.now() + 3600_000; // refresh hourly
  return sessionCookie;
}

async function tarsGet(path: string): Promise<unknown> {
  if (!sessionCookie || Date.now() > cookieExpiresAt) {
    await tarsLogin();
  }

  const res = await fetch(`${TARS_URL}/api${path}`, {
    headers: { Cookie: sessionCookie },
    signal: AbortSignal.timeout(15_000),
  });

  // If unauthorized, retry login once
  if (res.status === 401) {
    await tarsLogin();
    const retry = await fetch(`${TARS_URL}/api${path}`, {
      headers: { Cookie: sessionCookie },
      signal: AbortSignal.timeout(15_000),
    });
    if (!retry.ok) throw new Error(`Tars ${path}: ${retry.status}`);
    return retry.json();
  }

  if (!res.ok) throw new Error(`Tars ${path}: ${res.status}`);
  return res.json();
}

async function fetchTradierPositions() {
  // Prefer sandbox credentials for Tars; fall back to live credentials
  const apiToken = process.env.TARS_TRADIER_API_TOKEN ?? process.env.TRADIER_API_TOKEN;
  if (!apiToken) return null;

  const isSandbox = !!process.env.TARS_TRADIER_API_TOKEN;
  const baseUrl = isSandbox
    ? "https://sandbox.tradier.com/v1"
    : (process.env.TRADIER_API_URL ?? "https://api.tradier.com/v1");
  const accountId = isSandbox
    ? (process.env.TARS_TRADIER_ACCOUNT_ID ?? "VA1575604")
    : (process.env.TRADIER_ACCOUNT_ID ?? "me");

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

  // Fetch quotes
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
  const password = process.env.TARS_PASSWORD;
  if (!password) {
    res.status(503).json({ error: "TARS_PASSWORD not configured", configured: false });
    return;
  }

  try {
    const [account, metrics, engine, positions, flowAnalyses, tradierData] = await Promise.all([
      tarsGet("/account") as Promise<Record<string, unknown>>,
      tarsGet("/metrics") as Promise<Record<string, unknown>>,
      tarsGet("/engine/status") as Promise<Record<string, unknown>>,
      tarsGet("/positions") as Promise<unknown[]>,
      tarsGet("/flow-analyses?limit=10") as Promise<unknown[]>,
      fetchTradierPositions().catch(() => null),
    ]);

    res.json({
      account,
      metrics,
      engine,
      positions,
      recentAnalyses: Array.isArray(flowAnalyses) ? flowAnalyses.slice(0, 10) : [],
      tradierHoldings: tradierData,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(502).json({ error: msg });
  }
});

export default router;
