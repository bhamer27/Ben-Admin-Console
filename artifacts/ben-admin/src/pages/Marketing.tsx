import { Megaphone, RefreshCw, Search, MousePointerClick, Mail, BarChart2, DollarSign } from "lucide-react";
import { MetricCard } from "@/components/MetricCard";
import { DataSection } from "@/components/DataSection";
import { useFetch } from "@/lib/useFetch";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

interface SearchConsoleData {
  clicks: number;
  impressions: number;
  avgCtr: number;
  avgPosition: number;
}

interface GoogleAdsData {
  spend: number;
  conversions: number;
  impressions: number;
  clicks: number;
}

interface InstantlyData {
  activeCampaigns: number;
  totalCampaigns: number;
  emailsSent30d: number;
  openRate: number;
  replyRate: number;
  campaigns: { id: string; name: string; status: number }[];
}

function fmtMoney(val: number): string {
  return `$${val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function fmtPct(val: number): string {
  return `${(val * 100).toFixed(1)}%`;
}

function fmtNum(val: number): string {
  return val.toLocaleString();
}

export default function Marketing() {
  const searchConsole = useFetch<SearchConsoleData>("/api/marketing/search-console", { refreshInterval: 10 * 60_000 });
  const googleAds = useFetch<GoogleAdsData>("/api/marketing/google-ads", { refreshInterval: 10 * 60_000 });
  const instantly = useFetch<InstantlyData>("/api/marketing/instantly", { refreshInterval: 10 * 60_000 });

  function refreshAll() {
    searchConsole.refetch();
    googleAds.refetch();
    instantly.refetch();
  }

  const anyLoading = searchConsole.loading || googleAds.loading || instantly.loading;

  return (
    <div className="space-y-6 pb-10">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight mb-1.5">Marketing</h1>
          <p className="text-muted-foreground text-sm sm:text-base">Performance data from Search Console, Google Ads, and Instantly.ai.</p>
        </div>
        {!anyLoading && (
          <Button variant="outline" size="sm" onClick={refreshAll} className="flex-shrink-0">
            <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
            Refresh
          </Button>
        )}
      </div>

      <Tabs defaultValue="instantly">
        <div className="overflow-x-auto -mx-1 px-1 mb-6">
          <TabsList className="whitespace-nowrap">
            <TabsTrigger value="instantly" className="gap-1.5">
              <Mail className="h-3.5 w-3.5" />
              <span>Instantly</span>
            </TabsTrigger>
            <TabsTrigger value="search-console" className="gap-1.5">
              <Search className="h-3.5 w-3.5" />
              <span>Search Console</span>
            </TabsTrigger>
            <TabsTrigger value="google-ads" className="gap-1.5">
              <DollarSign className="h-3.5 w-3.5" />
              <span>Google Ads</span>
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="search-console">
          <DataSection
            loading={searchConsole.loading}
            error={searchConsole.error}
            configured={searchConsole.configured}
            onRefresh={searchConsole.refetch}
            configNote="Set GOOGLE_ACCESS_TOKEN and GOOGLE_SEARCH_CONSOLE_SITE_URL to enable Search Console metrics."
          >
            {searchConsole.data && (
              <>
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
                  <MetricCard
                    title="Total Clicks"
                    value={fmtNum(searchConsole.data.clicks)}
                    subtitle="Last 30 days"
                    icon={<MousePointerClick className="h-5 w-5" />}
                  />
                  <MetricCard
                    title="Impressions"
                    value={fmtNum(searchConsole.data.impressions)}
                    subtitle="Last 30 days"
                    icon={<Search className="h-5 w-5" />}
                  />
                  <MetricCard
                    title="Avg CTR"
                    value={fmtPct(searchConsole.data.avgCtr)}
                    subtitle="Click-through rate"
                    icon={<BarChart2 className="h-5 w-5" />}
                  />
                  <MetricCard
                    title="Avg Position"
                    value={searchConsole.data.avgPosition.toFixed(1)}
                    subtitle="Average ranking"
                    icon={<Megaphone className="h-5 w-5" />}
                  />
                </div>
                <Badge variant="outline" className="text-xs">Auto-refreshes every 10 min</Badge>
              </>
            )}
          </DataSection>
        </TabsContent>

        <TabsContent value="google-ads">
          <DataSection
            loading={googleAds.loading}
            error={googleAds.error}
            configured={googleAds.configured}
            onRefresh={googleAds.refetch}
            configNote="Set GOOGLE_ACCESS_TOKEN, GOOGLE_ADS_CUSTOMER_ID, and GOOGLE_ADS_DEVELOPER_TOKEN to enable Google Ads metrics."
          >
            {googleAds.data && (
              <>
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
                  <MetricCard
                    title="Ad Spend"
                    value={fmtMoney(googleAds.data.spend)}
                    subtitle="Last 30 days"
                    icon={<DollarSign className="h-5 w-5" />}
                  />
                  <MetricCard
                    title="Conversions"
                    value={fmtNum(googleAds.data.conversions)}
                    subtitle="Last 30 days"
                    icon={<BarChart2 className="h-5 w-5" />}
                  />
                  <MetricCard
                    title="Impressions"
                    value={fmtNum(googleAds.data.impressions)}
                    subtitle="Last 30 days"
                    icon={<Search className="h-5 w-5" />}
                  />
                  <MetricCard
                    title="Clicks"
                    value={fmtNum(googleAds.data.clicks)}
                    subtitle="Last 30 days"
                    icon={<MousePointerClick className="h-5 w-5" />}
                  />
                </div>
                <Badge variant="outline" className="text-xs">Auto-refreshes every 10 min</Badge>
              </>
            )}
          </DataSection>
        </TabsContent>

        <TabsContent value="instantly">
          <DataSection
            loading={instantly.loading}
            error={instantly.error}
            configured={instantly.configured}
            onRefresh={instantly.refetch}
            configNote="Set INSTANTLY_API_KEY to enable Instantly.ai campaign metrics."
          >
            {instantly.data && (
              <>
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
                  <MetricCard
                    title="Active"
                    value={String(instantly.data.activeCampaigns)}
                    subtitle={`of ${instantly.data.totalCampaigns} campaigns`}
                    icon={<Megaphone className="h-5 w-5" />}
                  />
                  <MetricCard
                    title="Emails Sent"
                    value={fmtNum(instantly.data.emailsSent30d)}
                    subtitle="Last 30 days"
                    icon={<Mail className="h-5 w-5" />}
                  />
                  <MetricCard
                    title="Open Rate"
                    value={fmtPct(instantly.data.openRate)}
                    subtitle="Avg across campaigns"
                    icon={<BarChart2 className="h-5 w-5" />}
                  />
                  <MetricCard
                    title="Reply Rate"
                    value={fmtPct(instantly.data.replyRate)}
                    subtitle="Avg across campaigns"
                    icon={<MousePointerClick className="h-5 w-5" />}
                  />
                </div>

                {instantly.data.campaigns.length > 0 && (
                  <div className="rounded-xl border border-border bg-card">
                    <div className="p-4 sm:p-5 border-b border-border">
                      <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Campaigns</h2>
                    </div>
                    <div className="divide-y divide-border">
                      {instantly.data.campaigns.map((c) => (
                        <div key={c.id} className="px-4 sm:px-5 py-3 flex items-center justify-between gap-3 hover:bg-secondary/30 transition-colors">
                          <p className="text-sm font-medium truncate">{c.name}</p>
                          <Badge
                            variant="outline"
                            className={cn(c.status === 1 ? "border-emerald-500/30 text-emerald-500 text-xs" : "text-xs", "flex-shrink-0")}
                          >
                            {c.status === 1 ? "active" : "paused"}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <Badge variant="outline" className="text-xs">Auto-refreshes every 10 min</Badge>
              </>
            )}
          </DataSection>
        </TabsContent>
      </Tabs>
    </div>
  );
}
