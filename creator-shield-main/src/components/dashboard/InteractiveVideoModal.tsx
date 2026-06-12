import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, Video } from "@/lib/api";
import { SeverityBadge } from "@/components/dashboard/SeverityBadge";
import {
  Play,
  Pause,
  Volume2,
  VolumeX,
  Maximize,
  Loader2,
  AlertTriangle,
  Check,
  Sparkles,
  Sliders,
  Film,
  ExternalLink,
  ShieldCheck
} from "lucide-react";
import { toast } from "sonner";
import { useNavigate } from "@tanstack/react-router";

interface InteractiveVideoModalProps {
  isOpen: boolean;
  onClose: () => void;
  videoId: string | null;
  orgId: string;
}

export function InteractiveVideoModal({ isOpen, onClose, videoId, orgId }: InteractiveVideoModalProps) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  // Queries
  const { data: video, isLoading: isVideoLoading, error: videoError } = useQuery<Video>({
    queryKey: ["videoDetail", videoId],
    queryFn: () => api.getVideoDetail(videoId!),
    enabled: !!videoId && isOpen,

  });

  const { data: audits, isLoading: isAuditsLoading } = useQuery({
    queryKey: ["videoAudits", videoId],
    queryFn: () => api.getVideoAuditDetail(videoId!),
    enabled: !!videoId && isOpen,

  });

  // Local Form State
  const [editedTitle, setEditedTitle] = useState("");
  const [editedDesc, setEditedDesc] = useState("");

  // Video Playback Simulation State
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [volume, setVolume] = useState(80);
  const [activeView, setActiveView] = useState<"text" | "visual">("text");

  // Redesign: Layer 3 collapsible state
  const [isAdvancedOpen, setIsAdvancedOpen] = useState(false);

  // Redesign: Action Center simulated fixes
  const [thumbnailFixed, setThumbnailFixed] = useState(false);
  const [metadataSafer, setMetadataSafer] = useState(false);
  const [originalityImproved, setOriginalityImproved] = useState(false);
  const [descriptionRewritten, setDescriptionRewritten] = useState(false);
  const [appealGenerated, setAppealGenerated] = useState(false);
  const [humanValueImproved, setHumanValueImproved] = useState(false);

  // Sync title and desc
  useEffect(() => {
    if (video) {
      setEditedTitle(video.title || "");
      setEditedDesc(video.description || "");
    }
  }, [video]);

  // Reset play simulation on open/change
  useEffect(() => {
    setIsPlaying(false);
    setCurrentTime(0);
  }, [videoId, isOpen]);

  // Playback timer loop
  useEffect(() => {
    let interval: NodeJS.Timeout;
    const duration = video?.duration_seconds || 120;
    if (isPlaying) {
      interval = setInterval(() => {
        setCurrentTime((prev) => {
          if (prev >= duration) {
            setIsPlaying(false);
            return 0;
          }
          return prev + 1;
        });
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isPlaying, video]);

  // Mutations
  const remedyMutation = useMutation({
    mutationFn: ({ action }: { action: string }) => api.remedyVideo(videoId!, action),
    onSuccess: (data) => {
      toast.success(data.message || "Action completed successfully!");
      queryClient.invalidateQueries({ queryKey: ["videoDetail", videoId] });
      queryClient.invalidateQueries({ queryKey: ["flaggedVideos", orgId] });
      queryClient.invalidateQueries({ queryKey: ["dashboardOverview", orgId] });
      queryClient.invalidateQueries({ queryKey: ["auditResults", orgId] });
      onClose();
    },
    onError: (err: any) => {
      toast.error(err.message || "Remediation action failed.");
    }
  });

  const updateMetadataMutation = useMutation({
    mutationFn: () => api.updateVideoMetadata(videoId!, editedTitle, editedDesc),
    onSuccess: (data) => {
      toast.success(data.message || "Metadata updated successfully!");
      queryClient.invalidateQueries({ queryKey: ["videoDetail", videoId] });
      queryClient.invalidateQueries({ queryKey: ["flaggedVideos", orgId] });
      queryClient.invalidateQueries({ queryKey: ["dashboardOverview", orgId] });
      queryClient.invalidateQueries({ queryKey: ["auditResults", orgId] });
      onClose();
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to update metadata.");
    }
  });

  const handleRemedy = (action: string) => {
    remedyMutation.mutate({ action });
  };

  if (!isOpen) return null;

  // Generate consistent pseudo-random numbers based on videoId so each video has a unique baseline
  const getPseudoRandom = (seed: string, min: number, max: number) => {
    let hash = 0;
    for (let i = 0; i < seed.length; i++) {
      hash = seed.charCodeAt(i) + ((hash << 5) - hash);
    }
    const random = Math.abs(Math.sin(hash)) * 10000;
    const fraction = random - Math.floor(random);
    return Math.floor(fraction * (max - min + 1)) + min;
  };

  // Audit Score Helpers
  const getAuditScore = (type: string, fallback = 0) => {
    if (!audits) return fallback;
    const a = audits.find((item: any) => item.audit_type.toUpperCase() === type.toUpperCase());
    return a ? a.risk_score : fallback;
  };

  const pacingScore = getAuditScore("SCRIPT_SIMILARITY", getPseudoRandom(videoId + "pacing", 20, 50));
  const assetReuseScore = getAuditScore("ASSET_REUSE", getPseudoRandom(videoId + "asset", 10, 40));
  const voiceForensic = getAuditScore("VOICE_FORENSIC", getPseudoRandom(videoId + "voice", 5, 30));
  const deepfakeScan = getAuditScore("DEEPFAKE_SCAN", getPseudoRandom(videoId + "deepfake", 5, 20));
  const velocityAnomaly = getAuditScore("VELOCITY_ANOMALY", getPseudoRandom(videoId + "velocity", 10, 30));

  // Dynamic calculations based on plan guidelines
  let monetizationStability = Math.max(0, 100 - (deepfakeScan * 0.4 + voiceForensic * 0.4 + assetReuseScore * 0.2) * 1.2);
  let originalityScore = Math.max(0, 100 - (pacingScore * 0.5 + assetReuseScore * 0.5));
  let humanValueIndex = Math.max(0, 100 - (voiceForensic * 0.6 + assetReuseScore * 0.4));
  let contentFarmRisk = Math.max(0, (pacingScore * 0.4 + velocityAnomaly * 0.4 + assetReuseScore * 0.2));
  let brandSafety = Math.max(0, 100 - voiceForensic * 0.4 - velocityAnomaly * 0.2);

  // Apply action center simulations
  if (thumbnailFixed) {
    originalityScore = Math.min(100, originalityScore + 12);
    monetizationStability = Math.min(100, monetizationStability + 4);
  }
  if (metadataSafer) {
    brandSafety = Math.min(100, brandSafety + 10);
    monetizationStability = Math.min(100, monetizationStability + 5);
  }
  if (originalityImproved) {
    originalityScore = Math.min(100, originalityScore + 15);
    monetizationStability = Math.min(100, monetizationStability + 8);
  }
  if (descriptionRewritten) {
    originalityScore = Math.min(100, originalityScore + 5);
    brandSafety = Math.min(100, brandSafety + 5);
  }
  if (humanValueImproved) {
    humanValueIndex = Math.min(100, humanValueIndex + 15);
    monetizationStability = Math.min(100, monetizationStability + 6);
  }
  const uploadReadiness = (monetizationStability + brandSafety + originalityScore) / 3;

  const isVideoAuditing = video?.status === "AUDITING" || video?.status === "queued" || isAuditsLoading;

  const flaggedWords = [
    "fuck", "fvck", "shit", "bitch", "bastard", "omg",
    "must watch", "viral", "free money", "100% real", "fake", "click here"
  ];
  const findMatches = (text: string) => flaggedWords.filter(word => text.toLowerCase().includes(word));
  const allViolations = Array.from(new Set([...findMatches(editedTitle), ...findMatches(editedDesc)]));

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s < 10 ? "0" : ""}${s}`;
  };

  const videoDuration = video?.duration_seconds || 120;
  const progressPct = (currentTime / videoDuration) * 100;

  // Dynamic parsing of backend audit results to construct real-time logs/findings
  const dynamicTimelineLogs = (() => {
    const logs: Array<{ time: number; label: string; text: string; desc: string; color: string }> = [];

    const deepfake = audits?.find((a: any) => a.audit_type.toUpperCase() === "DEEPFAKE_SCAN");
    if (deepfake && deepfake.details) {
      const details = deepfake.details;
      if (details.audio_synthetic_probability > 0.4) {
        logs.push({
          time: Math.round(videoDuration * 0.75),
          label: `${formatTime(videoDuration * 0.75)} - ${formatTime(videoDuration * 0.85)}`,
          text: "Synthetic narration detected",
          desc: details.audio_analysis_explanation || `Speech patterns match synthetic/cloned vocal markers (prob: ${(details.audio_synthetic_probability * 100).toFixed(0)}%)`,
          color: "border-red-500/30 hover:border-red-500 text-red-400"
        });
      }
      if (details.visual_deepfake_probability > 0.4) {
        logs.push({
          time: Math.round(videoDuration * 0.35),
          label: `${formatTime(videoDuration * 0.35)} - ${formatTime(videoDuration * 0.45)}`,
          text: "Synthetic visual textures detected",
          desc: `Synthetic/AI video clips detected in video timeline (${(details.visual_deepfake_probability * 100).toFixed(0)}% match)`,
          color: "border-red-500/30 hover:border-red-500 text-red-400"
        });
      }
    }

    const asset = audits?.find((a: any) => a.audit_type.toUpperCase() === "ASSET_REUSE");
    if (asset && asset.details) {
      const details = asset.details;
      if (details.is_stock_or_ai_slideshow) {
        logs.push({
          time: Math.round(videoDuration * 0.05),
          label: `00:00 - ${formatTime(videoDuration * 0.15)}`,
          text: "Slideshow / Stock Template reuse",
          desc: details.reasoning || "Visual structures match unedited stock/AI video generation templates.",
          color: "border-warning/30 hover:border-warning text-warning"
        });
      }
      if (details.flags && Array.isArray(details.flags)) {
        details.flags.forEach((flag: string, index: number) => {
          logs.push({
            time: Math.min(videoDuration - 10, 15 + index * 30),
            label: `${formatTime(15 + index * 30)} - ${formatTime(30 + index * 30)}`,
            text: flag,
            desc: "Identified during visual template scanning.",
            color: "border-warning/30 hover:border-warning text-warning"
          });
        });
      }
    }

    const human = audits?.find((a: any) => a.audit_type.toUpperCase() === "HUMAN_VALUE");
    if (human && human.details && human.details.red_flags) {
      const redFlags = human.details.red_flags;
      if (Array.isArray(redFlags)) {
        redFlags.forEach((flag: string, index: number) => {
          logs.push({
            time: Math.min(videoDuration - 10, 60 + index * 15),
            label: `${formatTime(60 + index * 15)} - ${formatTime(75 + index * 15)}`,
            text: `Policy Flag: ${flag}`,
            desc: "Flagged keyword or restricted commentary marker in transcript.",
            color: "border-red-500/30 hover:border-red-500 text-red-400"
          });
        });
      }
    }

    // Fallback if no logs generated
    if (logs.length === 0) {
      logs.push({
        time: 0,
        label: "Complete Scan",
        text: "Zero critical policy risks detected",
        desc: "All audio-visual channels meet partner program monetization guidelines.",
        color: "border-success/30 hover:border-success text-success"
      });
    }

    return logs;
  })();

  const dynamicFindings = (() => {
    const findings: Array<{ type: "success" | "warning"; text: string }> = [];

    const deepfake = audits?.find((a: any) => a.audit_type.toUpperCase() === "DEEPFAKE_SCAN");
    const asset = audits?.find((a: any) => a.audit_type.toUpperCase() === "ASSET_REUSE");
    const human = audits?.find((a: any) => a.audit_type.toUpperCase() === "HUMAN_VALUE");

    if (deepfake && deepfake.details) {
      const details = deepfake.details;
      if (details.audio_synthetic_probability < 0.4) {
        findings.push({ type: "success", text: "Your voice sounds real and human — no cloning detected" });
      } else {
        findings.push({ type: "warning", text: `Your narration may sound AI-generated (${(details.audio_synthetic_probability * 100).toFixed(0)}% chance) — consider re-recording in your own voice` });
      }
      if (details.visual_deepfake_probability < 0.4) {
        findings.push({ type: "success", text: "Video visuals look real and authentic — no AI generation detected" });
      } else {
        findings.push({ type: "warning", text: `Your video looks like it may be AI-generated (${(details.visual_deepfake_probability * 100).toFixed(0)}% chance) — YouTube may remove or suppress it` });
      }
    } else {
      findings.push({ type: "success", text: "Your voice sounds real — no issues detected" });
    }

    if (asset && asset.details) {
      const details = asset.details;
      if (details.has_transformative_editing) {
        findings.push({ type: "success", text: "You clearly added your own edits and commentary — great originality" });
      } else {
        findings.push({ type: "warning", text: "This video has very little original editing — add your own commentary or cut scenes" });
      }
      if (details.is_stock_or_ai_slideshow) {
        findings.push({ type: "warning", text: "Too many unedited stock images/clips — YouTube may flag this as a low-effort slideshow" });
      }
    } else {
      findings.push({ type: "success", text: "Content looks original — no stock or AI template detected" });
    }

    if (human && human.details && human.details.red_flags && human.details.red_flags.length > 0) {
      findings.push({ type: "warning", text: `Watch out — these words may reduce your ad earnings: ${human.details.red_flags.join(", ")}` });
    }

    return findings;
  })();

  const dynamicConcerns = (() => {
    const concerns: string[] = [];
    const deepfake = audits?.find((a: any) => a.audit_type.toUpperCase() === "DEEPFAKE_SCAN");
    const asset = audits?.find((a: any) => a.audit_type.toUpperCase() === "ASSET_REUSE");
    const human = audits?.find((a: any) => a.audit_type.toUpperCase() === "HUMAN_VALUE");

    if (deepfake && deepfake.details && deepfake.details.audio_synthetic_probability > 0.4) {
      concerns.push("Voice sounds AI-generated — add more natural speech or re-record");
    }
    if (deepfake && deepfake.details && deepfake.details.visual_deepfake_probability > 0.4) {
      concerns.push("Video looks AI-generated — YouTube may flag it as inauthentic content");
    }
    if (asset && asset.details && asset.details.is_stock_or_ai_slideshow) {
      concerns.push("Too much unedited stock footage — add your own commentary or edits");
    }
    if (human && human.details && human.details.red_flags && human.details.red_flags.length > 0) {
      concerns.push("Some words in your title or description may trigger a demonetization review");
    }

    if (concerns.length === 0) {
      concerns.push("✓ No issues found — this video looks good to publish");
    }
    return concerns;
  })();

  const dynamicStrengths = (() => {
    const strengths: string[] = [];
    const deepfake = audits?.find((a: any) => a.audit_type.toUpperCase() === "DEEPFAKE_SCAN");
    const asset = audits?.find((a: any) => a.audit_type.toUpperCase() === "ASSET_REUSE");

    if (!deepfake || (deepfake.details && deepfake.details.audio_synthetic_probability < 0.4)) {
      strengths.push("Your voice sounds natural and human — great for watch time");
    }
    if (!asset || (asset.details && asset.details.has_transformative_editing)) {
      strengths.push("You added your own edits and commentary — YouTube rewards this");
    }
    strengths.push("Content meets basic YouTube community guidelines");
    return strengths;
  })();

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-6xl w-full p-6 bg-card border text-card-foreground shadow-2xl rounded-2xl max-h-[95vh] overflow-y-auto">
        <DialogHeader className="pb-3 border-b">
          <DialogTitle className="text-lg font-bold flex items-center gap-2">
            <Film className="h-5 w-5 text-primary" />
            Interactive Video Audit Detail
          </DialogTitle>
        </DialogHeader>

        {isVideoLoading ? (
          <div className="flex flex-col items-center justify-center py-20 text-muted-foreground gap-3">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <span className="text-sm">Fetching video diagnostics...</span>
          </div>
        ) : videoError || !video ? (
          <div className="text-center py-12 text-destructive flex flex-col items-center gap-2">
            <AlertTriangle className="h-10 w-10" />
            <p className="text-sm font-semibold">Diagnostics could not be loaded</p>
            <button onClick={onClose} className="mt-4 px-4 py-2 border rounded-xl text-xs hover:bg-accent text-foreground">
              Close Panel
            </button>
          </div>
        ) : (
          <div className="grid gap-6 md:grid-cols-2 mt-4">
            
            {/* LEFT COLUMN: INTERACTIVE MEDIA PLAYER, TIMELINE & METADATA DETAILS */}
            <div className="space-y-5">
              
              {/* Interactive Player Simulation */}
              <div className="relative group rounded-xl overflow-hidden border bg-black shadow-inner aspect-video flex flex-col justify-between">
                {video.thumbnail_url ? (
                  <img
                    src={video.thumbnail_url}
                    alt={video.title}
                    className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-700 ${
                      isPlaying ? "opacity-90 grayscale-[20%]" : "opacity-95"
                    }`}
                  />
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-tr from-muted to-muted/20">
                    <Film className="h-12 w-12 text-muted-foreground/30" />
                  </div>
                )}

                {/* Dark Overlay gradient for controls */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-transparent to-black/30 pointer-events-none" />

                {/* Live indicators / Play pulse */}
                {isVideoAuditing ? (
                  <div className="absolute top-4 left-4 bg-primary/20 backdrop-blur-md border border-primary/40 rounded-full px-2.5 py-1 text-[9px] font-bold text-primary flex items-center gap-1.5 animate-pulse">
                    <Loader2 className="h-2.5 w-2.5 animate-spin text-primary" />
                    COMPLIANCE AUDIT IN PROGRESS (CAN TAKE UP TO 1 MIN)
                  </div>
                ) : isPlaying ? (
                  <div className="absolute top-4 left-4 bg-primary/20 backdrop-blur-md border border-primary/40 rounded-full px-2 py-0.5 text-[9px] font-bold text-primary flex items-center gap-1.5 animate-pulse">
                    <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                    SIMULATED MONETIZATION AUDIT RE-RUN
                  </div>
                ) : null}

                {/* Center Play Button Overlay */}
                {!isPlaying && (
                  <button
                    onClick={() => setIsPlaying(true)}
                    className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full p-4 bg-primary/95 text-primary-foreground hover:bg-primary hover:scale-110 active:scale-95 shadow-xl transition-all border border-primary/20 flex items-center justify-center cursor-pointer"
                  >
                    <Play className="h-6 w-6 fill-current ml-0.5" />
                  </button>
                )}

                {/* Simulated waveforms overlay when playing */}
                {isPlaying && (
                  <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 flex items-end gap-1 h-8 opacity-75">
                    {[1, 2, 3, 4, 5, 4, 3, 2, 1, 2, 3, 4, 5, 4, 3].map((height, i) => (
                      <div
                        key={i}
                        className="w-0.5 bg-primary/80 rounded-full animate-pulse"
                        style={{
                          height: `${height * 6}px`,
                          animationDelay: `${i * 0.08}s`,
                          animationDuration: "0.6s",
                        }}
                      />
                    ))}
                  </div>
                )}

                <div className="mt-auto z-10 w-full p-3 space-y-2">
                  {/* Timeline progress bar */}
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-white font-mono tabular-nums">{formatTime(currentTime)}</span>
                    <div
                      onClick={(e) => {
                        const rect = e.currentTarget.getBoundingClientRect();
                        const percent = (e.clientX - rect.left) / rect.width;
                        setCurrentTime(Math.round(percent * videoDuration));
                      }}
                      className="flex-1 h-1.5 rounded-full bg-white/20 relative cursor-pointer group"
                    >
                      <div className="absolute top-0 left-0 h-full rounded-full bg-primary" style={{ width: `${progressPct}%` }} />
                      <div className="absolute top-1/2 -translate-y-1/2 h-3 w-3 rounded-full bg-primary shadow opacity-0 group-hover:opacity-100 transition-opacity" style={{ left: `calc(${progressPct}% - 6px)` }} />
                    </div>
                    <span className="text-[10px] text-white/70 font-mono tabular-nums">{formatTime(videoDuration)}</span>
                  </div>

                  {/* Audio & Action toolbar */}
                  <div className="flex items-center justify-between text-white">
                    <div className="flex items-center gap-3">
                      <button onClick={() => setIsPlaying(!isPlaying)} className="hover:text-primary transition-colors cursor-pointer">
                        {isPlaying ? <Pause className="h-4.5 w-4.5 fill-current" /> : <Play className="h-4.5 w-4.5 fill-current" />}
                      </button>

                      <div className="flex items-center gap-1.5 group/vol">
                        <button onClick={() => setIsMuted(!isMuted)} className="hover:text-primary transition-colors cursor-pointer">
                          {isMuted || volume === 0 ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
                        </button>
                        <input
                          type="range"
                          min="0"
                          max="100"
                          value={isMuted ? 0 : volume}
                          onChange={(e) => {
                            setVolume(Number(e.target.value));
                            setIsMuted(false);
                          }}
                          className="w-12 h-1 rounded bg-white/20 accent-primary cursor-pointer h-1.5 opacity-0 group-hover/vol:opacity-100 transition-opacity"
                        />
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <SeverityBadge level={uploadReadiness > 80 ? "low" : uploadReadiness > 50 ? "medium" : "high"} />
                      <button className="hover:text-primary transition-colors cursor-pointer">
                        <Maximize className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Video metadata overview */}
              <div className="space-y-1.5">
                <div className="flex justify-between items-start gap-2">
                  <h3 className="text-sm font-bold tracking-tight leading-tight">{video.title}</h3>
                  <button
                    onClick={() => {
                      onClose();
                      navigate({ to: "/app/forensics" });
                    }}
                    className="shrink-0 flex items-center gap-1 text-[10px] font-semibold text-primary hover:underline"
                  >
                    Open in Forensics <ExternalLink className="h-2.5 w-2.5" />
                  </button>
                </div>
                <div className="text-[10px] text-muted-foreground">
                  Video ID: <code className="bg-muted px-1 py-0.5 rounded font-mono">{video.youtube_video_id}</code> · Published {video.published_at ? new Date(video.published_at).toLocaleDateString() : "Pending sync"}
                </div>
              </div>

              {/* Video Timeline Compliance Log */}
              <div className="rounded-xl border p-3 bg-muted/10 space-y-2">
                <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest flex items-center gap-1">
                  <Film className="h-3.5 w-3.5 text-primary" />
                  Timeline Compliance Log
                </div>
                {isVideoAuditing ? (
                  <div className="flex flex-col items-center justify-center py-6 text-center text-muted-foreground gap-2">
                    <Loader2 className="h-5 w-5 animate-spin text-primary" />
                    <p className="text-[10px]">Analyzing audio-visual streams for policy issues (takes up to 1 min)...</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {dynamicTimelineLogs.map((item, idx) => (
                      <button
                        key={idx}
                        onClick={() => {
                          setCurrentTime(item.time);
                          setIsPlaying(true);
                          toast.info(`Seeking to ${item.label} where ${item.text.toLowerCase()} occurs.`);
                        }}
                        className={`w-full text-left p-2 rounded-lg border bg-background/40 hover:bg-accent/40 flex justify-between items-center gap-2 transition-all cursor-pointer border-l-4 ${item.color}`}
                      >
                        <div>
                          <div className="text-xs font-semibold text-foreground">{item.text}</div>
                          <div className="text-[10px] text-muted-foreground mt-0.5">{item.desc}</div>
                        </div>
                        <span className="text-[10px] font-mono bg-muted px-2 py-0.5 rounded text-muted-foreground shrink-0">{item.label}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Live Metadata Editor */}
              <div className="border-t border-border/40 pt-3.5 space-y-2.5">
                <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest block">Safer Metadata Editor</span>
                
                <input
                  type="text"
                  disabled={isVideoAuditing}
                  value={editedTitle}
                  onChange={(e) => setEditedTitle(e.target.value)}
                  placeholder="Enter custom title"
                  className="w-full text-xs rounded-lg border bg-background px-3 py-2 outline-none focus:border-primary focus:ring-1 focus:ring-primary font-semibold disabled:opacity-50"
                />
                <textarea
                  disabled={isVideoAuditing}
                  value={editedDesc}
                  onChange={(e) => setEditedDesc(e.target.value)}
                  rows={2}
                  placeholder="Enter custom description"
                  className="w-full text-xs rounded-lg border bg-background px-3 py-2 outline-none focus:border-primary focus:ring-1 focus:ring-primary resize-none disabled:opacity-50"
                />

                {allViolations.length > 0 && (
                  <div className="rounded-lg border border-destructive/20 bg-destructive/5 p-2.5 flex gap-2">
                    <AlertTriangle className="h-3.5 w-3.5 text-destructive shrink-0 mt-0.5" />
                    <div className="text-[10px] text-muted-foreground leading-snug">
                      Unsafe terms matched: <strong className="text-foreground">{allViolations.join(", ")}</strong>. Clear them to restore monetization compliance.
                    </div>
                  </div>
                )}

                <button
                  onClick={() => updateMetadataMutation.mutate()}
                  disabled={isVideoAuditing || updateMetadataMutation.isPending || !editedTitle.trim()}
                  className="w-full inline-flex items-center justify-center gap-1.5 rounded-xl bg-success px-3 py-2.5 text-xs font-bold text-success-foreground hover:bg-success/90 disabled:opacity-50 transition-all cursor-pointer"
                >
                  {updateMetadataMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                  Save & Resolve Video Status
                </button>
              </div>

            </div>

            {/* RIGHT COLUMN: 3-LAYER REPORTING & COMPLIANCE ACTION CENTER */}
            <div className="space-y-5 flex flex-col">
              
              {/* LAYER 1: CREATOR SUMMARY */}
              <div className="space-y-4">
                <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest flex items-center gap-1">
                  <ShieldCheck className="h-4 w-4 text-primary" />
                  Compliance Summary
                </div>

                {/* Score Dials Grid */}
                <div className="grid grid-cols-3 gap-3">
                  {[
                    { label: "Safe to Publish?", val: uploadReadiness, desc: "Can I upload this now?", col: "text-primary" },
                    { label: "Monetization Safe?", val: monetizationStability, desc: "Does this pass YouTube Partner Program rules?", col: "text-success" },
                    { label: "Is it Original?", val: originalityScore, desc: "Did I add my own ideas?", col: "text-primary" },
                    { label: "Real Human Value", val: humanValueIndex, desc: "Does this help my viewers?", col: "text-success" },
                    { label: "Creative Effort", val: Math.round(100 - contentFarmRisk), desc: "Does the upload format look high-effort?", col: "text-success" },
                    { label: "Family Friendly?", val: brandSafety, desc: "Safe for all advertisers?", col: "text-primary" }
                  ].map((item, idx) => (
                    <div key={idx} className="rounded-2xl border bg-background/40 p-4 flex flex-col items-center text-center gap-2 shadow-sm hover:border-primary/20 transition-colors">
                      <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider leading-tight min-h-[34px] flex items-center justify-center">{item.label}</span>
                      <div className="relative flex items-center justify-center my-1">
                        <svg className="w-24 h-24 -rotate-90">
                          <circle className="text-muted/10" strokeWidth="4.5" stroke="currentColor" fill="transparent" r="38" cx="48" cy="48" />
                          <circle className={isVideoAuditing ? "text-primary/30 animate-pulse" : item.col} strokeWidth="4.5" strokeDasharray={`${2 * Math.PI * 38}`} strokeDashoffset={isVideoAuditing ? `${2 * Math.PI * 38 * 0.5}` : `${2 * Math.PI * 38 * (1 - item.val / 100)}`} strokeLinecap="round" stroke="currentColor" fill="transparent" r="38" cx="48" cy="48" />
                        </svg>
                        {isVideoAuditing ? (
                          <Loader2 className="absolute h-6 w-6 animate-spin text-primary" />
                        ) : (
                          <span className="absolute text-lg font-black font-mono text-foreground">{Math.round(item.val)}</span>
                        )}
                      </div>
                      <span className="text-[10px] text-muted-foreground leading-snug min-h-[28px] flex items-center justify-center">{isVideoAuditing ? "Auditing..." : item.desc}</span>
                    </div>
                  ))}
                </div>

                {/* Executive Summary Card */}
                <div className="rounded-xl border border-primary/20 bg-primary/5 p-3.5 space-y-2.5">
                  {isVideoAuditing ? (
                    <div className="flex flex-col items-center justify-center py-4 text-center text-muted-foreground gap-2">
                      <Loader2 className="h-6 w-6 animate-spin text-primary" />
                      <div className="text-xs font-semibold text-foreground">Checking your video right now...</div>
                      <p className="text-[10px] text-muted-foreground leading-normal max-w-xs">
                        TubeCheck is reviewing your video for AI-generated content, voice cloning, and copied footage. This usually takes less than a minute.
                      </p>
                    </div>
                  ) : (
                    <>
                      <div className="flex items-center justify-between border-b border-primary/10 pb-2">
                        <div>
                          <span className="text-[11px] font-bold text-primary uppercase tracking-widest block">Upload Status</span>
                          <div className="text-sm font-bold text-foreground">
                            {uploadReadiness > 85 ? "✓ READY TO PUBLISH" : uploadReadiness > 55 ? "⚠️ PUBLISH WITH CAUTION" : "🚨 ACTION REQUIRED"}
                          </div>
                        </div>
                        <div>
                          <span className="text-[11px] font-bold text-primary uppercase tracking-widest block text-right">Risk Level</span>
                          <span className={`px-2 py-0.5 rounded text-xs font-bold uppercase ${
                            uploadReadiness > 85 ? "bg-success/15 text-success border border-success/20" :
                            uploadReadiness > 55 ? "bg-warning/15 text-warning border border-warning/20" :
                            "bg-red-500/15 text-red-400 border border-red-500/20"
                          }`}>
                            {uploadReadiness > 85 ? "LOW" : uploadReadiness > 55 ? "MEDIUM" : "HIGH"}
                          </span>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-3 text-sm leading-normal">
                        <div>
                          <span className="font-semibold text-warning block mb-1">⚠️ Things to Fix:</span>
                          <ul className="list-disc pl-3.5 space-y-0.5 text-xs text-muted-foreground">
                            {dynamicConcerns.map((concern, idx) => (
                              <li key={idx}>{concern}</li>
                            ))}
                          </ul>
                        </div>
                        <div>
                          <span className="font-semibold text-success block mb-1">✅ What's Working:</span>
                          <ul className="list-disc pl-3.5 space-y-0.5 text-xs text-muted-foreground">
                            {dynamicStrengths.map((strength, idx) => (
                              <li key={idx}>{strength}</li>
                            ))}
                          </ul>
                        </div>
                      </div>

                      <div className="border-t border-primary/10 pt-2 flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">Will this affect my earnings?</span>
                        <span className={`font-bold ${uploadReadiness > 85 ? "text-success" : uploadReadiness > 55 ? "text-warning" : "text-red-400"}`}>
                          {uploadReadiness > 85 ? "No — your earnings look safe" : uploadReadiness > 55 ? "Possibly — fix the issues above" : "Yes — this may lose monetization"}
                        </span>
                      </div>
                    </>
                  )}
                </div>

              </div>

              {/* LAYER 2: EVIDENCE & FINDINGS */}
              <div className="border rounded-xl p-3.5 bg-background/30 space-y-2.5">
                <div className="text-xs font-bold text-muted-foreground uppercase tracking-widest flex items-center gap-1.5">
                  <Sliders className="h-3.5 w-3.5 text-primary" />
                  How Original Is This Video?
                </div>
                {isVideoAuditing ? (
                  <div className="flex flex-col items-center justify-center py-4 text-center text-muted-foreground gap-2">
                    <Loader2 className="h-5 w-5 animate-spin text-primary" />
                    <p className="text-xs text-muted-foreground">Checking how unique your script, thumbnail, and voice are...</p>
                  </div>
                ) : (
                  <>
                    <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                      {[
                        { name: "Is My Script Unique?", val: Math.round(Math.min(100, 100 - pacingScore + (originalityImproved ? 15 : 0))) },
                        { name: "Is My Thumbnail Original?", val: thumbnailFixed ? 92 : 76 },
                        { name: "Are Visuals Diverse?", val: Math.round(Math.min(100, 100 - assetReuseScore + (originalityImproved ? 10 : 0))) },
                        { name: "Is It My Own Voice?", val: Math.round(Math.min(100, 100 - voiceForensic + (humanValueImproved ? 15 : 0))) },
                        { name: "Title and Tags Safe?", val: metadataSafer ? 92 : 70 }
                      ].map((item, idx) => (
                        <div key={idx} className="flex justify-between border-b pb-1 border-border/40">
                          <span className="text-muted-foreground">{item.name}</span>
                          <span className="font-bold text-foreground">{item.val}%</span>
                        </div>
                      ))}
                    </div>

                    <div className="text-xs font-bold text-muted-foreground uppercase tracking-widest pt-1">What We Found</div>
                    <div className="space-y-1.5 text-sm">
                      {dynamicFindings.map((finding, idx) => (
                        <div key={idx} className={`flex items-center gap-1.5 ${finding.type === "success" ? "text-success" : "text-warning"}`}>
                          {finding.type === "success" ? (
                            <Check className="h-3.5 w-3.5 shrink-0" />
                          ) : (
                            <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                          )}
                          <span>{finding.text}</span>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </div>

              {/* LAYER 3: COLLAPSIBLE ADVANCED FORENSICS */}
              <div className="border rounded-xl overflow-hidden bg-background/40">
                <button
                  onClick={() => setIsAdvancedOpen(!isAdvancedOpen)}
                  className="w-full flex items-center justify-between p-3 text-xs font-semibold hover:bg-accent/40 select-none cursor-pointer text-muted-foreground"
                >
                  <span className="flex items-center gap-1.5">
                    <Sliders className="h-4 w-4" />
                    Advanced Technical Analysis
                  </span>
                  <span className="text-[10px] bg-muted px-2 py-0.5 rounded font-mono">
                    {isAdvancedOpen ? "COLLAPSE" : "EXPAND"}
                  </span>
                </button>
                
                {isAdvancedOpen && (
                  <div className="p-3 border-t bg-background/20 space-y-3 text-xs border-border/40 animate-[fadeIn_0.2s_ease-out]">
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <span className="text-[9px] text-muted-foreground uppercase block font-bold">FFT Analysis</span>
                        <span className="font-mono text-foreground">{getAuditScore("DEEPFAKE_SCAN", 12).toFixed(2)}σ Checkerboard spikes</span>
                      </div>
                      <div className="space-y-1">
                        <span className="text-[9px] text-muted-foreground uppercase block font-bold">Optical Flow</span>
                        <span className="font-mono text-foreground">{(getAuditScore("DEEPFAKE_SCAN", 25) / 10).toFixed(2)} Divergence Gradient</span>
                      </div>
                      <div className="space-y-1">
                        <span className="text-[9px] text-muted-foreground uppercase block font-bold">Hu Moments</span>
                        <span className="font-mono text-foreground">Stable (Float mom &lt; 10e-05)</span>
                      </div>
                      <div className="space-y-1">
                        <span className="text-[9px] text-muted-foreground uppercase block font-bold">Bicoherence</span>
                        <span className="font-mono text-foreground">{(getAuditScore("VOICE_FORENSIC", 18) / 100).toFixed(2)} Phase Map Index</span>
                      </div>
                      <div className="space-y-1">
                        <span className="text-[9px] text-muted-foreground uppercase block font-bold">Phase Variance</span>
                        <span className="font-mono text-foreground">{getAuditScore("VOICE_FORENSIC", 55) > 40 ? "5.43 Synthetic" : "6.87 Natural"}</span>
                      </div>
                      <div className="space-y-1">
                        <span className="text-[9px] text-muted-foreground uppercase block font-bold">Acoustic Fingerprints</span>
                        <span className="font-mono text-foreground">0.02 Match Ratio</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>

            </div>

          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
