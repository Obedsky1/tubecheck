"""Router for internal subscription and tier management."""

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models import Organization, PlanTier, User
from app.routers.auth import get_current_user

router = APIRouter(tags=["Subscriptions"])

class UpgradeRequest(BaseModel):
    plan_tier: PlanTier
    org_id: str

@router.post("/subscriptions/upgrade")
async def upgrade_subscription(
    req: UpgradeRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Upgrades an organization's plan tier and optionally grants credits."""
    # Lookup org and verify ownership
    org: Organization | None = await db.get(Organization, req.org_id)
    if not org:
        raise HTTPException(status_code=404, detail="Organization not found")
    
    if str(org.owner_id) != str(current_user.id):
        raise HTTPException(status_code=403, detail="Only the organization owner can change the plan tier")

    if org.plan_tier == req.plan_tier:
        return {"success": True, "message": "Already on this tier", "plan_tier": org.plan_tier.value}

    org.plan_tier = req.plan_tier

    # Grant credits upon upgrading
    if req.plan_tier == PlanTier.PRO:
        org.available_credits += 50
    elif req.plan_tier == PlanTier.ENTERPRISE:
        org.available_credits += 500

    await db.commit()
    await db.refresh(org)

    return {
        "success": True, 
        "message": f"Successfully upgraded to {req.plan_tier.value}",
        "plan_tier": org.plan_tier.value,
        "available_credits": org.available_credits
    }
