import { ReactNode } from "react";
import { RefreshCw, AlertCircle, Settings2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

interface DataSectionProps {
  loading: boolean;
  error: string | null;
  configured: boolean;
  onRefresh: () => void;
  configNote?: string;
  children: ReactNode;
}

export function DataSection({
  loading,
  error,
  configured,
  onRefresh,
  configNote,
  children,
}: DataSectionProps) {
  if (loading) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-32 rounded-xl" />
          ))}
        </div>
        <Skeleton className="h-64 rounded-xl" />
      </div>
    );
  }

  if (!configured) {
    return (
      <div className="rounded-xl border border-dashed border-border bg-card/30 p-10 text-center flex flex-col items-center gap-4">
        <div className="h-12 w-12 rounded-full bg-secondary flex items-center justify-center">
          <Settings2 className="h-6 w-6 text-muted-foreground" />
        </div>
        <div>
          <h3 className="text-base font-semibold text-foreground mb-1">Integration not configured</h3>
          <p className="text-sm text-muted-foreground max-w-md">
            {configNote ?? "Set the required environment variables to enable this integration."}
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={onRefresh}>
          <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
          Retry
        </Button>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-10 text-center flex flex-col items-center gap-4">
        <AlertCircle className="h-10 w-10 text-destructive/60" />
        <div>
          <h3 className="text-base font-semibold text-foreground mb-1">Error fetching data</h3>
          <p className="text-sm text-muted-foreground font-mono">{error}</p>
        </div>
        <Button variant="outline" size="sm" onClick={onRefresh}>
          <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
          Retry
        </Button>
      </div>
    );
  }

  return <>{children}</>;
}
