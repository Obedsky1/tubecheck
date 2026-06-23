"""Velocity anomaly audit – detects suspicious upload pacing across a network.

Analyses inter-upload intervals, coefficient of variation, burst patterns,
and cross-channel upload frequency to surface content-farm behaviour.
"""

from __future__ import annotations

import logging
import uuid
from collections import defaultdict
from datetime import datetime, timedelta, timezone

import numpy as np

from app.celery_app import celery_app

logger = logging.getLogger(__name__)


def _compute_severity(risk_score: float) -> str:
    if risk_score >= 80:
        return "CRITICAL"
    if risk_score >= 60:
        return "HIGH"
    if risk_score >= 40:
        return "MEDIUM"
    return "LOW"


@celery_app.task(name="app.workers.velocity_audit.run_velocity_audit", bind=True, max_retries=3)
def run_velocity_audit(self, org_id: str) -> dict:
    """Analyse upload velocity across an organization's channels.

    Flags if:
    - Coefficient of Variation of intervals < 0.3 (suspiciously regular)
    - Mean uploads > 5/day across the network
    - Burst: > 10 videos within any 2-hour window
    """
    from sqlalchemy import create_engine, select
    from sqlalchemy.orm import Session

    from app.config import get_settings
    from app.models import AuditResult, AuditType, Channel, Severity, Video

    settings = get_settings()
    engine = create_engine(settings.DATABASE_URL_SYNC)

    org_uuid = uuid.UUID(org_id)
    max_risk_score = 0.0
    pattern_types: list[str] = []

    try:
        with Session(engine) as session:
            channels = session.execute(
                select(Channel).where(Channel.org_id == org_uuid)
            ).scalars().all()
            channel_ids = {ch.id for ch in channels}

            if not channel_ids:
                return {"status": "skipped", "reason": "no channels"}

            videos = session.execute(
                select(Video)
                .where(
                    Video.channel_id.in_(channel_ids),
                    Video.published_at.isnot(None),
                )
                .order_by(Video.published_at.asc())
            ).scalars().all()

            if len(videos) < 3:
                return {"status": "skipped", "reason": "insufficient videos for velocity analysis"}

            # ── Per-channel interval analysis ─────────────────────────────
            channel_videos: dict[uuid.UUID, list[datetime]] = defaultdict(list)
            all_timestamps: list[datetime] = []

            for v in videos:
                channel_videos[v.channel_id].append(v.published_at)
                all_timestamps.append(v.published_at)

            per_channel_stats: dict[str, dict] = {}

            for ch_id, timestamps in channel_videos.items():
                timestamps.sort()
                if len(timestamps) < 2:
                    per_channel_stats[str(ch_id)] = {
                        "video_count": len(timestamps),
                        "intervals": [],
                        "cv": None,
                    }
                    continue

                intervals_hours: list[float] = []
                for k in range(1, len(timestamps)):
                    delta = (timestamps[k] - timestamps[k - 1]).total_seconds() / 3600.0
                    intervals_hours.append(delta)

                arr = np.array(intervals_hours)
                mean_interval = float(np.mean(arr))
                std_interval = float(np.std(arr))
                cv = std_interval / mean_interval if mean_interval > 0 else 0.0

                per_channel_stats[str(ch_id)] = {
                    "video_count": len(timestamps),
                    "mean_interval_hours": round(mean_interval, 2),
                    "std_interval_hours": round(std_interval, 2),
                    "cv": round(cv, 4),
                    "intervals_sample": [round(x, 2) for x in intervals_hours[:20]],
                }

            # ── Network-wide analysis ─────────────────────────────────────
            all_timestamps.sort()

            # Compute network-wide intervals
            network_intervals: list[float] = []
            for k in range(1, len(all_timestamps)):
                delta = (all_timestamps[k] - all_timestamps[k - 1]).total_seconds() / 3600.0
                network_intervals.append(delta)

            net_arr = np.array(network_intervals) if network_intervals else np.array([0.0])
            network_mean_interval = float(np.mean(net_arr))
            network_cv = (
                float(np.std(net_arr) / np.mean(net_arr))
                if np.mean(net_arr) > 0
                else 0.0
            )

            # Mean uploads per day across the network
            if len(all_timestamps) >= 2:
                span_days = max(
                    (all_timestamps[-1] - all_timestamps[0]).total_seconds() / 86400.0,
                    1.0,
                )
                mean_uploads_per_day = len(all_timestamps) / span_days
            else:
                span_days = 0.0
                mean_uploads_per_day = 0.0

            # ── Flag: CV too low (suspiciously regular) ───────────────────
            if network_cv < 0.3 and len(network_intervals) >= 5:
                risk = (1.0 - network_cv / 0.3) * 70.0
                max_risk_score = max(max_risk_score, risk)
                pattern_types.append("suspiciously_regular")

            # ── Flag: Too many uploads per day ────────────────────────────
            if mean_uploads_per_day > 5.0:
                risk = min((mean_uploads_per_day / 5.0) * 60.0, 100.0)
                max_risk_score = max(max_risk_score, risk)
                pattern_types.append("high_daily_velocity")

            # ── Flag: Burst detection (>10 videos in 2 hours) ─────────────
            burst_detected = False
            burst_details: list[dict] = []
            window = timedelta(hours=2)

            for start_idx in range(len(all_timestamps)):
                end_time = all_timestamps[start_idx] + window
                count = 0
                for ts in all_timestamps[start_idx:]:
                    if ts <= end_time:
                        count += 1
                    else:
                        break

                if count > 10:
                    burst_detected = True
                    burst_details.append({
                        "window_start": all_timestamps[start_idx].isoformat(),
                        "window_end": end_time.isoformat(),
                        "video_count": count,
                    })
                    # Only record first few bursts
                    if len(burst_details) >= 5:
                        break

            if burst_detected:
                max_risk_score = max(max_risk_score, 85.0)
                pattern_types.append("burst_upload")

            # ── Content Farm & Automation Detection ──────────────────────
            from app.services.farm_detection_service import farm_detection_service
            farm_report = farm_detection_service.analyze_network_velocity(session, org_uuid)
            
            # Combine risk scores
            combined_risk = max(max_risk_score, farm_report["content_farm_probability"] * 100.0)

            # ── Persist ───────────────────────────────────────────────────
            severity_label = _compute_severity(combined_risk)
            audit = save_or_update_audit_result(
                session=session,
                details={}
            )

            logger.info(
                "Velocity audit for org %s complete: patterns=%s, risk=%.1f",
                org_id, pattern_types, max_risk_score,
            )

    except Exception as exc:
        logger.exception("Velocity audit failed for org %s", org_id)
        raise self.retry(exc=exc, countdown=60)

    return {
        "status": "completed",
        "patterns": pattern_types,
        "risk_score": round(max_risk_score, 2),
    }
