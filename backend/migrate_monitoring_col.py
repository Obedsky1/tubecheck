import asyncio
import sys
from sqlalchemy import text
from app.database import async_session_factory

sys.stdout.reconfigure(encoding='utf-8')

async def main():
    async with async_session_factory() as session:
        try:
            await session.execute(text("ALTER TABLE organizations ADD COLUMN daily_monitoring_enabled BOOLEAN DEFAULT FALSE NOT NULL;"))
            await session.commit()
            print("Successfully added daily_monitoring_enabled to organizations.")
        except Exception as e:
            if 'already exists' in str(e):
                print("Column already exists.")
            else:
                print("Error:", e)

if __name__ == "__main__":
    asyncio.run(main())
