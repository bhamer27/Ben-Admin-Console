import { useEffect } from "react";
import { RefreshCw, Activity, DollarSign, Target, BarChart2, Cpu, TrendingUp, TrendingDown, Zap, Clock } from "lucide-react";
import { useTabData } from "@/lib/tabDataContext";
import { MetricCard } from "@/components/MetricCard";
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

interface TradierPosition {
  symbol: string;
  quantity: number;
  cost_basis: number;
  date_acquired: string;
}

interface TradierAccount {
  equity: number | null;
  buyingPower: number | null;
  accountType: string;
  accountId: string;
  positions: TradierPosition[];
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
  const { data: positionsData } = useFetch<{ positions: OptionsPosition[] }>(
    "/api/trading/positions",
    { refreshInterval: 30_000 },
  );
  const { data: signalsData } = useFetch<{ signals: SignalDecision[] }>(
    "/api/trading/signals",
    { refreshInterval: 30_000 },
  );
  const { data: tradierAccount, error: tradierError } = useFetch<TradierAccount>(
    "/api/trading/tradier-account",
    { refreshInterval: 60_000 },
  );

  const { setTabData } = useTabData();
  useEffect(() => {
    if (status || metrics) setTabData({ status, metrics, positions: positionsData?.positions ?? [], recentSignals: signalsData?.signals?.slice(0,10) ?? [] });
  }, [status, metrics, positionsData, signalsData, setTabData]);

  const positions = positionsData?.positions ?? [];
  const signals = signalsData?.signals ?? [];

