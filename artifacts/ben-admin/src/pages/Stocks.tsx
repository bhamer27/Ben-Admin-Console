import { LineChart, RefreshCw, TrendingUp, TrendingDown, DollarSign, BarChart2 } from "lucide-react";
import { MetricCard } from "@/components/MetricCard";
import { DataSection } from "@/components/DataSection";
import { useFetch } from "@/lib/useFetch";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

interface Position {
  symbol: string;
  quantity: number;
  currentPrice: number;
  value: number;
  costBasis: number;
  gainLoss: number;
  gainLossPct: number;
  dayChangePct: number;
}

interface TradierData {
  positions: Position[];
  totalValue: number;
  totalCostBasis: number;
  totalGainLoss: number;
}

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

function PositionRow({ pos }: { pos: Position | PublicHolding }) {
  const isPos = pos.gainLoss >= 0;
  return (
    <div className="px-6 py-3 flex items-center justify-between hover:bg-secondary/30 transition-colors">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg bg-secondary flex items-center justify-center flex-shrink-0">
          <span className="text-xs font-bold font-mono">{pos.symbol.slice(0, 4)}</span>
        </div>
        <div>
          <p className="text-sm font-semibold">{pos.symbol}</p>
          {"name" in pos && pos.name !== pos.symbol && (
            <p className="text-xs text-muted-foreground">{(pos as PublicHolding).name}</p>
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
  const tradier = useFetch<TradierData>("/api/stocks/tradier", { refreshInterval: 5 * 60_000 });
  const publicCom = useFetch<PublicData>("/api/stocks/public", { refreshInterval: 5 * 60_000 });

  const totalValue =
    (tradier.data?.totalValue ?? 0) + (publicCom.data?.portfolioValue ?? 0);

  const totalGainLoss =
    (tradier.data?.totalGainLoss ?? 0) + (publicCom.data?.totalGainLoss ?? 0);

  function refreshAll() {
    tradier.refetch();
    publicCom.refetch();
  }

  const anyLoading = tradier.loading || publicCom.loading;

  return (
    <div className="space-y-8 pb-10">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight mb-2">Stocks</h1>
          <p className="text-muted-foreground">Portfolio holdings from Tradier and Public.com.</p>
        </div>
        {!anyLoading && (
          <Button variant="outline" size="sm" onClick={refreshAll}>
            <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
            Refresh All
          </Button>
        )}
      </div>

      {/* Aggregate overview cards when at least one source has data */}
      {(tradier.data || publicCom.data) && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <MetricCard
            title="Total Portfolio Value"
            value={fmtMoney(totalValue)}
            subtitle="Tradier + Public.com"
            icon={<DollarSign className="h-5 w-5" />}
          />
          <MetricCard
            title="Total Gain / Loss"
            value={fmtMoney(Math.abs(totalGainLoss))}
            subtitle="Combined unrealized P&L"
            icon={<BarChart2 className="h-5 w-5" />}
            trend={{ value: fmtMoney(Math.abs(totalGainLoss)), isPositive: totalGainLoss >= 0 }}
          />
          <MetricCard
            title="Tradier Value"
            value={tradier.data ? fmtMoney(tradier.data.totalValue) : "—"}
            subtitle={tradier.data ? `${tradier.data.positions.length} positions` : "Not configured"}
            icon={<LineChart className="h-5 w-5" />}
          />
        </div>
      )}

      <Tabs defaultValue="tradier">
        <TabsList className="mb-6">
          <TabsTrigger value="tradier">Tradier</TabsTrigger>
          <TabsTrigger value="public">Public.com</TabsTrigger>
        </TabsList>

        <TabsContent value="tradier">
          <DataSection
            loading={tradier.loading}
            error={tradier.error}
            configured={tradier.configured}
            onRefresh={tradier.refetch}
            configNote="Set TRADIER_API_TOKEN (and optionally TRADIER_ACCOUNT_ID) to enable Tradier portfolio data."
          >
            {tradier.data && (
              <>
                {tradier.data.positions.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-border bg-card/30 p-10 text-center text-muted-foreground">
                    No positions found in this Tradier account.
                  </div>
                ) : (
                  <div className="rounded-xl border border-border bg-card">
                    <div className="p-6 border-b border-border flex items-center justify-between">
                      <div>
                        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Positions</h2>
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-muted-foreground">Total Value</p>
                        <p className="text-lg font-semibold font-mono">{fmtMoney(tradier.data.totalValue)}</p>
                        <GainLossBadge value={tradier.data.totalGainLoss} pct={tradier.data.totalCostBasis > 0 ? (tradier.data.totalGainLoss / tradier.data.totalCostBasis) * 100 : 0} />
                      </div>
                    </div>
                    <div className="divide-y divide-border">
                      {tradier.data.positions
                        .sort((a, b) => b.value - a.value)
                        .map((pos) => (
                          <PositionRow key={pos.symbol} pos={pos} />
                        ))}
                    </div>
                  </div>
                )}
                <Badge variant="outline" className="text-xs">Auto-refreshes every 5 min</Badge>
              </>
            )}
          </DataSection>
        </TabsContent>

        <TabsContent value="public">
          <DataSection
            loading={publicCom.loading}
            error={publicCom.error}
            configured={publicCom.configured}
            onRefresh={publicCom.refetch}
            configNote="Set PUBLIC_COM_API_KEY to enable Public.com portfolio data."
          >
            {publicCom.data && (
              <>
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
        </TabsContent>
      </Tabs>
    </div>
  );
}
