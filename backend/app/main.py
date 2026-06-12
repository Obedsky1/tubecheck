"""FastAPI application entry-point with lifespan, middleware, and router registration."""

from __future__ import annotations

# Monkeypatch bcrypt to satisfy passlib requirements under Python 3.14+
try:
    import bcrypt
    if not hasattr(bcrypt, "__about__"):
        class About:
            __version__ = bcrypt.__version__
        bcrypt.__about__ = About()
except ImportError:
    pass

import logging
from contextlib import asynccontextmanager
from collections.abc import AsyncIterator

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import get_settings
from app.database import engine
from app.routers import (
    auth, audits, channels, dashboard, policy, velocity, remediation, niche_finder, subscriptions, payments, admin, appeals, webhooks
)

logger = logging.getLogger(__name__)
settings = get_settings()

# ── Sentry Error Tracking ─────────────────────────────────────────────────────
if settings.SENTRY_DSN:
    try:
        import sentry_sdk
        from sentry_sdk.integrations.fastapi import FastApiIntegration
        sentry_sdk.init(
            dsn=settings.SENTRY_DSN,
            integrations=[FastApiIntegration()],
            traces_sample_rate=0.1 if not settings.DEBUG else 1.0,
            environment="development" if settings.DEBUG else "production"
        )
        logger.info("Sentry SDK initialized successfully.")
    except Exception as e:
        logger.warning("Failed to initialize Sentry: %s", e)

@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    """Manage application startup and shutdown lifecycle."""
    logger.info("ShieldNetwork AI starting up…")
    
    # Production Security Audit
    if not settings.DEBUG:
        insecure_keys = {
            "your-secret-key-change-in-production",
            "change-me-in-production-use-a-secure-random-string",
            "local-dev-jwt-secret-key-that-is-long-enough-to-be-secure",
            "dev-secret-key-that-is-very-long",
            ""
        }
        if settings.JWT_SECRET_KEY in insecure_keys or len(settings.JWT_SECRET_KEY) < 32:
            err_msg = (
                "CRITICAL SECURITY FAILURE: JWT_SECRET_KEY is insecure, empty, or using a default "
                "development value in production. You must set a cryptographically secure key "
                "(e.g., generate one with 'openssl rand -hex 32') of at least 32 characters in your environment variables."
            )
            logger.critical(err_msg)
            raise ValueError(err_msg)
            
    yield
    logger.info("ShieldNetwork AI shutting down – disposing DB engine…")
    await engine.dispose()


app = FastAPI(
    title="ShieldNetwork AI",
    description=(
        "AI-powered backend for detecting content farms, script recycling, "
        "asset re-use, TTS fraud, and deepfakes across YouTube creator networks."
    ),
    version="1.0.0",
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url="/redoc",
)

# ── Prometheus Metrics ────────────────────────────────────────────────────────
if settings.PROMETHEUS_ENABLED:
    try:
        from prometheus_client import make_asgi_app
        metrics_app = make_asgi_app()
        app.mount("/metrics", metrics_app)
        logger.info("Prometheus metrics endpoint mounted at /metrics")
    except Exception as e:
        logger.warning("Failed to mount Prometheus metrics: %s", e)

# ── CORS ──────────────────────────────────────────────────────────────────────

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"] if settings.DEBUG else settings.CORS_ORIGINS,
    allow_credentials=not settings.DEBUG,  # credentials can't be used with wildcard origin
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Security Headers ──────────────────────────────────────────────────────────

@app.middleware("http")
async def add_security_headers(request, call_next):
    response = await call_next(request)
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-XSS-Protection"] = "1; mode=block"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    if not settings.DEBUG:
        response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
    return response

# ── Routers ───────────────────────────────────────────────────────────────────

app.include_router(auth.router, prefix="/api")
app.include_router(subscriptions.router, prefix="/api")
app.include_router(payments.router, prefix="/api")
app.include_router(channels.router, prefix="/api")
app.include_router(dashboard.router, prefix="/api")
app.include_router(audits.router, prefix="/api")
app.include_router(policy.router, prefix="/api")
app.include_router(velocity.router, prefix="/api")
app.include_router(remediation.router, prefix="/api")
app.include_router(niche_finder.router, prefix="/api")
app.include_router(appeals.router, prefix="/api")
app.include_router(admin.router, prefix="/api")
app.include_router(webhooks.router, prefix="/api")


# ── Health ────────────────────────────────────────────────────────────────────


@app.get("/api/health", tags=["health"])
async def health_check() -> dict[str, str]:
    """Simple liveness probe."""
    return {"status": "healthy", "service": "ShieldNetwork AI", "version": "1.0.0"}


