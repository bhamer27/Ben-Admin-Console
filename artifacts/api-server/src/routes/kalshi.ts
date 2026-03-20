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
    // Total account value = cash balance + Kalshi's mark-to-market of open positions
    const portfolioValue = balance + kalshiPortfolioValue;
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

interface KalshiSettlement {
  ticker: string;
  event_ticker: string;
  market_result: string;
  settled_time: string;
  revenue: number;           // cents
  yes_total_cost: number;    // cents (gross buy volume — NOT net cost basis)
  no_total_cost: number;     // cents (gross buy volume — NOT net cost basis)
  yes_count_fp: string;
  no_count_fp: string;
  fee_cost: string;
  value: number;
}

interface KalshiFill {
  ticker: string;
  market_ticker: string;
  action: "buy" | "sell";
  side: "yes" | "no";
  count_fp: string;
  yes_price_dollars: string;
  no_price_dollars: string;
  fee_cost: string;
}

router.get("/kalshi/trades", async (_req: Request, res: Response) => {
  const apiKeyId = process.env.KALSHI_API_KEY;
  const privateKeyPem = getPrivateKey();

  if (!apiKeyId || !privateKeyPem) {
    res.status(503).json({ error: "Kalshi not configured.", configured: false });
    return;
  }

  try {
    // Fetch settlements and fills in parallel
    const [settlementsResult, fillsResult] = await Promise.allSettled([
      // Paginate settlements (max 5 pages × 100)
      (async () => {
        const all: KalshiSettlement[] = [];
        let cursor = "";
        for (let page = 0; page < 5; page++) {
          const path = cursor
            ? `/portfolio/settlements?limit=100&cursor=${encodeURIComponent(cursor)}`
            : "/portfolio/settlements?limit=100";
          const d = await kalshiFetch(apiKeyId, privateKeyPem, path) as {
            settlements: KalshiSettlement[];
            cursor?: string;
          };
          const batch = d.settlements ?? [];
          all.push(...batch);
          cursor = d.cursor ?? "";
          if (!cursor || batch.length < 100) break;
        }
        return all;
      })(),
      // Paginate fills (max 10 pages × 100)
      // fills give us the true buy cost and sell proceeds per market so we can
      // compute accurate net P&L: pnl = settlement_revenue + sell_proceeds - buy_costs
      (async () => {
        const all: KalshiFill[] = [];
        let cursor = "";
        for (let page = 0; page < 10; page++) {
          const path = cursor
            ? `/portfolio/fills?limit=100&cursor=${encodeURIComponent(cursor)}`
            : "/portfolio/fills?limit=100";
          const d = await kalshiFetch(apiKeyId, privateKeyPem, path) as {
            fills: KalshiFill[];
            cursor?: string;
          };
          const batch = d.fills ?? [];
          all.push(...batch);
          cursor = d.cursor ?? "";
          if (!cursor || batch.length < 100) break;
        }
        return all;
      })(),
    ]);

    const allSettlements = settlementsResult.status === "fulfilled" ? settlementsResult.value : [];
    const allFills = fillsResult.status === "fulfilled" ? fillsResult.value : [];

    // Build ticker → fills breakdown from available history (~30 days)
    // Note: fills older than ~30 days are not returned by the API, so some
    // opening buy fills may be missing for positions opened before that window.
    const fillsByTicker = new Map<string, {
      buyTotal: number; sellTotal: number;
      buyYes: number; sellYes: number;
      buyNo: number; sellNo: number;
    }>();
    for (const fill of allFills) {
      const key = fill.market_ticker || fill.ticker;
      if (!fillsByTicker.has(key)) {
        fillsByTicker.set(key, { buyTotal: 0, sellTotal: 0, buyYes: 0, sellYes: 0, buyNo: 0, sellNo: 0 });
      }
      const entry = fillsByTicker.get(key)!;
      const count = parseFloat(fill.count_fp ?? "0");
      const price = fill.side === "yes"
        ? parseFloat(fill.yes_price_dollars ?? "0")
        : parseFloat(fill.no_price_dollars ?? "0");
      const amount = count * price;
      if (fill.action === "buy") {
        entry.buyTotal += amount;
        if (fill.side === "yes") entry.buyYes += amount;
        else entry.buyNo += amount;
      } else {
        entry.sellTotal += amount;
        if (fill.side === "yes") entry.sellYes += amount;
        else entry.sellNo += amount;
      }
    }

    // Only include settlements where the user actually had fills (traded)
    const withPosition = allSettlements.filter(
      (s) => s.yes_total_cost > 0 || s.no_total_cost > 0,
    );

    // Fetch market titles in parallel (cap at 50)
    const capped = withPosition.slice(0, 50);
    const marketDetails = await Promise.allSettled(
      capped.map((s) =>
        kalshiFetch(
          apiKeyId,
          privateKeyPem,
          `/markets/${encodeURIComponent(s.ticker)}`,
        ).then((d: KalshiMarketResponse) => d?.market ?? null),
      ),
    );

    const trades = capped.map((s, i) => {
      const market =
        marketDetails[i].status === "fulfilled" ? marketDetails[i].value : null;

      // settlement_revenue: cash received when market settled (winners only)
      const settlementRevenue = s.revenue / 100;

      // fills-based: buy_costs and sell_proceeds for this market
      const fillData = fillsByTicker.get(s.ticker);
      let pnl: number;
      let cost: number;

      // Detect incomplete fill data: if we see sells of a side with no buys of that side,
      // the original opening trades happened before the 30-day fills window.
      const missingSideData = fillData
        ? (fillData.sellNo > 0.01 && fillData.buyNo < 0.01) ||
          (fillData.sellYes > 0.01 && fillData.buyYes < 0.01)
        : false;
      const dataComplete = fillData !== undefined && !missingSideData;

      if (fillData) {
        // True P&L = settlement payout + sell proceeds − all buy costs
        pnl = settlementRevenue + fillData.sellTotal - fillData.buyTotal;
        cost = fillData.buyTotal - fillData.sellTotal;
      } else {
        // No fills found — fall back to gross cost from settlements
        cost = (s.yes_total_cost + s.no_total_cost) / 100;
        pnl = settlementRevenue - cost;
      }

      const win = pnl > 0;
      const payout = settlementRevenue;

      const costCents = s.yes_total_cost + s.no_total_cost;
      const yesPct = s.yes_total_cost > 0 && costCents > 0
        ? Math.round((s.yes_total_cost / costCents) * 100)
        : 0;

      return {
        ticker: s.ticker,
        eventTicker: s.event_ticker,
        title: market?.title ?? s.ticker,
        marketResult: s.market_result as "yes" | "no",
        settledTime: s.settled_time,
        payout,
        cost,
        pnl,
        win,
        dataComplete,
        yesContracts: parseFloat(s.yes_count_fp ?? "0"),
        noContracts: parseFloat(s.no_count_fp ?? "0"),
        yesCostPct: yesPct,
        noCostPct: 100 - yesPct,
        fees: parseFloat(s.fee_cost ?? "0"),
        pnlSource: fillData ? (dataComplete ? "fills" : "fills-partial") : "fallback",
      };
    });

    // Sort newest first
    trades.sort(
      (a, b) =>
        new Date(b.settledTime).getTime() - new Date(a.settledTime).getTime(),
    );

    const wins = trades.filter((t) => t.win).length;
    const totalPnl = trades.reduce((sum, t) => sum + t.pnl, 0);
    const incompleteCount = trades.filter((t) => !t.dataComplete).length;

    res.json({
      trades,
      summary: {
        total: trades.length,
        wins,
        losses: trades.length - wins,
        winRate: trades.length > 0 ? Math.round((wins / trades.length) * 100) : 0,
        totalPnl,
        // When true, some trades have missing historical fills (opened >30 days ago).
        // The totalPnl may be overstated — opening buy costs are not available via the API.
        hasIncompleteData: incompleteCount > 0,
        incompleteCount,
      },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(502).json({ error: `Kalshi trades error: ${msg}` });
  }
});

export default router;
