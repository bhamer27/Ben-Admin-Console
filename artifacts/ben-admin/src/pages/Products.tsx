import { useState } from "react";
import { RefreshCw, Building2, MapPin, Clock, TrendingUp, Users, CheckCircle, XCircle, AlertCircle, ArrowUpDown } from "lucide-react";
import { useFetch } from "@/lib/useFetch";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

// ─── Types ────────────────────────────────────────────────────────────────────

interface CityRequest {
  id: number;
  cityName: string;
  state?: string;
  country?: string;
  contactName?: string;
  email?: string;
  reason?: string;
  status: "pending" | "added" | "declined";
  source?: string;
  createdAt: string;
}

interface CityRequestsResponse {
  entries: CityRequest[];
  summary: { total: number; pending: number; added: number; declined: number };
}

interface WaitlistEntry {
  id: number;
  businessName: string;
  contactName?: string;
  email?: string;
  phone?: string;
  googleBusinessUrl?: string;
  status: "pending" | "activated" | "rejected";
  notes?: string;
  source?: string;
  createdAt: string;
}

interface WaitlistResponse {
  entries: WaitlistEntry[];
  summary: { total: number; pending: number; activated: number; rejected: number };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function daysSince(iso: string) {
  return Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; icon: typeof CheckCircle; className: string }> = {
    pending:   { label: "Pending",   icon: AlertCircle,  className: "text-yellow-500 border-yellow-500/40" },
    added:     { label: "Added",     icon: CheckCircle,  className: "text-emerald-500 border-emerald-500/40" },
    activated: { label: "Activated", icon: CheckCircle,  className: "text-emerald-500 border-emerald-500/40" },
    declined:  { label: "Declined",  icon: XCircle,      className: "text-destructive border-destructive/40" },
    rejected:  { label: "Rejected",  icon: XCircle,      className: "text-destructive border-destructive/40" },
  };
  const cfg = map[status] ?? map["pending"];
  const Icon = cfg.icon;
  return (
    <Badge variant="outline" className={cn("text-xs gap-1", cfg.className)}>
      <Icon className="h-3 w-3" />{cfg.label}
    </Badge>
  );
}

// ─── PermitRadar tab ──────────────────────────────────────────────────────────

type CitySort = "recent" | "most-requested" | "status";

function groupByCity(entries: CityRequest[]): { city: string; state?: string; count: number; latest: string; statuses: string[]; requests: CityRequest[] }[] {
  const map = new Map<string, CityRequest[]>();
  for (const e of entries) {
    const key = `${e.cityName}|${e.state ?? ""}`;
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(e);
  }
  return Array.from(map.entries()).map(([key, reqs]) => {
    const [city, state] = key.split("|");
    const sorted = [...reqs].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    return { city, state: state || undefined, count: reqs.length, latest: sorted[0].createdAt, statuses: reqs.map(r => r.status), requests: sorted };
  });
}

