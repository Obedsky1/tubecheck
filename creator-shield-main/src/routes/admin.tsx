import { createFileRoute, redirect } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import {
  Users, AlertTriangle, ShieldCheck, BarChart3, RefreshCw,
  Search, ChevronUp, ChevronDown, Trash2, UserCheck, UserX,
  CheckCircle, XCircle, Crown, Zap, Loader2, Activity
} from "lucide-react";

// ── Auth guard ────────────────────────────────────────────────────────────────
export const Route = createFileRoute("/admin")({
  component: AdminPanel,
});

const API = "";  // Use relative URLs — same as api.ts uses /api base

function apiFetch(path: string, options?: RequestInit) {
  const token = localStorage.getItem("cs_token");
  return fetch(`/api${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options?.headers,
    },
  });
}

// ── Sub-components ────────────────────────────────────────────────────────────

type StatCardProps = { label: string; value: number | string; icon: React.ElementType; color: string };
function StatCard({ label, value, icon: Icon, color }: StatCardProps) {
  return (
    <div className="admin-card flex items-center gap-4 p-5">
      <div className={`flex h-12 w-12 items-center justify-center rounded-xl ${color}`}>
        <Icon className="h-6 w-6 text-white" />
      </div>
      <div>
        <div className="text-2xl font-bold">{value}</div>
        <div className="text-xs text-muted-foreground">{label}</div>
      </div>
    </div>
  );
}

const PLAN_COLORS: Record<string, string> = {
  FREE: "bg-slate-500/20 text-slate-300 border border-slate-500/30",
  PRO: "bg-violet-500/20 text-violet-300 border border-violet-500/30",
  ENTERPRISE: "bg-amber-500/20 text-amber-300 border border-amber-500/30",
};
const PLAN_ICONS: Record<string, React.ElementType> = { FREE: Zap, PRO: ShieldCheck, ENTERPRISE: Crown };

// ── Main Component ────────────────────────────────────────────────────────────
export default function AdminPanel() {
  const qc = useQueryClient();
  const [activeTab, setActiveTab] = useState<"users" | "logs" | "stats">("users");
  const [search, setSearch] = useState("");
  const [logLevel, setLogLevel] = useState<"WARNING" | "ERROR" | "CRITICAL">("WARNING");
  const [upgradingId, setUpgradingId] = useState<string | null>(null);
  const [selectedPlan, setSelectedPlan] = useState<Record<string, string>>({});
  const [notification, setNotification] = useState<{ msg: string; ok: boolean } | null>(null);

  function notify(msg: string, ok = true) {
    setNotification({ msg, ok });
    setTimeout(() => setNotification(null), 3500);
  }

  // ── Queries ──
  const stats = useQuery({
    queryKey: ["admin-stats"],
    queryFn: async () => {
      const r = await apiFetch("/admin/stats");
      if (!r.ok) throw new Error(await r.text());
      return r.json();
    },
  });

  const users = useQuery({
    queryKey: ["admin-users", search],
    queryFn: async () => {
      const params = search ? `?search=${encodeURIComponent(search)}` : "";
      const r = await apiFetch(`/admin/users${params}`);
      if (!r.ok) throw new Error(await r.text());
      return r.json() as Promise<any[]>;
    },
  });

  const logs = useQuery({
    queryKey: ["admin-logs", logLevel],
    queryFn: async () => {
      const r = await apiFetch(`/admin/logs?level=${logLevel}&limit=200`);
      if (!r.ok) throw new Error(await r.text());
      return r.json() as Promise<any[]>;
    },
    enabled: activeTab === "logs",
    refetchInterval: activeTab === "logs" ? 5000 : false,
  });

  // ── Mutations ──
  const upgradeMut = useMutation({
    mutationFn: async ({ userId, plan }: { userId: string; plan: string }) => {
      const r = await apiFetch(`/admin/users/${userId}/plan`, {
        method: "PATCH",
        body: JSON.stringify({ plan_tier: plan }),
      });
      if (!r.ok) throw new Error(await r.text());
      return r.json();
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["admin-users"] });
      qc.invalidateQueries({ queryKey: ["admin-stats"] });
      notify(`✅ ${data.email} upgraded to ${data.new_plan}`);
      setUpgradingId(null);
    },
    onError: (e: any) => notify(`❌ ${e.message}`, false),
  });

  const toggleStatus = useMutation({
    mutationFn: async ({ userId, isActive }: { userId: string; isActive: boolean }) => {
      const r = await apiFetch(`/admin/users/${userId}/status`, {
        method: "PATCH",
        body: JSON.stringify({ is_active: isActive }),
      });
      if (!r.ok) throw new Error(await r.text());
      return r.json();
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin-users"] }); notify("User status updated"); },
    onError: (e: any) => notify(`❌ ${e.message}`, false),
  });

  const clearLogs = useMutation({
    mutationFn: async () => {
      const r = await apiFetch("/admin/logs", { method: "DELETE" });
      if (!r.ok) throw new Error(await r.text());
      return r.json();
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin-logs"] }); notify("Logs cleared"); },
  });

  const LOG_COLORS: Record<string, string> = {
    WARNING: "text-amber-400 bg-amber-500/10 border-amber-500/20",
    ERROR: "text-red-400 bg-red-500/10 border-red-500/20",
    CRITICAL: "text-rose-300 bg-rose-500/15 border-rose-500/30",
  };

  return (
    <div className="admin-root min-h-screen bg-[#0a0c14] text-foreground">
      <style>{`
        .admin-root { font-family: 'Inter', sans-serif; }
        .admin-card { background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.08); border-radius: 14px; transition: border-color .2s; }
        .admin-card:hover { border-color: rgba(139,92,246,0.3); }
        .admin-tab { padding: 8px 20px; border-radius: 8px; font-size: 14px; font-weight: 500; cursor: pointer; transition: all .2s; }
        .admin-tab.active { background: linear-gradient(135deg, #7c3aed, #4f46e5); color: #fff; }
        .admin-tab:not(.active) { color: rgba(255,255,255,0.5); }
        .admin-tab:not(.active):hover { color: rgba(255,255,255,0.9); background: rgba(255,255,255,0.06); }
        .admin-input { background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); border-radius: 8px; padding: 8px 14px; color: #fff; outline: none; transition: border-color .2s; }
        .admin-input:focus { border-color: #7c3aed; }
        .admin-select { background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); border-radius: 8px; padding: 6px 10px; color: #fff; outline: none; }
        .admin-btn { border-radius: 8px; font-weight: 500; cursor: pointer; transition: all .18s; border: none; display: inline-flex; align-items: center; gap: 6px; }
        .admin-btn-primary { background: linear-gradient(135deg,#7c3aed,#4f46e5); color:#fff; padding: 7px 16px; font-size:13px; }
        .admin-btn-primary:hover { opacity:.88; }
        .admin-btn-ghost { background: rgba(255,255,255,0.07); color: rgba(255,255,255,.8); padding: 6px 12px; font-size: 12px; }
        .admin-btn-ghost:hover { background: rgba(255,255,255,0.12); }
        .admin-btn-danger { background: rgba(239,68,68,0.15); color: #f87171; padding: 6px 12px; font-size:12px; border: 1px solid rgba(239,68,68,0.25); }
        .admin-btn-danger:hover { background: rgba(239,68,68,0.25); }
        .admin-table-row:hover { background: rgba(255,255,255,0.025); }
        .admin-table-row { border-bottom: 1px solid rgba(255,255,255,0.05); transition: background .15s; }
      `}</style>

      {/* Header */}
      <div className="border-b border-white/8 bg-[#0d0f1a] px-8 py-5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-violet-600 to-indigo-600">
            <ShieldCheck className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-white">Admin Panel</h1>
            <p className="text-[11px] text-white/40">ShieldNetwork AI · Super Admin</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {notification && (
            <div className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm animate-in fade-in slide-in-from-top-2 ${notification.ok ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400" : "bg-red-500/10 border-red-500/20 text-red-400"}`}>
              {notification.ok ? <CheckCircle className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
              {notification.msg}
            </div>
          )}
          <button className="admin-btn admin-btn-ghost" onClick={() => { qc.invalidateQueries(); }}>
            <RefreshCw className="h-3.5 w-3.5" /> Refresh All
          </button>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-8 py-8 space-y-8">

        {/* Stats Row */}
        {stats.data && (
          <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-5">
            <StatCard label="Total Users" value={stats.data.total_users} icon={Users} color="bg-violet-600" />
            <StatCard label="Organizations" value={stats.data.total_orgs} icon={ShieldCheck} color="bg-indigo-600" />
            <StatCard label="Channels" value={stats.data.total_channels} icon={Activity} color="bg-cyan-600" />
            <StatCard label="Videos" value={stats.data.total_videos} icon={BarChart3} color="bg-emerald-600" />
            <StatCard label="Error Logs" value={stats.data.log_buffer_size} icon={AlertTriangle} color="bg-rose-600" />
          </div>
        )}

        {/* Plans breakdown */}
        {stats.data?.plans && (
          <div className="admin-card p-5">
            <div className="mb-3 text-xs font-semibold uppercase tracking-wider text-white/40">Plan Distribution</div>
            <div className="flex flex-wrap gap-3">
              {Object.entries(stats.data.plans as Record<string, number>).map(([plan, count]) => {
                const PlanIcon = PLAN_ICONS[plan] ?? Zap;
                return (
                  <div key={plan} className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium ${PLAN_COLORS[plan] ?? "bg-white/10 text-white"}`}>
                    <PlanIcon className="h-3.5 w-3.5" />
                    {plan} — {count} org{count !== 1 ? "s" : ""}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-2 rounded-xl bg-white/3 border border-white/8 p-1.5 w-fit">
          {(["users", "logs", "stats"] as const).map((tab) => (
            <button key={tab} className={`admin-tab ${activeTab === tab ? "active" : ""}`} onClick={() => setActiveTab(tab)}>
              {tab === "users" && <Users className="inline h-3.5 w-3.5 mr-1.5 -mt-0.5" />}
              {tab === "logs" && <AlertTriangle className="inline h-3.5 w-3.5 mr-1.5 -mt-0.5" />}
              {tab === "stats" && <BarChart3 className="inline h-3.5 w-3.5 mr-1.5 -mt-0.5" />}
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </button>
          ))}
        </div>

        {/* ── Users Tab ───────────────────────────────────────────── */}
        {activeTab === "users" && (
          <div className="admin-card overflow-hidden">
            <div className="flex items-center gap-3 border-b border-white/8 px-5 py-4">
              <Search className="h-4 w-4 text-white/40" />
              <input
                className="admin-input flex-1 text-sm"
                placeholder="Search by email or name…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              <span className="text-xs text-white/30">{users.data?.length ?? 0} user{users.data?.length !== 1 ? "s" : ""}</span>
            </div>

            {users.isLoading && (
              <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-violet-400" /></div>
            )}
            {users.isError && (
              <div className="flex items-center gap-2 p-6 text-red-400 text-sm">
                <XCircle className="h-4 w-4" /> Failed to load users. Make sure you are logged in as admin.
              </div>
            )}

            {users.data && (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-white/8 text-[11px] font-semibold uppercase tracking-wider text-white/30">
                      <th className="px-5 py-3 text-left">User</th>
                      <th className="px-4 py-3 text-left">Joined</th>
                      <th className="px-4 py-3 text-left">Plan</th>
                      <th className="px-4 py-3 text-left">Credits</th>
                      <th className="px-4 py-3 text-left">Status</th>
                      <th className="px-5 py-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.data.map((u: any) => {
                      const PlanIcon = PLAN_ICONS[u.plan_tier] ?? Zap;
                      return (
                        <tr key={u.id} className="admin-table-row">
                          <td className="px-5 py-3.5">
                            <div className="font-medium text-white/90">{u.full_name}</div>
                            <div className="text-[11px] text-white/40">{u.email}</div>
                          </td>
                          <td className="px-4 py-3.5 text-white/50 text-xs whitespace-nowrap">
                            {u.created_at ? new Date(u.created_at).toLocaleDateString() : "—"}
                          </td>
                          <td className="px-4 py-3.5">
                            {u.plan_tier ? (
                              <span className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium ${PLAN_COLORS[u.plan_tier] ?? "bg-white/10"}`}>
                                <PlanIcon className="h-3 w-3" />{u.plan_tier}
                              </span>
                            ) : <span className="text-white/20 text-xs">—</span>}
                          </td>
                          <td className="px-4 py-3.5 text-white/60 text-xs">{u.available_credits ?? "—"}</td>
                          <td className="px-4 py-3.5">
                            <span className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium ${u.is_active ? "bg-emerald-500/15 text-emerald-400" : "bg-red-500/15 text-red-400"}`}>
                              <span className={`h-1.5 w-1.5 rounded-full ${u.is_active ? "bg-emerald-400" : "bg-red-400"}`} />
                              {u.is_active ? "Active" : "Inactive"}
                            </span>
                          </td>
                          <td className="px-5 py-3.5">
                            <div className="flex items-center justify-end gap-2">
                              {/* Plan upgrade */}
                              {upgradingId === u.id ? (
                                <div className="flex items-center gap-2">
                                  <select
                                    className="admin-select text-xs"
                                    value={selectedPlan[u.id] ?? u.plan_tier ?? "FREE"}
                                    onChange={(e) => setSelectedPlan((prev) => ({ ...prev, [u.id]: e.target.value }))}
                                  >
                                    <option value="FREE">FREE</option>
                                    <option value="PRO">PRO</option>
                                    <option value="ENTERPRISE">ENTERPRISE</option>
                                  </select>
                                  <button
                                    className="admin-btn admin-btn-primary"
                                    disabled={upgradeMut.isPending}
                                    onClick={() => upgradeMut.mutate({ userId: u.id, plan: selectedPlan[u.id] ?? u.plan_tier })}
                                  >
                                    {upgradeMut.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <CheckCircle className="h-3 w-3" />}
                                    Save
                                  </button>
                                  <button className="admin-btn admin-btn-ghost" onClick={() => setUpgradingId(null)}>Cancel</button>
                                </div>
                              ) : (
                                <button className="admin-btn admin-btn-ghost" onClick={() => { setUpgradingId(u.id); setSelectedPlan((prev) => ({ ...prev, [u.id]: u.plan_tier ?? "FREE" })); }}>
                                  <Crown className="h-3 w-3" /> Upgrade
                                </button>
                              )}

                              {/* Toggle active */}
                              <button
                                className={`admin-btn ${u.is_active ? "admin-btn-danger" : "admin-btn-ghost"}`}
                                disabled={toggleStatus.isPending}
                                onClick={() => toggleStatus.mutate({ userId: u.id, isActive: !u.is_active })}
                              >
                                {u.is_active ? <UserX className="h-3 w-3" /> : <UserCheck className="h-3 w-3" />}
                                {u.is_active ? "Deactivate" : "Activate"}
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                    {users.data.length === 0 && (
                      <tr><td colSpan={6} className="px-5 py-10 text-center text-white/30 text-sm">No users found.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* ── Logs Tab ───────────────────────────────────────────── */}
        {activeTab === "logs" && (
          <div className="admin-card overflow-hidden">
            <div className="flex items-center gap-3 border-b border-white/8 px-5 py-4">
              <AlertTriangle className="h-4 w-4 text-amber-400" />
              <span className="text-sm font-medium text-white/70">Backend Error Logs</span>
              <span className="ml-auto flex items-center gap-2">
                <Activity className="h-3 w-3 text-emerald-400 animate-pulse" />
                <span className="text-[11px] text-emerald-400">Live (5s refresh)</span>
              </span>
              <select className="admin-select text-xs" value={logLevel} onChange={(e) => setLogLevel(e.target.value as any)}>
                <option value="WARNING">WARNING+</option>
                <option value="ERROR">ERROR+</option>
                <option value="CRITICAL">CRITICAL only</option>
              </select>
              <button className="admin-btn admin-btn-danger" onClick={() => clearLogs.mutate()}>
                <Trash2 className="h-3 w-3" /> Clear
              </button>
            </div>

            {logs.isLoading && <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-violet-400" /></div>}
            {logs.data?.length === 0 && <div className="py-12 text-center text-sm text-white/30">✅ No {logLevel}+ logs. Everything looks healthy!</div>}

            <div className="divide-y divide-white/5 max-h-[600px] overflow-y-auto font-mono text-xs">
              {logs.data?.map((log: any) => (
                <div key={log.id} className={`px-5 py-3 border-l-2 ${log.level === "CRITICAL" ? "border-rose-500" : log.level === "ERROR" ? "border-red-500" : "border-amber-500"}`}>
                  <div className="flex items-center gap-3 mb-1">
                    <span className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${LOG_COLORS[log.level] ?? "bg-white/10 text-white"}`}>
                      {log.level}
                    </span>
                    <span className="text-white/30">{new Date(log.timestamp).toLocaleString()}</span>
                    <span className="text-violet-400">{log.logger}</span>
                    <span className="text-white/20">{log.module}:{log.lineno}</span>
                  </div>
                  <div className="text-white/70 leading-relaxed">{log.message}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Stats Tab ───────────────────────────────────────────── */}
        {activeTab === "stats" && (
          <div className="grid gap-4 md:grid-cols-2">
            {stats.data && (
              <>
                <div className="admin-card p-6 space-y-4">
                  <div className="text-xs font-semibold uppercase tracking-wider text-white/40">Platform Overview</div>
                  {[
                    { label: "Registered Users", value: stats.data.total_users, color: "bg-violet-500" },
                    { label: "Organizations", value: stats.data.total_orgs, color: "bg-indigo-500" },
                    { label: "Connected Channels", value: stats.data.total_channels, color: "bg-cyan-500" },
                    { label: "Indexed Videos", value: stats.data.total_videos, color: "bg-emerald-500" },
                    { label: "Audit Results", value: stats.data.total_audits, color: "bg-amber-500" },
                  ].map(({ label, value, color }) => (
                    <div key={label} className="flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <div className={`h-2 w-2 rounded-full ${color}`} />
                        <span className="text-sm text-white/60">{label}</span>
                      </div>
                      <span className="text-sm font-bold text-white">{value.toLocaleString()}</span>
                    </div>
                  ))}
                </div>

                <div className="admin-card p-6 space-y-4">
                  <div className="text-xs font-semibold uppercase tracking-wider text-white/40">Subscription Breakdown</div>
                  {Object.entries(stats.data.plans as Record<string, number>).map(([plan, count]) => {
                    const PlanIcon = PLAN_ICONS[plan] ?? Zap;
                    const total = Object.values(stats.data.plans as Record<string, number>).reduce((a, b) => a + b, 0);
                    const pct = total > 0 ? Math.round((count / total) * 100) : 0;
                    return (
                      <div key={plan}>
                        <div className="flex items-center justify-between mb-1.5">
                          <span className={`inline-flex items-center gap-1.5 text-xs font-medium ${PLAN_COLORS[plan]?.split(" ")[1] ?? "text-white"}`}>
                            <PlanIcon className="h-3 w-3" />{plan}
                          </span>
                          <span className="text-sm font-bold text-white">{count} <span className="text-white/30 font-normal">({pct}%)</span></span>
                        </div>
                        <div className="h-1.5 w-full rounded-full bg-white/8">
                          <div
                            className={`h-1.5 rounded-full transition-all duration-700 ${plan === "ENTERPRISE" ? "bg-amber-500" : plan === "PRO" ? "bg-violet-500" : "bg-slate-500"}`}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
