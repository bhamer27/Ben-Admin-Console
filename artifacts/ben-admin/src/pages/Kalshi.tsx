import { TrendingUp, RefreshCw, Target, DollarSign, Activity, BarChart2 } from "lucide-react";
import { MetricCard } from "@/components/MetricCard";
import { DataSection } from "@/components/DataSection";
import { useFetch } from "@/lib/useFetch";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface KalshiStats {
  hit_rate?: number;
  hitRate?: number;
  open_positions?: number;
  openPositions?: number;
  balance?: number;
  pnl?: number;
  pnl_30d?: number;
  total_trades?: number;
  totalTrades?: number;
  wins?: number;
  losses?: number;
  [key: string]: unknown;
}

function fmt(val: number | undefined, prefix = ""): string {
  if (val == null) return "—";
  return `${prefix}${val.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
}

function fmtPct(val: number | undefined): string {
  if (val == null) return "—";
  return `${(val * 100).toFixed(1)}%`;
}

function fmtMoney(val: number | undefined): string {
  if (val == null) return "—";
  return `$${Math.abs(val).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export default function Kalshi() {
  const { data, error, loading, configured, refetch } = useFetch<KalshiStats>(
    "/api/kalshi/stats",
    { refreshInterval: 60_000 },
  );

  const hitRate = data?.hit_rate ?? data?.hitRate;
  const openPositions = data?.open_positions ?? data?.openPositions;
  const balance = data?.balance;
  const pnl = data?.pnl ?? data?.pnl_30d;
  const totalTrades = data?.total_trades ?? data?.totalTrades;
  const wins = data?.wins;
  const losses = data?.losses;

  return (
    <div className="space-y-8 pb-10">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight mb-2">Kalshi Bot</h1>
          <p className="text-muted-foreground">Live trading bot metrics from your droplet.</p>
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
        configNote="Set KALSHI_STATS_URL to your droplet endpoint (e.g. http://159.65.255.7/api/kalshi/stats) to enable this integration."
      >
        {data && (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <MetricCard
                title="Hit Rate"
                value={typeof hitRate === "number" ? fmtPct(hitRate) : "—"}
                subtitle="Win percentage"
                icon={<Target className="h-5 w-5" />}
                trend={typeof hitRate === "number" ? { value: fmtPct(hitRate), isPositive: hitRate >= 0.5 } : undefined}
              />
              <MetricCard
                title="Open Positions"
                value={typeof openPositions === "number" ? String(openPositions) : "—"}
                subtitle="Currently active"
                icon={<Activity className="h-5 w-5" />}
              />
              <MetricCard
                title="Balance"
                value={typeof balance === "number" ? fmtMoney(balance) : "—"}
                subtitle="Account balance"
                icon={<DollarSign className="h-5 w-5" />}
              />
              <MetricCard
                title="P&L"
                value={typeof pnl === "number" ? fmtMoney(pnl) : "—"}
                subtitle="Profit / Loss"
                icon={<TrendingUp className="h-5 w-5" />}
                trend={typeof pnl === "number" ? { value: fmtMoney(Math.abs(pnl)), isPositive: pnl >= 0 } : undefined}
              />
            </div>

            {(totalTrades != null || wins != null || losses != null) && (
              <div className="rounded-xl border border-border bg-card p-6">
                <div className="flex items-center gap-2 mb-4">
                  <BarChart2 className="h-4 w-4 text-muted-foreground" />
                  <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Trade Summary</h2>
                </div>
                <div className="flex flex-wrap gap-4">
                  {totalTrades != null && (
                    <div>
                      <p className="text-xs text-muted-foreground">Total Trades</p>
                      <p className="text-2xl font-semibold font-mono">{totalTrades}</p>
                    </div>
                  )}
                  {wins != null && (
                    <div>
                      <p className="text-xs text-muted-foreground">Wins</p>
                      <p className="text-2xl font-semibold font-mono text-emerald-500">{wins}</p>
                    </div>
                  )}
                  {losses != null && (
                    <div>
                      <p className="text-xs text-muted-foreground">Losses</p>
                      <p className="text-2xl font-semibold font-mono text-destructive">{losses}</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Raw data — show any extra fields from the JSON */}
            {Object.keys(data).filter(k => !["hit_rate","hitRate","open_positions","openPositions","balance","pnl","pnl_30d","total_trades","totalTrades","wins","losses"].includes(k)).length > 0 && (
              <div className="rounded-xl border border-border bg-card p-6">
                <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-4">Additional Metrics</h2>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                  {Object.entries(data)
                    .filter(([k]) => !["hit_rate","hitRate","open_positions","openPositions","balance","pnl","pnl_30d","total_trades","totalTrades","wins","losses"].includes(k))
                    .map(([k, v]) => (
                      <div key={k}>
                        <p className="text-xs text-muted-foreground capitalize">{k.replace(/_/g, " ")}</p>
                        <p className="text-sm font-mono font-medium">{fmt(typeof v === "number" ? v : undefined) === "—" ? String(v) : fmt(typeof v === "number" ? v : undefined)}</p>
                      </div>
                    ))}
                </div>
              </div>
            )}

            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Badge variant="outline" className="text-xs">Auto-refreshes every 60s</Badge>
            </div>
          </>
        )}
      </DataSection>
    </div>
  );
}
