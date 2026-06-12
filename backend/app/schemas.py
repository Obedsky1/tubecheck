"""Pydantic v2 request / response schemas for the ShieldNetwork AI API."""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import Any, Optional

from pydantic import BaseModel, ConfigDict, EmailStr, Field

from app.models import AuditType, ChannelStatus, PlanTier, Severity, TranscriptSource, VideoStatus


# ── Auth / User ───────────────────────────────────────────────────────────────


class UserCreate(BaseModel):
    """Payload for user registration."""

    email: EmailStr
    password: str = Field(..., min_length=8, max_length=128)
    full_name: str = Field(..., min_length=1, max_length=255)


class UserLogin(BaseModel):
    """Payload for user login."""

    email: EmailStr
    password: str

class GoogleLoginRequest(BaseModel):
    """Payload for Google OAuth login."""
    
    credential: str


class UserResponse(BaseModel):
    """Public representation of a user account."""

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    email: str
    full_name: str
    is_active: bool
    created_at: datetime
    updated_at: datetime


class TokenResponse(BaseModel):
    """JWT token returned after successful authentication."""

    access_token: str
    token_type: str = "bearer"
    expires_in_minutes: int


# ── Organization ──────────────────────────────────────────────────────────────


class OrganizationCreate(BaseModel):
    """Payload for creating an organization."""

    name: str = Field(..., min_length=1, max_length=255)
    description: Optional[str] = None
    plan_tier: PlanTier = PlanTier.FREE


class OrganizationResponse(BaseModel):
    """Public representation of an organization."""

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    name: str
    description: Optional[str]
    owner_id: uuid.UUID
    plan_tier: PlanTier
    available_credits: int
    daily_monitoring_enabled: bool
    created_at: datetime

class MonitoringToggleRequest(BaseModel):
    """Payload for toggling daily background monitoring."""
    enabled: bool


# ── Channel ───────────────────────────────────────────────────────────────────


class ChannelConnect(BaseModel):
    """Payload for connecting YouTube channels to an organization."""

    org_id: uuid.UUID
    youtube_channel_ids: list[str] = Field(
        ..., min_length=1, max_length=50, description="Up to 50 YouTube channel IDs"
    )


class ChannelResponse(BaseModel):
    """Public representation of a connected channel."""

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    org_id: uuid.UUID
    youtube_channel_id: str
    title: Optional[str]
    description: Optional[str]
    subscriber_count: Optional[int]
    video_count: Optional[int]
    thumbnail_url: Optional[str]
    custom_url: Optional[str]
    connected_at: datetime
    last_synced_at: Optional[datetime]
    status: ChannelStatus


class ChannelListResponse(BaseModel):
    """Paginated list of channels."""

    channels: list[ChannelResponse]
    total: int


# ── Video ─────────────────────────────────────────────────────────────────────


class VideoResponse(BaseModel):
    """Public representation of a video."""

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    channel_id: uuid.UUID
    youtube_video_id: str
    title: str
    description: Optional[str]
    published_at: Optional[datetime]
    duration_seconds: Optional[int]
    thumbnail_url: Optional[str]
    caption_text: Optional[str]
    transcript_source: TranscriptSource
    view_count: Optional[int]
    like_count: Optional[int]
    status: VideoStatus
    created_at: datetime


class VideoListResponse(BaseModel):
    """Paginated list of videos."""

    videos: list[VideoResponse]
    total: int


# ── Audit ─────────────────────────────────────────────────────────────────────


class AuditResultResponse(BaseModel):
    """Public representation of an audit result."""

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    video_id: Optional[uuid.UUID]
    video: Optional[VideoResponse] = None
    org_id: uuid.UUID
    audit_type: AuditType
    risk_score: float
    severity: Severity
    details: Optional[dict[str, Any]]
    compared_with_video_id: Optional[uuid.UUID]
    created_at: datetime


