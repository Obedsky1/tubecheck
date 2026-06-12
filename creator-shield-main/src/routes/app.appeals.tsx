import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { api, Channel } from "@/lib/api";
import { Gavel, Sparkles, AlertCircle, Copy, CheckCircle2, HeadphonesIcon, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";

export const Route = createFileRoute("/app/appeals")({
  component: AppealsPage,
});

function AppealsPage() {
  const { org, initialize } = useAuth();
  const [channels, setChannels] = useState<Channel[]>([]);
  const [selectedChannelId, setSelectedChannelId] = useState<string>("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedScript, setGeneratedScript] = useState<string | null>(null);
  const [isCopied, setIsCopied] = useState(false);
  const [isLoadingChannels, setIsLoadingChannels] = useState(true);

  useEffect(() => {
    async function loadChannels() {
      if (!org?.id) return;
      try {
        const res = await api.getChannels(org.id);
        setChannels(res.channels || []);
        if (res.channels && res.channels.length > 0) {
          setSelectedChannelId(res.channels[0].id);
        }
      } catch (err) {
        console.error("Failed to load channels:", err);
        toast.error("Could not load your connected channels.");
      } finally {
        setIsLoadingChannels(false);
      }
    }
    loadChannels();
  }, [org?.id]);

  const handleGenerate = async () => {
    if (!selectedChannelId) {
      toast.error("Please select a channel first.");
      return;
    }

    if ((org?.available_credits || 0) < 5) {
      toast.error("Insufficient credits. Generating an appeal costs 5 credits.");
      return;
    }

    setIsGenerating(true);
    setGeneratedScript(null);
    setIsCopied(false);

    try {
      const res = await api.generateAppeal(selectedChannelId);
      setGeneratedScript(res.script);
      toast.success("Appeal script generated successfully!");
      await initialize(); // Refresh credits
    } catch (err: any) {
      console.error("Generation failed:", err);
      toast.error(err.message || "Failed to generate appeal. Please try again.");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleCopy = () => {
    if (generatedScript) {
      navigator.clipboard.writeText(generatedScript);
      setIsCopied(true);
      toast.success("Copied to clipboard!");
      setTimeout(() => setIsCopied(false), 2000);
    }
  };

  return (
    <div className="mx-auto max-w-5xl space-y-8">
      <div className="space-y-2">
        <h2 className="text-2xl font-bold tracking-tight">Automated Strike Appeal Generator</h2>
        <p className="text-muted-foreground">
          Got hit with a "Reused Content" or "Repetitious Content" demonetization strike? Let our AI draft a perfect video appeal script based on your channel's vector footprint.
          {" "}
          <Link to="/blog/$slug" params={{ slug: "fix-youtube-reused-content" }} className="text-primary hover:underline">
            Read our 2026 Guide to Fixing Reused Content
          </Link>.
        </p>
      </div>

      <div className="grid gap-8 md:grid-cols-12">
        {/* Left Column: Controls */}
        <div className="space-y-6 md:col-span-5">
          
          <div className="rounded-xl border bg-card p-6 shadow-sm space-y-5">
            <div className="space-y-2">
              <label className="text-sm font-medium">Select Affected Channel</label>
              <select
                className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                value={selectedChannelId}
                onChange={(e) => setSelectedChannelId(e.target.value)}
                disabled={isLoadingChannels || isGenerating}
              >
                {isLoadingChannels ? (
                  <option>Loading channels...</option>
                ) : channels.length === 0 ? (
                  <option>No channels connected</option>
                ) : (
                  channels.map(c => (
                    <option key={c.id} value={c.id}>{c.title}</option>
                  ))
                )}
              </select>
            </div>

            <button
              onClick={handleGenerate}
              disabled={isGenerating || !selectedChannelId || channels.length === 0}
              className="w-full flex items-center justify-center gap-2 rounded-md bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground shadow hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 transition-colors"
            >
              {isGenerating ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Generating Appeal...
                </>
              ) : (
                <>
                  <Gavel className="h-4 w-4" />
                  Generate Appeal (Costs 5 Credits)
                </>
              )}
            </button>
          </div>

          {/* AI Banner */}
          <div className="rounded-xl border border-blue-500/20 bg-blue-500/5 p-5">
            <div className="flex gap-3">
              <div className="mt-0.5 rounded-full bg-blue-500/20 p-2 text-blue-600 dark:text-blue-400">
                <Sparkles className="h-5 w-5" />
              </div>
              <div className="space-y-1">
                <h4 className="font-medium text-blue-900 dark:text-blue-200">Powered by Google Gemini</h4>
                <p className="text-sm text-blue-800/80 dark:text-blue-300/80 leading-relaxed">
                  Drafted by Google's Official AI (Gemini). We securely scan your entire YouTube channel's vector footprint to cryptographically prove originality to the YouTube review team.
                </p>
              </div>
            </div>
          </div>

          {/* Upsell Banner */}
          <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-5">
            <div className="flex gap-3">
              <div className="mt-0.5 rounded-full bg-amber-500/20 p-2 text-amber-600 dark:text-amber-400">
                <HeadphonesIcon className="h-5 w-5" />
              </div>
              <div className="space-y-2">
                <h4 className="font-medium text-amber-900 dark:text-amber-200">Need a guaranteed win?</h4>
                <p className="text-sm text-amber-800/80 dark:text-amber-300/80 leading-relaxed">
                  Appeals are a one-shot opportunity. If you fail, you wait 90 days. Contact our professional support team to handle this appeal manually on your behalf.
                </p>
                <a 
                  href="mailto:support@creatorshield.com" 
                  className="inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 border border-amber-500/30 bg-amber-500/10 hover:bg-amber-500/20 text-amber-900 dark:text-amber-200 h-9 px-4 py-2 mt-2"
                >
                  Contact Support
                </a>
              </div>
            </div>
          </div>

        </div>

        {/* Right Column: Output */}
        <div className="md:col-span-7 flex flex-col">
          <div className="rounded-xl border bg-card flex-1 flex flex-col overflow-hidden shadow-sm">
            <div className="border-b px-6 py-4 flex items-center justify-between bg-muted/30">
              <h3 className="font-semibold flex items-center gap-2">
                <AlertCircle className="h-4 w-4 text-muted-foreground" />
                Generated Appeal Script
              </h3>
              {generatedScript && (
                <button
                  onClick={handleCopy}
                  className="inline-flex items-center gap-1.5 rounded-md text-sm font-medium transition-colors hover:text-primary disabled:pointer-events-none disabled:opacity-50 px-2 py-1"
                >
                  {isCopied ? <CheckCircle2 className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
                  {isCopied ? "Copied" : "Copy Script"}
                </button>
              )}
            </div>
            
            <div className="p-6 flex-1 bg-muted/5 relative min-h-[400px]">
              {isGenerating ? (
                <div className="absolute inset-0 flex flex-col items-center justify-center space-y-4">
                  <div className="relative">
                    <div className="h-16 w-16 rounded-full border-4 border-muted border-t-primary animate-spin"></div>
                    <Gavel className="absolute inset-0 m-auto h-6 w-6 text-muted-foreground opacity-50" />
                  </div>
                  <div className="text-center space-y-1">
                    <p className="text-sm font-medium">Analyzing Channel Footprint...</p>
                    <p className="text-xs text-muted-foreground">Drafting legal arguments using Gemini.</p>
                  </div>
                </div>
              ) : generatedScript ? (
                <div className="prose prose-sm dark:prose-invert max-w-none whitespace-pre-wrap leading-relaxed">
                  {generatedScript}
                </div>
              ) : (
                <div className="absolute inset-0 flex flex-col items-center justify-center text-muted-foreground text-sm text-center space-y-3">
                  <Gavel className="h-10 w-10 opacity-20" />
                  <p>Select a channel and generate an appeal to view the script here.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
