from sqlalchemy import create_engine
from sqlalchemy.orm import Session
from app.config import get_settings
from app.models import Severity
import boto3
import os

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
