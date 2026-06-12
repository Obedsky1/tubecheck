from sqlalchemy.orm import Session
from sqlalchemy import select
from app.models import PolicyRisk, Severity
from app.config import get_settings
from typing import List, Dict, Any

class RemediationEngine:
    """Generates educational remediation steps, platform interpretations, and actionable checklists to fix compliance issues."""

    REMEDIATION_TEMPLATES = {
        "Reused Content Risk": {
            "why_it_matters": "YouTube's Partner Program policies strictly prohibit channels that post content that is highly similar or indistinguishable across videos, even if you own the copyrights.",
            "likely_platform_interpretation": "Mass-produced repetitive content lacking significant commentary or educational value.",
            "expected_impact": "Restores eligibility for the YouTube Partner Program (YPP) and prevents monetization suspension.",
            "recommended_fixes": [
                "Diversify scripting templates to ensure each video follows a unique narrative arc.",
                "Incorporate custom visual animations and commentary rather than using a single background asset across all videos.",
                "Stagger thumbnail layouts (avoid placing the same character/text elements in the exact same positions across 5+ videos).",
                "Stagger video intros: make the first 30 seconds of every video completely unique in pacing and visual hooks."
            ]
        },
        "Inauthentic Behavior Risk": {
            "why_it_matters": "Automated text-to-speech generators paired with templated video footage are heavily scrutinized by content quality algorithms.",
            "likely_platform_interpretation": "Low-effort automated content farming designed to artificially inflate watch time metrics.",
            "expected_impact": "Reduces probability of channel suspension, search shadowbans, and algorithmic suppression.",
            "recommended_fixes": [
                "Utilize human voiceovers or highly humanized synthetic voice models with realistic intonation and pacing.",
                "Add original scripts with higher vocabulary variance and variable storytelling elements.",
                "Stagger publishing schedules to match organic creator behavior rather than robotic batch uploads."
            ]
        },
        "Spam & Deceptive Practices Risk": {
            "why_it_matters": "Uploading large quantities of videos in short bursts triggers system spam filters.",
            "likely_platform_interpretation": "Coordinated traffic redirect spam or keyword stuffing behavior.",
            "expected_impact": "Clears community guideline flag risks and avoids accounts suspension.",
            "recommended_fixes": [
                "Adopt a consistent, staggered upload cadence (e.g. 1-2 videos per day maximum per channel).",
                "Ensure titles and descriptions do not repeat blocks of generic tag keywords.",
                "Stagger video metadata elements so each upload has completely custom titles."
            ]
        },
        "Synthetic Media Risk": {
            "why_it_matters": "New platform transparency guidelines require creators to label realistic synthetic voices and video swaps.",
            "likely_platform_interpretation": "Failure to disclose synthetic media, leading to penalty strikes.",
            "expected_impact": "Restores account standing and avoids penalty strikes under new digital replica guidelines.",
            "recommended_fixes": [
                "Enable the 'Altered Content' disclosure checkbox in YouTube Creator Studio for flagged videos.",
                "Incorporate a clear audio or text disclaimer inside the video intro (e.g., 'Narrated by AI').",
                "Diversify synthetic voice models across the channel portfolio."
            ]
        },
        "Metadata Manipulation Risk": {
            "why_it_matters": "Search engine algorithms penalize channels that use identical metadata layouts to control search terms.",
            "likely_platform_interpretation": "Gaming the recommendation system via metadata templating.",
            "expected_impact": "Improves organic impressions and search rankings by building metadata relevance.",
            "recommended_fixes": [
                "Write bespoke, description-focused metadata instead of utilizing standard 500-word templated scripts.",
                "Never dump keywords or duplicate title patterns across multiple videos.",
                "Ensure links and disclaimers are clean and do not look like spam blocks."
            ]
        },
        "Channel Farm Pattern Risk": {
            "why_it_matters": "Running dozens of channels that host highly overlapping content is classified as a content network violation.",
            "likely_platform_interpretation": "Syndicated network content farm designed to manipulate platform reach.",
            "expected_impact": "Prevents global network termination and channel demonetization warnings.",
            "recommended_fixes": [
                "Differentiate channel themes, target niches, and branding.",
                "Avoid uploading the exact same video file, audio file, or script to different channels.",
                "Limit the active number of sub-channels publishing identical topics."
            ]
        },
        "Coordinated Network Risk": {
            "why_it_matters": "Cross-channel footprints indicate that multiple profiles are managed by a single automation script or group.",
            "likely_platform_interpretation": "Syndicated coordinated publishing network.",
            "expected_impact": "Safeguards the parent organization and all child channels from chain termination.",
            "recommended_fixes": [
                "Use separate IP proxies, upload schedules, and video editing environments for each channel.",
                "Differentiate video assets (background music, sound effects, voice actors) across channels.",
                "Establish distinct creative directions for each brand."
            ]
        },
        "Community Guideline Escalation Risk": {
            "why_it_matters": "Violations of community safety, deepfake replicas, and hate speech guidelines lead to permanent channel deletion.",
            "likely_platform_interpretation": "High-risk safety threat requiring immediate administrative action.",
            "expected_impact": "Maintains channel standing and prevents immediate deletion or monetization ban.",
            "recommended_fixes": [
                "Delete flagged videos immediately from your YouTube channel.",
                "Rerun internal safety checks before publishing any AI-generated facial/vocal swaps.",
                "Review the YouTube community guidelines regarding sensitive, graphic, or hateful content."
            ]
        }
    }

    def generate_remediation_items(self, db: Session, org_id: str) -> List[Dict[str, Any]]:
        """Scans active PolicyRisks for an organization and builds custom remediation steps."""
        stmt = select(PolicyRisk).where(
            PolicyRisk.org_id == org_id,
            PolicyRisk.is_active == True
        )
        risks = db.scalars(stmt).all()
        
        remediations = []
        
        for risk in risks:
            template = self.REMEDIATION_TEMPLATES.get(
                risk.risk_category, 
                {
                    "why_it_matters": "Failure to follow platform content guidelines can result in monetization loss or channel termination.",
                    "likely_platform_interpretation": "Platform policy non-compliance.",
                    "expected_impact": "Maintains channel standing and monetization.",
                    "recommended_fixes": ["Review flagged content and adjust narrative variance."]
                }
            )

            # Build a structured item
            item = {
                "id": str(risk.id),
                "risk_category": risk.risk_category,
                "severity": risk.severity.value if hasattr(risk.severity, 'value') else str(risk.severity),
                "confidence": risk.confidence,
                "why_it_matters": template["why_it_matters"],
                "likely_platform_interpretation": template["likely_platform_interpretation"],
                "expected_impact": template["expected_impact"],
                "recommended_fixes": risk.recommended_fixes if risk.recommended_fixes else template["recommended_fixes"],
                "evidence": risk.evidence,
                "created_at": risk.created_at.isoformat() if hasattr(risk.created_at, 'isoformat') else str(risk.created_at)
            }
            remediations.append(item)

        # AI Enhancement if OpenAI is available
        settings = get_settings()
        if settings.OPENAI_API_KEY and remediations:
            try:
                # We could run an OpenAI call here to enrich the recommended fixes, but let's keep it robust and offline-friendly 
                # by default unless a special flag is set, as requested in design requirements.
                pass
            except Exception as e:
                print(f"Error calling OpenAI in remediation: {e}")

        return remediations

# Singleton instance
remediation_engine = RemediationEngine()
