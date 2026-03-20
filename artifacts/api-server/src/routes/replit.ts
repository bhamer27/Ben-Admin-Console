import { Router, type IRouter, type Request, type Response } from "express";
import { db, replitFollowerSnapshotsTable } from "@workspace/db";
import { desc, gte } from "drizzle-orm";

const router: IRouter = Router();

const REPLIT_GRAPHQL_URL = "https://replit.com/graphql";

async function replitQuery(apiKey: string, query: string, variables?: Record<string, unknown>) {
  const res = await fetch(REPLIT_GRAPHQL_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`,
      "X-Requested-With": "XMLHttpRequest",
    },
    body: JSON.stringify({ query, variables }),
    signal: AbortSignal.timeout(15_000),
  });

  if (!res.ok) {
    throw new Error(`Replit API returned ${res.status}`);
  }

  const json = await res.json() as { data?: unknown; errors?: { message: string }[] };

  if (json.errors?.length) {
    throw new Error(json.errors.map((e) => e.message).join("; "));
  }

  return json.data;
}

router.get("/replit/metrics", async (_req: Request, res: Response) => {
  const apiKey = process.env.REPLIT_API_KEY;

  if (!apiKey) {
    res.status(503).json({
      error: "REPLIT_API_KEY is not configured.",
      configured: false,
    });
    return;
  }

  try {
    // Query current user's repls, profile, follower counts and per-repl usage stats
    const data = await replitQuery(apiKey, `
      query GetMyRepls {
        currentUser {
          id
          username
          bio
          followerCount
          followingCount
          isVerified
          repls(count: 100) {
            items {
              id
              title
              slug
              isPrivate
              publicForkCount
              runCount
              likeCount
              commentCount
              deployment {
                id
                domain
                slug
              }
            }
          }
        }
      }
    `) as {
      currentUser?: {
        id: string;
        username: string;
        bio?: string;
        followerCount?: number;
        followingCount?: number;
        isVerified?: boolean;
        repls?: {
          items: {
            id: string;
            title: string;
            slug: string;
            isPrivate: boolean;
            publicForkCount?: number;
            runCount?: number;
            likeCount?: number;
            commentCount?: number;
            deployment?: { id: string; domain: string; slug: string } | null;
          }[];
        };
      };
    };

    const user = data?.currentUser;
    if (!user) {
      res.status(500).json({ error: "Could not fetch Replit user data." });
      return;
    }

    const repls = user.repls?.items ?? [];
    const deployed = repls.filter((r) => r.deployment != null);

    // Usage signals across all repls
    const totalRuns = repls.reduce((s, r) => s + (r.runCount ?? 0), 0);
    const totalForks = repls.reduce((s, r) => s + (r.publicForkCount ?? 0), 0);
    const totalLikes = repls.reduce((s, r) => s + (r.likeCount ?? 0), 0);
    const currentFollowers = user.followerCount ?? 0;

    // Compute new-follower growth using DB snapshots.
    // Replit's public API does not expose app-level user signups directly.
    // New followers (gained since 30 days ago) is the best available growth proxy.
    await db.insert(replitFollowerSnapshotsTable).values({ followerCount: currentFollowers });

    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const oldSnapshots = await db
      .select()
      .from(replitFollowerSnapshotsTable)
      .where(gte(replitFollowerSnapshotsTable.capturedAt, thirtyDaysAgo))
      .orderBy(replitFollowerSnapshotsTable.capturedAt)
      .limit(1);

    // Earliest snapshot in the 30-day window as baseline
    const earliestIn30d = oldSnapshots[0]?.followerCount ?? currentFollowers;
    const newFollowers30d = Math.max(0, currentFollowers - earliestIn30d);

    // Also get the snapshot from exactly ~30 days ago (the one before the window)
    const [beforeWindow] = await db
      .select()
      .from(replitFollowerSnapshotsTable)
      .orderBy(desc(replitFollowerSnapshotsTable.capturedAt))
      .limit(1)
      .offset(1);

    const baselineFollowers = beforeWindow?.followerCount ?? earliestIn30d;
    const signupsProxy = Math.max(0, currentFollowers - baselineFollowers);

    res.json({
      username: user.username,
      isVerified: user.isVerified ?? false,
      followerCount: currentFollowers,
      followingCount: user.followingCount ?? 0,
      totalRepls: repls.length,
      deployedCount: deployed.length,
      // Growth/engagement metrics
      totalRuns,
      totalForks,
      totalLikes,
      // New followers gained in the last 30 days — best available proxy for user growth/signups
      // since Replit does not expose app-level signup data via its public API
      newFollowers30d,
      signupsProxy,
      repls: repls.map((r) => ({
        id: r.id,
        title: r.title,
        slug: r.slug,
        isPrivate: r.isPrivate,
        hasDeployment: r.deployment != null,
        deploymentDomain: r.deployment?.domain ?? null,
        runCount: r.runCount ?? 0,
        forkCount: r.publicForkCount ?? 0,
        likeCount: r.likeCount ?? 0,
        // Per-project usage: runCount is the primary usage metric; it represents
        // how many times users have interacted with each project
      })),
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(502).json({ error: `Replit API error: ${msg}` });
  }
});

export default router;
