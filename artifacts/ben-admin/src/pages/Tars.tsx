import { RefreshCw, Activity, DollarSign, Target, BarChart2, Cpu, TrendingUp, TrendingDown, Zap, Clock, Layers } from "lucide-react";
import { MetricCard } from "@/components/MetricCard";
import { DataSection } from "@/components/DataSection";
import { useFetch } from "@/lib/useFetch";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface OptionDetails {
  underlying: string;
  expiry: string;
  type: "Call" | "Put";
  strike: number;
}

interface TradierPosition {
  symbol: string;
  quantity: number;
  currentPrice: number;
  value: number;
  costBasis: number;
  gainLoss: number;
  gainLossPct: number;
  dayChangePct: number;
  isOption: boolean;
  optionDetails: OptionDetails | null;
  dateAcquired?: string;
}

interface TarsSnapshot {
  account: {
    totalEquity: number;
    cash: number;
    buyingPower: number;
    openPositionCount: number;
    isPaper: boolean;
  };
  metrics: {
    totalPnlDollars: number;
    totalPnlPct: number;
    winRate: number;
    totalTrades: number;
    winningTrades: number;
    losingTrades: number;
    openPositionsCount: number;
    avgScore: number;
    maxDrawdownDollars: number;
    maxDrawdownPct: number;
    analysesToday: number;
    takenToday: number;
  };
  engine: {
    running: boolean;
    lastPollAt: string;
    alertsProcessed: number;
    uptime: number;
  };
  positions: {
    id?: number;
    symbol: string;
    quantity: number;
    avgCost: number;
    currentPrice?: number;
    score?: number;
    entryDate?: string;
    pnl?: number;
    pnlPct?: number;
  }[];
  recentAnalyses: {
    id?: number;
    ticker?: string;
    score?: number;
    action?: string;
    reason?: string;
    timestamp?: string;
  }[];
  tradierHoldings?: {
    positions: TradierPosition[];
    totalValue: number;
    totalCostBasis: number;
    totalGainLoss: number;
  } | null;
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
  const { data, error, loading, configured, refetch } = useFetch<TarsSnapshot>(
    "/api/tars/snapshot",
    { refreshInterval: 30_000 },
  );

  const acct = data?.account;
  const met = data?.metrics;
  const eng = data?.engine;

