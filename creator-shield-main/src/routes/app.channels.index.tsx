import { createFileRoute, Link } from "@tanstack/react-router";
import { SeverityBadge } from "@/components/dashboard/SeverityBadge";
import { Panel } from "@/components/dashboard/Panel";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAuth } from "@/hooks/useAuth";
import { Search, Loader2 } from "lucide-react";
import { useState } from "react";

export const Route = createFileRoute("/app/channels/")({
  component: ChannelsPage,
});

function ChannelsPage() {
  const { org } = useAuth();
  const orgId = org?.id || "";
  const [filterText, setFilterText] = useState("");

  // Queries
  const { data: channelsData, isLoading: isChannelsLoading } = useQuery({
    queryKey: ["channels", orgId],
    queryFn: () => api.getChannels(orgId),
    enabled: !!orgId,
  });

  const { data: fleetList, isLoading: isFleetLoading } = useQuery({
    queryKey: ["dashboardFleet", orgId],
    queryFn: () => api.getDashboardFleet(orgId),
    enabled: !!orgId,
  });

  const isLoading = isChannelsLoading || isFleetLoading;

  if (!orgId) {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <p className="text-muted-foreground text-sm">No active organization selected. Please log in again.</p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex h-[50vh] items-center justify-center gap-2">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
        <span className="text-sm text-muted-foreground">Loading channel fleet...</span>
      </div>
    );
  }

  const channels = channelsData?.channels || [];
  const fleet = fleetList || [];

  // Merge channel metadata with health metrics
  const mergedChannels = channels.map((c: any) => {
    const healthInfo = fleet.find((f: any) => f.channel_id === c.id);
    const averageRisk = healthInfo?.average_risk_score ?? 0;
    const health = Math.max(100 - averageRisk, 0);
    const risk = averageRisk > 75 ? "high" : averageRisk > 35 ? "medium" : "low";
    const flagged = healthInfo?.flagged_videos ?? 0;
    const totalVideos = healthInfo?.total_videos ?? c.video_count;

    return {
      id: c.id,
      name: c.title || "Unnamed Channel",
      handle: c.custom_url || `@${c.youtube_channel_id.substring(0, 8)}`,
      subs: (c.subscriber_count ?? 0).toLocaleString(),
      health: Math.round(health),
      risk: c.status === "SYNCING" ? "processing" : risk,
      originality: c.status === "SYNCING" ? "—" : (100 - averageRisk * 0.8).toFixed(0),
      uploads: totalVideos,
      monetization: c.status === "SYNCING" ? "queued" : (flagged > 0 ? "at risk" : "safe"),
      status: c.status,
    };
  });

  // Filter channels based on search
  const filteredChannels = mergedChannels.filter((c: any) =>
    c.name.toLowerCase().includes(filterText.toLowerCase()) ||
    c.handle.toLowerCase().includes(filterText.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <Panel title="Monitored channels" subtitle={`${filteredChannels.length} channels showing active syncs`}
        action={
          <div className="flex items-center gap-2 rounded-md border bg-background/60 px-2.5 py-1.5">
            <Search className="h-3.5 w-3.5 text-muted-foreground" />
            <input
              placeholder="Filter channels"
              value={filterText}
              onChange={(e) => setFilterText(e.target.value)}
              className="bg-transparent text-xs outline-none w-40 text-foreground"
            />
          </div>
        }>
        <div className="-mx-5 overflow-x-auto">
          {filteredChannels.length > 0 ? (
            <table className="w-full text-sm">
              <thead className="text-left text-[11px] uppercase tracking-wider text-muted-foreground">
                <tr className="border-b">
                  <th className="px-5 py-2 font-medium">Channel</th>
                  <th className="px-3 py-2 font-medium">Subs</th>
                  <th className="px-3 py-2 font-medium">Health</th>
                  <th className="px-3 py-2 font-medium">Risk</th>
                  <th className="px-3 py-2 font-medium">Originality</th>
                  <th className="px-3 py-2 font-medium">Videos Indexed</th>
                  <th className="px-5 py-2 font-medium text-right">Monetization Safety</th>
                </tr>
              </thead>
              <tbody>
                {filteredChannels.map((c: any) => (
                  <tr key={c.id} className="border-b last:border-0 hover:bg-accent/40">
                    <td className="px-5 py-3">
                      <Link to="/app/channels/$id" params={{ id: c.id }} className="hover:text-primary">
                        <div className="font-medium text-foreground">{c.name}</div>
                        <div className="text-[11px] text-muted-foreground">{c.handle}</div>
                      </Link>
                    </td>
                    <td className="px-3 py-3 text-muted-foreground tabular-nums">{c.subs}</td>
                    <td className="px-3 py-3">
                      {c.status === "SYNCING" ? (
                        <div className="flex items-center gap-1.5 text-xs text-primary animate-pulse">
                          <Loader2 className="h-3 w-3 animate-spin" />
                          <span>Scanning... (up to 1 min)</span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          <div className="h-1.5 w-20 overflow-hidden rounded-full bg-muted">
                            <div className={`h-full rounded-full ${c.health > 80 ? "bg-success" : c.health > 65 ? "bg-warning" : "bg-destructive"}`} style={{ width: `${c.health}%` }} />
                          </div>
                          <span className="tabular-nums text-xs text-foreground">{c.health}%</span>
                        </div>
                      )}
                    </td>
                    <td className="px-3 py-3"><SeverityBadge level={c.risk} /></td>
                    <td className="px-3 py-3 tabular-nums text-foreground">
                      {c.status === "SYNCING" ? (
                        <span className="text-muted-foreground">—</span>
                      ) : (
                        `${c.originality}%`
                      )}
                    </td>
                    <td className="px-3 py-3 tabular-nums text-muted-foreground">{c.uploads}</td>
                    <td className="px-5 py-3 text-right"><SeverityBadge level={c.monetization} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="py-8 text-center text-xs text-muted-foreground">No channels match the filter criteria.</div>
          )}
        </div>
      </Panel>
    </div>
  );
}
