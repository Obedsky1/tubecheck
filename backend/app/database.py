"""Async SQLAlchemy engine, session factory, and declarative base."""

from __future__ import annotations

from collections.abc import AsyncGenerator

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import DeclarativeBase

from app.config import get_settings

settings = get_settings()

# Construct engine arguments dynamically for SQLite compatibility
engine_kwargs = {
    "echo": settings.DEBUG,
    "pool_pre_ping": True,
}

if "sqlite" in settings.DATABASE_URL:
    # SQLite doesn't support pool_size, max_overflow, or statement_cache_size
    pass
else:
    engine_kwargs["pool_size"] = 20
    engine_kwargs["max_overflow"] = 10
    engine_kwargs["pool_recycle"] = 1800
    engine_kwargs["connect_args"] = {"statement_cache_size": 0}  # Supabase pgbouncer compatibility

engine = create_async_engine(settings.DATABASE_URL, **engine_kwargs)

async_session_factory = async_sessionmaker(
    bind=engine,
    class_=AsyncSession,
    expire_on_commit=False,
)


class Base(DeclarativeBase):
    """Shared declarative base for all ORM models."""


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    """FastAPI dependency – yields an async database session and ensures cleanup."""
    async with async_session_factory() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()
