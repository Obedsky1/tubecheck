import asyncio
import sys
from sqlalchemy import select
from app.database import async_session_factory
from app.models import Channel, Video, AuditResult, VideoStatus

sys.stdout.reconfigure(encoding='utf-8')
async def main():
    async with async_session_factory() as session:
        # Get all channels
        res = await session.execute(select(Channel))
        channels = res.scalars().all()
        for ch in channels:
            print(f"Channel: {ch.title} (ID: {ch.id})", flush=True)
            
            # Get videos for channel
            v_res = await session.execute(select(Video).where(Video.channel_id == ch.id))
            videos = v_res.scalars().all()
            print(f"  Videos: {len(videos)}", flush=True)
            for v in videos:
                print(f"    Video: {v.title} | Status: {v.status.value if v.status else 'None'}", flush=True)
                # Get audits for video
                a_res = await session.execute(select(AuditResult).where(AuditResult.video_id == v.id))
                audits = a_res.scalars().all()
                if not audits:
                    print("      No audits", flush=True)
                for a in audits:
                    print(f"      Audit: {a.audit_type.value if a.audit_type else 'None'} | Risk: {a.risk_score}", flush=True)

if __name__ == "__main__":
    asyncio.run(main())
