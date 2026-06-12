from sqlalchemy.orm import Session
from sqlalchemy import select, and_
from app.models import Video, Channel, AuditResult, ChannelScore, PolicyRisk, Severity, AuditType
import uuid
from typing import Dict, Any, List

class ReputationEngine:
    """Calculates threat scores, trust indexes, and monetization stability across videos, channels, and organizations."""

    AUDIT_WEIGHTS = {
        AuditType.SCRIPT_SIMILARITY: 0.15,
        AuditType.VISUAL_SIMILARITY: 0.15,
        AuditType.ASSET_REUSE: 0.20,
        AuditType.VOICE_FORENSIC: 0.20,
        AuditType.VELOCITY_ANOMALY: 0.05,
        AuditType.HUMAN_VALUE: 0.10,
        AuditType.DEEPFAKE_SCAN: 0.15
    }

    def calculate_video_risk(self, db: Session, video_id: str) -> float:
        """Calculates a risk score (0-100) for a single video based on its audit results."""
        stmt = select(AuditResult).where(AuditResult.video_id == video_id)
        results = db.scalars(stmt).all()
        if not results:
            return 0.0

        weighted_sum = 0.0
        total_weight = 0.0

        for r in results:
            weight = self.AUDIT_WEIGHTS.get(r.audit_type, 0.10)
            weighted_sum += r.risk_score * weight
            total_weight += weight

        if total_weight == 0:
            return 0.0

        return min(max(weighted_sum / total_weight, 0.0), 100.0)

    def calculate_channel_risk(self, db: Session, channel_id: str) -> float:
        """Calculates a risk score (0-100) for a channel combining video audits and semantic scores."""
        # 1. Average video risk
        stmt_videos = select(Video).where(Video.channel_id == channel_id)
        videos = db.scalars(stmt_videos).all()
        
        video_risks = [self.calculate_video_risk(db, v.id) for v in videos]
        avg_video_risk = float(sum(video_risks) / len(video_risks)) if video_risks else 0.0

        # 2. Semantic rigidity / originality
        stmt_scores = select(ChannelScore).where(ChannelScore.channel_id == channel_id)
        scores = db.scalars(stmt_scores).all()
        
        rigidity = 0.0
        originality = 100.0
        
        for s in scores:
            if s.score_type == "template_rigidity":
                rigidity = s.value
            elif s.score_type == "semantic_originality":
                originality = s.value

        # Calculate final channel risk: 40% avg video risk, 30% rigidity, 30% inverted originality
        inverted_originality = 100.0 - originality
        channel_risk = (avg_video_risk * 0.40) + (rigidity * 0.30) + (inverted_originality * 0.30)
        
        return min(max(channel_risk, 0.0), 100.0)

    def calculate_org_reputation(self, db: Session, org_id: str) -> Dict[str, Any]:
        """Calculates portfolio-wide Trust & Authenticity metrics and monetization stability."""
        # 1. Get all channels
        stmt_channels = select(Channel).where(Channel.org_id == org_id)
        channels = db.scalars(stmt_channels).all()
        if not channels:
            return {
                "trust_index": 100.0,
                "threat_score": 0.0,
                "monetization_stability": 100.0,
                "monetization_status": "EXCELLENT",
                "channel_scores": {}
            }

        channel_risks = {}
        for c in channels:
            risk = self.calculate_channel_risk(db, c.id)
            channel_risks[str(c.id)] = risk

        avg_channel_threat = sum(channel_risks.values()) / len(channel_risks)

        # 2. Active policy risks penalty
        stmt_policy = select(PolicyRisk).where(
            and_(PolicyRisk.org_id == org_id, PolicyRisk.is_active == True)
        )
        active_policies = db.scalars(stmt_policy).all()
        
        policy_penalty = 0.0
        for p in active_policies:
            if p.severity == Severity.CRITICAL:
                policy_penalty += 15.0
            elif p.severity == Severity.HIGH:
                policy_penalty += 10.0
            elif p.severity == Severity.MEDIUM:
                policy_penalty += 5.0
            else:
                policy_penalty += 2.0

        # Overall threat score (capped at 100)
        org_threat_score = min(avg_channel_threat + policy_penalty, 100.0)
        trust_index = 100.0 - org_threat_score

        # Monetization stability estimation
        monetization_stability = trust_index
        if monetization_stability > 80:
            status = "HIGH STABILITY"
        elif monetization_stability > 60:
            status = "MODERATE RISK"
        elif monetization_stability > 40:
            status = "HIGH RISK OF DEMONETIZATION"
        else:
            status = "CRITICAL COMPLIANCE THREAT"

        # Update organization scores in db via ChannelScore (or return)
        return {
            "trust_index": trust_index,
            "threat_score": org_threat_score,
            "monetization_stability": monetization_stability,
            "monetization_status": status,
            "channel_scores": channel_risks
        }

# Singleton instance
reputation_engine = ReputationEngine()