class AuditRunRequest(BaseModel):
    """Request to trigger one or more audit tasks."""

    org_id: uuid.UUID
    audit_types: list[AuditType] = Field(
        ..., min_length=1, description="List of audit types to execute"
    )


class AuditRunResponse(BaseModel):
    """Confirmation that audit tasks have been dispatched."""

    org_id: uuid.UUID
    dispatched_tasks: list[dict[str, str]]
    message: str = "Audit tasks dispatched successfully"


# ── Network Threat ────────────────────────────────────────────────────────────


class NetworkThreatResponse(BaseModel):
    """Aggregated network threat intelligence."""

    threat_index: float = Field(..., ge=0.0, le=100.0, description="0-100 composite threat score")
    breakdown: dict[str, float] = Field(
        ..., description="Per-audit-type average risk scores"
    )
    alerts: list[dict[str, Any]]


# ── Dashboard ─────────────────────────────────────────────────────────────────


class DashboardOverviewResponse(BaseModel):
    """High-level dashboard metrics for an organization."""

    total_channels: int
    total_videos: int
    active_audits: int
    threat_index: float = Field(..., ge=0.0, le=100.0)
    threat_breakdown: Optional[dict[str, float]] = None
    recent_alerts: list[dict[str, Any]]
    
    # Redesigned Creator-friendly Metrics
    monetization_stability: float = 0.0
    originality_score: float = 0.0
    human_value_index: float = 0.0
    content_farm_risk: float = 0.0
    brand_safety: float = 0.0
    upload_readiness: float = 0.0


class CrossContaminationResponse(BaseModel):
    """Cross-channel content contamination map."""

    pairs: list[dict[str, Any]] = Field(
        ...,
        description="List of channel pairs with similarity metrics",
    )
    overall_contamination_score: float = Field(..., ge=0.0, le=100.0)


class ChannelHealthResponse(BaseModel):
    """Per-channel health metrics."""

    channel_id: uuid.UUID
    channel_title: Optional[str]
    total_videos: int
    flagged_videos: int
    average_risk_score: float
    audit_coverage: dict[str, int]
    latest_audit_at: Optional[datetime]
    
    # Redesigned Creator-friendly Metrics
    monetization_stability: float = 0.0
    originality_score: float = 0.0
    human_value_index: float = 0.0
    content_farm_risk: float = 0.0
    brand_safety: float = 0.0
    upload_readiness: float = 0.0


# ── Upload ────────────────────────────────────────────────────────────────────


class UploadRequest(BaseModel):
    """Metadata accompanying a pre-publish video upload."""

    org_id: uuid.UUID
    title: str = Field(..., max_length=512)
    description: Optional[str] = None


class UploadResponse(BaseModel):
    """Response after a video upload is accepted."""

    video_id: uuid.UUID
    status: str = "processing"
    message: str = "Upload received – audit pipeline started"
    dispatched_tasks: list[str]


# ── Compliance Engine Schema Extensions ────────────────────────────────────────

class PolicyRiskResponse(BaseModel):
    """Schema for YouTube compliance risk assessment."""
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    org_id: uuid.UUID
    channel_id: Optional[uuid.UUID]
    risk_category: str
    confidence: float
    severity: Severity
    evidence: list[str]
    platform_signal: str
    recommended_fixes: list[str]
    is_active: bool
    created_at: datetime
    resolved_at: Optional[datetime]


class RemediationResponse(BaseModel):
    """Actionable remediation guideline for channels."""
    id: str
    risk_category: str
    severity: str
    confidence: float
    why_it_matters: str
    likely_platform_interpretation: str
    expected_impact: str
    recommended_fixes: list[str]
    evidence: list[str]
    created_at: str


class FarmProbabilityResponse(BaseModel):
    """Content farm risk assessment metrics."""
    content_farm_probability: float
    automation_footprint_index: float
    cross_channel_contamination_score: float
    metrics: dict[str, Any]


