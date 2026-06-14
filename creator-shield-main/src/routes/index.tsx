import { createFileRoute, Link } from "@tanstack/react-router";
import { motion, AnimatePresence } from "framer-motion";
import { useState, useEffect } from "react";
import {
  Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis, Bar, BarChart,
} from "recharts";
import {
  ArrowRight, Shield, ShieldCheck, Check, Activity, Eye, Cpu, Image as ImageIcon,
  Mic, Gauge, BarChart3, Sparkles, Network, Plug, Zap, AlertTriangle, X,
} from "lucide-react";
import { Logo } from "@/components/brand/Logo";
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

const features = [
  { title: "Script Fingerprinting", desc: "Cross-examine dialogue transcripts across your entire channel fleet to detect automated script spinners.", metric: "Coordinated matches" },
  { title: "Visual Deduplication", desc: "Scan frames and keyframes for exact asset re-use, thumbnail duplication, and template cloning.", metric: "Asset overlap %" },
  { title: "Synthetic Narrator Detection", desc: "Detect AI voice probability and deepfake speech markers violating YouTube altered content policies.", metric: "Acoustic probability" },
  { title: "Upload Pacing Analysis", desc: "Identify upload velocity spikes that trigger algorithmic spam or deceptive practices flags.", metric: "Velocity multiplier" },
];

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "TubeCheck.live | YouTube Compliance & Monetization Radar" },
      { name: "description", content: "Audit your channel assets, scripts, and video files before publishing. Stop reused content flags, synthetic voice bans, and shadowbans instantly." },
      { property: "og:title", content: "TubeCheck.live | YouTube Compliance & Monetization Radar" },
      { property: "og:description", content: "Audit your channel assets, scripts, and video files before publishing. Stop reused content flags, synthetic voice bans, and shadowbans instantly." },
    ],
  }),
  component: Landing,
});

const tooltip = { contentStyle: { background: "oklch(0.20 0.014 250)", border: "1px solid oklch(0.28 0.014 250)", borderRadius: 8, fontSize: 12 } };

function Nav() {
  return (
    <header className="sticky top-0 z-40 border-b border-border/60 glass">
      <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4 md:px-6">
        <Link to="/"><Logo /></Link>
        <nav className="hidden md:flex items-center gap-7 text-sm text-muted-foreground">
          <a href="#features" className="hover:text-foreground">Features</a>
          <Link to="/app" className="hover:text-foreground">Dashboard</Link>
          <a href="#pricing" className="hover:text-foreground">Pricing</a>
          <a href="#" className="hover:text-foreground">Docs</a>
        </nav>
        <div className="flex items-center gap-2">
          <Link to="/login" className="hidden sm:inline text-sm text-muted-foreground hover:text-foreground">Log in</Link>
          <Link to="/register" className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90">
            Start free audit <ArrowRight className="h-3 w-3" />
          </Link>
        </div>
      </div>
    </header>
  );
}

