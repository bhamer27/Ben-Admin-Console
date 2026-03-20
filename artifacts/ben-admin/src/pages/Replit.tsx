import { useState } from "react";
import {
  TerminalSquare, RefreshCw, Globe, Server, Lock, Users, Play, GitFork,
  Heart, Pin, CheckCircle2, Clock, XCircle, Building2, Mail, Phone,
  ExternalLink, ChevronDown, MapPin, PlusCircle,
} from "lucide-react";
import { MetricCard } from "@/components/MetricCard";
import { DataSection } from "@/components/DataSection";
import { useFetch } from "@/lib/useFetch";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

const PINNED_PROJECTS = ["Re-Voo", "LeadPulse", "PermitRadar", "AnswerDine"];

type StatusCfg = { label: string; color: string; icon: React.ReactNode };

const WAITLIST_STATUSES: Record<string, StatusCfg> = {
  pending:   { label: "Pending",   color: "text-amber-400 border-amber-400/30 bg-amber-400/10",      icon: <Clock className="h-3 w-3" /> },
  activated: { label: "Activated", color: "text-emerald-400 border-emerald-400/30 bg-emerald-400/10", icon: <CheckCircle2 className="h-3 w-3" /> },
  rejected:  { label: "Rejected",  color: "text-red-400 border-red-400/30 bg-red-400/10",             icon: <XCircle className="h-3 w-3" /> },
};

const CITY_STATUSES: Record<string, StatusCfg> = {
  pending:  { label: "Pending",  color: "text-amber-400 border-amber-400/30 bg-amber-400/10",      icon: <Clock className="h-3 w-3" /> },
  added:    { label: "Added",    color: "text-emerald-400 border-emerald-400/30 bg-emerald-400/10", icon: <PlusCircle className="h-3 w-3" /> },
  declined: { label: "Declined", color: "text-red-400 border-red-400/30 bg-red-400/10",            icon: <XCircle className="h-3 w-3" /> },
};

interface ReplitMetrics {
  username: string;
  isVerified: boolean;
  followerCount: number;
  followingCount: number;
  totalRepls: number;
  deployedCount: number;
  totalRuns: number;
  totalForks: number;
  totalLikes: number;
  newFollowers30d: number;
  repls: {
    id: string;
    title: string;
    slug: string;
    isPrivate: boolean;
    hasDeployment: boolean;
    deploymentDomain: string | null;
    runCount: number;
    forkCount: number;
    likeCount: number;
  }[];
}

interface WaitlistEntry {
  id: number;
  businessName: string;
  contactName: string | null;
  email: string | null;
  phone: string | null;
  googleBusinessUrl: string | null;
  status: string;
  notes: string | null;
  source: string | null;
  createdAt: string;
}

interface WaitlistData {
  entries: WaitlistEntry[];
  summary: { total: number; pending: number; activated: number; rejected: number };
}

interface CityRequest {
  id: number;
  cityName: string;
  state: string | null;
  country: string | null;
  contactName: string | null;
  email: string | null;
  reason: string | null;
  status: string;
  source: string | null;
  createdAt: string;
}

interface CityRequestData {
  entries: CityRequest[];
  summary: { total: number; pending: number; added: number; declined: number };
}