class TrustScoreResponse(BaseModel):
    """Trust and authenticity overview for the network."""
    trust_index: float
    threat_score: float
    monetization_stability: float
    monetization_status: str
    channel_scores: dict[str, float]


# ── AI Niche Finder Schemas ───────────────────────────────────────────────────

class VideoIdeaSchema(BaseModel):
    title: str = Field(description="Catchy title for the video")
    hook: str = Field(description="An engaging hook to capture viewers")
    outline: str = Field(description="Brief outline of the content flow")
    ai_safety_tip: str = Field(description="Safety guideline to avoid policy flags for this specific idea")


class DemographicInfoSchema(BaseModel):
    age_groups: list[str] = Field(description="Primary age groups interested in this content")
    gender_distribution: str = Field(description="Gender breakdown, e.g. '60% Male, 40% Female'")
    top_countries: list[str] = Field(description="Top 3 countries by search volume / interest")


class NicheAnalysisResponse(BaseModel):
    niche: str = Field(description="The niche name being analyzed")
    shield_rating: float = Field(description="Overall monetization safety rating out of 100")
    search_volume: str = Field(description="Interest/Search volume: High, Medium, Low")
    competition: str = Field(description="Competition density: High, Medium, Low")
    cpm_level: str = Field(description="Expected CPM level: High, Medium, Low")
    cpm_rpm_estimate: str = Field(description="Estimated RPM range, e.g., '$4.50 - $9.00'")
    
    reuse_content_risk: str = Field(description="Risk of Reused Content flags: High, Medium, Low")
    copyright_risk: str = Field(description="Risk of Copyright Strikes: High, Medium, Low")
    advertiser_friendly_risk: str = Field(description="Risk of Advertiser-friendliness (yellow dollar) flags: High, Medium, Low")
    ai_viability: str = Field(description="Viability of using AI tools for production: Very High, High, Medium, Low")
    
    summary: str = Field(description="3-4 sentence executive summary of the niche and its compliance outlook")
    pros: list[str] = Field(description="3 advantages of this niche")
    cons: list[str] = Field(description="3 disadvantages of this niche")
    red_flags: list[str] = Field(description="Critical policies or guidelines this niche commonly triggers")
    safe_content_strategy: list[str] = Field(description="Step-by-step strategy to make content in this niche safe and compliant under AI-assisted workflows")
    recommended_tools: list[str] = Field(description="Recommended AI tools for this niche")
    
    audience_demographics: DemographicInfoSchema = Field(description="Target audience demographics")
    sample_video_ideas: list[VideoIdeaSchema] = Field(description="3 video ideas with compliance checks")


class NicheAnalysisRequest(BaseModel):
    query: str
    format: Optional[str] = "Long-form"


# ── Sandbox Scanner Schemas ───────────────────────────────────────────────────

class SandboxScanResponse(BaseModel):
    """Result of a pre-upload sandbox scan."""
    status: str = Field(description="'safe', 'warning', or 'danger'")
    highest_similarity: float = Field(description="Percentage overlap (0.0 to 1.0)")
    matched_video_id: Optional[str] = Field(description="If matched, the ID of the closest video", default=None)
    matched_video_title: Optional[str] = Field(description="If matched, the title of the closest video", default=None)
    matched_channel_title: Optional[str] = Field(description="If matched, the channel title", default=None)
    transcript: Optional[str] = Field(description="The extracted transcript snippet", default=None)
    credits_deducted: int = Field(description="Credits deducted for this scan", default=1)


# ── Appeals Schemas ───────────────────────────────────────────────────────────

class AppealGenerateRequest(BaseModel):
    channel_id: uuid.UUID

class AppealGenerateResponse(BaseModel):
    script: str
    credits_deducted: int

class ShadowbanDiagnosticResponse(BaseModel):
    is_shadowbanned: bool
    browse_suggested_drop_pct: float
    ctr_retention_pct: float
    avd_retention_pct: float
    explanation: str
