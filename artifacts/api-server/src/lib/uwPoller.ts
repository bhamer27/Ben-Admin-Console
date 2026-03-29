

import { db, flowAlertsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { analyzeSignal, type UwAlert } from "./signalReviewer.js";
import { logger } from "./logger.js";

const UW_API_URL = "https://api.unusualwhales.com/api/option-trades/flow-alerts";
const POLL_INTERVAL_MS = 60_000; // 60 seconds

let pollInterval: ReturnType<typeof setInterval> | null = null;
const analyzedSet = new Set<string>();

export let lastPollAt: Date | null = null;
export let alertsProcessed = 0;
export let engineRunning = false;

async function fetchFlowAlerts(): Promise<UwAlert[]> {
  const apiKey = process.env.UNUSUAL_WHALES_API_KEY;
  if (!apiKey) {
    logger.warn("UNUSUAL_WHALES_API_KEY not set — skipping poll");
    return [];
  }

  const res = await fetch(UW_API_URL, {
    headers: {
      Authorization: `Token ${apiKey}`,
      Accept: "application/json",
    },
    signal: AbortSignal.timeout(15_000),
  });

  if (!res.ok) {
    throw new Error(`UW API error ${res.status}: ${await res.text()}`);
  }

  const data = await res.json() as { data?: UwAlert[]; alerts?: UwAlert[] } | UwAlert[];
  // Handle different response shapes
  if (Array.isArray(data)) return data;
  if (Array.isArray((data as { data?: UwAlert[] }).data)) return (data as { data: UwAlert[] }).data;
  if (Array.isArray((data as { alerts?: UwAlert[] }).alerts)) return (data as { alerts: UwAlert[] }).alerts;
  return [];
}

function filterAlert(alert: UwAlert): boolean {
  // Must have required fields
  if (!alert.id || !alert.ticker) return false;
  if (!alert.dte || !alert.strike) return false;

  // Premium must be >= $50k (UW stores in cents/dollars — check both cases)
  const premium = alert.premium ?? 0;
  // UW typically stores premium in dollars
  if (premium < 50_000) return false;

  return true;
}

async function isAlreadyAnalyzed(id: string): Promise<boolean> {
  if (analyzedSet.has(id)) return true;
  const existing = await db
    .select({ id: flowAlertsTable.id })
    .from(flowAlertsTable)
    .where(eq(flowAlertsTable.id, id));
  return existing.length > 0;
}

async function pollOnce(): Promise<void> {
  try {
    lastPollAt = new Date();
    const alerts = await fetchFlowAlerts();
    logger.debug({ count: alerts.length }, "UW flow alerts fetched");

    for (const alert of alerts) {
      if (!filterAlert(alert)) continue;
      if (await isAlreadyAnalyzed(alert.id)) continue;

      analyzedSet.add(alert.id);
      alertsProcessed++;

      // Process each new alert (don't await all — fire sequentially to avoid overload)
      try {
        await analyzeSignal(alert);
      } catch (err) {
        logger.error({ err, alertId: alert.id, ticker: alert.ticker }, "analyzeSignal failed");
      }
    }
  } catch (err) {
    logger.error({ err }, "UW poller error");
  }
}

export function startUwPoller(): void {
  if (pollInterval) return;
  engineRunning = true;
  logger.info("UW poller started (60s interval)");
  void pollOnce();
  pollInterval = setInterval(() => void pollOnce(), POLL_INTERVAL_MS);
}

export function stopUwPoller(): void {
  if (pollInterval) {
    clearInterval(pollInterval);
    pollInterval = null;
    engineRunning = false;
    logger.info("UW poller stopped");
  }
}
