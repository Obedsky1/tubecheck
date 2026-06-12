"""SQLAlchemy ORM models for the ShieldNetwork AI platform."""

from __future__ import annotations

import enum
import uuid
from datetime import datetime
from typing import Optional

from sqlalchemy import (
    Boolean,
    DateTime,
    Enum,
    Float,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
    func,
)
from sqlalchemy.dialects.postgresql import ARRAY, JSON, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


# ── Enums ─────────────────────────────────────────────────────────────────────


class PlanTier(str, enum.Enum):
    """Organization subscription tier."""

    FREE = "FREE"
    PRO = "PRO"
    ENTERPRISE = "ENTERPRISE"


class ChannelStatus(str, enum.Enum):
    """Current sync lifecycle state of a connected channel."""

    ACTIVE = "ACTIVE"
    SYNCING = "SYNCING"
    ERROR = "ERROR"


class TranscriptSource(str, enum.Enum):
    """Origin of a video's caption/transcript text."""

    AUTO_CAPTION = "AUTO_CAPTION"
    WHISPER = "WHISPER"
    NONE = "NONE"


class VideoStatus(str, enum.Enum):
    """Audit lifecycle status of a video."""

    PENDING = "PENDING"
    AUDITING = "AUDITING"
    COMPLETED = "COMPLETED"
    FLAGGED = "FLAGGED"


class AuditType(str, enum.Enum):
    """Types of audits the platform can run."""

    SCRIPT_SIMILARITY = "SCRIPT_SIMILARITY"
    VISUAL_SIMILARITY = "VISUAL_SIMILARITY"
    ASSET_REUSE = "ASSET_REUSE"
    VOICE_FORENSIC = "VOICE_FORENSIC"
    VELOCITY_ANOMALY = "VELOCITY_ANOMALY"
    HUMAN_VALUE = "HUMAN_VALUE"
    DEEPFAKE_SCAN = "DEEPFAKE_SCAN"


class Severity(str, enum.Enum):
    """Risk severity level for audit results and alerts."""

    LOW = "LOW"
    MEDIUM = "MEDIUM"
    HIGH = "HIGH"
    CRITICAL = "CRITICAL"


# ── Models ────────────────────────────────────────────────────────────────────


class User(Base):
    """Platform user account."""

    __tablename__ = "users"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    email: Mapped[str] = mapped_column(String(320), unique=True, nullable=False, index=True)
    hashed_password: Mapped[str] = mapped_column(String(1024), nullable=False)
    full_name: Mapped[str] = mapped_column(String(255), nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )

    # Relationships
    organizations: Mapped[list["Organization"]] = relationship(
        back_populates="owner", lazy="selectin"
    )

    __table_args__ = (Index("ix_users_email_active", "email", "is_active"),)


class Organization(Base):
    """A creator network / organization that groups channels together."""

    __tablename__ = "organizations"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    owner_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    plan_tier: Mapped[PlanTier] = mapped_column(
        Enum(PlanTier, name="plan_tier"), default=PlanTier.FREE, nullable=False
    )
    available_credits: Mapped[int] = mapped_column(Integer, default=10, nullable=False)
    daily_monitoring_enabled: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    # Relationships
    owner: Mapped["User"] = relationship(back_populates="organizations", lazy="selectin")
    channels: Mapped[list["Channel"]] = relationship(
        back_populates="organization", lazy="selectin", cascade="all, delete-orphan"
    )
    alerts: Mapped[list["NetworkAlert"]] = relationship(
        back_populates="organization", lazy="selectin", cascade="all, delete-orphan"
    )
    audit_results: Mapped[list["AuditResult"]] = relationship(
        back_populates="organization", lazy="selectin", cascade="all, delete-orphan"
    )
    credit_transactions: Mapped[list["CreditLedger"]] = relationship(
        back_populates="organization", lazy="selectin", cascade="all, delete-orphan"
    )

    __table_args__ = (Index("ix_orgs_owner", "owner_id"),)


