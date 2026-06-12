import logging
import uuid
import httpx
import os
from app.celery_app import celery_app
from app.workers.task_utils import get_sync_db_session, compute_severity
from app.models import Video, AuditResult, AuditType, VideoStatus
from app.config import get_settings
from app.services.hive_service import SightengineService
from app.services.synthetic_analysis_service import synthetic_media_analyzer
from sqlalchemy import select

logger = logging.getLogger(__name__)


def _check_and_update_video_status(session, video):
    """Helper to check if both pre-publish audits are complete and transition the VideoStatus."""
    stmt = select(AuditResult).where(AuditResult.video_id == video.id)
    results = session.scalars(stmt).all()
    audit_types = {r.audit_type for r in results}
    
    if AuditType.DEEPFAKE_SCAN in audit_types and AuditType.HUMAN_VALUE in audit_types:
        # Check if any audit is high/critical risk
        max_risk = max(r.risk_score for r in results)
        if max_risk >= 60.0:
            video.status = VideoStatus.FLAGGED
            logger.info("Video %s marked as FLAGGED due to high risk audit results.", video.id)
        else:
            video.status = VideoStatus.COMPLETED
            logger.info("Video %s marked as COMPLETED safely.", video.id)
        session.commit()


@celery_app.task(name="app.workers.moderation_worker.scan_moderation", bind=True, max_retries=3)
def scan_moderation(self, video_id: str) -> dict:
    """Invokes Hive Moderation API or falls back to simulated safety scan for community guidelines compliance."""
    logger.info("Starting safety moderation scan for video %s", video_id)
    video_uuid = uuid.UUID(video_id) if isinstance(video_id, str) else video_id
    settings = get_settings()

    try:
        session = get_sync_db_session()
        video = session.get(Video, video_uuid)
        if not video:
            return {"status": "error", "reason": "video not found"}

        # 1. Sightengine API Integration if credentials are present
        risk_score = 0.0
        details = {}
        
        if settings.SIGHTENGINE_API_USER and settings.SIGHTENGINE_API_SECRET and video.thumbnail_url:
            try:
                # Call Sightengine visual moderation endpoint
                params = {
                    "models": "nudity-2.1,violence,gore,drugs",
                    "api_user": settings.SIGHTENGINE_API_USER,
                    "api_secret": settings.SIGHTENGINE_API_SECRET,
                    "url": video.thumbnail_url
                }
                response = httpx.get(
                    "https://api.sightengine.com/1.0/check.json",
                    params=params,
                    timeout=15.0
                )
                
                if response.status_code == 200:
                    data = response.json()
                    
                    # Parse Sightengine response (e.g. check for nudity, violence, gore, drugs)
                    nudity_data = data.get("nudity", {})
                    nudity_score = 1.0 - nudity_data.get("safe", 1.0)
                    nudity_score = max(nudity_score, nudity_data.get("raw", 0.0), nudity_data.get("partial", 0.0))
                    
                    violence_score = data.get("violence", {}).get("prob", 0.0)
                    gore_score = data.get("gore", {}).get("prob", 0.0)
                    drugs_score = data.get("drugs", {}).get("prob", 0.0)
                    
                    max_class_score = max(nudity_score, violence_score, gore_score, drugs_score)
                    flagged_categories = []
                    if nudity_score > 0.5:
                        flagged_categories.append(f"nudity: {nudity_score:.2f}")
                    if violence_score > 0.5:
                        flagged_categories.append(f"violence: {violence_score:.2f}")
                    if gore_score > 0.5:
                        flagged_categories.append(f"gore: {gore_score:.2f}")
                    if drugs_score > 0.5:
                        flagged_categories.append(f"drugs: {drugs_score:.2f}")
                    
                    risk_score = max_class_score * 100.0
                    details = {
                        "api_provider": "Sightengine Content Moderation",
                        "flagged_classes": flagged_categories,
                        "raw_response_truncated": str(data)[:500]
                    }
                else:
                    logger.warning("Sightengine API HTTP status: %d", response.status_code)
            except Exception as sight_err:
                logger.error("Sightengine API query failed: %s", sight_err)

        # 2. Simulated Fallback (if no API response or no key)
        if not details:
            title_lower = video.title.lower()
            
            # Detect inauthentic/demonetized indicators
            inauthentic_keywords = ["fan made", "fanmade", "concept", "trailer (fan", "fake"]
            demonetized_keywords = ["fvck", "fuck", "kill", "cheat", "hack", "gun", "war", "blood", "death", "demon"]
            
            matched_inauthentic = [w for w in inauthentic_keywords if w in title_lower]
            matched_demonetized = [w for w in demonetized_keywords if w in title_lower]
            
            matches = matched_inauthentic + matched_demonetized
            
            if matches:
                # If there are explicit indicators of fan-made/concept or demonetization risks, set risk score high
                risk_score = 65.0 + len(matches) * 10.0
                risk_score = min(risk_score, 100.0)
                details = {
                    "method": "simulated_moderation_scan",
                    "reason": "sensitive keywords and authenticity flags in title",
                    "matched_keywords": matches,
                    "guideline_violation_risk": "critical" if risk_score >= 80 else "high"
                }
            else:
                risk_score = 5.0
                details = {
                    "method": "simulated_moderation_scan",
                    "guideline_violation_risk": "low"
                }

        severity = compute_severity(risk_score)
        
        # Check if an existing deepfake/moderation audit exists
        stmt = select(AuditResult).where(
            AuditResult.video_id == video_uuid,
            AuditResult.audit_type == AuditType.DEEPFAKE_SCAN
        )
        audit = session.scalar(stmt)
        if not audit:
            audit = AuditResult(
                video_id=video_uuid,
                org_id=video.channel.org_id,
                audit_type=AuditType.DEEPFAKE_SCAN,
                risk_score=risk_score,
                severity=severity,
                details=details
            )
            session.add(audit)
        else:
            audit.risk_score = risk_score
            audit.severity = severity
            audit.details = details
            
        session.commit()

        logger.info("Safety moderation scan completed for video %s, risk_score=%.1f", video_id, risk_score)
        
        # Check and update the global video status
        _check_and_update_video_status(session, video)
        
        return {"status": "completed", "risk_score": risk_score}

    except Exception as exc:
        logger.exception("Moderation safety audit failed for video %s", video_id)
        raise self.retry(exc=exc, countdown=60)


