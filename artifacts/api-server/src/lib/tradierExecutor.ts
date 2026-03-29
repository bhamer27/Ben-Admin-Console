

import { db, optionsPositionsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { TRADING_RULES } from "./tradingRules.js";
import { logger } from "./logger.js";

const isSandbox = process.env.TRADIER_SANDBOX !== "false";
const BASE_URL = isSandbox
  ? "https://sandbox.tradier.com/v1"
  : "https://api.tradier.com/v1";

function tradierHeaders(): Record<string, string> {
  const token = process.env.TRADIER_API_TOKEN;
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

export interface EntryParams {
  alertId?: string;
  ticker: string;
  optionSymbol: string;
  direction: string;
  strike: number;
  expiry: string;
  optionPrice: number;
}

export async function executeEntry(params: EntryParams): Promise<number> {
  const accountId = process.env.TRADIER_ACCOUNT_ID;
  if (!accountId) throw new Error("TRADIER_ACCOUNT_ID not set");

  const portfolioValue = parseFloat(process.env.PORTFOLIO_VALUE ?? "10000");
  const contracts = Math.max(
    1,
    Math.floor((portfolioValue * TRADING_RULES.maxAllocationPct) / (params.optionPrice * 100)),
  );

  const entryPrice = params.optionPrice;
  const stopPrice = +(entryPrice * (1 - TRADING_RULES.hardStopPct)).toFixed(2);
  const t1Price = +(entryPrice * (1 + TRADING_RULES.t1TargetPct)).toFixed(2);
  const t2Price = +(entryPrice * (1 + TRADING_RULES.t2TargetPct)).toFixed(2);

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

  logger.info({ positionId: row.id, symbol: params.optionSymbol, contracts }, "Position opened");
  return row.id;
}

export async function executeExit(positionId: number, reason: string): Promise<void> {
  const accountId = process.env.TRADIER_ACCOUNT_ID;
  if (!accountId) throw new Error("TRADIER_ACCOUNT_ID not set");

  const [position] = await db
    .select()
    .from(optionsPositionsTable)
    .where(eq(optionsPositionsTable.id, positionId));

  if (!position) throw new Error(`Position ${positionId} not found`);
  if (position.status !== "open") {
    logger.warn({ positionId }, "Position already closed");
    return;
  }

  // Fetch current market price
  let closePrice: number;
  try {
    const quoteRes = await tradierGet(`/markets/quotes?symbols=${position.optionSymbol}&greeks=false`) as {
      quotes?: { quote?: { bid?: number; ask?: number; last?: number } };
    };
    const q = quoteRes?.quotes?.quote;
    const bid = q?.bid ?? 0;
    const ask = q?.ask ?? 0;
    closePrice = bid > 0 && ask > 0 ? +(bid + ask) / 2 : (q?.last ?? 0);
  } catch {
    closePrice = 0;
  }

  const entryPrice = parseFloat(position.entryPrice);
  const pnlPerContract = (closePrice - entryPrice) * 100;
  const pnlDollars = +(pnlPerContract * position.contracts).toFixed(2);
  const pnlPct = entryPrice > 0 ? +(((closePrice - entryPrice) / entryPrice) * 100).toFixed(2) : 0;

  // Place sell order
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
    logger.error({ err, positionId }, "Tradier exit order failed");
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

export async function fetchOptionQuotes(symbols: string[]): Promise<Map<string, number>> {
  if (symbols.length === 0) return new Map();
  const joined = symbols.join(",");
  try {
    const res = await tradierGet(`/markets/quotes?symbols=${encodeURIComponent(joined)}&greeks=false`) as {
      quotes?: { quote?: unknown | unknown[] };
    };
    const quotes = res?.quotes?.quote;
    const arr = Array.isArray(quotes) ? quotes : quotes ? [quotes] : [];
    const map = new Map<string, number>();
    for (const q of arr as { symbol: string; bid?: number; ask?: number; last?: number }[]) {
      const bid = q.bid ?? 0;
      const ask = q.ask ?? 0;
      const mid = bid > 0 && ask > 0 ? (bid + ask) / 2 : (q.last ?? 0);
      map.set(q.symbol, mid);
    }
    return map;
  } catch (err) {
    logger.error({ err }, "Failed to fetch option quotes");
    return new Map();
  }
}
