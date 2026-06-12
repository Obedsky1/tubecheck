from typing import List, Dict, Any, Optional
from sqlalchemy.orm import Session
from sqlalchemy import select, and_
from app.models import AuditResult, PolicyRisk, Channel, Video, Severity, AuditType
import uuid

class PolicyCorrelationEngine:
    """Evaluates low-level forensic scan results against YouTube policies to predict compliance risks."""

    def evaluate_organization_risks(self, db: Session, org_id: str) -> List[PolicyRisk]:
        """Runs the rules engine on all active audit results for an organization."""
        # 1. Fetch all audit results for this organization in the last 7 days
        stmt = select(AuditResult).where(AuditResult.org_id == org_id)
        results = db.scalars(stmt).all()
        
        # Group audits by video / channel
        video_audits: Dict[uuid.UUID, List[AuditResult]] = {}
        for r in results:
            if r.video_id:
                if r.video_id not in video_audits:
                    video_audits[r.video_id] = []
                video_audits[r.video_id].append(r)

        # 2. Run policy rules
        detected_risks: List[Dict[str, Any]] = []

        # Rule A: Reused Content Risk
        reused_risk = self._check_reused_content(results, video_audits, db)
        if reused_risk:
            detected_risks.append(reused_risk)

        # Rule B: Inauthentic Behavior Risk
        inauthentic_risk = self._check_inauthentic_behavior(results, video_audits, db)
        if inauthentic_risk:
            detected_risks.append(inauthentic_risk)

        # Rule C: Spam & Deceptive Practices Risk
        spam_risk = self._check_spam_practices(results, db)
        if spam_risk:
            detected_risks.append(spam_risk)

        # Rule D: Synthetic Media Risk
        synthetic_risk = self._check_synthetic_media(results, video_audits, db)
        if synthetic_risk:
            detected_risks.append(synthetic_risk)

        # Rule E: Metadata Manipulation Risk
        metadata_risk = self._check_metadata_manipulation(results, db)
        if metadata_risk:
            detected_risks.append(metadata_risk)

        # Rule F: Channel Farm Pattern Risk
        farm_risk = self._check_channel_farm(results, db)
        if farm_risk:
            detected_risks.append(farm_risk)

        # Rule G: Coordinated Network Risk
        coordinated_risk = self._check_coordinated_network(results, db)
        if coordinated_risk:
            detected_risks.append(coordinated_risk)

        # Rule H: Community Guideline Escalation Risk
        guideline_risk = self._check_guideline_escalation(results, db)
        if guideline_risk:
            detected_risks.append(guideline_risk)

        # 3. Persist and return
        persisted_risks: List[PolicyRisk] = []
        
        # Deactivate old active risks for this org first
        deactivate_stmt = select(PolicyRisk).where(
            and_(PolicyRisk.org_id == org_id, PolicyRisk.is_active == True)
        )
        old_risks = db.scalars(deactivate_stmt).all()
        for orisk in old_risks:
            orisk.is_active = False
            
        db.commit()

        for risk_data in detected_risks:
            risk_record = PolicyRisk(
                org_id=uuid.UUID(org_id) if isinstance(org_id, str) else org_id,
                channel_id=risk_data.get("channel_id"),
                risk_category=risk_data["risk_category"],
                confidence=risk_data["confidence"],
                severity=risk_data["severity"],
                evidence=risk_data["evidence"],
                platform_signal=risk_data["platform_signal"],
                recommended_fixes=risk_data["recommended_fixes"],
                is_active=True
            )
            db.add(risk_record)
            persisted_risks.append(risk_record)

        db.commit()
        return persisted_risks

    def _check_reused_content(self, results: List[AuditResult], video_audits: Dict[uuid.UUID, List[AuditResult]], db: Session) -> Optional[Dict[str, Any]]:
        evidence = []
        confidence_signals = []
        channels_affected = set()

        script_sims = [r for r in results if r.audit_type == AuditType.SCRIPT_SIMILARITY and r.risk_score > 60]
        visual_sims = [r for r in results if r.audit_type == AuditType.VISUAL_SIMILARITY and r.risk_score > 60]
        asset_reuse = [r for r in results if r.audit_type == AuditType.ASSET_REUSE and r.risk_score > 50]

        if script_sims:
            max_sim = max(r.risk_score for r in script_sims)
            evidence.append(f"High script similarity detected: up to {max_sim:.1f}% transcript overlap.")
            confidence_signals.append(max_sim / 100.0)
            for r in script_sims:
                if r.video:
                    channels_affected.add(r.video.channel_id)

        if visual_sims:
            max_vis = max(r.risk_score for r in visual_sims)
            evidence.append(f"High thumbnail layout similarity: up to {max_vis:.1f}% correlation.")
            confidence_signals.append(max_vis / 100.0)
            for r in visual_sims:
                if r.video:
                    channels_affected.add(r.video.channel_id)

        if asset_reuse:
            max_asset = max(r.risk_score for r in asset_reuse)
            evidence.append(f"Footage reuse detected: shared video assets across channels ({max_asset:.1f}% matching).")
            confidence_signals.append(max_asset / 100.0)
            for r in asset_reuse:
                if r.video:
                    channels_affected.add(r.video.channel_id)

        if not evidence:
            return None

        confidence = sum(confidence_signals) / len(confidence_signals)
        severity = Severity.LOW
        if confidence > 0.8:
            severity = Severity.CRITICAL
        elif confidence > 0.6:
            severity = Severity.HIGH
        elif confidence > 0.4:
            severity = Severity.MEDIUM

        target_channel = list(channels_affected)[0] if channels_affected else None

        return {
            "channel_id": target_channel,
            "risk_category": "Reused Content Risk",
            "confidence": min(confidence, 1.0),
            "severity": severity,
            "evidence": evidence,
            "platform_signal": "Mass-produced repetitive content with low value add.",
            "recommended_fixes": [
                "Diversify scripting templates to avoid identical story pacing.",
                "Incorporate unique visual/audio commentary in each video.",
                "Stagger thumbnail designs rather than using identical visual templates.",
                "Reduce reuse of intro and outro animation files."
            ]
        }

    def _check_inauthentic_behavior(self, results: List[AuditResult], video_audits: Dict[uuid.UUID, List[AuditResult]], db: Session) -> Optional[Dict[str, Any]]:
        evidence = []
        voice_audits = [r for r in results if r.audit_type == AuditType.VOICE_FORENSIC and r.risk_score > 70]
        script_sims = [r for r in results if r.audit_type == AuditType.SCRIPT_SIMILARITY and r.risk_score > 75]

        if voice_audits:
            evidence.append("Multiple videos containing synthetic or cloned AI voices with low variance.")
        if script_sims:
            evidence.append(f"Highly repetitive script patterns ({len(script_sims)} instances of duplicated storytelling structures).")

        if not evidence:
            return None

        confidence = 0.5
        if voice_audits and script_sims:
            confidence = 0.85
            evidence.append("Combination of synthetic voice and reused scripts suggests automated production pipeline.")
        elif voice_audits:
            confidence = 0.70

        severity = Severity.HIGH if confidence > 0.75 else Severity.MEDIUM

        return {
            "channel_id": None,
            "risk_category": "Inauthentic Behavior Risk",
            "confidence": confidence,
            "severity": severity,
            "evidence": evidence,
            "platform_signal": "Automated, programmatic content generation designed to game watch time algorithms.",
            "recommended_fixes": [
                "Introduce human vocal narration or increase synthetic voice variance.",
                "Apply strict editing constraints to avoid automated-looking layouts.",
                "Introduce high-entropy, variable scripting topics."
            ]
        }

    def _check_spam_practices(self, results: List[AuditResult], db: Session) -> Optional[Dict[str, Any]]:
        velocity_alerts = [r for r in results if r.audit_type == AuditType.VELOCITY_ANOMALY and r.risk_score > 60]
        if not velocity_alerts:
            return None

        evidence = [
            f"Suspicious publishing behavior: extreme upload frequency bursts ({len(velocity_alerts)} scheduling anomalies detected)."
        ]
        
        return {
            "channel_id": None,
            "risk_category": "Spam & Deceptive Practices Risk",
            "confidence": 0.75,
            "severity": Severity.HIGH,
            "evidence": evidence,
            "platform_signal": "Rapid programmatic content publishing indicating network spamming.",
            "recommended_fixes": [
                "Stagger video publishing frequency to normal human patterns.",
                "Avoid identical topic cloning on the same day.",
                "Create unique titles and descriptions for each upload."
            ]
        }

    def _check_synthetic_media(self, results: List[AuditResult], video_audits: Dict[uuid.UUID, List[AuditResult]], db: Session) -> Optional[Dict[str, Any]]:
        voice_forensics = [r for r in results if r.audit_type == AuditType.VOICE_FORENSIC and r.risk_score > 50]
        deepfake_scans = [r for r in results if r.audit_type == AuditType.DEEPFAKE_SCAN and r.risk_score > 50]
        
        if not voice_forensics and not deepfake_scans:
            return None

        evidence = []
        max_prob = 0.0

        if voice_forensics:
            prob = max(r.risk_score for r in voice_forensics)
            max_prob = max(max_prob, prob)
            evidence.append(f"Acoustic features point to AI synthetic voice narration (probability up to {prob:.1f}%).")

        if deepfake_scans:
            prob = max(r.risk_score for r in deepfake_scans)
            max_prob = max(max_prob, prob)
            for r in deepfake_scans:
                if r.details:
                    audio_prob = r.details.get("audio_synthetic_probability", 0.0) * 100.0
                    visual_prob = r.details.get("visual_deepfake_probability", 0.0) * 100.0
                    if audio_prob > 50:
                        evidence.append(f"Uploaded audio classified as synthetic AI voice ({audio_prob:.1f}% confidence).")
                    if visual_prob > 50:
                        evidence.append(f"Uploaded video frames contain visual deepfake indicators ({visual_prob:.1f}% confidence).")

        if not evidence:
            evidence.append(f"Synthetic media scans flagged high probability of AI alteration ({max_prob:.1f}%).")

        return {
            "channel_id": None,
            "risk_category": "Synthetic Media Risk",
            "confidence": max_prob / 100.0,
            "severity": Severity.MEDIUM if max_prob < 80 else Severity.HIGH,
            "evidence": evidence,
            "platform_signal": "Unlabeled synthetic audio/video violates platform disclosure guidelines.",
            "recommended_fixes": [
                "Label video as containing altered or synthetic media in YouTube Creator Studio.",
                "Add human voice narration to lower synthetic voice signature.",
                "Blend background audio elements to reduce acoustic consistency."
            ]
        }


    def _check_metadata_manipulation(self, results: List[AuditResult], db: Session) -> Optional[Dict[str, Any]]:
        # Metadata duplication occurs if title templates match
        script_sims = [r for r in results if r.audit_type == AuditType.SCRIPT_SIMILARITY and r.details and r.details.get("title_similarity", 0) > 0.8]
        if not script_sims:
            return None

        evidence = [
            f"Highly repetitive title/metadata structures ({len(script_sims)} instances of over 80% title similarity)."
        ]

        return {
            "channel_id": None,
            "risk_category": "Metadata Manipulation Risk",
            "confidence": 0.65,
            "severity": Severity.MEDIUM,
            "evidence": evidence,
            "platform_signal": "Templated titles/descriptions designed to manipulate search queries.",
            "recommended_fixes": [
                "Write specific titles that accurately describe the unique aspect of each video.",
                "Avoid stuffing tags and keywords into video descriptions.",
                "Remove identical templated intro summaries in metadata."
            ]
        }

    def _check_channel_farm(self, results: List[AuditResult], db: Session) -> Optional[Dict[str, Any]]:
        velocity_audits = [r for r in results if r.audit_type == AuditType.VELOCITY_ANOMALY and r.risk_score > 70]
        script_sims = [r for r in results if r.audit_type == AuditType.SCRIPT_SIMILARITY and r.risk_score > 70]
        
        if not (velocity_audits and len(script_sims) > 2):
            return None

        evidence = [
            "Coordinated automated uploading combined with massive semantic redundancy.",
            "Structural narrative patterns matching content farm layouts."
        ]

        return {
            "channel_id": None,
            "risk_category": "Channel Farm Pattern Risk",
            "confidence": 0.80,
            "severity": Severity.CRITICAL,
            "evidence": evidence,
            "platform_signal": "Automated network designed for rapid views harvesting via cloned templates.",
            "recommended_fixes": [
                "Cease bulk automatic video generation.",
                "Stagger uploads to match authentic creator behaviors.",
                "Rethink the niche to provide high quality human-driven material."
            ]
        }

    def _check_coordinated_network(self, results: List[AuditResult], db: Session) -> Optional[Dict[str, Any]]:
        visual_sims = [r for r in results if r.audit_type == AuditType.VISUAL_SIMILARITY and r.risk_score > 70]
        asset_reuse = [r for r in results if r.audit_type == AuditType.ASSET_REUSE and r.risk_score > 70]

        if len(visual_sims) > 3 and len(asset_reuse) > 3:
            evidence = [
                "Cross-channel asset and visual fingerprint overlap indicating coordinated operations.",
                "Shared graphic templates and intro animations across the organization."
            ]
            return {
                "channel_id": None,
                "risk_category": "Coordinated Network Risk",
                "confidence": 0.88,
                "severity": Severity.HIGH,
                "evidence": evidence,
                "platform_signal": "Interconnected channels trying to control a search niche via identical sources.",
                "recommended_fixes": [
                    "Separate design workflows for different channels.",
                    "Ensure distinct visual branding (colors, shapes, layouts) per channel.",
                    "Disassociate publishing schedules."
                ]
            }
        return None

    def _check_guideline_escalation(self, results: List[AuditResult], db: Session) -> Optional[Dict[str, Any]]:
        guideline_violations = [r for r in results if r.audit_type in (AuditType.HUMAN_VALUE, AuditType.DEEPFAKE_SCAN) and r.risk_score > 50]
        if not guideline_violations:
            return None

        max_risk = max(r.risk_score for r in guideline_violations)
        evidence = [
            f"Safety or deepfake scan flagged potential violation (confidence score: {max_risk:.1f}%)."
        ]

        return {
            "channel_id": None,
            "risk_category": "Community Guideline Escalation Risk",
            "confidence": max_risk / 100.0,
            "severity": Severity.CRITICAL if max_risk > 80 else Severity.HIGH,
            "evidence": evidence,
            "platform_signal": "Violative content (deepfakes, hateful, dangerous, or graphic items) in video streams.",
            "recommended_fixes": [
                "Remove and delete flagged content immediately before platform strike.",
                "Rerun internal safety checks before publishing any AI-generated facial/vocal swaps.",
                "Ensure compliance with hate speech and safety policies."
            ]
        }

# Singleton instance
policy_engine = PolicyCorrelationEngine()