function HeroDashboard() {
  return (
    <div className="relative">
      <div className="absolute -inset-6 -z-10 rounded-2xl bg-gradient-to-br from-primary/20 via-secondary/10 to-transparent blur-2xl opacity-60" />
      <div className="overflow-hidden rounded-2xl border bg-card hairline shadow-2xl">
        {/* window chrome */}
        <div className="flex items-center justify-between border-b px-4 py-2.5">
          <div className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-destructive/70" />
            <span className="h-2.5 w-2.5 rounded-full bg-warning/70" />
            <span className="h-2.5 w-2.5 rounded-full bg-success/70" />
          </div>
          <div className="text-[11px] text-muted-foreground">TubeCheck · My Organization</div>
          <div className="w-12" />
        </div>

        {/* KPI strip */}
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

        {/* main chart */}
        <div className="border-t p-4">
          <div className="mb-2 flex items-center justify-between">
            <div className="text-xs font-medium">Compliance — 30 days</div>
            <div className="flex gap-1 text-[10px]">
              <span className="rounded border px-1.5 py-0.5 text-muted-foreground">7D</span>
              <span className="rounded border bg-accent px-1.5 py-0.5">30D</span>
            </div>
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

        {/* bottom cards */}
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
            <div className="mb-2 text-xs font-medium">Latest alerts</div>
            <ul className="space-y-1.5">
              {[
                { s: "high", t: "Thumbnail similarity > 92%" },
                { s: "medium", t: "AI voice probability rising" },
                { s: "low", t: "Transcript overlap detected" },
              ].map((a, i) => (
                <li key={i} className="flex items-center gap-2 text-[11px]">
                  <SeverityBadge level={a.s} />
                  <span className="truncate">{a.t}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      {/* floating chip */}
      <motion.div
        initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}
        className="absolute -bottom-4 -left-4 hidden md:flex items-center gap-2 rounded-full border bg-card px-3 py-1.5 text-xs hairline">
        <Sparkles className="h-3 w-3 text-primary" />
        <span>AI footprint analysis: <span className="text-success font-medium">Healthy</span></span>
      </motion.div>
      <motion.div
        initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.55 }}
        className="absolute -top-4 -right-4 hidden md:flex items-center gap-2 rounded-full border bg-card px-3 py-1.5 text-xs hairline">
        <ShieldCheck className="h-3 w-3 text-primary" />
        <span>128 channels monitored</span>
      </motion.div>
    </div>
  );
}

function Hero() {
  const [contentIndex, setContentIndex] = useState(0);
  const heroContent = [
    {
      title: "Free YouTube Channel Audit in Under 60 Seconds",
      desc: "Detect reused content, AI risks, shadowban signals, and monetization threats before YouTube does."
    },
    {
      title: "Check If Your YouTube Channel Is At Risk Of Demonetization",
      desc: "Get a free compliance report with actionable fixes."
    }
  ];

  useEffect(() => {
    const interval = setInterval(() => {
      setContentIndex((prev) => (prev + 1) % heroContent.length);
    }, 10000);
    return () => clearInterval(interval);
  }, []);

  return (
    <section className="relative overflow-hidden">
      <div className="pointer-events-none absolute inset-0 -z-10" style={{ background: "var(--gradient-hero)" }} />
      <div className="pointer-events-none absolute inset-0 -z-10 grid-bg opacity-50 [mask-image:radial-gradient(ellipse_at_top,black,transparent_70%)]" />
      <div className="mx-auto grid max-w-7xl items-center gap-12 px-4 pt-8 pb-20 md:grid-cols-2 md:px-6 md:pt-12 md:pb-28">
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}>
          <div className="inline-flex items-center gap-2 rounded-full border bg-card/60 px-3 py-1 text-xs text-muted-foreground hairline">
            <span className="h-1.5 w-1.5 rounded-full bg-success" />
            Forensic compliance · trusted by 200+ networks
          </div>
          
          <div className="grid pt-5">
            {/* Invisible ghost element to set responsive height based on the largest content */}
            <div className="invisible col-start-1 row-start-1">
              <h1 className="text-4xl font-semibold leading-[1.05] tracking-tight md:text-5xl lg:text-6xl">
                Check If Your YouTube Channel Is At Risk Of Demonetization
              </h1>
              <p className="mt-5 max-w-xl text-base md:text-lg">
                Detect reused content, AI risks, shadowban signals, and monetization threats before YouTube does.
              </p>
            </div>

            <AnimatePresence mode="wait">
              <motion.div
                key={contentIndex}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.4 }}
                className="col-start-1 row-start-1"
              >
                <h1 className="text-4xl font-semibold leading-[1.05] tracking-tight md:text-5xl lg:text-6xl text-gradient">
                  {heroContent[contentIndex].title}
                </h1>
                <p className="mt-5 max-w-xl text-base text-muted-foreground md:text-lg">
                  {heroContent[contentIndex].desc}
                </p>
              </motion.div>
            </AnimatePresence>
          </div>

          <div className="mt-5 flex flex-wrap gap-3 relative z-10">
            <Link to="/register" className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90">
              Start free audit <ArrowRight className="h-4 w-4" />
            </Link>
            <Link to="/app" className="inline-flex items-center gap-2 rounded-md border bg-card/60 px-4 py-2.5 text-sm hover:bg-accent">
              View live dashboard
            </Link>
          </div>
          <div className="mt-10 relative z-10">
            <div className="text-xs font-semibold text-foreground/80 mb-3 uppercase tracking-wider">Free Audit Includes</div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-2.5 gap-x-4 text-xs text-muted-foreground">
              <div className="flex items-center gap-2"><Check className="h-3.5 w-3.5 text-success" /> Reused Content Detection</div>
              <div className="flex items-center gap-2"><Check className="h-3.5 w-3.5 text-success" /> Thumbnail Similarity Check</div>
              <div className="flex items-center gap-2"><Check className="h-3.5 w-3.5 text-success" /> AI Voice Detection</div>
              <div className="flex items-center gap-2"><Check className="h-3.5 w-3.5 text-success" /> Monetization Readiness Score</div>
              <div className="flex items-center gap-2"><Check className="h-3.5 w-3.5 text-success" /> Shadowban Diagnostic</div>
              <div className="flex items-center gap-2"><Check className="h-3.5 w-3.5 text-success" /> Channel Safety Recommendations</div>
            </div>
          </div>
        </motion.div>
        <motion.div initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.7, delay: 0.1 }}>
          <HeroDashboard />
        </motion.div>
      </div>
    </section>
  );
}

