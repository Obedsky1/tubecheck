"""Gemini API service for scanning transcript toxicity, harassment, and safety."""

from __future__ import annotations

import hashlib
import json
import logging
from typing import Any
from pydantic import BaseModel, Field
from google import genai
from google.genai import types

from app.config import get_settings

logger = logging.getLogger(__name__)


class ModerationResult(BaseModel):
    toxicity: float = Field(description="Toxicity score between 0.0 and 1.0")
    harassment: float = Field(description="Harassment score between 0.0 and 1.0")
    safety_flag: str = Field(description="Overall safety status, e.g., 'safe' or 'flagged_for_demonetization'")


class GeminiService:
    """Service to evaluate text toxicity, harassment, and moderation risks using Gemini."""

    def __init__(self) -> None:
        settings = get_settings()
        self._api_key = settings.GEMINI_API_KEY
        self._client = None
        
        if self._api_key:
            try:
                self._client = genai.Client(api_key=self._api_key)
                logger.info("Gemini API client initialized successfully.")
            except Exception as e:
                logger.warning("Failed to build Gemini API client: %s. Falling back to local rules.", e)

    def analyze_toxicity(self, text: str) -> dict[str, Any]:
        """Analyzes text for toxicity and harassment using Gemini 2.5 Flash.

        Returns a dict with keys: status, scores, details.
        Results are cached in Redis for 24 hours to avoid repeat API calls
        on identical content (e.g. same video rescanned).
        """
        if not text or not text.strip():
            return self._build_empty_response()

        # ── COST GUARD: Redis cache check ──────────────────────────────────
        settings = get_settings()
        _redis = None
        cache_key = f"gemini_tox:{hashlib.md5(text[:500].encode()).hexdigest()}"
        try:
            import redis as redis_lib
            _redis = redis_lib.Redis.from_url(settings.REDIS_URL, socket_connect_timeout=1.0)
            cached = _redis.get(cache_key)
            if cached:
                logger.info("Gemini toxicity cache HIT — skipping API call.")
                return json.loads(cached)
        except Exception:
            pass  # Cache miss is non-fatal; proceed to API call
        # ──────────────────────────────────────────────────

        if self._client is not None:
            try:
                truncated_text = text[:30000]

                prompt = (
                    "You are a strict YouTube Trust & Safety and Forensic Compliance AI. "
                    "Analyze the following text payload for toxicity and harassment. "
                    "Output a strict JSON object evaluating 'toxicity' (float between 0.0 and 1.0), "
                    "'harassment' (float between 0.0 and 1.0), and an overall 'safety_flag' "
                    "('safe' or 'flagged_for_demonetization').\n\n"
                    f"Text: {truncated_text}"
                )

                response = self._client.models.generate_content(
                    model='gemini-2.5-flash',
                    contents=prompt,
                    config=types.GenerateContentConfig(
                        response_mime_type="application/json",
                        response_schema=ModerationResult,
                        temperature=0.0
                    ),
                )

                if response.parsed:
                    result = response.parsed
                else:
                    result_dict = json.loads(response.text)
                    result = ModerationResult(**result_dict)

                status = result.safety_flag
                scores = {
                    "TOXICITY": round(result.toxicity, 4),
                    "HARASSMENT": round(result.harassment, 4),
                }

                flagged_categories = []
                for cat, score in scores.items():
                    if score > 0.6:
                        flagged_categories.append(f"{cat}: {score:.2f}")
                        if status == "safe":
                            status = "flagged_for_demonetization"

                api_result = {
                    "status": status,
                    "scores": scores,
                    "details": {
                        "api_provider": "Google Gemini 2.5 Flash",
                        "flagged_categories": flagged_categories,
                    },
                }

                # ── Write result to Redis cache (24h TTL) ──────────────────
                if _redis:
                    try:
                        _redis.setex(cache_key, 86400, json.dumps(api_result))
                    except Exception:
                        pass
                # ────────────────────────────────────────────────────────────
                return api_result

            except Exception as exc:
                logger.error("Gemini API request failed: %s. Falling back...", exc)

        # Fallback Heuristics
        return self._local_fallback_audit(text)


    def _build_empty_response(self) -> dict[str, Any]:
        return {
            "status": "safe",
            "scores": {
                "TOXICITY": 0.0,
                "HARASSMENT": 0.0,
            },
            "details": {"method": "empty_input"},
        }

    def _local_fallback_audit(self, text: str) -> dict[str, Any]:
        """Calculates simulated scores based on keyword analysis of the text."""
        text_lower = text.lower()
        
        profanity_words = ["shit", "fuck", "fvck", "bitch", "asshole", "bastard", "crap", "damn", "cunt", "dick"]
        insult_words = ["stupid", "idiot", "loser", "jerk", "dumb", "moron", "hate", "ugly"]
        severe_words = ["kill yourself", "die", "nigger", "faggot", "retard", "slut", "kill them"]
        
        profanity_count = sum(1 for w in profanity_words if w in text_lower)
        insult_count = sum(1 for w in insult_words if w in text_lower)
        severe_count = sum(1 for w in severe_words if w in text_lower)

        profanity_score = min(profanity_count * 0.15, 0.95)
        insult_score = min(insult_count * 0.12, 0.90)
        severe_score = min(severe_count * 0.40, 0.99)
        
        toxicity_score = min((profanity_score * 0.4) + (insult_score * 0.4) + (severe_score * 0.6), 1.0)
        harassment_score = min((insult_score * 0.6) + (severe_score * 0.5), 1.0)
        
        scores = {
            "TOXICITY": round(toxicity_score, 4),
            "HARASSMENT": round(harassment_score, 4),
        }

        status = "safe"
        flagged_categories = []
        if scores["TOXICITY"] > 0.6:
            status = "flagged_for_demonetization"
            flagged_categories.append(f"TOXICITY: {scores['TOXICITY']:.2f}")
        if scores["HARASSMENT"] > 0.6:
            status = "flagged_for_demonetization"
            flagged_categories.append(f"HARASSMENT: {scores['HARASSMENT']:.2f}")

        return {
            "status": status,
            "scores": scores,
            "details": {
                "api_provider": "Local Heuristics Engine (Fallback)",
                "flagged_categories": flagged_categories,
                "matched_counts": {
                    "profanity": profanity_count,
                    "insults": insult_count,
                    "severe_hostility": severe_count,
                },
            },
        }

gemini_service = GeminiService()
