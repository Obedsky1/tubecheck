import { createFileRoute, Link } from "@tanstack/react-router";
import { useAuth } from "@/hooks/useAuth";
import { Lock, Activity, ShieldCheck, Mail, CheckCircle2, ChevronRight, Zap, Loader2, Power } from "lucide-react";
import { Panel } from "@/components/dashboard/Panel";
import { useState } from "react";
import { api } from "@/lib/api";
import { toast } from "sonner";

export const Route = createFileRoute("/app/daily-report")({
  component: DailyReportPage,
});

function DailyReportPage() {
  const { org, syncSession } = useAuth();
  const [isToggling, setIsToggling] = useState(false);
  
  // Free tier check
  const isPremium = org?.plan_tier === "PRO" || org?.plan_tier === "ENTERPRISE";
  const isActive = org?.daily_monitoring_enabled || false;

  const handleToggle = async (enabled: boolean) => {
    if (!org?.id) return;
    setIsToggling(true);
    try {
      await api.toggleDailyMonitoring(org.id, enabled);
      await syncSession(); // Refresh the org state
      toast.success(enabled ? "Automated background monitoring activated!" : "Background monitoring disabled.");
    } catch (err: any) {
      toast.error(err.message || "Failed to update monitoring status");
    } finally {
      setIsToggling(false);
    }
  };

  if (!isPremium) {
    return (
      <div className="space-y-6 max-w-5xl mx-auto">
        <div className="flex flex-col items-center justify-center py-20 px-4 text-center">
          <div className="relative mb-6">
            <div className="absolute inset-0 bg-primary/20 blur-[50px] rounded-full" />
            <div className="relative h-24 w-24 rounded-full bg-background border border-primary/20 flex items-center justify-center shadow-2xl">
              <Lock className="h-10 w-10 text-primary" />
            </div>
          </div>
          
          <h2 className="text-3xl font-extrabold tracking-tight mb-3">
            Unlock Automated Daily Monitoring
          </h2>
          <p className="text-muted-foreground max-w-lg mb-8 text-sm leading-relaxed">
            Stop manually syncing your channels. Upgrade to Premium to have CreatorShield automatically scan your entire network every 24 hours, identify risks while you sleep, and deliver compliance reports directly to your inbox.
          </p>
          
          <div className="grid sm:grid-cols-2 gap-4 max-w-2xl w-full mb-10">
            <div className="flex flex-col items-center p-6 rounded-2xl border bg-card/50">
              <Activity className="h-6 w-6 text-primary mb-3" />
              <h4 className="font-bold text-sm">24/7 Background Scans</h4>
              <p className="text-xs text-muted-foreground mt-1">We automatically sync and scan new uploads.</p>
            </div>
            <div className="flex flex-col items-center p-6 rounded-2xl border bg-card/50">
              <Mail className="h-6 w-6 text-primary mb-3" />
              <h4 className="font-bold text-sm">Daily Email Reports</h4>
              <p className="text-xs text-muted-foreground mt-1">Get summary reports delivered to your team.</p>
            </div>
          </div>

          <Link 
            to="/app/pricing"
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-8 py-4 text-sm font-bold text-primary-foreground shadow-lg hover:bg-primary/90 hover:scale-105 transition-all duration-300"
          >
            <Zap className="h-4 w-4" />
            Activate Premium Monitoring
          </Link>
        </div>
      </div>
    );
  }

  // Premium View - Inactive
  if (!isActive) {
    return (
      <div className="space-y-6 max-w-5xl mx-auto animate-in fade-in duration-500">
        <div className="flex flex-col items-center justify-center py-20 px-4 text-center">
          <div className="relative mb-6">
            <div className="absolute inset-0 bg-primary/20 blur-[50px] rounded-full animate-pulse" />
            <div className="relative h-24 w-24 rounded-full bg-background border border-primary/20 flex items-center justify-center shadow-2xl">
              <Power className="h-10 w-10 text-primary opacity-50" />
            </div>
          </div>
          
          <h2 className="text-3xl font-extrabold tracking-tight mb-3">
            Activate Background Monitoring
          </h2>
          <p className="text-muted-foreground max-w-lg mb-8 text-sm leading-relaxed">
            Your premium account includes 24/7 automated network scanning. Enable this feature to have CreatorShield scan your channels every 24 hours.
          </p>

          <button 
            onClick={() => handleToggle(true)}
            disabled={isToggling}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-8 py-4 text-sm font-bold text-primary-foreground shadow-lg hover:bg-primary/90 hover:scale-105 transition-all duration-300 disabled:opacity-50 disabled:pointer-events-none"
          >
            {isToggling ? <Loader2 className="h-4 w-4 animate-spin" /> : <Power className="h-4 w-4" />}
            Turn On Auto-Scans
          </button>
        </div>
      </div>
    );
  }

  // Premium View - Active
  return (
    <div className="space-y-6 max-w-7xl mx-auto animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Activity className="h-6 w-6 text-primary" />
            Daily Network Report
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Overview of your automated 24-hour compliance scans.
          </p>
        </div>
        
        <div className="flex items-center gap-4">
          <button 
            onClick={() => handleToggle(false)}
            disabled={isToggling}
            className="text-xs text-muted-foreground hover:text-foreground underline underline-offset-4 disabled:opacity-50"
          >
            {isToggling ? "Disabling..." : "Disable Monitoring"}
          </button>
          <div className="flex items-center gap-2 bg-success/10 text-success border border-success/20 px-4 py-2 rounded-lg shadow-sm">
            <span className="relative flex h-2.5 w-2.5 mr-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-success opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-success"></span>
            </span>
            <span className="text-xs font-bold uppercase tracking-wider">Background Monitoring Active</span>
          </div>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        <Panel title="Last 24 Hours" subtitle="Network activity summary">
          <div className="space-y-6 pt-2">
            <div className="flex items-center justify-between">
              <div className="text-sm font-medium text-muted-foreground">Channels Synced</div>
              <div className="text-2xl font-bold">12</div>
            </div>
            <div className="flex items-center justify-between">
              <div className="text-sm font-medium text-muted-foreground">New Videos Audited</div>
              <div className="text-2xl font-bold text-primary">34</div>
            </div>
            <div className="flex items-center justify-between">
              <div className="text-sm font-medium text-muted-foreground">Risks Flagged</div>
              <div className="text-2xl font-bold text-destructive">2</div>
            </div>
          </div>
        </Panel>

        <Panel className="md:col-span-2" title="Recent Auto-Scans" subtitle="Automated audits executed today">
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex items-center justify-between p-3 rounded-lg border bg-background/50 hover:bg-accent/40 transition-colors cursor-pointer">
                <div className="flex items-center gap-3">
                  <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                    <ShieldCheck className="h-4 w-4 text-primary" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold">Automated Network Sweep #{1042 + i}</h4>
                    <p className="text-[11px] text-muted-foreground">Completed successfully across 12 channels.</p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <span className="text-xs text-muted-foreground font-mono">Today, 12:00 AM</span>
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                </div>
              </div>
            ))}
          </div>
        </Panel>
      </div>
    </div>
  );
}