  return (
    <div className="space-y-8 pb-10">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight mb-2">Tradier Portfolio</h1>
          <p className="text-muted-foreground">
            Live options trading via Unusual Whales flow scoring.
            {eng && (
              <Badge variant={eng.running ? "default" : "destructive"} className="ml-2">
                {eng.running ? "Engine Running" : "Engine Stopped"}
              </Badge>
            )}
            {acct?.isPaper === false && <Badge variant="outline" className="ml-2">LIVE</Badge>}
            {acct?.isPaper === true && <Badge variant="secondary" className="ml-2">PAPER</Badge>}
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
        configNote="Set TARS_PASSWORD in Replit Secrets to connect to the Tars dashboard."
      >
        {data && acct && met && eng && (
          <>
            {/* Top metrics */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <MetricCard
                title="Account Equity"
                value={fmtMoney(acct.totalEquity)}
                subtitle={`Cash: ${fmtMoney(acct.cash)}`}
                icon={<DollarSign className="h-5 w-5" />}
              />
              <MetricCard
                title="Total P&L"
                value={fmtMoney(met.totalPnlDollars)}
                subtitle={`${met.totalPnlPct >= 0 ? "+" : ""}${met.totalPnlPct.toFixed(2)}%`}
                icon={<TrendingUp className="h-5 w-5" />}
                trend={{ value: fmtMoney(Math.abs(met.totalPnlDollars)), isPositive: met.totalPnlDollars >= 0 }}
              />
              <MetricCard
                title="Win Rate"
                value={met.totalTrades > 0 ? `${(met.winRate * 100).toFixed(0)}%` : "N/A"}
                subtitle={`${met.winningTrades}W / ${met.losingTrades}L (${met.totalTrades} total)`}
                icon={<Target className="h-5 w-5" />}
              />
              <MetricCard
                title="Today's Activity"
                value={`${met.analysesToday} scanned`}
                subtitle={`${met.takenToday} trades taken`}
                icon={<Zap className="h-5 w-5" />}
              />
            </div>

            {/* Engine status bar */}
            <div className="rounded-xl border border-border bg-card p-4 flex flex-wrap items-center gap-6">
              <div className="flex items-center gap-2">
                <div className={cn("h-2 w-2 rounded-full", eng.running ? "bg-emerald-500 shadow-[0_0_6px_theme(colors.emerald.500)]" : "bg-destructive")} />
                <Cpu className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">{eng.running ? "Engine Active" : "Engine Stopped"}</span>
              </div>
              <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                <Clock className="h-3.5 w-3.5" />
                Last poll: {eng.lastPollAt ? timeAgo(eng.lastPollAt) : "never"}
              </div>
              <div className="text-sm text-muted-foreground">
                Alerts processed: <span className="font-mono">{eng.alertsProcessed}</span>
              </div>
              <div className="text-sm text-muted-foreground">
                Avg score: <span className="font-mono">{met.avgScore.toFixed(1)}</span>
              </div>
              <div className="text-sm text-muted-foreground">
                Max drawdown: <span className="font-mono text-destructive">{fmtMoney(met.maxDrawdownDollars)} ({met.maxDrawdownPct.toFixed(2)}%)</span>
              </div>
            </div>

            {/* Live Holdings from Tradier — source of truth for actual account positions */}
            {data.tradierHoldings && (
              <div className="rounded-xl border border-border bg-card">
                <div className="px-6 py-4 border-b border-border flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Layers className="h-4 w-4 text-muted-foreground" />
                    <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Live Holdings (Tradier)</h2>
                    <Badge variant="outline" className="text-xs border-emerald-500/30 text-emerald-400">live account</Badge>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-muted-foreground">Total Value</p>
                    <p className="text-base font-semibold font-mono">{fmtMoney(data.tradierHoldings.totalValue)}</p>
                    <p className={cn("text-xs font-medium", data.tradierHoldings.totalGainLoss >= 0 ? "text-emerald-500" : "text-destructive")}>
                      {data.tradierHoldings.totalGainLoss >= 0 ? "+" : ""}{fmtMoney(data.tradierHoldings.totalGainLoss)}
                      {data.tradierHoldings.totalCostBasis > 0 && (
                        <span className="ml-1 text-muted-foreground font-normal">
                          ({((data.tradierHoldings.totalGainLoss / data.tradierHoldings.totalCostBasis) * 100).toFixed(2)}%)
                        </span>
                      )}
                    </p>
                  </div>
                </div>
                {data.tradierHoldings.positions.length === 0 ? (
                  <div className="px-6 py-8 text-center text-muted-foreground text-sm">
                    No positions in Tradier account.
                  </div>
                ) : (
                  <div className="divide-y divide-border">
                    {data.tradierHoldings.positions.map((pos) => {
                      const isWin = pos.gainLoss >= 0;
                      const od = pos.optionDetails;
                      return (
                        <div key={pos.symbol} className="px-6 py-4 flex items-center justify-between hover:bg-secondary/30 transition-colors">
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="w-10 h-10 rounded-lg bg-secondary flex items-center justify-center flex-shrink-0">
                              <span className="text-xs font-bold font-mono">{od ? od.underlying : pos.symbol.slice(0, 4)}</span>
                            </div>
                            <div className="min-w-0">
                              {od ? (
                                <>
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <span className="text-sm font-semibold">{od.underlying}</span>
                                    <Badge
                                      variant="outline"
                                      className={cn(
                                        "text-xs",
                                        od.type === "Put"
                                          ? "border-red-500/40 text-red-400"
                                          : "border-emerald-500/40 text-emerald-400",
                                      )}
                                    >
                                      {od.type}
                                    </Badge>
                                    <span className="text-xs text-muted-foreground">${od.strike} · {od.expiry}</span>
                                  </div>
                                  <p className="text-xs text-muted-foreground mt-0.5">
                                    {pos.quantity} {pos.quantity === 1 ? "contract" : "contracts"} · ${pos.currentPrice.toFixed(2)}/share · ${(pos.currentPrice * 100).toFixed(0)}/contract
                                  </p>
                                </>
                              ) : (
                                <>
                                  <p className="text-sm font-semibold font-mono">{pos.symbol}</p>
                                  <p className="text-xs text-muted-foreground">{pos.quantity} shares @ ${pos.currentPrice.toFixed(2)}</p>
                                </>
                              )}
                            </div>
                          </div>
                          <div className="text-right flex-shrink-0 ml-4">
                            <p className="text-sm font-semibold font-mono">{fmtMoney(pos.value)}</p>
                            <p className={cn("text-xs font-medium flex items-center justify-end gap-0.5", isWin ? "text-emerald-500" : "text-destructive")}>
                              {isWin ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                              {isWin ? "+" : ""}{fmtMoney(pos.gainLoss)} ({pos.gainLossPct >= 0 ? "+" : ""}{pos.gainLossPct.toFixed(2)}%)
                            </p>
                            {pos.dayChangePct !== 0 && (
                              <p className={cn("text-xs", pos.dayChangePct >= 0 ? "text-emerald-400/70" : "text-destructive/70")}>
                                Day: {pos.dayChangePct >= 0 ? "+" : ""}{pos.dayChangePct.toFixed(2)}%
                              </p>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* TARS internal positions (bot's own tracker) */}
            {data.positions.length > 0 && (
              <div className="rounded-xl border border-border bg-card">
                <div className="px-6 py-4 border-b border-border flex items-center gap-2">
                  <Activity className="h-4 w-4 text-muted-foreground" />
                  <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Tracked Positions (TARS)</h2>
                </div>
                <div className="divide-y divide-border">
                  {data.positions.map((pos, i) => (
                    <div key={pos.id ?? i} className="px-6 py-3 flex items-center justify-between hover:bg-secondary/30 transition-colors">
                      <div>
                        <p className="text-sm font-semibold font-mono">{pos.symbol}</p>
                        <p className="text-xs text-muted-foreground">
                          {pos.quantity} contracts @ ${pos.avgCost?.toFixed(2)}
                          {pos.score != null && <span className="ml-2">Score: {pos.score}</span>}
                        </p>
                      </div>
                      <div className="text-right">
                        {pos.currentPrice != null && (
                          <p className="text-sm font-mono">${pos.currentPrice.toFixed(2)}</p>
                        )}
                        {pos.pnl != null && (
                          <p className={cn("text-xs font-medium", pos.pnl >= 0 ? "text-emerald-500" : "text-destructive")}>
                            {pos.pnl >= 0 ? <TrendingUp className="inline h-3 w-3 mr-0.5" /> : <TrendingDown className="inline h-3 w-3 mr-0.5" />}
                            {fmtMoney(Math.abs(pos.pnl))}
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {!data.tradierHoldings && data.positions.length === 0 && (
              <div className="rounded-xl border border-dashed border-border bg-card/30 p-8 text-center text-muted-foreground">
                No open positions right now. Engine is scanning for opportunities.
              </div>
            )}

            {/* Recent flow analyses */}
            {data.recentAnalyses.length > 0 && (
              <div className="rounded-xl border border-border bg-card">
                <div className="px-6 py-4 border-b border-border flex items-center gap-2">
                  <BarChart2 className="h-4 w-4 text-muted-foreground" />
                  <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Recent Analyses</h2>
                </div>
                <div className="divide-y divide-border">
                  {data.recentAnalyses.map((a, i) => (
                    <div key={a.id ?? i} className="px-6 py-2.5 flex items-center justify-between hover:bg-secondary/30 transition-colors">
                      <div className="flex items-center gap-3">
                        <Badge
                          variant={a.action === "BUY" ? "default" : "secondary"}
                          className={cn("text-xs", a.action === "BUY" ? "bg-emerald-600" : "")}
                        >
                          {a.action ?? "SKIP"}
                        </Badge>
                        <span className="text-sm font-mono">{a.ticker}</span>
                        {a.reason && <span className="text-xs text-muted-foreground truncate max-w-[300px]">{a.reason}</span>}
                      </div>
                      <div className="flex items-center gap-3">
                        {a.score != null && (
                          <span className={cn(
                            "text-sm font-mono font-semibold",
                            a.score >= 85 ? "text-emerald-500" : a.score >= 70 ? "text-yellow-500" : "text-muted-foreground"
                          )}>
                            {a.score}
                          </span>
                        )}
                        {a.timestamp && <span className="text-xs text-muted-foreground">{timeAgo(a.timestamp)}</span>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <Badge variant="outline" className="text-xs">Auto-refreshes every 30s</Badge>
          </>
        )}
      </DataSection>
    </div>
  );
}
