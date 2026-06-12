"""Visual similarity audit – detects recycled thumbnails across channels.

Downloads video thumbnails, resizes to 256×256 grayscale, and computes
SSIM (Structural Similarity Index) between cross-channel pairs.
"""

from __future__ import annotations

import io
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


def _download_image(url: str) -> bytes | None:
    """Download an image from a URL, returning raw bytes or None on failure."""
    import httpx

    try:
        resp = httpx.get(url, timeout=15, follow_redirects=True)
        resp.raise_for_status()
        return resp.content
    except Exception as exc:
        logger.warning("Failed to download thumbnail %s: %s", url, exc)
        return None


def _prepare_grayscale(raw_bytes: bytes, size: tuple[int, int] = (256, 256)):
    """Decode, resize to `size`, and convert to grayscale numpy array."""
    import cv2
    import numpy as np

    arr = np.frombuffer(raw_bytes, dtype=np.uint8)
    img = cv2.imdecode(arr, cv2.IMREAD_COLOR)
    if img is None:
        return None
    img = cv2.resize(img, size, interpolation=cv2.INTER_AREA)
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    return gray


@celery_app.task(name="app.workers.visual_audit.run_visual_audit", bind=True, max_retries=3)
def run_visual_audit(self, org_id: str) -> dict:
    """Compare video thumbnails across channels using SSIM.

    Flags cross-channel pairs with SSIM > 0.85.
    """
    from skimage.metrics import structural_similarity as ssim

    from sqlalchemy import create_engine, select
    from sqlalchemy.orm import Session

    from app.config import get_settings
    from app.models import AuditResult, AuditType, Channel, Severity, Video

    settings = get_settings()
    engine = create_engine(settings.DATABASE_URL_SYNC)

    org_uuid = uuid.UUID(org_id)
    matched_pairs: list[dict] = []
    max_risk_score = 0.0

    try:
        with Session(engine) as session:
            channels = session.execute(
                select(Channel).where(Channel.org_id == org_uuid)
            ).scalars().all()
            channel_ids = {ch.id for ch in channels}

            if len(channel_ids) < 2:
                logger.info("Org %s has fewer than 2 channels – skipping visual audit", org_id)
                return {"status": "skipped", "reason": "fewer than 2 channels"}

            videos = session.execute(
                select(Video).where(
                    Video.channel_id.in_(channel_ids),
                    Video.thumbnail_url.isnot(None),
                )
            ).scalars().all()

            if len(videos) < 2:
                return {"status": "skipped", "reason": "insufficient videos with thumbnails"}

            # Download and prepare images
            prepared: list[tuple] = []  # (video, channel_id, grayscale_array)
            for v in videos:
                raw = _download_image(v.thumbnail_url)
                if raw is None:
                    continue
                gray = _prepare_grayscale(raw)
                if gray is None:
                    continue
                prepared.append((v, v.channel_id, gray))

            logger.info("Visual audit: %d thumbnails prepared for org %s", len(prepared), org_id)

            # Cross-channel SSIM comparison
            for i, j in combinations(range(len(prepared)), 2):
                v_a, ch_a, img_a = prepared[i]
                v_b, ch_b, img_b = prepared[j]

                if ch_a == ch_b:
                    continue

                score = ssim(img_a, img_b)
                if score < 0.85:
                    continue

                risk = min(score * 100.0, 100.0)
                max_risk_score = max(max_risk_score, risk)

                matched_pairs.append({
                    "video_a_id": str(v_a.id),
                    "video_a_title": v_a.title,
                    "video_a_thumbnail": v_a.thumbnail_url,
                    "video_b_id": str(v_b.id),
                    "video_b_title": v_b.title,
                    "video_b_thumbnail": v_b.thumbnail_url,
                    "ssim_score": round(float(score), 4),
                    "similarity_score": round(risk / 100.0, 4),
                })

            # Persist result
            severity_label = _compute_severity(max_risk_score)
            audit = AuditResult(
                org_id=org_uuid,
                audit_type=AuditType.VISUAL_SIMILARITY,
                risk_score=round(max_risk_score, 2),
                severity=Severity(severity_label),
                details={
                    "matched_pairs": matched_pairs[:50],
                    "total_matches": len(matched_pairs),
                    "total_thumbnails_analysed": len(prepared),
                },
            )
            session.add(audit)
            session.commit()

            logger.info(
                "Visual audit for org %s complete: %d matches, risk=%.1f",
                org_id, len(matched_pairs), max_risk_score,
            )

    except Exception as exc:
        logger.exception("Visual audit failed for org %s", org_id)
        raise self.retry(exc=exc, countdown=60)

    return {
        "status": "completed",
        "matches": len(matched_pairs),
        "risk_score": round(max_risk_score, 2),
    }
