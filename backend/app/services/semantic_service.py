import numpy as np
from typing import List, Dict, Any, Tuple
from sqlalchemy.orm import Session
from sqlalchemy import select, and_
from app.models import ContentEmbedding, SemanticCluster, ChannelScore, Video, Channel
from sklearn.cluster import DBSCAN

class SemanticService:
    """Service to perform semantic analysis, clustering, and originality calculations."""

    def detect_cross_channel_duplication(self, db: Session, org_id: str) -> List[Dict[str, Any]]:
        """Detect paraphrased script and video duplication across channels in the organization."""
        # Fetch all transcript embeddings for the organization
        stmt = select(ContentEmbedding).where(
            and_(
                ContentEmbedding.org_id == org_id,
                ContentEmbedding.source_type == "transcript"
            )
        )
        embeddings = db.scalars(stmt).all()
        if len(embeddings) < 2:
            return []

        # Convert to numpy arrays for calculation
        ids = [emb.source_id for emb in embeddings]
        channel_ids = [emb.channel_id for emb in embeddings]
        vectors = np.array([emb.embedding for emb in embeddings])

        # Normalize vectors for cosine similarity
        norms = np.linalg.norm(vectors, axis=1, keepdims=True)
        # Avoid divide by zero
        norms[norms == 0] = 1.0
        norm_vectors = vectors / norms

        # Cosine similarity matrix
        sim_matrix = np.dot(norm_vectors, norm_vectors.T)

        duplications = []
        n = len(embeddings)
        for i in range(n):
            for j in range(i + 1, n):
                # Only check cross-channel duplication
                if channel_ids[i] != channel_ids[j]:
                    score = float(sim_matrix[i, j])
                    if score > 0.70:  # Threshold for high semantic similarity
                        duplications.append({
                            "video_id_a": str(ids[i]),
                            "video_id_b": str(ids[j]),
                            "channel_id_a": str(channel_ids[i]),
                            "channel_id_b": str(channel_ids[j]),
                            "similarity": score,
                            "type": "paraphrased_script" if score < 0.90 else "direct_duplication"
                        })
        
        return sorted(duplications, key=lambda x: x["similarity"], reverse=True)

    def cluster_content(self, db: Session, org_id: str) -> List[Dict[str, Any]]:
        """Cluster videos across channels to identify topic recycling and template reuse."""
        stmt = select(ContentEmbedding).where(
            and_(
                ContentEmbedding.org_id == org_id,
                ContentEmbedding.source_type == "transcript"
            )
        )
        embeddings = db.scalars(stmt).all()
        if len(embeddings) < 3:
            return []

        ids = [str(emb.source_id) for emb in embeddings]
        vectors = np.array([emb.embedding for emb in embeddings])

        # DBSCAN clustering with cosine distance (metric='cosine')
        # Epsilon is the distance threshold. 1 - cosine_similarity.
        # Let's say similarity > 0.75 means same cluster, so distance <= 0.25
        try:
            dbscan = DBSCAN(eps=0.25, min_samples=2, metric='cosine')
            labels = dbscan.fit_predict(vectors)
        except Exception as e:
            print(f"Error during semantic clustering: {e}")
            return []

        clusters = {}
        for idx, label in enumerate(labels):
            if label == -1:
                continue  # Noise point
            
            label_str = str(label)
            if label_str not in clusters:
                clusters[label_str] = []
            clusters[label_str].append(ids[idx])

        result_clusters = []
        for cluster_id, member_ids in clusters.items():
            # Save or update cluster in database
            # Compute similarity average
            member_embeddings = [emb for emb in embeddings if str(emb.source_id) in member_ids]
            centroid = np.mean([emb.embedding for emb in member_embeddings], axis=0).tolist()
            
            # Simple average similarity of members to centroid
            centroid_norm = np.linalg.norm(centroid)
            sims = []
            if centroid_norm > 0:
                norm_centroid = centroid / centroid_norm
                for emb in member_embeddings:
                    emb_norm = np.linalg.norm(emb.embedding)
                    if emb_norm > 0:
                        sims.append(np.dot(emb.embedding / emb_norm, norm_centroid))
            avg_similarity = float(np.mean(sims)) if sims else 1.0

            cluster = SemanticCluster(
                org_id=org_id,
                cluster_type="transcript_topic",
                member_ids={"video_ids": member_ids},
                centroid_embedding=centroid,
                similarity_score=avg_similarity
            )
            db.add(cluster)
            result_clusters.append({
                "cluster_id": cluster_id,
                "video_ids": member_ids,
                "similarity_score": avg_similarity
            })

        db.commit()
        return result_clusters

    def compute_template_rigidity_score(self, db: Session, channel_id: str) -> float:
        """Estimates structural template repetition, narrative pacing similarity, CTA repetition, intro similarity, and script entropy."""
        # Fetch channel's videos
        stmt = select(Video).where(Video.channel_id == channel_id).order_by(Video.published_at.desc())
        videos = db.scalars(stmt).all()
        if len(videos) < 3:
            return 0.0

        transcripts = [v.caption_text for v in videos if v.caption_text and len(v.caption_text) > 100]
        if len(transcripts) < 2:
            return 0.0

        # 1. Intro Similarity (First 150 chars of transcripts)
        intros = [t[:150].lower() for t in transcripts]
        intro_similarities = []
        for i in range(len(intros)):
            for j in range(i + 1, len(intros)):
                overlap = self._levenshtein_ratio(intros[i], intros[j])
                intro_similarities.append(overlap)
        avg_intro_sim = float(np.mean(intro_similarities)) if intro_similarities else 0.0

        # 2. CTA Repetition (Last 150 chars of transcripts)
        ctas = [t[-150:].lower() for t in transcripts]
        cta_similarities = []
        for i in range(len(ctas)):
            for j in range(i + 1, len(ctas)):
                overlap = self._levenshtein_ratio(ctas[i], ctas[j])
                cta_similarities.append(overlap)
        avg_cta_sim = float(np.mean(cta_similarities)) if cta_similarities else 0.0

        # 3. Script Entropy (predictability / word distribution uniqueness)
        entropies = []
        for t in transcripts:
            words = t.lower().split()
            if not words:
                continue
            unique, counts = np.unique(words, return_counts=True)
            probs = counts / len(words)
            entropy = -np.sum(probs * np.log2(probs))
            # Normalize entropy (longer scripts have higher max entropy, let's normalize by max possible log2(N))
            max_entropy = np.log2(len(unique)) if len(unique) > 1 else 1.0
            normalized_entropy = entropy / max_entropy
            entropies.append(normalized_entropy)
        
        # Low script entropy (repetitive vocabulary) maps to high rigidity
        avg_normalized_entropy = float(np.mean(entropies)) if entropies else 1.0
        entropy_rigidity = 100.0 * (1.0 - avg_normalized_entropy)

        # 4. Structural Repetition (Cosine similarity of full transcript embeddings)
        stmt_emb = select(ContentEmbedding).where(
            and_(
                ContentEmbedding.channel_id == channel_id,
                ContentEmbedding.source_type == "transcript"
            )
        )
        embeddings = db.scalars(stmt_emb).all()
        structural_sim = 0.0
        if len(embeddings) >= 2:
            vectors = np.array([emb.embedding for emb in embeddings])
            norms = np.linalg.norm(vectors, axis=1, keepdims=True)
            norms[norms == 0] = 1.0
            norm_vectors = vectors / norms
            sim_matrix = np.dot(norm_vectors, norm_vectors.T)
            # Take upper triangle average
            indices = np.triu_indices(len(embeddings), k=1)
            structural_sim = float(np.mean(sim_matrix[indices])) if len(indices[0]) > 0 else 0.0

        # Combine scores into template rigidity (0 to 100)
        # Weights: Intros (25%), CTAs (25%), script entropy / vocabulary repetition (20%), full structural/embedding similarity (30%)
        rigidity_score = (
            (avg_intro_sim * 25.0) +
            (avg_cta_sim * 25.0) +
            (entropy_rigidity * 0.20) +
            (structural_sim * 30.0)
        )
        rigidity_score = min(max(rigidity_score, 0.0), 100.0)

        # Save to database
        score_record = ChannelScore(
            channel_id=channel_id,
            org_id=videos[0].channel.org_id,
            score_type="template_rigidity",
            value=rigidity_score,
            breakdown={
                "intro_similarity": avg_intro_sim,
                "cta_similarity": avg_cta_sim,
                "entropy_rigidity": entropy_rigidity,
                "structural_similarity": structural_sim
            }
        )
        db.add(score_record)
        db.commit()

        return rigidity_score

    def compute_semantic_originality_score(self, db: Session, channel_id: str) -> float:
        """Calculates originality score for a channel (how unique its content is compared to itself and others)."""
        # Fetch channel's org_id
        channel = db.get(Channel, channel_id)
        if not channel:
            return 100.0

        # 1. Internal Similarity (self-overlap)
        stmt_self = select(ContentEmbedding).where(
            and_(
                ContentEmbedding.channel_id == channel_id,
                ContentEmbedding.source_type == "transcript"
            )
        )
        self_embeddings = db.scalars(stmt_self).all()
        internal_sim = 0.0
        if len(self_embeddings) >= 2:
            vectors = np.array([emb.embedding for emb in self_embeddings])
            norms = np.linalg.norm(vectors, axis=1, keepdims=True)
            norms[norms == 0] = 1.0
            norm_vectors = vectors / norms
            sim_matrix = np.dot(norm_vectors, norm_vectors.T)
            indices = np.triu_indices(len(self_embeddings), k=1)
            internal_sim = float(np.mean(sim_matrix[indices])) if len(indices[0]) > 0 else 0.0

        # 2. Portfolio Similarity (overlap with sister channels)
        stmt_portfolio = select(ContentEmbedding).where(
            and_(
                ContentEmbedding.org_id == channel.org_id,
                ContentEmbedding.channel_id != channel_id,
                ContentEmbedding.source_type == "transcript"
            )
        )
        portfolio_embeddings = db.scalars(stmt_portfolio).all()
        portfolio_sim = 0.0
        if self_embeddings and portfolio_embeddings:
            self_vecs = np.array([emb.embedding for emb in self_embeddings])
            port_vecs = np.array([emb.embedding for emb in portfolio_embeddings])
            
            # Normalize
            self_vecs = self_vecs / np.linalg.norm(self_vecs, axis=1, keepdims=True).clip(min=1e-8)
            port_vecs = port_vecs / np.linalg.norm(port_vecs, axis=1, keepdims=True).clip(min=1e-8)
            
            # Cross similarity
            cross_sim = np.dot(self_vecs, port_vecs.T)
            portfolio_sim = float(np.mean(cross_sim))

        # Originality is the opposite of similarity
        # Weighted internal similarity (40%) and portfolio similarity (60%)
        overall_similarity = (internal_sim * 0.40) + (portfolio_sim * 0.60)
        originality_score = 100.0 * (1.0 - overall_similarity)
        originality_score = min(max(originality_score, 0.0), 100.0)

        # Save to database
        score_record = ChannelScore(
            channel_id=channel_id,
            org_id=channel.org_id,
            score_type="semantic_originality",
            value=originality_score,
            breakdown={
                "internal_similarity": internal_sim,
                "portfolio_similarity": portfolio_sim
            }
        )
        db.add(score_record)
        db.commit()

        return originality_score

    def _levenshtein_ratio(self, s1: str, s2: str) -> float:
        """Helper to compute Levenshtein similarity ratio between two short texts."""
        try:
            import Levenshtein
            return Levenshtein.ratio(s1, s2)
        except ImportError:
            # Fallback naive comparison
            if not s1 or not s2:
                return 0.0
            # Token set ratio approximation
            set1, set2 = set(s1.split()), set(s2.split())
            if not set1 or not set2:
                return 0.0
            intersection = set1.intersection(set2)
            union = set1.union(set2)
            return len(intersection) / len(union)

# Singleton instance
semantic_service = SemanticService()
