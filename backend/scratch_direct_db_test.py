import asyncio
import time
from sqlalchemy.ext.asyncio import create_async_engine

async def test_db():
    db_url = "postgresql+asyncpg://postgres.lesiqnnwhsrzsrkmfzyn:3EG7VfeGyC*U4a*@db.lesiqnnwhsrzsrkmfzyn.supabase.co:5432/postgres"
    print("Testing direct connection to database on port 5432...")
    start_time = time.time()
    try:
        engine = create_async_engine(db_url)
        async with engine.connect() as conn:
            print(f"Direct connection established in {time.time() - start_time:.2f} seconds!")
    except Exception as e:
        print(f"Failed to connect directly: {e}")

if __name__ == "__main__":
    asyncio.run(test_db())
