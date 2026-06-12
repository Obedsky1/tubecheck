import { createFileRoute, Link } from "@tanstack/react-router";
import { KpiCard } from "@/components/dashboard/KpiCard";
import { Panel } from "@/components/dashboard/Panel";
import { SeverityBadge } from "@/components/dashboard/SeverityBadge";
import { ChartFrame } from "@/components/charts/ChartFrame";
import {
  Area, AreaChart, Bar, ComposedChart, CartesianGrid, Cell, Line, LineChart,
  PolarAngleAxis, PolarGrid, Radar, RadarChart, Tooltip, XAxis, YAxis, Pie, PieChart,
} from "recharts";
import { ArrowUpRight, CheckCircle2, Sparkles, Youtube, RefreshCw, Loader2, AlertTriangle, ShieldCheck } from "lucide-react";
import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api, Channel } from "@/lib/api";
import { toast } from "sonner";
import { InteractiveVideoModal } from "@/components/dashboard/InteractiveVideoModal";

export const Route = createFileRoute("/app/")({
  component: DashboardPage,
});

const tooltip = {
  contentStyle: {
    background: "oklch(0.20 0.014 250)",
    border: "1px solid oklch(0.28 0.014 250)",
    borderRadius: 8,
    fontSize: 12,
    color: "oklch(0.97 0.005 250)",
  },
  cursor: { stroke: "oklch(0.82 0.16 210)", strokeOpacity: 0.3 },
};

function formatSubs(count: number | null | undefined) {
  if (!count) return "0";
  if (count >= 1000000) return (count / 1000000).toFixed(1) + "M";
  if (count >= 1000) return (count / 1000).toFixed(0) + "K";
  return String(count);
}

