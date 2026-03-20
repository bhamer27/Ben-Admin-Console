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
  const msg = ts + method.toUpperCase() + path;
  const sig = crypto.sign("SHA256", Buffer.from(msg), {
    key: privateKeyPem,
    padding: crypto.constants.RSA_PKCS1_PSS_PADDING,
    saltLength: crypto.constants.RSA_PSS_SALTLEN_DIGEST,
  });
  return { ts, sig: sig.toString("base64") };
}

async function kalshiFetch(
  apiKeyId: string,
  privateKeyPem: string,
  path: string,
) {
  const method = "GET";
  const { ts, sig } = signRequest(privateKeyPem, method, `/trade-api/v2${path}`);

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
      kalshiFetch(apiKeyId, privateKeyPem, "/portfolio/balance") as Promise<{
        balance: number;
        portfolio_value?: number;
      }>,
      kalshiFetch(apiKeyId, privateKeyPem, "/portfolio/positions?limit=100") as Promise<{
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

    const openPositions = positions.filter((p) => (p.position ?? 0) !== 0);

    const marketDetails = await Promise.allSettled(
      openPositions.map((p) =>
        kalshiFetch(
          apiKeyId,
          privateKeyPem,
          `/markets/${encodeURIComponent(p.ticker)}`,
        ).then(
          (d: {
            market?: {
              title?: string;
              yes_bid?: number;
              yes_ask?: number;
              no_bid?: number;
              no_ask?: number;
              close_time?: string;
              yes_price?: number;
              result?: string;
            };
          }) => d?.market ?? null,
        ),
      ),
    );

    let totalInvestedCents = 0;
    let totalCurrentValueCents = 0;

    const mappedPositions = openPositions.map((pos, i) => {
      const market =
        marketDetails[i].status === "fulfilled"
          ? marketDetails[i].value
          : null;

      const contracts = Math.abs(pos.position ?? 0);
      const side = (pos.side as "yes" | "no") ?? "yes";

      const costCents = Math.abs(pos.market_exposure ?? pos.total_traded ?? 0);

      const yesBid = market?.yes_bid ?? 0;
      const yesAsk = market?.yes_ask ?? 0;
      const noBid = market?.no_bid ?? 0;
      const noAsk = market?.no_ask ?? 0;

      const currentPriceCents =
        side === "yes"
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
    const unrealizedPnl =
      (totalCurrentValueCents - totalInvestedCents) / 100;

    // Use Kalshi's own portfolio_value if available, else compute
    const kalshiPortfolioValue = balanceData?.portfolio_value;
    const portfolioValue =
      kalshiPortfolioValue != null
        ? kalshiPortfolioValue / 100
        : balance + totalInvested;

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
