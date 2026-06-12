"""Asset reuse audit – detects re-used video footage via perceptual hashing.

Uses videohash to compute perceptual hashes of video files and compares
Hamming distances across channels to find re-used raw footage.
"""

from __future__ import annotations

import logging
import uuid
from itertools import combinations

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


def _hamming_distance(hash_a: str, hash_b: str) -> int:
    """Compute Hamming distance between two hex-encoded hashes."""
    if len(hash_a) != len(hash_b):
        return max(len(hash_a), len(hash_b)) * 4  # worst case

    distance = 0
    for ca, cb in zip(hash_a, hash_b):
        xor = int(ca, 16) ^ int(cb, 16)
        distance += bin(xor).count("1")
    return distance


@celery_app.task(name="app.workers.asset_audit.run_asset_audit", bind=True, max_retries=3)
def run_asset_audit(self, org_id: str) -> dict:
    """Compute perceptual video hashes and compare across channels.

    Flags cross-channel pairs with Hamming distance < 10.
    """
    from sqlalchemy import create_engine, select
    from sqlalchemy.orm import Session

    from app.config import get_settings
    from app.models import AuditResult, AuditType, Channel, Severity, Video

    settings = get_settings()
    engine = create_engine(settings.DATABASE_URL_SYNC)

    org_uuid = uuid.UUID(org_id)
    matched_pairs: list[dict] = []
    skipped: list[dict] = []
    max_risk_score = 0.0

    try:
        with Session(engine) as session:
            channels = session.execute(
                select(Channel).where(Channel.org_id == org_uuid)
            ).scalars().all()
            channel_ids = {ch.id for ch in channels}

            if len(channel_ids) < 2:
                return {"status": "skipped", "reason": "fewer than 2 channels"}

            videos = session.execute(
                select(Video).where(Video.channel_id.in_(channel_ids))
            ).scalars().all()

            # Compute perceptual hashes
            hashed_videos: list[tuple] = []  # (video, channel_id, hash_hex)

            for v in videos:
                # Build potential file path (from upload or cached download)
                import os
                import tempfile

                upload_dir = os.path.join(tempfile.gettempdir(), "shieldnetwork_uploads")
                possible_paths = [
                    os.path.join(upload_dir, f"{v.id}.mp4"),
                    os.path.join(upload_dir, f"{v.id}.webm"),
                    os.path.join(upload_dir, f"{v.id}.mkv"),
                ]

                file_path = None
                for p in possible_paths:
                    if os.path.isfile(p):
                        file_path = p
                        break

                if file_path is None:
                    skipped.append({
                        "video_id": str(v.id),
                        "title": v.title,
                        "reason": "No local file available",
                    })
                    continue

                try:
                    from videohash import VideoHash

                    vh = VideoHash(path=file_path)
                    hash_hex = vh.hash_hex
                    hashed_videos.append((v, v.channel_id, hash_hex))
                except Exception as exc:
                    logger.warning("videohash failed for %s: %s", v.id, exc)
                    skipped.append({
                        "video_id": str(v.id),
                        "title": v.title,
                        "reason": f"Hash computation failed: {exc}",
                    })

            logger.info(
                "Asset audit: %d videos hashed, %d skipped for org %s",
                len(hashed_videos), len(skipped), org_id,
            )

            # Cross-channel comparison
            for i, j in combinations(range(len(hashed_videos)), 2):
                v_a, ch_a, hash_a = hashed_videos[i]
                v_b, ch_b, hash_b = hashed_videos[j]

                if ch_a == ch_b:
                    continue

                distance = _hamming_distance(hash_a, hash_b)
                if distance >= 10:
                    continue

                # Lower distance → higher risk
                risk = max(0.0, min((10 - distance) / 10.0 * 100.0, 100.0))
                max_risk_score = max(max_risk_score, risk)

                matched_pairs.append({
                    "video_a_id": str(v_a.id),
                    "video_a_title": v_a.title,
                    "video_b_id": str(v_b.id),
                    "video_b_title": v_b.title,
                    "hash_a": hash_a,
                    "hash_b": hash_b,
                    "hamming_distance": distance,
                    "similarity_score": round(risk / 100.0, 4),
                })

            # Persist
            severity_label = _compute_severity(max_risk_score)
            audit = AuditResult(
                org_id=org_uuid,
                audit_type=AuditType.ASSET_REUSE,
                risk_score=round(max_risk_score, 2),
                severity=Severity(severity_label),
                details={
                    "matched_pairs": matched_pairs[:50],
                    "total_matches": len(matched_pairs),
                    "total_hashed": len(hashed_videos),
                    "skipped_videos": skipped[:20],
                },
            )
            session.add(audit)
            session.commit()

            logger.info(
                "Asset audit for org %s complete: %d matches, risk=%.1f",
                org_id, len(matched_pairs), max_risk_score,
            )

    except Exception as exc:
        logger.exception("Asset audit failed for org %s", org_id)
        raise self.retry(exc=exc, countdown=60)

    return {
        "status": "completed",
        "matches": len(matched_pairs),
        "skipped": len(skipped),
        "risk_score": round(max_risk_score, 2),
    }
