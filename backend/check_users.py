import asyncio
from sqlalchemy import select
from app.database import async_session_factory
from app.models import User

async def run():
    async with async_session_factory() as db:
        res = await db.execute(select(User.id, User.email))
        users = res.all()
        for u in users:
            print(f"ID: {u.id}, Email: {u.email}")

if __name__ == "__main__":
    asyncio.run(run())