function Stats() {
  return (
    <section className="border-t bg-card/20">
      <div className="mx-auto grid max-w-7xl gap-8 px-4 py-12 md:grid-cols-3 md:px-6 text-center">
        <div>
          <div className="text-4xl font-bold tracking-tight text-foreground md:text-5xl">12,438</div>
          <div className="mt-2 text-sm font-medium text-muted-foreground uppercase tracking-wider">Channels Audited</div>
        </div>
        <div className="border-t border-border/50 pt-8 md:border-l md:border-t-0 md:pt-0">
          <div className="text-4xl font-bold tracking-tight text-foreground md:text-5xl">1.2M+</div>
          <div className="mt-2 text-sm font-medium text-muted-foreground uppercase tracking-wider">Videos Analyzed</div>
        </div>
        <div className="border-t border-border/50 pt-8 md:border-l md:border-t-0 md:pt-0">
          <div className="text-4xl font-bold tracking-tight text-foreground md:text-5xl">58,000+</div>
          <div className="mt-2 text-sm font-medium text-muted-foreground uppercase tracking-wider">Potential Risks Detected</div>
        </div>
      </div>
    </section>
  );
}

function TrustBar() {
  const items = [
    { icon: Shield, t: "AI forensic analysis" },
    { icon: Network, t: "Multi-channel monitoring" },
    { icon: Cpu, t: "Semantic script analysis" },
    { icon: ImageIcon, t: "Thumbnail similarity detection" },
    { icon: ShieldCheck, t: "Creator protection engine" },
  ];
  return (
    <section className="border-y bg-card/40">
      <div className="mx-auto grid max-w-7xl grid-cols-2 gap-6 px-4 py-8 md:grid-cols-5 md:px-6">
        {items.map((i) => (
          <div key={i.t} className="flex items-center gap-2 text-sm text-muted-foreground">
            <i.icon className="h-4 w-4 text-primary" />
            <span>{i.t}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

const featureIcons = [Network, Mic, ImageIcon, Cpu, Gauge, Activity, Eye, Sparkles];

function Features() {
  return (
    <section id="features" className="mx-auto max-w-7xl px-4 py-24 md:px-6">
      <div className="mx-auto max-w-2xl text-center">
        <div className="text-xs uppercase tracking-wider text-primary">Features</div>
        <h2 className="mt-3 text-3xl font-semibold tracking-tight md:text-4xl">Operational intelligence for compliance teams</h2>
        <p className="mt-3 text-muted-foreground">Forensic signals across content, behavior, and network patterns — surfaced as decisions, not data.</p>
      </div>

      <div className="mt-12 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {features.map((f, i) => {
          const Icon = featureIcons[i % featureIcons.length];
          return (
            <motion.div key={f.title}
              initial={{ opacity: 0, y: 12 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.04 }}
              className="group relative overflow-hidden rounded-xl border bg-card p-5 hairline transition-colors hover:border-primary/40">
              <div className="grid h-9 w-9 place-items-center rounded-md bg-primary/10 text-primary">
                <Icon className="h-4 w-4" />
              </div>
              <div className="mt-4 text-sm font-semibold tracking-tight">{f.title}</div>
              <div className="mt-1.5 text-xs text-muted-foreground leading-relaxed">{f.desc}</div>
              <div className="mt-4 inline-flex items-center gap-1.5 rounded-md border bg-background/40 px-2 py-1 text-[11px] text-muted-foreground">
                <span className="h-1 w-1 rounded-full bg-primary" /> {f.metric}
              </div>
              <div className="pointer-events-none absolute -right-8 -bottom-8 h-32 w-32 rounded-full bg-primary/10 blur-2xl opacity-0 transition-opacity group-hover:opacity-100" />
            </motion.div>
          );
        })}
      </div>
    </section>
  );
}

function Comparison() {
  const ytChecks = [
    { title: "Reused Content", desc: "Reuploading existing content without adding significant original commentary or educational value." },
    { title: "Low Transformative Value", desc: "Simple compilations or edits that don't meaningfully change the original work's narrative." },
    { title: "AI Generated Content Abuse", desc: "Mass-produced videos using generative AI without human curation or disclosure." },
    { title: "Repetitive Templates", desc: "Using the same visual templates or highly similar structures across dozens of videos." },
    { title: "Synthetic Voice Abuse", desc: "Using low-effort, robotic text-to-speech that violates YouTube's automated content policies." },
    { title: "Channel Farm Signals", desc: "Coordinated uploads, identical metadata, or behavior that triggers algorithmic spam filters." },
  ];

  const appPrevents = [
    { title: "Reused Content Detection", desc: "Scans your videos against extensive databases to flag exact match overlaps before you publish." },
    { title: "Transformative Analysis", desc: "Scores your edits, voiceovers, and pacing to ensure your content demonstrates high original value." },
    { title: "Synthetic Media Diagnostics", desc: "Detects deepfakes, heavily synthesized frames, and clear AI generation footprints." },
    { title: "Template & Asset Deduplication", desc: "Tracks asset reuse across your channel fleet to prevent 'Repetitive Content' algorithm flags." },
    { title: "Acoustic Fingerprinting", desc: "Identifies unnatural synthetic voiceovers and suggests humanized pacing improvements." },
    { title: "Network-Level Threat Monitoring", desc: "Analyzes upload velocity and cross-channel metadata to shield against farm/spam demotions." },
  ];

  return (
    <section className="mx-auto max-w-7xl px-4 py-24 md:px-6">
      <div className="mx-auto max-w-2xl text-center mb-16">
        <div className="text-xs uppercase tracking-wider text-primary">The Difference</div>
        <h2 className="mt-3 text-3xl font-semibold tracking-tight md:text-4xl">Proactive defense vs. Reactive penalties</h2>
      </div>

      <div className="grid gap-8 md:grid-cols-2">
        {/* YouTube Side */}
        <div className="group relative rounded-2xl border border-destructive/20 bg-destructive/5 p-8 overflow-hidden transition-all hover:border-destructive/40">
          <div className="absolute top-0 right-0 p-32 bg-destructive/10 blur-[100px] rounded-full pointer-events-none transition-opacity opacity-50 group-hover:opacity-100" />
          <div className="flex items-center gap-3 mb-8">
            <div className="grid h-10 w-10 place-items-center rounded-lg bg-destructive/20 text-destructive">
              <AlertTriangle className="h-5 w-5" />
            </div>
            <h3 className="text-xl font-semibold text-destructive">Common Reasons Channels Lose Monetization</h3>
          </div>
          <ul className="space-y-6">
            {ytChecks.map((item, i) => (
              <li key={i} className="flex gap-4 relative z-10">
                <div className="mt-1 flex-shrink-0 grid h-6 w-6 place-items-center rounded-full bg-destructive/20 text-destructive">
                  <X className="h-3.5 w-3.5" />
                </div>
                <div>
                  <div className="font-medium text-foreground">{item.title}</div>
                  <div className="mt-1 text-sm text-muted-foreground">{item.desc}</div>
                </div>
              </li>
            ))}
          </ul>
        </div>

        {/* TubeCheck Side */}
        <div className="group relative rounded-2xl border border-success/20 bg-success/5 p-8 overflow-hidden transition-all hover:border-success/40">
          <div className="absolute top-0 right-0 p-32 bg-success/10 blur-[100px] rounded-full pointer-events-none transition-opacity opacity-50 group-hover:opacity-100" />
          <div className="flex items-center gap-3 mb-8">
            <div className="grid h-10 w-10 place-items-center rounded-lg bg-success/20 text-success">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <h3 className="text-xl font-semibold text-success">How TubeCheck Solves It</h3>
          </div>
          <ul className="space-y-6">
            {appPrevents.map((item, i) => (
              <li key={i} className="flex gap-4 relative z-10">
                <div className="mt-1 flex-shrink-0 grid h-6 w-6 place-items-center rounded-full bg-success/20 text-success">
                  <Check className="h-3.5 w-3.5" />
                </div>
                <div>
                  <div className="font-medium text-foreground">{item.title}</div>
                  <div className="mt-1 text-sm text-muted-foreground">{item.desc}</div>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}

function Showcase() {
  return (
    <section className="relative border-y bg-card/30">
      <div className="mx-auto max-w-7xl px-4 py-24 md:px-6">
        <div className="mx-auto max-w-2xl text-center">
          <div className="text-xs uppercase tracking-wider text-primary">Dashboard</div>
          <h2 className="mt-3 text-3xl font-semibold tracking-tight md:text-4xl">YouTube Studio, reimagined for compliance</h2>
          <p className="mt-3 text-muted-foreground">Every signal you need to protect monetization, in one operational view.</p>
        </div>
        <div className="mt-12">
          <HeroDashboard />
        </div>
      </div>
    </section>
  );
}

function HowItWorks() {
  const steps = [
    { icon: Plug, t: "Connect channels", d: "OAuth into your network in seconds. Bulk import for agencies and MCNs." },
    { icon: Cpu, t: "Analyze content footprints", d: "Forensic models scan transcripts, audio, thumbnails, and upload behavior." },
    { icon: Zap, t: "Resolve compliance risks", d: "Actionable recommendations ranked by monetization impact." },
  ];
  return (
    <section className="mx-auto max-w-7xl px-4 py-24 md:px-6">
      <div className="mx-auto max-w-2xl text-center">
        <div className="text-xs uppercase tracking-wider text-primary">How it works</div>
        <h2 className="mt-3 text-3xl font-semibold tracking-tight md:text-4xl">Live in under five minutes</h2>
      </div>
      <div className="mt-12 grid gap-4 md:grid-cols-3">
        {steps.map((s, i) => (
          <div key={s.t} className="relative rounded-xl border bg-card p-6 hairline">
            <div className="text-[11px] font-mono text-muted-foreground">0{i+1}</div>
            <div className="mt-3 grid h-10 w-10 place-items-center rounded-md bg-primary/10 text-primary">
              <s.icon className="h-5 w-5" />
            </div>
            <div className="mt-4 text-base font-semibold tracking-tight">{s.t}</div>
            <div className="mt-1.5 text-sm text-muted-foreground">{s.d}</div>
          </div>
        ))}
      </div>
    </section>
  );
}

function Pricing() {
  const plans = [
    {
      name: "Free",
      title: "Free",
      price: "$0",
      desc: "Connect your channel and receive a full audit including:",
      features: [
        "1 Channel Sync",
        "Reused Content Risk Detection",
        "Script Similarity Analysis",
        "Thumbnail Similarity Detection",
        "AI Voice Detection",
        "Shadowban Diagnostic",
        "Synthetic Media Detection",
        "Stock Footage Overuse Detection",
        "Transformative Value Analysis",
        "Monetization Readiness Score",
        "Channel Safety Recommendations",
        "Personalized Fix Suggestions",
        "Compliance Trend Tracking",
      ],
      cta: "Start Free",
      highlight: false,
      credits: "10 Credits Monthly",
      comingSoon: false,
    },
    {
      name: "Creator Starter",
      title: "Creator Starter",
      price: "$10",
      desc: "Pro features with limited monthly scans for growing channels.",
      features: [
        "Everything in Free PLUS",
        "50 Credits Monthly",
        "Automated Daily Channel Monitoring",
        "AI Niche & RPM Checker",
        "RPM Opportunity Research",
        "Advanced Shadowban Diagnostics",
        "Early Warning Risk Alerts",
      ],
      cta: "Start Starter",
      highlight: false,
      credits: "50 Credits Monthly",
      comingSoon: false,
    },
    {
      name: "Creator Pro",
      title: "Creator Pro",
      price: "$49",
      desc: "For creators publishing consistently and managing multiple videos weekly.",
      features: [
        "Everything in Starter PLUS",
        "Unlimited Monthly Credits",
        "Priority Processing",
        "Historical Compliance Reports",
        "Competitor Comparison Insights",
        "Email Notifications",
      ],
      cta: "Upgrade to Pro",
      highlight: true,
      credits: "Unlimited Monthly Credits",
      comingSoon: false,
    },
    {
      name: "Enterprise",
      title: "Enterprise",
      price: "$199",
      desc: "For agencies, creator teams, and multi-channel businesses.",
      features: [
        "Everything in Pro PLUS",
        "Unlimited Monthly Credits",
        "Multi-Channel Compliance Dashboard",
        "Channel Network Monitoring",
        "Cross-Channel Script Similarity Detection",
        "Shared Asset Detection",
        "Channel Farm Pattern Detection",
        "Team Members & Permissions",
        "White-Label Reports",
        "API Access",
        "Dedicated Support",
        "Custom Compliance Rules",
        "Advanced Forensic Analytics",
      ],
      cta: "Coming Soon",
      highlight: false,
      credits: "Unlimited Monthly Credits",
      comingSoon: true,
    },
  ];
  return (
    <section id="pricing" className="mx-auto max-w-7xl px-4 py-24 md:px-6">
      <div className="mx-auto max-w-2xl text-center space-y-4">
        <div className="text-xs uppercase tracking-wider text-primary font-bold">Pricing</div>
        <h2 className="text-4xl font-extrabold tracking-tight md:text-5xl">Start Free. Scan Your Entire Channel.</h2>
        <p className="text-sm text-muted-foreground max-w-md mx-auto">
          Connect your YouTube channel and instantly receive a complete compliance and monetization audit.
          <span className="block mt-1 font-semibold text-foreground">No credits required · No credit card required.</span>
        </p>
      </div>
      <div className="mt-12 grid gap-4 md:grid-cols-2 lg:grid-cols-4 items-start">
        {plans.map((p) => (
          <div key={p.name}
            className={`relative rounded-2xl border p-6 transition-all duration-300 md:hover:scale-[1.02] md:hover:shadow-2xl md:hover:shadow-primary/10 ${p.highlight ? "bg-card ring-1 ring-primary/45 border-primary/40 shadow-lg" : "bg-card border-muted/30"}`}>
            {p.highlight && (
              <div className="absolute -top-3 left-6 inline-flex items-center gap-1 rounded-full bg-primary px-2.5 py-0.5 text-[11px] font-medium text-primary-foreground">
                <Sparkles className="h-3 w-3" /> Most popular
              </div>
            )}
            <div className="text-base font-bold tracking-tight">{p.title}</div>
            <div className="mt-1 text-xs text-muted-foreground min-h-[32px]">{p.desc}</div>
            <div className="mt-5 flex items-baseline gap-1">
              <div className="text-4xl font-extrabold tracking-tight">{p.price}</div>
              {p.price !== "$0" && p.price !== "Custom" && <div className="text-xs text-muted-foreground">/mo</div>}
            </div>

            {/* Credits badge */}
            <div className="mt-4 rounded-lg bg-muted/35 border border-border/40 p-2 text-center">
              <p className="text-xs font-bold text-foreground flex items-center justify-center gap-1.5">
                <Zap className="h-3.5 w-3.5 text-yellow-500 fill-yellow-500" />
                {p.credits}
              </p>
            </div>

            {/* Credit usage guidelines */}
            <div className="mt-4 text-[11px] text-muted-foreground border-t border-border/30 pt-3 space-y-1">
              <div className="font-semibold text-foreground/80 text-[10px] uppercase tracking-wider mb-1">Credit Usage:</div>
              <div className="flex justify-between">
                <span>Pre-Publish Video Scan</span>
                <span className="font-mono text-foreground font-semibold">1 Credit</span>
              </div>
              <div className="flex justify-between">
                <span>AI Appeal Script Generator</span>
                <span className="font-mono text-foreground font-semibold">5 Credits</span>
              </div>
            </div>

            <ul className="mt-5 space-y-2.5 text-xs border-t border-border/30 pt-4">
              {p.features.map((f) => (
                <li key={f} className="flex items-start gap-2 text-muted-foreground">
                  <Check className="h-4 w-4 text-primary shrink-0 mt-0.5" /> <span className="text-foreground/90">{f}</span>
                </li>
              ))}
            </ul>
            {p.comingSoon ? (
              <button disabled className="mt-6 block text-center w-full rounded-md px-3 py-2 text-sm font-medium transition-colors border bg-card opacity-50 cursor-not-allowed">
                Coming Soon
              </button>
            ) : p.name === "Enterprise" ? (
              <a 
                href="mailto:sales@shieldnetwork.ai?subject=Enterprise%20Plan%20Inquiry" 
                className={`mt-6 block text-center w-full rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                  p.highlight ? "bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm" : "border bg-card hover:bg-accent"
                }`}
              >
                {p.cta}
              </a>
            ) : (
              <Link 
                to="/register" 
                className={`mt-6 block text-center w-full rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                  p.highlight ? "bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm" : "border bg-card hover:bg-accent"
                }`}
              >
                {p.cta}
              </Link>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}

function FinalCTA() {
  return (
    <section className="mx-auto max-w-7xl px-4 pb-24 md:px-6">
      <div className="relative overflow-hidden rounded-3xl border bg-card p-10 text-center hairline md:p-16">
        <div className="pointer-events-none absolute inset-0 grid-bg opacity-40" />
        <div className="pointer-events-none absolute inset-x-0 top-0 h-40" style={{ background: "var(--gradient-hero)" }} />
        <div className="relative">
          <h2 className="mx-auto max-w-2xl text-3xl font-semibold tracking-tight md:text-4xl text-gradient">
            Monitor your content network like an enterprise intelligence system.
          </h2>
          <div className="mt-6 flex justify-center gap-3">
            <Link to="/register" className="inline-flex items-center gap-2 rounded-md bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90">
              Start free audit <ArrowRight className="h-4 w-4" />
            </Link>
            <a href="#" className="inline-flex items-center gap-2 rounded-md border bg-card/60 px-5 py-2.5 text-sm hover:bg-accent">Talk to sales</a>
          </div>
        </div>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="border-t bg-card/40">
      <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-6 px-4 py-12 md:flex-row md:px-6">
        <div>
          <Logo />
          <p className="mt-3 max-w-xs text-xs text-muted-foreground">
            Forensic compliance intelligence for YouTube creators, agencies, and networks.
          </p>
        </div>
        <div className="flex flex-col items-center gap-2 md:items-end">
          <div className="text-[11px] text-muted-foreground">© 2026 TubeCheck · All rights reserved</div>
          <a href="https://x.com/Youtuberguild" target="_blank" rel="noreferrer" className="text-xs hover:text-foreground text-muted-foreground transition-colors">
            @Youtuberguild
          </a>
        </div>
      </div>
    </footer>
  );
}

function Landing() {
  return (
    <div className="min-h-screen">
      <Nav />
      <Hero />
      <Stats />
      <TrustBar />
      <Features />
      <Comparison />
      <Showcase />
      <HowItWorks />
      <Pricing />
      <FinalCTA />
      <Footer />
    </div>
  );
}
