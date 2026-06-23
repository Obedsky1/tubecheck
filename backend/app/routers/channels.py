"""Channel management routes – connect, list, sync, and fetch videos."""

from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models import Channel, ChannelStatus, Organization, User, Video, PlanTier
from app.routers.auth import get_current_user
from app.schemas import (
    ChannelConnect,
    ChannelListResponse,
    ChannelResponse,
    VideoListResponse,
    VideoResponse,
)

router = APIRouter(prefix="/channels", tags=["channels"])


@router.post("/connect", response_model=list[ChannelResponse], status_code=status.HTTP_201_CREATED)
async def connect_channels(
    body: ChannelConnect,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[Channel]:
    """Connect one or more YouTube channels to an organization.

    Accepts up to 50 channel IDs. Duplicate IDs that already exist in the
    database are silently skipped. A Celery sync task is dispatched for each
    newly connected channel.
    """
    # Verify org ownership
    result = await db.execute(
        select(Organization).where(
            Organization.id == body.org_id,
            Organization.owner_id == current_user.id,
        )
    )
    org = result.scalar_one_or_none()
    if org is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Organization not found or access denied")

    # Fetch already-connected IDs so we can skip duplicates and check limits
    existing_result = await db.execute(
        select(Channel.youtube_channel_id).where(
            Channel.youtube_channel_id.in_(body.youtube_channel_ids)
        )
    )
    existing_ids: set[str] = {row[0] for row in existing_result.all()}

    # Enforce channel count limitations based on pricing tiers
    current_channels_count_result = await db.execute(
        select(func.count(Channel.id)).where(Channel.org_id == org.id)
    )
    current_count = current_channels_count_result.scalar() or 0

    limit = 1
    if org.plan_tier == PlanTier.PRO:
        limit = 50
    elif org.plan_tier == PlanTier.ENTERPRISE:
        limit = 999999

    requested_new = len([yt_id for yt_id in body.youtube_channel_ids if yt_id not in existing_ids])
    if current_count + requested_new > limit:
        raise HTTPException(
            status_code=status.HTTP_402_PAYMENT_REQUIRED,
            detail=f"Channel connection limit exceeded. Your plan ({org.plan_tier.value}) allows a maximum of {limit} connected channels. Please upgrade your plan."
        )

    new_channels: list[Channel] = []
    for yt_id in body.youtube_channel_ids:
        if yt_id in existing_ids:
            continue
        channel = Channel(
            org_id=body.org_id,
            youtube_channel_id=yt_id,
            status=ChannelStatus.SYNCING,
        )
        db.add(channel)
        new_channels.append(channel)

    await db.flush()
    for ch in new_channels:
        await db.refresh(ch)

    from app.services.task_dispatcher import enqueue_task

    for ch in new_channels:
        enqueue_task(
            "app.workers.sync_channel",
            payload={"channel_id": str(ch.id)},
            queue="default"
        )

    return new_channels


@router.get("/{org_id}", response_model=ChannelListResponse)
async def list_channels(
    org_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    """List all channels for an organization."""
    # Verify access
    org_check = await db.execute(
        select(Organization.id).where(
            Organization.id == org_id,
            Organization.owner_id == current_user.id,
        )
    )
    if org_check.scalar_one_or_none() is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Organization not found")

    result = await db.execute(
        select(Channel).where(Channel.org_id == org_id).order_by(Channel.connected_at.desc())
    )
    channels = list(result.scalars().all())

    count_result = await db.execute(
        select(func.count()).select_from(Channel).where(Channel.org_id == org_id)
    )
    total = count_result.scalar() or 0

    return {"channels": channels, "total": total}


@router.post("/{channel_id}/sync", status_code=status.HTTP_202_ACCEPTED)
async def trigger_sync(
    channel_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    """Trigger a metadata sync for a specific channel via Celery."""
    result = await db.execute(select(Channel).where(Channel.id == channel_id))
    channel = result.scalar_one_or_none()
    if channel is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Channel not found")

    # Verify the user owns the org that owns this channel
    org_check = await db.execute(
        select(Organization.id).where(
            Organization.id == channel.org_id,
            Organization.owner_id == current_user.id,
        )
    )
    if org_check.scalar_one_or_none() is None:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")

    channel.status = ChannelStatus.SYNCING
    await db.flush()

    from app.services.task_dispatcher import enqueue_task

    enqueue_task(
        "app.workers.sync_channel",
        payload={"channel_id": str(channel_id)},
        queue="default",
    )

    return {"message": "Sync initiated", "channel_id": str(channel_id)}


@router.get("/{channel_id}/videos", response_model=VideoListResponse)
async def list_channel_videos(
    channel_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    page: int = Query(1, ge=1),
    page_size: int = Query(25, ge=1, le=100),
) -> dict:
    """List videos for a channel with pagination."""
    result = await db.execute(select(Channel).where(Channel.id == channel_id))
    channel = result.scalar_one_or_none()
    if channel is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Channel not found")

    # Verify access
    org_check = await db.execute(
        select(Organization.id).where(
            Organization.id == channel.org_id,
            Organization.owner_id == current_user.id,
        )
    )
    if org_check.scalar_one_or_none() is None:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")

    offset = (page - 1) * page_size

    videos_result = await db.execute(
        select(Video)
        .where(Video.channel_id == channel_id)
        .order_by(Video.published_at.desc())
        .offset(offset)
        .limit(page_size)
    )
    videos = list(videos_result.scalars().all())

    count_result = await db.execute(
        select(func.count()).select_from(Video).where(Video.channel_id == channel_id)
    )
    total = count_result.scalar() or 0

    return {"videos": videos, "total": total}


@router.get("/detail/{channel_id}", response_model=ChannelResponse)
async def get_channel_detail(
    channel_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Channel:
    """Get metadata details for a specific channel."""
    result = await db.execute(select(Channel).where(Channel.id == channel_id))
    channel = result.scalar_one_or_none()
    if channel is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Channel not found")

    # Verify access via org ownership
    org_check = await db.execute(
        select(Organization.id).where(
            Organization.id == channel.org_id,
            Organization.owner_id == current_user.id,
        )
    )
    if org_check.scalar_one_or_none() is None:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")

    return channel
