import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { Panel } from "@/components/dashboard/Panel";
import { SeverityBadge } from "@/components/dashboard/SeverityBadge";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { getVideoMaxRisk } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import {
  ShieldCheck,
  AlertOctagon,
  Eye,
  AlertTriangle,
  Loader2,
  RefreshCw,
  Sparkles,
  Edit3,
  Sliders,
  Film,
  Check,
  Bell,
  Play
} from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/app/forensics")({
  component: ForensicsControlPage,
});

function ForensicsControlPage() {
  const { org } = useAuth();
  const orgId = org?.id || "";
  const queryClient = useQueryClient();
  const [selectedVideoId, setSelectedVideoId] = useState<string | null>(null);
  
  // Tab within the Alerts Panel (Flagged Videos vs. Network Alerts)
  const [activeAlertsTab, setActiveAlertsTab] = useState<"flagged" | "network">("flagged");

  // Live Metadata Editor State
  const [editedTitle, setEditedTitle] = useState("");
  const [editedDesc, setEditedDesc] = useState("");

  // Queries
  const { data: alerts, isLoading: isAlertsLoading } = useQuery({
    queryKey: ["dashboardAlerts", orgId],
    queryFn: () => api.getDashboardAlerts(orgId),
    enabled: !!orgId,

  });

  const { data: flaggedVideos, isLoading: isFlaggedLoading } = useQuery({
    queryKey: ["flaggedVideos", orgId],
    queryFn: () => api.getFlaggedVideos(orgId),
    enabled: !!orgId,

  });

  const { data: auditResults, isLoading: isAuditsLoading } = useQuery({
    queryKey: ["auditResults", orgId],
    queryFn: () => api.getAuditResults(orgId),
    enabled: !!orgId,
  });

  const { data: shadowbanData, isLoading: isShadowbanLoading } = useQuery({
    queryKey: ["shadowbanDiagnostic", orgId],
    queryFn: () => api.getShadowbanDiagnostic(orgId),
    enabled: !!orgId,
  });

  const isLoading = isAlertsLoading || isFlaggedLoading || isAuditsLoading || isShadowbanLoading;

  // Selected video object
  const selectedVideo = flaggedVideos?.find((v: any) => v.id === selectedVideoId);

  // Initialize form when selected video changes
  useEffect(() => {
    if (selectedVideo) {
      setEditedTitle(selectedVideo.title || "");
      setEditedDesc(selectedVideo.description || "");
    } else {
      setEditedTitle("");
      setEditedDesc("");
    }
  }, [selectedVideoId, selectedVideo]);

  // Mutations
  const remedyMutation = useMutation({
    mutationFn: ({ videoId, action }: { videoId: string; action: string }) =>
      api.remedyVideo(videoId, action),
    onSuccess: (data, variables) => {
      toast.success(data.message || "Remediation action completed successfully!");
      queryClient.invalidateQueries({ queryKey: ["flaggedVideos", orgId] });
      queryClient.invalidateQueries({ queryKey: ["dashboardOverview", orgId] });
      queryClient.invalidateQueries({ queryKey: ["dashboardAlerts", orgId] });
      queryClient.invalidateQueries({ queryKey: ["channels", orgId] });
      
      if (variables.videoId === selectedVideoId && variables.action !== "verify") {
        setSelectedVideoId(null);
      }
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to perform remediation action.");
    },
  });

  const updateMetadataMutation = useMutation({
    mutationFn: () => api.updateVideoMetadata(selectedVideoId!, editedTitle, editedDesc),
    onSuccess: (data) => {
      toast.success(data.message || "Video metadata successfully updated and status set to COMPLETED!");
      queryClient.invalidateQueries({ queryKey: ["flaggedVideos", orgId] });
      queryClient.invalidateQueries({ queryKey: ["dashboardOverview", orgId] });
      queryClient.invalidateQueries({ queryKey: ["dashboardAlerts", orgId] });
      queryClient.invalidateQueries({ queryKey: ["channels", orgId] });
      setSelectedVideoId(null);
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to save video metadata.");
    }
  });

  if (!orgId) {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <p className="text-muted-foreground text-sm">No active organization selected. Please log in again.</p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex h-[60vh] items-center justify-center gap-2">
        <Loader2 className="h-7 w-7 animate-spin text-primary" />
        <span className="text-sm text-muted-foreground">Gathering forensic data models...</span>
      </div>
    );
  }

  const handleRemedy = (videoId: string, action: string) => {
    remedyMutation.mutate({ videoId, action });
  };

  const activeAlerts = alerts || [];



  // Helper to extract specific audit risk scores for selected video
  const getAuditScore = (type: string, defaultVal = 0) => {
    if (!selectedVideo || !selectedVideo.audits) return defaultVal;
    const audit = selectedVideo.audits.find((a: any) => a.audit_type === type);
    return audit ? audit.risk_score : defaultVal;
  };

  const pacingScore = getAuditScore("SCRIPT_SIMILARITY", 40);
  const assetReuseScore = getAuditScore("ASSET_REUSE", 20);
  const transformativeScore = Math.max(0, 100 - assetReuseScore);
  const aiStockScore = Math.max(getAuditScore("VOICE_FORENSIC", 15), getAuditScore("DEEPFAKE_SCAN", 10));
  const scaleSpamScore = getAuditScore("VELOCITY_ANOMALY", 25);

  // Real-time policy warning validation scan
  const flaggedWords = ["fuck", "fvck", "shit", "bitch", "bastard", "omg", "must watch", "viral", "free money", "100% real", "fake", "click here"];
  const findMatches = (text: string) => {
    if (!text) return [];
    return flaggedWords.filter(word => text.toLowerCase().includes(word));
  };
  const titleViolations = findMatches(editedTitle);
  const descViolations = findMatches(editedDesc);
  const allViolations = Array.from(new Set([...titleViolations, ...descViolations]));

  // SPAM METADATA TRACKING
  const stopWords = new Set(["the", "and", "a", "an", "of", "to", "in", "is", "for", "that", "this", "it", "with", "as", "on", "are", "be", "by", "or", "from"]);
  const analyzeSpam = (text: string) => {
    const words = text.toLowerCase().match(/\b[a-z]{3,}\b/g) || [];
    const counts: Record<string, number> = {};
    let maxCount = 0;
    words.forEach(w => {
      if (!stopWords.has(w)) {
        counts[w] = (counts[w] || 0) + 1;
        if (counts[w] > maxCount) maxCount = counts[w];
      }
    });
    return maxCount;
  };
  
  const titleMaxRepeat = analyzeSpam(editedTitle);
  const descMaxRepeat = analyzeSpam(editedDesc);
  const isSpamMetadata = titleMaxRepeat > 4 || descMaxRepeat > 4;
  
  // Calculate Metadata Safety Score
  let metadataSafeScore = 100;
  if (allViolations.length > 0) metadataSafeScore -= 20;
  if (isSpamMetadata) metadataSafeScore = 45; // Force below 50%

  // ASSET CROSS-CONTAMINATION WARNING
  const isAssetCrossContaminated = aiStockScore > 50 && assetReuseScore > 50;

  return (
    <div className="space-y-6">

      {shadowbanData?.is_shadowbanned && (
        <div className="rounded-xl border border-destructive/50 bg-destructive/10 p-5 shadow-sm animate-in slide-in-from-top-4 duration-500">
          <div className="flex gap-4">
            <div className="mt-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-destructive/20 text-destructive">
              <AlertTriangle className="h-5 w-5" />
            </div>
            <div className="space-y-2">
              <h3 className="text-lg font-bold text-destructive">
                Algorithmic Demotion Detected (Soft Shadowban)
              </h3>
              <p className="text-sm text-destructive/90 leading-relaxed max-w-4xl">
                {shadowbanData.explanation}
              </p>
              <div className="mt-4 flex flex-wrap gap-4 text-xs font-semibold">
                <div className="rounded-md bg-destructive/20 px-3 py-1.5 text-destructive border border-destructive/30">
                  Browse/Suggested Drop: <span className="text-lg ml-1">-{shadowbanData.browse_suggested_drop_pct.toFixed(0)}%</span>
                </div>
                <div className="rounded-md bg-green-500/10 px-3 py-1.5 text-green-600 dark:text-green-400 border border-green-500/30">
                  CTR Retention: <span className="text-lg ml-1">{shadowbanData.ctr_retention_pct.toFixed(0)}%</span>
                </div>
                <div className="rounded-md bg-green-500/10 px-3 py-1.5 text-green-600 dark:text-green-400 border border-green-500/30">
                  AVD Retention: <span className="text-lg ml-1">{shadowbanData.avd_retention_pct.toFixed(0)}%</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── SECTION B: COMPLIANCE ALERTS & REMEDIATION BOARD ── */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Left Column: TABS for alerts */}
        <Panel
          className="lg:col-span-2"
          title="Compliance Alerts Feed"
          subtitle="Review policy violations or general channel network events"
          action={
            <div className="flex gap-1 bg-background/50 border rounded-lg p-0.5 text-xs">
              <button
                onClick={() => setActiveAlertsTab("flagged")}
                className={`px-3 py-1 rounded-md cursor-pointer transition-colors ${
                  activeAlertsTab === "flagged" ? "bg-accent text-foreground" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Flagged Videos ({flaggedVideos?.length || 0})
              </button>
              <button
                onClick={() => setActiveAlertsTab("network")}
                className={`px-3 py-1 rounded-md cursor-pointer transition-colors ${
                  activeAlertsTab === "network" ? "bg-accent text-foreground" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Network Alerts ({activeAlerts?.length || 0})
              </button>
            </div>
          }
        >
          {activeAlertsTab === "flagged" ? (
            flaggedVideos && flaggedVideos.length > 0 ? (
              <div className="space-y-3 max-h-[400px] overflow-y-auto pr-1">
                {flaggedVideos.map((v: any) => {
                  const isSelected = v.id === selectedVideoId;
                  const maxRisk = v.audits && v.audits.length > 0
                    ? Math.max(...v.audits.map((a: any) => a.risk_score))
                    : 0;

                  return (
                    <div
                      key={v.id}
                      onClick={() => setSelectedVideoId(v.id)}
                      className={`group flex items-start gap-4 rounded-xl border p-4 transition-all duration-300 cursor-pointer ${
                        isSelected
                          ? "bg-sidebar-accent/80 border-primary shadow-lg ring-1 ring-primary/30"
                          : "bg-background/40 hover:bg-sidebar-accent/40 hover:border-muted-foreground/30 hover:scale-[1.01]"
                      }`}
                    >
                      {v.thumbnail_url ? (
                        <img
                          src={v.thumbnail_url}
                          alt={v.title}
                          className="h-14 w-20 shrink-0 object-cover rounded-lg border bg-muted shadow-sm transition-transform group-hover:scale-105"
                        />
                      ) : (
                        <div className="h-14 w-20 shrink-0 rounded-lg bg-muted flex items-center justify-center border text-muted-foreground">
                          <AlertOctagon className="h-5 w-5 text-muted-foreground" />
                        </div>
                      )}
                      
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-[9px] font-semibold text-muted-foreground uppercase tracking-wider truncate">
                            {v.channel_title}
                          </span>
                          <div className="flex items-center gap-1.5 shrink-0">
                            <span className="text-xs font-semibold tabular-nums text-destructive">
                              {getVideoMaxRisk(v).toFixed(0)}% Risk
                            </span>
                            <SeverityBadge level={getVideoMaxRisk(v) >= 80 ? "critical" : getVideoMaxRisk(v) >= 60 ? "high" : getVideoMaxRisk(v) >= 40 ? "watch" : "stable"} />
                          </div>
                        </div>
                        <h4 className="mt-0.5 text-xs font-semibold tracking-tight text-foreground truncate group-hover:text-primary transition-colors">
                          {v.title}
                        </h4>
                        <p className="mt-0.5 text-[10px] text-muted-foreground">
                          ID: <code className="bg-muted/80 px-1 py-0.5 rounded text-[9px] font-mono">{v.youtube_video_id || v.id.substring(0, 6)}</code>
                          {v.published_at && ` · Sync ${new Date(v.published_at).toLocaleDateString()}`}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-16 text-center rounded-xl border border-dashed bg-background/20 space-y-2">
                <ShieldCheck className="h-7 w-7 text-success" />
                <h4 className="text-xs font-bold">100% Policy Compliant</h4>
                <p className="text-[11px] text-muted-foreground max-w-sm">
                  Zero policy flags or advertiser monetization alerts are active across your connected channel network.
                </p>
              </div>
            )
          ) : (
            activeAlerts.length > 0 ? (
              <ul className="space-y-3 max-h-[400px] overflow-y-auto pr-1">
                {activeAlerts.map((a: any) => (
                  <li key={a.id} className="flex items-center gap-3 rounded-lg border bg-background/40 p-3 hover:bg-accent/25 transition-colors">
                    <SeverityBadge level={a.severity} />
                    <div className="min-w-0 flex-1">
                      <div className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                        <Bell className="h-3.5 w-3.5 text-muted-foreground" /> {a.title}
                      </div>
                      <div className="text-[10px] text-muted-foreground mt-0.5">
                        {a.description} · Ingested {new Date(a.created_at).toLocaleDateString()}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="flex flex-col items-center justify-center py-16 text-center rounded-xl border border-dashed bg-background/20 space-y-2">
                <ShieldCheck className="h-7 w-7 text-success" />
                <h4 className="text-xs font-bold">No Network Alerts</h4>
                <p className="text-[11px] text-muted-foreground">
                  Your creator networks are operating cleanly. Zero automated threats flagged.
                </p>
              </div>
            )
          )}
        </Panel>

        {/* Right Column: Remediation Board */}
        <div id="remediation-board">
          <Panel
            title="Remediation Board"
            subtitle="Compliance scorecard and metadata controls"
          >
          {selectedVideo ? (
            <div className="space-y-5">
              <div className="space-y-2">
                <div className="text-[10px] font-bold text-primary uppercase tracking-widest flex items-center gap-1">
                  <Film className="h-3.5 w-3.5" /> Video Context
                </div>
                <h3 className="text-xs font-bold tracking-tight text-foreground truncate">
                  {selectedVideo.title}
                </h3>
                <div className="text-[10px] text-muted-foreground bg-muted/30 p-2 rounded-lg border italic max-h-16 overflow-y-auto">
                  {selectedVideo.description || "No description provided."}
                </div>
              </div>

              <div className="border-t border-border/40 my-3" />

              {/* Gauges */}
              <div className="space-y-3">
                <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest flex items-center gap-1">
                  <Sliders className="h-3.5 w-3.5" /> Authenticity Breakdown
                </div>
                
                <div className="grid grid-cols-2 gap-2">
                  {/* Gauge 1: Pacing */}
                  <div className="rounded-lg border bg-background/40 p-2.5 flex flex-col items-center text-center">
                    <span className="text-[10px] font-medium text-muted-foreground mb-1">Pacing Rigidity</span>
                    <div className="relative flex items-center justify-center">
                      <svg className="w-20 h-20 -rotate-90">
                        <circle className="text-muted/30" strokeWidth="4" stroke="currentColor" fill="transparent" r="30" cx="40" cy="40" />
                        <circle className="text-warning" strokeWidth="4" strokeDasharray={`${2 * Math.PI * 30}`} strokeDashoffset={`${2 * Math.PI * 30 * (1 - pacingScore / 100)}`} strokeLinecap="round" stroke="currentColor" fill="transparent" r="30" cx="40" cy="40" />
                      </svg>
                      <span className="absolute text-xs font-bold font-mono">{pacingScore.toFixed(0)}%</span>
                    </div>
                  </div>

                  {/* Gauge 2: Transformative */}
                  <div className="rounded-lg border bg-background/40 p-2.5 flex flex-col items-center text-center">
                    <span className="text-[10px] font-medium text-muted-foreground mb-1">Originality</span>
                    <div className="relative flex items-center justify-center">
                      <svg className="w-20 h-20 -rotate-90">
                        <circle className="text-muted/30" strokeWidth="4" stroke="currentColor" fill="transparent" r="30" cx="40" cy="40" />
                        <circle className={transformativeScore > 50 ? "text-success" : "text-destructive"} strokeWidth="4" strokeDasharray={`${2 * Math.PI * 30}`} strokeDashoffset={`${2 * Math.PI * 30 * (1 - transformativeScore / 100)}`} strokeLinecap="round" stroke="currentColor" fill="transparent" r="30" cx="40" cy="40" />
                      </svg>
                      <span className="absolute text-xs font-bold font-mono">{transformativeScore.toFixed(0)}%</span>
                    </div>
                  </div>

                  {/* Gauge 3: Stock/AI */}
                  <div className="rounded-lg border bg-background/40 p-2.5 flex flex-col items-center text-center">
                    <span className="text-[10px] font-medium text-muted-foreground mb-1">AI / Stock Ratio</span>
                    <div className="relative flex items-center justify-center">
                      <svg className="w-20 h-20 -rotate-90">
                        <circle className="text-muted/30" strokeWidth="4" stroke="currentColor" fill="transparent" r="30" cx="40" cy="40" />
                        <circle className="text-destructive" strokeWidth="4" strokeDasharray={`${2 * Math.PI * 30}`} strokeDashoffset={`${2 * Math.PI * 30 * (1 - aiStockScore / 100)}`} strokeLinecap="round" stroke="currentColor" fill="transparent" r="30" cx="40" cy="40" />
                      </svg>
                      <span className="absolute text-xs font-bold font-mono">{aiStockScore.toFixed(0)}%</span>
                    </div>
                  </div>

                  {/* Gauge 4: Scale coordination */}
                  <div className="rounded-lg border bg-background/40 p-2.5 flex flex-col items-center text-center">
                    <span className="text-[10px] font-medium text-muted-foreground mb-1">Spam Spike</span>
                    <div className="relative flex items-center justify-center">
                      <svg className="w-20 h-20 -rotate-90">
                        <circle className="text-muted/30" strokeWidth="4" stroke="currentColor" fill="transparent" r="30" cx="40" cy="40" />
                        <circle className="text-primary" strokeWidth="4" strokeDasharray={`${2 * Math.PI * 30}`} strokeDashoffset={`${2 * Math.PI * 30 * (1 - scaleSpamScore / 100)}`} strokeLinecap="round" stroke="currentColor" fill="transparent" r="30" cx="40" cy="40" />
                      </svg>
                      <span className="absolute text-xs font-bold font-mono">{scaleSpamScore.toFixed(0)}%</span>
                    </div>
                  </div>

                  {/* Gauge 5: Metadata Safety */}
                  <div className="rounded-lg border bg-background/40 p-2.5 flex flex-col items-center text-center col-span-2">
                    <span className="text-[10px] font-medium text-muted-foreground mb-1">Title & Tags Safe</span>
                    <div className="relative flex items-center justify-center">
                      <svg className="w-20 h-20 -rotate-90">
                        <circle className="text-muted/30" strokeWidth="4" stroke="currentColor" fill="transparent" r="30" cx="40" cy="40" />
                        <circle className={metadataSafeScore >= 50 ? "text-success" : "text-destructive"} strokeWidth="4" strokeDasharray={`${2 * Math.PI * 30}`} strokeDashoffset={`${2 * Math.PI * 30 * (1 - metadataSafeScore / 100)}`} strokeLinecap="round" stroke="currentColor" fill="transparent" r="30" cx="40" cy="40" />
                      </svg>
                      <span className="absolute text-xs font-bold font-mono">{metadataSafeScore.toFixed(0)}%</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* CROSS-CONTAMINATION ALERT */}
              {isAssetCrossContaminated && (
                <div className="rounded-lg border border-warning/40 bg-warning/10 p-3 flex gap-3 animate-in fade-in zoom-in duration-300">
                  <AlertOctagon className="h-5 w-5 text-warning shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <h4 className="text-xs font-bold text-warning">Asset Cross-Contamination Warning</h4>
                    <p className="text-[10px] text-warning/90 leading-relaxed">
                      Background acoustic loops match highly saturated stock-voice profiles. Vary your editing pace to bypass continuous fingerprinting loops.
                    </p>
                  </div>
                </div>
              )}

              <div className="border-t border-border/40 my-3" />

              {/* Title & Desc Editor */}
              <div className="space-y-3">
                <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest flex items-center gap-1">
                  <Edit3 className="h-3.5 w-3.5" /> Live Metadata Editor
                </div>

                <div className="space-y-2">
                  <input
                    type="text"
                    value={editedTitle}
                    onChange={(e) => setEditedTitle(e.target.value)}
                    className="w-full text-xs rounded-lg border bg-background px-3 py-2 outline-none focus:border-primary focus:ring-1 focus:ring-primary text-foreground font-semibold"
                    placeholder="Video Title"
                  />
                  <textarea
                    value={editedDesc}
                    onChange={(e) => setEditedDesc(e.target.value)}
                    rows={2}
                    className="w-full text-xs rounded-lg border bg-background px-3 py-2 outline-none focus:border-primary focus:ring-1 focus:ring-primary text-foreground resize-none"
                    placeholder="Video Description"
                  />

                  {allViolations.length > 0 && (
                    <div className="rounded-lg border border-destructive/20 bg-destructive/5 p-2 flex gap-2">
                      <AlertTriangle className="h-3.5 w-3.5 text-destructive shrink-0 mt-0.5" />
                      <div className="text-[9px] text-muted-foreground leading-snug">
                        Unsafe terms matched: <strong className="text-foreground">{allViolations.join(", ")}</strong>. Clean them to restore monetization compliance.
                      </div>
                    </div>
                  )}

                  {isSpamMetadata && (
                    <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-2 flex gap-2 animate-in fade-in duration-300">
                      <AlertOctagon className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
                      <div className="text-[10px] font-semibold text-destructive leading-snug">
                        High Risk of Misleading Metadata / Spam Flag
                        <p className="font-normal mt-0.5 text-destructive/80">
                          Keyword repetition detected &gt; 4 times. This violates YouTube's deceptive practices policy.
                        </p>
                      </div>
                    </div>
                  )}

                  <button
                    onClick={() => updateMetadataMutation.mutate()}
                    disabled={updateMetadataMutation.isPending || !editedTitle.trim()}
                    className="w-full inline-flex items-center justify-center gap-1.5 rounded-xl bg-success px-3 py-2 text-xs font-bold text-success-foreground hover:bg-success/90 disabled:opacity-50 transition-all cursor-pointer"
                  >
                    {updateMetadataMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                    Save & Resolve Video
                  </button>
                </div>
              </div>

              <div className="border-t border-border/40 my-3" />

              {/* Automated Actions */}
              <div className="grid grid-cols-3 gap-2">
                <button
                  onClick={() => handleRemedy(selectedVideo.id, "remediate")}
                  disabled={remedyMutation.isPending}
                  className="rounded-lg border bg-primary/10 hover:bg-primary/20 text-primary-foreground py-2 text-[10px] font-bold text-center transition-colors cursor-pointer"
                >
                  Auto-Clean
                </button>
                <button
                  onClick={() => handleRemedy(selectedVideo.id, "dismiss")}
                  disabled={remedyMutation.isPending}
                  className="rounded-lg border bg-background/50 hover:bg-accent py-2 text-[10px] font-bold text-center transition-colors cursor-pointer"
                >
                  Dismiss
                </button>
                <button
                  onClick={() => handleRemedy(selectedVideo.id, "verify")}
                  disabled={remedyMutation.isPending}
                  className="rounded-lg border bg-background/50 hover:bg-accent py-2 text-[10px] font-bold text-center transition-colors cursor-pointer"
                >
                  Human verify
                </button>
              </div>
            </div>
          ) : (
            <div className="py-16 text-center text-xs text-muted-foreground flex flex-col items-center gap-2">
              <Eye className="h-7 w-7 text-muted/40" />
              <span>Select an alert or flagged video to load the scorecard and resolve actions.</span>
            </div>
          )}
        </Panel>
        </div>
      </div>

      {/* ── SECTION C: HISTORICAL AUDITS LOG TABLE ── */}
      <Panel title="Recent audit results log" subtitle="Historical report archives of scans executed across your organization library">
        <div className="-mx-5 overflow-x-auto">
          {auditResults && auditResults.length > 0 ? (
            <table className="w-full text-sm">
              <thead className="text-left text-[11px] uppercase tracking-wider text-muted-foreground">
                <tr className="border-b">
                  <th className="px-5 py-2 font-medium">Scan ID</th>
                  <th className="px-3 py-2 font-medium">Audit Type</th>
                  <th className="px-3 py-2 font-medium">Risk Score</th>
                  <th className="px-3 py-2 font-medium">Severity</th>
                  <th className="px-3 py-2 font-medium">Video</th>
                  <th className="px-5 py-2 font-medium text-right">Processed At</th>
                </tr>
              </thead>
              <tbody>
                {auditResults.map((s: any) => (
                  <tr key={s.id} className="border-b last:border-0 hover:bg-accent/40">
                    <td className="px-5 py-3 font-mono text-xs text-primary">{s.id.substring(0, 8)}...</td>
                    <td className="px-3 py-3 font-medium capitalize">{s.audit_type.replace(/_/g, " ").toLowerCase()}</td>
                    <td className="px-3 py-3 tabular-nums">{s.risk_score.toFixed(1)}/100</td>
                    <td className="px-3 py-3"><SeverityBadge level={s.severity} /></td>
                    <td 
                      className="px-3 py-3 text-xs max-w-[200px] cursor-pointer"
                      onClick={() => {
                        if (s.video_id) {
                          setSelectedVideoId(s.video_id);
                          const remedyBoard = document.getElementById("remediation-board");
                          if (remedyBoard) {
                            remedyBoard.scrollIntoView({ behavior: "smooth", block: "center" });
                          } else {
                            window.scrollTo({ top: 380, behavior: "smooth" });
                          }
                        }
                      }}
                    >
                      <div className="flex items-center gap-2 group">
                        {s.video?.thumbnail_url ? (
                          <div className="relative shrink-0 w-10 h-7 rounded overflow-hidden border border-border/40 bg-muted">
                            <img src={s.video.thumbnail_url} className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                            <div className="absolute inset-0 bg-black/25 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                              <Play className="h-2.5 w-2.5 fill-current text-white" />
                            </div>
                          </div>
                        ) : (
                          <div className="w-10 h-7 rounded border bg-muted flex items-center justify-center text-muted-foreground shrink-0">
                            <Film className="h-3 w-3" />
                          </div>
                        )}
                        <div className="min-w-0">
                          <div className="font-semibold text-foreground group-hover:text-primary transition-colors truncate">
                            {s.video?.title || "Uploaded Video"}
                          </div>
                          <div className="text-[9px] text-muted-foreground font-mono truncate">
                            {s.video_id?.substring(0, 8) || "Unknown"}...
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-3 text-right text-muted-foreground">
                      {new Date(s.created_at).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="py-8 text-center text-xs text-muted-foreground">No historical audit reports found.</div>
          )}
        </div>
      </Panel>
    </div>
  );
}
