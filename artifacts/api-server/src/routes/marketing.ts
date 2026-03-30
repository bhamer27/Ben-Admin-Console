import { Router, type IRouter, type Request, type Response } from "express";

const router: IRouter = Router();

// ──────────────────────────────────────────
// Google OAuth token management
// Supports both a long-lived access token (GOOGLE_ACCESS_TOKEN) and a
// refresh-token flow (GOOGLE_REFRESH_TOKEN + GOOGLE_CLIENT_ID + GOOGLE_CLIENT_SECRET).
// If a refresh token is provided, we automatically exchange it for a fresh access
// token on each request — tokens expire after 1 hour, so this is required for
// any production use. If only GOOGLE_ACCESS_TOKEN is set, it is used directly
// (will expire and must be rotated manually).
// ──────────────────────────────────────────
async function getGoogleAccessToken(): Promise<string> {
  const refreshToken = process.env.GOOGLE_REFRESH_TOKEN;
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

  // Prefer refresh-token flow (handles expiry automatically)
  if (refreshToken && clientId && clientSecret) {
    const res = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "refresh_token",
        refresh_token: refreshToken,
        client_id: clientId,
        client_secret: clientSecret,
      }),
      signal: AbortSignal.timeout(10_000),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`Google token refresh failed (${res.status}): ${text.slice(0, 200)}`);
    }

    const data = await res.json() as { access_token?: string; error?: string };
    if (!data.access_token) {
      throw new Error(`Google token refresh returned no access_token: ${data.error ?? "unknown"}`);
    }
    return data.access_token;
  }

  // Fall back to static token (user must rotate manually when expired)
  const staticToken = process.env.GOOGLE_ACCESS_TOKEN;
  if (staticToken) return staticToken;

  throw new Error("No Google credentials configured. Set GOOGLE_REFRESH_TOKEN + GOOGLE_CLIENT_ID + GOOGLE_CLIENT_SECRET (recommended) or GOOGLE_ACCESS_TOKEN.");
}

function hasGoogleCredentials(): boolean {
  const hasRefreshFlow = !!(
    process.env.GOOGLE_REFRESH_TOKEN &&
    process.env.GOOGLE_CLIENT_ID &&
    process.env.GOOGLE_CLIENT_SECRET
  );
  return hasRefreshFlow || !!process.env.GOOGLE_ACCESS_TOKEN;
}

// ──────────────────────────────────────────
// Google Search Console
// ──────────────────────────────────────────
async function fetchSearchConsole(siteUrl: string) {
  const accessToken = await getGoogleAccessToken();

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
async function fetchGoogleAds(customerId: string, developerToken: string) {
  const accessToken = await getGoogleAccessToken();

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
// Instantly.ai v2 API
// ──────────────────────────────────────────
interface InstantlyV2Campaign {
  id: string;
  name: string;
  status: number;
}

interface InstantlyV2Analytics {
  campaign_id: string;
  campaign_name: string;
  campaign_status: number;
  emails_sent_count: number;
  open_count: number;
  reply_count: number;
}

async function fetchInstantlyAllCampaigns(apiKey: string): Promise<InstantlyV2Campaign[]> {
  const allCampaigns: InstantlyV2Campaign[] = [];
  const pageSize = 100;
  let startingAfter: string | undefined;

  while (true) {
    const url = new URL("https://api.instantly.ai/api/v2/campaigns");
    url.searchParams.set("limit", String(pageSize));
    if (startingAfter) url.searchParams.set("starting_after", startingAfter);

    const res = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${apiKey}` },
      signal: AbortSignal.timeout(15_000),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`Instantly v2 campaigns ${res.status}: ${text.slice(0, 200)}`);
    }

    const data = await res.json() as { items: InstantlyV2Campaign[]; next_starting_after?: string };
    const page = data.items ?? [];
    allCampaigns.push(...page);

    if (!data.next_starting_after || page.length < pageSize || allCampaigns.length >= 1000) break;
    startingAfter = data.next_starting_after;
  }

  return allCampaigns;
}

async function fetchInstantly(apiKey: string) {
  // Fetch campaigns list and bulk analytics in parallel
  const [campaigns, analyticsRes] = await Promise.all([
    fetchInstantlyAllCampaigns(apiKey),
    fetch("https://api.instantly.ai/api/v2/campaigns/analytics", {
      headers: { Authorization: `Bearer ${apiKey}` },
      signal: AbortSignal.timeout(15_000),
    }),
  ]);

  let analytics: InstantlyV2Analytics[] = [];
  if (analyticsRes.ok) {
    analytics = await analyticsRes.json() as InstantlyV2Analytics[];
  }

  const totalSent    = analytics.reduce((s, a) => s + (a.emails_sent_count ?? 0), 0);
  const totalOpens   = analytics.reduce((s, a) => s + (a.open_count ?? 0), 0);
  const totalReplies = analytics.reduce((s, a) => s + (a.reply_count ?? 0), 0);

  return {
    activeCampaigns: campaigns.filter((c) => c.status === 1).length,
    totalCampaigns: campaigns.length,
    emailsSent30d: totalSent,
    openRate: totalSent > 0 ? totalOpens / totalSent : 0,
    replyRate: totalSent > 0 ? totalReplies / totalSent : 0,
    campaigns: campaigns.map((c) => ({ id: c.id, name: c.name, status: c.status })),
  };
}

// ──────────────────────────────────────────
// Routes
// ──────────────────────────────────────────

router.get("/marketing/search-console", async (_req: Request, res: Response) => {
  const siteUrl = process.env.GOOGLE_SEARCH_CONSOLE_SITE_URL;

  if (!hasGoogleCredentials() || !siteUrl) {
    res.status(503).json({
      error: "Google credentials and GOOGLE_SEARCH_CONSOLE_SITE_URL are required. Set GOOGLE_REFRESH_TOKEN + GOOGLE_CLIENT_ID + GOOGLE_CLIENT_SECRET (recommended) or GOOGLE_ACCESS_TOKEN.",
      configured: false,
    });
    return;
  }

  try {
    const data = await fetchSearchConsole(siteUrl);
    res.json(data);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(502).json({ error: msg });
  }
});

router.get("/marketing/google-ads", async (_req: Request, res: Response) => {
  const customerId = process.env.GOOGLE_ADS_CUSTOMER_ID;
  const developerToken = process.env.GOOGLE_ADS_DEVELOPER_TOKEN;

  if (!hasGoogleCredentials() || !customerId || !developerToken) {
    res.status(503).json({
      error: "Google credentials, GOOGLE_ADS_CUSTOMER_ID, and GOOGLE_ADS_DEVELOPER_TOKEN are required. Set GOOGLE_REFRESH_TOKEN + GOOGLE_CLIENT_ID + GOOGLE_CLIENT_SECRET (recommended) or GOOGLE_ACCESS_TOKEN.",
      configured: false,
    });
    return;
  }

  try {
    const data = await fetchGoogleAds(customerId, developerToken);
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
