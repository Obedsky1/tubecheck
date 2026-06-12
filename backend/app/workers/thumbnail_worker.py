import logging
import uuid
import httpx
from app.celery_app import celery_app
from app.workers.task_utils import get_sync_db_session
from app.models import Video, ThumbnailFingerprint
from sqlalchemy import select
from PIL import Image
import io
import hashlib

logger = logging.getLogger(__name__)

@celery_app.task(name="app.workers.thumbnail_worker.fingerprint_thumbnail", bind=True, max_retries=3)
def fingerprint_thumbnail(self, video_id: str) -> dict:
    """Downloads video thumbnail and computes its perceptual hash (pHash) representation."""
    logger.info("Starting thumbnail fingerprinting for video %s", video_id)
    video_uuid = uuid.UUID(video_id) if isinstance(video_id, str) else video_id

    try:
        session = get_sync_db_session()
        video = session.get(Video, video_uuid)
        if not video or not video.thumbnail_url:
            return {"status": "error", "reason": "video or thumbnail not found"}

        # 1. Download thumbnail
        try:
            response = httpx.get(video.thumbnail_url, timeout=10.0)
            if response.status_code != 200:
                return {"status": "failed", "reason": f"http code {response.status_code}"}
            image_bytes = response.content
        except Exception as e:
            logger.error("Failed to download thumbnail: %s", e)
            return {"status": "failed", "reason": "download_failed"}

        # 2. Compute a robust average hash (aHash) in pure python/PIL
        try:
            img = Image.open(io.BytesIO(image_bytes)).convert('L').resize((8, 8), Image.Resampling.LANCZOS)
            pixels = list(img.getdata())
            avg = sum(pixels) / 64
            bits = "".join(["1" if p > avg else "0" for p in pixels])
            # Convert binary string to hex
            phash = f"{int(bits, 2):016x}"
        except Exception as hash_err:
            logger.error("Hash calculation failed: %s", hash_err)
            # Fallback to MD5
            phash = hashlib.md5(image_bytes).hexdigest()

        # 3. Save or update ThumbnailFingerprint
        stmt = select(ThumbnailFingerprint).where(ThumbnailFingerprint.video_id == video_uuid)
        fingerprint = session.scalar(stmt)
        
        if not fingerprint:
            fingerprint = ThumbnailFingerprint(
                video_id=video_uuid,
                phash=phash
            )
            session.add(fingerprint)
        else:
            fingerprint.phash = phash
            
        session.commit()
        logger.info("Successfully fingerprinted thumbnail for video %s: %s", video_id, phash)
        return {"status": "completed", "phash": phash}

    except Exception as exc:
        logger.exception("Thumbnail fingerprinting failed for video %s", video_id)
        raise self.retry(exc=exc, countdown=60)
