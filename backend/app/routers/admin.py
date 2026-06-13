"""Admin-only routes – user management, error logs, and plan upgrades.

Access is restricted to the hard-coded ADMIN_EMAIL defined in settings.
Any authenticated user whose email does NOT match that address will receive a
403 Forbidden response.
"""

from __future__ import annotations

import logging
import uuid
from datetime import datetime, timezone
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models import Organization, PlanTier, User
from app.routers.auth import get_current_user

router = APIRouter(prefix="/admin", tags=["admin"])
logger = logging.getLogger(__name__)

# ── Hard-coded admin emails ──────────────────────────────────────────────────
ADMIN_EMAILS = {"justoneguylikethat@gmail.com", "obedasekhamen@gmail.com"}

# In-memory error log store (populated by the custom log handler below).
# In production you would replace this with a DB table or a log aggregator.
_error_log_buffer: list[dict[str, Any]] = []
_MAX_LOG_ENTRIES = 500


class MemoryLogHandler(logging.Handler):
    """Custom logging handler to keep recent error logs in memory."""

    def __init__(self, capacity: int = _MAX_LOG_ENTRIES):
        super().__init__()
        self.capacity = capacity
        # Only capture WARNING and above
        self.setLevel(logging.WARNING)
        self.setFormatter(logging.Formatter("%(asctime)s - %(name)s - %(levelname)s - %(message)s"))

    def emit(self, record: logging.LogRecord) -> None:
        try:
            msg = self.format(record)
            entry = {
                "timestamp": datetime.fromtimestamp(record.created, tz=timezone.utc).isoformat(),
                "level": record.levelname,
                "logger": record.name,
                "message": msg,
            }
            if record.exc_info:
                entry["exc_info"] = self.formatter.formatException(record.exc_info) if self.formatter else str(record.exc_info)
            _error_log_buffer.insert(0, entry)
            if len(_error_log_buffer) > self.capacity:
                _error_log_buffer.pop()
        except Exception:
            self.handleError(record)


# Initialize and attach the custom log handler to the root logger
_memory_handler = MemoryLogHandler()
logging.getLogger().addHandler(_memory_handler)


# ── Dependency ────────────────────────────────────────────────────────────────


async def require_admin(current_user: User = Depends(get_current_user)) -> User:
    """Raise 403 if the authenticated user is not the platform admin."""
    if not current_user.email or current_user.email.lower() not in ADMIN_EMAILS:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access only.",
        )
    return current_user


# ── Routes ────────────────────────────────────────────────────────────────────


@router.get("/users", response_model=list[dict])
async def list_users(
    db: AsyncSession = Depends(get_db),
    _admin: User = Depends(require_admin),
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
    search: str = Query("", description="Filter by email or name"),
) -> list[dict[str, Any]]:
    """Return all registered users with their plan details."""
    stmt = (
        select(User, Organization)
        .outerjoin(Organization, Organization.owner_id == User.id)
        .order_by(User.created_at.desc())
    )
    if search:
        like = f"%{search}%"
        stmt = stmt.where(
            (User.email.ilike(like)) | (User.full_name.ilike(like))
        )
    offset = (page - 1) * page_size
    stmt = stmt.offset(offset).limit(page_size)

    result = await db.execute(stmt)
    rows = result.all()

    users_out: list[dict[str, Any]] = []
    for user, org in rows:
        users_out.append({
            "id": str(user.id),
            "email": user.email,
            "full_name": user.full_name,
            "is_active": user.is_active,
            "created_at": user.created_at.isoformat(),
            "org_id": str(org.id) if org else None,
            "org_name": org.name if org else None,
            "plan_tier": org.plan_tier.value if org else None,
            "available_credits": org.available_credits if org else 0,
        })
    return users_out


@router.get("/users/count")
async def user_count(
    db: AsyncSession = Depends(get_db),
    _admin: User = Depends(require_admin),
) -> dict[str, int]:
    """Return the total number of registered users."""
    result = await db.execute(select(func.count()).select_from(User))
    return {"total": result.scalar() or 0}


