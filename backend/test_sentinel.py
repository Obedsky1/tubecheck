import asyncio
from sqlalchemy import select
from app.database import async_session_maker
from app.models import Channel, Organization, AuditResult, Video, VideoStatus

async def main():
    async with async_session_maker() as session:
        print("--- Sentinel Channel ---")
        ch = await session.execute(select(Channel).where(Channel.id == '00000000-0000-0000-0000-000000000000'))
        ch = ch.scalar()
        if ch:
            print(f'Sentinel org_id: {ch.org_id}')
        else:
            print("No sentinel channel.")
            
        print("\n--- Organizations ---")
        orgs = await session.execute(select(Organization))
        orgs = orgs.scalars().all()
        for o in orgs:
            print(f'Org: {o.id} - {o.name}')
            
        print("\n--- Uploaded Videos ---")
        videos = await session.execute(select(Video).where(Video.channel_id == '00000000-0000-0000-0000-000000000000'))
        videos = videos.scalars().all()
        for v in videos:
            print(f'Video: {v.id} - Status: {v.status} - Created: {v.created_at}')
            
        print("\n--- Audit Results ---")
        audits = await session.execute(select(AuditResult))
        audits = audits.scalars().all()
        for a in audits:
            print(f'Audit: {a.id} - Video: {a.video_id} - Org: {a.org_id} - Type: {a.audit_type}')

if __name__ == "__main__":
    asyncio.run(main())
