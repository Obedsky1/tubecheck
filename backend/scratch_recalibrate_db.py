import asyncio
import sys
import numpy as np
from sqlalchemy import select
from app.database import async_session_factory
from app.models import Video, AuditResult, AuditType, VideoStatus, Severity

sys.stdout.reconfigure(encoding='utf-8')

# Same logic as updated SyntheticMediaAnalyzer
def combine_forensic_scores(scores: dict) -> float:
    weights = {
        "fft_artifacts": 2.0,      # High freq grids
        "optical_flow": 2.5,       # Boundary morphing
        "geometric_invariance": 2.0, # Warped shapes
        "bicoherence": 2.5,        # Audio phase-coupling
        "phase_mapping": 1.5,      # Audio phase regularity
        "micro_pauses": 1.5,       # Audio pause/breath checks
    }
    
    product = 1.0
    for key, p in scores.items():
        w = weights.get(key, 1.0)
        p = max(0.0, min(1.0, p))
        
        # Suppress low-confidence baseline variance
        if p < 0.40:
            p_adjusted = p * 0.15
        else:
            p_adjusted = p
            
        product *= (1.0 - p_adjusted) ** w
        
    return float(1.0 - product)

def compute_severity(risk_score: float) -> Severity:
    if risk_score >= 80:
        return Severity.CRITICAL
    if risk_score >= 60:
        return Severity.HIGH
    if risk_score >= 40:
        return Severity.MEDIUM
    return Severity.LOW

async def main():
    async with async_session_factory() as session:
        print("Recalibrating existing database audits...")
        
        # Get all DEEPFAKE_SCAN audits
        res = await session.execute(
            select(AuditResult).where(AuditResult.audit_type == AuditType.DEEPFAKE_SCAN)
        )
        audits = res.scalars().all()
        
        for a in audits:
            details = a.details or {}
            vis_details = details.get("visual_details", {})
            aud_details = details.get("audio_details", {})
            
            # Recalculate visual components
            raw_fft = vis_details.get("raw_fft_peak_ratio", 0.0)
            raw_flow = vis_details.get("raw_mean_optical_flow_gradient", 0.0)
            raw_geom = vis_details.get("raw_mean_warp_deviation", 0.0)
            
            # Recalculate probabilities
            p_fft = min(raw_fft / 0.0003, 1.0)
            p_flow = 1.0 / (1.0 + np.exp(-1.5 * (raw_flow - 2.5)))
            
            # Use new calibrated threshold (0.65) and slope (12.0)
            p_geom = 1.0 / (1.0 + np.exp(-12.0 * (raw_geom - 0.65)))
            
            # Calculate local visual probability
            local_visual_prob = combine_forensic_scores({
                "fft_artifacts": p_fft,
                "optical_flow": p_flow,
                "geometric_invariance": p_geom
            })
            
            sightengine_score = vis_details.get("sightengine_score", 0.0)
            final_visual_prob = max(sightengine_score, local_visual_prob)
            
            # Recalculate combined score
            audio_prob = details.get("audio_synthetic_probability", 0.0)
            combined_features = {
                "fft_artifacts": p_fft,
                "optical_flow": p_flow,
                "geometric_invariance": p_geom,
                "bicoherence": aud_details.get("bicoherence_probability", 0.0),
                "phase_mapping": aud_details.get("phase_mapping_probability", 0.0),
                "micro_pauses": aud_details.get("micro_pauses_probability", 0.0),
            }
            combined_prob = combine_forensic_scores(combined_features)
            combined_prob = max(combined_prob, final_visual_prob, audio_prob)
            combined_risk = combined_prob * 100.0
            
            # Update values in details dict
            vis_details["fft_artifacts_probability"] = p_fft
            vis_details["optical_flow_probability"] = p_flow
            vis_details["geometric_invariance_probability"] = p_geom
            
            details["visual_deepfake_probability"] = final_visual_prob
            details["combined_forensic_score"] = combined_prob
            details["recalibrated"] = True
            
            # Force update details back to SQLAlchemy
            a.details = details
            a.risk_score = round(combined_risk, 2)
            a.severity = compute_severity(combined_risk)
            
            print(f"Video {a.video_id}: New Risk Score = {a.risk_score}%, Severity = {a.severity.value}")
            
            # Update the global video status
            v_res = await session.execute(select(Video).where(Video.id == a.video_id))
            video = v_res.scalar_one_or_none()
            if video:
                # Re-compute status based on all audits
                all_aud_res = await session.execute(select(AuditResult).where(AuditResult.video_id == video.id))
                other_audits = all_aud_res.scalars().all()
                
                # Use updated database values
                max_risk = max(r.risk_score for r in other_audits) if other_audits else a.risk_score
                if max_risk >= 60.0:
                    video.status = VideoStatus.FLAGGED
                else:
                    video.status = VideoStatus.COMPLETED
                print(f"  Video Status updated to: {video.status.value}")
                
        await session.commit()
        print("Recalibration complete and committed!")

if __name__ == "__main__":
    asyncio.run(main())