function DashboardPage() {
  const { org } = useAuth();
  const queryClient = useQueryClient();

  const { data: channelsData, isLoading: isChannelsLoading } = useQuery({
    queryKey: ["channels", org?.id],
    queryFn: () => api.getChannels(org!.id),
    enabled: !!org?.id,

  });

  const realChannels = channelsData?.channels || [];
  const loading = isChannelsLoading;

  const { data: dashData } = useQuery({
    queryKey: ["dashboardOverview", org?.id],
    queryFn: async () => {
      const [overview, fleet, remediations, alerts, auditResults, auditQueue, geminiSummary, shadowban] = await Promise.all([
        api.getDashboardOverview(org!.id).catch(() => null),
        api.getDashboardFleet(org!.id).catch(() => []),
        api.getRemediation(org!.id).catch(() => []),
        api.getDashboardAlerts(org!.id).catch(() => []),
        api.getAuditResults(org!.id).catch(() => []),
        api.getAuditQueue(org!.id).catch(() => []),
        api.getGeminiSummary(org!.id).catch(() => null),
        api.getShadowbanDiagnostic(org!.id).catch(() => null),
      ]);
      return { overview, fleet, remediations, alerts, auditResults, auditQueue, geminiSummary, shadowban };
    },
    enabled: !!org?.id && realChannels.length > 0,
  });

  const { data: recentVideos = [] } = useQuery({
    queryKey: ["recentVideos", org?.id],
    queryFn: async () => {
      const videosPromises = realChannels.slice(0, 3).map((c: any) =>
        api.getChannelVideos(c.id).catch(() => ({ videos: [], total: 0 }))
      );
      const videosLists = await Promise.all(videosPromises);
      return videosLists.flatMap((res: any) =>
        Array.isArray(res) ? res : res.videos || []
      );
    },
    enabled: !!org?.id && realChannels.length > 0,
  });

  const overview = dashData?.overview || null;
  const fleet = dashData?.fleet || [];
  const remediations = dashData?.remediations || [];
  const alerts = dashData?.alerts || [];
  const auditResults = dashData?.auditResults || [];
  const auditQueue = dashData?.auditQueue || [];
  const geminiSummary = dashData?.geminiSummary || null;
  const shadowban = dashData?.shadowban || null;

  const [channelIdInput, setChannelIdInput] = useState("");
  const [connecting, setConnecting] = useState(false);
  const [selectedVideoId, setSelectedVideoId] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [timeframe, setTimeframe] = useState<"7D" | "30D" | "90D">("30D");
  const [visualAnalysisText, setVisualAnalysisText] = useState<Record<string, string>>({
    compliance: "Hover over the chart to inspect daily compliance indexes and policy risk levels. High risk flags indicate demonetization hazards.",
    risk: "Hover over the segments to analyze channel threat categorizations. Healthy channels reside in the Low risk group.",
    velocity: "Hover over the bars to inspect upload frequency compared to human baselines. Sudden spikes trigger spam warnings.",
    redundancy: "Hover over the points to analyze script overlap. Ratios above 70% indicate duplicate storytelling templates.",
    radar: "Hover over the radar axes to analyze your footprint across vectors: Metadata, Visual, Acoustic, Repetition, and Velocity."
  });

  const handleConnect = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!channelIdInput.trim() || !org?.id) return;

    setConnecting(true);
    try {
      await api.connectChannels({
        org_id: org.id,
        youtube_channel_ids: [channelIdInput.trim()],
      });
      toast.success("YouTube channel connected successfully! Syncing started.");
      setChannelIdInput("");
      await queryClient.invalidateQueries({ queryKey: ["channels", org.id] });
      await queryClient.invalidateQueries({ queryKey: ["dashboardOverview", org.id] });
    } catch (err: any) {
      toast.error(err.message || "Failed to connect YouTube channel");
    } finally {
      setConnecting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-[60vh] items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <span className="text-sm text-muted-foreground font-medium">Verifying workspace settings...</span>
        </div>
      </div>
    );
  }

  if (realChannels.length === 0) {
    return (
      <div className="mx-auto max-w-2xl space-y-6 py-12">
        <Panel className="border-primary/20 bg-gradient-to-b from-card to-card/40">
          <div className="flex flex-col items-center text-center p-6 space-y-6">
            <div className="rounded-full bg-red-500/10 p-5 ring-8 ring-red-500/5">
              <Youtube className="h-12 w-12 text-red-500" />
            </div>
            
            <div className="space-y-2">
              <h2 className="text-2xl font-bold tracking-tight">Connect YouTube Channel</h2>
              <p className="text-sm text-muted-foreground max-w-md">
                Enter your YouTube Channel ID below to link your channel. TubeCheck will scan and monitor your upload history for compliance flags.
              </p>
            </div>

            <form onSubmit={handleConnect} className="w-full max-w-md space-y-4">
              <div className="text-left">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Channel ID (starts with UC)</label>
                <div className="mt-2 flex gap-2">
                  <input
                    type="text"
                    required
                    value={channelIdInput}
                    onChange={(e) => setChannelIdInput(e.target.value)}
                    placeholder="e.g. UCxxxxxxxxxxxxxxxxxxxx"
                    className="flex-1 rounded-lg border bg-background px-3.5 py-2.5 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all"
                  />
                  <button
                    type="submit"
                    disabled={connecting}
                    className="inline-flex items-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/95 disabled:opacity-50 transition-colors"
                  >
                    {connecting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Youtube className="h-4 w-4" />}
                    Connect
                  </button>
                </div>
              </div>

              <div className="rounded-lg border bg-background/30 p-4 text-left text-xs text-muted-foreground space-y-2.5 hairline">
                <div className="font-semibold text-foreground">How to locate your YouTube Channel ID:</div>
                <ol className="list-decimal pl-4 space-y-1">
                  <li>Open YouTube in a web browser and sign in.</li>
                  <li>Click your avatar &rarr; <strong>Settings</strong> &rarr; <strong>Advanced settings</strong>.</li>
                  <li>Copy the <strong>Channel ID</strong>. It will look like <code>UC...</code>.</li>
                </ol>
              </div>
            </form>
          </div>
        </Panel>
      </div>
    );
  }

  // Dynamic KPI computations
  const threatIndex = overview?.threat_index ?? 0;
  const tb = overview?.threat_breakdown || {};
  const scriptSim = tb.SCRIPT_SIMILARITY ?? 0;
  const visualSim = tb.VISUAL_SIMILARITY ?? 0;
  const assetReuse = tb.ASSET_REUSE ?? 0;
  const voiceForen = tb.VOICE_FORENSIC ?? 0;
  const velocityAn = tb.VELOCITY_ANOMALY ?? 0;

  const monetizationStability = overview?.monetization_stability ?? Math.max(0, 100 - threatIndex * 1.2);
  const originalityScore = overview?.originality_score ?? Math.max(0, 100 - (scriptSim * 0.5 + visualSim * 0.5));
  const humanValueIndex = overview?.human_value_index ?? Math.max(0, 100 - (voiceForen * 0.6 + assetReuse * 0.4));
  const contentFarmRisk = overview?.content_farm_risk ?? Math.max(0, (scriptSim * 0.4 + velocityAn * 0.4 + assetReuse * 0.2));
  const brandSafety = overview?.brand_safety ?? Math.max(0, 100 - voiceForen * 0.4 - velocityAn * 0.2);
  const uploadReadiness = overview?.upload_readiness ?? Math.max(0, (monetizationStability + brandSafety + originalityScore) / 3);

  const dynamicKpis = [
    {
      label: "Monetization Stability",
      value: monetizationStability.toFixed(1),
      unit: "/100",
      delta: 1.4,
      trend: "up" as const,
      tone: (monetizationStability > 80 ? "success" : monetizationStability > 50 ? "warning" : "danger") as "success" | "warning" | "danger",
      to: "/app/flagged",
    },
    {
      label: "Originality Score",
      value: originalityScore.toFixed(1),
      unit: "/100",
      delta: 2.1,
      trend: "up" as const,
      tone: (originalityScore > 80 ? "success" : originalityScore > 50 ? "warning" : "danger") as "success" | "warning" | "danger",
      to: "/app/forensics",
    },
    {
      label: "Human Value Index",
      value: humanValueIndex.toFixed(1),
      unit: "/100",
      delta: 0.8,
      trend: "up" as const,
      tone: (humanValueIndex > 80 ? "success" : humanValueIndex > 50 ? "warning" : "danger") as "success" | "warning" | "danger",
      to: "/app/forensics",
    },
    {
      label: "Content Farm Risk",
      value: contentFarmRisk.toFixed(1),
      unit: "%",
      delta: 1.1,
      trend: "down" as const,
      tone: (contentFarmRisk < 30 ? "success" : contentFarmRisk < 60 ? "warning" : "danger") as "success" | "warning" | "danger",
      to: "/app/forensics",
    },
    {
      label: "Brand Safety Score",
      value: brandSafety.toFixed(1),
      unit: "/100",
      delta: 0.5,
      trend: "up" as const,
      tone: (brandSafety > 80 ? "success" : brandSafety > 50 ? "warning" : "danger") as "success" | "warning" | "danger",
      to: "/app/flagged",
    },
    {
      label: "Upload Readiness",
      value: uploadReadiness.toFixed(1),
      unit: "/100",
      delta: 1.2,
      trend: "up" as const,
      tone: (uploadReadiness > 80 ? "success" : uploadReadiness > 50 ? "warning" : "danger") as "success" | "warning" | "danger",
      to: "/app/audits",
    },
  ];

  const dynamicComplianceSeries = (() => {
    if (auditResults.length === 0) {
      return [
        { day: "W1", score: 100, risk: 0 },
        { day: "W2", score: 100, risk: 0 },
        { day: "W3", score: 100, risk: 0 },
        { day: "W4", score: 100, risk: 0 },
      ];
    }
    const sorted = [...auditResults].sort(
      (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    );
    const sliceCount = timeframe === "7D" ? 7 : timeframe === "30D" ? 30 : 90;
    const sliced = sorted.slice(-sliceCount);
    return sliced.map((r) => {
      const date = new Date(r.created_at);
      const dayStr = date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
      return {
        day: dayStr,
        score: Math.round(100 - r.risk_score),
        risk: Math.round(r.risk_score),
      };
    });
  })();

  const dynamicRiskDistribution = (() => {
    let low = 0, medium = 0, high = 0;
    fleet.forEach((c) => {
      const score = c.average_risk_score;
      if (score >= 60) high++;
      else if (score >= 30) medium++;
      else low++;
    });

    if (fleet.length === 0) {
      return [
        { name: "Low", value: 1, color: "oklch(0.75 0.15 140)" },
        { name: "Medium", value: 0, color: "oklch(0.79 0.16 75)" },
        { name: "High", value: 0, color: "oklch(0.64 0.21 22)" },
      ];
    }

    return [
      { name: "Low", value: low, color: "oklch(0.75 0.15 140)" },
      { name: "Medium", value: medium, color: "oklch(0.79 0.16 75)" },
      { name: "High", value: high, color: "oklch(0.64 0.21 22)" },
    ];
  })();


  const dynamicRecentScans = (() => {
    const scans: any[] = [];
    auditQueue.forEach((q) => {
      scans.push({
        id: q.id.slice(0, 6),
        video_id: q.id,
        target: q.title,
        status: q.status === "AUDITING" ? "Processing" : "Queued",
        time: "In progress",
      });
    });
    auditResults.slice(0, 5).forEach((r) => {
      scans.push({
        id: r.id.slice(0, 6),
        video_id: r.video_id,
        target: r.video?.title || `Audit: ${r.audit_type}`,
        status: "Complete",
        time: new Date(r.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      });
    });

    if (scans.length === 0) {
      return [
        { id: "None", target: "No recent scans", status: "Complete", time: "-" },
      ];
    }
    return scans.slice(0, 4);
  })();

  return (
    <div className="space-y-6">
      {/* SYNC WARNING BANNER */}
      {realChannels.some((c) => c.status === "SYNCING") && (
        <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-primary/25 bg-primary/5 p-4 hairline">
          <div className="flex items-center gap-3">
            <RefreshCw className="h-4 w-4 animate-spin text-primary" />
            <div className="text-sm">
              <span className="font-semibold text-foreground">Compliance scan in progress...</span>{" "}
              <span className="text-muted-foreground">We are indexing upload catalogs, extracting transcripts, and auditing media. This can take up to a minute. Recommended fixes and reports will populate once final scans conclude.</span>
            </div>
          </div>
          <button 
            onClick={() => queryClient.invalidateQueries({ queryKey: ["channels", org?.id] })} 
            className="rounded-md border bg-background/50 px-3 py-1 text-xs hover:bg-accent flex items-center gap-1.5 transition-colors"
          >
            <RefreshCw className="h-3 w-3" /> Refresh status
          </button>
        </div>
      )}

      {/* AI COMPLIANCE EXECUTIVE SUMMARY */}
      {geminiSummary && (
        <div className="rounded-2xl border bg-card/45 glass p-6 md:p-8 shadow-xl relative overflow-hidden">
          <div className="pointer-events-none absolute -right-24 -top-24 w-80 h-80 rounded-full bg-primary/5 blur-[80px]" />
          
          <div className="flex items-center gap-2 mb-4">
            <div className="rounded-lg bg-primary/10 p-2 border border-primary/25">
              <Sparkles className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h2 className="text-lg font-bold tracking-tight text-gradient">AI Executive Compliance Summary</h2>
              <p className="text-xs text-muted-foreground">Dynamic library threat analysis generated by Gemini 2.5 Flash</p>
            </div>
          </div>

          <div className="space-y-5">
            {/* Executive metrics */}
            <div className="grid gap-3 grid-cols-2 md:grid-cols-4">
              <div className="rounded-xl border bg-background/50 px-4 py-3 hairline">
                <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest block">AI Content Density</span>
                <span className="text-lg font-bold text-primary mt-1 block tabular-nums">{geminiSummary.ai_pct}%</span>
              </div>
              <div className="rounded-xl border bg-background/50 px-4 py-3 hairline">
                <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest block">Flagged Ratio</span>
                <span className="text-lg font-bold text-destructive mt-1 block tabular-nums">{geminiSummary.flagged_pct}%</span>
              </div>
              <div className="rounded-xl border bg-background/50 px-4 py-3 hairline">
                <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest block">Scanned Library</span>
                <span className="text-lg font-bold text-foreground mt-1 block tabular-nums">{geminiSummary.total_videos} Videos</span>
              </div>
              <div className="rounded-xl border bg-background/50 px-4 py-3 hairline">
                <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest block">Threat Level</span>
                <div className="mt-1 flex items-center gap-1.5">
                  <span className={`text-base font-bold ${
                    geminiSummary.risk_level === "Critical" || geminiSummary.risk_level === "High" ? "text-destructive" : "text-warning"
                  }`}>{geminiSummary.risk_level}</span>
                  <SeverityBadge level={geminiSummary.risk_level.toLowerCase()} />
                </div>
              </div>
            </div>

            {/* Paragraph block */}
            <div className="text-sm leading-relaxed text-muted-foreground/90 whitespace-pre-line bg-background/20 p-5 rounded-xl border border-border/40 hairline">
              {geminiSummary.summary}
            </div>
          </div>
        </div>
      )}

      {/* ALGORITHMIC SHADOWBAN DIAGNOSTIC */}
      {shadowban && (
        <div className={`rounded-2xl border glass p-6 md:p-8 shadow-xl relative overflow-hidden transition-all duration-300 ${
          shadowban.is_shadowbanned 
            ? "border-destructive/30 bg-destructive/5" 
            : "border-success/20 bg-success/5"
        }`}>
          <div className="pointer-events-none absolute -right-24 -top-24 w-80 h-80 rounded-full bg-primary/5 blur-[80px]" />
          
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
            <div className="flex items-center gap-3">
              <div className={`rounded-lg p-2 border ${
                shadowban.is_shadowbanned 
                  ? "bg-destructive/10 border-destructive/25 text-destructive" 
                  : "bg-success/10 border-success/20 text-success"
              }`}>
                {shadowban.is_shadowbanned ? (
                  <AlertTriangle className="h-5 w-5 animate-bounce" />
                ) : (
                  <ShieldCheck className="h-5 w-5" />
                )}
              </div>
              <div>
                <h2 className="text-lg font-bold tracking-tight text-foreground flex flex-wrap items-center gap-2">
                  Algorithmic Shadowban Diagnostic
                  <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                    shadowban.is_shadowbanned
                      ? "bg-destructive/20 text-destructive border border-destructive/30 animate-pulse"
                      : "bg-success/20 text-success border border-success/30"
                  }`}>
                    {shadowban.is_shadowbanned ? "Algorithmic Demotion Detected" : "Algorithmic Status: Healthy"}
                  </span>
                </h2>
                <p className="text-xs text-muted-foreground">
                  Simulated 30-day YouTube Analytics engine diagnostic comparing CTR, AVD, and Browse/Suggested metrics
                </p>
              </div>
            </div>
            <Link
              to="/app/forensics"
              className="inline-flex items-center gap-1.5 rounded-lg border bg-background/50 hover:bg-accent px-4 py-2 text-xs font-semibold transition-colors shrink-0 shadow-sm self-start md:self-auto"
            >
              Forensic Mitigation Tools <ArrowUpRight className="h-3.5 w-3.5" />
            </Link>
          </div>

          <div className="grid gap-5 md:grid-cols-3">
            {/* Metric 1 */}
            <div className="rounded-xl border bg-background/40 p-4.5 hairline relative overflow-hidden group hover:border-primary/30 transition-colors">
              <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest block mb-1">Browse/Suggested Traffic Drop</span>
              <div className="flex items-baseline gap-2">
                <span className={`text-2xl font-extrabold tracking-tight tabular-nums ${
                  shadowban.browse_suggested_drop_pct > 75 ? "text-destructive" : "text-success"
                }`}>
                  -{shadowban.browse_suggested_drop_pct.toFixed(1)}%
                </span>
                <span className="text-xs text-muted-foreground">Week-over-Week</span>
              </div>
              <div className="mt-2 text-xs text-muted-foreground/80 leading-relaxed">
                {shadowban.browse_suggested_drop_pct > 75 
                  ? "Browse/Suggested features traffic collapsed precipitously, exceeding the 75% critical algorithmic threshold."
                  : "Traffic sources are within standard week-over-week deviation limits."
                }
              </div>
            </div>

            {/* Metric 2 */}
            <div className="rounded-xl border bg-background/40 p-4.5 hairline relative overflow-hidden group hover:border-primary/30 transition-colors">
              <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest block mb-1">Click-Through Rate (CTR) Retention</span>
              <div className="flex items-baseline gap-2">
                <span className={`text-2xl font-extrabold tracking-tight tabular-nums ${
                  shadowban.ctr_retention_pct >= 85 ? "text-success" : "text-warning"
                }`}>
                  {shadowban.ctr_retention_pct.toFixed(1)}%
                </span>
                <span className="text-xs text-muted-foreground">vs Historical Baseline</span>
              </div>
              <div className="mt-2 text-xs text-muted-foreground/80 leading-relaxed">
                {shadowban.ctr_retention_pct >= 85
                  ? "CTR remains stable and high, confirming healthy viewer interest and clickability."
                  : "CTR shows a drop, indicating potential packaging issues or loss of interest."
                }
              </div>
            </div>

            {/* Metric 3 */}
            <div className="rounded-xl border bg-background/40 p-4.5 hairline relative overflow-hidden group hover:border-primary/30 transition-colors">
              <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest block mb-1">AVD Retention</span>
              <div className="flex items-baseline gap-2">
                <span className={`text-2xl font-extrabold tracking-tight tabular-nums ${
                  shadowban.avd_retention_pct >= 85 ? "text-success" : "text-warning"
                }`}>
                  {shadowban.avd_retention_pct.toFixed(1)}%
                </span>
                <span className="text-xs text-muted-foreground">vs Historical Baseline</span>
              </div>
              <div className="mt-2 text-xs text-muted-foreground/80 leading-relaxed">
                {shadowban.avd_retention_pct >= 85
                  ? "Average View Duration retention is excellent, confirming viewer retention and watch time are healthy."
                  : "AVD drop detected, indicating drop in viewer retention."
                }
              </div>
            </div>
          </div>

          {/* Explanation paragraph */}
          <div className="mt-5 text-sm leading-relaxed text-muted-foreground/90 whitespace-pre-line bg-background/20 p-5 rounded-xl border border-border/40 hairline flex items-start gap-3">
            <div className={`rounded-full p-1.5 shrink-0 mt-0.5 ${
              shadowban.is_shadowbanned 
                ? "bg-destructive/10 text-destructive" 
                : "bg-success/10 text-success"
            }`}>
              {shadowban.is_shadowbanned ? (
                <AlertTriangle className="h-4 w-4" />
              ) : (
                <CheckCircle2 className="h-4 w-4" />
              )}
            </div>
            <div>
              <span className="font-semibold text-foreground">Diagnostic Summary:</span>{" "}
              {shadowban.explanation}
            </div>
          </div>
        </div>
      )}

      {/* KPI ROW */}
      <section className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        {dynamicKpis.map((k, i) => <KpiCard key={k.label} {...k} index={i} />)}
      </section>

      {/* CHARTS ROW */}
      <section className="grid gap-4 lg:grid-cols-3">
        <Panel className="lg:col-span-2" title="Compliance analytics" subtitle={`Network-wide score over the last ${timeframe === "7D" ? "7" : timeframe === "30D" ? "30" : "90"} days`}
          action={<div className="flex gap-1 text-[11px]">{["7D","30D","90D"].map((t)=>(
            <button key={t} onClick={() => setTimeframe(t as any)} className={`rounded-md border px-2 py-0.5 cursor-pointer ${timeframe===t?"bg-accent":"text-muted-foreground hover:bg-accent"}`}>{t}</button>
          ))}</div>}>
          <ChartFrame height={260}>
            <AreaChart 
              data={dynamicComplianceSeries} 
              margin={{ left: -16, right: 8, top: 8 }}
              onMouseMove={(state) => {
                if (state && state.activePayload && state.activePayload.length > 0) {
                  const data = state.activePayload[0].payload;
                  setVisualAnalysisText(prev => ({
                    ...prev,
                    compliance: `On ${data.day}, the Network Compliance Index was ${data.score}/100 and policy risk was ${data.risk}%. ${
                      data.risk > 40 
                        ? "⚠️ Critical risk levels detected. Transcripts or footage may be flagged as inauthentic." 
                        : "✅ Healthy compliance levels. Content exhibits high originality and low-effort indicators are absent."
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
                <linearGradient id="g1" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="oklch(0.82 0.16 210)" stopOpacity={0.5} />
                  <stop offset="100%" stopColor="oklch(0.82 0.16 210)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="oklch(0.28 0.014 250)" strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="day" tick={{ fill: "oklch(0.66 0.018 250)", fontSize: 11 }} tickLine={false} axisLine={false} />
              <YAxis tick={{ fill: "oklch(0.66 0.018 250)", fontSize: 11 }} tickLine={false} axisLine={false} />
              <Tooltip {...tooltip} />
              <Area type="monotone" dataKey="score" stroke="oklch(0.82 0.16 210)" strokeWidth={2} fill="url(#g1)" />
              <Line type="monotone" dataKey="risk" stroke="oklch(0.64 0.21 22)" strokeWidth={1.5} dot={false} />
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
 
        <Panel title="Risk distribution" subtitle={`Across ${realChannels.length} channels`}>
          <ChartFrame height={200}>
            <PieChart
              onMouseMove={(state) => {
                if (state && state.activePayload && state.activePayload.length > 0) {
                  const data = state.activePayload[0].payload;
                  setVisualAnalysisText(prev => ({
                    ...prev,
                    risk: `The network has ${data.value} channels classified under the ${data.name} risk category. ${
                      data.name === "High" 
                        ? "🚨 Action required: Immediate copyright, reused content, or deepfake scan remediation needed."
                        : data.name === "Medium"
                        ? "⚠️ Watch category: Some template scripting or TTS signatures detected. Keep variance high."
                        : "✅ Fully safe: Low-risk channels are optimized for YouTube guidelines and monetization approval."
                    }`
                  }));
                }
              }}
              onMouseLeave={() => {
                setVisualAnalysisText(prev => ({
                  ...prev,
                  risk: "Hover over the segments to analyze channel threat categorizations. Healthy channels reside in the Low risk group."
                }));
              }}
            >
              <Pie data={dynamicRiskDistribution} dataKey="value" innerRadius={50} outerRadius={80} paddingAngle={2} stroke="oklch(0.16 0.012 250)">
                {dynamicRiskDistribution.map((d) => <Cell key={d.name} fill={d.color as string} />)}
              </Pie>
              <Tooltip {...tooltip} />
            </PieChart>
          </ChartFrame>
          <div className="mt-4 rounded-lg border bg-muted/20 p-3 text-xs text-muted-foreground italic hairline flex items-start gap-2 min-h-[50px] transition-all">
            <Sparkles className="h-4.5 w-4.5 text-primary shrink-0 mt-0.5" />
            <div>
              <span className="font-semibold text-foreground not-italic">Text Analysis:</span>{" "}
              {visualAnalysisText.risk}
            </div>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2">
            {dynamicRiskDistribution.map((d) => (
              <div key={d.name} className="flex items-center gap-2 text-xs">
                <span className="h-2 w-2 rounded-sm" style={{ background: d.color as string }} />
                <span className="text-muted-foreground">{d.name}</span>
                <span className="ml-auto tabular-nums">{d.value}</span>
              </div>
            ))}
          </div>
        </Panel>
      </section>




      {/* CHANNELS + SCANS */}
      <section className="grid gap-4 lg:grid-cols-3">
        <Panel className="lg:col-span-2" title="Channel performance" subtitle="Live network status"
          action={
            <div className="flex items-center gap-3">
              <form onSubmit={handleConnect} className="flex items-center gap-1.5">
                <input
                  type="text"
                  required
                  value={channelIdInput}
                  onChange={(e) => setChannelIdInput(e.target.value)}
                  placeholder="Connect channel ID..."
                  className="rounded-md border bg-background/40 px-2 py-1 text-xs outline-none focus:border-primary w-40 placeholder:text-muted-foreground"
                />
                <button
                  type="submit"
                  disabled={connecting}
                  className="rounded-md bg-primary px-2.5 py-1 text-xs font-semibold text-primary-foreground hover:bg-primary/95 disabled:opacity-50"
                >
                  {connecting ? <Loader2 className="h-3 w-3 animate-spin" /> : "Link"}
                </button>
              </form>
              <Link to="/app/channels" className="inline-flex items-center gap-1 text-xs text-primary hover:underline">
                All channels <ArrowUpRight className="h-3 w-3" />
              </Link>
            </div>
          }>
          <div className="-mx-5 overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-[11px] uppercase tracking-wider text-muted-foreground">
                <tr className="border-b">
                  <th className="px-5 py-2 font-medium">Channel</th>
                  <th className="px-3 py-2 font-medium">Health</th>
                  <th className="px-3 py-2 font-medium">Risk</th>
                  <th className="px-3 py-2 font-medium">Originality</th>
                  <th className="px-5 py-2 font-medium text-right">Monetization Safety</th>
                </tr>
              </thead>
              <tbody>
                {realChannels.slice(0, 6).map((c) => {
                  const fleetData = fleet.find((f) => f.channel_id === c.id);
                  const health = fleetData ? Math.round(100 - fleetData.average_risk_score) : 100;
                  const riskLevel = fleetData ? (fleetData.average_risk_score >= 60 ? "high" : fleetData.average_risk_score >= 30 ? "medium" : "low") : "low";
                  const originality = fleetData ? Math.round(100 - (fleetData.average_risk_score * 0.9)) : 100;
                  const monetizationStatus = fleetData ? (fleetData.flagged_videos > 0 ? "review" : "safe") : "safe";

                  return (
                    <tr key={c.id} className="border-b last:border-0 hover:bg-accent/40">
                      <td className="px-5 py-3">
                        <Link to="/app/channels/$id" params={{ id: c.id }} className="hover:text-primary">
                          <div className="font-semibold">{c.title || "Syncing Channel..."}</div>
                          <div className="text-[11px] text-muted-foreground">{c.custom_url || "Pending"} · {formatSubs(c.subscriber_count)} subs</div>
                        </Link>
                      </td>
                      <td className="px-3 py-3">
                        {c.status === "SYNCING" ? (
                          <div className="flex items-center gap-1.5 text-xs text-primary animate-pulse">
                            <Loader2 className="h-3 w-3 animate-spin" />
                            <span>Scanning... (up to 1 min)</span>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2">
                            <div className="h-1.5 w-20 overflow-hidden rounded-full bg-muted">
                              <div className={`h-full rounded-full ${health > 80 ? "bg-success" : health > 50 ? "bg-warning" : "bg-destructive"}`} style={{ width: `${health}%` }} />
                            </div>
                            <span className="tabular-nums text-xs">{health}</span>
                          </div>
                        )}
                      </td>
                      <td className="px-3 py-3">
                        <SeverityBadge level={c.status === "SYNCING" ? "processing" : riskLevel} />
                      </td>
                      <td className="px-3 py-3 tabular-nums">
                        {c.status === "SYNCING" ? (
                          <span className="text-muted-foreground">—</span>
                        ) : (
                          originality
                        )}
                      </td>
                      <td className="px-5 py-3 text-right">
                        <SeverityBadge level={c.status === "SYNCING" ? "queued" : monetizationStatus} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Panel>

        <Panel title="Recent scans" subtitle="Forensic processing">
          <ul className="space-y-3">
            {dynamicRecentScans.map((s) => (
              <li 
                key={s.id} 
                onClick={() => {
                  if (s.video_id && s.status.toLowerCase() === "complete") {
                    setSelectedVideoId(s.video_id);
                    setIsModalOpen(true);
                  }
                }}
                className={`flex items-center gap-3 rounded-lg border p-3 hairline transition-all group ${
                  s.status.toLowerCase() === "complete" && s.video_id 
                    ? "bg-background/40 hover:bg-accent/20 hover:border-primary/30 cursor-pointer" 
                    : "bg-background/25 opacity-75"
                }`}
              >
                <div className="flex-1 min-w-0">
                  <div className="truncate text-sm font-semibold text-foreground group-hover:text-primary transition-colors">{s.target}</div>
                  <div className="text-[11px] text-muted-foreground">{s.id} · {s.time}</div>
                </div>
                <SeverityBadge level={s.status.toLowerCase()} />
              </li>
            ))}
          </ul>
        </Panel>
      </section>
      <InteractiveVideoModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        videoId={selectedVideoId}
        orgId={org?.id || ""}
      />
    </div>
  );
}
