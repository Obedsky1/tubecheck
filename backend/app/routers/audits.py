"""Audit management routes – run audits, fetch results, upload for pre-publish scan."""

from __future__ import annotations

import logging
import uuid

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, UploadFile, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models import AuditResult, AuditType, Organization, User, Video, VideoStatus, Channel, ForensicJob, ChannelStatus, CreditLedger, PlanTier
from app.routers.auth import get_current_user
from app.schemas import AuditResultResponse, AuditRunRequest, AuditRunResponse, UploadResponse

router = APIRouter(prefix="/audits", tags=["audits"])
logger = logging.getLogger(__name__)


# Mapping from AuditType to Celery task name
_AUDIT_TASK_MAP: dict[AuditType, str] = {
    AuditType.SCRIPT_SIMILARITY: "app.workers.script_audit.run_script_audit",
    AuditType.VISUAL_SIMILARITY: "app.workers.visual_audit.run_visual_audit",
    AuditType.ASSET_REUSE: "app.workers.asset_audit.run_asset_audit",
    AuditType.VOICE_FORENSIC: "app.workers.voice_audit.run_voice_audit",
    AuditType.VELOCITY_ANOMALY: "app.workers.velocity_audit.run_velocity_audit",
}


@router.post("/run", response_model=AuditRunResponse)
async def run_audits(
    body: AuditRunRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    """Dispatch one or more audit tasks for an organization.

    Each requested audit type spawns a background Celery task. Returns the
    Celery task IDs so the client can poll for completion.
    """
    # Verify org ownership
    org_check = await db.execute(
        select(Organization.id).where(
            Organization.id == body.org_id,
            Organization.owner_id == current_user.id,
        )
    )
    if org_check.scalar_one_or_none() is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Organization not found or access denied")

    from app.celery_app import celery_app

    dispatched: list[dict[str, str]] = []
    for audit_type in body.audit_types:
        task_name = _AUDIT_TASK_MAP.get(audit_type)
        if task_name is None:
            dispatched.append({
                "audit_type": audit_type.value,
                "task_id": "unsupported",
                "status": "skipped – no background task registered",
            })
            continue

        result = celery_app.send_task(task_name, args=[str(body.org_id)])
        dispatched.append({
            "audit_type": audit_type.value,
            "task_id": result.id,
            "status": "dispatched",
        })

    return {
        "org_id": body.org_id,
        "dispatched_tasks": dispatched,
        "message": "Audit tasks dispatched successfully",
    }


@router.get("/{org_id}/results", response_model=list[AuditResultResponse])
async def get_audit_results(
    org_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    audit_type: AuditType | None = Query(None, description="Filter by audit type"),
    page: int = Query(1, ge=1),
    page_size: int = Query(25, ge=1, le=100),
) -> list[AuditResult]:
    """Get paginated audit results for an organization, optionally filtered by type."""
    # Verify access
    org_check = await db.execute(
        select(Organization.id).where(
            Organization.id == org_id,
            Organization.owner_id == current_user.id,
        )
    )
    if org_check.scalar_one_or_none() is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Organization not found")

    query = select(AuditResult).where(AuditResult.org_id == org_id)
    if audit_type is not None:
        query = query.where(AuditResult.audit_type == audit_type)

    query = query.order_by(AuditResult.created_at.desc())
    offset = (page - 1) * page_size
    query = query.offset(offset).limit(page_size)

    result = await db.execute(query)
    return list(result.scalars().all())


@router.get("/{video_id}/detail", response_model=list[AuditResultResponse])
async def get_video_audit_detail(
    video_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[AuditResult]:
    """Get all audit results for a specific video."""
    # Verify the video exists and the user has access via org ownership
    video_result = await db.execute(select(Video).where(Video.id == video_id))
    video = video_result.scalar_one_or_none()
    if video is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Video not found")

    ch_result = await db.execute(select(Channel).where(Channel.id == video.channel_id))
    channel = ch_result.scalar_one_or_none()
    if channel is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Channel not found")

    org_check = await db.execute(
        select(Organization.id).where(
            Organization.id == channel.org_id,
            Organization.owner_id == current_user.id,
        )
    )
    if org_check.scalar_one_or_none() is None:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")

    result = await db.execute(
        select(AuditResult)
        .where(AuditResult.video_id == video_id)
        .order_by(AuditResult.created_at.desc())
    )
    return list(result.scalars().all())


from app.rate_limiter import RateLimit

@router.post("/upload", response_model=UploadResponse, status_code=status.HTTP_202_ACCEPTED, dependencies=[Depends(RateLimit(10, 3600))])
async def upload_video_for_audit(
    org_id: str = Form(...),
    title: str = Form(...),
    description: str = Form(""),
    upload_type: str = Form("independent"),
    channel_id: str | None = Form(None),
    scans: str = Form("deepfake,transcript,visual"),
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    """Accept a video file for pre-publish audit.

    The uploaded file is saved locally and a full audit pipeline is dispatched:
    Whisper transcription → GPT Human Value Index → all local audits.
    """
    org_uuid = uuid.UUID(org_id)

    # Verify org ownership
    org_check = await db.execute(
        select(Organization).where(
            Organization.id == org_uuid,
            Organization.owner_id == current_user.id,
        )
    )
    org = org_check.scalar_one_or_none()
    if org is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Organization not found")

    # Verify credit balance
    if org.available_credits < 1 and org.plan_tier not in [PlanTier.PRO, PlanTier.ENTERPRISE]:
        raise HTTPException(
            status_code=status.HTTP_402_PAYMENT_REQUIRED,
            detail="Insufficient credits. Please top up or upgrade your plan."
        )

    # Enforce maximum file upload size (e.g. 150MB) to prevent OOM
    MAX_FILE_SIZE = 150 * 1024 * 1024 # 150MB
    file.file.seek(0, 2)
    file_size = file.file.tell()
    file.file.seek(0) # Reset pointer
    
    if file_size > MAX_FILE_SIZE:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=f"File size ({file_size / (1024 * 1024):.1f}MB) exceeds the 150MB limit."
        )

    # Validate file type
    allowed_types = {
        "video/mp4", "video/webm", "video/quicktime",
        "video/x-msvideo", "video/x-matroska",
    }
    if file.content_type not in allowed_types:
        raise HTTPException(
            status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            detail=f"Unsupported file type: {file.content_type}. Accepted: {', '.join(allowed_types)}",
        )

    # Save uploaded file to disk
    import os
    import tempfile

    upload_dir = os.path.join(tempfile.gettempdir(), "shieldnetwork_uploads")
    os.makedirs(upload_dir, exist_ok=True)

    video_id = uuid.uuid4()
    file_ext = os.path.splitext(file.filename or "upload.mp4")[1]
    file_path = os.path.join(upload_dir, f"{video_id}{file_ext}")

    contents = await file.read()
    with open(file_path, "wb") as f:
        f.write(contents)

    # Also store in Redis for cross-container access.
    # The Celery worker runs in a separate container with its own /tmp,
    # so it cannot read the file from disk. Workers will download from Redis.
    try:
        import redis as redis_module
        from app.config import get_settings as _get_settings
        _s = _get_settings()
        _r = redis_module.Redis.from_url(_s.REDIS_URL, ssl_cert_reqs=None)
        redis_key = f"upload:{video_id}"
        _r.setex(redis_key, 86400, contents)  # 24h TTL
        logger.info("Stored upload %s in Redis (%d bytes)", video_id, len(contents))
    except Exception as _redis_err:
        logger.warning("Failed to cache upload %s in Redis: %s", video_id, _redis_err)


    # Set the destination channel
    destination_channel_id = None

    if upload_type == "channel" and channel_id:
        # Verify the requested channel belongs to the org
        ch_uuid = uuid.UUID(channel_id)
        channel_check = await db.execute(
            select(Channel).where(
                Channel.id == ch_uuid,
                Channel.org_id == org_uuid
            )
        )
        selected_channel = channel_check.scalar_one_or_none()
        if selected_channel is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Selected channel not found in this organization")
        destination_channel_id = selected_channel.id
    else:
        # Ensure sentinel channel exists in the database for this specific organization.
        # Use an org-scoped sentinel ID to avoid the global unique constraint on youtube_channel_id.
        sentinel_yt_id = f"sentinel-uploads-{org_uuid}"
        sentinel_check = await db.execute(
            select(Channel).where(
                Channel.youtube_channel_id == sentinel_yt_id
            )
        )
        sentinel_channel = sentinel_check.scalar_one_or_none()

        if sentinel_channel is None:
            sentinel_id = uuid.uuid4()
            sentinel_channel = Channel(
                id=sentinel_id,
                org_id=org_uuid,
                youtube_channel_id=sentinel_yt_id,
                title="Uploaded Videos Sentinel",
                status=ChannelStatus.ACTIVE,
            )
            db.add(sentinel_channel)
            await db.flush()
        else:
            sentinel_id = sentinel_channel.id
        
        destination_channel_id = sentinel_id

    # Create a placeholder Video record
    video = Video(
        id=video_id,
        channel_id=destination_channel_id,  # Link to chosen channel or sentinel
        youtube_video_id=f"upload-{video_id}",
        title=title,
        description=description,
        status=VideoStatus.AUDITING,
    )
    db.add(video)
    await db.flush()

    # Create a ForensicJob to track progress for the organization
    job = ForensicJob(
        id=uuid.uuid4(),
        video_id=video_id,
        org_id=org_uuid,
        status="pending",
        progress=0.0,
        queue="heavy",
    )
    db.add(job)
    await db.flush()

    db.add(video)

    # Deduct credit (if not on unlimited plan)
    if org.plan_tier not in [PlanTier.PRO, PlanTier.ENTERPRISE]:
        org.available_credits -= 1
        ledger_entry = CreditLedger(
            org_id=org.id,
            amount=-1,
            transaction_type="SCAN_DEDUCTION",
            description=f"Scan for uploaded video {video.title}"
        )
        db.add(ledger_entry)

    await db.commit()

    # Dispatch audit pipeline
    from app.celery_app import celery_app

    dispatched_tasks: list[str] = []
    selected_scans = [s.strip().lower() for s in scans.split(",") if s.strip()]

    # Step 1 – Whisper transcription (marked as new upload)
    if "transcript" in selected_scans:
        task_whisper = celery_app.send_task(
            "app.workers.transcribe_upload",
            args=[str(video_id), file_path, True],  # is_new_upload=True
            queue="heavy",
        )
        dispatched_tasks.append(f"whisper:{task_whisper.id}")

    # Step 2 – Visual/asset audits on the uploaded file
    if "deepfake" in selected_scans:
        task_deepfake = celery_app.send_task(
            "app.workers.deepfake_scan",
            args=[str(video_id), file_path],
            queue="heavy",
        )
        dispatched_tasks.append(f"deepfake_scan:{task_deepfake.id}")

    # Step 3 - Gemini Vision Pre-Publish Scan
    if "visual" in selected_scans:
        task_vision = celery_app.send_task(
            "app.workers.frame_worker.detect_frame_similarity",
            args=[str(video_id)],
            queue="heavy",
        )
        dispatched_tasks.append(f"detect_frame_similarity:{task_vision.id}")

    return {
        "video_id": video_id,
        "status": "processing",
        "message": "Upload received – audit pipeline started",
        "dispatched_tasks": dispatched_tasks,
    }


@router.get("/{org_id}/queue", response_model=list[dict])
async def get_audit_queue(
    org_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[dict]:
    """Get the list of videos currently in the auditing or pending queue for an organization."""
    # Verify access
    org_check = await db.execute(
        select(Organization.id).where(
            Organization.id == org_id,
            Organization.owner_id == current_user.id,
        )
    )
    if org_check.scalar_one_or_none() is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Organization not found")

    # 1. Fetch channel videos currently auditing or pending
    ch_result = await db.execute(
        select(Channel.id).where(Channel.org_id == org_id)
    )
    channel_ids = [row[0] for row in ch_result.all()]

    videos_in_queue = []
    if channel_ids:
        q_result = await db.execute(
            select(Video)
            .where(
                Video.channel_id.in_(channel_ids),
                Video.status.in_([VideoStatus.AUDITING, VideoStatus.PENDING])
            )
            .order_by(Video.created_at.desc())
        )
        videos_in_queue.extend(q_result.scalars().all())

    # 2. Fetch upload videos linked via ForensicJob
    from app.models import ForensicJob
    job_result = await db.execute(
        select(Video)
        .join(ForensicJob, Video.id == ForensicJob.video_id)
        .where(
            ForensicJob.org_id == org_id,
            Video.status.in_([VideoStatus.AUDITING, VideoStatus.PENDING])
        )
        .order_by(Video.created_at.desc())
    )
    videos_in_queue.extend(job_result.scalars().all())

    # De-duplicate
    seen = set()
    unique_videos = []
    for v in videos_in_queue:
        if v.id not in seen:
            seen.add(v.id)
            unique_videos.append(v)

    # Format output
    return [
        {
            "id": str(v.id),
            "title": v.title,
            "status": v.status.value,
            "created_at": v.created_at.isoformat() if v.created_at else None,
            "duration_seconds": v.duration_seconds,
            "youtube_video_id": v.youtube_video_id,
        }
        for v in unique_videos
    ]
