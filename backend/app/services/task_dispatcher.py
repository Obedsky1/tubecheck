import json
import logging
from app.config import get_settings

logger = logging.getLogger(__name__)

def enqueue_task(task_name: str, payload: dict, queue: str = "default") -> None:
    """
    Enqueues a task. If GCP_PROJECT_ID is configured, dispatches an HTTP POST
    to Google Cloud Tasks. Otherwise, falls back to Celery (for local dev).
    """
    settings = get_settings()

    if settings.GCP_PROJECT_ID and settings.GCP_CLOUD_RUN_URL:
        # Import dynamically so we don't crash if google-cloud-tasks isn't installed locally
        from google.cloud import tasks_v2
        
        client = tasks_v2.CloudTasksClient()
        
        parent = client.queue_path(
            settings.GCP_PROJECT_ID,
            settings.GCP_REGION,
            settings.GCP_CLOUD_TASKS_QUEUE
        )

        # The webhook URL on our Cloud Run instance
        url = f"{settings.GCP_CLOUD_RUN_URL.rstrip('/')}/api/tasks/{task_name}"

        task = {
            "http_request": {
                "http_method": tasks_v2.HttpMethod.POST,
                "url": url,
                "headers": {"Content-type": "application/json"},
                "body": json.dumps(payload).encode(),
            }
        }

        # Add OIDC token for secure authentication
        if settings.GCP_OIDC_SERVICE_ACCOUNT_EMAIL:
            task["http_request"]["oidc_token"] = {
                "service_account_email": settings.GCP_OIDC_SERVICE_ACCOUNT_EMAIL,
                "audience": settings.GCP_CLOUD_RUN_URL,
            }

        try:
            response = client.create_task(request={"parent": parent, "task": task})
            logger.info("Enqueued Google Cloud Task %s for %s", response.name, task_name)
        except Exception as e:
            logger.error("Failed to enqueue Google Cloud Task %s: %s", task_name, e)
    else:
        # Fallback to Celery
        from app.celery_app import celery_app
        logger.info("Enqueued Celery Task %s with payload %s", task_name, list(payload.keys()))
        celery_app.send_task(task_name, kwargs=payload, queue=queue)
