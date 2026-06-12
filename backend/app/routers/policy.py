from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_
from app.database import get_db
from app.models import PolicyRisk, Organization, User
from app.routers.auth import get_current_user
from app.schemas import PolicyRiskResponse
from app.services.policy_engine import policy_engine
from app.workers.task_utils import get_sync_db_session
import uuid
import anyio

router = APIRouter(prefix="/policy", tags=["policy"])

@router.get("/{org_id}/risks", response_model=list[PolicyRiskResponse])
async def list_policy_risks(
    org_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Retrieves all active policy risks for the organization."""
    # Verify access
    org_check = await db.execute(
        select(Organization.id).where(
            Organization.id == org_id,
            Organization.owner_id == current_user.id
        )
    )
    if org_check.scalar_one_or_none() is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Organization not found")

    result = await db.execute(
        select(PolicyRisk).where(
            and_(PolicyRisk.org_id == org_id, PolicyRisk.is_active == True)
        ).order_by(PolicyRisk.created_at.desc())
    )
    return list(result.scalars().all())

@router.post("/{org_id}/evaluate", response_model=list[PolicyRiskResponse])
async def evaluate_policy_risks(
    org_id: uuid.UUID,
    current_user: User = Depends(get_current_user)
):
    """Triggers the policy correlation rules engine for the organization."""
    # Since policy engine relies on sync DB sessions, we run it in a threadpool to remain non-blocking
    def run_eval():
        with get_sync_db_session() as session:
            # Check ownership
            org = session.get(Organization, org_id)
            if not org or org.owner_id != current_user.id:
                raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Organization not found")
            return policy_engine.evaluate_organization_risks(session, str(org_id))

    try:
        results = await anyio.to_thread.run_sync(run_eval)
        return results
    except HTTPException as e:
        raise e
    except Exception as err:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Evaluation failed: {err}")

@router.patch("/risks/{risk_id}/resolve", response_model=PolicyRiskResponse)
async def resolve_policy_risk(
    risk_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Resolves an active policy risk by ID."""
    result = await db.execute(select(PolicyRisk).where(PolicyRisk.id == risk_id))
    risk = result.scalar_one_or_none()
    if not risk:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Risk not found")

    # Verify access via org
    org_check = await db.execute(
        select(Organization.id).where(
            Organization.id == risk.org_id,
            Organization.owner_id == current_user.id
        )
    )
    if org_check.scalar_one_or_none() is None:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")

    risk.is_active = False
    await db.flush()
    await db.refresh(risk)
    return risk
