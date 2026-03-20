import { Router, type IRouter, type Request, type Response } from "express";

const router: IRouter = Router();

const TARS_URL = "https://tars-ai.replit.app";

// Cache the session cookie so we don't login every request
let sessionCookie = "";
let cookieExpiresAt = 0;

async function tarsLogin(): Promise<string> {
  const password = process.env.TARS_PASSWORD;
  if (!password) throw new Error("TARS_PASSWORD not configured");

  const res = await fetch(`${TARS_URL}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ password }),
    signal: AbortSignal.timeout(10_000),
  });

  if (!res.ok) throw new Error(`Tars login failed: ${res.status}`);

  const setCookie = res.headers.get("set-cookie") ?? "";
  const match = setCookie.match(/tars_session=([^;]+)/);
  if (!match) throw new Error("No session cookie from Tars login");

  sessionCookie = `tars_session=${match[1]}`;
  cookieExpiresAt = Date.now() + 3600_000; // refresh hourly
  return sessionCookie;
}

async function tarsGet(path: string): Promise<unknown> {
  if (!sessionCookie || Date.now() > cookieExpiresAt) {
    await tarsLogin();
  }

  const res = await fetch(`${TARS_URL}/api${path}`, {
    headers: { Cookie: sessionCookie },
    signal: AbortSignal.timeout(15_000),
  });

  // If unauthorized, retry login once
  if (res.status === 401) {
    await tarsLogin();
    const retry = await fetch(`${TARS_URL}/api${path}`, {
      headers: { Cookie: sessionCookie },
      signal: AbortSignal.timeout(15_000),
    });
    if (!retry.ok) throw new Error(`Tars ${path}: ${retry.status}`);
    return retry.json();
  }

  if (!res.ok) throw new Error(`Tars ${path}: ${res.status}`);
  return res.json();
}

router.get("/tars/snapshot", async (_req: Request, res: Response) => {
  const password = process.env.TARS_PASSWORD;
  if (!password) {
    res.status(503).json({ error: "TARS_PASSWORD not configured", configured: false });
    return;
  }

  try {
    const [account, metrics, engine, positions, flowAnalyses] = await Promise.all([
      tarsGet("/account") as Promise<Record<string, unknown>>,
      tarsGet("/metrics") as Promise<Record<string, unknown>>,
      tarsGet("/engine/status") as Promise<Record<string, unknown>>,
      tarsGet("/positions") as Promise<unknown[]>,
      tarsGet("/flow-analyses?limit=10") as Promise<unknown[]>,
    ]);

    res.json({
      account,
      metrics,
      engine,
      positions,
      recentAnalyses: Array.isArray(flowAnalyses) ? flowAnalyses.slice(0, 10) : [],
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(502).json({ error: msg });
  }
});

export default router;
