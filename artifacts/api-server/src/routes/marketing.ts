import { Router, type IRouter, type Request, type Response } from "express";

const router: IRouter = Router();

// ──────────────────────────────────────────
// Google Search Console
// ──────────────────────────────────────────
async function fetchSearchConsole(accessToken: string, siteUrl: string) {
  const endDate = new Date();
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - 30);

  const fmt = (d: Date) => d.toISOString().split("T")[0];

  const res = await fetch(
    `https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(siteUrl)}/searchAnalytics/query`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        startDate: fmt(startDate),
        endDate: fmt(endDate),
        dimensions: ["date"],
        rowLimit: 30,
      }),
      signal: AbortSignal.timeout(15_000),
    },
  );

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Search Console API ${res.status}: ${text.slice(0, 200)}`);
  }

  const data = await res.json() as {
    rows?: { clicks: number; impressions: number; ctr: number; position: number }[];
  };

  const rows = data.rows ?? [];
  return {
    clicks: rows.reduce((s, r) => s + r.clicks, 0),
    impressions: rows.reduce((s, r) => s + r.impressions, 0),
    avgCtr: rows.length ? rows.reduce((s, r) => s + r.ctr, 0) / rows.length : 0,
    avgPosition: rows.length ? rows.reduce((s, r) => s + r.position, 0) / rows.length : 0,
  };
}

// ──────────────────────────────────────────
// Google Ads
// ──────────────────────────────────────────
async function fetchGoogleAds(accessToken: string, customerId: string, developerToken: string) {
  const query = `
    SELECT
      metrics.cost_micros,
      metrics.conversions,
      metrics.impressions,
      metrics.clicks
    FROM customer
    WHERE segments.date DURING LAST_30_DAYS
  `;

  const res = await fetch(
    `https://googleads.googleapis.com/v19/customers/${customerId}/googleAds:searchStream`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "developer-token": developerToken,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ query }),
      signal: AbortSignal.timeout(15_000),
    },
  );

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Google Ads API ${res.status}: ${text.slice(0, 200)}`);
  }

  const data = await res.json() as {
    results?: {
      metrics?: {
        costMicros?: string;
        conversions?: number;
        impressions?: string;
        clicks?: string;
      };
    }[];
  }[];

  let totalCostMicros = 0;
  let totalConversions = 0;
  let totalImpressions = 0;
  let totalClicks = 0;

  for (const batch of data) {
    for (const row of batch.results ?? []) {
      totalCostMicros += parseInt(row.metrics?.costMicros ?? "0", 10);
      totalConversions += row.metrics?.conversions ?? 0;
      totalImpressions += parseInt(row.metrics?.impressions ?? "0", 10);
      totalClicks += parseInt(row.metrics?.clicks ?? "0", 10);
    }
  }

  return {
    spend: totalCostMicros / 1_000_000,
    conversions: totalConversions,
    impressions: totalImpressions,
    clicks: totalClicks,
  };
}

// ──────────────────────────────────────────
// Instantly.ai
// ──────────────────────────────────────────
async function fetchInstantly(apiKey: string) {
  const res = await fetch("https://api.instantly.ai/api/v1/campaign/list?skip=0&limit=10", {
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    signal: AbortSignal.timeout(10_000),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Instantly API ${res.status}: ${text.slice(0, 200)}`);
  }

  const data = await res.json() as {
    data?: {
      id: string;
      name: string;
      status: number;
      email_list?: string[];
    }[];
  };

  const campaigns = data.data ?? [];

  // Fetch analytics for each campaign
  const analytics = await Promise.allSettled(
    campaigns.slice(0, 5).map(async (c) => {
      const r = await fetch(
        `https://api.instantly.ai/api/v1/analytics/campaign/summary?campaign_id=${c.id}`,
        {
          headers: { Authorization: `Bearer ${apiKey}` },
          signal: AbortSignal.timeout(10_000),
        },
      );
      if (!r.ok) return null;
      return r.json() as Promise<{
        total_leads_count?: number;
        contacted_count?: number;
        emails_sent_count?: number;
        open_count?: number;
        reply_count?: number;
      }>;
    }),
  );

  let totalSent = 0;
  let totalOpens = 0;
  let totalReplies = 0;

  for (const result of analytics) {
    if (result.status === "fulfilled" && result.value) {
      totalSent += result.value.emails_sent_count ?? 0;
      totalOpens += result.value.open_count ?? 0;
      totalReplies += result.value.reply_count ?? 0;
    }
  }

  return {
    activeCampaigns: campaigns.filter((c) => c.status === 1).length,
    totalCampaigns: campaigns.length,
    emailsSent30d: totalSent,
    openRate: totalSent > 0 ? totalOpens / totalSent : 0,
    replyRate: totalSent > 0 ? totalReplies / totalSent : 0,
    campaigns: campaigns.map((c) => ({
      id: c.id,
      name: c.name,
      status: c.status,
    })),
  };
}

// ──────────────────────────────────────────
// Routes
// ──────────────────────────────────────────

router.get("/marketing/search-console", async (_req: Request, res: Response) => {
  const accessToken = process.env.GOOGLE_ACCESS_TOKEN;
  const siteUrl = process.env.GOOGLE_SEARCH_CONSOLE_SITE_URL;

  if (!accessToken || !siteUrl) {
    res.status(503).json({
      error: "GOOGLE_ACCESS_TOKEN and GOOGLE_SEARCH_CONSOLE_SITE_URL are required.",
      configured: false,
    });
    return;
  }

  try {
    const data = await fetchSearchConsole(accessToken, siteUrl);
    res.json(data);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(502).json({ error: msg });
  }
});

router.get("/marketing/google-ads", async (_req: Request, res: Response) => {
  const accessToken = process.env.GOOGLE_ACCESS_TOKEN;
  const customerId = process.env.GOOGLE_ADS_CUSTOMER_ID;
  const developerToken = process.env.GOOGLE_ADS_DEVELOPER_TOKEN;

  if (!accessToken || !customerId || !developerToken) {
    res.status(503).json({
      error: "GOOGLE_ACCESS_TOKEN, GOOGLE_ADS_CUSTOMER_ID, and GOOGLE_ADS_DEVELOPER_TOKEN are required.",
      configured: false,
    });
    return;
  }

  try {
    const data = await fetchGoogleAds(accessToken, customerId, developerToken);
    res.json(data);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(502).json({ error: msg });
  }
});

router.get("/marketing/instantly", async (_req: Request, res: Response) => {
  const apiKey = process.env.INSTANTLY_API_KEY;

  if (!apiKey) {
    res.status(503).json({
      error: "INSTANTLY_API_KEY is not configured.",
      configured: false,
    });
    return;
  }

  try {
    const data = await fetchInstantly(apiKey);
    res.json(data);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(502).json({ error: msg });
  }
});

export default router;
