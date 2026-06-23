"""Script similarity audit – detects recycled scripts across channels.

Uses Levenshtein distance and TF-IDF cosine similarity to find duplicate or
near-duplicate caption text across videos from different channels in a network.
"""

from __future__ import annotations

import logging
import uuid
from itertools import combinations

from app.celery_app import celery_app

logger = logging.getLogger(__name__)


def _compute_severity(risk_score: float) -> str:
    """Map a 0-100 risk score to a severity label."""
    if risk_score >= 80:
        return "CRITICAL"
    if risk_score >= 60:
        return "HIGH"
    if risk_score >= 40:
        return "MEDIUM"
    return "LOW"


@celery_app.task(name="app.workers.script_audit.run_script_audit", bind=True, max_retries=3)
def run_script_audit(self, org_id: str) -> dict:
    """Compare caption texts across channels using Levenshtein + TF-IDF cosine similarity.

    Flags cross-channel video pairs with cosine similarity > 0.75.
    """
    import Levenshtein
    import numpy as np
    from sklearn.feature_extraction.text import TfidfVectorizer
    from sklearn.metrics.pairwise import cosine_similarity as sklearn_cosine

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
            # Get all channels for this org
            channels = session.execute(
                select(Channel).where(Channel.org_id == org_uuid)
            ).scalars().all()
            channel_ids = {ch.id for ch in channels}

            if len(channel_ids) < 2:
                logger.info("Org %s has fewer than 2 channels – skipping script audit", org_id)
                return {"status": "skipped", "reason": "fewer than 2 channels"}

            # Get all videos with caption text, grouped by channel
            videos = session.execute(
                select(Video).where(
                    Video.channel_id.in_(channel_ids),
                    Video.caption_text.isnot(None),
                    Video.caption_text != "",
                )
            ).scalars().all()

            if len(videos) < 2:
                logger.info("Fewer than 2 videos with captions – skipping")
                return {"status": "skipped", "reason": "insufficient captioned videos"}

            # Build channel→video mapping
            channel_video_map: dict[uuid.UUID, list] = {}
            for v in videos:
                channel_video_map.setdefault(v.channel_id, []).append(v)

            # Cross-channel pairs only
            channel_list = list(channel_video_map.keys())
            texts: list[str] = []
            video_index: list[tuple] = []  # (video_obj, channel_id)

            for ch_id in channel_list:
                for v in channel_video_map[ch_id]:
                    texts.append(v.caption_text)
                    video_index.append((v, ch_id))

            # TF-IDF vectorization
            vectorizer = TfidfVectorizer(
                max_features=10000,
                stop_words="english",
                ngram_range=(1, 2),
                min_df=1,
            )
            tfidf_matrix = vectorizer.fit_transform(texts)
            cos_sim_matrix = sklearn_cosine(tfidf_matrix)

            # Evaluate cross-channel pairs
            for i, j in combinations(range(len(video_index)), 2):
                v_a, ch_a = video_index[i]
                v_b, ch_b = video_index[j]

                # Only cross-channel comparisons
                if ch_a == ch_b:
                    continue

                cosine_score = float(cos_sim_matrix[i, j])
                if cosine_score < 0.75:
                    continue

                # Compute Levenshtein ratio for additional signal
                lev_ratio = Levenshtein.ratio(
                    v_a.caption_text[:5000], v_b.caption_text[:5000]
                )

                # Risk score: weighted combination
                risk = min(cosine_score * 80 + lev_ratio * 20, 100.0)
                max_risk_score = max(max_risk_score, risk)

                # Extract a short matching excerpt
                words_a = v_a.caption_text[:200]
                words_b = v_b.caption_text[:200]

                matched_pairs.append({
                    "video_a_id": str(v_a.id),
                    "video_a_title": v_a.title,
                    "video_b_id": str(v_b.id),
                    "video_b_title": v_b.title,
                    "cosine_similarity": round(cosine_score, 4),
                    "levenshtein_ratio": round(lev_ratio, 4),
                    "similarity_score": round(risk / 100.0, 4),
                    "excerpt_a": words_a,
                    "excerpt_b": words_b,
                })

            # Persist audit result
            severity_label = _compute_severity(max_risk_score)
            audit = save_or_update_audit_result(
                session=session,
                details={}
            )

            logger.info(
                "Script audit for org %s complete: %d matches, risk=%.1f",
                org_id, len(matched_pairs), max_risk_score,
            )

    except Exception as exc:
        logger.exception("Script audit failed for org %s", org_id)
        raise self.retry(exc=exc, countdown=60)

    return {
        "status": "completed",
        "matches": len(matched_pairs),
        "risk_score": round(max_risk_score, 2),
    }
