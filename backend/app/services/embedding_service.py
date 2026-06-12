import hashlib
import numpy as np
from typing import List
from app.config import get_settings

class EmbeddingService:
    """Service to generate vector embeddings for text content."""
    
    def __init__(self):
        self.settings = get_settings()
        self.provider = self.settings.EMBEDDING_PROVIDER.lower()
        self.local_model = None
        self._initialized = False

    def _lazy_init(self):
        if self._initialized:
            return
        
        if self.provider == "local":
            try:
                from sentence_transformers import SentenceTransformer
                # Using all-MiniLM-L6-v2 which yields 384-dimensional embeddings
                self.local_model = SentenceTransformer('all-MiniLM-L6-v2')
            except Exception as e:
                print(f"Warning: Failed to load sentence-transformers: {e}. Falling back to deterministic embeddings.")
                self.local_model = None
        self._initialized = True

    def generate_embedding(self, text: str) -> List[float]:
        """Generates a 384-dimensional embedding for a given string."""
        if not text or not text.strip():
            return [0.0] * 384

        self._lazy_init()

        if self.provider == "openai" and self.settings.OPENAI_API_KEY:
            try:
                import openai
                client = openai.OpenAI(api_key=self.settings.OPENAI_API_KEY)
                # text-embedding-3-small defaults to 1536, but can be truncated or we can map it to 384
                response = client.embeddings.create(
                    input=[text],
                    model="text-embedding-3-small"
                )
                emb = response.data[0].embedding
                # Truncate or pad to 384 dimensions to remain consistent with pgvector definition
                if len(emb) > 384:
                    emb = emb[:384]
                    # L2 Renormalize
                    norm = np.linalg.norm(emb)
                    if norm > 0:
                        emb = (np.array(emb) / norm).tolist()
                elif len(emb) < 384:
                    emb = emb + [0.0] * (384 - len(emb))
                return emb
            except Exception as e:
                print(f"OpenAI embedding generation failed: {e}. Falling back to local/pseudo-random.")

        if self.local_model:
            try:
                emb = self.local_model.encode(text, convert_to_numpy=True)
                return emb.tolist()
            except Exception as e:
                print(f"Local sentence-transformer encoding failed: {e}")

        # Deterministic fallback: Generate a 384-dimensional vector from MD5 / SHA256 of text
        return self._generate_fallback_embedding(text)

    def batch_embed(self, texts: List[str]) -> List[List[float]]:
        """Generates embeddings for a batch of strings."""
        if not texts:
            return []

        self._lazy_init()

        if self.provider == "local" and self.local_model:
            try:
                embs = self.local_model.encode(texts, convert_to_numpy=True)
                return embs.tolist()
            except Exception as e:
                print(f"Local batch embedding failed: {e}")

        return [self.generate_embedding(t) for t in texts]

    def _generate_fallback_embedding(self, text: str) -> List[float]:
        """Generates a deterministic 384-dimensional unit vector based on string hash."""
        # Use SHA256 to seed numpy random generator deterministically
        hasher = hashlib.sha256(text.encode('utf-8'))
        seed = int(hasher.hexdigest()[:8], 16)
        rng = np.random.default_rng(seed)
        
        # Generate random normal vector of length 384
        vec = rng.normal(size=384)
        norm = np.linalg.norm(vec)
        if norm > 0:
            vec = vec / norm
        return vec.tolist()

# Singleton instance
embedding_service = EmbeddingService()
