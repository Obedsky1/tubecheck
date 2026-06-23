import logging
from fastapi import APIRouter, Request, HTTPException, Depends
from app.celery_app import celery_app
from app.config import get_settings
from google.oauth2 import id_token
from google.auth.transport import requests

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/tasks", tags=["cloud_tasks"])

def verify_cloud_tasks_token(request: Request):
    """
    Middleware to verify that the request came from Google Cloud Tasks.
    It checks the OIDC token in the Authorization header.
    """
    settings = get_settings()
    
    # If no OIDC email is configured, we assume we're in dev or running without strict auth
    if not settings.GCP_OIDC_SERVICE_ACCOUNT_EMAIL:
        return True

    auth_header = request.headers.get("Authorization")
    if not auth_header or not auth_header.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing or invalid Authorization header")

    token = auth_header.split(" ")[1]

    try:
        # Verify the OIDC token
        request_transport = requests.Request()
        claim = id_token.verify_oauth2_token(
            token, 
            request_transport,
            audience=settings.GCP_CLOUD_RUN_URL
        )

        if claim["email"] != settings.GCP_OIDC_SERVICE_ACCOUNT_EMAIL:
            logger.warning(f"Unauthorized task email: {claim['email']}")
            raise HTTPException(status_code=403, detail="Unauthorized service account")
            
        return claim
    except ValueError as e:
        logger.warning(f"Invalid OIDC token: {e}")
        raise HTTPException(status_code=401, detail="Invalid token")

@router.post("/{task_name:path}")
async def execute_task(task_name: str, request: Request, _auth=Depends(verify_cloud_tasks_token)):
    """
    Universal webhook endpoint that Google Cloud Tasks hits.
    It synchronously executes the Celery task in the current process.
    """
    payload = await request.json()
    logger.info("Executing Cloud Task natively: %s with payload %s", task_name, list(payload.keys()))
    
    # Ensure all tasks are registered by importing worker modules
    import app.workers.frame_worker
    import app.workers.moderation_worker
    import app.workers.transcript_worker
    import app.workers.sync_worker
    import app.workers.visual_audit
    
    if task_name not in celery_app.tasks:
        logger.error("Task %s not found in Celery registry.", task_name)
        raise HTTPException(status_code=404, detail=f"Task {task_name} not found")
        
    try:
        # Execute the task synchronously
        # Celery's .apply() executes the task immediately in the current thread/process
        result = celery_app.tasks[task_name].apply(kwargs=payload)
        
        if result.failed():
            # If the task threw an exception, return 500 so Cloud Tasks can retry it
            logger.error("Task %s failed: %s", task_name, result.result)
            raise HTTPException(status_code=500, detail=str(result.result))
            
        return {"status": "success", "result": result.result}
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Error executing task %s", task_name)
        # Cloud Tasks will retry based on its configuration if we return 500
        raise HTTPException(status_code=500, detail=str(e))
