import { Router, type IRouter, type Request, type Response } from "express";
import { db, permitradarCityRequestsTable } from "@workspace/db";
import { eq, desc, count } from "drizzle-orm";

const router: IRouter = Router();

// GET /api/permitradar/city-requests — list all city requests (auth-protected globally)
router.get("/permitradar/city-requests", async (_req: Request, res: Response) => {
  try {
    const entries = await db
      .select()
      .from(permitradarCityRequestsTable)
      .orderBy(desc(permitradarCityRequestsTable.createdAt));

    const [totals] = await db
      .select({ total: count() })
      .from(permitradarCityRequestsTable);

    const byStatus = await db
      .select({ status: permitradarCityRequestsTable.status, cnt: count() })
      .from(permitradarCityRequestsTable)
      .groupBy(permitradarCityRequestsTable.status);

    const statusMap: Record<string, number> = {};
    for (const row of byStatus) {
      statusMap[row.status] = Number(row.cnt);
    }

    res.json({
      entries,
      summary: {
        total: Number(totals?.total ?? 0),
        pending: statusMap["pending"] ?? 0,
        added: statusMap["added"] ?? 0,
        declined: statusMap["declined"] ?? 0,
      },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: `City requests error: ${msg}` });
  }
});

// POST /api/permitradar/city-requests — add request (token-gated for PermitRadar to call)
router.post("/permitradar/city-requests", async (req: Request, res: Response) => {
  const token = (req.headers["x-benadmin-token"] ?? req.query["token"]) as string | undefined;
  const expected = process.env.BENADMIN_TOKEN;
  if (expected && token !== expected) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const { cityName, state, country, contactName, email, reason, source } =
    req.body as Record<string, string>;

  if (!cityName) {
    res.status(400).json({ error: "cityName is required" });
    return;
  }

  try {
    const [entry] = await db
      .insert(permitradarCityRequestsTable)
      .values({ cityName, state, country, contactName, email, reason, source })
      .returning();

    res.status(201).json({ entry });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: `Insert error: ${msg}` });
  }
});

// PATCH /api/permitradar/city-requests/:id/status — update status
router.patch("/permitradar/city-requests/:id/status", async (req: Request, res: Response) => {
  const id = parseInt(String(req.params.id), 10);
  const { status } = req.body as { status: string };

  const allowed = ["pending", "added", "declined"];
  if (!allowed.includes(status)) {
    res.status(400).json({ error: `status must be one of: ${allowed.join(", ")}` });
    return;
  }

  try {
    const [updated] = await db
      .update(permitradarCityRequestsTable)
      .set({ status })
      .where(eq(permitradarCityRequestsTable.id, id))
      .returning();

    if (!updated) {
      res.status(404).json({ error: "Entry not found" });
      return;
    }

    res.json({ entry: updated });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: `Update error: ${msg}` });
  }
});

export default router;
