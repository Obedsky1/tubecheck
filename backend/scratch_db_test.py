import asyncio
import time
from sqlalchemy.ext.asyncio import create_async_engine

async def test_db():
    db_url = "postgresql+asyncpg://postgres.lesiqnnwhsrzsrkmfzyn:3EG7VfeGyC*U4a*@aws-1-eu-west-2.pooler.supabase.com:6543/postgres"
    print("Testing connection to database...")
    start_time = time.time()
    try:
        engine = create_async_engine(db_url)
        async with engine.connect() as conn:
            print(f"Connection established in {time.time() - start_time:.2f} seconds!")
            q_start = time.time()
            res = await conn.execute("SELECT 1")
            print(f"Simple query executed in {time.time() - q_start:.2f} seconds! Result: {res.scalar()}")
    except Exception as e:
        print(f"Failed to connect: {e}")

if __name__ == "__main__":
    asyncio.run(test_db())
