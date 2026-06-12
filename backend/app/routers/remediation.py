from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.database import get_db
from app.models import Organization, User, Channel, PolicyRisk
from app.routers.auth import get_current_user
from app.schemas import RemediationResponse
from app.services.remediation_service import remediation_engine
from app.workers.task_utils import get_sync_db_session
import uuid
import anyio

router = APIRouter(prefix="/remediation", tags=["remediation"])

@router.get("/{org_id}", response_model=list[RemediationResponse])
async def list_remediations(
    org_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Retrieves priority-ranked remediation checklists to resolve active policy compliance risks."""
    # Verify access
    org_check = await db.execute(
        select(Organization.id).where(
            Organization.id == org_id,
            Organization.owner_id == current_user.id
        )
    )
    if org_check.scalar_one_or_none() is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Organization not found")

    def run_remediation():
        with get_sync_db_session() as session:
            return remediation_engine.generate_remediation_items(session, str(org_id))

    try:
        items = await anyio.to_thread.run_sync(run_remediation)
        return items
    except Exception as err:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to generate remediations: {err}"
        )

@router.get("/{org_id}/channel/{channel_id}", response_model=list[RemediationResponse])
async def list_channel_remediations(
    org_id: uuid.UUID,
    channel_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Retrieves remediation checklists filtered for a specific channel."""
    # Verify channel belongs to org, and user owns org
    channel_check = await db.execute(
        select(Channel).where(
            Channel.id == channel_id,
            Channel.org_id == org_id
        )
    )
    channel = channel_check.scalar_one_or_none()
    if not channel:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Channel not found")

    org_check = await db.execute(
        select(Organization.id).where(
            Organization.id == org_id,
            Organization.owner_id == current_user.id
        )
    )
    if org_check.scalar_one_or_none() is None:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")

    def run_remediation():
        with get_sync_db_session() as session:
            all_items = remediation_engine.generate_remediation_items(session, str(org_id))
            # Filter items that affect this channel (by matching evidence or channel_id in PolicyRisk)
            # For simplicity, filter active risks that are linked to this channel:
            # Let's say all items matching the active risks
            filtered = []
            for item in all_items:
                risk_uuid = uuid.UUID(item["id"])
                risk_obj = session.get(PolicyRisk, risk_uuid)
                if risk_obj and risk_obj.channel_id == channel_id:
                    filtered.append(item)
                elif risk_obj and risk_obj.channel_id is None:
                    # General network-wide risks are applicable to all channels
                    filtered.append(item)
            return filtered

    try:
        items = await anyio.to_thread.run_sync(run_remediation)
        return items
    except Exception as err:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to generate channel remediations: {err}"
        )