class CreditLedger(Base):
    """Ledger for tracking credit additions and deductions."""

    __tablename__ = "credit_ledger"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    org_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("organizations.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    amount: Mapped[int] = mapped_column(Integer, nullable=False)
    transaction_type: Mapped[str] = mapped_column(String(50), nullable=False) # e.g., 'TOP_UP', 'SCAN_DEDUCTION', 'MONTHLY_GRANT'
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    # Relationships
    organization: Mapped["Organization"] = relationship(back_populates="credit_transactions")

    __table_args__ = (Index("ix_credit_ledger_org", "org_id"),)


class Payment(Base):
    """Records every verified Flutterwave payment transaction."""

    __tablename__ = "payments"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    org_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("organizations.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    flutterwave_tx_id: Mapped[str] = mapped_column(
        String(128), unique=True, nullable=False, index=True
    )
    flutterwave_tx_ref: Mapped[str] = mapped_column(String(128), nullable=False)
    amount: Mapped[float] = mapped_column(Float, nullable=False)
    currency: Mapped[str] = mapped_column(String(10), nullable=False, default="USD")
    plan_tier: Mapped[PlanTier] = mapped_column(
        Enum(PlanTier, name="plan_tier"), nullable=False
    )
    status: Mapped[str] = mapped_column(String(50), nullable=False, default="pending")  # pending | successful | failed
    flutterwave_raw: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)  # raw verify response
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    # Relationships
    organization: Mapped["Organization"] = relationship("Organization")
    user: Mapped[Optional["User"]] = relationship("User")

    __table_args__ = (
        Index("ix_payments_org", "org_id"),
        Index("ix_payments_flw_tx", "flutterwave_tx_id"),
    )


class Channel(Base):
    """A YouTube channel connected to an organization."""

    __tablename__ = "channels"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    org_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("organizations.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    youtube_channel_id: Mapped[str] = mapped_column(
        String(64), unique=True, nullable=False, index=True
    )
    title: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    subscriber_count: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    video_count: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    thumbnail_url: Mapped[Optional[str]] = mapped_column(String(2048), nullable=True)
    custom_url: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    connected_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    last_synced_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    status: Mapped[ChannelStatus] = mapped_column(
        Enum(ChannelStatus, name="channel_status"),
        default=ChannelStatus.ACTIVE,
        nullable=False,
        index=True,
    )

    # Relationships
    organization: Mapped["Organization"] = relationship(back_populates="channels", lazy="selectin")
    videos: Mapped[list["Video"]] = relationship(
        back_populates="channel", lazy="selectin", cascade="all, delete-orphan"
    )

    __table_args__ = (Index("ix_channels_org_status", "org_id", "status"),)


class Video(Base):
    """A YouTube video belonging to a connected channel."""

    __tablename__ = "videos"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    channel_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("channels.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    youtube_video_id: Mapped[str] = mapped_column(
        String(64), unique=True, nullable=False, index=True
    )
    title: Mapped[str] = mapped_column(String(512), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    published_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True, index=True
    )
    duration_seconds: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    thumbnail_url: Mapped[Optional[str]] = mapped_column(String(2048), nullable=True)
    caption_text: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    transcript_source: Mapped[TranscriptSource] = mapped_column(
        Enum(TranscriptSource, name="transcript_source"),
        default=TranscriptSource.NONE,
        nullable=False,
    )
    view_count: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    like_count: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    status: Mapped[VideoStatus] = mapped_column(
        Enum(VideoStatus, name="video_status"),
        default=VideoStatus.PENDING,
        nullable=False,
        index=True,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    # Relationships
    channel: Mapped["Channel"] = relationship(back_populates="videos", lazy="selectin")
    audit_results: Mapped[list["AuditResult"]] = relationship(
        back_populates="video", lazy="selectin", cascade="all, delete-orphan"
    )

    __table_args__ = (
        Index("ix_videos_channel_status", "channel_id", "status"),
        Index("ix_videos_published", "published_at"),
    )


class AuditResult(Base):
    """Result record from a single audit run against a video or org."""

    __tablename__ = "audit_results"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    video_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("videos.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    org_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("organizations.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    audit_type: Mapped[AuditType] = mapped_column(
        Enum(AuditType, name="audit_type"), nullable=False, index=True
    )
    risk_score: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    severity: Mapped[Severity] = mapped_column(
        Enum(Severity, name="severity"), nullable=False, default=Severity.LOW
    )
    details: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)
    compared_with_video_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False, index=True
    )

    # Relationships
    video: Mapped[Optional["Video"]] = relationship(back_populates="audit_results", lazy="selectin")
    organization: Mapped["Organization"] = relationship(
        back_populates="audit_results", lazy="selectin"
    )

    __table_args__ = (
        Index("ix_audit_org_type", "org_id", "audit_type"),
        Index("ix_audit_created", "created_at"),
    )


