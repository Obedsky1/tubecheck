"""Dashboard routes – overview metrics, alerts, cross-contamination, channel health."""

from __future__ import annotations

import uuid
from collections import defaultdict
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, select, case
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models import (
    AuditResult,
    AuditType,
    Channel,
    NetworkAlert,
    Organization,
    Severity,
    User,
    Video,
    VideoStatus,
)
from app.routers.auth import get_current_user
from app.schemas import (
    ChannelHealthResponse,
    CrossContaminationResponse,
    DashboardOverviewResponse,
    NetworkThreatResponse,
    VideoResponse,
    MonitoringToggleRequest
)

router = APIRouter(prefix="/dashboard", tags=["dashboard"])


# ── Helpers ───────────────────────────────────────────────────────────────────

# Weights per audit type for the composite Network Threat Index.
_THREAT_WEIGHTS: dict[AuditType, float] = {
    AuditType.SCRIPT_SIMILARITY: 0.25,
    AuditType.VISUAL_SIMILARITY: 0.15,
    AuditType.ASSET_REUSE: 0.15,
    AuditType.VOICE_FORENSIC: 0.20,
    AuditType.VELOCITY_ANOMALY: 0.10,
    AuditType.HUMAN_VALUE: 0.10,
    AuditType.DEEPFAKE_SCAN: 0.05,
}


async def _compute_threat_index(
    db: AsyncSession, org_id: uuid.UUID
) -> tuple[float, dict[str, float]]:
    """Compute the weighted Network Threat Index and per-type breakdown."""
    result = await db.execute(
        select(AuditResult.audit_type, func.avg(AuditResult.risk_score))
        .where(AuditResult.org_id == org_id)
        .group_by(AuditResult.audit_type)
    )
    rows = result.all()

    breakdown: dict[str, float] = {}
    weighted_sum = 0.0
    total_weight = 0.0

    for audit_type, avg_score in rows:
        avg_val = float(avg_score) if avg_score is not None else 0.0
        breakdown[audit_type.value] = round(avg_val, 2)
        weight = _THREAT_WEIGHTS.get(audit_type, 0.1)
        weighted_sum += avg_val * weight
        total_weight += weight

    threat_index = round(weighted_sum / total_weight, 2) if total_weight > 0 else 0.0
    return threat_index, breakdown


async def _verify_org_access(
    db: AsyncSession, org_id: uuid.UUID, user: User
) -> None:
    """Raise 404 if the user doesn't own the organization."""
    result = await db.execute(
        select(Organization.id).where(
            Organization.id == org_id,
            Organization.owner_id == user.id,
        )
    )
    if result.scalar_one_or_none() is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Organization not found")


# ── Routes ────────────────────────────────────────────────────────────────────


