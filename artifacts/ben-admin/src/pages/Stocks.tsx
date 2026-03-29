import { RefreshCw, TrendingUp, TrendingDown, DollarSign, BarChart2 } from "lucide-react";
import { MetricCard } from "@/components/MetricCard";
import { DataSection } from "@/components/DataSection";
import { useFetch } from "@/lib/useFetch";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface PublicHolding {
  symbol: string;
  name: string;
  quantity: number;
  currentPrice: number;
  value: number;
  gainLoss: number;
  gainLossPct: number;
}

interface PublicData {
  portfolioValue: number;
  totalGainLoss: number;
  totalReturnPct: number;
  holdings: PublicHolding[];
}

function fmtMoney(val: number): string {
  return `$${Math.abs(val).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function fmtPct(val: number): string {
  return `${val >= 0 ? "+" : ""}${val.toFixed(2)}%`;
}

function GainLossBadge({ value, pct }: { value: number; pct: number }) {
  const isPos = value >= 0;
  return (
    <div className={cn("flex items-center gap-1 text-xs font-medium", isPos ? "text-emerald-500" : "text-destructive")}>
      {isPos ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
      {fmtMoney(Math.abs(value))} ({fmtPct(pct)})
    </div>
  );
}

function PositionRow({ pos }: { pos: PublicHolding }) {
  return (
    <div className="px-6 py-3 flex items-center justify-between hover:bg-secondary/30 transition-colors">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg bg-secondary flex items-center justify-center flex-shrink-0">
          <span className="text-xs font-bold font-mono">{pos.symbol.slice(0, 4)}</span>
        </div>
        <div>
          <p className="text-sm font-semibold">{pos.symbol}</p>
          {pos.name !== pos.symbol && (
            <p className="text-xs text-muted-foreground">{pos.name}</p>
          )}
          <p className="text-xs text-muted-foreground">{pos.quantity} shares @ ${pos.currentPrice.toFixed(2)}</p>
        </div>
      </div>
      <div className="text-right">
        <p className="text-sm font-semibold font-mono">{fmtMoney(pos.value)}</p>
        <GainLossBadge value={pos.gainLoss} pct={pos.gainLossPct} />
      </div>
    </div>
  );
}

export default function Stocks() {
  const publicCom = useFetch<PublicData>("/api/stocks/public", { refreshInterval: 5 * 60_000 });

  return (
    <div className="space-y-8 pb-10">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight mb-2">Public Portfolio</h1>
          <p className="text-muted-foreground">Holdings from Public.com.</p>
        </div>
        {!publicCom.loading && (
          <Button variant="outline" size="sm" onClick={publicCom.refetch}>
            <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
            Refresh
          </Button>
        )}
      </div>

      {publicCom.data && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <MetricCard
            title="Portfolio Value"
            value={fmtMoney(publicCom.data.portfolioValue)}
            subtitle="Total market value"
            icon={<DollarSign className="h-5 w-5" />}
          />
          <MetricCard
            title="Total Return"
            value={fmtMoney(Math.abs(publicCom.data.totalGainLoss))}
            subtitle={`${fmtPct(publicCom.data.totalReturnPct)} all-time`}
            icon={<BarChart2 className="h-5 w-5" />}
            trend={{ value: fmtPct(publicCom.data.totalReturnPct), isPositive: publicCom.data.totalGainLoss >= 0 }}
          />
        </div>
      )}

      <DataSection
        loading={publicCom.loading}
        error={publicCom.error}
        configured={publicCom.configured}
        onRefresh={publicCom.refetch}
        configNote="Set PUBLIC_COM_API_KEY to enable Public.com portfolio data."
      >
        {publicCom.data && (
          <>
            {publicCom.data.holdings.length > 0 && (
              <div className="rounded-xl border border-border bg-card">
                <div className="p-6 border-b border-border">
                  <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Holdings</h2>
                </div>
                <div className="divide-y divide-border">
                  {publicCom.data.holdings
                    .sort((a, b) => b.value - a.value)
                    .map((h) => (
                      <PositionRow key={h.symbol} pos={h} />
                    ))}
                </div>
              </div>
            )}
            <Badge variant="outline" className="text-xs">Auto-refreshes every 5 min</Badge>
          </>
        )}
      </DataSection>
    </div>
  );
}
