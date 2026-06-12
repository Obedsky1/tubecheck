"""Payments router — Flutterwave server-side verification & webhook handling."""

from __future__ import annotations

import hashlib
import hmac
import logging
from typing import Optional

import httpx
from fastapi import APIRouter, Depends, Header, HTTPException, Request, status
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.database import get_db
from app.models import CreditLedger, Organization, Payment, PlanTier, User
from app.routers.auth import get_current_user

logger = logging.getLogger(__name__)
settings = get_settings()
router = APIRouter(tags=["Payments"])

# ── Plan definitions ──────────────────────────────────────────────────────────

PLAN_CREDITS: dict[PlanTier, int] = {
    PlanTier.FREE: 10,
    PlanTier.PRO: 50,
    PlanTier.ENTERPRISE: 500,
}

PLAN_AMOUNTS: dict[PlanTier, float] = {
    PlanTier.FREE: 0,
    PlanTier.PRO: 49.0,
    PlanTier.ENTERPRISE: 199.0,
}


# ── Schemas ───────────────────────────────────────────────────────────────────

class VerifyPaymentRequest(BaseModel):
    transaction_id: str          # Flutterwave tx id (numeric)
    org_id: str
    plan_tier: PlanTier


# ── Helper — verify with Flutterwave API ─────────────────────────────────────

async def _flw_verify(transaction_id: str) -> dict:
    """Call Flutterwave's verify endpoint and return the data payload."""
    secret_key = settings.FLUTTERWAVE_SECRET_KEY
    if not secret_key:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Payment gateway not configured on server.",
        )

    url = f"https://api.flutterwave.com/v3/transactions/{transaction_id}/verify"
    headers = {"Authorization": f"Bearer {secret_key}"}

    async with httpx.AsyncClient(timeout=20) as client:
        resp = await client.get(url, headers=headers)

    if resp.status_code != 200:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Flutterwave verification failed: HTTP {resp.status_code}",
        )

    data = resp.json()
    if data.get("status") != "success":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Flutterwave returned non-success status: {data.get('message')}",
        )

    return data["data"]


# ── Internal helper — apply upgrade & record transaction ─────────────────────

async def _apply_upgrade(
    db: AsyncSession,
    org: Organization,
    user_id: str,
    new_tier: PlanTier,
    tx_id: str,
    tx_ref: str,
    amount: float,
    currency: str,
    raw: dict,
) -> Payment:
    """Record the payment and upgrade the org plan inside a single transaction."""

    # 1. Idempotency: if already recorded, return existing payment
    existing = await db.execute(
        select(Payment).where(Payment.flutterwave_tx_id == tx_id)
    )
    existing_payment = existing.scalar_one_or_none()
    if existing_payment:
        logger.info("Payment %s already processed — skipping duplicate.", tx_id)
        return existing_payment

    # 2. Save payment record
    payment = Payment(
        org_id=org.id,
        user_id=user_id,
        flutterwave_tx_id=tx_id,
        flutterwave_tx_ref=tx_ref,
        amount=amount,
        currency=currency,
        plan_tier=new_tier,
        status="successful",
        flutterwave_raw=raw,
    )
    db.add(payment)

    # 3. Grant credits if upgrading
    credits_granted = PLAN_CREDITS.get(new_tier, 0)
    if new_tier != org.plan_tier:
        org.plan_tier = new_tier
        if credits_granted > 0:
            org.available_credits += credits_granted
            ledger = CreditLedger(
                org_id=org.id,
                amount=credits_granted,
                transaction_type="PLAN_UPGRADE",
                description=f"Upgrade to {new_tier.value} — Flutterwave tx {tx_id}",
            )
            db.add(ledger)

    await db.commit()
    await db.refresh(payment)
    await db.refresh(org)
    return payment


# ── POST /payments/verify ─────────────────────────────────────────────────────

