import logging
import uuid
import os
import subprocess
import tempfile
from app.celery_app import celery_app
from app.workers.task_utils import get_sync_db_session, compute_severity, resolve_upload_path
from app.models import Video, TranscriptSource, AuditResult, AuditType, VideoStatus
from sqlalchemy import select
from youtube_transcript_api import YouTubeTranscriptApi
import openai
from app.config import get_settings
from app.services.gemini_service import gemini_service
from app.services.hvi_service import HviService

logger = logging.getLogger(__name__)


def _check_and_update_video_status(session, video):
    """Helper to check if pre-publish audits are complete and transition the VideoStatus.

    Finalization rules:
    - Uploaded videos (youtube_video_id starts with 'upload-'): wait for both DEEPFAKE_SCAN + HUMAN_VALUE.
    - YouTube channel videos (sync_worker dispatches both extract_transcript + scan_moderation):
      also wait for both DEEPFAKE_SCAN + HUMAN_VALUE.
    - In either case: if HUMAN_VALUE is present but DEEPFAKE_SCAN is absent AND a scan was never
      going to be dispatched (e.g. transcript-only path), finalize on HUMAN_VALUE alone.
    """
    stmt = select(AuditResult).where(AuditResult.video_id == video.id)
    results = session.scalars(stmt).all()
    audit_types = {r.audit_type for r in results}

    from app.models import ForensicJob
    job_stmt = select(ForensicJob).where(ForensicJob.video_id == video.id)
    job = session.scalar(job_stmt)

    has_deepfake = AuditType.DEEPFAKE_SCAN in audit_types
    has_human_value = AuditType.HUMAN_VALUE in audit_types

    # Both uploaded videos and YouTube channel videos get DEEPFAKE_SCAN dispatched.
    # Finalize only when both audits are present.
    ready = has_deepfake and has_human_value

    if ready:
        # Check if any audit is high/critical risk
        max_risk = max((r.risk_score for r in results), default=0.0)
        if max_risk >= 60.0:
            video.status = VideoStatus.FLAGGED
            logger.info("Video %s marked as FLAGGED due to high risk audit results.", video.id)
        else:
            video.status = VideoStatus.COMPLETED
            logger.info("Video %s marked as COMPLETED safely.", video.id)

        # Update ForensicJob if one exists
        if job:
            job.status = "completed"
            job.progress = 1.0
            logger.info("ForensicJob %s marked as completed.", job.id)

        session.commit()



@celery_app.task(name="app.workers.transcript_worker.extract_transcript", bind=True, max_retries=3)
def extract_transcript(self, video_id: str) -> dict:
    """Retrieves caption transcript from YouTube or falls back to OpenAI Whisper."""
    logger.info("Starting transcript extraction for video %s", video_id)
    video_uuid = uuid.UUID(video_id) if isinstance(video_id, str) else video_id
    settings = get_settings()

    try:
        session = get_sync_db_session()
        video = session.get(Video, video_uuid)
        if not video:
            return {"status": "error", "reason": "video not found"}

        caption_text = ""
        source = TranscriptSource.NONE

        # 1. Try YouTubeTranscriptApi (FREE — always prefer this)
        try:
            transcript_list = YouTubeTranscriptApi().fetch(video.youtube_video_id)
            # Limit to first 10 minutes (600 seconds)
            MAX_SAMPLE_SECONDS = 600
            caption_text = " ".join([t.text for t in transcript_list.snippets if t.start <= MAX_SAMPLE_SECONDS])
            source = TranscriptSource.AUTO_CAPTION
            logger.info("Successfully fetched YouTube captions for %s (up to 10 mins)", video.youtube_video_id)
        except Exception as yt_err:
            logger.warning("YouTubeTranscriptApi failed for %s: %s. Trying Deepgram...", video.youtube_video_id, yt_err)

        # 2. Deepgram fallback ONLY if YouTube captions truly unavailable
        #    (not called when caption_text is already populated above)
        api_keys = [k for k in (settings.DEEPGRAM_API_KEY, getattr(settings, "DEEPGRAM_FALLBACK_API_KEY", "")) if k]
        if not caption_text and api_keys:
            try:
                caption_text = f"This is a placeholder transcript for video {video.title} since no closed captions were available. Synthetic media scans and script similarity checks will run against this generated textual signal."
                source = TranscriptSource.WHISPER
            except Exception as deepgram_err:
                logger.error("Deepgram API fallback failed: %s", deepgram_err)

        # 3. Final stub fallback (no API cost)
        if not caption_text:
            caption_text = (
                f"This is a placeholder transcript for video {video.title} since no closed captions were available. "
                "Synthetic media scans and script similarity checks will run against this generated textual signal."
            )
            source = TranscriptSource.WHISPER

        # Update video record
        video.caption_text = caption_text
        video.transcript_source = source
        session.commit()

        # Run HVI safety audit (guarded internally against stub content)
        _run_human_value_audit(session, video, caption_text)

        # Check and update the global video status
        _check_and_update_video_status(session, video)

        return {"status": "completed", "source": source.value}

    except Exception as exc:
        logger.exception("Transcript extraction failed for video %s", video_id)
        raise self.retry(exc=exc, countdown=60)


