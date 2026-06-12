export const alerts = [
  {
    id: "A-981",
    severity: "high",
    title: "Thumbnail similarity exceeded 90%",
    channel: "TrendVerse Daily",
    time: "2m ago"
  },
  {
    id: "A-982",
    severity: "medium",
    title: "Automated script pacing warning",
    channel: "StoryShorts",
    time: "15m ago"
  },
  {
    id: "A-983",
    severity: "low",
    title: "Synthetic narration check required",
    channel: "QuickFacts Hub",
    time: "1h ago"
  },
  {
    id: "A-984",
    severity: "medium",
    title: "Upload velocity threshold alert",
    channel: "BriefRoom",
    time: "3h ago"
  }
];

export const channels = [
  {
    id: "c1",
    name: "TrendVerse Daily",
    handle: "@trendverse_daily",
    subs: "1.2M",
    health: 94,
    risk: "low",
    originality: 92,
    uploads: 42,
    monetization: "safe"
  },
  {
    id: "c2",
    name: "StoryShorts",
    handle: "@storyshorts_official",
    subs: "840K",
    health: 68,
    risk: "medium",
    originality: 71,
    uploads: 84,
    monetization: "watch"
  },
  {
    id: "c3",
    name: "QuickFacts Hub",
    handle: "@quickfacts_hub",
    subs: "450K",
    health: 52,
    risk: "high",
    originality: 48,
    uploads: 120,
    monetization: "review"
  },
  {
    id: "c4",
    name: "BriefRoom",
    handle: "@briefroom",
    subs: "310K",
    health: 81,
    risk: "medium",
    originality: 85,
    uploads: 30,
    monetization: "stable"
  },
  {
    id: "c5",
    name: "Midnight Stories",
    handle: "@midnight_stories",
    subs: "220K",
    health: 74,
    risk: "medium",
    originality: 78,
    uploads: 15,
    monetization: "stable"
  },
  {
    id: "c6",
    name: "Nova Sci",
    handle: "@novasci",
    subs: "180K",
    health: 97,
    risk: "low",
    originality: 98,
    uploads: 8,
    monetization: "safe"
  }
];

export const complianceSeries = [
  { day: "May 1", score: 91, risk: 9 },
  { day: "May 5", score: 92, risk: 8 },
  { day: "May 10", score: 94, risk: 6 },
  { day: "May 15", score: 93, risk: 7 },
  { day: "May 20", score: 95, risk: 5 },
  { day: "May 25", score: 94, risk: 6 },
  { day: "May 30", score: 96, risk: 4 }
];

export const kpis = [
  {
    label: "Network health",
    value: "94.2",
    unit: "%",
    delta: 1.4,
    trend: "up",
    tone: "success"
  },
  {
    label: "Compliance index",
    value: "88.7",
    unit: "/100",
    delta: 2.1,
    trend: "up",
    tone: "success"
  },
  {
    label: "Active alerts",
    value: "7",
    delta: 2,
    trend: "up",
    tone: "warning"
  },
  {
    label: "Scan velocity",
    value: "14.2",
    unit: "/hr",
    delta: -0.8,
    trend: "down",
    tone: "neutral"
  },
  {
    label: "Under watch",
    value: "3",
    delta: 0,
    trend: "up",
    tone: "neutral"
  },
  {
    label: "Monetization risk",
    value: "1",
    delta: -1,
    trend: "down",
    tone: "success"
  }
] as const;

export const radarData = [
  { metric: "Metadata", A: 85 },
  { metric: "Visual", A: 60 },
  { metric: "Acoustic", A: 75 },
  { metric: "Repetition", A: 90 },
  { metric: "Velocity", A: 65 }
];

export const recentScans = [
  {
    id: "sc-891",
    target: "trendverse_ep_142.mp4",
    status: "Complete",
    findings: 2,
    time: "5m ago"
  },
  {
    id: "sc-892",
    target: "storyshorts_compilation.mp4",
    status: "Processing",
    findings: 0,
    time: "15m ago"
  },
  {
    id: "sc-893",
    target: "quickfacts_ai_models.mp4",
    status: "Queued",
    findings: 0,
    time: "30m ago"
  },
  {
    id: "sc-894",
    target: "briefroom_intro_clip.mp4",
    status: "Complete",
    findings: 4,
    time: "1h ago"
  }
];

export const riskDistribution = [
  { name: "Low", value: 85, color: "oklch(0.75 0.15 140)" },
  { name: "Medium", value: 30, color: "oklch(0.79 0.16 75)" },
  { name: "High", value: 13, color: "oklch(0.64 0.21 22)" }
];

export const semanticRedundancy = [
  { week: "W1", redundancy: 12 },
  { week: "W2", redundancy: 14 },
  { week: "W3", redundancy: 15 },
  { week: "W4", redundancy: 11 },
  { week: "W5", redundancy: 18 },
  { week: "W6", redundancy: 22 }
];

export const uploadVelocity = [
  { day: "Mon", uploads: 12, baseline: 10 },
  { day: "Tue", uploads: 15, baseline: 10 },
  { day: "Wed", uploads: 8, baseline: 10 },
  { day: "Thu", uploads: 11, baseline: 10 },
  { day: "Fri", uploads: 19, baseline: 10 },
  { day: "Sat", uploads: 24, baseline: 10 },
  { day: "Sun", uploads: 14, baseline: 10 }
];