function StatusBadge({ status, statuses }: { status: string; statuses: Record<string, StatusCfg> }) {
  const cfg = statuses[status] ?? statuses.pending ?? Object.values(statuses)[0];
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${cfg.color}`}>
      {cfg.icon}{cfg.label}
    </span>
  );
}

function StatusButton({
  entryId, current, statuses, onUpdate,
}: {
  entryId: number;
  current: string;
  statuses: Record<string, StatusCfg>;
  onUpdate: (id: number, status: string) => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const handle = async (status: string) => {
    setOpen(false);
    setLoading(true);
    await onUpdate(entryId, status);
    setLoading(false);
  };

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        disabled={loading}
        className="flex items-center gap-1 hover:opacity-80 transition-opacity"
      >
        <StatusBadge status={current} statuses={statuses} />
        <ChevronDown className="h-3 w-3 text-muted-foreground" />
      </button>
      {open && (
        <div className="absolute right-0 mt-1 z-10 bg-popover border border-border rounded-lg shadow-xl py-1 min-w-[120px]">
          {Object.entries(statuses).map(([key, cfg]) => (
            <button
              key={key}
              onClick={() => handle(key)}
              className="w-full flex items-center gap-2 px-3 py-1.5 text-xs hover:bg-secondary/50 transition-colors"
            >
              {cfg.icon}<span>{cfg.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function SpotlightCard({
  repl,
  accentClass,
  headerColor,
  pinColor,
  label,
  children,
}: {
  repl: ReplitMetrics["repls"][0];
  accentClass: string;
  headerColor: string;
  pinColor: string;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className={`rounded-xl border ${accentClass} p-6 space-y-6`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Pin className={`h-4 w-4 ${pinColor}`} />
          <h2 className={`text-sm font-semibold ${headerColor} uppercase tracking-wider`}>{label}</h2>
          {repl.hasDeployment && (
            <Badge variant="outline" className="text-xs border-emerald-500/30 text-emerald-400">live</Badge>
          )}
        </div>
        {repl.deploymentDomain && (
          <a
            href={`https://${repl.deploymentDomain}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors font-mono"
          >
            {repl.deploymentDomain}
            <ExternalLink className="h-3 w-3" />
          </a>
        )}
      </div>

      <div className="grid grid-cols-3 gap-4">
        {[
          { value: repl.runCount, label: "Total Runs", icon: <Play className="h-3 w-3" /> },
          { value: repl.likeCount, label: "Likes", icon: <Heart className="h-3 w-3" /> },
          { value: repl.forkCount, label: "Forks", icon: <GitFork className="h-3 w-3" /> },
        ].map(({ value, label: lbl, icon }) => (
          <div key={lbl} className="rounded-lg bg-background/50 border border-border px-4 py-3 text-center">
            <p className="text-2xl font-bold tabular-nums">{value.toLocaleString()}</p>
            <p className="text-xs text-muted-foreground mt-1 flex items-center justify-center gap-1">
              {icon} {lbl}
            </p>
          </div>
        ))}
      </div>

      {children}
    </div>
  );
}

type WaitlistTabKey = "all" | "pending" | "activated" | "rejected";
type CityTabKey = "all" | "pending" | "added" | "declined";

