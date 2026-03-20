import { Router, type IRouter, type Request, type Response } from "express";
import Stripe from "stripe";

const router: IRouter = Router();

function getStripeClients(): Stripe[] {
  const keys = (process.env.STRIPE_SECRET_KEYS || process.env.STRIPE_SECRET_KEY || "")
    .split(",")
    .map((k) => k.trim())
    .filter(Boolean);
  return keys.map((k) => new Stripe(k));
}

interface StripeMetrics {
  mrr: number;
  totalRevenue30d: number;
  newSubscribers30d: number;
  activeSubscriptions: number;
  byPriceId: Record<
    string,
    { name: string; mrr: number; activeCount: number }
  >;
}

async function fetchAccountMetrics(client: Stripe): Promise<StripeMetrics> {
  const now = Math.floor(Date.now() / 1000);
  const thirtyDaysAgo = now - 30 * 24 * 60 * 60;

  const [subsPage, chargesPage] = await Promise.all([
    client.subscriptions.list({
      status: "active",
      limit: 100,
      expand: ["data.plan.product"],
    }),
    client.charges.list({
      created: { gte: thirtyDaysAgo },
      limit: 100,
    }),
  ]);

  const subs = subsPage.data;
  const charges = chargesPage.data;

  let mrr = 0;
  const byPriceId: Record<string, { name: string; mrr: number; activeCount: number }> = {};

  for (const sub of subs) {
    for (const item of sub.items.data) {
      const price = item.price;
      const amount = price.unit_amount ?? 0;
      const interval = price.recurring?.interval;
      const intervalCount = price.recurring?.interval_count ?? 1;

      let monthlyAmount = 0;
      if (interval === "month") monthlyAmount = amount / intervalCount;
      else if (interval === "year") monthlyAmount = (amount / 12) / intervalCount;
      else if (interval === "week") monthlyAmount = (amount * 4.333) / intervalCount;
      else if (interval === "day") monthlyAmount = (amount * 30) / intervalCount;

      monthlyAmount = monthlyAmount * (item.quantity ?? 1);
      mrr += monthlyAmount;

      const priceId = price.id;
      const product = typeof price.product === "object" && price.product !== null
        ? (price.product as Stripe.Product).name
        : priceId;

      if (!byPriceId[priceId]) {
        byPriceId[priceId] = { name: product, mrr: 0, activeCount: 0 };
      }
      byPriceId[priceId].mrr += monthlyAmount;
      byPriceId[priceId].activeCount += item.quantity ?? 1;
    }
  }

  const totalRevenue30d = charges
    .filter((c) => c.paid && !c.refunded)
    .reduce((sum, c) => sum + c.amount, 0);

  const newSubs = await client.subscriptions.list({
    created: { gte: thirtyDaysAgo },
    limit: 100,
  });

  return {
    mrr: Math.round(mrr) / 100,
    totalRevenue30d: totalRevenue30d / 100,
    newSubscribers30d: newSubs.data.length,
    activeSubscriptions: subs.length,
    byPriceId: Object.fromEntries(
      Object.entries(byPriceId).map(([k, v]) => [
        k,
        { ...v, mrr: Math.round(v.mrr) / 100 },
      ]),
    ),
  };
}

router.get("/stripe/metrics", async (_req: Request, res: Response) => {
  const clients = getStripeClients();

  if (clients.length === 0) {
    res.status(503).json({
      error: "No Stripe keys configured. Set STRIPE_SECRET_KEYS or STRIPE_SECRET_KEY.",
      configured: false,
    });
    return;
  }

  try {
    const results = await Promise.allSettled(clients.map(fetchAccountMetrics));

    const aggregated: StripeMetrics = {
      mrr: 0,
      totalRevenue30d: 0,
      newSubscribers30d: 0,
      activeSubscriptions: 0,
      byPriceId: {},
    };

    const errors: string[] = [];

    for (const result of results) {
      if (result.status === "fulfilled") {
        const m = result.value;
        aggregated.mrr += m.mrr;
        aggregated.totalRevenue30d += m.totalRevenue30d;
        aggregated.newSubscribers30d += m.newSubscribers30d;
        aggregated.activeSubscriptions += m.activeSubscriptions;
        for (const [pid, data] of Object.entries(m.byPriceId)) {
          if (!aggregated.byPriceId[pid]) {
            aggregated.byPriceId[pid] = { ...data };
          } else {
            aggregated.byPriceId[pid].mrr += data.mrr;
            aggregated.byPriceId[pid].activeCount += data.activeCount;
          }
        }
      } else {
        errors.push(String(result.reason));
      }
    }

    res.json({ ...aggregated, errors: errors.length ? errors : undefined });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: `Stripe fetch failed: ${msg}` });
  }
});

export default router;
