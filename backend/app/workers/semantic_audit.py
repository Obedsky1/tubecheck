import logging
import uuid
from app.celery_app import celery_app
from app.workers.task_utils import get_sync_db_session, compute_severity
from app.services.embedding_service import embedding_service
from app.services.semantic_service import semantic_service
from app.services.policy_engine import policy_engine
from app.services.reputation_service import reputation_engine
from app.models import AuditResult, AuditType, Video, Channel, ContentEmbedding
from sqlalchemy import select, and_

logger = logging.getLogger(__name__)

@celery_app.task(name="app.workers.semantic_audit.run_semantic_audit", bind=True, max_retries=3)
def run_semantic_audit(self, org_id: str) -> dict:
    """Runs semantic clustering, originality scoring, template rigidity checks, and policy evaluations for the organization."""
    logger.info("Starting semantic audit for organization %s", org_id)
    org_uuid = uuid.UUID(org_id) if isinstance(org_id, str) else org_id
    
    try:
        session = get_sync_db_session()
        
        # 1. Fetch all videos for this organization
        stmt_channels = select(Channel).where(Channel.org_id == org_uuid)
        channels = session.scalars(stmt_channels).all()
        channel_ids = [c.id for c in channels]
        
        if not channel_ids:
            return {"status": "skipped", "reason": "no channels found"}
            
        stmt_videos = select(Video).where(Video.channel_id.in_(channel_ids))
        videos = session.scalars(stmt_videos).all()
        
        # 2. Check and generate embeddings for transcripts and titles
        embeddings_generated = 0
        for video in videos:
            # Generate transcript embedding
            if video.caption_text:
                text_hash = str(hash(video.caption_text))
                # Check if embedding already exists
                stmt_emb = select(ContentEmbedding).where(
                    and_(
                        ContentEmbedding.source_id == video.id,
                        ContentEmbedding.source_type == "transcript",
                        ContentEmbedding.text_hash == text_hash
                    )
                )
                exists = session.scalar(stmt_emb)
                if not exists:
                    emb_vector = embedding_service.generate_embedding(video.caption_text)
                    emb_record = ContentEmbedding(
                        source_type="transcript",
                        source_id=video.id,
                        org_id=org_uuid,
                        channel_id=video.channel_id,
                        embedding=emb_vector,
                        text_hash=text_hash
                    )
                    session.add(emb_record)
                    embeddings_generated += 1

            # Generate title embedding
            if video.title:
                title_hash = str(hash(video.title))
                stmt_emb_title = select(ContentEmbedding).where(
                    and_(
                        ContentEmbedding.source_id == video.id,
                        ContentEmbedding.source_type == "title",
                        ContentEmbedding.text_hash == title_hash
                    )
                )
                exists_title = session.scalar(stmt_emb_title)
                if not exists_title:
                    title_vector = embedding_service.generate_embedding(video.title)
                    emb_record_title = ContentEmbedding(
                        source_type="title",
                        source_id=video.id,
                        org_id=org_uuid,
                        channel_id=video.channel_id,
                        embedding=title_vector,
                        text_hash=title_hash
                    )
                    session.add(emb_record_title)
                    embeddings_generated += 1

        if embeddings_generated > 0:
            session.commit()
            logger.info("Generated %d new content embeddings", embeddings_generated)

        # 3. Perform semantic topic clustering
        clusters = semantic_service.cluster_content(session, org_uuid)
        
        # 4. Perform channel metrics calculations (rigidity, originality)
        for c in channels:
            semantic_service.compute_template_rigidity_score(session, c.id)
            semantic_service.compute_semantic_originality_score(session, c.id)

        # 5. Run Cross-Channel Policy Risk Engine
        policy_risks = policy_engine.evaluate_organization_risks(session, org_uuid)

        # 6. Run Organization Trust Index Calculations
        rep_report = reputation_engine.calculate_org_reputation(session, org_uuid)

        # 7. Create overarching semantic audit summary AuditResult
        max_rigidity = 0.0
        min_originality = 100.0
        
        # Fetch calculated scores to summarize
        for c in channels:
            rigidity = 0.0
            originality = 100.0
            for s in c.videos: # Naive, fetch from DB scores
                pass
            
        summary_audit = AuditResult(
            org_id=org_uuid,
            audit_type=AuditType.SCRIPT_SIMILARITY,
            risk_score=round(100.0 - rep_report["trust_index"], 2),
            severity=compute_severity(100.0 - rep_report["trust_index"]),
            details={
                "clusters_detected": len(clusters),
                "trust_index": rep_report["trust_index"],
                "threat_score": rep_report["threat_score"],
                "monetization_stability": rep_report["monetization_stability"],
                "monetization_status": rep_report["monetization_status"],
                "active_policy_risks": len(policy_risks)
            }
        )
        session.add(summary_audit)
        session.commit()

        logger.info("Semantic audit complete for organization %s", org_id)
        return {
            "status": "completed",
            "embeddings_generated": embeddings_generated,
            "clusters": len(clusters),
            "trust_index": rep_report["trust_index"]
        }

    except Exception as exc:
        logger.exception("Semantic audit failed for org %s", org_id)
        raise self.retry(exc=exc, countdown=60)