@celery_app.task(name="app.workers.deepfake_scan", bind=True, max_retries=3)
def deepfake_scan(self, video_id: str, file_path: str) -> dict:
    """Performs visual deepfake scanning and audio speech classification on uploaded files
    using local high-fidelity forensics (FFT checkerboard, Farneback optical flow,
    geometric Hu moments, audio bicoherence, phase-coupling, and pauses/breaths)."""
    logger.info("Starting deepfake_scan for uploaded video %s at %s", video_id, file_path)
    video_uuid = uuid.UUID(video_id) if isinstance(video_id, str) else video_id

    try:
        session = get_sync_db_session()
        video = session.get(Video, video_uuid)
        if not video:
            return {"status": "error", "reason": "video not found"}

        # 1. Run visual deepfake analysis (Sightengine + local visual FFT/optical flow/geometry)
        visual_analysis = synthetic_media_analyzer.analyze_deepfake_video(file_path)
        visual_prob = visual_analysis.get("probability", 0.0)
        visual_provider = visual_analysis.get("provider", "Local Visual Forensics")
        vis_details = visual_analysis.get("details", {})

        # 2. Run audio deepfake/TTS analysis (ElevenLabs + local DSP bicoherence/phase/pauses)
        audio_analysis = synthetic_media_analyzer.analyze_audio(file_path)
        audio_prob = audio_analysis.get("probability", 0.0)
        audio_provider = audio_analysis.get("provider", "Local DSP Speech Forensics")
        aud_details = audio_analysis.get("details", {})

        # 3. Calculate combined risk score using exponential penalty scaling
        combined_features = {
            "fft_artifacts": vis_details.get("fft_artifacts_probability", 0.0),
            "optical_flow": vis_details.get("optical_flow_probability", 0.0),
            "geometric_invariance": vis_details.get("geometric_invariance_probability", 0.0),
            "bicoherence": aud_details.get("bicoherence_probability", 0.0),
            "phase_mapping": aud_details.get("phase_mapping_probability", 0.0),
            "micro_pauses": aud_details.get("micro_pauses_probability", 0.0),
        }
        
        combined_prob = synthetic_media_analyzer.combine_forensic_scores(combined_features)
        
        # Ensure we don't underestimate if external APIs reported higher scores
        combined_prob = max(combined_prob, visual_prob, audio_prob)
        combined_risk = combined_prob * 100.0
        
        severity = compute_severity(combined_risk)

        details = {
            "visual_deepfake_probability": visual_prob,
            "visual_provider": visual_provider,
            "visual_details": vis_details,
            "audio_synthetic_probability": audio_prob,
            "audio_provider": audio_provider,
            "audio_details": aud_details,
            "audio_analysis_explanation": audio_analysis.get("evidence_explanation", ""),
            "combined_forensic_score": combined_prob
        }

        # Check if an existing deepfake audit exists
        stmt = select(AuditResult).where(
            AuditResult.video_id == video_uuid,
            AuditResult.audit_type == AuditType.DEEPFAKE_SCAN
        )
        audit = session.scalar(stmt)
        if not audit:
            audit = AuditResult(
                video_id=video_uuid,
                org_id=video.channel.org_id,
                audit_type=AuditType.DEEPFAKE_SCAN,
                risk_score=round(combined_risk, 2),
                severity=severity,
                details=details
            )
            session.add(audit)
        else:
            audit.risk_score = round(combined_risk, 2)
            audit.severity = severity
            audit.details = details
            
        session.commit()
        logger.info("Successfully ran DEEPFAKE_SCAN audit for video %s, risk = %.2f", video_id, combined_risk)

        # 4. Check and update the global video status
        _check_and_update_video_status(session, video)
        
        return {"status": "completed", "risk_score": combined_risk}

    except Exception as exc:
        logger.exception("deepfake_scan task failed for video %s", video_id)
        raise self.retry(exc=exc, countdown=60)

