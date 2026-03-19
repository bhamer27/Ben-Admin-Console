import { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface MetricCardProps {
  title: string;
  value: string;
  subtitle?: string;
  icon: ReactNode;
  trend?: {
    value: string;
    isPositive: boolean;
  };
  className?: string;
}

export function MetricCard({ title, value, subtitle, icon, trend, className }: MetricCardProps) {
  return (
    <div className={cn(
      "bg-card rounded-xl p-6 border border-border/50 shadow-sm transition-all duration-200 hover:shadow-md hover:border-border group",
      className
    )}>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-medium text-muted-foreground tracking-tight">{title}</h3>
        <div className="text-muted-foreground/50 group-hover:text-muted-foreground transition-colors">
          {icon}
        </div>
      </div>
      
      <div className="flex flex-col gap-1">
        <div className="flex items-baseline gap-2">
          <span className="text-2xl md:text-3xl font-semibold tracking-tight font-mono text-foreground">{value}</span>
          {trend && (
            <span className={cn(
              "text-xs font-medium px-1.5 py-0.5 rounded-md",
              trend.isPositive ? "bg-emerald-500/10 text-emerald-500" : "bg-destructive/10 text-destructive"
            )}>
              {trend.isPositive ? '+' : '-'}{trend.value}
            </span>
          )}
        </div>
        {subtitle && (
          <p className="text-xs text-muted-foreground">{subtitle}</p>
        )}
      </div>
    </div>
  );
}
