import { ArrowDownRight, ArrowUpRight } from "lucide-react";
import { motion } from "framer-motion";
import { Link } from "@tanstack/react-router";

type Tone = "success" | "warning" | "neutral" | "danger";

export function KpiCard({
  label, value, unit = "", delta, trend, tone = "neutral", index = 0, to,
}: {
  label: string; value: string; unit?: string; delta: number; trend: "up" | "down"; tone?: Tone; index?: number; to?: string;
}) {
  const toneCls =
    tone === "success" ? "text-success" :
    tone === "warning" ? "text-warning" :
    tone === "danger" ? "text-destructive" : "text-muted-foreground";

  const Arrow = trend === "up" ? ArrowUpRight : ArrowDownRight;

  const content = (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: index * 0.04 }}
      className={`group relative overflow-hidden rounded-xl border bg-card p-4 hairline h-full transition-all duration-300 ${to ? "hover:border-primary/50 cursor-pointer hover:bg-accent/10" : ""}`}
    >
      <div className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="mt-2 flex items-baseline gap-1">
        <div className="text-2xl font-semibold tracking-tight tabular-nums">{value}</div>
        <div className="text-sm text-muted-foreground">{unit}</div>
      </div>
      <div className={`mt-2 flex items-center gap-1 text-xs ${toneCls}`}>
        <Arrow className="h-3.5 w-3.5" />
        <span className="tabular-nums">{Math.abs(delta)}{typeof delta === "number" && unit === "%" ? "pp" : ""}</span>
        <span className="text-muted-foreground">vs last 7d</span>
      </div>
      <div className="pointer-events-none absolute -right-8 -top-8 h-24 w-24 rounded-full bg-primary/5 blur-2xl opacity-0 transition-opacity group-hover:opacity-100" />
    </motion.div>
  );

  if (to) {
    return <Link to={to} className="block h-full">{content}</Link>;
  }

  return content;
}
