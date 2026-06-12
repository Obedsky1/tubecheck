from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.database import get_db
from app.models import Organization, User
from app.routers.auth import get_current_user
from app.schemas import FarmProbabilityResponse
from app.services.farm_detection_service import farm_detection_service
from app.workers.task_utils import get_sync_db_session
import uuid
import anyio

router = APIRouter(prefix="/velocity", tags=["velocity"])

@router.get("/{org_id}/farm-probability", response_model=FarmProbabilityResponse)
async def get_farm_probability(
    org_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Retrieves content farm probability, automation footprint index, and contamination scores."""
    # Verify access
    org_check = await db.execute(
        select(Organization.id).where(
            Organization.id == org_id,
            Organization.owner_id == current_user.id
        )
    )
    if org_check.scalar_one_or_none() is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Organization not found")

    def run_analysis():
        with get_sync_db_session() as session:
            return farm_detection_service.analyze_network_velocity(session, str(org_id))

    try:
        report = await anyio.to_thread.run_sync(run_analysis)
        return report
    except Exception as err:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Velocity analysis failed: {err}"
        )

from app.schemas import ShadowbanDiagnosticResponse

@router.get("/{org_id}/shadowban-diagnostic", response_model=ShadowbanDiagnosticResponse)
async def get_shadowban_diagnostic(
    org_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Simulates fetching 30-day YouTube Analytics API metrics and applies
    the Algorithm Detector logic to diagnose a soft shadowban.
    """
    # Verify access
    org_check = await db.execute(
        select(Organization.id).where(
            Organization.id == org_id,
            Organization.owner_id == current_user.id
        )
    )
    if org_check.scalar_one_or_none() is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Organization not found")

    # SIMULATION:
    # We simulate a scenario where "Browse Features" and "Suggested Videos" traffic 
    # has collapsed week-over-week, but core engagement metrics (CTR, AVD) remain stable.
    # This is the hallmark of an algorithmic demotion (soft shadowban) due to content
    # classification (e.g., AI footprints), not poor viewer engagement.

    # Simulated Metrics
    prev_week_browse_traffic = 150000
    curr_week_browse_traffic = 31000  # ~79% drop

    historical_avg_ctr = 5.2 # %
    current_ctr = 5.0 # % (within 15% variance)

    historical_avg_avd = 45.0 # %
    current_avd = 43.5 # % (within 15% variance)

    # Calculate Drops & Retentions
    traffic_drop_pct = ((prev_week_browse_traffic - curr_week_browse_traffic) / prev_week_browse_traffic) * 100
    ctr_retention_pct = (current_ctr / historical_avg_ctr) * 100
    avd_retention_pct = (current_avd / historical_avg_avd) * 100

    # The Algorithm Detector Logic
    # 1. Traffic drops by > 75%
    # 2. CTR and AVD remain within 15% of historical average (i.e. retention > 85%)
    is_shadowbanned = False
    if traffic_drop_pct > 75.0 and ctr_retention_pct >= 85.0 and avd_retention_pct >= 85.0:
        is_shadowbanned = True

    explanation = ""
    if is_shadowbanned:
        explanation = f"We detected a {traffic_drop_pct:.1f}% drop in Browse/Suggested traffic week-over-week, while your Click-Through Rate ({current_ctr}%) and Average View Duration remain stable. This indicates YouTube's recommendation engine has actively deprioritized your catalog, likely due to recent AI content footprints, not viewer disinterest."
    else:
        explanation = "Your traffic sources and engagement metrics are within normal algorithmic bounds."

    return ShadowbanDiagnosticResponse(
        is_shadowbanned=is_shadowbanned,
        browse_suggested_drop_pct=traffic_drop_pct,
        ctr_retention_pct=ctr_retention_pct,
        avd_retention_pct=avd_retention_pct,
        explanation=explanation
    )
