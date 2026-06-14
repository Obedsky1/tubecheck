"""Celery application configured with Redis broker and task routing."""

from __future__ import annotations

from celery import Celery
from celery.schedules import crontab

from app.config import get_settings

import logging

logger = logging.getLogger(__name__)
settings = get_settings()

# Start a background HTTP health check server for Railway if running as Celery worker
import sys
import os
import threading
from http.server import BaseHTTPRequestHandler, HTTPServer

if any("celery" in arg.lower() for arg in sys.argv):
    # Dynamically limit concurrency/autoscale to prevent OOM on 1GB RAM instances.
    # Read cap from env (set CELERYD_CONCURRENCY=2 in Railway), default to 2.
    _max_concurrency = int(os.environ.get("CELERYD_CONCURRENCY", "2"))
    _max_concurrency = min(_max_concurrency, 2)  # hard cap at 2 regardless
    
    # Strip all existing concurrency/autoscale flags, then inject our cap
    new_argv = []
    skip_next = False
    for i, arg in enumerate(sys.argv):
        if skip_next:
            skip_next = False
            continue
        if arg.startswith("--autoscale=") or arg == "--autoscale":
            if arg == "--autoscale":
                skip_next = True  # skip the value too
            continue  # drop the autoscale flag entirely
        elif arg in ("-c", "--concurrency"):
            skip_next = True  # skip the value
            continue  # drop it; we'll add our own below
        elif arg.startswith("--concurrency="):
            continue  # drop it
        else:
            new_argv.append(arg)
    # Inject our hard cap
    new_argv.append(f"--concurrency={_max_concurrency}")
    sys.argv = new_argv
    logger.info(f"[celery_app] Overrode worker argv (concurrency={_max_concurrency}): {sys.argv}")
                
    class HealthCheckHandler(BaseHTTPRequestHandler):
        def do_GET(self):
            if self.path in ("/", "/health", "/api/health"):
                self.send_response(200)
                self.send_header("Content-Type", "application/json")
                self.end_headers()
                self.wfile.write(b'{"status":"healthy","service":"celery-worker"}')
            else:
                self.send_response(404)
                self.end_headers()

        def log_message(self, format, *args):
            # Suppress default logging to keep worker output clean
            pass

    def start_health_server():
        port = int(os.environ.get("PORT", 8000))
        logger.info(f"Starting Celery background health check server on port {port}...")
        try:
            server = HTTPServer(("0.0.0.0", port), HealthCheckHandler)
            server.serve_forever()
        except Exception as e:
            logger.warning(f"Celery background health check server warning (port may be in use): {e}")

    t = threading.Thread(target=start_health_server, daemon=True)
    t.start()


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
import ssl

broker_ssl_context = None
backend_ssl_context = None

if settings.REDIS_URL.startswith("rediss://"):
    broker_ssl_context = {
        "ssl_cert_reqs": ssl.CERT_NONE
    }

if settings.CELERY_RESULT_BACKEND.startswith("rediss://"):
    backend_ssl_context = {
        "ssl_cert_reqs": "CERT_NONE"
    }

celery_app = Celery(
    "shieldnetwork",
    broker=settings.REDIS_URL,
    backend=settings.CELERY_RESULT_BACKEND,
)

celery_app.conf.update(
    broker_use_ssl=broker_ssl_context,
    redis_backend_use_ssl=backend_ssl_context,

    # Serialisation
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",

    # Reliability
    task_acks_late=True,
    worker_prefetch_multiplier=1,
    worker_max_tasks_per_child=100,

    # Concurrency cap: prevent OOM on 1GB Railway containers
    # Reads CELERYD_CONCURRENCY env var, capped at 2
    worker_concurrency=min(int(os.environ.get("CELERYD_CONCURRENCY", "2")), 2),

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


