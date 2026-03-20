import { Router, type IRouter, type Request, type Response } from "express";

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
    // Query current user's repls, profile, and follower counts
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

    // Usage signals: total runs and forks across all repls serve as engagement/usage metrics.
    // Note: Replit does not expose subscriber/signup data via the public API.
    const totalRuns = repls.reduce((s, r) => s + (r.runCount ?? 0), 0);
    const totalForks = repls.reduce((s, r) => s + (r.publicForkCount ?? 0), 0);
    const totalLikes = repls.reduce((s, r) => s + (r.likeCount ?? 0), 0);

    res.json({
      username: user.username,
      isVerified: user.isVerified ?? false,
      followerCount: user.followerCount ?? 0,
      followingCount: user.followingCount ?? 0,
      totalRepls: repls.length,
      deployedCount: deployed.length,
      // Usage / engagement metrics
      totalRuns,
      totalForks,
      totalLikes,
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
      })),
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(502).json({ error: `Replit API error: ${msg}` });
  }
});

export default router;
