import { Router, type IRouter, type Request, type Response } from "express";
import { db, revooWaitlistTable } from "@workspace/db";
import { eq, desc, count } from "drizzle-orm";

const router: IRouter = Router();

// GET /api/revoo/waitlist — list all waitlist entries (auth-protected globally)
router.get("/revoo/waitlist", async (_req: Request, res: Response) => {
  try {
    const entries = await db
      .select()
      .from(revooWaitlistTable)
      .orderBy(desc(revooWaitlistTable.createdAt));

    const [totals] = await db
      .select({ total: count() })
      .from(revooWaitlistTable);

    const byStatus = await db
      .select({ status: revooWaitlistTable.status, cnt: count() })
      .from(revooWaitlistTable)
      .groupBy(revooWaitlistTable.status);

    const statusMap: Record<string, number> = {};
    for (const row of byStatus) {
      statusMap[row.status] = Number(row.cnt);
    }

    res.json({
      entries,
      summary: {
        total: Number(totals?.total ?? 0),
        pending: statusMap["pending"] ?? 0,
        activated: statusMap["activated"] ?? 0,
        rejected: statusMap["rejected"] ?? 0,
      },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: `Waitlist error: ${msg}` });
  }
});

// POST /api/revoo/waitlist — add entry (token-gated so Re-Voo can call this)
router.post("/revoo/waitlist", async (req: Request, res: Response) => {
  const token = (req.headers["x-benadmin-token"] ?? req.query["token"]) as string | undefined;
  const expected = process.env.BENADMIN_TOKEN;
  if (expected && token !== expected) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const { businessName, contactName, email, phone, googleBusinessUrl, notes, source } =
    req.body as Record<string, string>;

  if (!businessName) {
    res.status(400).json({ error: "businessName is required" });
    return;
  }

  try {
    const [entry] = await db
      .insert(revooWaitlistTable)
      .values({ businessName, contactName, email, phone, googleBusinessUrl, notes, source })
      .returning();

    res.status(201).json({ entry });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: `Insert error: ${msg}` });
  }
});

// PATCH /api/revoo/waitlist/:id/status — update status (auth-protected)
router.patch("/revoo/waitlist/:id/status", async (req: Request, res: Response) => {
  const id = parseInt(String(req.params.id), 10);
  const { status } = req.body as { status: string };

  const allowed = ["pending", "activated", "rejected"];
  if (!allowed.includes(status)) {
    res.status(400).json({ error: `status must be one of: ${allowed.join(", ")}` });
    return;
  }

  try {
    const [updated] = await db
      .update(revooWaitlistTable)
      .set({ status })
      .where(eq(revooWaitlistTable.id, id))
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
