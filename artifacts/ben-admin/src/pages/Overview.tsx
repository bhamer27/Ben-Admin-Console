import { motion, type Variants } from "framer-motion";
import { MetricCard } from "@/components/MetricCard";
import { DollarSign, Activity, Terminal, Briefcase } from "lucide-react";

export default function Overview() {
  const container: Variants = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1
      }
    }
  };

  const item: Variants = {
    hidden: { opacity: 0, y: 20 },
    show: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 300, damping: 24 } }
  };

  return (
    <div className="space-y-8 pb-10">
      <div>
        <h1 className="text-3xl font-bold tracking-tight mb-2">Overview</h1>
        <p className="text-muted-foreground">High-level metrics across all your connected properties.</p>
      </div>

      <motion.div 
        variants={container}
        initial="hidden"
        animate="show"
        className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4"
      >
        <motion.div variants={item}>
          <MetricCard
            title="Total Revenue"
            value="—"
            subtitle="Stripe MRR & One-offs"
            icon={<DollarSign className="h-5 w-5" />}
          />
        </motion.div>
        
        <motion.div variants={item}>
          <MetricCard
            title="Active Projects"
            value="—"
            subtitle="Replit Deployments"
            icon={<Terminal className="h-5 w-5" />}
          />
        </motion.div>

        <motion.div variants={item}>
          <MetricCard
            title="Bot P&L"
            value="—"
            subtitle="Kalshi Automation"
            icon={<Activity className="h-5 w-5" />}
          />
        </motion.div>

        <motion.div variants={item}>
          <MetricCard
            title="Portfolio Value"
            value="—"
            subtitle="Tradier & Public"
            icon={<Briefcase className="h-5 w-5" />}
          />
        </motion.div>
      </motion.div>

      <div className="mt-12 rounded-xl border border-dashed border-border p-12 text-center flex flex-col items-center justify-center bg-card/30">
        <div className="h-12 w-12 rounded-full bg-secondary flex items-center justify-center mb-4">
          <Activity className="h-6 w-6 text-muted-foreground" />
        </div>
        <h3 className="text-lg font-medium text-foreground mb-2">Data Integrations Pending</h3>
        <p className="text-sm text-muted-foreground max-w-md mx-auto">
          The foundation is ready. Task 2 will wire up the backend endpoints to pull live data from Replit, Stripe, Google, Kalshi, and brokerages.
        </p>
      </div>
    </div>
  );
}
