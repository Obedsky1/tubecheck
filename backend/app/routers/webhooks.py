from fastapi import APIRouter, Depends, HTTPException, Header, status
from app.config import get_settings
import logging

logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/webhooks",
    tags=["webhooks"]
)

@router.post("/daily-sync")
async def trigger_daily_sync(authorization: str = Header(None)):
    """
    Webhook designed to be triggered by Supabase pg_cron.
    Kicks off the daily network sync Celery tasks.
    """
    settings = get_settings()
    
    if not authorization:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing Authorization header"
        )
        
    scheme, _, token = authorization.partition(" ")
    if scheme.lower() != "bearer" or token != settings.WEBHOOK_SECRET:
        logger.warning("Failed webhook attempt. Invalid secret provided.")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid webhook secret"
        )

    try:
        # Trigger the task asynchronously using task_dispatcher to prevent direct imports of worker tasks
        from app.services.task_dispatcher import enqueue_task
        enqueue_task("app.workers.daily_network_sync", payload={}, queue="default")
        logger.info("Daily Network Sync webhook successfully triggered the background task.")
        return {"status": "success", "message": "Daily Network Sync dispatched."}
    except Exception as e:
        logger.exception("Failed to dispatch Daily Network Sync from webhook.")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Internal server error dispatching tasks"
        )