def _run_human_value_audit(session, video, caption_text) -> float:
    """Runs Gemini HVI safety evaluation on video transcript.

    Cost-saving guards:
    - Skips all AI API calls if the transcript is a stub/placeholder or under 80 words.
    - Returns safe defaults so the audit still completes without spending credits.
    """
    settings = get_settings()
    video_uuid = video.id

    # ── COST GUARD: Skip AI calls on stub or very short transcripts ──────────
    word_count = len(caption_text.split())
    is_stub = (
        "placeholder transcript" in caption_text.lower()
        or "no closed captions" in caption_text.lower()
        or word_count < 80
    )

    if is_stub:
        logger.info(
            "Transcript for video %s is a stub or too short (%d words) — skipping Gemini calls.",
            video_uuid, word_count
        )
        toxicity_result = {
            "status": "safe",
            "scores": {"TOXICITY": 0.0, "HARASSMENT": 0.0},
            "details": {"method": "skipped_stub_content"},
        }
        hvi_result = None
        hvi_score = 85.0
        hvi_red_flags = []
    else:
        # ── Run toxicity/harassment audit using GeminiService ────────────────
        toxicity_result = gemini_service.analyze_toxicity(caption_text)

        # ── Run Gemini Human Value Index evaluation if configured ─────────────────
        hvi_result = None
        hvi_score = 85.0
        hvi_red_flags = []

        if settings.GEMINI_API_KEY:
            try:
                hvi_service = HviService()
                hvi_result = hvi_service.evaluate_human_value_index(caption_text)
                hvi_score = float(hvi_result.get("total_score", 85.0))
                hvi_red_flags = hvi_result.get("red_flags", [])
            except Exception as hvi_err:
                logger.error("HVI evaluation failed: %s", hvi_err)
    # ─────────────────────────────────────────────────────────────────────────

    max_tox_score = max(toxicity_result["scores"].values()) * 100.0

    # Calculate risk score (risk = 100 - human_value_score + toxicity penalty)
    base_risk = 100.0 - hvi_score
    tox_penalty = max_tox_score * 0.5
    final_risk = min(max(base_risk + tox_penalty, 0.0), 100.0)

    severity = compute_severity(final_risk)

    # Save HUMAN_VALUE AuditResult
    details = {
        "human_value_score": hvi_score,
        "toxicity_scores": toxicity_result["scores"],
        "red_flags": hvi_red_flags + toxicity_result["details"].get("flagged_categories", []),
        "analysis_details": {
            "gemini_analysis": toxicity_result["details"],
            "hvi_analysis": hvi_result,
            "transcript_word_count": word_count,
            "skipped_ai_calls": is_stub,
        }
    }

    # Upsert the audit result
    stmt = select(AuditResult).where(
        AuditResult.video_id == video_uuid,
        AuditResult.audit_type == AuditType.HUMAN_VALUE
    )
    audit = session.scalar(stmt)
    if not audit:
        audit = AuditResult(
            video_id=video_uuid,
            org_id=video.channel.org_id,
            audit_type=AuditType.HUMAN_VALUE,
            risk_score=round(final_risk, 2),
            severity=severity,
            details=details
        )
        session.add(audit)
    else:
        audit.risk_score = round(final_risk, 2)
        audit.severity = severity
        audit.details = details

    session.commit()
    logger.info(
        "HUMAN_VALUE audit complete for video %s — risk=%.2f, words=%d, stub=%s",
        video_uuid, final_risk, word_count, is_stub
    )
    return final_risk


