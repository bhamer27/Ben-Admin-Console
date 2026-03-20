/**
 * Kalshi API client for BenAdmin.
 * Auth: RSA-PSS with MGF1(SHA256), MAX_LENGTH salt, millisecond timestamp.
 * Private key loaded from KALSHI_PRIVATE_KEY env var (PEM string).
 */

import crypto from "node:crypto";

const BASE_URL = "https://api.elections.kalshi.com/trade-api/v2";
const KEY_ID = "85a6d28e-1bc1-4f1b-a862-b2c0e36d69c4";

function getKey(): crypto.KeyObject {
  const pem = process.env.KALSHI_PRIVATE_KEY;
  if (!pem) throw new Error("KALSHI_PRIVATE_KEY not configured");
  // Support both raw PEM and base64-encoded PEM
  const decoded = pem.includes("-----BEGIN") ? pem : Buffer.from(pem, "base64").toString("utf8");
  return crypto.createPrivateKey(decoded);
}

function sign(method: string, path: string): { ts: string; sig: string } {
  const ts = String(Date.now());
  const msg = `${ts}${method}/trade-api/v2${path}`;
  const key = getKey();
  const sigBuf = crypto.sign("sha256", Buffer.from(msg), {
    key,
    padding: crypto.constants.RSA_PKCS1_PSS_PADDING,
    saltLength: crypto.constants.RSA_PSS_SALTLEN_MAX_SIGN,
  });
  return { ts, sig: sigBuf.toString("base64") };
}

async function kalshiReq(method: string, path: string, body?: unknown): Promise<unknown> {
  const { ts, sig } = sign(method, path);
  const url = `${BASE_URL}${path}`;
  const headers: Record<string, string> = {
    "KALSHI-ACCESS-KEY": KEY_ID,
    "KALSHI-ACCESS-SIGNATURE": sig,
    "KALSHI-ACCESS-TIMESTAMP": ts,
    "Accept": "application/json",
  };
  if (body) headers["Content-Type"] = "application/json";

  const res = await fetch(url, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(15_000),
  });

  const text = await res.text();
  if (!res.ok) {
    throw new Error(`Kalshi ${method} ${path} → ${res.status}: ${text.slice(0, 300)}`);
  }
  return JSON.parse(text);
}

// ─── Types ───────────────────────────────────────────────────────────────────

export interface KalshiPosition {
  ticker: string;
  title: string;
  side: "yes" | "no";
  contracts: number;
  invested: number;
  currentValue: number;
  pnl: number;
  yesBid: number;
  yesAsk: number;
  noBid: number;
  noAsk: number;
  closeTime: string;
  yesPrice: number; // mid for display
}

export interface KalshiStats {
  balance: number;
  portfolioValue: number;
  totalInvested: number;
  unrealizedPnl: number;
  realizedPnl: number;
  openPositions: number;
  totalTrades: number;
  wins: number;
  losses: number;
  hitRate: number;
  cashPct: number;
  investedPct: number;
  positions: KalshiPosition[];
}

export interface KalshiMarket {
  ticker: string;
  title: string;
  subtitle?: string;
  yesPrice: number;  // 0-100
  noPrice: number;
  volume: number;
  closeTime: string;
  status: string;
}

// ─── API methods ─────────────────────────────────────────────────────────────

export async function getBalance(): Promise<number> {
  const data = await kalshiReq("GET", "/portfolio/balance") as Record<string, unknown>;
  const raw = data.balance;
  if (typeof raw === "object" && raw !== null) {
    return Number((raw as Record<string, unknown>).balance ?? 0) / 100;
  }
  return Number(raw ?? 0) / 100;
}

