import { RefreshCw, Activity, DollarSign, Target, BarChart2, Cpu, TrendingUp, TrendingDown, Zap, Clock } from "lucide-react";
import { MetricCard } from "@/components/MetricCard";
import { DataSection } from "@/components/DataSection";
import { useFetch } from "@/lib/useFetch";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface TradingStatus {
  running: boolean;
  lastPollAt: string | null;
  alertsProcessed: number;
  openPositions: number;
}

interface TradingMetrics {
  totalTrades: number;
  openPositions: number;
  winRate: number;
  totalPnlDollars: number;
  winningTrades: number;
  losingTrades: number;
  totalSignalsAnalyzed: number;
  totalTaken: number;
  avgScore: number;
}

interface OptionsPosition {
  id: number;
  alertId: string | null;
  ticker: string;
  optionSymbol: string;
  direction: string;
  strike: number;
  expiry: string;
  contracts: number;
  entryPrice: string;
  stopPrice: string;
  t1Price: string;
  t2Price: string;
  currentPrice: string | null;
  status: string;
  pnlDollars: string | null;
  pnlPct: string | null;
  openedAt: string;
}

interface SignalDecision {
  id: number;
  alertId: string;
  decision: string;
  reasoning: string;
  score: number | null;
  rejectionReason: string | null;
  createdAt: string;
  ticker: string | null;
  direction: string | null;
  premium: number | null;
  dte: number | null;
  strike: number | null;
  expiry: string | null;
}

