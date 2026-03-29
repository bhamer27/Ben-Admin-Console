import { useState } from "react";
import {
  TrendingUp, TrendingDown, RefreshCw, Target, DollarSign, Activity,
  BarChart2, PieChart, ChevronDown, ChevronRight, Clock, AlertCircle,
  ArrowUpRight, ArrowDownRight, Wallet,
} from "lucide-react";
import { MetricCard } from "@/components/MetricCard";
import { DataSection } from "@/components/DataSection";
import { ClosedTrades } from "@/components/ClosedTrades";
import { useFetch } from "@/lib/useFetch";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

// ─── Types ────────────────────────────────────────────────────────────────────

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

type View = "overview" | "pnl" | "expiry";

// ─── Helpers ──────────────────────────────────────────────────────────────────

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

function daysUntil(iso: string): number {
  return Math.ceil((new Date(iso).getTime() - Date.now()) / 86400000);
}

// ─── Overview sub-components ──────────────────────────────────────────────────

function PriceBar({ bid, ask, side }: { bid: number; ask: number; side: "yes" | "no" }) {
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

function OverviewView({ data }: { data: KalshiStats }) {
  const pnlPositive = data.unrealizedPnl >= 0;
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <MetricCard title="Cash" value={fmtMoney(data.balance)} subtitle="Available to trade" icon={<DollarSign className="h-5 w-5" />} />
        <MetricCard title="Invested" value={fmtMoney(data.totalInvested)} subtitle={`${data.investedPct}% of portfolio`} icon={<Activity className="h-5 w-5" />} />
        <MetricCard
          title="Unrealized P&L"
          value={fmtMoney(Math.abs(data.unrealizedPnl))}
          subtitle="Open positions"
          icon={pnlPositive ? <TrendingUp className="h-5 w-5" /> : <TrendingDown className="h-5 w-5" />}
          trend={{ value: fmtMoney(Math.abs(data.unrealizedPnl)), isPositive: pnlPositive }}
        />
        <MetricCard title="Positions" value={String(data.openPositions)} subtitle={`${data.cashPct}% cash`} icon={<Target className="h-5 w-5" />} />
      </div>

      <div className="rounded-xl border border-border bg-card p-5">
        <div className="flex items-center gap-2 mb-3">
          <PieChart className="h-4 w-4 text-muted-foreground" />
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Portfolio Allocation</h2>
          <span className="ml-auto text-xs text-muted-foreground font-mono">{fmtMoney(data.portfolioValue)} total</span>
        </div>
        <div className="flex h-3 rounded-full overflow-hidden gap-0.5">
          <div className="bg-muted-foreground/40 transition-all" style={{ width: `${data.cashPct}%` }} />
          <div className="bg-blue-500 transition-all" style={{ width: `${data.investedPct}%` }} />
        </div>
        <div className="flex gap-4 mt-2 text-xs text-muted-foreground">
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-muted-foreground/40 inline-block" />Cash {data.cashPct}%</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-blue-500 inline-block" />Invested {data.investedPct}%</span>
        </div>
      </div>

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
                    <Badge variant="outline" className={cn("text-xs uppercase shrink-0", pos.side === "yes" ? "text-emerald-500 border-emerald-500/40" : "text-blue-400 border-blue-400/40")}>
                      {pos.side}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground font-mono mt-0.5">{pos.ticker}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{pos.contracts} contracts · closes {fmtDate(pos.closeTime)}</p>
                </div>
                <div className="text-right flex-shrink-0">
                  <PriceBar bid={pos.side === "yes" ? pos.yesBid : pos.noBid} ask={pos.side === "yes" ? pos.yesAsk : pos.noAsk} side={pos.side} />
                  <p className="text-xs text-muted-foreground mt-0.5">cost {fmtMoney(pos.invested)} · now {fmtMoney(pos.currentValue)}</p>
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
    </div>
  );
}

// ─── P&L Story view ───────────────────────────────────────────────────────────