@router.patch("/users/{user_id}/plan")
async def upgrade_user_plan(
    user_id: uuid.UUID,
    body: dict,
    db: AsyncSession = Depends(get_db),
    _admin: User = Depends(require_admin),
) -> dict[str, Any]:
    """Upgrade or downgrade a user's organization plan tier.

    Body fields:
    - ``plan_tier``: One of FREE | PRO | ENTERPRISE
    - ``credits``  : (optional) Absolute credit balance to set
    """
    # Validate the tier
    new_tier_raw = body.get("plan_tier", "").upper()
    try:
        new_tier = PlanTier(new_tier_raw)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Invalid plan_tier '{new_tier_raw}'. Must be FREE, PRO or ENTERPRISE.",
        )

    # Find the user
    u_res = await db.execute(select(User).where(User.id == user_id))
    user = u_res.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found.")

    # Find their organization
    o_res = await db.execute(
        select(Organization).where(Organization.owner_id == user_id)
    )
    org = o_res.scalar_one_or_none()
    if not org:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Organization not found.")

    old_tier = org.plan_tier.value
    org.plan_tier = new_tier

    # Optionally set credits
    if "credits" in body:
        org.available_credits = int(body["credits"])

    await db.commit()
    logger.info(
        "Admin upgraded user %s (%s) from %s → %s",
        user.email, str(user_id), old_tier, new_tier.value,
    )
    return {
        "status": "success",
        "user_id": str(user_id),
        "email": user.email,
        "old_plan": old_tier,
        "new_plan": new_tier.value,
        "available_credits": org.available_credits,
    }


@router.patch("/users/{user_id}/status")
async def toggle_user_status(
    user_id: uuid.UUID,
    body: dict,
    db: AsyncSession = Depends(get_db),
    _admin: User = Depends(require_admin),
) -> dict[str, Any]:
    """Activate or deactivate a user account."""
    u_res = await db.execute(select(User).where(User.id == user_id))
    user = u_res.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found.")

    user.is_active = bool(body.get("is_active", True))
    await db.commit()
    return {"status": "success", "user_id": str(user_id), "is_active": user.is_active}


@router.get("/logs", response_model=list[dict])
async def get_error_logs(
    _admin: User = Depends(require_admin),
    level: str = Query("WARNING", description="Minimum log level: WARNING or ERROR"),
    limit: int = Query(100, ge=1, le=500),
) -> list[dict[str, Any]]:
    """Return recent backend error/warning logs (newest first)."""
    level_filter = level.upper()
    allowed = {"WARNING", "ERROR", "CRITICAL"}
    if level_filter not in allowed:
        level_filter = "WARNING"

    level_priority = {"WARNING": 0, "ERROR": 1, "CRITICAL": 2}
    min_prio = level_priority.get(level_filter, 0)

    filtered = [
        entry for entry in _error_log_buffer
        if level_priority.get(entry["level"], 0) >= min_prio
    ]
    return list(reversed(filtered))[-limit:]


@router.delete("/logs")
async def clear_error_logs(
    _admin: User = Depends(require_admin),
) -> dict[str, str]:
    """Clear the in-memory error log buffer."""
    _error_log_buffer.clear()
    return {"status": "success", "message": "Log buffer cleared."}


@router.get("/stats")
async def platform_stats(
    db: AsyncSession = Depends(get_db),
    _admin: User = Depends(require_admin),
) -> dict[str, Any]:
    """Return high-level platform statistics for the admin dashboard."""
    from app.models import Channel, Video, AuditResult

    total_users = (await db.execute(select(func.count()).select_from(User))).scalar() or 0
    total_orgs = (await db.execute(select(func.count()).select_from(Organization))).scalar() or 0
    total_channels = (await db.execute(select(func.count()).select_from(Channel))).scalar() or 0
    total_videos = (await db.execute(select(func.count()).select_from(Video))).scalar() or 0
    total_audits = (await db.execute(select(func.count()).select_from(AuditResult))).scalar() or 0

    # Plans breakdown
    plan_rows = await db.execute(
        select(Organization.plan_tier, func.count()).group_by(Organization.plan_tier)
    )
    plans: dict[str, int] = {row[0].value: row[1] for row in plan_rows}

    return {
        "total_users": total_users,
        "total_orgs": total_orgs,
        "total_channels": total_channels,
        "total_videos": total_videos,
        "total_audits": total_audits,
        "plans": plans,
        "log_buffer_size": len(_error_log_buffer),
    }