@router.post("/payments/verify")
async def verify_payment(
    req: VerifyPaymentRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Frontend calls this after Flutterwave checkout succeeds.
    We verify the transaction server-side, record it in the DB,
    and upgrade the org plan tier.
    """
    # 1. Verify org ownership
    org = await db.get(Organization, req.org_id)
    if not org:
        raise HTTPException(status_code=404, detail="Organization not found")
    if str(org.owner_id) != str(current_user.id):
        raise HTTPException(status_code=403, detail="Not the organization owner")

    # 2. Verify with Flutterwave
    flw_data = await _flw_verify(req.transaction_id)

    # 3. Validate amount & currency match the chosen plan
    expected_amount = PLAN_AMOUNTS.get(req.plan_tier, 0)
    paid_amount = float(flw_data.get("amount", 0))
    paid_currency = flw_data.get("currency", "")
    flw_status = flw_data.get("status", "")

    if flw_status != "successful":
        raise HTTPException(
            status_code=status.HTTP_402_PAYMENT_REQUIRED,
            detail=f"Transaction status is '{flw_status}', not successful.",
        )

    if paid_amount < expected_amount:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Amount mismatch: expected ${expected_amount}, got {paid_currency} {paid_amount}.",
        )

    # 4. Record + upgrade
    payment = await _apply_upgrade(
        db=db,
        org=org,
        user_id=str(current_user.id),
        new_tier=req.plan_tier,
        tx_id=str(flw_data["id"]),
        tx_ref=flw_data.get("tx_ref", ""),
        amount=paid_amount,
        currency=paid_currency,
        raw=flw_data,
    )

    return {
        "success": True,
        "message": f"Upgraded to {req.plan_tier.value}",
        "plan_tier": org.plan_tier.value,
        "available_credits": org.available_credits,
        "payment_id": str(payment.id),
    }


# ── POST /payments/webhook ────────────────────────────────────────────────────

@router.post("/payments/webhook", status_code=200)
async def flutterwave_webhook(
    request: Request,
    db: AsyncSession = Depends(get_db),
    verif_hash: Optional[str] = Header(None, alias="verif-hash"),
):
    """
    Flutterwave fires this webhook when a payment completes.
    Used as a safety net in case the user closes the popup before
    the frontend callback fires.
    Register this URL in the Flutterwave dashboard:
      https://your-domain.com/api/payments/webhook
    """
    webhook_secret = settings.FLUTTERWAVE_WEBHOOK_SECRET
    if not webhook_secret:
        logger.warning("Flutterwave webhook received but FLUTTERWAVE_WEBHOOK_SECRET is not configured.")
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Payment signature key is missing on the server."
        )
    if verif_hash != webhook_secret:
        logger.warning("Flutterwave webhook signature mismatch. verif-hash: %s", verif_hash)
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid webhook signature")

    payload = await request.json()
    event = payload.get("event", "")

    if event != "charge.completed":
        return {"received": True}

    data = payload.get("data", {})
    if data.get("status") != "successful":
        return {"received": True}

    # Extract tx_ref to identify org/plan: format "cs-{org_id}-{TIER}-{ts}"
    tx_ref: str = data.get("tx_ref", "")
    parts = tx_ref.split("-")
    if len(parts) < 3:
        logger.warning("Webhook: unrecognised tx_ref format: %s", tx_ref)
        return {"received": True}

    # tx_ref format: cs-<org_id>-<TIER>-<timestamp>
    # org_id is a UUID (5 parts with dashes), so re-assemble it:
    # "cs" + 5 uuid segments + tier + timestamp = 8+ parts
    try:
        # parts[0] = "cs", parts[1..5] = uuid segments, parts[6] = TIER, parts[7] = ts
        org_id_str = "-".join(parts[1:6])
        tier_str = parts[6].upper()
        new_tier = PlanTier(tier_str)
    except (ValueError, IndexError):
        logger.warning("Webhook: could not parse org_id/tier from tx_ref %s", tx_ref)
        return {"received": True}

    org = await db.get(Organization, org_id_str)
    if not org:
        logger.warning("Webhook: org %s not found", org_id_str)
        return {"received": True}

    await _apply_upgrade(
        db=db,
        org=org,
        user_id=None,  # no user context in webhook
        new_tier=new_tier,
        tx_id=str(data.get("id", "")),
        tx_ref=tx_ref,
        amount=float(data.get("amount", 0)),
        currency=data.get("currency", "USD"),
        raw=data,
    )

    logger.info("Webhook: upgraded org %s to %s", org_id_str, new_tier.value)
    return {"received": True}


# ── GET /payments/history ─────────────────────────────────────────────────────

@router.get("/payments/history/{org_id}")
async def get_payment_history(
    org_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Return all successful payments for an organization."""
    org = await db.get(Organization, org_id)
    if not org:
        raise HTTPException(status_code=404, detail="Organization not found")
    if str(org.owner_id) != str(current_user.id):
        raise HTTPException(status_code=403, detail="Not the organization owner")

    result = await db.execute(
        select(Payment)
        .where(Payment.org_id == org.id, Payment.status == "successful")
        .order_by(Payment.created_at.desc())
    )
    payments = result.scalars().all()

    return {
        "payments": [
            {
                "id": str(p.id),
                "flutterwave_tx_id": p.flutterwave_tx_id,
                "amount": p.amount,
                "currency": p.currency,
                "plan_tier": p.plan_tier.value,
                "status": p.status,
                "created_at": p.created_at.isoformat(),
            }
            for p in payments
        ]
    }
