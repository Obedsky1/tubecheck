import { createFileRoute, Link } from "@tanstack/react-router";
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
  Sparkles,
  Edit3,
  Sliders,
  Film,
  Check,
  Flag,
  Filter,
  Search,
  X,
  ChevronRight,
  TrendingDown,
  Zap,
  Clock,
} from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/app/flagged")({
  component: FlaggedVideosPage,
});

function RiskGauge({ label, value, color }: { label: string; value: number; color: string }) {
  const r = 30;
  const circ = 2 * Math.PI * r;
  const offset = circ * (1 - Math.min(value, 100) / 100);
  return (
    <div className="rounded-xl border bg-background/40 p-4 flex flex-col items-center text-center gap-1.5">
      <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider leading-tight min-h-[20px] flex items-center justify-center">
        {label}
      </span>
      <div className="relative flex items-center justify-center my-1">
        <svg className="w-20 h-20 -rotate-90">
          <circle
            stroke="currentColor"
            className="text-muted/20"
            strokeWidth="4"
            fill="transparent"
            r={r}
            cx="40"
            cy="40"
          />
          <circle
            stroke={color}
            strokeWidth="4"
            strokeDasharray={`${circ}`}
            strokeDashoffset={`${offset}`}
            strokeLinecap="round"
            fill="transparent"
            r={r}
            cx="40"
            cy="40"
          />
        </svg>
        <span className="absolute text-sm font-extrabold font-mono">{value.toFixed(0)}%</span>
      </div>
    </div>
  );
}

