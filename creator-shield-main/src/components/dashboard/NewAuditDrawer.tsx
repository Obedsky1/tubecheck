import { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAuth } from "@/hooks/useAuth";
import { motion, AnimatePresence } from "framer-motion";
import { X, Upload, FileVideo, Loader2, Play, AlertCircle } from "lucide-react";
import { toast } from "sonner";

interface NewAuditDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

export function NewAuditDrawer({ isOpen, onClose }: NewAuditDrawerProps) {
  const { org } = useAuth();
  const orgId = org?.id || "";
  const queryClient = useQueryClient();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadType, setUploadType] = useState<"independent" | "channel">("independent");
  const [channelId, setChannelId] = useState<string>("");
  const [scans, setScans] = useState<string[]>(["deepfake", "transcript", "visual"]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Fetch channels if they select "channel" upload type
  const { data: channelsData } = useQuery({
    queryKey: ["channels", orgId],
    queryFn: () => api.getChannels(orgId),
    enabled: !!orgId,
  });

  // Reset state when drawer opens/closes
  useEffect(() => {
    if (!isOpen) {
      setTitle("");
      setDescription("");
      setSelectedFile(null);
      setUploadType("independent");
      setChannelId("");
      setScans(["deepfake", "transcript", "visual"]);
    }
  }, [isOpen]);

  // Upload Mutation
  const uploadMutation = useMutation({
    mutationFn: (formData: FormData) => api.uploadAudit(formData),
    onSuccess: (data) => {
      toast.success(data.message || "Video uploaded and audit pipeline started!");
      queryClient.invalidateQueries({ queryKey: ["auditQueue", orgId] });
      queryClient.invalidateQueries({ queryKey: ["auditResults", orgId] });
      onClose();
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to upload video for auditing.");
    },
  });

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      setSelectedFile(file);
      if (!title) {
        // Auto-fill title from filename
        setTitle(file.name.substring(0, file.name.lastIndexOf(".")) || file.name);
      }
    }
  };

  const handleAudit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile || !orgId) return;

    const formData = new FormData();
    formData.append("org_id", orgId);
    formData.append("title", title);
    formData.append("description", description);
    formData.append("upload_type", uploadType);
    if (uploadType === "channel" && channelId) {
      formData.append("channel_id", channelId);
    }
    formData.append("scans", scans.join(","));
    formData.append("file", selectedFile);

    uploadMutation.mutate(formData);
  };

  if (typeof document === "undefined") return null;

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop overlay */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-xs"
          />

          {/* Drawer panel */}
          <motion.div
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 25, stiffness: 220 }}
            className="fixed inset-y-0 right-0 z-[101] w-full max-w-lg bg-card border-l p-6 shadow-2xl overflow-y-auto flex flex-col"
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b pb-4 mb-6">
              <div>
                <h3 className="text-base font-bold tracking-tight text-foreground flex items-center gap-2">
                  <Play className="h-4.5 w-4.5 text-primary" /> Start Forensic Audit
                </h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Upload raw media files to run deepfake, template pacing, and audio reviews.
                </p>
              </div>
              <button
                onClick={onClose}
                className="rounded-lg border p-1.5 hover:bg-accent text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Form Workspace */}
            {orgId ? (
              <form onSubmit={handleAudit} className="flex-1 flex flex-col space-y-5 justify-between">
                <div className="space-y-4">
                  {/* Drag-and-drop zone */}
                  <div
                    onClick={() => fileInputRef.current?.click()}
                    className="flex flex-col items-center justify-center border-2 border-dashed rounded-xl p-8 hover:bg-accent/20 cursor-pointer relative transition-colors group"
                  >
                    <input
                      type="file"
                      ref={fileInputRef}
                      accept="video/mp4,video/webm,video/quicktime,video/x-msvideo,video/x-matroska"
                      onChange={handleFileChange}
                      className="hidden"
                      disabled={uploadMutation.isPending}
                    />
                    <Upload className="h-9 w-9 text-muted-foreground group-hover:text-primary mb-3 transition-colors animate-pulse" />
                    {selectedFile ? (
                      <div className="text-center space-y-1">
                        <p className="text-sm font-semibold text-foreground truncate max-w-xs">{selectedFile.name}</p>
                        <p className="text-xs text-muted-foreground">{(selectedFile.size / (1024 * 1024)).toFixed(1)} MB</p>
                      </div>
                    ) : (
                      <div className="text-center space-y-1">
                        <p className="text-sm font-semibold">Drag & drop video file here, or click to browse</p>
                        <p className="text-xs text-muted-foreground">Supports MP4, MKV, MOV, WEBM (Max 100MB)</p>
                      </div>
                    )}
                  </div>

                  {/* Title */}
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Video Title</label>
                    <input
                      type="text"
                      required
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      placeholder="e.g. Episode 43 - Redundancy Check"
                      className="w-full text-xs rounded-lg border bg-background px-3.5 py-2.5 outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all text-foreground"
                      disabled={uploadMutation.isPending}
                    />
                  </div>

                  {/* Description */}
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Audit Metadata context (Optional)</label>
                    <textarea
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      placeholder="Identify specific script references or visual segments to prioritize."
                      rows={2}
                      className="w-full text-xs rounded-lg border bg-background px-3.5 py-2.5 outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all text-foreground resize-none"
                      disabled={uploadMutation.isPending}
                    />
                  </div>

                  {/* Destination */}
                  <div className="space-y-3 pt-2">
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Upload Destination</label>
                    <div className="flex items-center gap-4">
                      <label className="flex items-center gap-2 text-sm text-foreground cursor-pointer">
                        <input
                          type="radio"
                          name="uploadType"
                          value="independent"
                          checked={uploadType === "independent"}
                          onChange={() => setUploadType("independent")}
                          className="accent-primary"
                        />
                        Independent Upload
                      </label>
                      <label className="flex items-center gap-2 text-sm text-foreground cursor-pointer">
                        <input
                          type="radio"
                          name="uploadType"
                          value="channel"
                          checked={uploadType === "channel"}
                          onChange={() => setUploadType("channel")}
                          className="accent-primary"
                        />
                        Link to YouTube Channel
                      </label>
                    </div>

                    {uploadType === "channel" && (
                      <div className="pt-1">
                        <select
                          value={channelId}
                          onChange={(e) => setChannelId(e.target.value)}
                          required
                          className="w-full text-xs rounded-lg border bg-background px-3.5 py-2.5 outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all text-foreground"
                        >
                          <option value="" disabled>Select a connected channel...</option>
                          {channelsData?.channels?.map((ch: any) => (
                            <option key={ch.id} value={ch.id}>
                              {ch.title || ch.youtube_channel_id}
                            </option>
                          ))}
                        </select>
                      </div>
                    )}
                  </div>

                  {/* Scans Selection */}
                  <div className="space-y-3 pt-2">
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Select Scans to Run</label>
                    <div className="space-y-2">
                      <label className="flex items-center gap-2 text-sm text-foreground cursor-pointer">
                        <input
                          type="checkbox"
                          checked={scans.includes("transcript")}
                          onChange={(e) => {
                            if (e.target.checked) setScans([...scans, "transcript"]);
                            else setScans(scans.filter(s => s !== "transcript"));
                          }}
                          className="accent-primary rounded"
                        />
                        Transcription & Policy Audit
                      </label>
                      <label className="flex items-center gap-2 text-sm text-foreground cursor-pointer">
                        <input
                          type="checkbox"
                          checked={scans.includes("deepfake")}
                          onChange={(e) => {
                            if (e.target.checked) setScans([...scans, "deepfake"]);
                            else setScans(scans.filter(s => s !== "deepfake"));
                          }}
                          className="accent-primary rounded"
                        />
                        Deepfake & Synthetic Media Scan
                      </label>
                      <label className="flex items-center gap-2 text-sm text-foreground cursor-pointer">
                        <input
                          type="checkbox"
                          checked={scans.includes("visual")}
                          onChange={(e) => {
                            if (e.target.checked) setScans([...scans, "visual"]);
                            else setScans(scans.filter(s => s !== "visual"));
                          }}
                          className="accent-primary rounded"
                        />
                        Visual Originality & Reused Assets
                      </label>
                    </div>
                  </div>
                </div>

                {/* Submissions buttons */}
                <div className="border-t pt-4 mt-auto">
                  <button
                    type="submit"
                    disabled={uploadMutation.isPending || !selectedFile}
                    className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-xs font-bold text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-all cursor-pointer shadow-lg shadow-primary/10"
                  >
                    {uploadMutation.isPending ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" /> Ingesting & Running Scans...
                      </>
                    ) : (
                      <>
                        <Play className="h-3.5 w-3.5" /> Start Forensic Audit Pipeline
                      </>
                    )}
                  </button>
                </div>
              </form>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-center p-6 text-muted-foreground space-y-2">
                <AlertCircle className="h-8 w-8 text-destructive" />
                <h4 className="text-sm font-semibold">Active Session Required</h4>
                <p className="text-xs">Please check your organization connection and try again.</p>
              </div>
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>,
    document.body
  );
}
