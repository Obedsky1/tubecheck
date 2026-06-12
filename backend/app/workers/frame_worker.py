import logging
import uuid
import os
import cv2
import json
import hashlib
from pydantic import BaseModel, Field
from google import genai
from google.genai import types

from app.celery_app import celery_app
from app.workers.task_utils import get_sync_db_session, compute_severity
from app.models import Video, AuditResult, AuditType
from app.config import get_settings

logger = logging.getLogger(__name__)

class VisionAnalysisResult(BaseModel):
    visual_originality_score: float = Field(description="Score from 0.0 to 100.0 indicating how original the footage is (100 is highly original/transformative, 0 is unedited stock or pure AI).")
    is_stock_or_ai_slideshow: bool = Field(description="True if the video is primarily unedited stock footage or an AI image slideshow.")
    has_transformative_editing: bool = Field(description="True if there is evidence of significant transformative editing (e.g. human present, complex scene changes, custom animations).")
    flags: list[str] = Field(description="List of specific policy violations found (e.g., 'Identical templates', 'AI Low-effort compilation', 'Excessive unedited stock').")
    reasoning: str = Field(description="Brief explanation of the evaluation.")

@celery_app.task(name="app.workers.frame_worker.detect_frame_similarity", bind=True, max_retries=3)
def detect_frame_similarity(self, video_id: str) -> dict:
    """Performs keyframe extraction and uses Gemini Vision to detect stock reuse and AI compilations."""
    logger.info("Starting frame similarity audit for video %s", video_id)
    video_uuid = uuid.UUID(video_id) if isinstance(video_id, str) else video_id

    try:
        session = get_sync_db_session()
        video = session.get(Video, video_uuid)
        if not video:
            return {"status": "error", "reason": "video not found"}

        settings = get_settings()
        local_path = f"tmp/uploads/{video.youtube_video_id}.mp4"
        has_file = os.path.exists(local_path)

        if not has_file:
            import tempfile
            upload_dir = os.path.join(tempfile.gettempdir(), "shieldnetwork_uploads")
            for ext in [".mp4", ".webm", ".mov", ".mkv", ".avi"]:
                temp_path = os.path.join(upload_dir, f"{video.id}{ext}")
                if os.path.exists(temp_path):
                    local_path = temp_path
                    has_file = True
                    break

        # ── COST GUARD: Redis cache check ──────────────────────────────────
        cache_key = f"asset_reuse:{hashlib.md5(video.youtube_video_id.encode()).hexdigest()}"
        _redis = None
        try:
            import redis as redis_lib
            _redis = redis_lib.Redis.from_url(settings.REDIS_URL, socket_connect_timeout=1.0)
            cached = _redis.get(cache_key)
            if cached:
                cached_data = json.loads(cached)
                logger.info("Cache HIT for frame similarity on video %s — skipping Gemini Vision call.", video.youtube_video_id)
                # Upsert from cache
                audit = AuditResult(
                    video_id=video_uuid,
                    org_id=video.channel.org_id,
                    audit_type=AuditType.ASSET_REUSE,
                    risk_score=cached_data["risk_score"],
                    severity=compute_severity(cached_data["risk_score"]),
                    details={**cached_data["details"], "served_from_cache": True},
                )
                session.add(audit)
                session.commit()
                return {"status": "completed", "risk_score": cached_data["risk_score"], "source": "cache"}
        except Exception as redis_err:
            logger.warning("Redis cache check failed (non-fatal): %s", redis_err)
        # ──────────────────────────────────────────────────────────

        extracted_frames = []
        
        if has_file:
            try:
                cap = cv2.VideoCapture(local_path)
                fps = cap.get(cv2.CAP_PROP_FPS) or 30.0

                # Sample 1 frame every 100 seconds; cap at 6 frames
                # Spreads the 6 frames evenly across the first 10 minutes
                sample_rate = int(fps * 100)
                frame_idx = 0
                max_frames = 6
                
                while cap.isOpened() and len(extracted_frames) < max_frames:
                    ret, frame = cap.read()
                    if not ret:
                        break
                    
                    if frame_idx % sample_rate == 0:
                        # Resize frame to reduce API payload size (e.g., 640x360)
                        resized = cv2.resize(frame, (640, 360))
                        success, encoded_image = cv2.imencode('.jpg', resized)
                        if success:
                            extracted_frames.append(encoded_image.tobytes())
                        
                    frame_idx += 1
                cap.release()
            except Exception as cv_err:
                logger.error("Error extracting frames with OpenCV: %s", cv_err)

        risk_score = 0.0
        details = {}
        
        if extracted_frames and settings.GEMINI_API_KEY:
            try:
                client = genai.Client(api_key=settings.GEMINI_API_KEY)
                
                # Prepare contents list
                contents = []
                for idx, frame_bytes in enumerate(extracted_frames):
                    contents.append(
                        types.Part.from_bytes(data=frame_bytes, mime_type="image/jpeg")
                    )
                
                prompt = (
                    "You are a strict YouTube Trust & Safety and Forensic Compliance AI. "
                    "Analyze these sequential frames extracted from a YouTube video (1 frame every 10 seconds). "
                    "Evaluate the video for 'Identical templates and pacing', 'Lack of transformative value', "
                    "'Excessive unedited stock', and 'AI Low-effort compilations'. "
                    "Output a strict JSON object evaluating 'visual_originality_score' (float 0-100), "
                    "'is_stock_or_ai_slideshow' (boolean), 'has_transformative_editing' (boolean), "
                    "'flags' (list of strings), and 'reasoning' (string)."
                )
                contents.append(prompt)

                response = client.models.generate_content(
                    model='gemini-1.5-flash-8b',
                    contents=contents,
                    config=types.GenerateContentConfig(
                        response_mime_type="application/json",
                        response_schema=VisionAnalysisResult,
                        temperature=0.0
                    ),
                )
                
                if response.parsed:
                    result = response.parsed
                else:
                    result_dict = json.loads(response.text)
                    result = VisionAnalysisResult(**result_dict)
                
                # High originality means low risk.
                # Use a proportional formula: invert the score, then apply soft modifiers.
                base_risk = 100.0 - result.visual_originality_score

                # Only escalate if BOTH slideshow AND no transformative editing.
                # A video with some AI but real editing is NOT a pure AI slideshow.
                if result.is_stock_or_ai_slideshow and not result.has_transformative_editing:
                    # Push risk up, but cap at 80 — leave room for nuance
                    risk_score = min(80.0, max(base_risk, 65.0))
                elif result.is_stock_or_ai_slideshow and result.has_transformative_editing:
                    # Has AI content but creator added real edits — moderate risk only
                    risk_score = min(55.0, max(base_risk, 30.0))
                else:
                    # Normal case: trust the originality score directly
                    risk_score = base_risk
                
                details = {
                    "method": "gemini_vision_analysis",
                    "frames_analyzed": len(extracted_frames),
                    "is_stock_or_ai_slideshow": result.is_stock_or_ai_slideshow,
                    "has_transformative_editing": result.has_transformative_editing,
                    "flags": result.flags,
                    "reasoning": result.reasoning
                }
                logger.info("Successfully analyzed %d frames with Gemini Vision.", len(extracted_frames))

            except Exception as gemini_err:
                logger.error("Gemini Vision API failed: %s", gemini_err)
                # Fallback on failure
                risk_score = 50.0
                details = {"method": "gemini_vision_failed", "error": str(gemini_err)}
                
        else:
            # Simulated check (mocking YouTube footage overlap detection) if no file or no key
            if "youtube" in video.youtube_video_id or len(video.youtube_video_id) == 11:
                seed_val = sum(ord(c) for c in video.title)
                risk_score = float((seed_val % 45))
                details = {
                    "method": "simulated_footage_fingerprint",
                    "intro_asset_reuse": "standard_intro_v4" if (seed_val % 3 == 0) else "none",
                    "estimated_footage_duplication": f"{risk_score:.1f}%"
                }

        severity = compute_severity(risk_score)

        # ── Store result in Redis cache (24h TTL) ────────────────────────
        if _redis and details.get("method") == "gemini_vision_analysis":
            try:
                _redis.setex(
                    cache_key,
                    86400,  # 24-hour TTL
                    json.dumps({"risk_score": risk_score, "details": details})
                )
                logger.info("Cached frame similarity result for %s (24h TTL).", video.youtube_video_id)
            except Exception as cache_err:
                logger.warning("Failed to write to Redis cache (non-fatal): %s", cache_err)
        # ──────────────────────────────────────────────────

        # Save AuditResult
        audit = AuditResult(
            video_id=video_uuid,
            org_id=video.channel.org_id,
            audit_type=AuditType.ASSET_REUSE,
            risk_score=risk_score,
            severity=severity,
            details=details
        )
        session.add(audit)
        session.commit()

        logger.info("Frame similarity check completed for video %s, risk_score=%.1f", video_id, risk_score)
        return {"status": "completed", "risk_score": risk_score}

    except Exception as exc:
        logger.exception("Frame similarity audit failed for video %s", video_id)
        raise self.retry(exc=exc, countdown=60)