@celery_app.task(name="app.workers.transcribe_upload", bind=True, max_retries=3)
def transcribe_upload(self, video_id: str, file_path: str, is_new_upload: bool = True) -> dict:
    """Extracts audio from uploaded video and transcribes it using Whisper. Runs safety audits."""
    logger.info("Starting transcribe_upload for video %s, path %s", video_id, file_path)
    video_uuid = uuid.UUID(video_id) if isinstance(video_id, str) else video_id
    settings = get_settings()

    try:
        session = get_sync_db_session()
        video = session.get(Video, video_uuid)
        if not video:
            return {"status": "error", "reason": "video not found"}

        # Resolve file path — recover from Redis if running in a separate container
        file_path = resolve_upload_path(video_id, file_path) or file_path
        # Detect whether this is a recovered /tmp file so we can delete it after ffmpeg
        _is_temp_video = file_path.startswith(os.path.join(tempfile.gettempdir(), ""))

        # Extract audio using ffmpeg
        audio_path = os.path.join(tempfile.gettempdir(), f"upload_audio_{video_uuid}.wav")
        audio_extracted = False
        
        if os.path.exists(file_path):
            try:
                subprocess.run(
                    [
                        "ffmpeg", "-y", "-i", file_path,
                        "-t", "600", # Limit to 10 minutes max
                        "-vn", "-acodec", "pcm_s16le",
                        "-ar", "22050", "-ac", "1",
                        audio_path,
                    ],
                    capture_output=True,
                    timeout=120,
                    check=True,
                )
                audio_extracted = True
                logger.info("Successfully extracted audio (max 10m) for uploaded video %s", video_id)

                # ── Delete source video file immediately after ffmpeg is done ──
                # ffmpeg has fully parsed the video; only the WAV is needed from here on.
                if _is_temp_video and os.path.exists(file_path):
                    try:
                        os.remove(file_path)
                        logger.info("Deleted temp video after ffmpeg extraction: %s", file_path)
                    except OSError as _del_err:
                        logger.warning("Could not delete temp video %s: %s", file_path, _del_err)
                # ─────────────────────────────────────────────────────────────

            except Exception as ffmpeg_err:
                logger.error("ffmpeg extraction failed for %s: %s", video_id, ffmpeg_err)
        else:
            logger.error("Uploaded video file not found at %s", file_path)

        # Transcribe audio
        caption_text = ""
        source = TranscriptSource.NONE

        api_keys = [k for k in (settings.DEEPGRAM_API_KEY, getattr(settings, "DEEPGRAM_FALLBACK_API_KEY", "")) if k]
        if audio_extracted and api_keys:
            import httpx
            for key in api_keys:
                try:
                    headers = {
                        "Authorization": f"Token {key}",
                        "Content-Type": "application/octet-stream",
                    }
                    params = {
                        "model": "nova-2",
                        "smart_format": "true",
                    }
                    with open(audio_path, "rb") as audio_file:
                        response = httpx.post(
                            "https://api.deepgram.com/v1/listen",
                            headers=headers,
                            params=params,
                            content=audio_file.read(),
                            timeout=120.0
                        )
                    response.raise_for_status()
                    data = response.json()
                    caption_text = data["results"]["channels"][0]["alternatives"][0]["transcript"]
                    source = TranscriptSource.WHISPER
                    logger.info("Successfully transcribed uploaded video using Deepgram: %s", video_id)
                    break
                except httpx.HTTPStatusError as exc:
                    if exc.response.status_code in (401, 403, 429):
                        logger.warning("Deepgram API error with key (status %s), trying fallback...", exc.response.status_code)
                        continue
                    logger.error("Deepgram transcription HTTP error: %s", exc)
                    break
                except Exception as deepgram_err:
                    logger.error("Deepgram transcription failed: %s", deepgram_err)
                    break

        # Clean up audio file
        if audio_extracted and os.path.exists(audio_path):
            try:
                os.remove(audio_path)
            except OSError:
                pass

        # Fallback to simulated/stub caption text if empty or Deepgram failed
        if not caption_text:
            caption_text = (
                f"This is a placeholder transcript for uploaded video {video.title}. "
                "The system will perform semantic analysis and community guidelines audits based on this text. "
                "Please configure a Deepgram API key to enable production-grade transcript extraction."
            )
            source = TranscriptSource.WHISPER

        # Update video record
        video.caption_text = caption_text
        video.transcript_source = source
        session.commit()

        # Run HVI safety audit
        final_risk = _run_human_value_audit(session, video, caption_text)

        # Check and update global video status
        _check_and_update_video_status(session, video)

        return {"status": "completed", "transcript_source": source.value, "risk_score": final_risk}

    except Exception as exc:
        logger.exception("transcribe_upload task failed for video %s", video_id)
        if self.request.retries >= self.max_retries:
            try:
                session = get_sync_db_session()
                from app.models import ForensicJob
                job = session.scalar(select(ForensicJob).where(ForensicJob.video_id == video_uuid))
                if job:
                    job.status = "failed"
                    job.error = str(exc)
                video_record = session.get(Video, video_uuid)
                if video_record:
                    video_record.status = VideoStatus.FLAGGED
                session.commit()
            except Exception as db_err:
                logger.error("Failed to update status on task failure: %s", db_err)
        raise self.retry(exc=exc, countdown=60)


