import { ChevronDown, Plus, Search, Zap, RefreshCw, Loader2 } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { useAuth } from "@/hooks/useAuth";
import { useState, useEffect } from "react";
import { NewAuditDrawer } from "@/components/dashboard/NewAuditDrawer";

export function TopBar({ title }: { title: string }) {
  const { org, user, logout, syncSession } = useAuth();
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    const handleOpen = () => setIsDrawerOpen(true);
    window.addEventListener("open-new-audit-drawer", handleOpen);
    return () => window.removeEventListener("open-new-audit-drawer", handleOpen);
  }, []);

  const orgName = org?.name || "My Organization";
  const userInitials = user?.full_name
    ? user.full_name.split(" ").map((n) => n[0]).join("").substring(0, 2).toUpperCase()
    : user?.email?.substring(0, 2).toUpperCase() || "U";

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b glass px-4 md:px-6">
      <div className="flex items-center gap-2">
        <h1 className="text-sm font-semibold tracking-tight">{title}</h1>
      </div>

      <div className="ml-4 hidden md:flex flex-1 max-w-md items-center gap-2 rounded-md border bg-background/60 px-3 py-1.5">
        <Search className="h-3.5 w-3.5 text-muted-foreground" />
        <input
          placeholder="Search channels, audits, alerts…"
          className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
        />
        <kbd className="hidden md:inline rounded border px-1.5 py-0.5 text-[10px] text-muted-foreground">⌘K</kbd>
      </div>

      <div className="ml-auto flex items-center gap-2">
        <button className="hidden sm:inline-flex items-center gap-1.5 rounded-md border bg-card px-2.5 py-1.5 text-xs hover:bg-accent cursor-pointer">
          <span className="h-1.5 w-1.5 rounded-full bg-success" />
          {orgName}
          <ChevronDown className="h-3 w-3 text-muted-foreground" />
        </button>
        <button
          onClick={async () => {
            setSyncing(true);
            await syncSession();
            setSyncing(false);
          }}
          disabled={syncing}
          title="Sync Balance"
          className="hidden sm:inline-flex items-center justify-center rounded-full border bg-background px-2.5 py-1.5 text-muted-foreground hover:text-foreground hover:bg-accent transition-colors disabled:opacity-50 cursor-pointer"
        >
          {syncing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
        </button>
        <Link to="/app/pricing" className="hidden sm:inline-flex items-center gap-1.5 rounded-full border border-primary/20 bg-primary/10 px-3 py-1.5 text-xs font-medium text-primary hover:bg-primary/20 transition-colors">
          <Zap className="h-3.5 w-3.5 text-yellow-500 fill-yellow-500" />
          {org?.available_credits ?? 0} Credits
        </Link>
        {(!org?.plan_tier || org.plan_tier === "FREE") && (
          <Link to="/app/pricing" className="hidden sm:inline-flex items-center gap-1 rounded-md bg-secondary px-2.5 py-1.5 text-xs font-medium text-secondary-foreground hover:bg-secondary/80 transition-colors">
            Upgrade
          </Link>
        )}
        <button
          onClick={() => setIsDrawerOpen(true)}
          className="inline-flex items-center gap-1.5 rounded-md bg-primary px-2.5 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 transition-colors cursor-pointer"
        >
          <Plus className="h-3.5 w-3.5" /> New audit
        </button>

      </div>

      <NewAuditDrawer isOpen={isDrawerOpen} onClose={() => setIsDrawerOpen(false)} />
    </header>
  );
}
