import asyncio
import uuid
import datetime
from sqlalchemy import select, delete
from app.database import async_session_factory, Base
from app.models import (
    User, Organization, Channel, Video, AuditResult, NetworkAlert, PolicyRisk,
    ChannelStatus, VideoStatus, AuditType, Severity, TranscriptSource
)

async def seed_mock_data():
    async with async_session_factory() as db:
        # 1. Fetch test user and org
        user_res = await db.execute(select(User).where(User.email == "test@example.com"))
        user = user_res.scalar_one_or_none()
        if not user:
            print("Please run seed_test_user.py first.")
            return

        org_res = await db.execute(select(Organization).where(Organization.owner_id == user.id))
        org = org_res.scalar_one_or_none()
        if not org:
            print("Organization not found for test user.")
            return
        
        org_id = org.id
        print(f"Found Org: {org.name} ({org_id})")

        # Clean existing mock records to avoid duplicates
        await db.execute(delete(PolicyRisk).where(PolicyRisk.org_id == org_id))
        await db.execute(delete(NetworkAlert).where(NetworkAlert.org_id == org_id))
        await db.execute(delete(AuditResult).where(AuditResult.org_id == org_id))
        
        # Delete existing videos & channels for this org
        ch_stmt = select(Channel).where(Channel.org_id == org_id)
        channels_to_del = (await db.execute(ch_stmt)).scalars().all()
        for ch in channels_to_del:
            await db.execute(delete(Video).where(Video.channel_id == ch.id))
            await db.delete(ch)
        await db.flush()

        # 2. Add Channels
        mock_channels = [
            {"id": uuid.uuid4(), "title": "TrendVerse Daily", "youtube_channel_id": "UC_trendverse", "custom_url": "@trendverse", "subscriber_count": 1200000, "video_count": 142},
            {"id": uuid.uuid4(), "title": "QuickFacts Hub", "youtube_channel_id": "UC_quickfacts", "custom_url": "@quickfacts", "subscriber_count": 486000, "video_count": 98},
            {"id": uuid.uuid4(), "title": "StoryShorts", "youtube_channel_id": "UC_storyshorts", "custom_url": "@storyshorts", "subscriber_count": 2100000, "video_count": 311},
            {"id": uuid.uuid4(), "title": "Cinemind", "youtube_channel_id": "UC_cinemind", "custom_url": "@cinemind", "subscriber_count": 920000, "video_count": 64},
            {"id": uuid.uuid4(), "title": "BriefRoom", "youtube_channel_id": "UC_briefroom", "custom_url": "@briefroom", "subscriber_count": 215000, "video_count": 47},
        ]
        
        channel_map = {}
        for c in mock_channels:
            ch_obj = Channel(
                id=c["id"],
                org_id=org_id,
                youtube_channel_id=c["youtube_channel_id"],
                title=c["title"],
                custom_url=c["custom_url"],
                subscriber_count=c["subscriber_count"],
                video_count=c["video_count"],
                status=ChannelStatus.ACTIVE,
                thumbnail_url=f"https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=100&auto=format&fit=crop&q=60"
            )
            db.add(ch_obj)
            channel_map[c["title"]] = ch_obj
            print(f"Seeding Channel: {c['title']}")

        await db.flush()

        # 3. Add Videos for each channel
        video_map = {}
        for title, ch_obj in channel_map.items():
            for i in range(1, 6):
                video_id = uuid.uuid4()
                # Determine status
                v_status = VideoStatus.COMPLETED
                if title == "TrendVerse Daily" and i == 1:
                    v_status = VideoStatus.FLAGGED
                elif title == "StoryShorts" and i == 2:
                    v_status = VideoStatus.FLAGGED

                vid = Video(
                    id=video_id,
                    channel_id=ch_obj.id,
                    youtube_video_id=f"yt_vid_{ch_obj.youtube_channel_id}_{i}",
                    title=f"{title} - Video #{i} Analysis Target",
                    description=f"Auto-generated analysis video for {title} showing visual metrics.",
                    published_at=datetime.datetime.now(datetime.timezone.utc) - datetime.timedelta(days=i),
                    duration_seconds=300 + i * 50,
                    thumbnail_url="https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=300&auto=format&fit=crop&q=60",
                    transcript_source=TranscriptSource.WHISPER,
                    caption_text="This is a test transcript payload containing repetitive scripting structures.",
                    view_count=5000 * i,
                    like_count=250 * i,
                    status=v_status
                )
                db.add(vid)
                video_map[f"{title}_{i}"] = vid
        
        await db.flush()

        # 4. Add Audit Results
        # SCRIPT_SIMILARITY matching TrendVerse #1 with StoryShorts #1
        vid_a = video_map["TrendVerse Daily_1"]
        vid_b = video_map["StoryShorts_1"]
        vid_c = video_map["QuickFacts Hub_1"]

        # TrendVerse Daily_1 (high risk)
        db.add(AuditResult(
            org_id=org_id,
            video_id=vid_a.id,
            audit_type=AuditType.SCRIPT_SIMILARITY,
            risk_score=92.5,
            severity=Severity.HIGH,
            details={
                "matched_pairs": [
                    {"video_a_id": str(vid_a.id), "video_b_id": str(vid_b.id), "similarity_score": 0.925}
                ]
            },
            compared_with_video_id=vid_b.id
        ))
        db.add(AuditResult(
            org_id=org_id,
            video_id=vid_a.id,
            audit_type=AuditType.VISUAL_SIMILARITY,
            risk_score=85.0,
            severity=Severity.HIGH,
            details={
                "matched_pairs": [
                    {"video_a_id": str(vid_a.id), "video_b_id": str(vid_b.id), "similarity_score": 0.85}
                ]
            },
            compared_with_video_id=vid_b.id
        ))
        db.add(AuditResult(
            org_id=org_id,
            video_id=vid_a.id,
            audit_type=AuditType.ASSET_REUSE,
            risk_score=94.0,
            severity=Severity.HIGH,
            details={"reused_asset_percentage": 94.0}
        ))
        db.add(AuditResult(
            org_id=org_id,
            video_id=vid_a.id,
            audit_type=AuditType.VOICE_FORENSIC,
            risk_score=20.0,
            severity=Severity.LOW,
            details={"synthetic_probability": 20.0}
        ))

        # QuickFacts Hub_1 (medium risk, synthetic voice)
        db.add(AuditResult(
            org_id=org_id,
            video_id=vid_c.id,
            audit_type=AuditType.VOICE_FORENSIC,
            risk_score=78.0,
            severity=Severity.MEDIUM,
            details={"synthetic_probability": 78.0}
        ))
        db.add(AuditResult(
            org_id=org_id,
            video_id=vid_c.id,
            audit_type=AuditType.SCRIPT_SIMILARITY,
            risk_score=15.0,
            severity=Severity.LOW
        ))

        # StoryShorts_2 (velocity anomaly)
        vid_s2 = video_map["StoryShorts_2"]
        db.add(AuditResult(
            org_id=org_id,
            video_id=vid_s2.id,
            audit_type=AuditType.VELOCITY_ANOMALY,
            risk_score=81.0,
            severity=Severity.HIGH,
            details={"multiplier_vs_baseline": 3.4}
        ))

        # Cinemind_1 (low risk)
        vid_cm1 = video_map["Cinemind_1"]
        db.add(AuditResult(
            org_id=org_id,
            video_id=vid_cm1.id,
            audit_type=AuditType.SCRIPT_SIMILARITY,
            risk_score=8.0,
            severity=Severity.LOW
        ))

        # 5. Seed Alerts (NetworkAlerts)
        db.add(NetworkAlert(
            org_id=org_id,
            alert_type="THUMBNAIL_CLONE",
            severity=Severity.HIGH,
            title="Thumbnail similarity >92% with 3 channels",
            description="Reused thumbnail templates detected across TrendVerse Daily and StoryShorts.",
            affected_channel_ids=[channel_map["TrendVerse Daily"].id, channel_map["StoryShorts"].id],
            is_resolved=False
        ))
        db.add(NetworkAlert(
            org_id=org_id,
            alert_type="SYNTHETIC_VOICE",
            severity=Severity.MEDIUM,
            title="Synthetic voice probability rising",
            description="QuickFacts Hub is publishing videos with highly suspected synthetic text-to-speech models without Altered Content declarations.",
            affected_channel_ids=[channel_map["QuickFacts Hub"].id],
            is_resolved=False
        ))
        db.add(NetworkAlert(
            org_id=org_id,
            alert_type="VELOCITY_SPIKE",
            severity=Severity.HIGH,
            title="Upload velocity 3.4× baseline",
            description="Pacing radar detected coordinated batch scheduling on StoryShorts (7 uploads in a single hour slot).",
            affected_channel_ids=[channel_map["StoryShorts"].id],
            is_resolved=False
        ))
        db.add(NetworkAlert(
            org_id=org_id,
            alert_type="SCRIPT_OVERLAP",
            severity=Severity.LOW,
            title="Transcript overlap with archive",
            description="Cinemind intro segment shares 30% word-for-word repetition with 2025 library assets.",
            affected_channel_ids=[channel_map["Cinemind"].id],
            is_resolved=False
        ))
        db.add(NetworkAlert(
            org_id=org_id,
            alert_type="ASSET_REUSE",
            severity=Severity.MEDIUM,
            title="Reused B-roll detected across 6 videos",
            description="Identical background looping stock media files identified in BriefRoom.",
            affected_channel_ids=[channel_map["BriefRoom"].id],
            is_resolved=False
        ))

        # 6. Seed Policy Risks
        db.add(PolicyRisk(
            org_id=org_id,
            channel_id=channel_map["TrendVerse Daily"].id,
            risk_category="Reused Content Risk",
            confidence=0.92,
            severity=Severity.HIGH,
            evidence=["Script similarity 92.5% with StoryShorts", "Asset overlap 94%"],
            platform_signal="Reused Content demonetization penalty",
            recommended_fixes=[
                "Rotate 14 reused thumbnails on TrendVerse Daily",
                "Diversify script openers across TrendVerse Daily",
                "Replace background clips to introduce fresh visuals"
            ],
            is_active=True
        ))
        db.add(PolicyRisk(
            org_id=org_id,
            channel_id=channel_map["StoryShorts"].id,
            risk_category="Spam & Deceptive Practices Risk",
            confidence=0.84,
            severity=Severity.HIGH,
            evidence=["Upload frequency 3.4x baseline threshold"],
            platform_signal="Coordinated upload spam flag",
            recommended_fixes=[
                "Reduce upload cadence on StoryShorts by 30%",
                "Stagger publish times organically across a 24-hour window"
            ],
            is_active=True
        ))
        db.add(PolicyRisk(
            org_id=org_id,
            channel_id=channel_map["QuickFacts Hub"].id,
            risk_category="Synthetic Media Risk",
            confidence=0.78,
            severity=Severity.MEDIUM,
            evidence=["Acoustic speech model matching synthetic indicators at 78%"],
            platform_signal="Unlabeled Altered Content warning",
            recommended_fixes=[
                "Replace synthetic narration on QuickFacts Hub with natural audio",
                "Check the altered content disclosure in Creator Studio"
            ],
            is_active=True
        ))

        await db.commit()
        print("Mock data seeded successfully!")

if __name__ == "__main__":
    asyncio.run(seed_mock_data())
