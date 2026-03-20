import { TrendingUp, TrendingDown, RefreshCw, Target, DollarSign, Activity, BarChart2, PieChart } from "lucide-react";
import { MetricCard } from "@/components/MetricCard";
import { DataSection } from "@/components/DataSection";
import { ClosedTrades } from "@/components/ClosedTrades";
import { useFetch } from "@/lib/useFetch";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface KalshiPosition {
  ticker: string;
  title: string;
  side: "yes" | "no";
  contracts: number;
  invested: number;
  currentValue: number;
  pnl: number;
  yesBid: number;
  yesAsk: number;
  noBid: number;
  noAsk: number;
  closeTime: string;
  yesPrice: number;
}

interface KalshiStats {
  balance: number;
  portfolioValue: number;
  totalInvested: number;
  unrealizedPnl: number;
  openPositions: number;
  cashPct: number;
  investedPct: number;
  positions: KalshiPosition[];
}

function fmtMoney(val: number): string {
  const prefix = val < 0 ? "-" : "";
  return `${prefix}$${Math.abs(val).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function fmtDate(iso: string): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  } catch { return iso; }
}

function PriceBar({ bid, ask, side }: { bid: number; ask: number; side: "yes" | "no" }) {
  // bid/ask are in dollars (0.37), display as cents (37¢)
  const bidCents = Math.round(bid * 100);
  const askCents = Math.round(ask * 100);
  const mid = Math.round((bidCents + askCents) / 2);
  return (
    <div className="flex items-center gap-1.5 text-xs">
      <span className={cn("font-mono font-semibold", side === "yes" ? "text-emerald-500" : "text-blue-400")}>
        {mid}¢
      </span>
      <span className="text-muted-foreground">[{bidCents}–{askCents}]</span>
    </div>
  );
}


export default function Kalshi() {
  const { data, error, loading, configured, refetch } = useFetch<KalshiStats>(
    "/api/kalshi/stats",
    { refreshInterval: 60_000 },
  );

  const pnlPositive = (data?.unrealizedPnl ?? 0) >= 0;

  return (
    <div className="space-y-8 pb-10">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight mb-2">Kalshi Bot</h1>
          <p className="text-muted-foreground">Live prediction market positions. Direct Kalshi API.</p>
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
        configNote="Add KALSHI_PRIVATE_KEY to Replit Secrets (the PEM content of your Kalshi private key) to enable this integration."
      >
        {data && (
          <>
            {/* Top metrics */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <MetricCard
                title="Cash Balance"
                value={fmtMoney(data.balance)}
                subtitle="Available to trade"
                icon={<DollarSign className="h-5 w-5" />}
              />
              <MetricCard
                title="Total Invested"
                value={fmtMoney(data.totalInvested)}
                subtitle={`${data.investedPct}% of portfolio`}
                icon={<Activity className="h-5 w-5" />}
              />
              <MetricCard
                title="Unrealized P&L"
                value={fmtMoney(Math.abs(data.unrealizedPnl))}
                subtitle="Open positions"
                icon={pnlPositive ? <TrendingUp className="h-5 w-5" /> : <TrendingDown className="h-5 w-5" />}
                trend={{ value: fmtMoney(Math.abs(data.unrealizedPnl)), isPositive: pnlPositive }}
              />
              <MetricCard
                title="Open Positions"
                value={String(data.openPositions)}
                subtitle={`${data.cashPct}% cash`}
                icon={<Target className="h-5 w-5" />}
              />
            </div>

            {/* Portfolio bar */}
            <div className="rounded-xl border border-border bg-card p-5">
              <div className="flex items-center gap-2 mb-3">
                <PieChart className="h-4 w-4 text-muted-foreground" />
                <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Portfolio Allocation</h2>
                <span className="ml-auto text-xs text-muted-foreground font-mono">{fmtMoney(data.portfolioValue)} total</span>
              </div>
              <div className="flex h-3 rounded-full overflow-hidden gap-0.5">
                <div className="bg-muted-foreground/40 transition-all" style={{ width: `${data.cashPct}%` }} title={`Cash ${data.cashPct}%`} />
                <div className="bg-blue-500 transition-all" style={{ width: `${data.investedPct}%` }} title={`Invested ${data.investedPct}%`} />
              </div>
              <div className="flex gap-4 mt-2 text-xs text-muted-foreground">
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-muted-foreground/40 inline-block" />Cash {data.cashPct}%</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-blue-500 inline-block" />Invested {data.investedPct}%</span>
              </div>
            </div>

            {/* Positions table */}
            {data.positions.length > 0 ? (
              <div className="rounded-xl border border-border bg-card">
                <div className="px-6 py-4 border-b border-border flex items-center gap-2">
                  <BarChart2 className="h-4 w-4 text-muted-foreground" />
                  <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Open Positions</h2>
                  <Badge variant="outline" className="ml-auto text-xs">{data.positions.length} active</Badge>
                </div>
                <div className="divide-y divide-border">
                  {data.positions.map((pos) => (
                    <div key={pos.ticker} className="px-6 py-3.5 flex items-start justify-between hover:bg-secondary/30 transition-colors">
                      <div className="flex-1 min-w-0 pr-4">
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className="text-sm font-semibold leading-snug">{pos.title || pos.ticker}</span>
                          <Badge
                            variant="outline"
                            className={cn("text-xs uppercase shrink-0", pos.side === "yes" ? "text-emerald-500 border-emerald-500/40" : "text-blue-400 border-blue-400/40")}
                          >
                            {pos.side}
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground font-mono mt-0.5">{pos.ticker}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {pos.contracts} contracts · closes {fmtDate(pos.closeTime)}
                        </p>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <PriceBar
                          bid={pos.side === "yes" ? pos.yesBid : pos.noBid}
                          ask={pos.side === "yes" ? pos.yesAsk : pos.noAsk}
                          side={pos.side}
                        />
                        <p className="text-xs text-muted-foreground mt-0.5">
                          cost {fmtMoney(pos.invested)} · now {fmtMoney(pos.currentValue)}
                        </p>
                        <p className={cn("text-xs font-semibold mt-0.5", pos.pnl >= 0 ? "text-emerald-500" : "text-destructive")}>
                          {pos.pnl >= 0 ? "+" : ""}{fmtMoney(pos.pnl)}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="rounded-xl border border-dashed border-border bg-card/30 p-10 text-center text-muted-foreground">
                No open positions right now.
              </div>
            )}

            <Badge variant="outline" className="text-xs">Auto-refreshes every 60s · Direct Kalshi API</Badge>
          </>
        )}
      </DataSection>

      <ClosedTrades />
    </div>
  );
}