export default function Replit() {
  const [projectFilter, setProjectFilter] = useState<"pinned" | "all">("pinned");
  const [waitlistFilter, setWaitlistFilter] = useState<WaitlistTabKey>("all");
  const [cityFilter, setCityFilter] = useState<CityTabKey>("all");

  const { data, error, loading, configured, refetch } = useFetch<ReplitMetrics>(
    "/api/replit/metrics",
    { refreshInterval: 5 * 60_000 },
  );

  const { data: waitlist, refetch: refetchWaitlist } = useFetch<WaitlistData>(
    "/api/revoo/waitlist",
    { refreshInterval: 2 * 60_000 },
  );

  const { data: cityRequests, refetch: refetchCityRequests } = useFetch<CityRequestData>(
    "/api/permitradar/city-requests",
    { refreshInterval: 2 * 60_000 },
  );

  const handleWaitlistStatusUpdate = async (id: number, status: string) => {
    await fetch(`/api/revoo/waitlist/${id}/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    await refetchWaitlist();
  };

  const handleCityStatusUpdate = async (id: number, status: string) => {
    await fetch(`/api/permitradar/city-requests/${id}/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    await refetchCityRequests();
  };

  const pinnedRepls = data?.repls.filter((r) =>
    PINNED_PROJECTS.some((p) => r.title.toLowerCase().includes(p.toLowerCase()))
  ) ?? [];

  const revooRepl = pinnedRepls.find((r) => r.title.toLowerCase().includes("re-voo"));
  const permitradarRepl = pinnedRepls.find((r) => r.title.toLowerCase().includes("permitradar"));

  const displayRepls = projectFilter === "pinned" ? pinnedRepls : (data?.repls ?? []);

  const filteredWaitlist = (waitlist?.entries ?? []).filter((e) =>
    waitlistFilter === "all" ? true : e.status === waitlistFilter
  );

  const filteredCityRequests = (cityRequests?.entries ?? []).filter((e) =>
    cityFilter === "all" ? true : e.status === cityFilter
  );

  return (
    <div className="space-y-8 pb-10">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight mb-2">Replit Projects</h1>
          <p className="text-muted-foreground">
            {data ? `@${data.username} — ${data.totalRepls} repls, ${data.deployedCount} deployed` : "Deployment and usage stats."}
          </p>
        </div>
        {!loading && (
          <Button variant="outline" size="sm" onClick={refetch}>
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
        configNote="Set REPLIT_API_KEY to a Replit API token to enable this integration."
      >
        {data && (
          <>
            {/* Account Metrics */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <MetricCard
                title="New Followers (30d)"
                value={`+${data.newFollowers30d.toLocaleString()}`}
                subtitle="Growth proxy"
                icon={<Users className="h-5 w-5" />}
              />
              <MetricCard
                title="Total Followers"
                value={data.followerCount.toLocaleString()}
                subtitle="Replit followers"
                icon={<Users className="h-5 w-5" />}
              />
              <MetricCard
                title="Total Runs"
                value={data.totalRuns.toLocaleString()}
                subtitle="All-time executions"
                icon={<Play className="h-5 w-5" />}
              />
              <MetricCard
                title="Deployed Projects"
                value={String(data.deployedCount)}
                subtitle={`of ${data.totalRepls} total`}
                icon={<Globe className="h-5 w-5" />}
              />
            </div>

            {/* Re-Voo spotlight */}
            {revooRepl && (
              <SpotlightCard
                repl={revooRepl}
                label="Re-Voo"
                accentClass="border-violet-500/30 bg-violet-500/5"
                headerColor="text-violet-300"
                pinColor="text-violet-400"
              >
                {/* Google Business Waitlist */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Building2 className="h-4 w-4 text-muted-foreground" />
                      <h3 className="text-sm font-semibold text-foreground">Google Business Activation Waitlist</h3>
                    </div>
                    {waitlist && (
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <span className="text-amber-400 font-medium">{waitlist.summary.pending} pending</span>
                        <span>·</span>
                        <span className="text-emerald-400 font-medium">{waitlist.summary.activated} activated</span>
                        <span>·</span>
                        <span>{waitlist.summary.total} total</span>
                      </div>
                    )}
                  </div>

                  <div className="flex gap-1 bg-secondary/30 rounded-lg p-1 w-fit">
                    {(["all", "pending", "activated", "rejected"] as const).map((f) => (
                      <button
                        key={f}
                        onClick={() => setWaitlistFilter(f)}
                        className={`px-3 py-1 rounded text-xs font-medium capitalize transition-colors ${
                          waitlistFilter === f
                            ? "bg-background text-foreground shadow-sm"
                            : "text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        {f}{f !== "all" && waitlist ? ` (${waitlist.summary[f as keyof typeof waitlist.summary]})` : ""}
                      </button>
                    ))}
                  </div>

                  {!waitlist ? (
                    <div className="text-center py-6 text-muted-foreground text-sm">Loading waitlist…</div>
                  ) : filteredWaitlist.length === 0 ? (
                    <div className="rounded-lg border border-dashed border-border p-8 text-center">
                      <Building2 className="h-8 w-8 text-muted-foreground/40 mx-auto mb-2" />
                      <p className="text-sm text-muted-foreground">No {waitlistFilter !== "all" ? waitlistFilter : ""} entries yet.</p>
                      <p className="text-xs text-muted-foreground/60 mt-1">Businesses signed up through Re-Voo appear here.</p>
                    </div>
                  ) : (
                    <div className="rounded-lg border border-border overflow-hidden">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="bg-secondary/30 border-b border-border">
                            <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground uppercase tracking-wider">Business</th>
                            <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground uppercase tracking-wider hidden sm:table-cell">Contact</th>
                            <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground uppercase tracking-wider hidden md:table-cell">Source</th>
                            <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground uppercase tracking-wider">Date</th>
                            <th className="text-right px-4 py-2.5 text-xs font-medium text-muted-foreground uppercase tracking-wider">Status</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                          {filteredWaitlist.map((entry) => (
                            <tr key={entry.id} className="hover:bg-secondary/20 transition-colors">
                              <td className="px-4 py-3">
                                <p className="font-medium text-foreground">{entry.businessName}</p>
                                {entry.googleBusinessUrl && (
                                  <a href={entry.googleBusinessUrl} target="_blank" rel="noopener noreferrer"
                                    className="text-xs text-muted-foreground hover:text-violet-400 transition-colors flex items-center gap-1 mt-0.5">
                                    <ExternalLink className="h-2.5 w-2.5" />View listing
                                  </a>
                                )}
                              </td>
                              <td className="px-4 py-3 hidden sm:table-cell">
                                {entry.contactName && <p className="text-foreground">{entry.contactName}</p>}
                                {entry.email && (
                                  <a href={`mailto:${entry.email}`} className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors">
                                    <Mail className="h-2.5 w-2.5" />{entry.email}
                                  </a>
                                )}
                                {entry.phone && (
                                  <p className="flex items-center gap-1 text-xs text-muted-foreground">
                                    <Phone className="h-2.5 w-2.5" />{entry.phone}
                                  </p>
                                )}
                              </td>
                              <td className="px-4 py-3 hidden md:table-cell">
                                <span className="text-xs text-muted-foreground">{entry.source ?? "—"}</span>
                              </td>
                              <td className="px-4 py-3">
                                <span className="text-xs text-muted-foreground">
                                  {new Date(entry.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                                </span>
                              </td>
                              <td className="px-4 py-3 text-right">
                                <StatusButton entryId={entry.id} current={entry.status}
                                  statuses={WAITLIST_STATUSES} onUpdate={handleWaitlistStatusUpdate} />
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                  <p className="text-xs text-muted-foreground/60">
                    Re-Voo submits entries via <code className="font-mono">POST /api/revoo/waitlist</code> with <code className="font-mono">X-BenAdmin-Token</code> header.
                  </p>
                </div>
              </SpotlightCard>
            )}

            {/* PermitRadar spotlight */}
            {permitradarRepl && (
              <SpotlightCard
                repl={permitradarRepl}
                label="PermitRadar"
                accentClass="border-orange-500/30 bg-orange-500/5"
                headerColor="text-orange-300"
                pinColor="text-orange-400"
              >
                {/* City Requests */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <MapPin className="h-4 w-4 text-muted-foreground" />
                      <h3 className="text-sm font-semibold text-foreground">City Requests</h3>
                      <span className="text-xs text-muted-foreground/60">— "Don't see your city?"</span>
                    </div>
                    {cityRequests && (
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <span className="text-amber-400 font-medium">{cityRequests.summary.pending} pending</span>
                        <span>·</span>
                        <span className="text-emerald-400 font-medium">{cityRequests.summary.added} added</span>
                        <span>·</span>
                        <span>{cityRequests.summary.total} total</span>
                      </div>
                    )}
                  </div>

                  <div className="flex gap-1 bg-secondary/30 rounded-lg p-1 w-fit">
                    {(["all", "pending", "added", "declined"] as const).map((f) => (
                      <button
                        key={f}
                        onClick={() => setCityFilter(f)}
                        className={`px-3 py-1 rounded text-xs font-medium capitalize transition-colors ${
                          cityFilter === f
                            ? "bg-background text-foreground shadow-sm"
                            : "text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        {f}{f !== "all" && cityRequests ? ` (${cityRequests.summary[f as keyof typeof cityRequests.summary]})` : ""}
                      </button>
                    ))}
                  </div>

                  {!cityRequests ? (
                    <div className="text-center py-6 text-muted-foreground text-sm">Loading city requests…</div>
                  ) : filteredCityRequests.length === 0 ? (
                    <div className="rounded-lg border border-dashed border-border p-8 text-center">
                      <MapPin className="h-8 w-8 text-muted-foreground/40 mx-auto mb-2" />
                      <p className="text-sm text-muted-foreground">No {cityFilter !== "all" ? cityFilter : ""} city requests yet.</p>
                      <p className="text-xs text-muted-foreground/60 mt-1">
                        Requests submitted via the "Don't see your city?" form appear here.
                      </p>
                    </div>
                  ) : (
                    <div className="rounded-lg border border-border overflow-hidden">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="bg-secondary/30 border-b border-border">
                            <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground uppercase tracking-wider">City</th>
                            <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground uppercase tracking-wider hidden sm:table-cell">Contact</th>
                            <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground uppercase tracking-wider hidden md:table-cell">Reason</th>
                            <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground uppercase tracking-wider">Date</th>
                            <th className="text-right px-4 py-2.5 text-xs font-medium text-muted-foreground uppercase tracking-wider">Status</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                          {filteredCityRequests.map((entry) => (
                            <tr key={entry.id} className="hover:bg-secondary/20 transition-colors">
                              <td className="px-4 py-3">
                                <p className="font-medium text-foreground">{entry.cityName}</p>
                                {(entry.state || entry.country) && (
                                  <p className="text-xs text-muted-foreground">
                                    {[entry.state, entry.country].filter(Boolean).join(", ")}
                                  </p>
                                )}
                              </td>
                              <td className="px-4 py-3 hidden sm:table-cell">
                                {entry.contactName && <p className="text-foreground">{entry.contactName}</p>}
                                {entry.email && (
                                  <a href={`mailto:${entry.email}`} className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors">
                                    <Mail className="h-2.5 w-2.5" />{entry.email}
                                  </a>
                                )}
                              </td>
                              <td className="px-4 py-3 hidden md:table-cell">
                                <span className="text-xs text-muted-foreground line-clamp-2">{entry.reason ?? "—"}</span>
                              </td>
                              <td className="px-4 py-3">
                                <span className="text-xs text-muted-foreground">
                                  {new Date(entry.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                                </span>
                              </td>
                              <td className="px-4 py-3 text-right">
                                <StatusButton entryId={entry.id} current={entry.status}
                                  statuses={CITY_STATUSES} onUpdate={handleCityStatusUpdate} />
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                  <p className="text-xs text-muted-foreground/60">
                    PermitRadar submits requests via <code className="font-mono">POST /api/permitradar/city-requests</code> with <code className="font-mono">X-BenAdmin-Token</code> header.
                  </p>
                </div>
              </SpotlightCard>
            )}

            {/* Projects list with Pinned / All filter */}
            <div className="rounded-xl border border-border bg-card">
              <div className="p-4 border-b border-border flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Server className="h-4 w-4 text-muted-foreground" />
                  <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Projects</h2>
                </div>
                <div className="flex gap-1 bg-secondary/30 rounded-lg p-1">
                  <button
                    onClick={() => setProjectFilter("pinned")}
                    className={`flex items-center gap-1.5 px-3 py-1 rounded text-xs font-medium transition-colors ${
                      projectFilter === "pinned"
                        ? "bg-background text-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    <Pin className="h-3 w-3" />
                    Pinned ({pinnedRepls.length})
                  </button>
                  <button
                    onClick={() => setProjectFilter("all")}
                    className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
                      projectFilter === "all"
                        ? "bg-background text-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    All ({data.totalRepls})
                  </button>
                </div>
              </div>
              <div className="divide-y divide-border">
                {displayRepls.length === 0 ? (
                  <div className="px-6 py-8 text-center text-muted-foreground text-sm">
                    {projectFilter === "pinned"
                      ? "None of your pinned projects were found. Titles to match: " + PINNED_PROJECTS.join(", ")
                      : "No repls found."}
                  </div>
                ) : (
                  displayRepls.map((repl) => {
                    const isPinned = PINNED_PROJECTS.some((p) =>
                      repl.title.toLowerCase().includes(p.toLowerCase())
                    );
                    return (
                      <div key={repl.id} className="px-6 py-3 flex items-center justify-between hover:bg-secondary/30 transition-colors">
                        <div className="flex items-center gap-3 min-w-0">
                          {isPinned ? (
                            <Pin className="h-3.5 w-3.5 text-violet-400 flex-shrink-0" />
                          ) : repl.isPrivate ? (
                            <Lock className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                          ) : (
                            <Globe className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                          )}
                          <div className="min-w-0">
                            <p className={`text-sm font-medium truncate ${isPinned ? "text-violet-300" : "text-foreground"}`}>
                              {repl.title}
                            </p>
                            {repl.deploymentDomain && (
                              <p className="text-xs text-muted-foreground font-mono truncate">{repl.deploymentDomain}</p>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-4 flex-shrink-0 ml-4">
                          {repl.runCount > 0 && (
                            <span className="text-xs text-muted-foreground flex items-center gap-1">
                              <Play className="h-3 w-3" />{repl.runCount.toLocaleString()}
                            </span>
                          )}
                          {repl.forkCount > 0 && (
                            <span className="text-xs text-muted-foreground flex items-center gap-1">
                              <GitFork className="h-3 w-3" />{repl.forkCount}
                            </span>
                          )}
                          {repl.likeCount > 0 && (
                            <span className="text-xs text-muted-foreground flex items-center gap-1">
                              <Heart className="h-3 w-3" />{repl.likeCount}
                            </span>
                          )}
                          {repl.hasDeployment && (
                            <Badge variant="outline" className="text-xs border-emerald-500/30 text-emerald-500">deployed</Badge>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Badge variant="outline" className="text-xs">Auto-refreshes every 5 min</Badge>
            </div>
          </>
        )}
      </DataSection>
    </div>
  );
}
