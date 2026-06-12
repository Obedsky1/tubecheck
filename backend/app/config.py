"""Application configuration loaded from environment variables via pydantic-settings."""

from __future__ import annotations

import json
from functools import lru_cache
from typing import Any

from pydantic import field_validator, ValidationInfo
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Central configuration object – values are read from the `.env` file
    next to the project root and can be overridden by real env vars."""

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    # ── Database ──────────────────────────────────────────────────────────
    DATABASE_URL: str = "postgresql+asyncpg://postgres:password@localhost:5432/shieldnetwork"
    DATABASE_URL_SYNC: str = "postgresql://postgres:password@localhost:5432/shieldnetwork"

    # ── Redis / Celery ────────────────────────────────────────────────────
    REDIS_URL: str = "redis://localhost:6379/0"
    CELERY_RESULT_BACKEND: str = "redis://localhost:6379/1"

    # ── JWT ────────────────────────────────────────────────────────────────
    JWT_SECRET_KEY: str = "your-secret-key-change-in-production"
    SUPABASE_JWT_SECRET: str = ""
    JWT_ALGORITHM: str = "HS256"
    JWT_EXPIRATION_MINUTES: int = 1440

    # ── YouTube Data API v3 ───────────────────────────────────────────────
    YOUTUBE_API_KEY: str = ""
    GOOGLE_CLIENT_ID: str = ""
    GOOGLE_CLIENT_SECRET: str = ""
    GEMINI_API_KEY: str = ""
    OPENAI_API_KEY: str = ""

    # ── Deepgram ──────────────────────────────────────────────────────────
    DEEPGRAM_API_KEY: str = ""

    # ── Sightengine Content Moderation ────────────────────────────────────
    SIGHTENGINE_API_USER: str = ""
    SIGHTENGINE_API_SECRET: str = ""

    # ── ElevenLabs ────────────────────────────────────────────────────────
    ELEVENLABS_API_KEY: str = ""

    # ── Embeddings ────────────────────────────────────────────────────────
    EMBEDDING_PROVIDER: str = "local"  # "local" or "openai"

    # ── Flutterwave ───────────────────────────────────────────────────────
    FLUTTERWAVE_SECRET_KEY: str = ""
    FLUTTERWAVE_WEBHOOK_SECRET: str = ""

    # ── Monitoring & Logging ──────────────────────────────────────────────
    SENTRY_DSN: str = ""
    PROMETHEUS_ENABLED: bool = True

    # ── Webhooks ──────────────────────────────────────────────────────────
    WEBHOOK_SECRET: str = "cs_dev_webhook_secret_123"

    # ── YouTube Quotas ────────────────────────────────────────────────────
    YOUTUBE_DAILY_QUOTA: int = 10000

    # ── S3 / Supabase Storage ─────────────────────────────────────────────
    S3_BUCKET: str = ""
    S3_REGION: str = "us-east-1"
    S3_ACCESS_KEY: str = ""
    S3_SECRET_KEY: str = ""

    # ── Cloudflare R2 Storage ─────────────────────────────────────────────
    R2_ACCOUNT_ID: str = ""
    R2_ACCESS_KEY_ID: str = ""
    R2_SECRET_ACCESS_KEY: str = ""
    R2_BUCKET: str = ""
    R2_PUBLIC_URL: str = ""

    # ── Application ───────────────────────────────────────────────────────
    APP_NAME: str = "ShieldNetwork AI"
    DEBUG: bool = True
    CORS_ORIGINS: list[str] = ["http://localhost:3000"]

    @field_validator("CORS_ORIGINS", mode="before")
    @classmethod
    def parse_cors_origins(cls, value: Any) -> list[str]:
        """Accept either a JSON-encoded string or a plain list."""
        if isinstance(value, str):
            try:
                parsed = json.loads(value)
                if isinstance(parsed, list):
                    return parsed
            except (json.JSONDecodeError, TypeError):
                return [origin.strip() for origin in value.split(",") if origin.strip()]
        return value  # type: ignore[return-value]

    @field_validator("DATABASE_URL_SYNC", mode="before")
    @classmethod
    def parse_database_url_sync(cls, value: Any, info: ValidationInfo) -> str:
        """Derive synchronous database URL from asynchronous database URL if not explicitly set."""
        db_url = info.data.get("DATABASE_URL")
        default_sync = "postgresql://postgres:password@localhost:5432/shieldnetwork"
        default_async = "postgresql+asyncpg://postgres:password@localhost:5432/shieldnetwork"
        
        if (not value or value == default_sync) and db_url and db_url != default_async:
            if "://" in db_url:
                scheme, remainder = db_url.split("://", 1)
                if "+" in scheme:
                    scheme = scheme.split("+")[0]
                return f"{scheme}://{remainder}"
        return value or default_sync


@lru_cache
def get_settings() -> Settings:
    """Return a cached singleton of the application settings."""
    return Settings()