function PermitRadarTab() {
  const { data, loading, error, refetch } = useFetch<CityRequestsResponse>("/api/permitradar/city-requests", { refreshInterval: 60_000 });
  const [sort, setSort] = useState<CitySort>("recent");
  const [expanded, setExpanded] = useState<string | null>(null);

  const groups = data ? groupByCity(data.entries) : [];
  const sorted = [...groups].sort((a, b) => {
    if (sort === "most-requested") return b.count - a.count;
    if (sort === "recent") return new Date(b.latest).getTime() - new Date(a.latest).getTime();
    return 0;
  });

  return (
    <div className="space-y-6">
      {/* Summary */}
      {data && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: "Total Requests", value: data.summary.total, icon: MapPin },
            { label: "Pending", value: data.summary.pending, icon: AlertCircle },
            { label: "Cities Added", value: data.summary.added, icon: CheckCircle },
            { label: "Declined", value: data.summary.declined, icon: XCircle },
          ].map(({ label, value, icon: Icon }) => (
            <div key={label} className="rounded-xl border border-border bg-card p-4">
              <div className="flex items-center gap-2 mb-1">
                <Icon className="h-4 w-4 text-muted-foreground" />
                <p className="text-xs text-muted-foreground">{label}</p>
              </div>
              <p className="text-2xl font-semibold font-mono">{value}</p>
            </div>
          ))}
        </div>
      )}

      {/* Sort controls */}
      <div className="flex items-center gap-2">
        <ArrowUpDown className="h-4 w-4 text-muted-foreground" />
        <span className="text-sm text-muted-foreground">Sort by:</span>
        {(["recent", "most-requested"] as CitySort[]).map((s) => (
          <Button key={s} variant={sort === s ? "default" : "outline"} size="sm" onClick={() => setSort(s)}>
            {s === "recent" ? "Most Recent" : "Most Requested"}
          </Button>
        ))}
      </div>

      {/* City request groups */}
      {loading && <p className="text-muted-foreground text-sm">Loading...</p>}
      {error && <p className="text-destructive text-sm">{error}</p>}
      {sorted.length === 0 && !loading && (
        <div className="rounded-xl border border-dashed border-border p-10 text-center text-muted-foreground">
          No city requests yet.
        </div>
      )}

      <div className="rounded-xl border border-border bg-card divide-y divide-border">
        {sorted.map((g) => {
          const key = `${g.city}|${g.state}`;
          const isOpen = expanded === key;
          const hasAdded = g.statuses.includes("added");
          return (
            <div key={key}>
              <button
                className="w-full px-5 py-3.5 flex items-center justify-between hover:bg-secondary/30 transition-colors text-left"
                onClick={() => setExpanded(isOpen ? null : key)}
              >
                <div className="flex items-center gap-3">
                  <MapPin className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                  <div>
                    <p className="text-sm font-semibold">{g.city}{g.state ? `, ${g.state}` : ""}</p>
                    <p className="text-xs text-muted-foreground">Last requested {fmtDate(g.latest)}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={hasAdded ? "default" : "outline"} className={cn("text-xs", hasAdded ? "bg-emerald-600" : "")}>
                    {g.count} {g.count === 1 ? "request" : "requests"}
                  </Badge>
                  <span className="text-muted-foreground text-xs">{isOpen ? "▲" : "▼"}</span>
                </div>
              </button>

              {isOpen && (
                <div className="px-5 pb-4 space-y-2">
                  {g.requests.map((req) => (
                    <div key={req.id} className="rounded-lg border border-border bg-secondary/20 p-3 flex items-start justify-between gap-3">
                      <div>
                        {req.contactName && <p className="text-sm font-medium">{req.contactName}</p>}
                        {req.email && <p className="text-xs text-muted-foreground">{req.email}</p>}
                        {req.reason && <p className="text-xs text-muted-foreground mt-1 italic">"{req.reason}"</p>}
                        <p className="text-xs text-muted-foreground mt-1">{fmtDate(req.createdAt)} · {daysSince(req.createdAt)}d ago</p>
                      </div>
                      <StatusBadge status={req.status} />
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="flex justify-end">
        <Button variant="outline" size="sm" onClick={refetch}>
          <RefreshCw className="h-3.5 w-3.5 mr-1.5" />Refresh
        </Button>
      </div>
    </div>
  );
}

// ─── Re-Voo tab ───────────────────────────────────────────────────────────────

function RevooTab() {
  const { data, loading, error, refetch } = useFetch<WaitlistResponse>("/api/revoo/waitlist", { refreshInterval: 60_000 });

  return (
    <div className="space-y-6">
      {data && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: "Total", value: data.summary.total, icon: Users },
            { label: "Pending", value: data.summary.pending, icon: AlertCircle },
            { label: "Activated", value: data.summary.activated, icon: CheckCircle },
            { label: "Rejected", value: data.summary.rejected, icon: XCircle },
          ].map(({ label, value, icon: Icon }) => (
            <div key={label} className="rounded-xl border border-border bg-card p-4">
              <div className="flex items-center gap-2 mb-1">
                <Icon className="h-4 w-4 text-muted-foreground" />
                <p className="text-xs text-muted-foreground">{label}</p>
              </div>
              <p className="text-2xl font-semibold font-mono">{value}</p>
            </div>
          ))}
        </div>
      )}

      {loading && <p className="text-muted-foreground text-sm">Loading...</p>}
      {error && <p className="text-destructive text-sm">{error}</p>}

      {data?.entries.length === 0 && !loading && (
        <div className="rounded-xl border border-dashed border-border p-10 text-center text-muted-foreground">
          No waitlist entries yet.
        </div>
      )}

      {data && data.entries.length > 0 && (
        <div className="rounded-xl border border-border bg-card divide-y divide-border">
          {data.entries.map((entry) => (
            <div key={entry.id} className="px-5 py-3.5 flex items-start justify-between hover:bg-secondary/30 transition-colors">
              <div className="flex items-start gap-3">
                <Building2 className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-sm font-semibold">{entry.businessName}</p>
                  {entry.contactName && <p className="text-xs text-muted-foreground">{entry.contactName}</p>}
                  {entry.email && <p className="text-xs text-muted-foreground">{entry.email}</p>}
                  {entry.googleBusinessUrl && (
                    <a href={entry.googleBusinessUrl} target="_blank" rel="noreferrer" className="text-xs text-blue-400 hover:underline truncate block max-w-xs">
                      {entry.googleBusinessUrl}
                    </a>
                  )}
                  <div className="flex items-center gap-2 mt-1">
                    <Clock className="h-3 w-3 text-muted-foreground" />
                    <span className="text-xs text-muted-foreground">{fmtDate(entry.createdAt)} · {daysSince(entry.createdAt)}d as customer</span>
                  </div>
                </div>
              </div>
              <div className="flex flex-col items-end gap-1">
                <StatusBadge status={entry.status} />
                {entry.source && <span className="text-xs text-muted-foreground">{entry.source}</span>}
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="flex justify-end">
        <Button variant="outline" size="sm" onClick={refetch}>
          <RefreshCw className="h-3.5 w-3.5 mr-1.5" />Refresh
        </Button>
      </div>
    </div>
  );
}

// ─── Placeholder tab ──────────────────────────────────────────────────────────

function ComingSoonMetrics({ product }: { product: string }) {
  return (
    <div className="rounded-xl border border-dashed border-border bg-card/30 p-10 text-center">
      <TrendingUp className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
      <p className="text-muted-foreground font-medium">{product} user metrics coming soon</p>
      <p className="text-muted-foreground/60 text-sm mt-1">Account type, days as customer, subscription data</p>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function Products() {
  return (
    <div className="space-y-8 pb-10">
      <div>
        <h1 className="text-3xl font-bold tracking-tight mb-2">Products</h1>
        <p className="text-muted-foreground">User data, waitlists, and city requests across all products.</p>
      </div>

      <Tabs defaultValue="permitradar">
        <TabsList className="mb-6">
          <TabsTrigger value="permitradar">PermitRadar</TabsTrigger>
          <TabsTrigger value="revoo">Re-Voo</TabsTrigger>
          <TabsTrigger value="leadpulse">LeadPulse</TabsTrigger>
          <TabsTrigger value="answerdine">AnswerDine</TabsTrigger>
        </TabsList>

        <TabsContent value="permitradar"><PermitRadarTab /></TabsContent>
        <TabsContent value="revoo"><RevooTab /></TabsContent>
        <TabsContent value="leadpulse"><ComingSoonMetrics product="LeadPulse" /></TabsContent>
        <TabsContent value="answerdine"><ComingSoonMetrics product="AnswerDine" /></TabsContent>
      </Tabs>
    </div>
  );
}
