import { Router, type IRouter, type Request, type Response } from "express";

const router: IRouter = Router();

// ──────────────────────────────────────────
// Option symbol helpers
// ──────────────────────────────────────────

/**
 * Detect whether a symbol is an OCC option symbol (e.g. IWM260417P00230000).
 * OCC symbols always contain digits — regular tickers do not.
 */
export function isOptionSymbol(symbol: string): boolean {
  return /[A-Z]+\d{6}[PC]\d{8}/.test(symbol);
}

/**
 * Parse an OCC option symbol into human-readable parts.
 * Format: <UNDERLYING><YYMMDD><P|C><00STRIKE000>
 * e.g. IWM260417P00230000 → { underlying: "IWM", expiry: "Apr 17, 2026", type: "Put", strike: 230 }
 */
export function parseOptionSymbol(symbol: string): {
  underlying: string;
  expiry: string;
  type: "Call" | "Put";
  strike: number;
} | null {
  const m = symbol.match(/^([A-Z]+)(\d{2})(\d{2})(\d{2})([PC])(\d{8})$/);
  if (!m) return null;
  const [, underlying, yy, mm, dd, pc, strikeStr] = m;
  const year = 2000 + parseInt(yy, 10);
  const month = parseInt(mm, 10);
  const day = parseInt(dd, 10);
  const strike = parseInt(strikeStr, 10) / 1000;
  const expiry = new Date(year, month - 1, day).toLocaleDateString("en-US", {
    month: "short", day: "numeric", year: "numeric",
  });
  return { underlying, expiry, type: pc === "P" ? "Put" : "Call", strike };
}

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

  if (!quoteRes.ok) {
    const text = await quoteRes.text().catch(() => "");
    throw new Error(`Tradier quotes API ${quoteRes.status}: ${text.slice(0, 200)}`);
  }

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
    const isOpt = isOptionSymbol(p.symbol);
    // Options: Tradier quotes price per share; 1 contract = 100 shares
    const multiplier = isOpt ? 100 : 1;
    const value = price * p.quantity * multiplier;
    const costBasis = p.cost_basis; // Tradier returns total cost basis (already ×100 for options)
    totalValue += value;
    totalCostBasis += costBasis;

    const optionDetails = isOpt ? parseOptionSymbol(p.symbol) : null;

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
      optionDetails,
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
