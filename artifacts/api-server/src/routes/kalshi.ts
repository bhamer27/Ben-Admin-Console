import { Router, type IRouter, type Request, type Response } from "express";
import crypto from "crypto";

const router: IRouter = Router();

const KALSHI_BASE = "https://api.elections.kalshi.com/trade-api/v2";

function getPrivateKey(): string {
  const raw = process.env.KALSHI_PRIVATE_KEY ?? "";
  if (!raw) return "";
  if (raw.includes("-----BEGIN")) return raw;
  return Buffer.from(raw, "base64").toString("utf8");
}

function signRequest(privateKeyPem: string, method: string, path: string) {
  const ts = Date.now().toString();
  // Kalshi signs path only — no query string, with /trade-api/v2 prefix
  const pathOnly = path.split("?")[0];
  const msg = ts + method.toUpperCase() + `/trade-api/v2${pathOnly}`;
  const sig = crypto.sign("SHA256", Buffer.from(msg), {
    key: privateKeyPem,
    padding: crypto.constants.RSA_PKCS1_PSS_PADDING,
    saltLength: crypto.constants.RSA_PSS_SALTLEN_DIGEST,
  });
  return { ts, sig: sig.toString("base64") };
}

async function kalshiFetch(apiKeyId: string, privateKeyPem: string, path: string) {
  const method = "GET";
  const { ts, sig } = signRequest(privateKeyPem, method, path);

  const res = await fetch(`${KALSHI_BASE}${path}`, {
    method,
    headers: {
      "KALSHI-ACCESS-KEY": apiKeyId,
      "KALSHI-ACCESS-TIMESTAMP": ts,
      "KALSHI-ACCESS-SIGNATURE": sig,
      Accept: "application/json",
    },
    signal: AbortSignal.timeout(15_000),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Kalshi API ${res.status} on ${path}: ${text.slice(0, 200)}`);
  }

  return res.json();
}

// Real Kalshi market_positions shape
interface KalshiMarketPosition {
  ticker: string;
  position_fp: string;          // signed float string: positive = YES, negative = NO
  market_exposure_dollars: string;
  total_traded_dollars: string;
  realized_pnl_dollars: string;
  fees_paid_dollars: string;
  resting_orders_count: number;
  last_updated_ts: string;
}

interface KalshiPositionsResponse {
  market_positions: KalshiMarketPosition[];
  event_positions: unknown[];
  cursor: string;
}

interface KalshiBalanceResponse {
  balance: number;          // cents
  portfolio_value: number;  // cents
  updated_ts: number;
}

interface KalshiMarketResponse {
  market?: {
    title?: string;
    yes_bid_dollars?: string;
    yes_ask_dollars?: string;
    no_bid_dollars?: string;
    no_ask_dollars?: string;
    last_price_dollars?: string;
    close_time?: string;
  };
}

router.get("/kalshi/stats", async (_req: Request, res: Response) => {
  const apiKeyId = process.env.KALSHI_API_KEY;
  const privateKeyPem = getPrivateKey();

  if (!apiKeyId || !privateKeyPem) {
    res.status(503).json({
      error: "KALSHI_API_KEY or KALSHI_PRIVATE_KEY is not configured.",
      configured: false,
    });
    return;
  }

  try {
    const [balanceData, positionsData] = await Promise.all([
      kalshiFetch(apiKeyId, privateKeyPem, "/portfolio/balance") as Promise<KalshiBalanceResponse>,
      kalshiFetch(apiKeyId, privateKeyPem, "/portfolio/positions?limit=100") as Promise<KalshiPositionsResponse>,
    ]);

    // Balance is in cents
    const balance = (balanceData?.balance ?? 0) / 100;
    const kalshiPortfolioValue = (balanceData?.portfolio_value ?? 0) / 100;

    // market_positions: only include those with non-zero position_fp
    const allMarketPositions = positionsData?.market_positions ?? [];
    const openMarketPositions = allMarketPositions.filter(
      (p) => parseFloat(p.position_fp ?? "0") !== 0,
    );

    // Fetch market details for all open positions in parallel
    const marketDetails = await Promise.allSettled(
      openMarketPositions.map((p) =>
        kalshiFetch(
          apiKeyId,
          privateKeyPem,
          `/markets/${encodeURIComponent(p.ticker)}`,
        ).then((d: KalshiMarketResponse) => d?.market ?? null),
      ),
    );

    let totalInvested = 0;
    let totalCurrentValue = 0;

    const mappedPositions = openMarketPositions.map((pos, i) => {
      const market =
        marketDetails[i].status === "fulfilled" ? marketDetails[i].value : null;

      const positionFp = parseFloat(pos.position_fp ?? "0");
      const contracts = Math.abs(positionFp);
      // positive position_fp = YES, negative = NO
      const side: "yes" | "no" = positionFp > 0 ? "yes" : "no";

      // Already in dollars (not cents)
      const invested = parseFloat(pos.market_exposure_dollars ?? "0");

      // Market prices are string dollars ("0.37"), parse to float
      const yesBid = parseFloat(market?.yes_bid_dollars ?? "0");
      const yesAsk = parseFloat(market?.yes_ask_dollars ?? "0");
      const noBid = parseFloat(market?.no_bid_dollars ?? "0");
      const noAsk = parseFloat(market?.no_ask_dollars ?? "0");
      const lastPrice = parseFloat(market?.last_price_dollars ?? "0");

      // Mid-price per contract in dollars
      const currentPrice =
        side === "yes"
          ? (yesBid + yesAsk) / 2 || lastPrice
          : (noBid + noAsk) / 2 || (1 - lastPrice);

      const currentValue = contracts * currentPrice;
      const pnl = currentValue - invested;

      totalInvested += invested;
      totalCurrentValue += currentValue;

      return {
        ticker: pos.ticker,
        title: market?.title ?? pos.ticker,
        side,
        contracts,
        invested,
        currentValue,
        pnl,
        yesBid,
        yesAsk,
        noBid,
        noAsk,
        closeTime: market?.close_time ?? "",
        yesPrice: yesBid > 0 ? Math.round((yesBid + yesAsk) / 2 * 100) : Math.round(lastPrice * 100),
      };
    });

    const unrealizedPnl = totalCurrentValue - totalInvested;
    const portfolioValue = kalshiPortfolioValue || balance + totalInvested;
    const cashPct =
      portfolioValue > 0 ? Math.round((balance / portfolioValue) * 100) : 100;
    const investedPct = 100 - cashPct;

    res.json({
      balance,
      portfolioValue,
      totalInvested,
      unrealizedPnl,
      openPositions: mappedPositions.length,
      cashPct,
      investedPct,
      positions: mappedPositions,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(502).json({ error: `Kalshi API error: ${msg}` });
  }
});

export default router;
