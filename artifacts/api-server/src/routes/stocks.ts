import { Router, type IRouter, type Request, type Response } from "express";

const router: IRouter = Router();

// ──────────────────────────────────────────
// Tradier
// ──────────────────────────────────────────
async function fetchTradier(apiToken: string) {
  const baseUrl = process.env.TRADIER_API_URL ?? "https://api.tradier.com/v1";

  // Get portfolio positions
  const posRes = await fetch(`${baseUrl}/accounts/${process.env.TRADIER_ACCOUNT_ID ?? "me"}/positions`, {
    headers: {
      Authorization: `Bearer ${apiToken}`,
      Accept: "application/json",
    },
    signal: AbortSignal.timeout(15_000),
  });

  if (!posRes.ok) {
    const text = await posRes.text().catch(() => "");
    throw new Error(`Tradier positions API ${posRes.status}: ${text.slice(0, 200)}`);
  }

  const posData = await posRes.json() as {
    positions?: {
      position?: {
        symbol: string;
        quantity: number;
        cost_basis: number;
        date_acquired: string;
      }[] | {
        symbol: string;
        quantity: number;
        cost_basis: number;
        date_acquired: string;
      };
    };
  };

  const rawPositions = posData.positions?.position;
  const positionList = rawPositions
    ? Array.isArray(rawPositions)
      ? rawPositions
      : [rawPositions]
    : [];

  if (positionList.length === 0) {
    return { positions: [], totalValue: 0, totalCostBasis: 0, totalGainLoss: 0 };
  }

  // Fetch quotes for all held symbols
  const symbols = positionList.map((p) => p.symbol).join(",");
  const quoteRes = await fetch(`${baseUrl}/markets/quotes?symbols=${encodeURIComponent(symbols)}`, {
    headers: {
      Authorization: `Bearer ${apiToken}`,
      Accept: "application/json",
    },
    signal: AbortSignal.timeout(10_000),
  });

  const quoteData = await quoteRes.json() as {
    quotes?: {
      quote?: { symbol: string; last: number; change_percentage: number }[]
        | { symbol: string; last: number; change_percentage: number };
    };
  };

  const rawQuotes = quoteData.quotes?.quote;
  const quoteList = rawQuotes
    ? Array.isArray(rawQuotes)
      ? rawQuotes
      : [rawQuotes]
    : [];

  const priceMap: Record<string, number> = {};
  const changeMap: Record<string, number> = {};
  for (const q of quoteList) {
    priceMap[q.symbol] = q.last;
    changeMap[q.symbol] = q.change_percentage;
  }

  let totalValue = 0;
  let totalCostBasis = 0;

  const positions = positionList.map((p) => {
    const price = priceMap[p.symbol] ?? 0;
    const value = price * p.quantity;
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
    };
  });

  return {
    positions,
    totalValue,
    totalCostBasis,
    totalGainLoss: totalValue - totalCostBasis,
  };
}

// ──────────────────────────────────────────
// Public.com
// ──────────────────────────────────────────
async function fetchPublic(apiKey: string) {
  const res = await fetch("https://api.public.com/api/portfolio", {
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    signal: AbortSignal.timeout(15_000),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Public.com API ${res.status}: ${text.slice(0, 200)}`);
  }

  const data = await res.json() as {
    portfolio_value?: number;
    total_gain_loss?: number;
    total_return_pct?: number;
    holdings?: {
      symbol: string;
      name?: string;
      quantity: number;
      average_cost?: number;
      current_price?: number;
      market_value?: number;
      total_return?: number;
      total_return_pct?: number;
    }[];
  };

  return {
    portfolioValue: data.portfolio_value ?? 0,
    totalGainLoss: data.total_gain_loss ?? 0,
    totalReturnPct: data.total_return_pct ?? 0,
    holdings: (data.holdings ?? []).map((h) => ({
      symbol: h.symbol,
      name: h.name ?? h.symbol,
      quantity: h.quantity,
      currentPrice: h.current_price ?? 0,
      value: h.market_value ?? 0,
      gainLoss: h.total_return ?? 0,
      gainLossPct: h.total_return_pct ?? 0,
    })),
  };
}

// ──────────────────────────────────────────
// Routes
// ──────────────────────────────────────────

router.get("/stocks/tradier", async (_req: Request, res: Response) => {
  const apiToken = process.env.TRADIER_API_TOKEN;

  if (!apiToken) {
    res.status(503).json({
      error: "TRADIER_API_TOKEN is not configured.",
      configured: false,
    });
    return;
  }

  try {
    const data = await fetchTradier(apiToken);
    res.json(data);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(502).json({ error: msg });
  }
});

router.get("/stocks/public", async (_req: Request, res: Response) => {
  const apiKey = process.env.PUBLIC_COM_API_KEY;

  if (!apiKey) {
    res.status(503).json({
      error: "PUBLIC_COM_API_KEY is not configured.",
      configured: false,
    });
    return;
  }

  try {
    const data = await fetchPublic(apiKey);
    res.json(data);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(502).json({ error: msg });
  }
});

export default router;
