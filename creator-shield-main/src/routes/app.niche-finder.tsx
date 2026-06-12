import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { api, NicheAnalysisResult } from "@/lib/api";
import { Panel } from "@/components/dashboard/Panel";
import {
  Sparkles,
  Search,
  TrendingUp,
  AlertTriangle,
  Compass,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  FileText,
  ChevronRight,
  BookOpen,
  DollarSign,
  Tv,
  ArrowRight,
  PlusCircle,
  Bookmark,
  Calendar,
  Layers,
  ChevronDown
} from "lucide-react";
import { toast } from "sonner";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";

export const Route = createFileRoute("/app/niche-finder")({
  component: NicheFinderPage,
});

// Seed data for history if empty
const INITIAL_HISTORY = [
  { query: "Ancient Roman Mysteries", format: "Long-form", rating: 82, timestamp: Date.now() - 3600000 * 2 },
  { query: "Daily Stoic Quotes", format: "Shorts", rating: 45, timestamp: Date.now() - 3600000 * 8 },
  { query: "Index Fund Comparison", format: "Long-form", rating: 90, timestamp: Date.now() - 3600000 * 24 },
];

const TRENDING_SUGGESTIONS = [
  { query: "Deep Sea Exploration", format: "Long-form", cpm: "High", safety: "Safe (85/100)" },
  { query: "Micro-Learning Skill Builders", format: "Shorts", cpm: "Medium", safety: "Safe (78/100)" },
  { query: "Sovereign Debt Economics", format: "Long-form", cpm: "Very High", safety: "Very Safe (92/100)" },
  { query: "AI-Enhanced Art History", format: "Long-form", cpm: "High", safety: "Safe (80/100)" },
];

// Graph tooltip config
const chartTooltip = {
  contentStyle: {
    background: "oklch(0.20 0.014 250)",
    border: "1px solid oklch(0.28 0.014 250)",
    borderRadius: 8,
    fontSize: 12,
    color: "oklch(0.97 0.005 250)",
  },
  cursor: { stroke: "oklch(0.82 0.16 210)", strokeOpacity: 0.3 },
};

