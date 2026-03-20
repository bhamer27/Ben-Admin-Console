import { TerminalSquare, RefreshCw, Globe, Activity, Server, Lock, Users, Play, GitFork, Heart } from "lucide-react";
import { MetricCard } from "@/components/MetricCard";
import { DataSection } from "@/components/DataSection";
import { useFetch } from "@/lib/useFetch";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface ReplitMetrics {
  username: string;
  isVerified: boolean;
  followerCount: number;
  followingCount: number;
  totalRepls: number;
  deployedCount: number;
  totalRuns: number;
  totalForks: number;
  totalLikes: number;
  /** New followers gained in the last 30 days — growth/signup proxy (Replit API does not expose app signups) */
  newFollowers30d: number;
  repls: {
    id: string;
    title: string;
    slug: string;
    isPrivate: boolean;
    hasDeployment: boolean;
    deploymentDomain: string | null;
    runCount: number;
    forkCount: number;
    likeCount: number;
  }[];
}

export default function Replit() {
  const { data, error, loading, configured, refetch } = useFetch<ReplitMetrics>(
    "/api/replit/metrics",
    { refreshInterval: 5 * 60_000 },
  );

  return (
    <div className="space-y-8 pb-10">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight mb-2">Replit Projects</h1>
          <p className="text-muted-foreground">
            {data ? `Projects for @${data.username}` : "Deployment and usage stats across your Replit account."}
          </p>
        </div>
        {!loading && (
          <Button variant="outline" size="sm" onClick={refetch}>
            <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
            Refresh
          </Button>
        )}
      </div>

      <DataSection
        loading={loading}
        error={error}
        configured={configured}
        onRefresh={refetch}
        configNote="Set REPLIT_API_KEY to a Replit API token to enable this integration. Generate one at replit.com/account."
      >
        {data && (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
              <MetricCard
                title="New Followers (30d)"
                value={`+${data.newFollowers30d.toLocaleString()}`}
                subtitle="Growth proxy for signups"
                icon={<Users className="h-5 w-5" />}
              />
              <MetricCard
                title="Total Followers"
                value={data.followerCount.toLocaleString()}
                subtitle="Replit followers"
                icon={<Users className="h-5 w-5" />}
              />
              <MetricCard
                title="Total Repls"
                value={String(data.totalRepls)}
                subtitle={`${data.deployedCount} deployed`}
                icon={<TerminalSquare className="h-5 w-5" />}
              />
              <MetricCard
                title="Total Runs"
                value={data.totalRuns.toLocaleString()}
                subtitle="All-time executions"
                icon={<Play className="h-5 w-5" />}
              />
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
              <MetricCard
                title="Total Forks"
                value={data.totalForks.toLocaleString()}
                subtitle="Community forks"
                icon={<GitFork className="h-5 w-5" />}
              />
              <MetricCard
                title="Total Likes"
                value={data.totalLikes.toLocaleString()}
                subtitle="Community likes"
                icon={<Heart className="h-5 w-5" />}
              />
              <MetricCard
                title="Deployed Projects"
                value={String(data.deployedCount)}
                subtitle="Active deployments"
                icon={<Globe className="h-5 w-5" />}
              />
            </div>

            <div className="rounded-xl border border-border bg-card">
              <div className="p-6 border-b border-border">
                <div className="flex items-center gap-2">
                  <Server className="h-4 w-4 text-muted-foreground" />
                  <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">All Projects</h2>
                </div>
              </div>
              <div className="divide-y divide-border">
                {data.repls.map((repl) => (
                  <div key={repl.id} className="px-6 py-3 flex items-center justify-between hover:bg-secondary/30 transition-colors">
                    <div className="flex items-center gap-3 min-w-0">
                      {repl.isPrivate ? (
                        <Lock className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                      ) : (
                        <Globe className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                      )}
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">{repl.title}</p>
                        {repl.deploymentDomain && (
                          <p className="text-xs text-muted-foreground font-mono truncate">{repl.deploymentDomain}</p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-4 flex-shrink-0 ml-4">
                      {repl.runCount > 0 && (
                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                          <Play className="h-3 w-3" />{repl.runCount.toLocaleString()}
                        </span>
                      )}
                      {repl.forkCount > 0 && (
                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                          <GitFork className="h-3 w-3" />{repl.forkCount}
                        </span>
                      )}
                      {repl.hasDeployment && (
                        <Badge variant="outline" className="text-xs border-emerald-500/30 text-emerald-500">deployed</Badge>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Badge variant="outline" className="text-xs">Auto-refreshes every 5 min</Badge>
            </div>
          </>
        )}
      </DataSection>
    </div>
  );
}
