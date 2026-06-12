import { motion } from "framer-motion";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis, Bar, BarChart } from "recharts";
import { ShieldCheck, Sparkles } from "lucide-react";
import { SeverityBadge } from "@/components/dashboard/SeverityBadge";

const complianceSeries = [
  { day: "May 1", score: 91, risk: 9 },
  { day: "May 5", score: 92, risk: 8 },
  { day: "May 10", score: 94, risk: 6 },
  { day: "May 15", score: 93, risk: 7 },
  { day: "May 20", score: 95, risk: 5 },
  { day: "May 25", score: 94, risk: 6 },
  { day: "May 30", score: 96, risk: 4 },
];

const uploadVelocity = [
  { day: "Mon", uploads: 12, baseline: 10 },
  { day: "Tue", uploads: 15, baseline: 10 },
  { day: "Wed", uploads: 8, baseline: 10 },
  { day: "Thu", uploads: 11, baseline: 10 },
  { day: "Fri", uploads: 19, baseline: 10 },
  { day: "Sat", uploads: 24, baseline: 10 },
  { day: "Sun", uploads: 14, baseline: 10 },
];

const tooltip = { contentStyle: { background: "oklch(0.20 0.014 250)", border: "1px solid oklch(0.28 0.014 250)", borderRadius: 8, fontSize: 12 } };

export function AuditPreview() {
  return (
    <div className="relative mt-12 md:mt-0">
      <div className="absolute -inset-6 -z-10 rounded-2xl bg-gradient-to-br from-primary/20 via-secondary/10 to-transparent blur-2xl opacity-60" />
      <div className="overflow-hidden rounded-2xl border bg-card hairline shadow-2xl">
        <div className="flex items-center justify-between border-b px-4 py-2.5">
          <div className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-destructive/70" />
            <span className="h-2.5 w-2.5 rounded-full bg-warning/70" />
            <span className="h-2.5 w-2.5 rounded-full bg-success/70" />
          </div>
          <div className="text-[11px] text-muted-foreground">TubeCheck · Forensic Scanner</div>
          <div className="w-12" />
        </div>

        <div className="grid grid-cols-3 gap-px bg-border">
          {[
            { l: "Network health", v: "94.2%", s: "+1.4%", t: "text-success" },
            { l: "Threat score", v: "23/100", s: "−8", t: "text-success" },
            { l: "Active alerts", v: "7", s: "+2", t: "text-warning" },
          ].map((k) => (
            <div key={k.l} className="bg-card px-4 py-3">
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{k.l}</div>
              <div className="mt-1 flex items-baseline gap-1.5">
                <div className="text-lg font-semibold tabular-nums">{k.v}</div>
                <div className={`text-[11px] ${k.t}`}>{k.s}</div>
              </div>
            </div>
          ))}
        </div>

        <div className="border-t p-4">
          <div className="mb-2 flex items-center justify-between">
            <div className="text-xs font-medium">Compliance Scanner</div>
          </div>
          <div style={{ width: "100%", height: 160 }}>
            <ResponsiveContainer>
              <AreaChart data={complianceSeries} margin={{ left: -24, right: 0, top: 4 }}>
                <defs>
                  <linearGradient id="hgrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="oklch(0.82 0.16 210)" stopOpacity={0.55}/>
                    <stop offset="100%" stopColor="oklch(0.82 0.16 210)" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="oklch(0.28 0.014 250)" strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="day" tick={{ fill: "oklch(0.66 0.018 250)", fontSize: 9 }} axisLine={false} tickLine={false} interval={4} />
                <YAxis tick={{ fill: "oklch(0.66 0.018 250)", fontSize: 9 }} axisLine={false} tickLine={false} />
                <Tooltip {...tooltip} />
                <Area type="monotone" dataKey="score" stroke="oklch(0.82 0.16 210)" strokeWidth={2} fill="url(#hgrad)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="grid gap-px border-t bg-border md:grid-cols-2">
          <div className="bg-card p-4">
            <div className="mb-2 text-xs font-medium">Upload velocity</div>
            <div style={{ width: "100%", height: 90 }}>
              <ResponsiveContainer>
                <BarChart data={uploadVelocity}>
                  <Bar dataKey="uploads" fill="oklch(0.65 0.18 255)" radius={[3,3,0,0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
          <div className="bg-card p-4">
            <div className="mb-2 text-xs font-medium">Scan Results</div>
            <ul className="space-y-1.5">
              {[
                { s: "high", t: "Thumbnail similarity > 92%" },
                { s: "medium", t: "AI voice probability rising" },
                { s: "low", t: "Transcript overlap detected" },
              ].map((a, i) => (
                <li key={i} className="flex items-center gap-2 text-[11px]">
                  <SeverityBadge level={a.s as any} />
                  <span className="truncate">{a.t}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}
        className="absolute -bottom-4 -left-4 hidden md:flex items-center gap-2 rounded-full border bg-card px-3 py-1.5 text-xs hairline shadow-sm">
        <Sparkles className="h-3 w-3 text-primary" />
        <span>AI footprint analysis: <span className="text-success font-medium">Healthy</span></span>
      </motion.div>
      <motion.div
        initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.55 }}
        className="absolute -top-4 -right-4 hidden md:flex items-center gap-2 rounded-full border bg-card px-3 py-1.5 text-xs hairline shadow-sm">
        <ShieldCheck className="h-3 w-3 text-primary" />
        <span>System Protected</span>
      </motion.div>
    </div>
  );
}
