/**
 * Products proxy route — fetches /api/admin/users from each product app.
 * Auth: X-Hub-Secret header using CRON_SECRET env var.
 */
import { Router, type IRouter, type Request, type Response } from "express";

const router: IRouter = Router();

export interface ProductUser {
  id: string | number;
  name: string | null;
  email: string | null;
  plan: string;
  subscription_status: string;
  created_at: string | null;
  last_active: string | null;
}

const PRODUCTS = {
  permitradar: "PERMITRADAR_URL",
  revoo:       "REVOO_URL",
  leadpulse:   "LEADPULSE_URL",
  answerdine:  "ANSWERDINE_URL",
} as const;

async function fetchUsers(baseUrl: string, secret: string): Promise<ProductUser[]> {
  const res = await fetch(`${baseUrl}/api/admin/users`, {
    headers: { "x-hub-secret": secret },
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) throw new Error(`${res.status} from ${baseUrl}`);
  const data = await res.json() as { users: ProductUser[] };
  return data.users ?? [];
}

router.get("/products/:app/users", async (req: Request, res: Response) => {
  const app = req.params.app as keyof typeof PRODUCTS;
  if (!PRODUCTS[app]) {
    res.status(404).json({ error: `Unknown app: ${app}` });
    return;
  }

  const secret = process.env.CRON_SECRET;
  if (!secret) {
    res.status(503).json({ error: "CRON_SECRET not configured", configured: false });
    return;
  }

  const envKey = PRODUCTS[app];
  const baseUrl = process.env[envKey];
  if (!baseUrl) {
    res.status(503).json({ error: `${envKey} not configured`, configured: false });
    return;
  }

  try {
    const users = await fetchUsers(baseUrl, secret);
    res.json({ app, users });
  } catch (err) {
    res.status(502).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

// Fetch all 4 in parallel
router.get("/products/all/users", async (_req: Request, res: Response) => {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    res.status(503).json({ error: "CRON_SECRET not configured", configured: false });
    return;
  }

  const results: Record<string, { users: ProductUser[]; error?: string; configured: boolean }> = {};

  await Promise.all(
    (Object.entries(PRODUCTS) as [string, string][]).map(async ([app, envKey]) => {
      const baseUrl = process.env[envKey];
      if (!baseUrl) {
        results[app] = { users: [], configured: false };
        return;
      }
      try {
        const users = await fetchUsers(baseUrl, secret);
        results[app] = { users, configured: true };
      } catch (err) {
        results[app] = { users: [], error: err instanceof Error ? err.message : String(err), configured: true };
      }
    })
  );

  res.json(results);
});

export default router;
