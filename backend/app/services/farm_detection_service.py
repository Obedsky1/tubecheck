# numpy imported lazily inside methods to avoid loading ~50MB in the API process
from sqlalchemy.orm import Session
from sqlalchemy import select
from app.models import Video, Channel, AuditResult, AuditType
from datetime import datetime, timedelta
import collections
import math
from typing import Dict, Any, List

class FarmDetectionService:
    """Service to detect coordinated network behavior, content farms, and automated publishing footprints."""

    def analyze_network_velocity(self, db: Session, org_id: str) -> Dict[str, Any]:
        """Runs the Network Velocity Radar to detect content farms, synchronized uploads, and template cloning."""
        import numpy as np  # lazy import — not needed in API process
        # 1. Fetch channels and recent videos (last 30 days)
        stmt_channels = select(Channel).where(Channel.org_id == org_id)
        channels = db.scalars(stmt_channels).all()
        channel_ids = [c.id for c in channels]
        
        if not channels:
            return self._empty_result()

        stmt_videos = select(Video).where(Video.channel_id.in_(channel_ids)).order_by(Video.published_at.desc())
        videos = db.scalars(stmt_videos).all()
        
        if len(videos) < 5:
            return self._empty_result()

        # 2. Synchronized uploads and scheduling cadence
        timestamps = [v.published_at for v in videos if v.published_at]
        timestamps.sort()

        synchronized_count = 0
        precise_schedule_count = 0  # Published exactly on the hour or half-hour (e.g. :00, :30)
        intervals = []

        channel_timestamps = collections.defaultdict(list)
        for v in videos:
            if v.published_at:
                channel_timestamps[v.channel_id].append(v.published_at)

        # Pairwise synchronized check across channels
        for i in range(len(videos)):
            for j in range(i + 1, len(videos)):
                v1, v2 = videos[i], videos[j]
                if v1.channel_id != v2.channel_id and v1.published_at and v2.published_at:
                    diff = abs((v1.published_at - v2.published_at).total_seconds())
                    if diff <= 900:  # 15 minutes window
                        synchronized_count += 1

        # Check for scheduling precision (:00 or :30 minutes)
        for ts in timestamps:
            if ts.minute in (0, 30) and ts.second == 0:
                precise_schedule_count += 2
            elif ts.minute in (0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55):
                precise_schedule_count += 1

        # Calculate upload intervals within the same channel to detect pacing rigidity
        for cid, tss in channel_timestamps.items():
            tss.sort()
            for k in range(1, len(tss)):
                intervals.append((tss[k] - tss[k-1]).total_seconds())

        # 3. Metadata Entropy Collapse ( Shannon Entropy on descriptions/titles )
        descriptions = [v.description for v in videos if v.description]
        titles = [v.title for v in videos if v.title]

        avg_title_entropy = self._calculate_avg_shannon_entropy(titles) if titles else 8.0
        avg_desc_entropy = self._calculate_avg_shannon_entropy(descriptions) if descriptions else 8.0

        # Title formatting similarity (e.g. check for same capitalization ratio, punctuation, emoji count)
        caps_ratios = []
        for t in titles:
            letters = [c for c in t if c.isalpha()]
            if letters:
                caps_ratios.append(sum(1 for c in letters if c.isupper()) / len(letters))
        caps_variance = float(np.var(caps_ratios)) if len(caps_ratios) > 1 else 1.0

        # 4. Same-day topic cloning (fetch cross-channel duplicates)
        # We can approximate this by querying AuditResults of type SCRIPT_SIMILARITY
        stmt_audits = select(AuditResult).where(
            AuditResult.org_id == org_id
        )
        audits = db.scalars(stmt_audits).all()
        
        script_sim_count = sum(1 for r in audits if r.audit_type == AuditType.SCRIPT_SIMILARITY and r.risk_score > 70)
        visual_sim_count = sum(1 for r in audits if r.audit_type == AuditType.VISUAL_SIMILARITY and r.risk_score > 70)

        # 5. Compile Indices
        # Automation Footprint Index: High if precise scheduling, low title entropy, synchronized uploads, zero variance in caps ratio
        scheduling_factor = min(precise_schedule_count / max(len(videos), 1) * 50.0, 50.0)
        sync_factor = min(synchronized_count / max(len(videos), 1) * 30.0, 30.0)
        entropy_factor = max(0.0, (6.0 - avg_desc_entropy) * 10.0) if descriptions else 0.0
        
        automation_index = min(scheduling_factor + sync_factor + entropy_factor + (10.0 if caps_variance < 0.05 else 0.0), 100.0)

        # Cross-Channel Contamination: High if massive visual/script duplication
        contamination_score = min(((script_sim_count * 15.0) + (visual_sim_count * 10.0)) / max(len(channels), 1), 100.0)

        # Content Farm Probability: Aggregation of automation footprint, contamination, and network scaling velocity
        # Let's say if daily uploads across the network is high (> 3 per channel per day)
        days_span = 30
        if timestamps:
            span = (timestamps[-1] - timestamps[0]).days
            if span > 0:
                days_span = span
        uploads_per_day_per_channel = len(videos) / max(len(channels), 1) / max(days_span, 1)
        velocity_factor = min(uploads_per_day_per_channel * 15.0, 30.0)

        farm_probability = (automation_index * 0.40) + (contamination_score * 0.40) + (velocity_factor * 1.0)
        farm_probability = min(max(farm_probability / 100.0, 0.0), 1.0)

        return {
            "content_farm_probability": farm_probability,
            "automation_footprint_index": automation_index,
            "cross_channel_contamination_score": contamination_score,
            "metrics": {
                "synchronized_uploads": synchronized_count,
                "precise_scheduling_ratio": precise_schedule_count / max(len(videos), 1),
                "average_description_entropy": avg_desc_entropy,
                "average_title_entropy": avg_title_entropy,
                "title_casing_variance": caps_variance,
                "uploads_per_channel_per_day": uploads_per_day_per_channel,
                "duplicate_scripts_found": script_sim_count,
                "duplicate_thumbnails_found": visual_sim_count
            }
        }

    def _calculate_avg_shannon_entropy(self, texts: List[str]) -> float:
        """Calculates character-level Shannon Entropy for a list of texts."""
        entropies = []
        for text in texts:
            if not text:
                continue
            # Calculate char counts
            counts = collections.Counter(text)
            total = len(text)
            entropy = -sum((count / total) * math.log2(count / total) for count in counts.values())
            entropies.append(entropy)
        return float(np.mean(entropies)) if entropies else 8.0

    def _empty_result(self) -> Dict[str, Any]:
        return {
            "content_farm_probability": 0.0,
            "automation_footprint_index": 0.0,
            "cross_channel_contamination_score": 0.0,
            "metrics": {
                "synchronized_uploads": 0,
                "precise_scheduling_ratio": 0.0,
                "average_description_entropy": 8.0,
                "average_title_entropy": 8.0,
                "title_casing_variance": 1.0,
                "uploads_per_channel_per_day": 0.0,
                "duplicate_scripts_found": 0,
                "duplicate_thumbnails_found": 0
            }
        }

# Singleton instance
farm_detection_service = FarmDetectionService()
