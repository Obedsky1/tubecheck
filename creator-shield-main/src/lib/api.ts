const API_BASE = "/api";

export interface User {
  id: string;
  email: string;
  full_name: string;
  is_active: boolean;
  created_at: string;
}

export interface Organization {
  id: string;
  name: string;
  owner_id: string;
  plan_tier: "FREE" | "PRO" | "ENTERPRISE";
  available_credits: number;
  daily_monitoring_enabled: boolean;
  created_at: string;
}

export interface Channel {
  id: string;
  org_id: string;
  youtube_channel_id: string;
  title: string;
  custom_url: string;
  thumbnail_url: string | null;
  subscriber_count: number;
  video_count: number;
  status: string;
  created_at: string;
}

export interface Video {
  id: string;
  channel_id: string;
  youtube_video_id: string;
  title: string;
  description: string | null;
  published_at: string;
  duration_seconds: number;
  thumbnail_url: string | null;
  status: string;
  view_count: number;
  like_count: number;
  created_at: string;
}

export interface AuditResult {
  id: string;
  org_id: string;
  video_id: string;
  audit_type: string;
  risk_score: number;
  severity: string;
  details: any;
  compared_with_video_id: string | null;
  created_at: string;
  video?: Video;
}

export interface NetworkAlert {
  id: string;
  org_id: string;
  alert_type: string;
  severity: string;
  title: string;
  description: string;
  affected_channel_ids: string[];
  is_resolved: boolean;
  created_at: string;
}

export interface PolicyRisk {
  id: string;
  org_id: string;
  channel_id: string;
  risk_category: string;
  confidence: number;
  severity: string;
  evidence: string[];
  platform_signal: string;
  recommended_fixes: string[];
  is_active: boolean;
  created_at: string;
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = localStorage.getItem("cs_token");
  const headers = new Headers(options.headers);

  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  if (!(options.body instanceof FormData) && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
  });

  if (!response.ok) {
    let errorDetail = "An error occurred";
    try {
      const errorJson = await response.json();
      errorDetail = errorJson.detail || errorJson.message || response.statusText;
    } catch {
      errorDetail = response.statusText;
    }
    throw new Error(errorDetail);
  }

  // Handle empty responses
  if (response.status === 204) {
    return {} as T;
  }

  return response.json();
}

