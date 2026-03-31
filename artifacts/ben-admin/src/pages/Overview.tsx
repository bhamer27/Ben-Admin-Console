import { motion, type Variants } from "framer-motion";
import { MetricCard } from "@/components/MetricCard";
import { DollarSign, Activity, Terminal, Briefcase, RefreshCw } from "lucide-react";
import { useEffect } from "react";
import { useFetch } from "@/lib/useFetch";
import { useTabData } from "@/lib/tabDataContext";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";

interface StripeMetrics {
  mrr: number;
}

interface ReplitMetrics {
  deployedCount: number;
}

interface KalshiStats {
  pnl?: number;
  pnl_30d?: number;
}

interface TradierData {
  totalValue: number;
}

interface PublicData {
  portfolioValue: number;
}

function fmtMoney(val: number): string {
  return `$${val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export default function Overview() {
  const stripe = useFetch<StripeMetrics>("/api/stripe/metrics");
  const replit = useFetch<ReplitMetrics>("/api/replit/metrics");
  const kalshi = useFetch<KalshiStats>("/api/kalshi/stats");
  const { setTabData } = useTabData();
  useEffect(() => {
    setTabData({ stripe: stripe.data, replit: replit.data, kalshi: kalshi.data });
  }, [stripe.data, replit.data, kalshi.data, setTabData]);
  const tradier = useFetch<TradierData>("/api/stocks/tradier");
  const publicCom = useFetch<PublicData>("/api/stocks/public");

  const container: Variants = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: { staggerChildren: 0.1 },
    },
  };

  const item: Variants = {
    hidden: { opacity: 0, y: 20 },
    show: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 300, damping: 24 } },
  };

  function refreshAll() {
    stripe.refetch();
    replit.refetch();
    kalshi.refetch();
    tradier.refetch();
    publicCom.refetch();
  }

  const portfolioValue = (tradier.data?.totalValue ?? 0) + (publicCom.data?.portfolioValue ?? 0);
  const hasPortfolio = tradier.data || publicCom.data;
  const kalshiPnl = kalshi.data?.pnl ?? kalshi.data?.pnl_30d;

  return (
    <div className="space-y-6 pb-10">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight mb-1.5">Overview</h1>
          <p className="text-muted-foreground text-sm sm:text-base">High-level metrics across all your connected properties.</p>
        </div>
        <Button variant="outline" size="sm" onClick={refreshAll} className="flex-shrink-0">
          <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
          Refresh
        </Button>
      </div>

      <motion.div
        variants={container}
        initial="hidden"
        animate="show"
        className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4"
      >
        <motion.div variants={item}>
          {stripe.loading ? (
            <Skeleton className="h-28 sm:h-32 rounded-xl" />
          ) : (
            <MetricCard
              title="MRR"
              value={stripe.data ? fmtMoney(stripe.data.mrr) : stripe.configured ? "Error" : "—"}
              subtitle="Stripe Monthly Revenue"
              icon={<DollarSign className="h-5 w-5" />}
            />
          )}
        </motion.div>

        <motion.div variants={item}>
          {replit.loading ? (
            <Skeleton className="h-28 sm:h-32 rounded-xl" />
          ) : (
            <MetricCard
              title="Deployed"
              value={replit.data ? String(replit.data.deployedCount) : "—"}
              subtitle="Replit deployments"
              icon={<Terminal className="h-5 w-5" />}
            />
          )}
        </motion.div>

        <motion.div variants={item}>
          {kalshi.loading ? (
            <Skeleton className="h-28 sm:h-32 rounded-xl" />
          ) : (
            <MetricCard
              title="Bot P&L"
              value={typeof kalshiPnl === "number"
                ? `$${Math.abs(kalshiPnl).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                : "—"}
              subtitle="Kalshi Automation"
              icon={<Activity className="h-5 w-5" />}
              trend={typeof kalshiPnl === "number"
                ? { value: `$${Math.abs(kalshiPnl).toFixed(2)}`, isPositive: kalshiPnl >= 0 }
                : undefined}
            />
          )}
        </motion.div>

        <motion.div variants={item}>
          {(tradier.loading || publicCom.loading) ? (
            <Skeleton className="h-28 sm:h-32 rounded-xl" />
          ) : (
            <MetricCard
              title="Portfolio"
              value={hasPortfolio ? fmtMoney(portfolioValue) : "—"}
              subtitle="Tradier & Public.com"
              icon={<Briefcase className="h-5 w-5" />}
            />
          )}
        </motion.div>
      </motion.div>

      {/* Integration status summary */}
      <div className="rounded-xl border border-border bg-card/50 p-4 sm:p-6">
        <h2 className="text-xs sm:text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-4">Integration Status</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 sm:gap-3">
          {[
            { name: "Stripe", ok: stripe.configured && !stripe.error, loading: stripe.loading },
            { name: "Replit", ok: replit.configured && !replit.error, loading: replit.loading },
            { name: "Kalshi", ok: kalshi.configured && !kalshi.error, loading: kalshi.loading },
            { name: "Tars", ok: tradier.configured && !tradier.error, loading: tradier.loading },
            { name: "Public.com", ok: publicCom.configured && !publicCom.error, loading: publicCom.loading },
          ].map(({ name, ok, loading }) => (
            <div key={name} className="flex items-center gap-2 min-w-0">
              <div className={`h-2 w-2 rounded-full flex-shrink-0 ${loading ? "bg-yellow-500 animate-pulse" : ok ? "bg-emerald-500" : "bg-muted-foreground/30"}`} />
              <span className="text-sm text-muted-foreground truncate">{name}</span>
              {!loading && (
                <span className={`text-xs hidden sm:inline ${ok ? "text-emerald-500" : "text-muted-foreground/50"}`}>
                  {ok ? "connected" : "not configured"}
                </span>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
