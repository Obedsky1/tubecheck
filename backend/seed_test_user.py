import asyncio
import sys
from sqlalchemy import select, text
from app.database import async_session_factory, engine, Base
from app.models import User, Organization
from passlib.context import CryptContext

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

async def seed():
    async with engine.begin() as conn:
        await conn.execute(text("CREATE EXTENSION IF NOT EXISTS vector"))
        await conn.run_sync(Base.metadata.create_all)
        
    async with async_session_factory() as db:
        result = await db.execute(select(User).where(User.email == "test@example.com"))
        existing = result.scalar_one_or_none()
        
        if existing:
            print("Test user already exists.")
            return
            
        user = User(
            email="test@example.com",
            hashed_password=pwd_context.hash("password123"),
            full_name="Test MCN Admin"
        )
        db.add(user)
        await db.flush()
        
        org = Organization(name="Test MCN Network", owner_id=user.id)
        db.add(org)
        await db.commit()
        print("Test user created: test@example.com / password123")

if __name__ == "__main__":
    asyncio.run(seed())
