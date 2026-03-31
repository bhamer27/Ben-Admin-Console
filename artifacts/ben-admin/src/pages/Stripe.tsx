import { CreditCard, RefreshCw, DollarSign, Users, TrendingUp, Receipt } from "lucide-react";
import { MetricCard } from "@/components/MetricCard";
import { DataSection } from "@/components/DataSection";
import { useEffect } from "react";
import { useFetch } from "@/lib/useFetch";
import { useTabData } from "@/lib/tabDataContext";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface StripeMetrics {
  mrr: number;
  totalRevenue30d: number;
  newSubscribers30d: number;
  activeSubscriptions: number;
  byPriceId: Record<string, { name: string; mrr: number; activeCount: number }>;
  errors?: string[];
}

function fmtMoney(val: number): string {
  return `$${val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export default function Stripe() {
  const { setTabData } = useTabData();
  const { data, error, loading, configured, refetch } = useFetch<StripeMetrics>(
    "/api/stripe/metrics",
    { refreshInterval: 5 * 60_000 },
  );

  useEffect(() => { if (data) setTabData(data); }, [data, setTabData]);

  return (
    <div className="space-y-6 pb-10">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight mb-1.5">Stripe</h1>
          <p className="text-muted-foreground text-sm sm:text-base">Revenue and subscriber metrics across your Stripe accounts.</p>
        </div>
        {!loading && (
          <Button variant="outline" size="sm" onClick={refetch} className="flex-shrink-0">
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
        configNote="Set STRIPE_SECRET_KEY (or STRIPE_SECRET_KEYS for multiple accounts, comma-separated) to enable Stripe metrics."
      >
        {data && (
          <>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
              <MetricCard
                title="MRR"
                value={fmtMoney(data.mrr)}
                subtitle="Monthly Recurring Revenue"
                icon={<TrendingUp className="h-5 w-5" />}
              />
              <MetricCard
                title="Revenue (30d)"
                value={fmtMoney(data.totalRevenue30d)}
                subtitle="Total charges, last 30 days"
                icon={<DollarSign className="h-5 w-5" />}
              />
              <MetricCard
                title="New Subs"
                value={String(data.newSubscribers30d)}
                subtitle="Last 30 days"
                icon={<Users className="h-5 w-5" />}
              />
              <MetricCard
                title="Active Subs"
                value={String(data.activeSubscriptions)}
                subtitle="Currently active"
                icon={<CreditCard className="h-5 w-5" />}
              />
            </div>

            {Object.keys(data.byPriceId).length > 0 && (
              <div className="rounded-xl border border-border bg-card">
                <div className="p-4 sm:p-6 border-b border-border">
                  <div className="flex items-center gap-2">
                    <Receipt className="h-4 w-4 text-muted-foreground" />
                    <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">By Price ID</h2>
                  </div>
                </div>
                <div className="divide-y divide-border">
                  {Object.entries(data.byPriceId)
                    .sort(([, a], [, b]) => b.mrr - a.mrr)
                    .map(([priceId, info]) => (
                      <div key={priceId} className="px-4 sm:px-6 py-3.5 flex items-start sm:items-center justify-between gap-3 hover:bg-secondary/30 transition-colors">
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium text-foreground truncate">{info.name}</p>
                          <p className="text-xs text-muted-foreground font-mono truncate">{priceId}</p>
                        </div>
                        <div className="flex items-center gap-4 sm:gap-6 text-right flex-shrink-0">
                          <div>
                            <p className="text-xs text-muted-foreground">MRR</p>
                            <p className="text-sm font-semibold font-mono">{fmtMoney(info.mrr)}</p>
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground">Subs</p>
                            <p className="text-sm font-semibold font-mono">{info.activeCount}</p>
                          </div>
                        </div>
                      </div>
                    ))}
                </div>
              </div>
            )}

            {data.errors && data.errors.length > 0 && (
              <div className="rounded-lg border border-yellow-500/30 bg-yellow-500/5 p-4">
                <p className="text-xs font-semibold text-yellow-500 mb-1">Partial errors from some accounts:</p>
                {data.errors.map((e, i) => (
                  <p key={i} className="text-xs text-muted-foreground">{e}</p>
                ))}
              </div>
            )}

            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Badge variant="outline" className="text-xs">Auto-refreshes every 5 min</Badge>
            </div>
          </>
        )}
      </DataSection>
    </div>
  );
}
