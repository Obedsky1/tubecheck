from sqlalchemy import create_engine
from sqlalchemy.orm import Session
from app.config import get_settings
from app.models import Severity
import boto3
import os
import logging

logger = logging.getLogger(__name__)

def get_sync_db_session() -> Session:
    """Helper to retrieve a sync SQLAlchemy session from settings."""
    settings = get_settings()
    engine = create_engine(settings.DATABASE_URL_SYNC)
    return Session(engine)

def compute_severity(risk_score: float) -> Severity:
    """Maps a 0-100 risk score to a Severity enum."""
    if risk_score >= 80:
        return Severity.CRITICAL
    if risk_score >= 60:
        return Severity.HIGH
    if risk_score >= 40:
        return Severity.MEDIUM
    return Severity.LOW


def resolve_upload_path(video_id: str, expected_path: str) -> str | None:
    """
    Resolve the local file path for an uploaded video.

    In a single-container setup the file exists at ``expected_path``.
    On Railway (separate API + Worker containers) the file is NOT shared,
    so we fall back to downloading the bytes stored in Redis by the upload endpoint.

    Returns the local path if available, or None if the file cannot be recovered.
    """
    # Fast path: file already exists locally
    if os.path.exists(expected_path):
        return expected_path

    logger.warning(
        "Upload file not found locally at %s — attempting Redis recovery for %s",
        expected_path, video_id
    )

    try:
        import redis as redis_module
        settings = get_settings()
        r = redis_module.Redis.from_url(settings.REDIS_URL, ssl_cert_reqs=None)
        redis_key_base = f"upload:{video_id}"
        count_bytes = r.get(f"{redis_key_base}:count")

        # Write to local /tmp so the rest of the task can work normally
        import tempfile
        upload_dir = os.path.join(tempfile.gettempdir(), "shieldnetwork_uploads")
        os.makedirs(upload_dir, exist_ok=True)
        local_path = os.path.join(upload_dir, f"{video_id}.mp4")

        with open(local_path, "wb") as fh:
            if not count_bytes:
                # Fallback for older monolithic keys
                data = r.get(redis_key_base)
                if not data:
                    logger.error("No Redis cache entry found for upload:%s", video_id)
                    return None
                fh.write(data)
                logger.info("Recovered upload %s (monolithic) from Redis", video_id)
            else:
                chunk_count = int(count_bytes)
                total_bytes = 0
                for i in range(chunk_count):
                    chunk_data = r.get(f"{redis_key_base}:{i}")
                    if chunk_data:
                        fh.write(chunk_data)
                        total_bytes += len(chunk_data)
                    else:
                        logger.error("Missing chunk %d for upload %s", i, video_id)
                        return None
                logger.info("Recovered upload %s (chunked) from Redis: %d bytes", video_id, total_bytes)

        return local_path

    except Exception as exc:
        logger.error("Redis recovery failed for upload %s: %s", video_id, exc)
        return None


def upload_to_s3(local_path: str, s3_key: str) -> str:
    """Helper to upload a local media asset to configured Cloudflare R2 or S3 bucket."""
    settings = get_settings()
    
    # 1. Try Cloudflare R2 first if configured
    if settings.R2_BUCKET and settings.R2_ACCOUNT_ID:
        try:
            r2_endpoint = f"https://{settings.R2_ACCOUNT_ID}.r2.cloudflarestorage.com"
            s3 = boto3.client(
                's3',
                endpoint_url=r2_endpoint,
                aws_access_key_id=settings.R2_ACCESS_KEY_ID,
                aws_secret_access_key=settings.R2_SECRET_ACCESS_KEY,
                region_name="auto"
            )
            s3.upload_file(local_path, settings.R2_BUCKET, s3_key)
            if settings.R2_PUBLIC_URL:
                public_url = settings.R2_PUBLIC_URL.rstrip('/')
                return f"{public_url}/{s3_key}"
            return f"https://{settings.R2_BUCKET}.{settings.R2_ACCOUNT_ID}.r2.cloudflarestorage.com/{s3_key}"
        except Exception as e:
            print(f"Cloudflare R2 upload failed: {e}")
            return f"failed_r2_url://{s3_key}"

    # 2. Fallback to AWS S3
    if settings.S3_BUCKET:
        try:
            s3 = boto3.client(
                's3',
                region_name=settings.S3_REGION,
                aws_access_key_id=settings.S3_ACCESS_KEY,
                aws_secret_access_key=settings.S3_SECRET_KEY
            )
            s3.upload_file(local_path, settings.S3_BUCKET, s3_key)
            return f"https://{settings.S3_BUCKET}.s3.{settings.S3_REGION}.amazonaws.com/{s3_key}"
        except Exception as e:
            print(f"S3 upload failed: {e}")
            return f"failed_s3_url://{s3_key}"
            
    # 3. Fallback/mock
    return f"mock_media_url://{s3_key}"

