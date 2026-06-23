import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { Panel } from "@/components/dashboard/Panel";
import { KpiCard } from "@/components/dashboard/KpiCard";
import { SeverityBadge } from "@/components/dashboard/SeverityBadge";
import { ChartFrame } from "@/components/charts/ChartFrame";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAuth } from "@/hooks/useAuth";
import { Area, AreaChart, CartesianGrid, Line, LineChart, PolarAngleAxis, PolarGrid, Radar, RadarChart, Tooltip, XAxis, YAxis } from "recharts";
import { ArrowLeft, Loader2, Play, Film, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { useState } from "react";
import { InteractiveVideoModal } from "@/components/dashboard/InteractiveVideoModal";

export const Route = createFileRoute("/app/channels/$id")({
  component: ChannelDetail,
  notFoundComponent: () => (
    <div className="flex h-[50vh] flex-col items-center justify-center gap-2">
      <p className="text-muted-foreground text-sm">Channel not found.</p>
      <Link to="/app/channels" className="text-sm text-primary hover:underline">Back to channels</Link>
    </div>
  ),
});

const tooltip = {
  contentStyle: { background: "oklch(0.20 0.014 250)", border: "1px solid oklch(0.28 0.014 250)", borderRadius: 8, fontSize: 12 },
};

function ChannelDetail() {
  const { id } = Route.useParams();
  const { org } = useAuth();
  const orgId = org?.id || "";
  const queryClient = useQueryClient();
  const [selectedVideoId, setSelectedVideoId] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [visualAnalysisText, setVisualAnalysisText] = useState<Record<string, string>>({
    compliance: "Hover over the chart to inspect daily compliance indexes and policy risk levels. High risk flags indicate demonetization hazards.",
    radar: "Hover over the radar axes to analyze your footprint across vectors: Metadata, Visual, Acoustic, Repetition, and Velocity.",
    redundancy: "Hover over the points to analyze script overlap. Ratios above 70% indicate duplicate storytelling templates."
  });

  // Queries
  const { data: channel, isLoading: isChannelLoading, error: channelError } = useQuery({
    queryKey: ["channelDetail", id],
    queryFn: () => api.getChannelDetail(id),
    enabled: !!id,
  });

  const { data: videosData, isLoading: isVideosLoading } = useQuery({
    queryKey: ["channelVideos", id],
    queryFn: () => api.getChannelVideos(id),
    enabled: !!id,
  });

  const { data: auditResults, isLoading: isAuditLoading } = useQuery({
    queryKey: ["auditResults", orgId],
    queryFn: () => api.getAuditResults(orgId),
    enabled: !!orgId,
  });

  const { data: health, isLoading: isHealthLoading } = useQuery({
    queryKey: ["channelHealth", orgId, id],
    queryFn: async () => {
      // Inline fetch as we didn't declare it explicitly in api.ts
      const token = localStorage.getItem("cs_token");
      const res = await fetch(`http://localhost:8000/api/dashboard/${orgId}/channel/${id}/health`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) throw new Error("Failed to fetch channel health");
      return res.json();
    },
    enabled: !!orgId && !!id,
  });

  const { data: remediation, isLoading: isRemediationLoading } = useQuery({
    queryKey: ["channelRemediation", orgId, id],
    queryFn: () => api.getChannelRemediation(orgId, id),
    enabled: !!orgId && !!id,
  });



  const isLoading = isChannelLoading; // Only wait for the primary channel fetch

  if (channelError) {
    throw notFound();
  }

  if (isLoading) {
    return (
      <div className="flex h-[50vh] items-center justify-center gap-2">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
        <span className="text-sm text-muted-foreground">Loading channel intelligence metrics...</span>
      </div>
    );
  }

  if (!channel) {
    throw notFound();
  }

  const averageRisk = health?.average_risk_score ?? 0;
  const healthScore = Math.max(100 - averageRisk, 0);
  const riskLevel = averageRisk > 75 ? "high" : averageRisk > 35 ? "medium" : "low";

  const videoList = Array.isArray(videosData) ? videosData : (videosData?.videos || []);
  const totalVideos = health?.total_videos ?? channel.video_count;

  // Signal breakdown
  const auditCoverage = health?.audit_coverage || {};
  const radarData = Object.entries(auditCoverage).length > 0
    ? Object.entries(auditCoverage).map(([metric, count]) => ({
        metric: metric.replace(/_/g, " "),
        A: (count as number) * 20, // Scale factor for presentation
      }))
    : [
        { metric: "SCRIPT SIMILARITY", A: 0 },
        { metric: "VISUAL SIMILARITY", A: 0 },
        { metric: "ASSET REUSE", A: 0 },
        { metric: "VOICE FORENSIC", A: 0 },
        { metric: "VELOCITY ANOMALY", A: 0 },
      ];

  // Build compliance trend from real audit results for this channel's videos
  const videoIds = new Set(videoList.map((v: any) => v.id));
  const channelAudits = (auditResults || []).filter((r: any) => videoIds.has(r.video_id));

  const getVideoRisk = (videoId: string) => {
    const vAudits = channelAudits.filter((a: any) => a.video_id === videoId);
    if (vAudits.length === 0) return 0;
    return Math.max(...vAudits.map((a: any) => a.risk_score));
  };

  const complianceSeries = (() => {
    if (channelAudits.length === 0) {
      // Flat line at current health score — no audit history yet
      return [
        { day: "W-4", score: healthScore },
        { day: "W-3", score: healthScore },
        { day: "W-2", score: healthScore },
        { day: "Today", score: healthScore },
      ];
    }
    const sorted = [...channelAudits].sort(
      (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    );
    return sorted.slice(-6).map((r: any) => ({
      day: new Date(r.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
      score: Math.round(100 - r.risk_score),
    }));
  })();

  // Semantic redundancy from SCRIPT_SIMILARITY audits on this channel's videos
  const semanticRedundancy = (() => {
    const scriptAudits = channelAudits.filter(
      (r: any) => r.audit_type === "SCRIPT_SIMILARITY" || r.audit_type === "script_similarity"
    );
    if (scriptAudits.length === 0) {
      return [
        { week: "W1", redundancy: 0 },
        { week: "W2", redundancy: 0 },
        { week: "W3", redundancy: 0 },
        { week: "W4", redundancy: 0 },
      ];
    }
    const sorted = [...scriptAudits].sort(
      (a: any, b: any) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    );
    return sorted.slice(-4).map((r: any, idx: number) => ({
      week: `W${idx + 1}`,
      redundancy: Math.round(r.risk_score),
    }));
  })();

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link to="/app/channels" className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-3.5 w-3.5" /> Back to Channels
        </Link>
      </div>

      <div className="flex flex-wrap items-end justify-between gap-4 rounded-xl border bg-card p-5 hairline">
        <div className="flex items-center gap-4">
          {channel.thumbnail_url ? (
            <img src={channel.thumbnail_url} alt={channel.title} className="h-14 w-14 rounded-full object-cover ring-2 ring-primary bg-muted" />
          ) : (
            <div className="grid h-14 w-14 place-items-center rounded-full bg-gradient-to-br from-secondary to-primary text-lg font-semibold text-primary-foreground">
              {channel.title.slice(0, 1).toUpperCase()}
            </div>
          )}
          <div>
            <h2 className="text-xl font-semibold tracking-tight text-foreground">{channel.title}</h2>
            <div className="text-xs text-muted-foreground">
              {channel.custom_url} · {(channel.subscriber_count ?? 0).toLocaleString()} subscribers · {totalVideos} uploads indexed
            </div>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <SeverityBadge level={riskLevel} />
          <SeverityBadge level={channel.status} />

        </div>
      </div>

      {channel.status === "SYNCING" && (
        <div className="flex items-center gap-3 rounded-xl border border-primary/25 bg-primary/5 p-4 hairline animate-pulse">
          <Loader2 className="h-4 w-4 animate-spin text-primary shrink-0" />
          <div className="text-xs">
            <span className="font-semibold text-foreground">Compliance scan in progress...</span>{" "}
            <span className="text-muted-foreground">We are indexing your upload history, extracting audio-visual fingerprints, and running policy compliance audits. This process can take up to a minute. Recommended remediations will generate shortly.</span>
          </div>
        </div>
      )}

      <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {(() => {
          const isScanning = channel.status === "SYNCING" || isHealthLoading;
          return (
            <>
              <KpiCard 
                label="Monetization Stability" 
                value={isScanning ? "Scanning..." : (health?.monetization_stability ?? healthScore).toFixed(0)} 
                unit={isScanning ? "" : "/100"} 
                delta={2} 
                trend="up" 
                tone={isScanning ? "neutral" : ((health?.monetization_stability ?? healthScore) > 80 ? "success" : "warning")} 
              />
              <KpiCard 
                label="Originality Score" 
                value={isScanning ? "Scanning..." : (health?.originality_score ?? 100).toFixed(0)} 
                unit={isScanning ? "" : "/100"} 
                delta={1} 
                trend="up" 
                tone={isScanning ? "neutral" : ((health?.originality_score ?? 100) > 80 ? "success" : "warning")} 
              />
              <KpiCard 
                label="Human Value Index" 
                value={isScanning ? "Scanning..." : (health?.human_value_index ?? 100).toFixed(0)} 
                unit={isScanning ? "" : "/100"} 
                delta={3} 
                trend="up" 
                tone={isScanning ? "neutral" : ((health?.human_value_index ?? 100) > 80 ? "success" : "warning")} 
              />
              <KpiCard 
                label="Upload Readiness" 
                value={isScanning ? "Scanning..." : (health?.upload_readiness ?? Math.max(0, ((health?.monetization_stability ?? healthScore) + (health?.originality_score ?? 100) + (health?.human_value_index ?? 100)) / 3)).toFixed(0)} 
                unit={isScanning ? "" : "/100"} 
                delta={2} 
                trend="up" 
                tone={isScanning ? "neutral" : ((health?.upload_readiness ?? 80) > 80 ? "success" : "warning")} 
              />
            </>
          );
        })()}
      </section>

      <section className="grid gap-4 lg:grid-cols-3">
        <Panel className="lg:col-span-2" title="Compliance trend" subtitle="History of indexing scores">
          <ChartFrame height={260}>
            <AreaChart 
              data={complianceSeries} 
              margin={{ left: -16 }}
              onMouseMove={(state) => {
                if (state && state.activePayload && state.activePayload.length > 0) {
                  const data = state.activePayload[0].payload;
                  setVisualAnalysisText(prev => ({
                    ...prev,
                    compliance: `On ${data.day}, the compliance score was ${data.score}/100. ${
                      data.score < 60
                        ? "🚨 High risk: Substantial inauthentic or synthetic footprints detected."
                        : data.score < 85
                        ? "⚠️ Medium risk: Moderate duplication or automation flags present."
                        : "✅ Healthy: Content is highly original and meets platform monetization requirements."
                    }`
                  }));
                }
              }}
              onMouseLeave={() => {
                setVisualAnalysisText(prev => ({
                  ...prev,
                  compliance: "Hover over the chart to inspect daily compliance indexes and policy risk levels. High risk flags indicate demonetization hazards."
                }));
              }}
            >
              <defs>
                <linearGradient id="cg" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="oklch(0.82 0.16 210)" stopOpacity={0.5}/>
                  <stop offset="100%" stopColor="oklch(0.82 0.16 210)" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid stroke="oklch(0.28 0.014 250)" vertical={false} strokeDasharray="3 3" />
              <XAxis dataKey="day" tick={{ fill: "oklch(0.66 0.018 250)", fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: "oklch(0.66 0.018 250)", fontSize: 11 }} axisLine={false} tickLine={false} />
              <Tooltip {...tooltip} />
              <Area type="monotone" dataKey="score" stroke="oklch(0.82 0.16 210)" strokeWidth={2} fill="url(#cg)" />
            </AreaChart>
          </ChartFrame>
          <div className="mt-4 rounded-lg border bg-muted/20 p-3 text-xs text-muted-foreground italic hairline flex items-start gap-2 min-h-[50px] transition-all">
            <Sparkles className="h-4.5 w-4.5 text-primary shrink-0 mt-0.5" />
            <div>
              <span className="font-semibold text-foreground not-italic">Text Analysis:</span>{" "}
              {visualAnalysisText.compliance}
            </div>
          </div>
        </Panel>

        <Panel title="Scan coverage profile" subtitle="Audit counts per type">
          <ChartFrame height={260}>
            <RadarChart 
              data={radarData} 
              outerRadius={90}
              onMouseMove={(state) => {
                if (state && state.activeTooltipIndex !== undefined) {
                  const data = radarData[state.activeTooltipIndex];
                  if (data) {
                    const cleanMetric = data.metric.toUpperCase();
                    setVisualAnalysisText(prev => ({
                      ...prev,
                      radar: `${data.metric} diagnostic level is at ${data.A}%. ${
                        cleanMetric.includes("VOICE")
                          ? "Voice forensic scans check for deepfake speech probability, vocoder phase alignment, and breath pattern anomalies."
                          : cleanMetric.includes("VISUAL")
                          ? "Visual similarity scans track recurring video segments, B-roll templates, and spatial-temporal anomalies."
                          : cleanMetric.includes("SCRIPT")
                          ? "Script similarity checks cross-examine voiceover transcripts against your entire multi-channel library."
                          : cleanMetric.includes("VELOCITY")
                          ? "Velocity anomaly scans flag rapid upload frequencies that trigger platform automated spam filters."
                          : "Asset reuse monitoring checks for reused templates and low-effort compilation signatures."
                      }`
                    }));
                  }
                }
              }}
              onMouseLeave={() => {
                setVisualAnalysisText(prev => ({
                  ...prev,
                  radar: "Hover over the radar axes to analyze your footprint across vectors: Metadata, Visual, Acoustic, Repetition, and Velocity."
                }));
              }}
            >
              <PolarGrid stroke="oklch(0.28 0.014 250)" />
              <PolarAngleAxis dataKey="metric" tick={{ fill: "oklch(0.66 0.018 250)", fontSize: 10 }} />
              <Radar dataKey="A" stroke="oklch(0.82 0.16 210)" fill="oklch(0.82 0.16 210)" fillOpacity={0.25} />
            </RadarChart>
          </ChartFrame>
          <div className="mt-4 rounded-lg border bg-muted/20 p-3 text-xs text-muted-foreground italic hairline flex items-start gap-2 min-h-[50px] transition-all">
            <Sparkles className="h-4.5 w-4.5 text-primary shrink-0 mt-0.5" />
            <div>
              <span className="font-semibold text-foreground not-italic">Text Analysis:</span>{" "}
              {visualAnalysisText.radar}
            </div>
          </div>
        </Panel>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <Panel title="Indexed Videos Catalog" subtitle="Recent uploads in database">
          <div className="max-h-80 overflow-y-auto space-y-2 pr-2">
            {(channel.status === "SYNCING" && videoList.length === 0) || isVideosLoading ? (
              <div className="flex flex-col items-center justify-center py-8 text-center text-muted-foreground gap-2">
                <Loader2 className="h-5 w-5 animate-spin text-primary" />
                <p className="text-xs">Indexing channel videos. Forensic analyses are being queued (takes up to a minute)...</p>
              </div>
            ) : videoList.length > 0 ? (
              videoList.map((v: any) => (
                <div 
                  key={v.id} 
                  onClick={() => {
                    setSelectedVideoId(v.id);
                    setIsModalOpen(true);
                  }}
                  className="flex items-center justify-between p-2.5 rounded-lg border bg-background/40 hover:bg-accent/20 hover:border-primary/30 transition-all cursor-pointer group gap-4"
                >
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    {v.thumbnail_url ? (
                      <div className="relative shrink-0 h-10 w-16 rounded overflow-hidden border border-border/40 bg-muted">
                        <img src={v.thumbnail_url} alt="" className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                        <div className="absolute inset-0 bg-black/25 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                          <Play className="h-3.5 w-3.5 fill-current text-white" />
                        </div>
                      </div>
                    ) : (
                      <div className="h-10 w-16 rounded border bg-muted flex items-center justify-center text-muted-foreground shrink-0">
                        <Film className="h-4 w-4" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="truncate text-xs font-semibold text-foreground group-hover:text-primary transition-colors">{v.title}</div>
                      <div className="text-[10px] text-muted-foreground mt-0.5">
                        Status: {v.status} · Published {v.published_at ? new Date(v.published_at).toLocaleDateString() : "Pending sync"}
                      </div>
                    </div>
                  </div>
                  <div className="shrink-0 flex flex-col items-end gap-1">
                    <span className="text-[11px] font-bold text-destructive">{getVideoRisk(v.id).toFixed(0)}% Risk</span>
                    <SeverityBadge level={getVideoRisk(v.id) >= 80 ? "critical" : getVideoRisk(v.id) >= 60 ? "high" : getVideoRisk(v.id) >= 40 ? "watch" : "stable"} />
                  </div>
                </div>
              ))
            ) : (
              <div className="py-8 text-center text-xs text-muted-foreground">No videos indexed for this channel.</div>
            )}
          </div>
        </Panel>

        <Panel title="Transcript duplication" subtitle="Weekly redundancy %">
          <ChartFrame height={220}>
            <LineChart 
              data={semanticRedundancy} 
              margin={{ left: -16 }}
              onMouseMove={(state) => {
                if (state && state.activePayload && state.activePayload.length > 0) {
                  const data = state.activePayload[0].payload;
                  setVisualAnalysisText(prev => ({
                    ...prev,
                    redundancy: `During ${data.week}, the transcript semantic redundancy was ${data.redundancy}%. ${
                      data.redundancy > 70
                        ? "🚨 Critical duplicate footprint: Multiple video transcripts show near-identical templates."
                        : data.redundancy > 40
                        ? "⚠️ Elevated template reuse: We advise introducing more narrative variation."
                        : "✅ Low transcript overlap: Excellent semantic variance and original scripting."
                    }`
                  }));
                }
              }}
              onMouseLeave={() => {
                setVisualAnalysisText(prev => ({
                  ...prev,
                  redundancy: "Hover over the points to analyze script overlap. Ratios above 70% indicate duplicate storytelling templates."
                }));
              }}
            >
              <CartesianGrid stroke="oklch(0.28 0.014 250)" strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="week" tick={{ fill: "oklch(0.66 0.018 250)", fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: "oklch(0.66 0.018 250)", fontSize: 11 }} axisLine={false} tickLine={false} />
              <Tooltip {...tooltip} />
              <Line type="monotone" dataKey="redundancy" stroke="oklch(0.82 0.16 210)" strokeWidth={2} dot={{ r: 2 }} />
            </LineChart>
          </ChartFrame>
          <div className="mt-4 rounded-lg border bg-muted/20 p-3 text-xs text-muted-foreground italic hairline flex items-start gap-2 min-h-[50px] transition-all">
            <Sparkles className="h-4.5 w-4.5 text-primary shrink-0 mt-0.5" />
            <div>
              <span className="font-semibold text-foreground not-italic">Text Analysis:</span>{" "}
              {visualAnalysisText.redundancy}
            </div>
          </div>
        </Panel>
      </section>

      <Panel title="Recommended compliance fixes" subtitle="AI-generated policy remediations">
        {channel.status === "SYNCING" || isRemediationLoading ? (
          <div className="flex flex-col items-center justify-center py-6 text-center text-muted-foreground gap-2">
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
            <p className="text-xs">Compliance scans are currently in progress. Recommended fixes will generate once audit analyses complete (can take up to a minute).</p>
          </div>
        ) : remediation && remediation.length > 0 ? (
          <ol className="space-y-3">
            {remediation.flatMap((risk: any) =>
              (risk.recommended_fixes || []).map((fix: string) => ({
                text: fix,
                category: risk.risk_category,
              }))
            ).map((r: any, i: number) => (
              <li key={i} className="flex gap-3 rounded-lg border bg-background/40 p-3 hairline">
                <div className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-primary/15 text-[11px] font-semibold text-primary">{i+1}</div>
                <div>
                  <div className="text-sm font-medium text-foreground">{r.text}</div>
                  <div className="text-[10px] text-muted-foreground mt-0.5">Category: {r.category}</div>
                </div>
              </li>
            ))}
          </ol>
        ) : (
          <div className="py-4 text-center text-xs text-muted-foreground">All compliance rules healthy. No action items required.</div>
        )}
      </Panel>
      <InteractiveVideoModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        videoId={selectedVideoId}
        orgId={orgId}
      />
    </div>
  );
}