  return (
    <div className="space-y-6 pb-10">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight mb-1.5">Tars</h1>
          <p className="text-muted-foreground text-sm sm:text-base">Autonomous options trading via Unusual Whales signals.</p>
          {status && (
            <Badge variant={status.running ? "default" : "destructive"} className="mt-2">
              {status.running ? "Engine Running" : "Engine Stopped"}
            </Badge>
          )}
        </div>
        <Button variant="outline" size="sm" onClick={refetchStatus} className="flex-shrink-0 gap-2">
          <RefreshCw className="h-4 w-4" />
          <span className="hidden sm:inline">Refresh</span>
        </Button>
      </div>
      <div className="space-y-4">
        {/* Metrics row */}
        {metrics && (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
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
              title="Open"
              value={String(metrics.openPositions)}
              subtitle="Max 3 allowed"
              icon={<Activity className="h-5 w-5" />}
            />
            <MetricCard
              title="Signals"
              value={String(metrics.totalSignalsAnalyzed)}
              subtitle={`${metrics.totalTaken} taken · avg ${metrics.avgScore}`}
              icon={<Zap className="h-5 w-5" />}
            />
          </div>
        )}

        {/* Engine status bar */}
        {status && (
          <div className="rounded-xl border border-border bg-card p-4 flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2">
              <div className={cn("h-2 w-2 rounded-full", status.running ? "bg-emerald-500 shadow-[0_0_6px_theme(colors.emerald.500)]" : "bg-destructive")} />
              <Cpu className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">{status.running ? "Active" : "Stopped"}</span>
            </div>
            <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
              <Clock className="h-3.5 w-3.5" />
              <span>Last poll: {status.lastPollAt ? timeAgo(status.lastPollAt) : "never"}</span>
            </div>
            <div className="text-sm text-muted-foreground">
              Alerts: <span className="font-mono">{status.alertsProcessed}</span>
            </div>
          </div>
        )}

        {/* Tradier Sandbox Account */}
        <div className="rounded-xl border border-border bg-card">
          <div className="px-4 sm:px-6 py-4 border-b border-border flex items-center gap-2">
            <BarChart2 className="h-4 w-4 text-muted-foreground" />
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Tradier Sandbox Account</h2>
            <span className="ml-auto text-xs text-muted-foreground font-mono">{tradierAccount?.accountId ?? "VA1575604"}</span>
          </div>
          {tradierError ? (
            <div className="px-6 py-5 text-sm text-destructive">{tradierError}</div>
          ) : !tradierAccount ? (
            <div className="px-6 py-5 text-sm text-muted-foreground animate-pulse">Loading account…</div>
          ) : (
            <div className="px-4 sm:px-6 py-4 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-lg bg-secondary/40 px-4 py-3">
                  <p className="text-xs text-muted-foreground mb-1">Equity</p>
                  <p className="text-lg font-semibold font-mono">
                    {tradierAccount.equity != null ? fmtMoney(tradierAccount.equity) : "—"}
                  </p>
                </div>
                <div className="rounded-lg bg-secondary/40 px-4 py-3">
                  <p className="text-xs text-muted-foreground mb-1">Buying Power</p>
                  <p className="text-lg font-semibold font-mono">
                    {tradierAccount.buyingPower != null ? fmtMoney(tradierAccount.buyingPower) : "—"}
                  </p>
                </div>
              </div>
              {tradierAccount.positions.length > 0 ? (
                <div className="divide-y divide-border rounded-lg border border-border overflow-hidden">
                  {tradierAccount.positions.map((pos) => (
                    <div key={pos.symbol} className="px-4 py-2.5 flex items-center justify-between gap-3 text-sm hover:bg-secondary/30 transition-colors">
                      <span className="font-mono font-medium text-xs">{pos.symbol}</span>
                      <span className="text-muted-foreground">{pos.quantity} × ${(pos.cost_basis / Math.max(pos.quantity, 1)).toFixed(2)}</span>
                      <span className="font-mono text-right">{fmtMoney(pos.cost_basis)}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">No open positions in sandbox account.</p>
              )}
            </div>
          )}
        </div>

        {/* Open Positions */}
        <div className="rounded-xl border border-border bg-card">
          <div className="px-4 sm:px-6 py-4 border-b border-border flex items-center gap-2">
            <Activity className="h-4 w-4 text-muted-foreground" />
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Open Positions</h2>
          </div>
          {positions.length === 0 ? (
            <div className="px-6 py-8 text-center text-muted-foreground text-sm">
              No open positions. Engine is scanning for opportunities.
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
                  <div key={pos.id} className="px-4 sm:px-6 py-4 flex items-start sm:items-center justify-between gap-3 hover:bg-secondary/30 transition-colors">
                    <div className="flex items-start gap-3 min-w-0 flex-1">
                      <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-lg bg-secondary flex items-center justify-center flex-shrink-0 mt-0.5 sm:mt-0">
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
                          {pos.contracts}x · entry ${entryPrice.toFixed(2)} · stop ${parseFloat(pos.stopPrice).toFixed(2)}
                        </p>
                        <p className="text-xs text-muted-foreground font-mono truncate">{pos.optionSymbol}</p>
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0">
                      {currentPrice != null && (
                        <p className="text-sm font-semibold font-mono">${currentPrice.toFixed(2)}</p>
                      )}
                      {pnl != null && (
                        <p className={cn("text-xs font-medium flex items-center justify-end gap-0.5", isWin ? "text-emerald-500" : "text-destructive")}>
                          {isWin ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                          {isWin ? "+" : ""}{fmtMoney(pnl)}
                        </p>
                      )}
                      {pnlPct != null && (
                        <p className={cn("text-xs", isWin ? "text-emerald-500/70" : "text-destructive/70")}>
                          {pnlPct >= 0 ? "+" : ""}{pnlPct.toFixed(1)}%
                        </p>
                      )}
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
            <div className="px-4 sm:px-6 py-4 border-b border-border flex items-center gap-2">
              <BarChart2 className="h-4 w-4 text-muted-foreground" />
              <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Recent Signals</h2>
            </div>
            <div className="divide-y divide-border">
              {signals.map((sig) => (
                <div key={sig.id} className="px-4 sm:px-6 py-3 hover:bg-secondary/30 transition-colors">
                  {/* Top row: decision + ticker + direction + score + time */}
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 flex-wrap min-w-0">
                      <Badge
                        variant={sig.decision === "TAKE" ? "default" : "secondary"}
                        className={cn("text-xs flex-shrink-0", sig.decision === "TAKE" ? "bg-emerald-600" : "")}
                      >
                        {sig.decision}
                      </Badge>
                      <span className="text-sm font-mono font-medium">{sig.ticker ?? sig.alertId}</span>
                      {sig.direction && (
                        <Badge variant="outline" className={cn(
                          "text-xs flex-shrink-0",
                          sig.direction.toLowerCase() === "put" ? "border-red-500/40 text-red-400" : "border-emerald-500/40 text-emerald-400"
                        )}>
                          {sig.direction.toUpperCase()}
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {sig.score != null && (
                        <span className={cn(
                          "text-sm font-mono font-semibold",
                          sig.score >= 85 ? "text-emerald-500" : sig.score >= 70 ? "text-yellow-500" : "text-muted-foreground"
                        )}>
                          {sig.score}
                        </span>
                      )}
                      <span className="text-xs text-muted-foreground whitespace-nowrap">{timeAgo(sig.createdAt)}</span>
                    </div>
                  </div>
                  {/* Reasoning on its own line */}
                  {sig.reasoning && (
                    <p className="text-xs text-muted-foreground mt-1 line-clamp-2 sm:line-clamp-1">{sig.reasoning}</p>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        <Badge variant="outline" className="text-xs">Auto-refreshes every 30s</Badge>
      </div>
    </div>
  );
}
