import { Router, type IRouter, type Request, type Response } from "express";

const router: IRouter = Router();

router.get("/kalshi/stats", async (_req: Request, res: Response) => {
  const statsUrl = process.env.KALSHI_STATS_URL;

  if (!statsUrl) {
    res.status(503).json({
      error: "KALSHI_STATS_URL is not configured.",
      configured: false,
    });
    return;
  }

  try {
    const upstream = await fetch(statsUrl, {
      headers: { "Accept": "application/json" },
      signal: AbortSignal.timeout(10_000),
    });

    if (!upstream.ok) {
      res.status(502).json({
        error: `Upstream Kalshi stats endpoint returned ${upstream.status}`,
      });
      return;
    }

    const data = await upstream.json();
    res.json(data);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(502).json({ error: `Failed to reach Kalshi stats endpoint: ${msg}` });
  }
});

export default router;
