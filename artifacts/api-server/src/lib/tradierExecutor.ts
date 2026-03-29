import { db, optionsPositionsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { TRADING_RULES, getEffectiveAllocationPct } from "./tradingRules.js";
import { logger } from "./logger.js";

// ── Tradier config ─────────────────────────────────────────────────────────────
// Sandbox defaults — override with env vars for live trading
const isSandbox = process.env.TRADIER_SANDBOX !== "false";
const BASE_URL = isSandbox
  ? "https://sandbox.tradier.com/v1"
  : "https://api.tradier.com/v1";

function getAccountId(): string {
  return process.env.TRADIER_ACCOUNT_ID ?? (isSandbox ? "VA1575604" : "");
}

function getApiToken(): string {
  return process.env.TRADIER_API_TOKEN ?? (isSandbox ? "2tAybDG6Ef3ILJunMh3bdbqkBfPK" : "");
}

function tradierHeaders(): Record<string, string> {
  const token = getApiToken();
  if (!token) throw new Error("TRADIER_API_TOKEN not set");
  return {
    Authorization: `Bearer ${token}`,
    Accept: "application/json",
    "Content-Type": "application/x-www-form-urlencoded",
  };
}

async function tradierPost(path: string, body: Record<string, string>): Promise<unknown> {
  const params = new URLSearchParams(body).toString();
  const res = await fetch(`${BASE_URL}${path}`, {
    method: "POST",
    headers: tradierHeaders(),
    body: params,
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Tradier POST ${path} failed ${res.status}: ${text}`);
  }
  return res.json();
}

async function tradierGet(path: string): Promise<unknown> {
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: tradierHeaders(),
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Tradier GET ${path} failed ${res.status}: ${text}`);
  }
  return res.json();
}

// ── Entry ──────────────────────────────────────────────────────────────────────
export interface EntryParams {
  alertId?: string;
  ticker: string;
  optionSymbol: string;
  direction: string;
  strike: number;
  expiry: string;
  optionPrice: number;
  vix?: number | null;  // used for VIX-adjusted sizing
}

export async function executeEntry(params: EntryParams): Promise<number> {
  const accountId = getAccountId();
  if (!accountId) throw new Error("TRADIER_ACCOUNT_ID not configured");

  const portfolioValue = parseFloat(process.env.PORTFOLIO_VALUE ?? "100000");
  const allocPct = getEffectiveAllocationPct(params.vix ?? null);
  const maxAlloc = portfolioValue * allocPct;

  // contracts = floor(allocation / (price * 100)), minimum 1
  const contracts = Math.max(1, Math.floor(maxAlloc / (params.optionPrice * 100)));

  const entryPrice = params.optionPrice;
  const stopPrice = +(entryPrice * (1 - TRADING_RULES.hardStopPct)).toFixed(2);
  const t1Price = +(entryPrice * (1 + TRADING_RULES.t1TargetPct)).toFixed(2);
  const t2Price = +(entryPrice * (1 + TRADING_RULES.t2TargetPct)).toFixed(2);

  logger.info(
    { ticker: params.ticker, contracts, entryPrice, allocPct, isSandbox },
    "Placing entry order",
  );

  // Place limit order via Tradier
  await tradierPost(`/accounts/${accountId}/orders`, {
    class: "option",
    symbol: params.ticker,
    option_symbol: params.optionSymbol,
    side: "buy_to_open",
    quantity: String(contracts),
    type: "limit",
    price: String(entryPrice),
    duration: "day",
  });

  const [row] = await db
    .insert(optionsPositionsTable)
    .values({
      alertId: params.alertId ?? null,
      ticker: params.ticker,
      optionSymbol: params.optionSymbol,
      direction: params.direction,
      strike: params.strike,
      expiry: params.expiry,
      contracts,
      entryPrice: String(entryPrice),
      stopPrice: String(stopPrice),
      t1Price: String(t1Price),
      t2Price: String(t2Price),
      status: "open",
    })
    .returning({ id: optionsPositionsTable.id });

  logger.info(
    { positionId: row.id, symbol: params.optionSymbol, contracts, stop: stopPrice, t1: t1Price, t2: t2Price },
    "Position opened",
  );

  return row.id;
}

// ── Exit ───────────────────────────────────────────────────────────────────────
export async function executeExit(positionId: number, reason: string): Promise<void> {
  const accountId = getAccountId();
  if (!accountId) throw new Error("TRADIER_ACCOUNT_ID not configured");

  const [position] = await db
    .select()
    .from(optionsPositionsTable)
    .where(eq(optionsPositionsTable.id, positionId));

  if (!position) throw new Error(`Position ${positionId} not found`);
  if (position.status !== "open") {
    logger.warn({ positionId }, "Position already closed — skipping exit");
    return;
  }

  // Fetch current market price for P&L calc
  let closePrice = 0;
  try {
    const quoteRes = await tradierGet(
      `/markets/quotes?symbols=${encodeURIComponent(position.optionSymbol)}&greeks=false`,
    ) as { quotes?: { quote?: { bid?: number; ask?: number; last?: number } } };
    const q = quoteRes?.quotes?.quote;
    const bid = q?.bid ?? 0;
    const ask = q?.ask ?? 0;
    closePrice = bid > 0 && ask > 0 ? +((bid + ask) / 2).toFixed(2) : (q?.last ?? 0);
  } catch (err) {
    logger.warn({ err, positionId }, "Could not fetch close price — using 0");
  }

  const entryPrice = parseFloat(position.entryPrice);
  const pnlDollars = +((closePrice - entryPrice) * 100 * position.contracts).toFixed(2);
  const pnlPct = entryPrice > 0
    ? +(((closePrice - entryPrice) / entryPrice) * 100).toFixed(2)
    : 0;

  // Place market sell order
  try {
    await tradierPost(`/accounts/${accountId}/orders`, {
      class: "option",
      symbol: position.ticker,
      option_symbol: position.optionSymbol,
      side: "sell_to_close",
      quantity: String(position.contracts),
      type: "market",
      duration: "day",
    });
  } catch (err) {
    logger.error({ err, positionId }, "Tradier exit order failed — marking closed anyway");
  }

  await db
    .update(optionsPositionsTable)
    .set({
      status: "closed",
      closedAt: new Date(),
      closeReason: reason,
      currentPrice: String(closePrice),
      pnlDollars: String(pnlDollars),
      pnlPct: String(pnlPct),
    })
    .where(eq(optionsPositionsTable.id, positionId));

  logger.info({ positionId, reason, pnlDollars, pnlPct }, "Position closed");
}

// ── Quote fetching ─────────────────────────────────────────────────────────────
export async function fetchOptionQuotes(symbols: string[]): Promise<Map<string, number>> {
  if (symbols.length === 0) return new Map();

  try {
    const joined = symbols.map(encodeURIComponent).join(",");
    const res = await tradierGet(`/markets/quotes?symbols=${joined}&greeks=false`) as {
      quotes?: { quote?: unknown };
    };
    const raw = res?.quotes?.quote;
    const arr: Array<{ symbol: string; bid?: number; ask?: number; last?: number }> =
      Array.isArray(raw) ? raw : raw ? [raw as { symbol: string }] : [];

    const map = new Map<string, number>();
    for (const q of arr) {
      const bid = q.bid ?? 0;
      const ask = q.ask ?? 0;
      const mid = bid > 0 && ask > 0 ? (bid + ask) / 2 : (q.last ?? 0);
      map.set(q.symbol, +mid.toFixed(2));
    }
    return map;
  } catch (err) {
    logger.error({ err }, "Failed to fetch option quotes");
    return new Map();
  }
}