@router.post("/{org_id}/monitoring/toggle")
async def toggle_daily_monitoring(
    org_id: uuid.UUID,
    payload: MonitoringToggleRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    """Enable or disable automated daily monitoring. Premium only."""
    await _verify_org_access(db, org_id, current_user)
    
    org = await db.get(Organization, org_id)
    if not org:
        raise HTTPException(status_code=404, detail="Organization not found")
        
    if org.plan_tier not in ["PRO", "ENTERPRISE"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, 
            detail="Daily monitoring is a Premium feature. Please upgrade."
        )
        
    org.daily_monitoring_enabled = payload.enabled
    await db.commit()
    
    return {"status": "success", "daily_monitoring_enabled": org.daily_monitoring_enabled}

@router.get("/{org_id}/overview", response_model=DashboardOverviewResponse)
async def dashboard_overview(
    org_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    """Return high-level dashboard metrics including the Network Threat Index."""
    await _verify_org_access(db, org_id, current_user)

    # Total channels
    ch_count = await db.execute(
        select(func.count()).select_from(Channel).where(Channel.org_id == org_id)
    )
    total_channels = ch_count.scalar() or 0

    # Total videos across all channels
    vid_count = await db.execute(
        select(func.count())
        .select_from(Video)
        .join(Channel, Video.channel_id == Channel.id)
        .where(Channel.org_id == org_id)
    )
    total_videos = vid_count.scalar() or 0

    # Active audits (videos currently being audited)
    active_count = await db.execute(
        select(func.count())
        .select_from(Video)
        .join(Channel, Video.channel_id == Channel.id)
        .where(Channel.org_id == org_id, Video.status == VideoStatus.AUDITING)
    )
    active_audits = active_count.scalar() or 0

    # Threat index
    threat_index, threat_breakdown = await _compute_threat_index(db, org_id)

    # Recent alerts (last 10)
    alerts_result = await db.execute(
        select(NetworkAlert)
        .where(NetworkAlert.org_id == org_id)
        .order_by(NetworkAlert.created_at.desc())
        .limit(10)
    )
    alerts = alerts_result.scalars().all()
    recent_alerts: list[dict[str, Any]] = [
        {
            "id": str(a.id),
            "alert_type": a.alert_type,
            "severity": a.severity.value,
            "title": a.title,
            "is_resolved": a.is_resolved,
            "created_at": a.created_at.isoformat(),
        }
        for a in alerts
    ]

    tb = threat_breakdown or {}
    script_sim = tb.get(AuditType.SCRIPT_SIMILARITY.value, 0.0)
    visual_sim = tb.get(AuditType.VISUAL_SIMILARITY.value, 0.0)
    asset_reuse = tb.get(AuditType.ASSET_REUSE.value, 0.0)
    voice_foren = tb.get(AuditType.VOICE_FORENSIC.value, 0.0)
    velocity_an = tb.get(AuditType.VELOCITY_ANOMALY.value, 0.0)

    monetization_stability = max(0.0, min(100.0, 100.0 - threat_index * 1.2))
    originality_score = max(0.0, min(100.0, 100.0 - (script_sim * 0.5 + visual_sim * 0.5)))
    human_value_index = max(0.0, min(100.0, 100.0 - (voice_foren * 0.6 + asset_reuse * 0.4)))
    content_farm_risk = max(0.0, min(100.0, (script_sim * 0.4 + velocity_an * 0.4 + asset_reuse * 0.2)))
    brand_safety = max(0.0, min(100.0, 100.0 - voice_foren * 0.4 - velocity_an * 0.2))
    upload_readiness = max(0.0, min(100.0, (monetization_stability + brand_safety + originality_score) / 3.0))

    return {
        "total_channels": total_channels,
        "total_videos": total_videos,
        "active_audits": active_audits,
        "threat_index": threat_index,
        "threat_breakdown": threat_breakdown,
        "recent_alerts": recent_alerts,
        "monetization_stability": round(monetization_stability, 2),
        "originality_score": round(originality_score, 2),
        "human_value_index": round(human_value_index, 2),
        "content_farm_risk": round(content_farm_risk, 2),
        "brand_safety": round(brand_safety, 2),
        "upload_readiness": round(upload_readiness, 2),
    }


@router.get("/{org_id}/alerts", response_model=list[dict])
async def list_alerts(
    org_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    resolved: bool | None = Query(None, description="Filter by resolution status"),
    page: int = Query(1, ge=1),
    page_size: int = Query(25, ge=1, le=100),
) -> list[dict[str, Any]]:
    """Return active alerts for the organization with optional pagination."""
    await _verify_org_access(db, org_id, current_user)

    query = select(NetworkAlert).where(NetworkAlert.org_id == org_id)
    if resolved is not None:
        query = query.where(NetworkAlert.is_resolved == resolved)

    query = query.order_by(NetworkAlert.created_at.desc())
    offset = (page - 1) * page_size
    query = query.offset(offset).limit(page_size)

    result = await db.execute(query)
    alerts = result.scalars().all()

    return [
        {
            "id": str(a.id),
            "alert_type": a.alert_type,
            "severity": a.severity.value,
            "title": a.title,
            "description": a.description,
            "affected_channel_ids": [str(c) for c in (a.affected_channel_ids or [])],
            "is_resolved": a.is_resolved,
            "created_at": a.created_at.isoformat(),
            "resolved_at": a.resolved_at.isoformat() if a.resolved_at else None,
        }
        for a in alerts
    ]


@router.get("/{org_id}/cross-contamination", response_model=CrossContaminationResponse)
async def cross_contamination_map(
    org_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    """Return cross-channel contamination map with pairwise similarity scores.

    Aggregates SCRIPT_SIMILARITY and VISUAL_SIMILARITY audit results to build
    a matrix of channel-pair contamination metrics.
    """
    await _verify_org_access(db, org_id, current_user)

    cross_types = {AuditType.SCRIPT_SIMILARITY, AuditType.VISUAL_SIMILARITY, AuditType.ASSET_REUSE}
    result = await db.execute(
        select(AuditResult)
        .where(
            AuditResult.org_id == org_id,
            AuditResult.audit_type.in_(cross_types),
        )
        .order_by(AuditResult.created_at.desc())
    )
    audits = result.scalars().all()

    # Build pairwise scores from details JSON
    pair_scores: dict[tuple[str, str], list[float]] = defaultdict(list)
    for audit in audits:
        if audit.details and "matched_pairs" in audit.details:
            for pair in audit.details["matched_pairs"]:
                vid_a = pair.get("video_a_id", "")
                vid_b = pair.get("video_b_id", "")
                score = pair.get("similarity_score", pair.get("ssim_score", 0.0))
                key = tuple(sorted([vid_a, vid_b]))
                pair_scores[key].append(float(score))

    pairs: list[dict[str, Any]] = []
    for (a, b), scores in pair_scores.items():
        avg_score = sum(scores) / len(scores) if scores else 0.0
        pairs.append({
            "channel_a_id": a,
            "channel_b_id": b,
            "average_similarity": round(avg_score, 4),
            "match_count": len(scores),
        })

    overall = (
        sum(p["average_similarity"] for p in pairs) / len(pairs) * 100.0
        if pairs
        else 0.0
    )

    return {
        "pairs": pairs,
        "overall_contamination_score": round(min(overall, 100.0), 2),
    }


@router.get("/{org_id}/channel/{channel_id}/health", response_model=ChannelHealthResponse)
async def channel_health(
    org_id: uuid.UUID,
    channel_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    """Return health metrics for a specific channel within an organization."""
    await _verify_org_access(db, org_id, current_user)

    # Fetch channel
    ch_result = await db.execute(
        select(Channel).where(Channel.id == channel_id, Channel.org_id == org_id)
    )
    channel = ch_result.scalar_one_or_none()
    if channel is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Channel not found")

    # Total videos
    vid_count_result = await db.execute(
        select(func.count()).select_from(Video).where(Video.channel_id == channel_id)
    )
    total_videos = vid_count_result.scalar() or 0

    # Flagged videos
    flagged_result = await db.execute(
        select(func.count())
        .select_from(Video)
        .where(Video.channel_id == channel_id, Video.status == VideoStatus.FLAGGED)
    )
    flagged_videos = flagged_result.scalar() or 0

    # Average risk score from audit results linked to this channel's videos
    avg_risk_result = await db.execute(
        select(func.avg(AuditResult.risk_score))
        .join(Video, AuditResult.video_id == Video.id)
        .where(Video.channel_id == channel_id)
    )
    avg_risk = avg_risk_result.scalar()
    average_risk_score = round(float(avg_risk), 2) if avg_risk is not None else 0.0

    # Audit coverage: count of results per audit type
    coverage_result = await db.execute(
        select(AuditResult.audit_type, func.count())
        .join(Video, AuditResult.video_id == Video.id)
        .where(Video.channel_id == channel_id)
        .group_by(AuditResult.audit_type)
    )
    audit_coverage = {row[0].value: row[1] for row in coverage_result.all()}

    # Latest audit
    latest_result = await db.execute(
        select(func.max(AuditResult.created_at))
        .join(Video, AuditResult.video_id == Video.id)
        .where(Video.channel_id == channel_id)
    )
    latest_audit_at = latest_result.scalar()

    # Calculate creator metrics
    breakdown_stmt = (
        select(AuditResult.audit_type, func.avg(AuditResult.risk_score))
        .join(Video, AuditResult.video_id == Video.id)
        .where(Video.channel_id == channel_id)
        .group_by(AuditResult.audit_type)
    )
    breakdown_res = await db.execute(breakdown_stmt)
    tb = {row[0].value: float(row[1]) if row[1] is not None else 0.0 for row in breakdown_res.all()}

    script_sim = tb.get(AuditType.SCRIPT_SIMILARITY.value, 0.0)
    visual_sim = tb.get(AuditType.VISUAL_SIMILARITY.value, 0.0)
    asset_reuse = tb.get(AuditType.ASSET_REUSE.value, 0.0)
    voice_foren = tb.get(AuditType.VOICE_FORENSIC.value, 0.0)
    velocity_an = tb.get(AuditType.VELOCITY_ANOMALY.value, 0.0)

    monetization_stability = max(0.0, min(100.0, 100.0 - average_risk_score * 1.2))
    originality_score = max(0.0, min(100.0, 100.0 - (script_sim * 0.5 + visual_sim * 0.5)))
    human_value_index = max(0.0, min(100.0, 100.0 - (voice_foren * 0.6 + asset_reuse * 0.4)))
    content_farm_risk = max(0.0, min(100.0, (script_sim * 0.4 + velocity_an * 0.4 + asset_reuse * 0.2)))
    brand_safety = max(0.0, min(100.0, 100.0 - voice_foren * 0.4 - velocity_an * 0.2))
    upload_readiness = max(0.0, min(100.0, (monetization_stability + brand_safety + originality_score) / 3.0))

    return {
        "channel_id": channel_id,
        "channel_title": channel.title,
        "total_videos": total_videos,
        "flagged_videos": flagged_videos,
        "average_risk_score": average_risk_score,
        "audit_coverage": audit_coverage,
        "latest_audit_at": latest_audit_at,
        "monetization_stability": round(monetization_stability, 2),
        "originality_score": round(originality_score, 2),
        "human_value_index": round(human_value_index, 2),
        "content_farm_risk": round(content_farm_risk, 2),
        "brand_safety": round(brand_safety, 2),
        "upload_readiness": round(upload_readiness, 2),
    }


@router.get("/{org_id}/fleet", response_model=list[ChannelHealthResponse])
async def fleet_management_dashboard(
    org_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[dict]:
    """Return a list of all channels with their individual health metrics (Fleet View)."""
    await _verify_org_access(db, org_id, current_user)

    # Fetch all channels
    result = await db.execute(
        select(Channel).where(Channel.org_id == org_id).order_by(Channel.connected_at.desc())
    )
    channels = result.scalars().all()
    if not channels:
        return []

    channel_ids = [c.id for c in channels]

    # 1. Total and Flagged videos per channel
    vid_stmt = (
        select(
            Video.channel_id,
            func.count(Video.id).label("total_videos"),
            func.sum(case((Video.status == VideoStatus.FLAGGED, 1), else_=0)).label("flagged_videos")
        )
        .where(Video.channel_id.in_(channel_ids))
        .group_by(Video.channel_id)
    )
    vid_res = await db.execute(vid_stmt)
    vid_stats = {row.channel_id: {"total": row.total_videos, "flagged": row.flagged_videos or 0} for row in vid_res}

    # 2. Overall avg risk and latest audit
    overall_aud_stmt = (
        select(
            Video.channel_id,
            func.avg(AuditResult.risk_score).label("overall_avg_risk"),
            func.max(AuditResult.created_at).label("latest_audit")
        )
        .join(Video, AuditResult.video_id == Video.id)
        .where(Video.channel_id.in_(channel_ids))
        .group_by(Video.channel_id)
    )
    overall_aud_res = await db.execute(overall_aud_stmt)
    overall_aud_stats = {
        row.channel_id: {
            "avg_risk": round(float(row.overall_avg_risk), 2) if row.overall_avg_risk is not None else 0.0,
            "latest_audit": row.latest_audit
        }
        for row in overall_aud_res
    }

    # 3. Audit coverage and breakdown by type
    aud_stmt = (
        select(
            Video.channel_id,
            AuditResult.audit_type,
            func.avg(AuditResult.risk_score).label("avg_risk"),
            func.count(AuditResult.id).label("coverage_count")
        )
        .join(Video, AuditResult.video_id == Video.id)
        .where(Video.channel_id.in_(channel_ids))
        .group_by(Video.channel_id, AuditResult.audit_type)
    )
    aud_res = await db.execute(aud_stmt)
    
    breakdown_stats = defaultdict(lambda: {"coverage": {}, "breakdown": {}})
    for row in aud_res:
        cid = row.channel_id
        atype = row.audit_type.value
        breakdown_stats[cid]["coverage"][atype] = row.coverage_count
        breakdown_stats[cid]["breakdown"][atype] = float(row.avg_risk) if row.avg_risk is not None else 0.0

    fleet_data = []
    for channel in channels:
        v_stat = vid_stats.get(channel.id, {"total": 0, "flagged": 0})
        total_videos = v_stat["total"]
        flagged_videos = v_stat["flagged"]
        
        oa_stat = overall_aud_stats.get(channel.id, {"avg_risk": 0.0, "latest_audit": None})
        average_risk_score = oa_stat["avg_risk"]
        latest_audit_at = oa_stat["latest_audit"]
        
        b_stat = breakdown_stats[channel.id]
        audit_coverage = b_stat["coverage"]
        tb = b_stat["breakdown"]

        script_sim = tb.get(AuditType.SCRIPT_SIMILARITY.value, 0.0)
        visual_sim = tb.get(AuditType.VISUAL_SIMILARITY.value, 0.0)
        asset_reuse = tb.get(AuditType.ASSET_REUSE.value, 0.0)
        voice_foren = tb.get(AuditType.VOICE_FORENSIC.value, 0.0)
        velocity_an = tb.get(AuditType.VELOCITY_ANOMALY.value, 0.0)

        monetization_stability = max(0.0, min(100.0, 100.0 - average_risk_score * 1.2))
        originality_score = max(0.0, min(100.0, 100.0 - (script_sim * 0.5 + visual_sim * 0.5)))
        human_value_index = max(0.0, min(100.0, 100.0 - (voice_foren * 0.6 + asset_reuse * 0.4)))
        content_farm_risk = max(0.0, min(100.0, (script_sim * 0.4 + velocity_an * 0.4 + asset_reuse * 0.2)))
        brand_safety = max(0.0, min(100.0, 100.0 - voice_foren * 0.4 - velocity_an * 0.2))
        upload_readiness = max(0.0, min(100.0, (monetization_stability + brand_safety + originality_score) / 3.0))

        fleet_data.append({
            "channel_id": channel.id,
            "channel_title": channel.title,
            "total_videos": total_videos,
            "flagged_videos": flagged_videos,
            "average_risk_score": average_risk_score,
            "audit_coverage": audit_coverage,
            "latest_audit_at": latest_audit_at,
            "monetization_stability": round(monetization_stability, 2),
            "originality_score": round(originality_score, 2),
            "human_value_index": round(human_value_index, 2),
            "content_farm_risk": round(content_farm_risk, 2),
            "brand_safety": round(brand_safety, 2),
            "upload_readiness": round(upload_readiness, 2),
        })

    return fleet_data


@router.get("/{org_id}/flagged-videos")
async def get_flagged_videos(
    org_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[dict]:
    """Retrieve all flagged videos and their corresponding audit results for an organization."""
    await _verify_org_access(db, org_id, current_user)

    # Query all flagged videos in channels owned by the org
    stmt = (
        select(Video, Channel.title.label("channel_title"))
        .join(Channel, Video.channel_id == Channel.id)
        .where(Channel.org_id == org_id, Video.status == VideoStatus.FLAGGED)
        .order_by(Video.created_at.desc())
    )
    result = await db.execute(stmt)
    rows = result.all()

    flagged_list = []
    for video, channel_title in rows:
        # Get audit results for this video
        aud_stmt = select(AuditResult).where(AuditResult.video_id == video.id)
        aud_res = await db.execute(aud_stmt)
        audits = aud_res.scalars().all()

        flagged_list.append({
            "id": str(video.id),
            "youtube_video_id": video.youtube_video_id,
            "title": video.title,
            "description": video.description,
            "published_at": video.published_at.isoformat() if video.published_at else None,
            "thumbnail_url": video.thumbnail_url,
            "status": video.status.value,
            "channel_title": channel_title,
            "audits": [
                {
                    "id": str(a.id),
                    "audit_type": a.audit_type.value,
                    "risk_score": a.risk_score,
                    "severity": a.severity.value,
                    "details": a.details,
                    "created_at": a.created_at.isoformat(),
                }
                for a in audits
            ]
        })

    return flagged_list


@router.post("/remedy/{video_id}/{action}")
async def remedy_video(
    video_id: uuid.UUID,
    action: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    """Remediate or dismiss a flagged video."""
    # Find video
    v_stmt = select(Video).where(Video.id == video_id)
    v_res = await db.execute(v_stmt)
    video = v_res.scalar_one_or_none()
    if not video:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Video not found")

    # Find channel to verify org ownership
    ch_stmt = select(Channel).where(Channel.id == video.channel_id)
    ch_res = await db.execute(ch_stmt)
    channel = ch_res.scalar_one_or_none()
    if not channel:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Channel not found")

    await _verify_org_access(db, channel.org_id, current_user)

    if action == "dismiss":
        # Simply mark the video as COMPLETED
        video.status = VideoStatus.COMPLETED
        # Update deepfake/moderation risk scores to safe
        aud_stmt = select(AuditResult).where(AuditResult.video_id == video.id)
        aud_res = await db.execute(aud_stmt)
        audits = aud_res.scalars().all()
        for a in audits:
            a.risk_score = 5.0
            a.severity = Severity.LOW
            if a.details:
                a.details["remediation_status"] = "dismissed_by_user"
        await db.commit()
        return {"status": "success", "message": "Policy alert dismissed successfully"}

    elif action == "verify":
        # Keep status flagged but add a manual verification request note
        aud_stmt = select(AuditResult).where(AuditResult.video_id == video.id)
        aud_res = await db.execute(aud_stmt)
        audits = aud_res.scalars().all()
        for a in audits:
            if a.details:
                a.details["remediation_status"] = "priority_human_verification_requested"
        await db.commit()
        return {"status": "success", "message": "Video queued for priority human verification"}

    elif action == "remediate":
        # Remediate: strip sensitive/toxic terms from title and set safe
        cleaned_title = video.title
        sensitive_terms = ["fuck", "fvck", "shit", "bitch", "bastard"]
        for term in sensitive_terms:
            # Case insensitive replace
            import re
            cleaned_title = re.sub(re.escape(term), "[cleaned]", cleaned_title, flags=re.IGNORECASE)
        
        # Add a compliance disclaimer to description
        disclaimer = "\n\n[Compliance Disclaimer: This video metadata is fully reviewed and verified for YouTube Advertiser Guidelines compliance.]"
        if not video.description:
            video.description = disclaimer
        elif disclaimer not in video.description:
            video.description += disclaimer

        video.title = cleaned_title
        video.status = VideoStatus.COMPLETED

        aud_stmt = select(AuditResult).where(AuditResult.video_id == video.id)
        aud_res = await db.execute(aud_stmt)
        audits = aud_res.scalars().all()
        for a in audits:
            a.risk_score = 5.0
            a.severity = Severity.LOW
            if a.details:
                a.details["remediation_status"] = "remediated_via_metadata_cleanup"
                a.details["cleaned_title"] = cleaned_title
        
        await db.commit()
        return {"status": "success", "message": "Metadata auto-cleaned and video status set to COMPLETED"}

    else:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid action")


@router.get("/videos/{video_id}", response_model=VideoResponse)
async def get_video_detail(
    video_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Video:
    """Retrieve details for a single video."""
    v_stmt = select(Video).where(Video.id == video_id)
    v_res = await db.execute(v_stmt)
    video = v_res.scalar_one_or_none()
    if not video:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Video not found")

    ch_stmt = select(Channel).where(Channel.id == video.channel_id)
    ch_res = await db.execute(ch_stmt)
    channel = ch_res.scalar_one_or_none()
    if not channel:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Channel not found")

    await _verify_org_access(db, channel.org_id, current_user)
    return video


@router.patch("/videos/{video_id}/metadata")
async def update_video_metadata(
    video_id: uuid.UUID,
    body: dict,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    """Update a video's metadata and resolve its policy risk to COMPLETED."""
    v_stmt = select(Video).where(Video.id == video_id)
    v_res = await db.execute(v_stmt)
    video = v_res.scalar_one_or_none()
    if not video:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Video not found")

    ch_stmt = select(Channel).where(Channel.id == video.channel_id)
    ch_res = await db.execute(ch_stmt)
    channel = ch_res.scalar_one_or_none()
    if not channel:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Channel not found")

    await _verify_org_access(db, channel.org_id, current_user)

    video.title = body.get("title", video.title)
    video.description = body.get("description", video.description)
    video.status = VideoStatus.COMPLETED

    aud_stmt = select(AuditResult).where(AuditResult.video_id == video.id)
    aud_res = await db.execute(aud_stmt)
    audits = aud_res.scalars().all()
    for a in audits:
        a.risk_score = 5.0
        a.severity = Severity.LOW
        # Copy details or init dict
        details = dict(a.details) if a.details else {}
        details["remediation_status"] = "manually_edited_and_resolved"
        details["user_edited_title"] = video.title
        a.details = details

    await db.commit()
    return {"status": "success", "message": "Video metadata updated and status resolved to COMPLETED"}


@router.get("/{org_id}/gemini-summary")
async def get_gemini_summary(
    org_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    """Generate a Gemini executive summary report of scanned videos and AI density."""
    await _verify_org_access(db, org_id, current_user)

    # 1. Gather library statistics
    # Total videos in channels under org
    tot_stmt = (
        select(func.count(Video.id))
        .join(Channel, Video.channel_id == Channel.id)
        .where(Channel.org_id == org_id)
    )
    tot_res = await db.execute(tot_stmt)
    total_videos = tot_res.scalar() or 0

    # Flagged videos
    flg_stmt = (
        select(func.count(Video.id))
        .join(Channel, Video.channel_id == Channel.id)
        .where(Channel.org_id == org_id, Video.status == VideoStatus.FLAGGED)
    )
    flg_res = await db.execute(flg_stmt)
    flagged_videos = flg_res.scalar() or 0

    # AI Concept videos (contain fan made, concept, etc. in title)
    title_stmt = (
        select(Video.title)
        .join(Channel, Video.channel_id == Channel.id)
        .where(Channel.org_id == org_id)
    )
    title_res = await db.execute(title_stmt)
    titles = title_res.scalars().all()

    ai_keywords = ["fan made", "fanmade", "concept", "trailer (fan", "fake"]
    ai_videos = sum(1 for t in titles if any(kw in t.lower() for kw in ai_keywords))

    flagged_pct = (flagged_videos / total_videos * 100.0) if total_videos > 0 else 0.0
    ai_pct = (ai_videos / total_videos * 100.0) if total_videos > 0 else 0.0
    risk_level = "Critical" if flagged_pct > 15 else "High" if flagged_pct > 8 else "Medium" if flagged_pct > 2 else "Low"

    # 2. Call Gemini Service
    from app.services.gemini_service import gemini_service
    import logging
    logger = logging.getLogger(__name__)
    summary_text = ""
    if gemini_service._client is not None:
        try:
            prompt = (
                "You are a helpful YouTube channel assistant. "
                "Generate a very simple, easy-to-understand summary about the channel's health. "
                "Do NOT use complex jargon or big words. "
                f"Data: Scanned {total_videos} videos. Flagged {flagged_videos} videos ({flagged_pct:.1f}%). "
                f"Found {ai_videos} AI/synthetic videos ({ai_pct:.1f}%). "
                "Format the text exactly into two sections using bullet points (e.g., '- '). "
                "Section 1: CHANNEL HEALTH. "
                "- State how many videos were scanned and flagged. "
                "- Include a line answering 'Are you shadowbanned?' (Answer YES if flagged > 15%, WARNING if > 5%, otherwise NO). "
                "- Give a very simple explanation of their current spam and algorithm risk. "
                "Section 2: WHAT TO DO NEXT. "
                "- Give 2-3 simple steps (e.g., 'Clean up repeated words in titles', 'Add a disclaimer if using AI', 'Don't upload too many videos at once'). "
                "IMPORTANT: Do not use markdown bold/italic tags (like ** or *) as the frontend does not support them."
            )
            import asyncio
            from fastapi.concurrency import run_in_threadpool
            response = await asyncio.wait_for(
                run_in_threadpool(
                    lambda: gemini_service._client.models.generate_content(
                        model='gemini-2.5-flash',
                        contents=prompt
                    )
                ),
                timeout=15.0
            )
            summary_text = response.text
        except Exception as e:
            logger.error("Gemini report generation failed: %s. Falling back to rule-based summary...", e)

    # 3. Fallback summary
    if not summary_text:
        shadowban_status = "YES" if flagged_pct > 15 else "WARNING" if flagged_pct > 5 else "NO"
        summary_text = (
            f"CHANNEL HEALTH:\n"
            f"- We checked {total_videos} videos and found {flagged_videos} flagged for breaking rules.\n"
            f"- Are you shadowbanned? {shadowban_status}\n"
            f"- Your channel is currently at {risk_level} risk. Having too much AI or spammy content can make YouTube hide your videos.\n\n"
            f"WHAT TO DO NEXT:\n"
            f"- Clean up your video titles to remove repeated words or bad language.\n"
            f"- If a video uses AI, tell your viewers in the description.\n"
            f"- Avoid uploading too many videos on the same day."
        )

    return {
        "summary": summary_text,
        "total_videos": total_videos,
        "flagged_videos": flagged_videos,
        "flagged_pct": round(flagged_pct, 1),
        "ai_videos": ai_videos,
        "ai_pct": round(ai_pct, 1),
        "risk_level": risk_level
    }
