import { Outlet, createFileRoute, useRouterState, useNavigate } from "@tanstack/react-router";
import { AppSidebar } from "@/components/layout/AppSidebar";
import { TopBar } from "@/components/layout/TopBar";
import { useAuth } from "@/hooks/useAuth";
import { useEffect, useState } from "react";
import { Loader2, Youtube, LogOut } from "lucide-react";
import { api, Channel } from "@/lib/api";
import { toast } from "sonner";

const titles: Record<string, string> = {
  "/app": "Dashboard",
  "/app/channels": "Channels",
  "/app/flagged": "Flagged Videos",
  "/app/appeals": "Strike Appeals",
  "/app/forensics": "Forensics Control",
  "/app/reports": "Audit Reports",
  "/app/settings": "Settings",
  "/app/niche-finder": "AI Niche & RPM Checker",
  "/app/daily-report": "Daily Monitoring Report",
};

import { useSupabaseRealtime } from "@/hooks/useSupabaseRealtime";

export const Route = createFileRoute("/app")({
  component: AppLayout,
});

function AppLayout() {
  const { token, user, org, initialized, initialize, logout } = useAuth();
  useSupabaseRealtime();
  const navigate = useNavigate();
  const [realChannels, setRealChannels] = useState<Channel[]>(() => {
    if (typeof window !== "undefined") {
      try {
        const raw = localStorage.getItem("cs_channels");
        return raw ? JSON.parse(raw) : [];
      } catch {
        return [];
      }
    }
    return [];
  });
  const [channelsReady, setChannelsReady] = useState(() => {
    if (typeof window !== "undefined") {
      const raw = localStorage.getItem("cs_channels");
      return !!raw;
    }
    return false;
  });
  const [channelIdInput, setChannelIdInput] = useState("");
  const [connecting, setConnecting] = useState(false);

  const fetchChannels = async () => {
    if (!org?.id) return;
    try {
      const res = await api.getChannels(org.id);
      const list = res.channels || [];
      setRealChannels(list);
      try {
        localStorage.setItem("cs_channels", JSON.stringify(list));
      } catch {}
    } catch (err) {
      console.error("Failed to fetch channels in layout:", err);
    } finally {
      setChannelsReady(true);
    }
  };

  // Step 1: auth init — runs once
  useEffect(() => {
    initialize();
  }, [initialize]);

  // Step 2: once auth is resolved, redirect or fetch channels
  useEffect(() => {
    if (!initialized) return;
    if (!token) {
      navigate({ to: "/login" });
      return;
    }
    if (user && org) {
      fetchChannels();
    } else if (user && !org) {
      // No org means new account — skip channel fetch
      setChannelsReady(true);
    }
  }, [initialized, token, user, org]);

  const handleConnect = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!channelIdInput.trim()) return;

    setConnecting(true);
    try {
      const orgs = await api.getMyOrgs();
      const orgId = orgs.length > 0 ? orgs[0].id : null;
      if (!orgId) throw new Error("No organization found");

      await api.connectChannels({
        org_id: orgId,
        youtube_channel_ids: [channelIdInput.trim()],
      });
      toast.success("YouTube channel connected successfully! Syncing started.");
      setChannelIdInput("");
      await fetchChannels();
    } catch (err: any) {
      toast.error(err.message || "Failed to connect YouTube channel");
    } finally {
      setConnecting(false);
    }
  };

  const path = useRouterState({ select: (r) => r.location.pathname });
  let title = titles[path] ?? "Channel";
  if (path.startsWith("/app/channels/") && path !== "/app/channels") title = "Channel Intelligence";

  // Only block on auth — NOT on channel fetch
  if (!initialized || (token && !user)) {
    return (
      <div className="flex min-h-screen w-full items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <span className="text-sm text-muted-foreground">Verifying workspace settings...</span>
        </div>
      </div>
    );
  }

  if (!token) return null;

  // Show channel onboarding only once channels have been checked and list is empty
  if (channelsReady && realChannels.length === 0) {
    return (
      <div className="relative min-h-screen flex flex-col items-center justify-center bg-background px-4 overflow-hidden">
        {/* Background grids and glows */}
        <div className="pointer-events-none absolute inset-0 -z-10 grid-bg opacity-30 [mask-image:radial-gradient(ellipse_at_center,black,transparent_75%)]" />
        <div className="pointer-events-none absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] rounded-full bg-primary/10 blur-[100px] opacity-70" />

        <div className="w-full max-w-md space-y-6">
          <div className="flex flex-col items-center text-center">
            <h1 className="text-2xl font-bold tracking-tight text-gradient">TubeCheck</h1>
            <p className="mt-1.5 text-sm text-muted-foreground">First, let's connect your YouTube channel</p>
          </div>

          <div className="rounded-2xl border bg-card/60 glass hairline p-6 md:p-8 shadow-xl space-y-6">
            <div className="flex flex-col items-center text-center space-y-4">
              <div className="rounded-full bg-red-500/10 p-4 ring-8 ring-red-500/5">
                <Youtube className="h-10 w-10 text-red-500" />
              </div>
              <p className="text-xs text-muted-foreground">
                TubeCheck will securely scan your public video history, transcripts, and metadata to check for policy violations and monetization risks.
              </p>
            </div>

            <form onSubmit={handleConnect} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground">YouTube Channel ID</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    required
                    value={channelIdInput}
                    onChange={(e) => setChannelIdInput(e.target.value)}
                    placeholder="e.g. UCxxxxxxxxxxxxxxxxxxxx"
                    className="flex-1 rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary transition-colors"
                  />
                  <button
                    type="submit"
                    disabled={connecting}
                    className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-colors"
                  >
                    {connecting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Youtube className="h-4 w-4" />}
                    Connect
                  </button>
                </div>
              </div>

              <div className="rounded-lg border bg-background/40 p-4 text-xs text-muted-foreground space-y-2 hairline">
                <div className="font-semibold text-foreground">How to locate your YouTube Channel ID:</div>
                <ol className="list-decimal pl-4 space-y-1">
                  <li>Open YouTube in a web browser and sign in.</li>
                  <li>Click your avatar &rarr; <strong>Settings</strong> &rarr; <strong>Advanced settings</strong>.</li>
                  <li>Copy the <strong>Channel ID</strong>. It starts with <code>UC</code>.</li>
                </ol>
              </div>
            </form>

            <div className="border-t pt-4 text-center">
              <button onClick={logout} className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1.5 mx-auto transition-colors">
                <LogOut className="h-3.5 w-3.5" /> Sign out
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // While channels are still loading in background, render app shell with a subtle top bar indicator
  return (
    <div className="flex min-h-screen w-full bg-background">
      <AppSidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar title={title} />
        {!channelsReady && (
          <div className="h-0.5 w-full overflow-hidden bg-muted">
            <div className="h-full w-1/3 animate-[shimmer_1.2s_ease-in-out_infinite] bg-gradient-to-r from-transparent via-primary to-transparent" />
          </div>
        )}
        <main className="flex-1 px-4 py-6 md:px-8 md:py-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