function PnlView({ data }: { data: KalshiStats }) {
  const winners = [...data.positions].filter((p) => p.pnl > 0).sort((a, b) => b.pnl - a.pnl);
  const losers  = [...data.positions].filter((p) => p.pnl <= 0).sort((a, b) => a.pnl - b.pnl);
  const winRate = data.positions.length > 0 ? (winners.length / data.positions.length) * 100 : 0;
  const returnPct = data.totalInvested > 0 ? (data.unrealizedPnl / data.totalInvested) * 100 : 0;
  const pnlPositive = data.unrealizedPnl >= 0;

  return (
    <div className="space-y-10">
      {/* Hero */}
      <div className="space-y-2">
        <p className="text-muted-foreground text-sm font-medium uppercase tracking-wide">Total Unrealized Return</p>
        <div className="flex items-baseline gap-4">
          <span className={cn("text-4xl sm:text-6xl font-bold tracking-tight", pnlPositive ? "text-emerald-500" : "text-destructive")}>
            {pnlPositive ? "+" : "−"}${Math.abs(data.unrealizedPnl).toFixed(2)}
          </span>
          <span className={cn("text-xl sm:text-2xl font-medium", pnlPositive ? "text-emerald-500/80" : "text-destructive/80")}>
            {pnlPositive ? "+" : ""}{returnPct.toFixed(1)}%
          </span>
        </div>
      </div>

      <div className="rounded-2xl border border-border bg-card p-6 space-y-4">
        <div className="flex items-center justify-between text-sm">
          <span className="text-foreground font-medium">
            {data.openPositions} positions · {winners.length} winners · {losers.length} losers
          </span>
          <span className="text-muted-foreground">
            Win rate: <span className="text-foreground font-medium">{winRate.toFixed(0)}%</span>
          </span>
        </div>
        <div className="h-3 w-full bg-secondary rounded-full overflow-hidden flex">
          <div className="h-full bg-emerald-500 transition-all" style={{ width: `${winRate}%` }} />
          <div className="h-full bg-destructive/60 transition-all" style={{ width: `${100 - winRate}%` }} />
        </div>
        <div className="pt-4 border-t border-border flex items-center justify-between text-sm text-muted-foreground">
          <div className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-blue-500 inline-block" />${data.balance.toFixed(2)} cash</div>
          <div className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-purple-500 inline-block" />${data.totalInvested.toFixed(2)} deployed</div>
        </div>
      </div>

      {/* Winners */}
      {winners.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-lg font-semibold flex items-center gap-2 text-emerald-500">
            <ArrowUpRight className="h-5 w-5" />Winners
          </h2>
          {winners.map((pos) => (
            <div key={pos.ticker} className="flex items-center justify-between p-4 bg-card border border-border border-l-4 border-l-emerald-500 rounded-lg hover:bg-secondary/30 transition-colors">
              <div className="space-y-1 overflow-hidden">
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className={cn("text-xs uppercase", pos.side === "yes" ? "text-emerald-500 border-emerald-500/40" : "text-blue-400 border-blue-400/40")}>{pos.side}</Badge>
                  <span className="font-medium truncate max-w-xs">{pos.title}</span>
                </div>
                <p className="text-xs text-muted-foreground">Cost {fmtMoney(pos.invested)} · Value {fmtMoney(pos.currentValue)}</p>
              </div>
              <div className="text-right pl-4 flex-shrink-0">
                <p className="text-xl font-bold text-emerald-500">+{fmtMoney(pos.pnl)}</p>
                <p className="text-xs text-emerald-500/70">+{((pos.pnl / pos.invested) * 100).toFixed(1)}%</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {losers.length > 0 && winners.length > 0 && <Separator className="bg-border" />}

      {/* Losers */}
      {losers.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-lg font-semibold flex items-center gap-2 text-destructive">
            <ArrowDownRight className="h-5 w-5" />Losers
          </h2>
          {losers.map((pos) => (
            <div key={pos.ticker} className="flex items-center justify-between p-4 bg-card border border-border border-l-4 border-l-destructive/60 rounded-lg hover:bg-secondary/30 transition-colors">
              <div className="space-y-1 overflow-hidden">
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className={cn("text-xs uppercase", pos.side === "yes" ? "text-emerald-500 border-emerald-500/40" : "text-blue-400 border-blue-400/40")}>{pos.side}</Badge>
                  <span className="font-medium truncate max-w-xs">{pos.title}</span>
                </div>
                <p className="text-xs text-muted-foreground">Cost {fmtMoney(pos.invested)} · Value {fmtMoney(pos.currentValue)}</p>
              </div>
              <div className="text-right pl-4 flex-shrink-0">
                <p className="text-xl font-bold text-destructive">{fmtMoney(pos.pnl)}</p>
                <p className="text-xs text-destructive/70">{((pos.pnl / pos.invested) * 100).toFixed(1)}%</p>
              </div>
            </div>
          ))}
        </div>
      )}

      <ClosedTrades />
    </div>
  );
}

// ─── Expiry Calendar view ─────────────────────────────────────────────────────

interface ExpiryGroup {
  id: string;
  title: string;
  urgent: boolean;
  positions: KalshiPosition[];
  totalInvested: number;
  totalValue: number;
}

function groupByExpiry(positions: KalshiPosition[]): ExpiryGroup[] {
  const soon: KalshiPosition[] = [];
  const byMonth: Record<string, KalshiPosition[]> = {};

  for (const pos of positions) {
    const days = daysUntil(pos.closeTime);
    if (days <= 7) {
      soon.push(pos);
    } else {
      const label = new Date(pos.closeTime).toLocaleDateString("en-US", { month: "long", year: "numeric" });
      byMonth[label] ??= [];
      byMonth[label].push(pos);
    }
  }

  const groups: ExpiryGroup[] = [];

  if (soon.length > 0) {
    groups.push({
      id: "soon",
      title: "Expiring Soon (≤ 7 days)",
      urgent: true,
      positions: soon.sort((a, b) => daysUntil(a.closeTime) - daysUntil(b.closeTime)),
      totalInvested: soon.reduce((s, p) => s + p.invested, 0),
      totalValue:    soon.reduce((s, p) => s + p.currentValue, 0),
    });
  }

  // Sort months chronologically
  const sortedMonths = Object.keys(byMonth).sort(
    (a, b) => new Date(a).getTime() - new Date(b).getTime()
  );

  for (const month of sortedMonths) {
    const ps = byMonth[month];
    groups.push({
      id: month,
      title: month,
      urgent: false,
      positions: ps.sort((a, b) => new Date(a.closeTime).getTime() - new Date(b.closeTime).getTime()),
      totalInvested: ps.reduce((s, p) => s + p.invested, 0),
      totalValue:    ps.reduce((s, p) => s + p.currentValue, 0),
    });
  }

  return groups;
}

function ExpiryView({ data }: { data: KalshiStats }) {
  const groups = groupByExpiry(data.positions);
  const [expanded, setExpanded] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(groups.map((g, i) => [g.id, i === 0]))
  );

  const toggle = (id: string) => setExpanded((prev) => ({ ...prev, [id]: !prev[id] }));

  return (
    <div className="space-y-6">
      {/* Stats strip */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: "Available Cash", value: fmtMoney(data.balance), icon: <Wallet className="h-4 w-4" /> },
          { label: "Total Invested",  value: fmtMoney(data.totalInvested), icon: <Activity className="h-4 w-4" /> },
          { label: "Unrealized P&L",  value: (data.unrealizedPnl >= 0 ? "+" : "") + fmtMoney(data.unrealizedPnl), icon: <TrendingUp className="h-4 w-4" />, positive: data.unrealizedPnl >= 0 },
        ].map(({ label, value, icon, positive }) => (
          <div key={label} className="rounded-xl border border-border bg-card p-4">
            <div className="flex items-center gap-2 text-muted-foreground text-sm mb-2">{icon}{label}</div>
            <p className={cn("text-2xl font-semibold", positive === undefined ? "" : positive ? "text-emerald-500" : "text-destructive")}>
              {value}
            </p>
          </div>
        ))}
      </div>

      {/* Timeline */}
      <div className="space-y-3 relative">
        <div className="absolute left-[27px] top-4 bottom-4 w-0.5 bg-border rounded-full z-0" />
        {groups.map((group) => {
          const isOpen = expanded[group.id] ?? false;
          const pnl = group.totalValue - group.totalInvested;
          return (
            <div key={group.id} className="relative z-10">
              <button
                onClick={() => toggle(group.id)}
                className={cn(
                  "w-full flex items-center justify-between p-3 rounded-xl border transition-all text-left",
                  group.urgent
                    ? "bg-amber-500/10 border-amber-500/20 hover:bg-amber-500/15"
                    : "bg-card border-border hover:bg-secondary/40"
                )}
              >
                <div className="flex items-center gap-3">
                  <div className={cn("w-8 h-8 rounded-full flex items-center justify-center border bg-background", group.urgent ? "border-amber-500/40" : "border-border")}>
                    {group.urgent
                      ? <AlertCircle className="h-4 w-4 text-amber-500" />
                      : <Clock className="h-4 w-4 text-muted-foreground" />}
                  </div>
                  <div>
                    <p className={cn("font-semibold", group.urgent ? "text-amber-500" : "text-foreground")}>{group.title}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {group.positions.length} position{group.positions.length !== 1 ? "s" : ""} · {fmtMoney(group.totalInvested)} at stake
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-6">
                  <div className="text-right hidden sm:block">
                    <p className="text-sm font-medium">Exp. {fmtMoney(group.totalValue)}</p>
                    <p className={cn("text-xs font-medium", pnl >= 0 ? "text-emerald-500" : "text-destructive")}>
                      {pnl >= 0 ? "+" : ""}{fmtMoney(pnl)}
                    </p>
                  </div>
                  {isOpen ? <ChevronDown className="h-5 w-5 text-muted-foreground" /> : <ChevronRight className="h-5 w-5 text-muted-foreground" />}
                </div>
              </button>

              {isOpen && (
                <div className="pl-14 pr-2 py-3 space-y-2">
                  {group.positions.map((pos) => {
                    const days = daysUntil(pos.closeTime);
                    return (
                      <div key={pos.ticker} className="bg-card border border-border rounded-lg p-4 hover:border-border/80 transition-colors">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <Badge variant="outline" className={cn("text-xs uppercase", pos.side === "yes" ? "text-emerald-500 border-emerald-500/40" : "text-blue-400 border-blue-400/40")}>
                                {pos.side}
                              </Badge>
                              <span className="text-xs text-muted-foreground font-mono">{pos.ticker}</span>
                              <span className="text-xs text-muted-foreground flex items-center gap-1 ml-auto sm:ml-0">
                                <Clock className="h-3 w-3" />{days > 0 ? `${days}d left` : "Expires today"}
                              </span>
                            </div>
                            <p className="font-medium text-sm truncate">{pos.title}</p>
                          </div>
                          <div className="flex items-center justify-between sm:justify-end gap-6">
                            <div className="text-right">
                              <p className="text-xs text-muted-foreground uppercase tracking-wide mb-0.5">Contracts</p>
                              <p className="text-sm font-mono">{pos.contracts}</p>
                            </div>
                            <div className="text-right">
                              <p className="text-xs text-muted-foreground uppercase tracking-wide mb-0.5">Value</p>
                              <p className="text-sm font-mono">{fmtMoney(pos.currentValue)}</p>
                            </div>
                            <div className="text-right min-w-[64px]">
                              <p className="text-xs text-muted-foreground uppercase tracking-wide mb-0.5">P&L</p>
                              <p className={cn("text-sm font-mono font-semibold flex items-center justify-end gap-0.5", pos.pnl >= 0 ? "text-emerald-500" : "text-destructive")}>
                                {pos.pnl >= 0 ? <ArrowUpRight className="h-3.5 w-3.5" /> : <ArrowDownRight className="h-3.5 w-3.5" />}
                                {pos.pnl >= 0 ? "+" : ""}{fmtMoney(pos.pnl)}
                              </p>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Portfolio bar */}
      <div className="rounded-xl border border-border bg-card p-5">
        <div className="flex h-3 rounded-full overflow-hidden gap-0.5 mb-2">
          <div className="bg-muted-foreground/40" style={{ width: `${data.cashPct}%` }} />
          <div className="bg-blue-500" style={{ width: `${data.investedPct}%` }} />
        </div>
        <div className="flex gap-4 text-xs text-muted-foreground">
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-muted-foreground/40 inline-block" />Cash {data.cashPct}%</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-blue-500 inline-block" />Invested {data.investedPct}%</span>
        </div>
      </div>

      <ClosedTrades />
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

const VIEWS: { id: View; label: string }[] = [
  { id: "overview", label: "Overview" },
  { id: "pnl",      label: "P&L" },
  { id: "expiry",   label: "Expiry Calendar" },
];

export default function Kalshi() {
  const [view, setView] = useState<View>("overview");
  const { data, error, loading, configured, refetch } = useFetch<KalshiStats>(
    "/api/kalshi/stats",
    { refreshInterval: 60_000 },
  );

  return (
    <div className="space-y-6 pb-10">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight mb-1.5">Kalshi Bot</h1>
          <p className="text-muted-foreground text-sm sm:text-base">Live prediction market positions. Direct Kalshi API.</p>
        </div>
        {!loading && (
          <Button variant="outline" size="sm" onClick={refetch} className="flex-shrink-0">
            <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
            Refresh
          </Button>
        )}
      </div>

      {/* View toggle */}
      <div className="flex items-center gap-1 bg-secondary/50 rounded-lg p-1 w-fit">
        {VIEWS.map(({ id, label }) => (
          <button
            key={id}
            onClick={() => setView(id)}
            className={cn(
              "px-3 py-1.5 rounded-md text-sm font-medium transition-colors",
              view === id
                ? "bg-card text-foreground shadow-sm border border-border"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            {label}
          </button>
        ))}
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
            {view === "overview" && <OverviewView data={data} />}
            {view === "pnl"      && <PnlView data={data} />}
            {view === "expiry"   && <ExpiryView data={data} />}
          </>
        )}
      </DataSection>

      {/* ClosedTrades only shown in overview (the other views include it inline) */}
      {view === "overview" && <ClosedTrades />}
    </div>
  );
}
