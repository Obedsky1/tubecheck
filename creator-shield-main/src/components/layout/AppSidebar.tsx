import { Link, useRouterState } from "@tanstack/react-router";
import {
  LayoutDashboard, Tv, AlertOctagon, Settings, Flag, PlusCircle, FileText, Sparkles, HelpCircle, ShieldAlert, Gavel, Activity
} from "lucide-react";
import { Logo } from "@/components/brand/Logo";
import { useAuth } from "@/hooks/useAuth";
import { useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";

type NavItem = {
  to?: string;
  action?: string;
  label: string;
  icon: any;
  exact?: boolean;
};

const nav: NavItem[] = [
  { to: "/app", label: "Dashboard", icon: LayoutDashboard, exact: true },
  { to: "/app/channels", label: "Channels", icon: Tv },
  { to: "/app/flagged", label: "Flagged Videos", icon: Flag },
  { to: "/app/appeals", label: "Strike Appeals", icon: Gavel },
  { to: "/app/forensics", label: "Forensics", icon: AlertOctagon },
  { to: "/app/reports", label: "Audit Reports", icon: FileText },
  { to: "/app/niche-finder", label: "AI Niche & RPM Checker", icon: Sparkles },
  { to: "/app/daily-report", label: "Daily Monitoring", icon: Activity },
  { action: "open-new-audit", label: "New Audit", icon: PlusCircle },
];

const ADMIN_EMAILS = ["justoneguylikethat@gmail.com", "obedasekhamen@gmail.com"];

export function AppSidebar() {
  const path = useRouterState({ select: (r) => r.location.pathname });
  const { user, org } = useAuth();
  const settingsActive = path.startsWith("/app/settings");
  const isAdmin = user?.email && ADMIN_EMAILS.includes(user.email.toLowerCase());
  const queryClient = useQueryClient();

  const handlePrefetch = (to?: string) => {
    if (!org?.id || !to) return;
    switch (to) {
      case "/app":
        queryClient.prefetchQuery({ queryKey: ["channels", org.id], queryFn: () => api.getChannels(org.id) });
        break;
      case "/app/channels":
        queryClient.prefetchQuery({ queryKey: ["channels", org.id], queryFn: () => api.getChannels(org.id) });
        queryClient.prefetchQuery({ queryKey: ["dashboardFleet", org.id], queryFn: () => api.getDashboardFleet(org.id) });
        break;
      case "/app/flagged":
        queryClient.prefetchQuery({ queryKey: ["flaggedVideos", org.id], queryFn: () => api.getFlaggedVideos(org.id) });
        break;
      case "/app/forensics":
        queryClient.prefetchQuery({ queryKey: ["dashboardAlerts", org.id], queryFn: () => api.getDashboardAlerts(org.id) });
        queryClient.prefetchQuery({ queryKey: ["flaggedVideos", org.id], queryFn: () => api.getFlaggedVideos(org.id) });
        queryClient.prefetchQuery({ queryKey: ["auditResults", org.id], queryFn: () => api.getAuditResults(org.id) });
        break;
      case "/app/reports":
        queryClient.prefetchQuery({ queryKey: ["auditReports", org.id], queryFn: () => api.getAuditResults(org.id) });
        break;
    }
  };

  return (
    <aside className="hidden md:flex w-60 shrink-0 flex-col border-r bg-sidebar h-screen sticky top-0">
      <div className="flex h-14 items-center border-b px-4">
        <Link to="/"><Logo /></Link>
      </div>
      
      {/* Scrollable Navigation */}
      <div className="flex-1 overflow-y-auto px-3 py-4">
        <div className="px-2 pb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Workspace</div>
        <nav className="flex flex-col gap-0.5">
          {nav.map((item) => {
            const Icon = item.icon;
            
            if (item.action) {
              return (
                <button
                  key={item.label}
                  onClick={() => window.dispatchEvent(new Event("open-new-audit-drawer"))}
                  className="group flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-sm transition-colors text-sidebar-foreground/80 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground cursor-pointer text-left"
                >
                  <Icon className="h-4 w-4 text-muted-foreground group-hover:text-foreground" />
                  <span>{item.label}</span>
                </button>
              );
            }

            const active = item.exact ? path === item.to : path.startsWith(item.to!);
            return (
              <Link
                key={item.to}
                to={item.to!}
                onMouseEnter={() => handlePrefetch(item.to)}
                className={`group flex items-center gap-2.5 rounded-md px-2.5 py-2 text-sm transition-colors ${
                  active
                    ? "bg-sidebar-accent text-sidebar-accent-foreground"
                    : "text-sidebar-foreground/80 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground"
                }`}
              >
                <Icon className={`h-4 w-4 ${active ? "text-primary" : "text-muted-foreground group-hover:text-foreground"}`} />
                <span>{item.label}</span>
                {active && <span className="ml-auto h-1.5 w-1.5 rounded-full bg-primary" />}
              </Link>
            );
          })}
        </nav>
      </div>

      {/* Statically Anchored Bottom Section */}
      <div className="p-3 border-t bg-sidebar/30 flex flex-col gap-4 mt-auto">

        {/* Support Link */}
        <a
          href="mailto:justoneguylikethat@gmail.com"
          className="group flex items-center gap-2.5 rounded-md px-2.5 py-2 text-sm transition-colors text-sidebar-foreground/80 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground"
        >
          <HelpCircle className="h-4 w-4 text-muted-foreground group-hover:text-foreground" />
          <span>Support</span>
        </a>

        {/* Admin Link — only visible to platform admin */}
        {isAdmin && (
          <Link
            to="/admin"
            className={`group flex items-center gap-2.5 rounded-md px-2.5 py-2 text-sm transition-colors ${
              path.startsWith("/admin")
                ? "bg-rose-500/20 text-rose-300"
                : "text-sidebar-foreground/80 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground"
            }`}
          >
            <ShieldAlert className={`h-4 w-4 ${path.startsWith("/admin") ? "text-rose-400" : "text-muted-foreground group-hover:text-foreground"}`} />
            <span>Admin Panel</span>
            {path.startsWith("/admin") && <span className="ml-auto h-1.5 w-1.5 rounded-full bg-rose-400" />}
          </Link>
        )}

        {/* Settings Link anchored at bottom */}
        <Link
          to="/app/settings"
          className={`group flex items-center gap-2.5 rounded-md px-2.5 py-2 text-sm transition-colors ${
            settingsActive
              ? "bg-sidebar-accent text-sidebar-accent-foreground"
              : "text-sidebar-foreground/80 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground"
          }`}
        >
          <Settings className={`h-4 w-4 ${settingsActive ? "text-primary" : "text-muted-foreground group-hover:text-foreground"}`} />
          <span>Settings</span>
          {settingsActive && <span className="ml-auto h-1.5 w-1.5 rounded-full bg-primary" />}
        </Link>
      </div>
    </aside>
  );
}
