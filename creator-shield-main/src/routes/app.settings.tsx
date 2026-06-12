import { createFileRoute } from "@tanstack/react-router";
import { Panel } from "@/components/dashboard/Panel";
import { useAuth } from "@/hooks/useAuth";

export const Route = createFileRoute("/app/settings")({
  component: SettingsPage,
});

function SettingsPage() {
  const { user, org } = useAuth();

  return (
    <div className="space-y-6">
      <Panel title="Account" subtitle="Your profile details">
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Full Name" value={user?.full_name || "—"} />
          <Field label="Email" value={user?.email || "—"} />
          <Field label="Account Status" value={user?.is_active ? "Active" : "Inactive"} />
          <Field label="Member Since" value={user?.created_at ? new Date(user.created_at).toLocaleDateString() : "—"} />
        </div>
      </Panel>

      <Panel title="Workspace" subtitle={org?.name || "No organization"}>
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Organization Name" value={org?.name || "—"} />
          <Field label="Organization ID" value={org?.id?.substring(0, 16) + "..." || "—"} />
          <Field label="Created" value={org?.created_at ? new Date(org.created_at).toLocaleDateString() : "—"} />
          <Field label="Default scan depth" value="Forensic (recommended)" />
        </div>
      </Panel>

    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border bg-background/40 p-3 hairline">
      <div className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="mt-1 text-sm">{value}</div>
    </div>
  );
}