function NicheFinderPage() {
  const [queryInput, setQueryInput] = useState("");
  const [selectedFormat, setSelectedFormat] = useState<"Long-form" | "Shorts">("Long-form");
  const [loading, setLoading] = useState(false);
  const [analysis, setAnalysis] = useState<NicheAnalysisResult | null>(null);
  const [history, setHistory] = useState<Array<any>>([]);
  const [activeTab, setActiveTab] = useState<"overview" | "strategy" | "blueprint">("overview");
  const [expandedIdea, setExpandedIdea] = useState<number | null>(0);
  const [trendAnalysis, setTrendAnalysis] = useState("Hover over the trend line to analyze search interest trajectory and seasonal demand patterns.");

  // Load history from localStorage
  useEffect(() => {
    const cached = localStorage.getItem("cs_niche_history");
    if (cached) {
      try {
        setHistory(JSON.parse(cached));
      } catch {
        setHistory(INITIAL_HISTORY);
      }
    } else {
      setHistory(INITIAL_HISTORY);
      localStorage.setItem("cs_niche_history", JSON.stringify(INITIAL_HISTORY));
    }
  }, []);

  const handleSearch = async (searchQuery: string, format: string) => {
    if (!searchQuery.trim()) return;
    setLoading(true);
    try {
      const result = await api.analyzeNiche({
        query: searchQuery.trim(),
        format: format,
      });

      setAnalysis(result);
      setActiveTab("overview");

      // Update history in localStorage
      const newHistoryItem = {
        query: result.niche,
        format: format,
        rating: Math.round(result.shield_rating),
        timestamp: Date.now(),
      };

      // Filter duplicates
      const updatedHistory = [
        newHistoryItem,
        ...history.filter((h) => h.query.toLowerCase() !== result.niche.toLowerCase()),
      ].slice(0, 10); // keep last 10

      setHistory(updatedHistory);
      localStorage.setItem("cs_niche_history", JSON.stringify(updatedHistory));
      toast.success(`Niche analysis for "${result.niche}" generated successfully.`);
    } catch (err: any) {
      toast.error(err.message || "Failed to analyze niche. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleSearch(queryInput, selectedFormat);
  };

  const getShieldRatingColor = (rating: number) => {
    if (rating >= 80) return "text-success border-success/30 bg-success/5";
    if (rating >= 50) return "text-warning border-warning/30 bg-warning/5";
    return "text-destructive border-destructive/30 bg-destructive/5";
  };

  const getRiskBadgeStyles = (risk: string) => {
    const r = risk.toLowerCase();
    if (r === "high" || r === "very high") {
      return "bg-destructive/10 text-destructive border-destructive/20";
    }
    if (r === "medium") {
      return "bg-warning/10 text-warning border-warning/20";
    }
    return "bg-success/10 text-success border-success/20";
  };

  // Generate simulated chart data based on shield rating to show trend
  const getTrendData = () => {
    if (!analysis) return [];
    const baseVal = analysis.search_volume === "High" ? 75 : analysis.search_volume === "Medium" ? 45 : 20;
    return [
      { month: "Jan", interest: baseVal - 5 },
      { month: "Feb", interest: baseVal + 8 },
      { month: "Mar", interest: baseVal - 3 },
      { month: "Apr", interest: baseVal + 12 },
      { month: "May", interest: baseVal + 5 },
      { month: "Jun", interest: baseVal + 18 },
    ];
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <Compass className="h-6 w-6 text-primary" />
          AI Niche & RPM Checker
        </h2>
        <p className="text-sm text-muted-foreground mt-1">
          Perform a compliance pre-audit and evaluate monetization safety profiles for new content niches before producing videos.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-12">
        {/* Left column: Search Panel & History */}
        <div className="lg:col-span-4 space-y-6">
          <Panel title="Niche Intelligence Search" subtitle="Enter your concept to check policy ratings">
            <form onSubmit={onSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Content Topic / Niche</label>
                <div className="relative">
                  <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <input
                    type="text"
                    required
                    value={queryInput}
                    onChange={(e) => setQueryInput(e.target.value)}
                    placeholder="e.g. World War II Storytelling..."
                    className="pl-9 pr-4 py-2.5 w-full bg-background border rounded-lg text-sm outline-none focus:ring-1 focus:ring-primary focus:border-primary transition-all placeholder:text-muted-foreground"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Format Target</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setSelectedFormat("Long-form")}
                    className={`py-2 px-3 text-xs font-semibold rounded-lg border flex items-center justify-center gap-2 cursor-pointer transition-all ${
                      selectedFormat === "Long-form"
                        ? "bg-primary/10 border-primary text-primary"
                        : "bg-background/40 hover:bg-accent/50 text-muted-foreground"
                    }`}
                  >
                    <Tv className="h-3.5 w-3.5" />
                    Long-form
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedFormat("Shorts")}
                    className={`py-2 px-3 text-xs font-semibold rounded-lg border flex items-center justify-center gap-2 cursor-pointer transition-all ${
                      selectedFormat === "Shorts"
                        ? "bg-primary/10 border-primary text-primary"
                        : "bg-background/40 hover:bg-accent/50 text-muted-foreground"
                    }`}
                  >
                    <Layers className="h-3.5 w-3.5" />
                    Shorts
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-primary py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors cursor-pointer"
              >
                {loading ? "Analyzing Niche Risk..." : "Analyze Niche"}
                <Sparkles className="h-4 w-4" />
              </button>
            </form>
          </Panel>

          {/* Quick Suggestions */}
          <Panel title="Trending Categories" subtitle="Pre-audited high opportunity ideas">
            <div className="flex flex-col gap-2">
              {TRENDING_SUGGESTIONS.map((s, idx) => (
                <button
                  key={idx}
                  onClick={() => {
                    setQueryInput(s.query);
                    setSelectedFormat(s.format as any);
                    handleSearch(s.query, s.format);
                  }}
                  className="flex items-center justify-between p-3 rounded-lg border bg-background/30 hover:bg-accent/40 text-left transition-colors cursor-pointer text-xs hairline group"
                >
                  <div>
                    <div className="font-semibold text-foreground group-hover:text-primary transition-colors">{s.query}</div>
                    <div className="text-[10px] text-muted-foreground mt-0.5">{s.format} · CPM: {s.cpm}</div>
                  </div>
                  <span className="text-[10px] bg-primary/10 text-primary border border-primary/20 px-2 py-0.5 rounded-full font-bold">
                    {s.safety}
                  </span>
                </button>
              ))}
            </div>
          </Panel>

          {/* Search History */}
          <Panel title="Recent Analyses" subtitle="Stored locally on this device">
            <div className="flex flex-col gap-2 divide-y divide-border/40">
              {history.map((h, idx) => (
                <div
                  key={idx}
                  onClick={() => {
                    setQueryInput(h.query);
                    setSelectedFormat(h.format);
                    handleSearch(h.query, h.format);
                  }}
                  className="flex items-center justify-between py-2.5 first:pt-0 last:pb-0 cursor-pointer hover:text-primary transition-colors text-xs"
                >
                  <div className="min-w-0 flex-1 pr-2">
                    <div className="font-medium truncate">{h.query}</div>
                    <div className="text-[10px] text-muted-foreground mt-0.5">{h.format}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`px-2 py-0.5 rounded border text-[10px] font-bold ${
                      h.rating >= 80 ? "text-success border-success/20 bg-success/5" :
                      h.rating >= 50 ? "text-warning border-warning/20 bg-warning/5" :
                      "text-destructive border-destructive/20 bg-destructive/5"
                    }`}>
                      {h.rating}/100
                    </span>
                    <ChevronRight className="h-3 w-3 text-muted-foreground" />
                  </div>
                </div>
              ))}
              {history.length === 0 && (
                <div className="text-center py-4 text-xs text-muted-foreground">No recent analyses.</div>
              )}
            </div>
          </Panel>
        </div>

        {/* Right column: Results Dashboard */}
        <div className="lg:col-span-8">
          {loading ? (
            /* Premium Skeleton loading state */
            <div className="rounded-2xl border bg-card p-6 md:p-8 space-y-6 hairline shadow-xl animate-pulse">
              <div className="flex items-center justify-between border-b pb-4">
                <div className="space-y-2">
                  <div className="h-6 w-48 bg-muted rounded" />
                  <div className="h-4 w-32 bg-muted rounded" />
                </div>
                <div className="h-8 w-24 bg-muted rounded-full" />
              </div>

              <div className="grid gap-4 md:grid-cols-3">
                <div className="h-36 bg-muted rounded-xl" />
                <div className="h-36 bg-muted rounded-xl md:col-span-2" />
              </div>

              <div className="space-y-4">
                <div className="h-4 w-full bg-muted rounded" />
                <div className="h-4 w-5/6 bg-muted rounded" />
                <div className="h-4 w-4/5 bg-muted rounded" />
              </div>
              
              <div className="grid gap-3 grid-cols-3">
                <div className="h-12 bg-muted rounded" />
                <div className="h-12 bg-muted rounded" />
                <div className="h-12 bg-muted rounded" />
              </div>
            </div>
          ) : analysis ? (
            /* Analysis Results Card */
            <div className="space-y-6">
              {/* Niche Header Banner */}
              <div className="rounded-2xl border bg-card/60 p-6 md:p-8 shadow-xl relative overflow-hidden hairline">
                <div className="pointer-events-none absolute -right-24 -top-24 w-80 h-80 rounded-full bg-primary/5 blur-[80px]" />

                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b pb-6">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-primary/10 border border-primary/20 text-primary uppercase tracking-wider">
                        {selectedFormat} Format
                      </span>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-accent border text-muted-foreground uppercase tracking-wider">
                        AI Viability: {analysis.ai_viability}
                      </span>
                    </div>
                    <h3 className="text-xl md:text-2xl font-bold tracking-tight text-gradient mt-2">
                      {analysis.niche}
                    </h3>
                    <p className="text-xs text-muted-foreground mt-1 font-mono uppercase tracking-widest">
                      TubeCheck Niche Profile Scan
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => window.print()}
                      className="rounded-lg border px-3 py-1.5 text-xs font-semibold hover:bg-accent transition-colors flex items-center gap-1.5 cursor-pointer"
                    >
                      <FileText className="h-3.5 w-3.5" />
                      Export Report
                    </button>
                  </div>
                </div>

                {/* Main executive details with Circular progress */}
                <div className="grid gap-6 md:grid-cols-12 mt-6">
                  {/* ShieldRating Gauge */}
                  <div className="md:col-span-4 flex flex-col items-center justify-center p-4 border rounded-xl bg-background/30 hairline relative">
                    <div className="relative h-28 w-28 flex items-center justify-center">
                      <svg className="w-full h-full transform -rotate-90">
                        <circle
                          cx="56"
                          cy="56"
                          r="48"
                          className="stroke-muted-foreground/10"
                          strokeWidth="8"
                          fill="transparent"
                        />
                        <circle
                          cx="56"
                          cy="56"
                          r="48"
                          className={
                            analysis.shield_rating >= 80 ? "stroke-success" :
                            analysis.shield_rating >= 50 ? "stroke-warning" :
                            "stroke-destructive"
                          }
                          strokeWidth="8"
                          strokeDasharray={2 * Math.PI * 48}
                          strokeDashoffset={2 * Math.PI * 48 * (1 - analysis.shield_rating / 100)}
                          strokeLinecap="round"
                          fill="transparent"
                        />
                      </svg>
                      <div className="absolute flex flex-col items-center">
                        <span className="text-2xl font-bold tabular-nums">{Math.round(analysis.shield_rating)}</span>
                        <span className="text-[9px] uppercase font-bold text-muted-foreground tracking-widest">ShieldRating</span>
                      </div>
                    </div>

                    <span className={`mt-3 text-[10px] font-bold uppercase border px-2.5 py-0.5 rounded-full ${getShieldRatingColor(analysis.shield_rating)}`}>
                      {analysis.shield_rating >= 80 ? "Low Risk" :
                       analysis.shield_rating >= 50 ? "Moderate Risk" :
                       "High Risk"}
                    </span>
                  </div>

                  {/* Summary Text and key cards */}
                  <div className="md:col-span-8 flex flex-col justify-between">
                    <p className="text-sm leading-relaxed text-muted-foreground/90 bg-background/20 p-4 rounded-xl border hairline">
                      {analysis.summary}
                    </p>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4">
                      <div className="border bg-background/40 p-3 rounded-lg text-center hairline">
                        <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Demand</span>
                        <span className="block text-sm font-semibold text-foreground mt-0.5">{analysis.search_volume}</span>
                      </div>
                      <div className="border bg-background/40 p-3 rounded-lg text-center hairline">
                        <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Competition</span>
                        <span className="block text-sm font-semibold text-foreground mt-0.5">{analysis.competition}</span>
                      </div>
                      <div className="border bg-background/40 p-3 rounded-lg text-center hairline">
                        <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">CPM Rate</span>
                        <span className="block text-sm font-semibold text-foreground mt-0.5">{analysis.cpm_level}</span>
                      </div>
                      <div className="border bg-background/40 p-3 rounded-lg text-center hairline">
                        <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Est. RPM</span>
                        <span className="block text-xs font-semibold text-primary mt-0.5 font-mono">{analysis.cpm_rpm_estimate}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Navigation Tabs */}
              <div className="flex border-b border-border/60">
                {[
                  { id: "overview", label: "Risk & Policy Metrics", icon: AlertTriangle },
                  { id: "strategy", label: "Compliant Strategy Playbook", icon: BookOpen },
                  { id: "blueprint", label: "Video Idea Blueprint", icon: FileText },
                ].map((t) => {
                  const Icon = t.icon;
                  const active = activeTab === t.id;
                  return (
                    <button
                      key={t.id}
                      onClick={() => setActiveTab(t.id as any)}
                      className={`flex items-center gap-2 py-3 px-4 text-xs font-semibold border-b-2 -mb-[2px] transition-all cursor-pointer ${
                        active
                          ? "border-primary text-primary bg-primary/5"
                          : "border-transparent text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      <Icon className="h-4 w-4" />
                      {t.label}
                    </button>
                  );
                })}
              </div>

              {/* Tab Content 1: Risk & Policy */}
              {activeTab === "overview" && (
                <div className="grid gap-6 md:grid-cols-3">
                  {/* Left part: Risk Cards */}
                  <div className="md:col-span-2 space-y-4">
                    <Panel title="Monetization Policy Warnings" subtitle="YouTube Partner Program compliance scans">
                      <div className="space-y-4">
                        <div className="flex items-start justify-between gap-4 p-4 border rounded-xl bg-background/20 hairline">
                          <div>
                            <div className="font-semibold text-sm">Reused Content Risk</div>
                            <p className="text-xs text-muted-foreground mt-1">
                              Triggers when uploading identical clips, generic slideshows, or scripts read by standard robotic voice synthesis without edits.
                            </p>
                          </div>
                          <span className={`px-2.5 py-1 rounded text-[10px] font-bold border ${getRiskBadgeStyles(analysis.reuse_content_risk)}`}>
                            {analysis.reuse_content_risk} Risk
                          </span>
                        </div>

                        <div className="flex items-start justify-between gap-4 p-4 border rounded-xl bg-background/20 hairline">
                          <div>
                            <div className="font-semibold text-sm">Copyright Infringement Danger</div>
                            <p className="text-xs text-muted-foreground mt-1">
                              Triggers when incorporating unauthorized video fragments, music, movie clips, or proprietary news footage.
                            </p>
                          </div>
                          <span className={`px-2.5 py-1 rounded text-[10px] font-bold border ${getRiskBadgeStyles(analysis.copyright_risk)}`}>
                            {analysis.copyright_risk} Risk
                          </span>
                        </div>

                        <div className="flex items-start justify-between gap-4 p-4 border rounded-xl bg-background/20 hairline">
                          <div>
                            <div className="font-semibold text-sm">Advertiser-Friendly Suitability</div>
                            <p className="text-xs text-muted-foreground mt-1">
                              Yellow-dollar demonetization risks. Triggers on sensitive content topics, toxicity, slurs, violence, or controversial news.
                            </p>
                          </div>
                          <span className={`px-2.5 py-1 rounded text-[10px] font-bold border ${getRiskBadgeStyles(analysis.advertiser_friendly_risk)}`}>
                            {analysis.advertiser_friendly_risk} Risk
                          </span>
                        </div>
                      </div>
                    </Panel>

                    {/* Policy red flags */}
                    <Panel title="Critical Red Flags" subtitle="Watch out for these policy hurdles">
                      <ul className="space-y-2">
                        {analysis.red_flags.map((flag, idx) => (
                          <li key={idx} className="flex items-start gap-2.5 text-xs text-muted-foreground">
                            <span className="h-1.5 w-1.5 rounded-full bg-destructive mt-1.5 shrink-0" />
                            <span>{flag}</span>
                          </li>
                        ))}
                      </ul>
                    </Panel>
                  </div>

                  {/* Right part: Demand Chart & Stats */}
                  <div className="space-y-6">
                    <Panel title="Search Interest Trend" subtitle="Expected demand trajectory (6 Months)">
                      <div className="h-[150px] w-full mt-2">
                        <ResponsiveContainer width="100%" height="100%">
                          <LineChart 
                            data={getTrendData()}
                            onMouseMove={(state) => {
                              if (state && state.activePayload && state.activePayload.length > 0) {
                                const data = state.activePayload[0].payload;
                                setTrendAnalysis(`In ${data.month}, the simulated search interest was ${data.interest}/100. ${
                                  data.interest > 70
                                    ? "🔥 Peak interest: Strong query volume and high content demand."
                                    : data.interest > 40
                                    ? "📈 Moderate interest: Stable viewer demand and consistent search volume."
                                    : "📉 Low interest: Lower viewer demand, representing a smaller niche."
                                }`);
                              }
                            }}
                            onMouseLeave={() => {
                              setTrendAnalysis("Hover over the trend line to analyze search interest trajectory and seasonal demand patterns.");
                            }}
                          >
                            <XAxis dataKey="month" tick={{ fill: "oklch(0.66 0.018 250)", fontSize: 10 }} axisLine={false} tickLine={false} />
                            <Tooltip {...chartTooltip} />
                            <Line type="monotone" dataKey="interest" stroke="oklch(0.82 0.16 210)" strokeWidth={2.5} dot={{ r: 3 }} activeDot={{ r: 5 }} />
                          </LineChart>
                        </ResponsiveContainer>
                      </div>
                      <div className="mt-3 rounded-lg border bg-muted/20 p-2.5 text-[11px] text-muted-foreground italic hairline flex items-start gap-1.5 min-h-[45px] transition-all">
                        <Sparkles className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                        <div>
                          <span className="font-semibold text-foreground not-italic">Analysis:</span>{" "}
                          {trendAnalysis}
                        </div>
                      </div>
                    </Panel>

                    <Panel title="Audience Demographics" subtitle="Key listener profiles">
                      <div className="space-y-3 text-xs">
                        <div className="flex justify-between border-b pb-1.5">
                          <span className="text-muted-foreground">Age Core</span>
                          <span className="font-semibold">{analysis.audience_demographics.age_groups.join(", ")}</span>
                        </div>
                        <div className="flex justify-between border-b pb-1.5">
                          <span className="text-muted-foreground">Gender Split</span>
                          <span className="font-semibold">{analysis.audience_demographics.gender_distribution}</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground block mb-1">Top Geographies</span>
                          <div className="flex flex-wrap gap-1.5">
                            {analysis.audience_demographics.top_countries.map((c, idx) => (
                              <span key={idx} className="bg-background/60 px-2 py-0.5 border rounded text-[10px] font-medium">
                                {c}
                              </span>
                            ))}
                          </div>
                        </div>
                      </div>
                    </Panel>
                  </div>
                </div>
              )}

              {/* Tab Content 2: Strategy Playbook */}
              {activeTab === "strategy" && (
                <div className="grid gap-6 md:grid-cols-2">
                  <Panel title="Human-in-the-Loop Safe Production Playbook" subtitle="Avoid automation flags with Shield-approved workflows">
                    <div className="space-y-4">
                      {analysis.safe_content_strategy.map((step, idx) => (
                        <div key={idx} className="flex gap-3">
                          <div className="rounded-full bg-success/15 text-success h-6 w-6 flex items-center justify-center shrink-0 font-bold text-xs border border-success/30">
                            {idx + 1}
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground leading-relaxed">
                              {step}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </Panel>

                  <div className="space-y-6">
                    <Panel title="Recommended Tools & Systems" subtitle="Approved AI assets for compliant creators">
                      <div className="grid grid-cols-2 gap-3">
                        {analysis.recommended_tools.map((tool, idx) => (
                          <div key={idx} className="border bg-background/35 p-3 rounded-lg flex items-center gap-2.5 hairline">
                            <div className="bg-primary/10 rounded p-1.5 border border-primary/20">
                              <Sparkles className="h-3.5 w-3.5 text-primary" />
                            </div>
                            <span className="text-xs font-semibold">{tool}</span>
                          </div>
                        ))}
                      </div>
                    </Panel>

                    <Panel title="Pros & Cons Breakdown" subtitle="Should you enter this niche?">
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <span className="text-xs font-bold text-success block mb-2">PROS</span>
                          <ul className="space-y-1.5">
                            {analysis.pros.map((p, idx) => (
                              <li key={idx} className="flex items-start gap-1.5 text-[11px] text-muted-foreground">
                                <CheckCircle2 className="h-3 w-3 text-success mt-0.5 shrink-0" />
                                <span>{p}</span>
                              </li>
                            ))}
                          </ul>
                        </div>

                        <div>
                          <span className="text-xs font-bold text-destructive block mb-2">CONS</span>
                          <ul className="space-y-1.5">
                            {analysis.cons.map((c, idx) => (
                              <li key={idx} className="flex items-start gap-1.5 text-[11px] text-muted-foreground">
                                <AlertCircle className="h-3 w-3 text-destructive mt-0.5 shrink-0" />
                                <span>{c}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      </div>
                    </Panel>
                  </div>
                </div>
              )}

              {/* Tab Content 3: Content Blueprint */}
              {activeTab === "blueprint" && (
                <Panel title="Video Idea Compliance Blueprint" subtitle="Expand to see scripts, hooks, and compliance safeguards">
                  <div className="space-y-4">
                    {analysis.sample_video_ideas.map((idea, idx) => {
                      const expanded = expandedIdea === idx;
                      return (
                        <div
                          key={idx}
                          className="border rounded-xl bg-background/25 overflow-hidden transition-all duration-200 hairline"
                        >
                          {/* Accordion Trigger */}
                          <div
                            onClick={() => setExpandedIdea(expanded ? null : idx)}
                            className="flex items-center justify-between p-4 cursor-pointer hover:bg-accent/40 select-none"
                          >
                            <div className="flex items-center gap-3">
                              <span className="text-xs text-muted-foreground font-mono font-bold">IDEA 0{idx + 1}</span>
                              <span className="font-semibold text-sm">{idea.title}</span>
                            </div>
                            <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform duration-200 ${
                              expanded ? "transform rotate-180" : ""
                            }`} />
                          </div>

                          {/* Accordion Content */}
                          {expanded && (
                            <div className="p-4 border-t bg-background/10 space-y-4 text-xs animate-[fadeIn_0.2s_ease-out]">
                              <div>
                                <span className="font-bold uppercase tracking-wider text-primary text-[10px] block mb-1">Viral Hook Suggestion</span>
                                <p className="text-muted-foreground italic bg-accent/40 px-3 py-2 rounded-lg border">
                                  "{idea.hook}"
                                </p>
                              </div>

                              <div>
                                <span className="font-bold uppercase tracking-wider text-muted-foreground text-[10px] block mb-1">Narrative Outline</span>
                                <p className="text-muted-foreground whitespace-pre-line leading-relaxed">
                                  {idea.outline}
                                </p>
                              </div>

                              <div className="p-3 border border-success/25 bg-success/5 rounded-lg">
                                <div className="flex items-start gap-2">
                                  <CheckCircle2 className="h-4 w-4 text-success shrink-0 mt-0.5" />
                                  <div>
                                    <span className="font-bold text-success uppercase text-[10px]">Shield AI Compliance Safeguard</span>
                                    <p className="text-muted-foreground mt-0.5 leading-relaxed">
                                      {idea.ai_safety_tip}
                                    </p>
                                  </div>
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </Panel>
              )}
            </div>
          ) : (
            /* Welcome Landing State */
            <div className="rounded-2xl border bg-card/65 p-8 text-center hairline shadow-xl space-y-8 py-16 relative overflow-hidden">
              <div className="pointer-events-none absolute inset-0 -z-10 grid-bg opacity-20 [mask-image:radial-gradient(ellipse_at_center,black,transparent_75%)]" />
              <div className="pointer-events-none absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[350px] h-[350px] rounded-full bg-primary/5 blur-[80px]" />

              <div className="max-w-md mx-auto space-y-6">
                <div className="rounded-full bg-primary/10 p-5 ring-8 ring-primary/5 w-fit mx-auto border border-primary/25">
                  <Compass className="h-12 w-12 text-primary" />
                </div>

                <div className="space-y-2">
                  <h3 className="text-xl font-bold tracking-tight">AI Niche Compliance Analyser</h3>
                  <p className="text-sm text-muted-foreground">
                    Protect your channel's monetization stability. Search a potential niche above or choose a suggestion to evaluate metadata redundancy risks, copyright liability, and script automation viability.
                  </p>
                </div>

                <div className="flex flex-wrap items-center justify-center gap-2">
                  {["Stoic Motivation", "Ancient Civilizations", "Real Estate Investing"].map((keyword, idx) => (
                    <button
                      key={idx}
                      onClick={() => {
                        setQueryInput(keyword);
                        handleSearch(keyword, "Long-form");
                      }}
                      className="bg-background border hover:border-primary/40 px-3 py-1.5 rounded-lg text-xs font-semibold text-muted-foreground hover:text-foreground transition-all cursor-pointer inline-flex items-center gap-1"
                    >
                      Analyze "{keyword}"
                      <ArrowRight className="h-3 w-3" />
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
