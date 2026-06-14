#!/usr/bin/env python3
"""
Custom Celery worker entry-point for Railway deployment.

Intercepts sys.argv BEFORE Celery imports and parses it,
replacing any --autoscale flag with a hard --concurrency=2 cap
to prevent OOM crashes on Railway's 1GB containers.

Usage (Railway start command):
    python worker_start.py worker -A app.celery_app.celery_app -l INFO -Q default,audit,heavy
"""
import sys
import os

def sanitize_argv():
    """Strip autoscale/concurrency flags and inject our safe concurrency cap."""
    max_concurrency = int(os.environ.get("CELERYD_CONCURRENCY", "2"))
    max_concurrency = min(max_concurrency, 2)  # hard cap at 2

    new_argv = []
    skip_next = False
    for i, arg in enumerate(sys.argv):
        if skip_next:
            skip_next = False
            continue
        if arg.startswith("--autoscale=") or arg == "--autoscale":
            if arg == "--autoscale":
                skip_next = True
            continue  # drop autoscale entirely
        elif arg in ("-c", "--concurrency"):
            skip_next = True
            continue  # drop; we add our own below
        elif arg.startswith("--concurrency="):
            continue  # drop
        else:
            new_argv.append(arg)

    # Add our safe concurrency cap
    new_argv.append(f"--concurrency={max_concurrency}")
    sys.argv = new_argv
    print(f"[worker_start] Sanitized argv (concurrency={max_concurrency}): {sys.argv}", flush=True)

# Run BEFORE any Celery imports
sanitize_argv()

# Now import and run Celery's worker command
from celery.bin.celery import main as celery_main
celery_main()
