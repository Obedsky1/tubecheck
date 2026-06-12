"""Celery application configured with Redis broker and task routing."""

from __future__ import annotations

from celery import Celery
from celery.schedules import crontab

from app.config import get_settings

import logging

logger = logging.getLogger(__name__)
settings = get_settings()

if settings.SENTRY_DSN:
    try:
        import sentry_sdk
        from sentry_sdk.integrations.celery import CeleryIntegration
        sentry_sdk.init(
            dsn=settings.SENTRY_DSN,
            traces_sample_rate=1.0,
            integrations=[CeleryIntegration()],
            send_default_pii=True
        )
        logger.info("Sentry initialized for Celery worker.")
    except Exception as e:
        logger.warning(f"Failed to initialize Sentry for Celery: {e}")
broker_url = settings.REDIS_URL
result_backend = settings.CELERY_RESULT_BACKEND

# If using secure Redis (rediss://), Celery requires ssl_cert_reqs to be specified in the query params.
# We default to ssl_cert_reqs=CERT_NONE to work out-of-the-box with cloud Redis brokers like Upstash.
if broker_url.startswith("rediss://") and "ssl_cert_reqs" not in broker_url:
    separator = "&" if "?" in broker_url else "?"
    broker_url = f"{broker_url}{separator}ssl_cert_reqs=CERT_NONE"

if result_backend.startswith("rediss://") and "ssl_cert_reqs" not in result_backend:
    separator = "&" if "?" in result_backend else "?"
    result_backend = f"{result_backend}{separator}ssl_cert_reqs=CERT_NONE"

print(f"DEBUG CELERY: broker={broker_url} backend={result_backend}", flush=True)

celery_app = Celery(
    "shieldnetwork",
    broker=broker_url,
    backend=result_backend,
)

celery_app.conf.update(
    # Serialisation
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",

    # Reliability
    task_acks_late=True,
    worker_prefetch_multiplier=1,
    worker_max_tasks_per_child=100,

    # Timeouts
    task_soft_time_limit=300,
    task_time_limit=600,

    # Timezone
    timezone="UTC",
    enable_utc=True,

    # Task routing
    task_routes={
        "app.workers.script_audit.*": {"queue": "audit"},
        "app.workers.visual_audit.*": {"queue": "audit"},
        "app.workers.asset_audit.*": {"queue": "heavy"},
        "app.workers.voice_audit.*": {"queue": "heavy"},
        "app.workers.velocity_audit.*": {"queue": "default"},
    },

    # Beat Schedule (Cron Jobs)
    beat_schedule={
        "daily-network-sync": {
            "task": "app.workers.daily_network_sync",
            # Run exactly once a day at midnight UTC
            "schedule": crontab(hour=0, minute=0),
            "options": {"queue": "default"},
        },
    },
)

# Auto-discover task modules inside app.workers
celery_app.autodiscover_tasks(["app.workers"])

# Graceful fallback to eager mode if Redis is offline (for local dev without Docker/Redis)
try:
    import redis
    # Parse redis URL and ping it to check if it's running
    r = redis.Redis.from_url(settings.REDIS_URL, socket_connect_timeout=1.0)
    r.ping()
except Exception:
    import logging
    logging.getLogger("celery").warning(
        "Could not connect to Redis at %s. "
        "Enabling Celery Eager Mode (tasks will run synchronously inline).", 
        settings.REDIS_URL
    )
    celery_app.conf.update(
        task_always_eager=True,
        task_eager_propagates=True,
    )

    # Monkeypatch send_task to run eagerly in a background thread executor
    # when Redis is offline (task_always_eager=True). This prevents HTTP threads
    # from blocking or hanging on Redis/Celery broker connections.
    import concurrent.futures
    import uuid
    import importlib
    from celery.result import EagerResult

    executor = concurrent.futures.ThreadPoolExecutor(max_workers=4)
    original_send_task = celery_app.send_task

    def eager_send_task(name, args=None, kwargs=None, **options):
        if celery_app.conf.task_always_eager:
            task_id = str(uuid.uuid4())
            
            def run_task_in_background():
                # Attempt to register task if not loaded
                if name not in celery_app.tasks:
                    try:
                        parts = name.split('.')
                        if len(parts) >= 3 and parts[0] == "app" and parts[1] == "workers":
                            module_name = parts[2]
                            # Handle special cases where task name doesn't match file name
                            if module_name == "sync_channel":
                                module_name = "sync_worker"
                            elif module_name == "deepfake_scan":
                                module_name = "moderation_worker"
                            elif module_name == "transcribe_upload":
                                module_name = "transcript_worker"
                            importlib.import_module(f"app.workers.{module_name}")
                    except Exception as e:
                        logging.getLogger("celery").error(
                            "Failed to dynamically import module for task %s: %s", name, e
                        )
                
                if name in celery_app.tasks:
                    task = celery_app.tasks[name]
                    logging.getLogger("celery").info(
                        "Eagerly executing task %s (ID: %s) in background thread", name, task_id
                    )
                    try:
                        task.apply(args=args, kwargs=kwargs, task_id=task_id)
                        logging.getLogger("celery").info(
                            "Completed eager task %s (ID: %s)", name, task_id
                        )
                    except Exception as e:
                        logging.getLogger("celery").exception(
                            "Error in eager task %s (ID: %s): %s", name, task_id, e
                        )
                else:
                    logging.getLogger("celery").error(
                        "Task %s not found in registry even after dynamic import", name
                    )

            executor.submit(run_task_in_background)
            return EagerResult(task_id, None, "PENDING")

        return original_send_task(name, args=args, kwargs=kwargs, **options)

    celery_app.send_task = eager_send_task

# Explicitly import all task modules to register them with Celery at startup.
# This prevents dynamic import failures in eager mode and celery worker mode.
try:
    import app.workers.sync_worker
    import app.workers.transcript_worker
    import app.workers.moderation_worker
    import app.workers.visual_audit
    import app.workers.voice_audit
    import app.workers.velocity_audit
    import app.workers.asset_audit
    import app.workers.frame_worker
    import app.workers.script_audit
    import app.workers.semantic_audit
    import app.workers.thumbnail_worker
except Exception as e:
    import logging
    logging.getLogger("celery").error("Failed to import task modules: %s", e)


