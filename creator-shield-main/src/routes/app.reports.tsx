import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAuth } from "@/hooks/useAuth";
import { FileText, Loader2, Search, AlertCircle, Calendar, Play, Film } from "lucide-react";
import { useState } from "react";
import { InteractiveVideoModal } from "@/components/dashboard/InteractiveVideoModal";

export const Route = createFileRoute("/app/reports")({
  component: ReportsPage,
});

function ReportsPage() {
  const { org } = useAuth();
  const orgId = org?.id || "";
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedVideoId, setSelectedVideoId] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const { data: audits = [], isLoading, error } = useQuery({
    queryKey: ["auditReports", orgId],
    queryFn: () => api.getAuditResults(orgId),
    enabled: !!orgId,

  });

  const filteredAudits = audits.filter(a => 
    a.audit_type.toLowerCase().includes(searchTerm.toLowerCase()) || 
    a.severity.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <FileText className="h-6 w-6 text-primary" />
            Audit Reports
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Historical log of all pre-publish scans and forensic audits.
          </p>
        </div>
        
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Filter reports..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 pr-4 py-2 w-64 bg-card border rounded-lg text-sm focus:ring-1 focus:ring-primary focus:border-primary outline-none transition-all"
            />
          </div>
        </div>
      </div>

      <div className="bg-card border rounded-xl overflow-hidden shadow-sm">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center p-12 text-muted-foreground">
            <Loader2 className="h-8 w-8 animate-spin text-primary mb-4" />
            <p className="text-sm">Fetching audit history...</p>
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center p-12 text-destructive">
            <AlertCircle className="h-8 w-8 mb-4" />
            <p className="text-sm font-semibold">Failed to load reports</p>
          </div>
        ) : filteredAudits.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-16 text-center text-muted-foreground border-dashed border-2 m-4 rounded-xl">
            <FileText className="h-10 w-10 mb-4 opacity-20" />
            <p className="text-sm font-medium text-foreground">No reports found.</p>
            <p className="text-xs mt-1">Run a new audit to generate a report.</p>
          </div>
        ) : (
          <div>
            <div className="bg-primary/5 border-b px-6 py-2.5 text-xs text-primary flex items-center gap-2 font-medium">
              <span className="flex h-2 w-2 rounded-full bg-primary animate-pulse" />
              Tip: Click on a video in the catalog below to view the interactive detail report, check originality breakdown, and apply compliance fixes.
            </div>
            <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="text-xs text-muted-foreground bg-accent/50 uppercase border-b">
                <tr>
                  <th className="px-6 py-4 font-semibold">Compliance Metric</th>
                  <th className="px-6 py-4 font-semibold">Risk Score</th>
                  <th className="px-6 py-4 font-semibold">Risk Level</th>
                  <th className="px-6 py-4 font-semibold">Video</th>
                  <th className="px-6 py-4 font-semibold text-right">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filteredAudits.map((audit) => {
                  const getCreatorMetricName = (type: string) => {
                    const t = type.toUpperCase();
                    if (t === "SCRIPT_SIMILARITY") return "Script Originality";
                    if (t === "VISUAL_SIMILARITY") return "Visual Diversity";
                    if (t === "ASSET_REUSE") return "B-Roll Originality";
                    if (t === "VOICE_FORENSIC") return "Voice Authenticity";
                    if (t === "VELOCITY_ANOMALY") return "Upload Pacing Compliance";
                    if (t === "HUMAN_VALUE") return "Human Commentary Value";
                    if (t === "DEEPFAKE_SCAN") return "Monetization Readiness";
                    return type;
                  };

                  return (
                    <tr key={audit.id} className="hover:bg-accent/30 transition-colors">
                      <td className="px-6 py-4 font-semibold text-foreground text-xs">{getCreatorMetricName(audit.audit_type)}</td>
                      <td className="px-6 py-4">
                        <span className="font-semibold text-destructive">{Math.round(audit.risk_score)}% Risk</span>
                      </td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-1 rounded-full text-[10px] font-bold tracking-wider uppercase ${
                        audit.severity === 'critical' ? 'bg-red-500/15 text-red-500 border border-red-500/30' :
                        audit.severity === 'high' ? 'bg-red-500/10 text-red-400 border border-red-500/20' :
                        audit.severity === 'medium' ? 'bg-yellow-500/10 text-yellow-500 border border-yellow-500/20' :
                        'bg-success/10 text-success border border-success/20'
                      }`}>
                        {audit.severity}
                      </span>
                    </td>
                    <td 
                      className="px-6 py-4 text-xs max-w-[220px] cursor-pointer"
                      onClick={() => {
                        setSelectedVideoId(audit.video_id);
                        setIsModalOpen(true);
                      }}
                    >
                      <div className="flex items-center gap-2 group">
                        {audit.video?.thumbnail_url ? (
                          <div className="relative shrink-0 w-12 h-8 rounded overflow-hidden border border-border/40 bg-muted">
                            <img src={audit.video.thumbnail_url} className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                            <div className="absolute inset-0 bg-black/30 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                              <Play className="h-3 w-3 fill-current text-white" />
                            </div>
                          </div>
                        ) : (
                          <div className="w-12 h-8 rounded border bg-muted flex items-center justify-center text-muted-foreground shrink-0">
                            <Film className="h-3.5 w-3.5" />
                          </div>
                        )}
                        <div className="min-w-0">
                          <div className="font-semibold text-foreground group-hover:text-primary transition-colors truncate">
                            {audit.video?.title || "Uploaded Video"}
                          </div>
                          <div className="text-[10px] text-muted-foreground font-mono truncate">
                            {audit.video_id?.substring(0, 8) || "Unknown"}...
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right text-muted-foreground flex items-center justify-end gap-1.5">
                      <Calendar className="h-3 w-3" />
                      {new Date(audit.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                    </td>
                  </tr>
                )})}
              </tbody>
            </table>
          </div>
        </div>
      )}
      </div>
      <InteractiveVideoModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        videoId={selectedVideoId}
        orgId={orgId}
      />
    </div>
  );
}
