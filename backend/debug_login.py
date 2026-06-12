import asyncio
import sys
from sqlalchemy import select
from app.database import async_session_factory
from app.models import User
from passlib.context import CryptContext

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

async def main():
    print("Opening DB session...")
    async with async_session_factory() as db:
        print("Querying user...")
        result = await db.execute(select(User).where(User.email == "test@example.com"))
        user = result.scalar_one_or_none()
        print(f"User retrieved: {user.email}")
        
        print("Verifying password...")
        verified = pwd_context.verify("password123", user.hashed_password)
        print(f"Password verified: {verified}")
        
        print("Loading organizations...")
        orgs = user.organizations
        print(f"Organizations: {orgs}")
        for org in orgs:
            print(f"Org name: {org.name}")
            print(f"Org channels: {org.channels}")
            for ch in org.channels:
                print(f"  Channel: {ch.title}")
                print(f"  Videos: {len(ch.videos)}")
                
    print("SUCCESS!")

if __name__ == "__main__":
    asyncio.run(main())
