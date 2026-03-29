import { useState } from "react";
import { RefreshCw, Building2, MapPin, Clock, Users, CheckCircle, XCircle, AlertCircle, ArrowUpDown, ChevronDown, ChevronUp } from "lucide-react";
import { useFetch } from "@/lib/useFetch";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

// ─── Types ────────────────────────────────────────────────────────────────────

interface ProductUser {
  id: string | number;
  name: string | null;
  email: string | null;
  plan: string;
  subscription_status: string;
  created_at: string | null;
  last_active: string | null;
}

interface UsersResponse { app: string; users: ProductUser[]; error?: string; configured: boolean; }

interface CityRequest {
  id: number; cityName: string; state?: string; contactName?: string;
  email?: string; reason?: string; status: string; createdAt: string;
}
interface CityRequestsResponse {
  entries: CityRequest[];
  summary: { total: number; pending: number; added: number; declined: number };
}

interface WaitlistEntry {
  id: number; businessName: string; contactName?: string; email?: string;
  phone?: string; googleBusinessUrl?: string; status: string; createdAt: string;
}
interface WaitlistResponse {
  entries: WaitlistEntry[];
  summary: { total: number; pending: number; activated: number; rejected: number };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtDate(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function daysSince(iso: string | null) {
  if (!iso) return null;
  return Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
}

function PlanBadge({ plan }: { plan: string }) {
  const map: Record<string, string> = {
    trial: "text-muted-foreground border-muted-foreground/30",
    free: "text-muted-foreground border-muted-foreground/30",
    starter: "text-blue-400 border-blue-400/40",
    pro: "text-emerald-500 border-emerald-500/40",
    monthly: "text-emerald-500 border-emerald-500/40",
    annual: "text-purple-400 border-purple-400/40",
  };
  return (
    <Badge variant="outline" className={cn("text-xs capitalize", map[plan.toLowerCase()] ?? map["trial"])}>
      {plan}
    </Badge>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { icon: typeof CheckCircle; className: string }> = {
    pending:   { icon: AlertCircle,  className: "text-yellow-500 border-yellow-500/40" },
    added:     { icon: CheckCircle,  className: "text-emerald-500 border-emerald-500/40" },
    activated: { icon: CheckCircle,  className: "text-emerald-500 border-emerald-500/40" },
    active:    { icon: CheckCircle,  className: "text-emerald-500 border-emerald-500/40" },
    declined:  { icon: XCircle,      className: "text-destructive border-destructive/40" },
    rejected:  { icon: XCircle,      className: "text-destructive border-destructive/40" },
    trial:     { icon: AlertCircle,  className: "text-muted-foreground border-muted-foreground/30" },
    free:      { icon: AlertCircle,  className: "text-muted-foreground border-muted-foreground/30" },
  };
  const cfg = map[status.toLowerCase()] ?? map["trial"];
  const Icon = cfg.icon;
  return (
    <Badge variant="outline" className={cn("text-xs gap-1 capitalize", cfg.className)}>
      <Icon className="h-3 w-3" />{status}
    </Badge>
  );
}

// ─── User Table ───────────────────────────────────────────────────────────────

function UserTable({ users, loading, error, configured, refetch, configNote }: {
  users: ProductUser[];
  loading: boolean;
  error: string | null;
  configured: boolean;
  refetch: () => void;
  configNote?: string;
}) {
  const paying = users.filter(u => !["trial", "free"].includes(u.plan.toLowerCase())).length;

  if (!configured) {
    return (
      <div className="rounded-xl border border-dashed border-border bg-card/30 p-10 text-center text-muted-foreground">
        <Users className="h-8 w-8 mx-auto mb-3 opacity-40" />
        <p className="font-medium">Not configured</p>
        {configNote && <p className="text-sm mt-1 opacity-60">{configNote}</p>}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Summary bar */}
      {users.length > 0 && (
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: "Total Users", value: users.length },
            { label: "Paying", value: paying },
            { label: "Trial / Free", value: users.length - paying },
          ].map(({ label, value }) => (
            <div key={label} className="rounded-xl border border-border bg-card p-3 sm:p-4">
              <p className="text-xs text-muted-foreground mb-1">{label}</p>
              <p className="text-xl sm:text-2xl font-semibold font-mono">{value}</p>
            </div>
          ))}
        </div>
      )}

      {loading && <p className="text-muted-foreground text-sm">Loading...</p>}
      {error && <p className="text-destructive text-sm">{error}</p>}

      {!loading && users.length === 0 && (
        <div className="rounded-xl border border-dashed border-border p-10 text-center text-muted-foreground">
          No users yet.
        </div>
      )}

      {/* Card list — works on all screen sizes */}
      {users.length > 0 && (
        <div className="rounded-xl border border-border bg-card divide-y divide-border">
          {users.map((u) => {
            const days = daysSince(u.created_at);
            const lastActive = daysSince(u.last_active);
            return (
              <div key={u.id} className="px-4 py-3 flex items-start justify-between gap-3 hover:bg-secondary/20 transition-colors">
                <div className="min-w-0 flex-1">
                  {u.name && <p className="text-sm font-medium truncate">{u.name}</p>}
                  <p className={cn("truncate", u.name ? "text-xs text-muted-foreground" : "text-sm font-medium")}>
                    {u.email ?? `ID: ${u.id}`}
                  </p>
                  <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                    <PlanBadge plan={u.plan} />
                    <StatusBadge status={u.subscription_status} />
                    {days != null && (
                      <span className="text-xs text-muted-foreground">{days}d customer</span>
                    )}
                  </div>
                </div>
                <div className="text-right text-xs text-muted-foreground flex-shrink-0 mt-0.5">
                  {lastActive != null ? `${lastActive}d ago` : u.last_active ? fmtDate(u.last_active) : "—"}
                </div>
              </div>
            );
          })}
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

// ─── PermitRadar tab ──────────────────────────────────────────────────────────

type CitySort = "recent" | "most-requested";

function groupByCity(entries: CityRequest[]) {
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
  const users = useFetch<UsersResponse>("/api/products/permitradar/users", { refreshInterval: 120_000 });
  const cities = useFetch<CityRequestsResponse>("/api/permitradar/city-requests", { refreshInterval: 60_000 });
  const [sort, setSort] = useState<CitySort>("recent");
  const [expanded, setExpanded] = useState<string | null>(null);

  const groups = cities.data ? groupByCity(cities.data.entries) : [];
  const sorted = [...groups].sort((a, b) =>
    sort === "most-requested"
      ? b.count - a.count
      : new Date(b.latest).getTime() - new Date(a.latest).getTime()
  );

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-lg font-semibold mb-4">Users</h2>
        <UserTable
          users={users.data?.users ?? []}
          loading={users.loading}
          error={users.error}
          configured={users.configured !== false}
          refetch={users.refetch}
          configNote="Set PERMITRADAR_URL + CRON_SECRET in Replit Secrets"
        />
      </div>

      <div>
        <h2 className="text-lg font-semibold mb-4">City Requests</h2>
        {cities.data && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
            {[
              { label: "Total", value: cities.data.summary.total },
              { label: "Pending", value: cities.data.summary.pending },
              { label: "Added", value: cities.data.summary.added },
              { label: "Declined", value: cities.data.summary.declined },
            ].map(({ label, value }) => (
              <div key={label} className="rounded-xl border border-border bg-card p-3 sm:p-4">
                <p className="text-xs text-muted-foreground mb-1">{label}</p>
                <p className="text-xl sm:text-2xl font-semibold font-mono">{value}</p>
              </div>
            ))}
          </div>
        )}

        <div className="flex items-center gap-2 mb-4 flex-wrap">
          <ArrowUpDown className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm text-muted-foreground">Sort:</span>
          {(["recent", "most-requested"] as CitySort[]).map((s) => (
            <Button key={s} variant={sort === s ? "default" : "outline"} size="sm" onClick={() => setSort(s)}>
              {s === "recent" ? "Most Recent" : "Most Requested"}
            </Button>
          ))}
        </div>

        {sorted.length === 0 && !cities.loading && (
          <div className="rounded-xl border border-dashed border-border p-10 text-center text-muted-foreground">No city requests yet.</div>
        )}

        <div className="rounded-xl border border-border bg-card divide-y divide-border">
          {sorted.map((g) => {
            const key = `${g.city}|${g.state}`;
            const isOpen = expanded === key;
            return (
              <div key={key}>
                <button
                  className="w-full px-4 py-3.5 flex items-center justify-between hover:bg-secondary/30 transition-colors text-left"
                  onClick={() => setExpanded(isOpen ? null : key)}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <MapPin className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                    <div className="min-w-0">
                      <p className="text-sm font-semibold truncate">{g.city}{g.state ? `, ${g.state}` : ""}</p>
                      <p className="text-xs text-muted-foreground">Last requested {fmtDate(g.latest)}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                    <Badge variant="outline" className="text-xs">{g.count}</Badge>
                    {isOpen ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                  </div>
                </button>
                {isOpen && (
                  <div className="px-4 pb-4 space-y-2">
                    {g.requests.map((req) => (
                      <div key={req.id} className="rounded-lg border border-border bg-secondary/20 p-3 flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          {req.contactName && <p className="text-sm font-medium">{req.contactName}</p>}
                          {req.email && <p className="text-xs text-muted-foreground truncate">{req.email}</p>}
                          {req.reason && <p className="text-xs text-muted-foreground mt-1 italic">"{req.reason}"</p>}
                          <p className="text-xs text-muted-foreground mt-1">{fmtDate(req.createdAt)}</p>
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
      </div>
    </div>
  );
}

// ─── Re-Voo tab ───────────────────────────────────────────────────────────────

function RevooTab() {
  const users = useFetch<UsersResponse>("/api/products/revoo/users", { refreshInterval: 120_000 });
  const waitlist = useFetch<WaitlistResponse>("/api/revoo/waitlist", { refreshInterval: 60_000 });

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-lg font-semibold mb-4">Users</h2>
        <UserTable
          users={users.data?.users ?? []}
          loading={users.loading}
          error={users.error}
          configured={users.configured !== false}
          refetch={users.refetch}
          configNote="Set REVOO_URL + CRON_SECRET in Replit Secrets"
        />
      </div>

      <div>
        <h2 className="text-lg font-semibold mb-4">GMB Waitlist</h2>
        {waitlist.data && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
            {[
              { label: "Total", value: waitlist.data.summary.total },
              { label: "Pending", value: waitlist.data.summary.pending },
              { label: "Activated", value: waitlist.data.summary.activated },
              { label: "Rejected", value: waitlist.data.summary.rejected },
            ].map(({ label, value }) => (
              <div key={label} className="rounded-xl border border-border bg-card p-3 sm:p-4">
                <p className="text-xs text-muted-foreground mb-1">{label}</p>
                <p className="text-xl sm:text-2xl font-semibold font-mono">{value}</p>
              </div>
            ))}
          </div>
        )}
        {waitlist.data?.entries.length === 0 && !waitlist.loading && (
          <div className="rounded-xl border border-dashed border-border p-10 text-center text-muted-foreground">No waitlist entries yet.</div>
        )}
        {waitlist.data && waitlist.data.entries.length > 0 && (
          <div className="rounded-xl border border-border bg-card divide-y divide-border">
            {waitlist.data.entries.map((entry) => (
              <div key={entry.id} className="px-4 py-3.5 flex items-start justify-between gap-3 hover:bg-secondary/30 transition-colors">
                <div className="flex items-start gap-3 min-w-0 flex-1">
                  <Building2 className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                  <div className="min-w-0">
                    <p className="text-sm font-semibold truncate">{entry.businessName}</p>
                    {entry.contactName && <p className="text-xs text-muted-foreground">{entry.contactName}</p>}
                    {entry.email && <p className="text-xs text-muted-foreground truncate">{entry.email}</p>}
                    {entry.googleBusinessUrl && (
                      <a href={entry.googleBusinessUrl} target="_blank" rel="noreferrer" className="text-xs text-blue-400 hover:underline block truncate max-w-[200px] sm:max-w-xs">{entry.googleBusinessUrl}</a>
                    )}
                    <div className="flex items-center gap-1.5 mt-1">
                      <Clock className="h-3 w-3 text-muted-foreground" />
                      <span className="text-xs text-muted-foreground">{fmtDate(entry.createdAt)}</span>
                    </div>
                  </div>
                </div>
                <StatusBadge status={entry.status} />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Simple product tab (LeadPulse / AnswerDine) ──────────────────────────────

function SimpleProductTab({ app, urlEnvKey }: { app: string; urlEnvKey: string }) {
  const { data, loading, error, configured, refetch } = useFetch<UsersResponse>(
    `/api/products/${app}/users`,
    { refreshInterval: 120_000 }
  );

  return (
    <UserTable
      users={data?.users ?? []}
      loading={loading}
      error={error}
      configured={configured !== false}
      refetch={refetch}
      configNote={`Set ${urlEnvKey} + CRON_SECRET in Replit Secrets`}
    />
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function Products() {
  return (
    <div className="space-y-6 pb-10">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight mb-1.5">Products</h1>
        <p className="text-muted-foreground text-sm sm:text-base">Users, subscriptions, and product-specific data across all apps.</p>
      </div>

      <Tabs defaultValue="permitradar">
        <div className="overflow-x-auto -mx-1 px-1 mb-6">
          <TabsList className="whitespace-nowrap">
            <TabsTrigger value="permitradar">PermitRadar</TabsTrigger>
            <TabsTrigger value="revoo">Re-Voo</TabsTrigger>
            <TabsTrigger value="leadpulse">LeadPulse</TabsTrigger>
            <TabsTrigger value="answerdine">AnswerDine</TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="permitradar"><PermitRadarTab /></TabsContent>
        <TabsContent value="revoo"><RevooTab /></TabsContent>
        <TabsContent value="leadpulse"><SimpleProductTab app="leadpulse" urlEnvKey="LEADPULSE_URL" /></TabsContent>
        <TabsContent value="answerdine"><SimpleProductTab app="answerdine" urlEnvKey="ANSWERDINE_URL" /></TabsContent>
      </Tabs>
    </div>
  );
}
