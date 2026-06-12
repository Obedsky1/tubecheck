import asyncio
import sys
from sqlalchemy import select
from app.database import async_session_factory
from app.models import Video, AuditResult

sys.stdout.reconfigure(encoding='utf-8')

async def main():
    async with async_session_factory() as session:
        # Get last 5 videos
        res = await session.execute(
            select(Video).order_by(Video.created_at.desc()).limit(5)
        )
        videos = res.scalars().all()
        for v in videos:
            print(f"Video: {v.title} (ID: {v.id}, Status: {v.status.value if v.status else 'None'}, YT ID: {v.youtube_video_id})")
            a_res = await session.execute(select(AuditResult).where(AuditResult.video_id == v.id))
            audits = a_res.scalars().all()
            for a in audits:
                print(f"  Audit: {a.audit_type.value} | Risk: {a.risk_score} | Severity: {a.severity}")
                print(f"    Details: {a.details}")

if __name__ == "__main__":
    asyncio.run(main())
