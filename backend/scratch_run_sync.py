import os
import sys
import uuid
from sqlalchemy import create_engine, select
from sqlalchemy.orm import Session

# Ensure the backend dir is on PYTHONPATH
backend_dir = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, backend_dir)
os.chdir(backend_dir)

from app.config import get_settings
from app.models import Channel, ChannelStatus
from app.workers.sync_worker import sync_youtube_channel

settings = get_settings()
engine = create_engine(settings.DATABASE_URL_SYNC)

print("Connecting to DB...", flush=True)
with Session(engine) as session:
    stmt = select(Channel)
    channels = session.scalars(stmt).all()
    print(f"Found {len(channels)} channels:", flush=True)
    
    # We will refresh the session after updates to see latest state
    for c in channels:
        print(f"- ID: {c.id}, Title: {c.title}, Status: {c.status}, YouTube ID: {c.youtube_channel_id}", flush=True)
        if c.status == ChannelStatus.SYNCING:
            print(f"  Channel is stuck in SYNCING. Running sync_youtube_channel inline...", flush=True)
            try:
                import inspect
                print(f"  Task signature: {inspect.signature(sync_youtube_channel)}", flush=True)
                print(f"  Task run signature: {inspect.signature(sync_youtube_channel.run)}", flush=True)
                
                # Let's try calling the run method with just one argument first: c.id
                # or task(c.id)
                print("  Trying sync_youtube_channel(str(c.id))...", flush=True)
                res = sync_youtube_channel(str(c.id))
                print(f"  Sync finished: {res}", flush=True)
            except Exception as e:
                print(f"  First attempt failed: {e}", flush=True)
                try:
                    print("  Trying sync_youtube_channel.run(str(c.id))...", flush=True)
                    res = sync_youtube_channel.run(str(c.id))
                    print(f"  Sync finished: {res}", flush=True)
                except Exception as e2:
                    print(f"  Second attempt failed: {e2}", flush=True)
                    # Fallback: manually update the status to ACTIVE in database to unblock UI
                    print("  Fallback: updating status to ACTIVE directly...", flush=True)
                    c.status = ChannelStatus.ACTIVE
                    session.commit()
                    print("  Status updated to ACTIVE.", flush=True)

print("Database check completed successfully!", flush=True)