export const api = {
  // Auth
  login: (body: any) => request<{ access_token: string; token_type: string }>("/auth/login", {
    method: "POST",
    body: JSON.stringify(body),
  }),
  register: (body: any) => request<User>("/auth/register", {
    method: "POST",
    body: JSON.stringify(body),
  }),
  loginWithGoogle: (body: { credential: string }) => request<{ access_token: string; token_type: string }>("/auth/supabase", {
    method: "POST",
    body: JSON.stringify(body),
  }),
  getMe: () => request<User>("/auth/me"),
  getMyOrgs: () => request<Organization[]>("/auth/my-orgs"),

  // Dashboard
  getDashboardOverview: (orgId: string) => request<{
    total_channels: number;
    total_videos: number;
    active_audits: number;
    threat_index: number;
    threat_breakdown?: Record<string, number>;
    recent_alerts: any[];
    monetization_stability?: number;
    originality_score?: number;
    human_value_index?: number;
    content_farm_risk?: number;
    brand_safety?: number;
    upload_readiness?: number;
  }>(`/dashboard/${orgId}/overview`),
  toggleDailyMonitoring: (orgId: string, enabled: boolean) => request<any>(`/dashboard/${orgId}/monitoring/toggle`, {
    method: "POST",
    body: JSON.stringify({ enabled }),
  }),
  getDashboardAlerts: (orgId: string) => request<NetworkAlert[]>(`/dashboard/${orgId}/alerts`),
  getDashboardFleet: (orgId: string) => request<any>(`/dashboard/${orgId}/fleet`),
  getCrossContamination: (orgId: string) => request<any>(`/dashboard/${orgId}/cross-contamination`),
  getChannelHealth: (orgId: string, channelId: string) => request<any>(`/dashboard/${orgId}/channel/${channelId}/health`),
  getChannelVelocity: (orgId: string, channelId: string) =>
    request<any>(`/velocity/channel/${channelId}?org_id=${orgId}`),

  upgradePlan: (orgId: string, planTier: string) =>
    request<any>("/subscriptions/upgrade", {
      method: "POST",
      body: JSON.stringify({ org_id: orgId, plan_tier: planTier }),
    }),

  verifyPayment: (transactionId: string, orgId: string, planTier: string) =>
    request<any>("/payments/verify", {
      method: "POST",
      body: JSON.stringify({ transaction_id: transactionId, org_id: orgId, plan_tier: planTier }),
    }),

  getPaymentHistory: (orgId: string) =>
    request<any>(`/payments/history/${orgId}`),

  // Channels
  getChannels: (orgId: string) => request<{ channels: Channel[]; total: number }>(`/channels/${orgId}`),
  connectChannels: (body: { org_id: string; youtube_channel_ids: string[] }) => request<Channel[]>("/channels/connect", {
    method: "POST",
    body: JSON.stringify(body),
  }),
  getChannelDetail: (channelId: string) => request<Channel>(`/channels/detail/${channelId}`),
  getChannelVideos: (channelId: string) => request<Video[]>(`/channels/${channelId}/videos`),
  syncChannel: (channelId: string) => request<any>(`/channels/${channelId}/sync`, {
    method: "POST",
  }),

  // Audits
  uploadAudit: (body: FormData) => request<any>("/audits/upload", {
    method: "POST",
    body,
  }),
  getAuditResults: (orgId: string, auditType?: string) => request<AuditResult[]>(`/audits/${orgId}/results${auditType ? '?audit_type=' + auditType : ''}`),
  getAuditQueue: (orgId: string) => request<any[]>(`/audits/${orgId}/queue`),
  getVideoAuditDetail: (videoId: string) => request<AuditResult[]>(`/audits/${videoId}/detail`),

  // Velocity
  getUploadVelocity: (orgId: string) => request<any>(`/velocity/${orgId}/farm-probability`),
  getFarmProbability: (orgId: string) => request<any>(`/velocity/${orgId}/farm-probability`),

  // Remediation
  getRemediation: (orgId: string) => request<PolicyRisk[]>(`/remediation/${orgId}`),
  getChannelRemediation: (orgId: string, channelId: string) => request<PolicyRisk[]>(`/remediation/${orgId}/channel/${channelId}`),

  // Flagged & Gemini Compliance Report Endpoints
  getFlaggedVideos: (orgId: string) => request<any[]>(`/dashboard/${orgId}/flagged-videos`),
  getGeminiSummary: (orgId: string) => request<{
    summary: string;
    total_videos: number;
    flagged_videos: number;
    flagged_pct: number;
    ai_videos: number;
    ai_pct: number;
    risk_level: string;
  }>(`/dashboard/${orgId}/gemini-summary`),
  remedyVideo: (videoId: string, action: string) => request<any>(`/dashboard/remedy/${videoId}/${action}`, {
    method: "POST",
  }),
  updateVideoMetadata: (videoId: string, title: string, description: string) => request<any>(`/dashboard/videos/${videoId}/metadata`, {
    method: "PATCH",
    body: JSON.stringify({ title, description }),
  }),
  getVideoDetail: (videoId: string) => request<Video>(`/dashboard/videos/${videoId}`),
  
  // AI Niche Finder
  analyzeNiche: (body: { query: string; format?: string }) => request<NicheAnalysisResult>("/niche-finder/analyze", {
    method: "POST",
    body: JSON.stringify(body),
  }),


  // Appeals
  generateAppeal: (channelId: string) => request<{ script: string; credits_deducted: number }>("/appeals/generate", {
    method: "POST",
    body: JSON.stringify({ channel_id: channelId }),
  }),

  // Forensics / Velocity
  getShadowbanDiagnostic: (orgId: string) => request<{
    is_shadowbanned: boolean;
    browse_suggested_drop_pct: number;
    ctr_retention_pct: number;
    avd_retention_pct: number;
    explanation: string;
  }>(`/velocity/${orgId}/shadowban-diagnostic`),
};

export interface VideoIdea {
  title: string;
  hook: string;
  outline: string;
  ai_safety_tip: string;
}

export interface DemographicInfo {
  age_groups: string[];
  gender_distribution: string;
  top_countries: string[];
}

export interface NicheAnalysisResult {
  niche: string;
  shield_rating: number;
  search_volume: string;
  competition: string;
  cpm_level: string;
  cpm_rpm_estimate: string;
  
  reuse_content_risk: string;
  copyright_risk: string;
  advertiser_friendly_risk: string;
  ai_viability: string;
  
  summary: string;
  pros: string[];
  cons: string[];
  red_flags: string[];
  safe_content_strategy: string[];
  recommended_tools: string[];
  
  audience_demographics: DemographicInfo;
  sample_video_ideas: VideoIdea[];
}

