"""Authentication and user management routes."""

from __future__ import annotations

import uuid
from datetime import datetime, timedelta, timezone

import jwt
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from passlib.context import CryptContext
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.database import get_db
from app.models import User
from app.schemas import TokenResponse, UserCreate, UserLogin, UserResponse

router = APIRouter(prefix="/auth", tags=["auth"])
settings = get_settings()
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
bearer_scheme = HTTPBearer()


# ── JWT helpers ───────────────────────────────────────────────────────────────


def create_access_token(user_id: uuid.UUID) -> str:
    """Create a signed JWT for the given user ID."""
    now = datetime.now(timezone.utc)
    payload = {
        "sub": str(user_id),
        "iat": now,
        "exp": now + timedelta(minutes=settings.JWT_EXPIRATION_MINUTES),
    }
    return jwt.encode(payload, settings.JWT_SECRET_KEY, algorithm=settings.JWT_ALGORITHM)


def verify_token(token: str) -> dict:
    """Decode and validate a Supabase JWT, returning its payload."""
    try:
        return jwt.decode(
            token,
            settings.JWT_SECRET_KEY,
            algorithms=[settings.JWT_ALGORITHM],
            options={"verify_aud": False}
        )
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token has expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")


# ── Dependencies ──────────────────────────────────────────────────────────────


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
    db: AsyncSession = Depends(get_db),
) -> User:
    """Extract the authenticated user from the Authorization header."""
    payload = verify_token(credentials.credentials)
    user_id = payload.get("sub")
    if user_id is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token payload")

    result = await db.execute(select(User).where(User.id == uuid.UUID(user_id)))
    user = result.scalar_one_or_none()
    if user is None or not user.is_active:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found or inactive")
    return user


# ── Routes ────────────────────────────────────────────────────────────────────


@router.post("/register", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
async def register(body: UserCreate, db: AsyncSession = Depends(get_db)) -> User:
    """Register a new user account and initialize a default organization."""
    existing = await db.execute(select(User).where(User.email == body.email))
    if existing.scalar_one_or_none() is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="A user with this email already exists",
        )

    user = User(
        email=body.email,
        hashed_password=pwd_context.hash(body.password),
        full_name=body.full_name,
    )
    db.add(user)
    await db.flush()

    # Create default organization for the new user
    from app.models import Organization
    org = Organization(
        name=f"{body.full_name}'s Network",
        owner_id=user.id
    )
    db.add(org)
    await db.flush()

    await db.refresh(user)
    return user


@router.post("/login", response_model=TokenResponse)
async def login(body: UserLogin, db: AsyncSession = Depends(get_db)) -> dict:
    """Authenticate and return a JWT token."""
    result = await db.execute(select(User).where(User.email == body.email))
    user = result.scalar_one_or_none()

    if user is None or not pwd_context.verify(body.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
        )

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account is deactivated",
        )

    token = create_access_token(user.id)
    return {
        "access_token": token,
        "token_type": "bearer",
        "expires_in_minutes": settings.JWT_EXPIRATION_MINUTES,
    }

from app.schemas import GoogleLoginRequest
from app.models import Organization, PlanTier
import secrets

@router.post("/supabase", response_model=TokenResponse)
async def supabase_login(body: GoogleLoginRequest, db: AsyncSession = Depends(get_db)) -> dict:
    """Authenticate using a Supabase session token and return a platform JWT token.

    Supabase tokens may use HS256 (older projects / service-role) or RS256
    (newer projects with asymmetric keys). We peek at the header `alg` field
    first and handle both cases gracefully.
    """
    try:
        # ── Step 1: inspect the token header without verifying ────────────────
        unverified_header = jwt.get_unverified_header(body.credential)
        alg = unverified_header.get("alg", "HS256")

        payload: dict = {}

        if alg == "HS256":
            # ── HS256: verify with the shared secret ─────────────────────────
            if not settings.SUPABASE_JWT_SECRET:
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail="SUPABASE_JWT_SECRET is not configured on the server",
                )
            payload = jwt.decode(
                body.credential,
                settings.SUPABASE_JWT_SECRET,
                algorithms=["HS256"],
                options={"verify_aud": False},
            )

        elif alg in ("RS256", "RS384", "RS512", "ES256", "ES384", "ES512"):
            # ── RS256 / asymmetric: decode and verify using JWKS ────────────────
            unverified_payload = jwt.decode(body.credential, options={"verify_signature": False})
            iss = unverified_payload.get("iss")
            if not iss:
                raise jwt.InvalidTokenError("Token is missing the issuer (iss) claim")
            
            # Construct the JWKS endpoint
            jwks_url = f"{iss.rstrip('/')}/.well-known/jwks.json"
            
            # Use PyJWKClient to fetch and cache signing keys
            from jwt import PyJWKClient
            jwks_client = PyJWKClient(jwks_url)
            signing_key = jwks_client.get_signing_key_from_jwt(body.credential)
            
            # Decode and verify token signature
            payload = jwt.decode(
                body.credential,
                signing_key.key,
                algorithms=[alg],
                options={"verify_aud": False}
            )

        else:
            raise jwt.InvalidTokenError(f"Unsupported algorithm: {alg}")

        # ── Step 2: extract user data ─────────────────────────────────────────
        email = payload.get("email")
        user_metadata = payload.get("user_metadata", {})
        full_name = (
            user_metadata.get("full_name")
            or user_metadata.get("name")
            or payload.get("name")
            or ""
        )

        if not email:
            raise ValueError("Token didn't contain an email")

        # ── Step 3: upsert user ───────────────────────────────────────────────
        result = await db.execute(select(User).where(User.email == email))
        user = result.scalar_one_or_none()

        if user is None:
            user = User(
                email=email,
                full_name=full_name,
                hashed_password=pwd_context.hash(secrets.token_urlsafe(32)),
                is_active=True,
            )
            db.add(user)
            await db.flush()

            org = Organization(
                name=f"{full_name}'s Organization" if full_name else "My Organization",
                owner_id=user.id,
                plan_tier=PlanTier.FREE,
            )
            db.add(org)
            await db.commit()
            await db.refresh(user)

        if not user.is_active:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Account is deactivated",
            )

        token = create_access_token(user.id)
        return {
            "access_token": token,
            "token_type": "bearer",
            "expires_in_minutes": settings.JWT_EXPIRATION_MINUTES,
        }

    except jwt.ExpiredSignatureError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Supabase token has expired. Please sign in again.",
        )
    except jwt.InvalidTokenError as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Invalid Supabase token: {str(e)}",
        )
    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=str(e),
        )

@router.get("/me", response_model=UserResponse)
async def get_me(current_user: User = Depends(get_current_user)) -> User:
    """Return the currently authenticated user."""
    return current_user


from app.schemas import OrganizationResponse

@router.get("/my-orgs", response_model=list[OrganizationResponse])
async def get_my_orgs(current_user: User = Depends(get_current_user)):
    """Return organizations owned by the currently authenticated user."""
    return current_user.organizations