export async function getPositions(): Promise<KalshiPosition[]> {
  const data = await kalshiReq("GET", "/portfolio/positions") as Record<string, unknown>;
  const marketPositions = (data.market_positions as Record<string, unknown>[]) ?? [];
  const active = marketPositions.filter((p) => Math.abs(Number(p.position_fp ?? 0)) > 0);

  const enriched: KalshiPosition[] = [];
  for (const p of active) {
    const ticker = String(p.ticker ?? "");
    try {
      const mRes = await kalshiReq("GET", `/markets/${ticker}`) as Record<string, unknown>;
      const m = (mRes.market ?? {}) as Record<string, unknown>;

      // Prices from API may be 0-1 (dollars) or 0-100 (cents)
      const toInt = (v: unknown) => {
        const n = Number(v ?? 0);
        return n <= 1 ? Math.round(n * 100) : Math.round(n);
      };

      const yesBid = toInt(m.yes_bid ?? m.yes_bid_dollars);
      const yesAsk = toInt(m.yes_ask ?? m.yes_ask_dollars);
      const noBid = toInt(m.no_bid ?? m.no_bid_dollars);
      const noAsk = toInt(m.no_ask ?? m.no_ask_dollars);

      const posFp = Number(p.position_fp ?? 0);
      const contracts = Math.abs(posFp);
      const side: "yes" | "no" = posFp < 0 ? "no" : "yes";
      const mid = side === "no" ? (noBid + noAsk) / 2 : (yesBid + yesAsk) / 2;
      const invested = Number(p.market_exposure_dollars ?? 0);
      const currentValue = (contracts * mid) / 100;

      enriched.push({
        ticker,
        title: String(m.title ?? ticker),
        side,
        contracts,
        invested: Math.round(invested * 100) / 100,
        currentValue: Math.round(currentValue * 100) / 100,
        pnl: Math.round((currentValue - invested) * 100) / 100,
        yesBid,
        yesAsk,
        noBid,
        noAsk,
        closeTime: String(m.close_time ?? ""),
        yesPrice: Math.round((yesBid + yesAsk) / 2),
      });
    } catch {
      enriched.push({
        ticker,
        title: ticker,
        side: "yes",
        contracts: Math.abs(Number(p.position_fp ?? 0)),
        invested: Number(p.market_exposure_dollars ?? 0),
        currentValue: 0,
        pnl: 0,
        yesBid: 0,
        yesAsk: 0,
        noBid: 0,
        noAsk: 0,
        closeTime: "",
        yesPrice: 0,
      });
    }
  }
  return enriched;
}

export async function getStats(): Promise<KalshiStats> {
  const [balance, positions] = await Promise.all([getBalance(), getPositions()]);

  const totalInvested = positions.reduce((s, p) => s + p.invested, 0);
  const totalValue = positions.reduce((s, p) => s + p.currentValue, 0);
  const unrealizedPnl = positions.reduce((s, p) => s + p.pnl, 0);
  const portfolioTotal = balance + totalInvested;

  return {
    balance: Math.round(balance * 100) / 100,
    portfolioValue: Math.round(portfolioTotal * 100) / 100,
    totalInvested: Math.round(totalInvested * 100) / 100,
    unrealizedPnl: Math.round(unrealizedPnl * 100) / 100,
    realizedPnl: 0, // journal lives on droplet; omit for now
    openPositions: positions.length,
    totalTrades: 0,
    wins: 0,
    losses: 0,
    hitRate: 0,
    cashPct: portfolioTotal > 0 ? Math.round((balance / portfolioTotal) * 1000) / 10 : 100,
    investedPct: portfolioTotal > 0 ? Math.round((totalInvested / portfolioTotal) * 1000) / 10 : 0,
    positions,
  };
}

export async function searchMarkets(query: string, limit = 10): Promise<KalshiMarket[]> {
  const params = new URLSearchParams({ limit: String(limit), status: "open" });
  if (query) params.set("search", query);
  const data = await kalshiReq("GET", `/markets?${params}`) as Record<string, unknown>;
  const markets = (data.markets as Record<string, unknown>[]) ?? [];

  return markets.map((m) => {
    const toInt = (v: unknown) => {
      const n = Number(v ?? 0);
      return n <= 1 ? Math.round(n * 100) : Math.round(n);
    };
    const yesBid = toInt(m.yes_bid ?? m.yes_bid_dollars);
    const yesAsk = toInt(m.yes_ask ?? m.yes_ask_dollars);
    return {
      ticker: String(m.ticker ?? ""),
      title: String(m.title ?? ""),
      subtitle: m.subtitle ? String(m.subtitle) : undefined,
      yesPrice: Math.round((yesBid + yesAsk) / 2),
      noPrice: 100 - Math.round((yesBid + yesAsk) / 2),
      volume: Number(m.volume ?? 0),
      closeTime: String(m.close_time ?? ""),
      status: String(m.status ?? "open"),
    };
  });
}

export async function placeOrder(params: {
  ticker: string;
  side: "yes" | "no";
  count: number;         // number of contracts
  limitPrice: number;   // 0-100 (cents)
  action: "buy" | "sell";
}): Promise<{ orderId: string; status: string }> {
  const body = {
    ticker: params.ticker,
    action: params.action,
    type: "limit",
    side: params.side,
    count: params.count,
    yes_price: params.side === "yes" ? params.limitPrice : 100 - params.limitPrice,
  };
  const data = await kalshiReq("POST", "/portfolio/orders", body) as Record<string, unknown>;
  const order = (data.order ?? data) as Record<string, unknown>;
  return {
    orderId: String(order.order_id ?? order.id ?? ""),
    status: String(order.status ?? "submitted"),
  };
}

export async function cancelOrder(orderId: string): Promise<void> {
  await kalshiReq("DELETE", `/portfolio/orders/${orderId}`);
}

export async function getOpenOrders(): Promise<Record<string, unknown>[]> {
  const data = await kalshiReq("GET", "/portfolio/orders?status=resting") as Record<string, unknown>;
  return (data.orders as Record<string, unknown>[]) ?? [];
}