function FlaggedVideosPage() {
  const { org } = useAuth();
  const orgId = org?.id || "";
  const queryClient = useQueryClient();

  const [selectedVideoId, setSelectedVideoId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [severityFilter, setSeverityFilter] = useState<"all" | "critical" | "high">("all");
  const [editedTitle, setEditedTitle] = useState("");
  const [editedDesc, setEditedDesc] = useState("");

  const { data: flaggedVideos, isLoading } = useQuery({
    queryKey: ["flaggedVideos", orgId],
    queryFn: () => api.getFlaggedVideos(orgId),
    enabled: !!orgId,
  });

  const selectedVideo = flaggedVideos?.find((v: any) => v.id === selectedVideoId);

  useEffect(() => {
    if (selectedVideo) {
      setEditedTitle(selectedVideo.title || "");
      setEditedDesc(selectedVideo.description || "");
    } else {
      setEditedTitle("");
      setEditedDesc("");
    }
  }, [selectedVideoId, selectedVideo]);

  const remedyMutation = useMutation({
    mutationFn: ({ videoId, action }: { videoId: string; action: string }) =>
      api.remedyVideo(videoId, action),
    onSuccess: (data, variables) => {
      toast.success(data.message || "Remediation action completed!");
      queryClient.invalidateQueries({ queryKey: ["flaggedVideos", orgId] });
      queryClient.invalidateQueries({ queryKey: ["dashboardOverview", orgId] });
      if (variables.videoId === selectedVideoId && variables.action !== "verify") {
        setSelectedVideoId(null);
      }
    },
    onError: (err: any) => toast.error(err.message || "Remediation failed."),
  });

  const updateMetadataMutation = useMutation({
    mutationFn: () => api.updateVideoMetadata(selectedVideoId!, editedTitle, editedDesc),
    onSuccess: (data) => {
      toast.success(data.message || "Video metadata updated — status resolved!");
      queryClient.invalidateQueries({ queryKey: ["flaggedVideos", orgId] });
      queryClient.invalidateQueries({ queryKey: ["dashboardOverview", orgId] });
      setSelectedVideoId(null);
    },
    onError: (err: any) => toast.error(err.message || "Failed to save metadata."),
  });

  // Filtering
  const filteredVideos = (flaggedVideos || []).filter((v: any) => {
    const matchesSearch =
      !searchQuery ||
      v.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      v.channel_title?.toLowerCase().includes(searchQuery.toLowerCase());
    const maxRisk = getVideoMaxRisk(v);
    const matchesSeverity =
      severityFilter === "all" ||
      (severityFilter === "critical" && maxRisk >= 80) ||
      (severityFilter === "high" && maxRisk >= 60 && maxRisk < 80);
    return matchesSearch && matchesSeverity;
  });

  // Audit score helpers
  const getAuditScore = (type: string, fallback = 0) => {
    if (!selectedVideo?.audits) return fallback;
    const a = selectedVideo.audits.find((a: any) => a.audit_type === type);
    return a ? a.risk_score : fallback;
  };
  const pacingScore = getAuditScore("SCRIPT_SIMILARITY", 40);
  const assetReuseScore = getAuditScore("ASSET_REUSE", 20);
  const transformativeScore = Math.max(0, 100 - assetReuseScore);
  const aiStockScore = Math.max(
    getAuditScore("VOICE_FORENSIC", 15), 
    getAuditScore("DEEPFAKE_SCAN", 10),
    getAuditScore("HUMAN_VALUE", 5)
  );
  const scaleSpamScore = getAuditScore("VELOCITY_ANOMALY", 25);

  // Policy word scanner
  const flaggedWords = [
    "fuck", "fvck", "shit", "bitch", "bastard", "omg",
    "must watch", "viral", "free money", "100% real", "fake", "click here",
  ];
  const findMatches = (text: string) =>
    flaggedWords.filter((w) => text.toLowerCase().includes(w));
  const allViolations = Array.from(
    new Set([...findMatches(editedTitle), ...findMatches(editedDesc)])
  );

  // Summary stats
  const total = flaggedVideos?.length || 0;
  const critical = (flaggedVideos || []).filter(
    (v: any) => getVideoMaxRisk(v) >= 80
  ).length;
  const avgRisk =
    total > 0
      ? (flaggedVideos || []).reduce((acc: number, v: any) => {
          return acc + getVideoMaxRisk(v);
        }, 0) / total
      : 0;

  if (!orgId) {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <p className="text-muted-foreground text-sm">No active organization. Please log in again.</p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex h-[60vh] items-center justify-center gap-2">
        <Loader2 className="h-7 w-7 animate-spin text-primary" />
        <span className="text-sm text-muted-foreground">Loading flagged videos...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* ── HEADER ── */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight flex items-center gap-2">
            <Flag className="h-5 w-5 text-destructive" />
            Flagged Videos
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Review, remediate, and resolve policy-violating content across all connected channels.
            {" "}
            Learn how to <Link to="/blog/$slug" params={{ slug: "fix-youtube-reused-content" }} className="text-primary hover:underline">resolve monetization strikes permanently</Link>.
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className="rounded-full bg-destructive/10 border border-destructive/20 px-3 py-1 text-xs font-semibold text-destructive">
            {total} flagged
          </span>
        </div>
      </div>

      {/* ── STATS ROW ── */}
      <section className="grid gap-3 sm:grid-cols-3">
        {[
          {
            icon: Flag,
            label: "Total Flagged",
            value: total.toString(),
            tone: "text-destructive",
            bg: "bg-destructive/5 border-destructive/20",
          },
          {
            icon: Zap,
            label: "Critical Risk",
            value: critical.toString(),
            tone: "text-orange-400",
            bg: "bg-orange-400/5 border-orange-400/20",
          },
          {
            icon: TrendingDown,
            label: "Avg Risk Score",
            value: `${avgRisk.toFixed(1)}%`,
            tone: "text-warning",
            bg: "bg-warning/5 border-warning/20",
          },
        ].map((s) => (
          <div key={s.label} className={`rounded-xl border p-4 ${s.bg}`}>
            <div className={`flex items-center gap-2 text-[11px] uppercase tracking-wider font-semibold ${s.tone}`}>
              <s.icon className="h-3.5 w-3.5" />
              {s.label}
            </div>
            <div className="mt-2 text-2xl font-bold tracking-tight tabular-nums">{s.value}</div>
          </div>
        ))}
      </section>

      {/* ── MAIN GRID ── */}
      <div className="grid gap-6 lg:grid-cols-5">
        {/* Left: Video List (3 cols) */}
        <div className="lg:col-span-3 space-y-3">
          {/* Toolbar */}
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by title or channel…"
                className="w-full rounded-lg border bg-background/60 pl-9 pr-3 py-2 text-xs outline-none focus:border-primary focus:ring-1 focus:ring-primary placeholder:text-muted-foreground/60"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  <X className="h-3 w-3" />
                </button>
              )}
            </div>
            <div className="flex items-center gap-1 rounded-lg border bg-background/60 p-0.5 text-[11px]">
              {(["all", "critical", "high"] as const).map((f) => (
                <button
                  key={f}
                  onClick={() => setSeverityFilter(f)}
                  className={`px-2.5 py-1 rounded-md capitalize transition-colors cursor-pointer ${
                    severityFilter === f
                      ? "bg-accent text-foreground font-semibold"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {f}
                </button>
              ))}
            </div>
          </div>

          {/* Video Cards */}
          {filteredVideos.length > 0 ? (
            <div className="space-y-2 max-h-[calc(100vh-18rem)] overflow-y-auto pr-1">
              {filteredVideos.map((v: any) => {
                const isSelected = v.id === selectedVideoId;
                const maxRisk = getVideoMaxRisk(v);
                const isCritical = maxRisk >= 80;

                return (
                  <div
                    key={v.id}
                    onClick={() => setSelectedVideoId(isSelected ? null : v.id)}
                    className={`group flex items-start gap-3 rounded-xl border p-3.5 transition-all duration-200 cursor-pointer ${
                      isSelected
                        ? "bg-sidebar-accent/80 border-primary shadow-md ring-1 ring-primary/30"
                        : "bg-card/60 hover:bg-sidebar-accent/40 hover:border-muted-foreground/30"
                    }`}
                  >
                    {/* Thumbnail */}
                    {v.thumbnail_url ? (
                      <img
                        src={v.thumbnail_url}
                        alt={v.title}
                        className="h-14 w-24 shrink-0 rounded-lg object-cover border bg-muted shadow-sm transition-transform group-hover:scale-[1.02]"
                      />
                    ) : (
                      <div className="h-14 w-24 shrink-0 rounded-lg bg-muted/60 border flex items-center justify-center">
                        <AlertOctagon className="h-5 w-5 text-muted-foreground/50" />
                      </div>
                    )}

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[9px] font-semibold text-muted-foreground uppercase tracking-wider truncate">
                          {v.channel_title}
                        </span>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <span
                            className={`text-xs font-bold tabular-nums ${
                              isCritical ? "text-destructive" : "text-orange-400"
                            }`}
                          >
                            {maxRisk.toFixed(0)}% Risk
                          </span>
                          <SeverityBadge level={isCritical ? "critical" : "high"} />
                        </div>
                      </div>
                      <h4
                        className={`mt-0.5 text-xs font-semibold tracking-tight truncate transition-colors ${
                          isSelected ? "text-primary" : "text-foreground group-hover:text-primary"
                        }`}
                      >
                        {v.title}
                      </h4>
                      <div className="mt-1 flex items-center gap-2 text-[10px] text-muted-foreground">
                        <code className="bg-muted/60 px-1.5 py-0.5 rounded font-mono text-[9px]">
                          {v.youtube_video_id || v.id.substring(0, 8)}
                        </code>
                        {v.published_at && (
                          <>
                            <Clock className="h-2.5 w-2.5" />
                            {new Date(v.published_at).toLocaleDateString()}
                          </>
                        )}
                        {v.audits?.length > 0 && (
                          <span className="ml-auto text-[9px] text-muted-foreground/60">
                            {v.audits.length} audit{v.audits.length > 1 ? "s" : ""}
                          </span>
                        )}
                      </div>
                    </div>

                    <ChevronRight
                      className={`h-4 w-4 shrink-0 mt-3 transition-all ${
                        isSelected ? "text-primary rotate-90" : "text-muted-foreground/30 group-hover:text-muted-foreground"
                      }`}
                    />
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-20 text-center rounded-xl border border-dashed bg-background/20 space-y-3">
              <ShieldCheck className="h-9 w-9 text-success" />
              <div>
                <h4 className="text-sm font-bold">All Clear</h4>
                <p className="text-[11px] text-muted-foreground max-w-xs mt-1">
                  {searchQuery || severityFilter !== "all"
                    ? "No videos match your current filters."
                    : "Zero policy flags are active across your connected channel network."}
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Right: Remediation Board (2 cols) */}
        <div className="lg:col-span-2">
          <Panel
            title="Remediation Board"
            subtitle={selectedVideo ? `Resolving: ${selectedVideo.title}` : "Select a video to begin"}
          >
            {selectedVideo ? (
              <div className="space-y-5">
                {/* Video Header */}
                <div className="flex items-center gap-3 rounded-xl border bg-background/30 p-3">
                  {selectedVideo.thumbnail_url ? (
                    <img
                      src={selectedVideo.thumbnail_url}
                      alt={selectedVideo.title}
                      className="h-12 w-18 rounded-lg object-cover border shrink-0"
                    />
                  ) : (
                    <div className="h-12 w-16 rounded-lg bg-muted/60 border flex items-center justify-center shrink-0">
                      <Film className="h-4 w-4 text-muted-foreground/50" />
                    </div>
                  )}
                  <div className="min-w-0">
                    <div className="text-[9px] font-semibold text-primary uppercase tracking-wider">
                      {selectedVideo.channel_title}
                    </div>
                    <div className="text-xs font-bold truncate mt-0.5">{selectedVideo.title}</div>
                    <div className="text-[10px] text-muted-foreground mt-0.5 italic line-clamp-2">
                      {selectedVideo.description || "No description."}
                    </div>
                  </div>
                </div>

                {/* Authenticity Gauges */}
                <div>
                  <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest flex items-center gap-1 mb-2">
                    <Sliders className="h-3.5 w-3.5" /> Authenticity Breakdown
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <RiskGauge label="Pacing Rigidity" value={pacingScore} color="oklch(0.82 0.18 80)" />
                    <RiskGauge label="Originality" value={transformativeScore} color={transformativeScore > 50 ? "oklch(0.72 0.19 145)" : "oklch(0.64 0.21 22)"} />
                    <RiskGauge label="AI & Policy Risk" value={aiStockScore} color={aiStockScore > 50 ? "oklch(0.64 0.21 22)" : "oklch(0.72 0.19 145)"} />
                    <RiskGauge label="Spam Spike" value={scaleSpamScore} color="oklch(0.68 0.20 270)" />
                  </div>
                </div>

                <div className="border-t border-border/40" />

                {/* Live Metadata Editor */}
                <div>
                  <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest flex items-center gap-1 mb-2">
                    <Edit3 className="h-3.5 w-3.5" /> Live Metadata Editor
                  </div>
                  <div className="space-y-2">
                    <input
                      type="text"
                      value={editedTitle}
                      onChange={(e) => setEditedTitle(e.target.value)}
                      className="w-full text-xs rounded-lg border bg-background px-3 py-2 outline-none focus:border-primary focus:ring-1 focus:ring-primary font-semibold"
                      placeholder="Video Title"
                    />
                    <textarea
                      value={editedDesc}
                      onChange={(e) => setEditedDesc(e.target.value)}
                      rows={3}
                      className="w-full text-xs rounded-lg border bg-background px-3 py-2 outline-none focus:border-primary focus:ring-1 focus:ring-primary resize-none"
                      placeholder="Video Description"
                    />

                    {allViolations.length > 0 && (
                      <div className="rounded-lg border border-destructive/20 bg-destructive/5 p-2.5 flex gap-2">
                        <AlertTriangle className="h-3.5 w-3.5 text-destructive shrink-0 mt-0.5" />
                        <div className="text-[10px] text-muted-foreground leading-snug">
                          Policy terms detected:{" "}
                          <strong className="text-foreground">{allViolations.join(", ")}</strong>.{" "}
                          Remove them to restore monetization compliance.
                        </div>
                      </div>
                    )}

                    <button
                      onClick={() => updateMetadataMutation.mutate()}
                      disabled={updateMetadataMutation.isPending || !editedTitle.trim()}
                      className="w-full inline-flex items-center justify-center gap-1.5 rounded-xl bg-success px-3 py-2.5 text-xs font-bold text-success-foreground hover:bg-success/90 disabled:opacity-50 transition-all cursor-pointer"
                    >
                      {updateMetadataMutation.isPending ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Check className="h-3.5 w-3.5" />
                      )}
                      Save & Resolve Video
                    </button>
                  </div>
                </div>

                <div className="border-t border-border/40" />

                {/* Quick Actions */}
                <div>
                  <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest flex items-center gap-1 mb-2">
                    <Sparkles className="h-3.5 w-3.5" /> Quick Actions
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <button
                      onClick={() => remedyMutation.mutate({ videoId: selectedVideo.id, action: "remediate" })}
                      disabled={remedyMutation.isPending}
                      className="rounded-lg border border-primary/30 bg-primary/10 hover:bg-primary/20 text-primary py-2.5 text-[10px] font-bold transition-colors cursor-pointer"
                    >
                      Auto-Clean
                    </button>
                    <button
                      onClick={() => remedyMutation.mutate({ videoId: selectedVideo.id, action: "dismiss" })}
                      disabled={remedyMutation.isPending}
                      className="rounded-lg border bg-background/50 hover:bg-accent py-2.5 text-[10px] font-bold transition-colors cursor-pointer"
                    >
                      Dismiss
                    </button>
                    <button
                      onClick={() => remedyMutation.mutate({ videoId: selectedVideo.id, action: "verify" })}
                      disabled={remedyMutation.isPending}
                      className="rounded-lg border bg-background/50 hover:bg-accent py-2.5 text-[10px] font-bold transition-colors cursor-pointer"
                    >
                      Verify
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="py-20 text-center flex flex-col items-center gap-3">
                <div className="h-14 w-14 rounded-full bg-muted/30 flex items-center justify-center">
                  <Eye className="h-6 w-6 text-muted-foreground/40" />
                </div>
                <div>
                  <p className="text-sm font-semibold">No video selected</p>
                  <p className="text-[11px] text-muted-foreground mt-1">
                    Click any flagged video from the list to load its compliance scorecard and resolve actions.
                  </p>
                </div>
              </div>
            )}
          </Panel>
        </div>
      </div>
    </div>
  );
}
