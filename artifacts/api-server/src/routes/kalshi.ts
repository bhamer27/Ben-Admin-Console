import { Router, type IRouter, type Request, type Response } from "express";

const router: IRouter = Router();

const KALSHI_BASE = "https://api.kalshi.com/trade-api/v2";

async function kalshiFetch(apiKey: string, path: string) {
  const res = await fetch(`${KALSHI_BASE}${path}`, {
    headers: {
      Authorization: `Bearer ${apiKey}`,
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

router.get("/kalshi/stats", async (_req: Request, res: Response) => {
  const apiKey = process.env.KALSHI_API_KEY;

  if (!apiKey) {
    res.status(503).json({
      error: "KALSHI_API_KEY is not configured.",
      configured: false,
    });
    return;
  }

  try {
    // Fetch balance and positions in parallel
    const [balanceData, positionsData] = await Promise.all([
      kalshiFetch(apiKey, "/portfolio/balance") as Promise<{ balance: number }>,
      kalshiFetch(apiKey, "/portfolio/positions?limit=100") as Promise<{
        positions: {
          ticker: string;
          market_id?: string;
          event_ticker?: string;
          side?: string;
          position: number;
          total_traded: number;
          market_exposure?: number;
          realized_pnl?: number;
          resting_order_total_quantity?: number;
          fees_paid?: number;
        }[];
        cursor?: string;
      }>,
    ]);

    const balanceCents = balanceData?.balance ?? 0;
    const balance = balanceCents / 100;
    const positions = positionsData?.positions ?? [];

    // Fetch market details for all open positions to get prices and titles
    const openPositions = positions.filter((p) => (p.position ?? 0) !== 0);

    const marketDetails = await Promise.allSettled(
      openPositions.map((p) =>
        kalshiFetch(apiKey, `/markets/${encodeURIComponent(p.ticker)}`).then(
          (d: { market?: {
            title?: string;
            yes_bid?: number;
            yes_ask?: number;
            no_bid?: number;
            no_ask?: number;
            close_time?: string;
            yes_price?: number;
            result?: string;
          } }) => d?.market ?? null,
        ),
      ),
    );

    let totalInvestedCents = 0;
    let totalCurrentValueCents = 0;

    const mappedPositions = openPositions.map((pos, i) => {
      const market = marketDetails[i].status === "fulfilled" ? marketDetails[i].value : null;

      const contracts = Math.abs(pos.position ?? 0);
      const side = (pos.side as "yes" | "no") ?? "yes";

      // market_exposure = cost basis in cents
      const costCents = Math.abs(pos.market_exposure ?? pos.total_traded ?? 0);

      // Current value = contracts × current price (mid of bid/ask)
      const yesBid = market?.yes_bid ?? 0;
      const yesAsk = market?.yes_ask ?? 0;
      const noBid = market?.no_bid ?? 0;
      const noAsk = market?.no_ask ?? 0;

      const currentPriceCents = side === "yes"
        ? Math.round((yesBid + yesAsk) / 2)
        : Math.round((noBid + noAsk) / 2);

      const currentValueCents = contracts * currentPriceCents;
      const pnlCents = currentValueCents - costCents;

      totalInvestedCents += costCents;
      totalCurrentValueCents += currentValueCents;

      return {
        ticker: pos.ticker,
        title: market?.title ?? pos.ticker,
        side,
        contracts,
        invested: costCents / 100,
        currentValue: currentValueCents / 100,
        pnl: pnlCents / 100,
        yesBid,
        yesAsk,
        noBid,
        noAsk,
        closeTime: market?.close_time ?? "",
        yesPrice: market?.yes_price ?? 0,
      };
    });

    const totalInvested = totalInvestedCents / 100;
    const unrealizedPnl = (totalCurrentValueCents - totalInvestedCents) / 100;
    const portfolioValue = balance + totalInvested;
    const cashPct = portfolioValue > 0 ? Math.round((balance / portfolioValue) * 100) : 100;
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
