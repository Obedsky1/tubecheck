export function SeverityBadge({ level }: { level: string }) {
  const l = level.toLowerCase();
  const map: Record<string, string> = {
    high: "bg-red-500/10 text-red-400 ring-red-500/30",
    critical: "bg-red-500/15 text-red-400 ring-red-500/30",
    medium: "bg-warning/10 text-warning ring-warning/30",
    low: "bg-success/10 text-success ring-success/30",
    safe: "bg-success/10 text-success ring-success/30",
    "at risk": "bg-red-500/10 text-red-400 ring-red-500/30",
    stable: "bg-success/10 text-success ring-success/30",
    review: "bg-warning/10 text-warning ring-warning/30",
    watch: "bg-warning/10 text-warning ring-warning/30",
    complete: "bg-success/10 text-success ring-success/30",
    processing: "bg-primary/10 text-primary ring-primary/30",
    queued: "bg-muted text-muted-foreground ring-border",
  };
  const cls = map[l] ?? "bg-muted text-muted-foreground ring-border";
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset ${cls}`}>
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {level}
    </span>
  );
}