function fmtMoney(val: number): string {
  const prefix = val < 0 ? "-" : "";
  return `${prefix}$${Math.abs(val).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function timeAgo(ts: string): string {
  const diff = Date.now() - new Date(ts).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  return `${hrs}h ${mins % 60}m ago`;
}

export default function Tars() {
  const { data: status, refetch: refetchStatus } = useFetch<TradingStatus>(
    "/api/trading/status",
    { refreshInterval: 30_000 },
  );
  const { data: metrics } = useFetch<TradingMetrics>(
    "/api/trading/metrics",
    { refreshInterval: 30_000 },
  );
  const { data: positionsData, loading: posLoading, error: posError } = useFetch<{ positions: OptionsPosition[] }>(
    "/api/trading/positions",
    { refreshInterval: 30_000 },
  );
  const { data: signalsData } = useFetch<{ signals: SignalDecision[] }>(
    "/api/trading/signals",
    { refreshInterval: 30_000 },
  );

  const positions = positionsData?.positions ?? [];
  const signals = signalsData?.signals ?? [];

  function handleRefresh() {
    refetchStatus();
  }

  return (
    <div className="space-y-8 pb-10">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight mb-2">Kowalski Trading Engine</h1>
          <p className="text-muted-foreground">
            Autonomous options trading via Unusual Whales flow signals.
            {status && (
              <Badge variant={status.running ? "default" : "destructive"} className="ml-2">
                {status.running ? "Engine Running" : "Engine Stopped"}
              </Badge>
            )}
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={handleRefresh} className="gap-2">
          <RefreshCw className="h-4 w-4" />
          Refresh
        </Button>
      </div>

      <DataSection loading={posLoading} error={posError?.message}>
        {/* Metrics row */}
        {metrics && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <MetricCard
              title="Total P&L"
              value={fmtMoney(metrics.totalPnlDollars)}
              subtitle={`${metrics.totalTrades} closed trades`}
              icon={<DollarSign className="h-5 w-5" />}
              className={metrics.totalPnlDollars >= 0 ? "border-emerald-500/30" : "border-destructive/30"}
            />
            <MetricCard
              title="Win Rate"
              value={`${metrics.winRate.toFixed(1)}%`}
              subtitle={`${metrics.winningTrades}W / ${metrics.losingTrades}L`}
              icon={<Target className="h-5 w-5" />}
            />
            <MetricCard
              title="Open Positions"
              value={String(metrics.openPositions)}
              subtitle="Max 3 allowed"
              icon={<Activity className="h-5 w-5" />}
            />
            <MetricCard
              title="Signals Analyzed"
              value={String(metrics.totalSignalsAnalyzed)}
              subtitle={`${metrics.totalTaken} taken · avg score ${metrics.avgScore}`}
              icon={<Zap className="h-5 w-5" />}
            />
          </div>
        )}

        {/* Engine status bar */}
        {status && (
          <div className="rounded-xl border border-border bg-card p-4 flex flex-wrap items-center gap-6">
            <div className="flex items-center gap-2">
              <div className={cn("h-2 w-2 rounded-full", status.running ? "bg-emerald-500 shadow-[0_0_6px_theme(colors.emerald.500)]" : "bg-destructive")} />
              <Cpu className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">{status.running ? "Engine Active" : "Engine Stopped"}</span>
            </div>
            <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
              <Clock className="h-3.5 w-3.5" />
              Last poll: {status.lastPollAt ? timeAgo(status.lastPollAt) : "never"}
            </div>
            <div className="text-sm text-muted-foreground">
              Alerts processed: <span className="font-mono">{status.alertsProcessed}</span>
            </div>
          </div>
        )}

        {/* Open Positions */}
        <div className="rounded-xl border border-border bg-card">
          <div className="px-6 py-4 border-b border-border flex items-center gap-2">
            <Activity className="h-4 w-4 text-muted-foreground" />
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Open Positions</h2>
          </div>
          {positions.length === 0 ? (
            <div className="px-6 py-8 text-center text-muted-foreground text-sm">
              No open positions right now. Engine is scanning for opportunities.
            </div>
          ) : (
            <div className="divide-y divide-border">
              {positions.map((pos) => {
                const currentPrice = pos.currentPrice ? parseFloat(pos.currentPrice) : null;
                const entryPrice = parseFloat(pos.entryPrice);
                const pnl = currentPrice != null ? (currentPrice - entryPrice) * 100 * pos.contracts : null;
                const pnlPct = currentPrice != null && entryPrice > 0 ? ((currentPrice - entryPrice) / entryPrice) * 100 : null;
                const isWin = pnl != null && pnl >= 0;
                return (
                  <div key={pos.id} className="px-6 py-4 flex items-center justify-between hover:bg-secondary/30 transition-colors">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-10 h-10 rounded-lg bg-secondary flex items-center justify-center flex-shrink-0">
                        <span className="text-xs font-bold font-mono">{pos.ticker}</span>
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-semibold">{pos.ticker}</span>
                          <Badge
                            variant="outline"
                            className={cn(
                              "text-xs",
                              pos.direction.toLowerCase() === "put"
                                ? "border-red-500/40 text-red-400"
                                : "border-emerald-500/40 text-emerald-400",
                            )}
                          >
                            {pos.direction.toUpperCase()}
                          </Badge>
                          <span className="text-xs text-muted-foreground">${pos.strike} · {pos.expiry}</span>
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {pos.contracts} contracts · entry ${entryPrice.toFixed(2)} · stop ${parseFloat(pos.stopPrice).toFixed(2)}
                        </p>
                        <p className="text-xs text-muted-foreground font-mono">{pos.optionSymbol}</p>
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0 ml-4">
                      {currentPrice != null && (
                        <p className="text-sm font-semibold font-mono">${currentPrice.toFixed(2)}</p>
                      )}
                      {pnl != null && (
                        <p className={cn("text-xs font-medium flex items-center justify-end gap-0.5", isWin ? "text-emerald-500" : "text-destructive")}>
                          {isWin ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                          {isWin ? "+" : ""}{fmtMoney(pnl)} ({pnlPct != null ? `${pnlPct.toFixed(1)}%` : "?"})
                        </p>
                      )}
                      <p className="text-xs text-muted-foreground">T1: ${parseFloat(pos.t1Price).toFixed(2)} · T2: ${parseFloat(pos.t2Price).toFixed(2)}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Recent Signal Analyses */}
        {signals.length > 0 && (
          <div className="rounded-xl border border-border bg-card">
            <div className="px-6 py-4 border-b border-border flex items-center gap-2">
              <BarChart2 className="h-4 w-4 text-muted-foreground" />
              <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Recent Signal Analyses</h2>
            </div>
            <div className="divide-y divide-border">
              {signals.map((sig) => (
                <div key={sig.id} className="px-6 py-2.5 flex items-center justify-between hover:bg-secondary/30 transition-colors">
                  <div className="flex items-center gap-3">
                    <Badge
                      variant={sig.decision === "TAKE" ? "default" : "secondary"}
                      className={cn("text-xs", sig.decision === "TAKE" ? "bg-emerald-600" : "")}
                    >
                      {sig.decision}
                    </Badge>
                    <span className="text-sm font-mono">{sig.ticker ?? sig.alertId}</span>
                    {sig.direction && (
                      <Badge variant="outline" className={cn(
                        "text-xs",
                        sig.direction.toLowerCase() === "put" ? "border-red-500/40 text-red-400" : "border-emerald-500/40 text-emerald-400"
                      )}>
                        {sig.direction.toUpperCase()}
                      </Badge>
                    )}
                    {sig.reasoning && (
                      <span className="text-xs text-muted-foreground truncate max-w-[300px]">{sig.reasoning}</span>
                    )}
                  </div>
                  <div className="flex items-center gap-3 flex-shrink-0">
                    {sig.score != null && (
                      <span className={cn(
                        "text-sm font-mono font-semibold",
                        sig.score >= 85 ? "text-emerald-500" : sig.score >= 70 ? "text-yellow-500" : "text-muted-foreground"
                      )}>
                        {sig.score}
                      </span>
                    )}
                    <span className="text-xs text-muted-foreground">{timeAgo(sig.createdAt)}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <Badge variant="outline" className="text-xs">Auto-refreshes every 30s</Badge>
      </DataSection>
    </div>
  );
}