class NetworkAlert(Base):
    """An alert raised against the creator network."""

    __tablename__ = "network_alerts"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    org_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("organizations.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    alert_type: Mapped[str] = mapped_column(String(128), nullable=False, index=True)
    severity: Mapped[Severity] = mapped_column(
        Enum(Severity, name="severity", create_constraint=False),
        nullable=False,
        default=Severity.LOW,
    )
    title: Mapped[str] = mapped_column(String(512), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    affected_channel_ids: Mapped[Optional[list[uuid.UUID]]] = mapped_column(
        ARRAY(UUID(as_uuid=True)), nullable=True
    )
    is_resolved: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False, index=True
    )
    resolved_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    # Relationships
    organization: Mapped["Organization"] = relationship(back_populates="alerts", lazy="selectin")

    __table_args__ = (
        Index("ix_alerts_org_resolved", "org_id", "is_resolved"),
        Index("ix_alerts_created", "created_at"),
    )


# ── New Authenticity & Compliance Models ──────────────────────────────────────

try:
    from pgvector.sqlalchemy import Vector
except ImportError:
    # Fallback to PgArray of Float for compilation if pgvector not installed
    from sqlalchemy.dialects.postgresql import ARRAY as PgArray
    class Vector(PgArray):
        def __init__(self, dim):
            super().__init__(Float)


class ContentEmbedding(Base):
    """Vector embeddings for transcripts, titles, bios, etc."""

    __tablename__ = "content_embeddings"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    source_type: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    source_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False, index=True)
    org_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False, index=True
    )
    channel_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), ForeignKey("channels.id", ondelete="CASCADE"), nullable=True, index=True
    )
    embedding: Mapped[list[float]] = mapped_column(Vector(384), nullable=False)
    text_hash: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )


class SemanticCluster(Base):
    """Clustering metadata for script / topic duplication across channels."""

    __tablename__ = "semantic_clusters"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    org_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False, index=True
    )
    cluster_type: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    member_ids: Mapped[dict] = mapped_column(JSON, nullable=False)
    centroid_embedding: Mapped[Optional[list[float]]] = mapped_column(Vector(384), nullable=True)
    similarity_score: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )


class ChannelScore(Base):
    """Detailed channel metrics like rigidity and originality."""

    __tablename__ = "channel_scores"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    channel_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("channels.id", ondelete="CASCADE"), nullable=False, index=True
    )
    org_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False, index=True
    )
    score_type: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    value: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    breakdown: Mapped[dict] = mapped_column(JSON, nullable=False)
    computed_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )


class PolicyRisk(Base):
    """Evaluated platform monetization and guideline risks."""

    __tablename__ = "policy_risks"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    org_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False, index=True
    )
    channel_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), ForeignKey("channels.id", ondelete="CASCADE"), nullable=True, index=True
    )
    risk_category: Mapped[str] = mapped_column(String(128), nullable=False, index=True)
    confidence: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    severity: Mapped[Severity] = mapped_column(
        Enum(Severity, name="severity", create_constraint=False),
        nullable=False,
        default=Severity.LOW,
    )
    evidence: Mapped[list[str]] = mapped_column(JSON, nullable=False)
    platform_signal: Mapped[str] = mapped_column(String(512), nullable=False)
    recommended_fixes: Mapped[list[str]] = mapped_column(JSON, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False, index=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False, index=True
    )
    resolved_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )


class ThumbnailFingerprint(Base):
    """Perceptual hash mapping for thumbnails."""

    __tablename__ = "thumbnail_fingerprints"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    video_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("videos.id", ondelete="CASCADE"), nullable=False, unique=True
    )
    phash: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )


class MediaFingerprint(Base):
    """Perceptual video hashes for footage reuse detection."""

    __tablename__ = "media_fingerprints"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    video_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("videos.id", ondelete="CASCADE"), nullable=False, unique=True
    )
    vhash: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )


class ForensicJob(Base):
    """Distributed media analysis task tracking."""

    __tablename__ = "forensic_jobs"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    video_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), ForeignKey("videos.id", ondelete="CASCADE"), nullable=True, index=True
    )
    org_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False, index=True
    )
    status: Mapped[str] = mapped_column(String(64), nullable=False, default="pending", index=True)
    progress: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    error: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    worker_id: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    queue: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    priority: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )
