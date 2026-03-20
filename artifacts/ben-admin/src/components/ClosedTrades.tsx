import { useState } from "react";
import { TrendingUp, TrendingDown, Trophy, BarChart2, RefreshCw, AlertTriangle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useFetch } from "@/lib/useFetch";
import { cn } from "@/lib/utils";

interface ClosedTrade {
  ticker: string;
  eventTicker: string;
  title: string;
  marketResult: "yes" | "no";
  settledTime: string;
  payout: number;
  cost: number;
  pnl: number;
  win: boolean;
  dataComplete: boolean;
  yesContracts: number;
  noContracts: number;
  fees: number;
}

interface TradesSummary {
  total: number;
  wins: number;
  losses: number;
  winRate: number;
  totalPnl: number;
  hasIncompleteData: boolean;
  incompleteCount: number;
}

interface KalshiTradesResponse {
  trades: ClosedTrade[];
  summary: TradesSummary;
}

type Filter = "all" | "wins" | "losses";

function fmtMoney(val: number, showSign = false): string {
  const prefix = showSign && val > 0 ? "+" : val < 0 ? "-" : "";
  return `${prefix}$${Math.abs(val).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function fmtDate(iso: string): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  } catch { return iso; }
}

export function ClosedTrades() {
  const [filter, setFilter] = useState<Filter>("all");
  const { data, loading, error, refetch } = useFetch<KalshiTradesResponse>(
    "/api/kalshi/trades",
    { refreshInterval: 5 * 60_000 },
  );

  const trades = data?.trades ?? [];
  const summary = data?.summary;

  const filtered = trades.filter((t) => {
    if (filter === "wins") return t.win;
    if (filter === "losses") return !t.win;
    return true;
  });

  const tabs: { key: Filter; label: string; count?: number }[] = [
    { key: "all", label: "All", count: summary?.total },
    { key: "wins", label: "Wins", count: summary?.wins },
    { key: "losses", label: "Losses", count: summary?.losses },
  ];

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2 px-5 py-4 border-b border-border">
        <Trophy className="h-4 w-4 text-muted-foreground" />
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
          Closed Trades
        </h2>
        {!loading && (
          <Button variant="ghost" size="icon" className="ml-auto h-7 w-7" onClick={refetch}>
            <RefreshCw className="h-3.5 w-3.5" />
          </Button>
        )}
      </div>

      {/* Summary bar */}
      {summary && (
        <div className="grid grid-cols-4 divide-x divide-border border-b border-border">
          <div className="px-4 py-3 text-center">
            <p className="text-xs text-muted-foreground mb-0.5">Settled</p>
            <p className="text-base font-semibold">{summary.total}</p>
          </div>
          <div className="px-4 py-3 text-center">
            <p className="text-xs text-muted-foreground mb-0.5">Win Rate</p>
            <p className="text-base font-semibold text-emerald-500">{summary.winRate}%</p>
          </div>
          <div className="px-4 py-3 text-center">
            <p className="text-xs text-muted-foreground mb-0.5">W / L</p>
            <p className="text-base font-semibold">
              <span className="text-emerald-500">{summary.wins}</span>
              <span className="text-muted-foreground mx-1">/</span>
              <span className="text-destructive">{summary.losses}</span>
            </p>
          </div>
          <div className="px-4 py-3 text-center">
            <p className="text-xs text-muted-foreground mb-0.5 flex items-center justify-center gap-1">
              Realized P&L
              {summary.hasIncompleteData && (
                <AlertTriangle className="h-3 w-3 text-amber-400" title={`${summary.incompleteCount} trade(s) missing historical cost data`} />
              )}
            </p>
            <p className={cn("text-base font-semibold", summary.totalPnl >= 0 ? "text-emerald-500" : "text-destructive")}>
              {fmtMoney(summary.totalPnl, true)}
              {summary.hasIncompleteData && <span className="text-xs text-amber-400 ml-1">est.</span>}
            </p>
          </div>
        </div>
      )}

      {/* Filter tabs */}
      <div className="flex border-b border-border">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setFilter(tab.key)}
            className={cn(
              "flex items-center gap-1.5 px-4 py-2.5 text-xs font-medium transition-colors border-b-2 -mb-px",
              filter === tab.key
                ? "border-primary text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            {tab.label}
            {tab.count !== undefined && (
              <span className={cn(
                "rounded-full px-1.5 py-0.5 text-[10px] font-semibold",
                filter === tab.key ? "bg-primary/20 text-primary" : "bg-muted text-muted-foreground",
              )}>
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Trade list */}
      <div className="divide-y divide-border max-h-96 overflow-y-auto">
        {loading && (
          <div className="px-5 py-8 text-center text-sm text-muted-foreground animate-pulse">
            Loading trades…
          </div>
        )}
        {error && (
          <div className="px-5 py-8 text-center text-sm text-destructive">
            Failed to load trades.
          </div>
        )}
        {!loading && !error && filtered.length === 0 && (
          <div className="px-5 py-8 text-center text-sm text-muted-foreground">
            No {filter === "all" ? "" : filter} trades yet.
          </div>
        )}
        {filtered.map((trade) => (
          <div
            key={trade.ticker}
            className="px-5 py-3.5 flex items-start justify-between hover:bg-secondary/30 transition-colors"
          >
            <div className="flex items-start gap-3 flex-1 min-w-0 pr-4">
              {/* Win/loss icon */}
              <div className={cn(
                "mt-0.5 flex-shrink-0 h-6 w-6 rounded-full flex items-center justify-center",
                trade.win ? "bg-emerald-500/15" : "bg-destructive/15",
              )}>
                {trade.win
                  ? <TrendingUp className="h-3.5 w-3.5 text-emerald-500" />
                  : <TrendingDown className="h-3.5 w-3.5 text-destructive" />}
              </div>

              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium leading-snug truncate">{trade.title}</p>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-xs text-muted-foreground font-mono">{trade.ticker}</span>
                  <Badge
                    variant="outline"
                    className={cn(
                      "text-[10px] px-1.5 py-0",
                      trade.marketResult === "yes"
                        ? "text-emerald-500 border-emerald-500/40"
                        : "text-blue-400 border-blue-400/40",
                    )}
                  >
                    resolved {trade.marketResult.toUpperCase()}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {fmtDate(trade.settledTime)} · cost {fmtMoney(trade.cost)}
                  {trade.fees > 0 && ` · fees ${fmtMoney(trade.fees)}`}
                </p>
              </div>
            </div>

            <div className="text-right flex-shrink-0">
              <BarChart2 className="h-3.5 w-3.5 text-muted-foreground/40 ml-auto mb-1" />
              <p className={cn(
                "text-sm font-semibold",
                trade.pnl > 0 ? "text-emerald-500" : "text-destructive",
              )}>
                {fmtMoney(trade.pnl, true)}
                {!trade.dataComplete && (
                  <span className="text-[10px] text-amber-400 ml-1 font-normal">est.</span>
                )}
              </p>
              <p className="text-xs text-muted-foreground">
                payout {fmtMoney(trade.payout)}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
