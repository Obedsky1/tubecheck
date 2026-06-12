"""Gemini Human Value Index evaluator.

Sends a video transcript to Gemini 2.5 Flash and receives a structured score
across five "humanness" dimensions.
"""

from __future__ import annotations

import json
import logging
from typing import Any

from pydantic import BaseModel, Field
from google import genai
from google.genai import types

from app.config import get_settings

logger = logging.getLogger(__name__)

class DimensionScores(BaseModel):
    original_commentary: int = Field(description="Personal opinions, unique insights beyond generic takes (0-20)")
    personal_anecdotes: int = Field(description="Real experiences, specific stories with detail (0-20)")
    subjective_storytelling: int = Field(description="Narrative craft, engagement, emotional range (0-20)")
    research_depth: int = Field(description="Evidence of research beyond surface-level Wikipedia summaries (0-20)")
    authentic_voice: int = Field(description="Natural speech patterns, filler words, self-corrections vs robotic reading (0-20)")

class HVIResult(BaseModel):
    total_score: int = Field(description="Total score (0-100), ideally the sum of dimensions")
    dimension_scores: DimensionScores
    summary: str = Field(description="One sentence overall assessment")
    red_flags: list[str] = Field(description="List of flags if AI-generated or spammy content is suspected")

_PROMPT_TEMPLATE = """You are a content authenticity evaluator. Evaluate this transcript for human authenticity.

Dimensions (score 0-20 each):
1. original_commentary - Personal opinions, unique insights beyond generic takes
2. personal_anecdotes - Real experiences, specific stories with detail
3. subjective_storytelling - Narrative craft, engagement, emotional range
4. research_depth - Evidence of research beyond surface-level Wikipedia summaries
5. authentic_voice - Natural speech patterns, filler words, self-corrections vs robotic reading

TRANSCRIPT (first 3000 chars):
{transcript}
"""


class HviService:
    """Evaluates transcripts for human authenticity using Gemini 2.5 Flash."""

    def __init__(self) -> None:
        settings = get_settings()
        self._api_key = settings.GEMINI_API_KEY
        self._client = None
        if self._api_key:
            try:
                self._client = genai.Client(api_key=self._api_key)
            except Exception as e:
                logger.warning("Failed to build Gemini API client in HviService: %s", e)

    def evaluate_human_value_index(self, transcript: str) -> dict[str, Any]:
        """Send a transcript to Gemini for Human Value Index scoring.

        Parameters
        ----------
        transcript:
            The full transcript text (will be truncated to 3 000 chars to
            minimise token usage).

        Returns
        -------
        A dict with keys: total_score (0-100), dimension_scores, summary,
        red_flags.
        """
        truncated = transcript[:3000]

        if not self._client:
            logger.error("HVI evaluation failed: Gemini client not initialized")
            return self._build_empty_response()

        try:
            prompt = _PROMPT_TEMPLATE.format(transcript=truncated)

            response = self._client.models.generate_content(
                model='gemini-2.5-flash',
                contents=prompt,
                config=types.GenerateContentConfig(
                    response_mime_type="application/json",
                    response_schema=HVIResult,
                    temperature=0.3,
                ),
            )

            if response.parsed:
                result = response.parsed.model_dump()
            else:
                result = json.loads(response.text)

            # Validate and clamp values
            total = max(0, min(int(result.get("total_score", 0)), 100))
            dims = result.get("dimension_scores", {})
            validated_dims: dict[str, int] = {}
            for key in [
                "original_commentary",
                "personal_anecdotes",
                "subjective_storytelling",
                "research_depth",
                "authentic_voice",
            ]:
                validated_dims[key] = max(0, min(int(dims.get(key, 0)), 20))

            # Re-compute total from dimensions to ensure consistency
            computed_total = sum(validated_dims.values())

            output = {
                "total_score": computed_total,
                "dimension_scores": validated_dims,
                "summary": result.get("summary", "No summary provided"),
                "red_flags": result.get("red_flags", []),
            }

            logger.info(
                "HVI evaluation complete - total_score=%d, dims=%s",
                computed_total,
                validated_dims,
            )
            return output

        except Exception as exc:
            logger.error("Gemini HVI evaluation failed: %s", exc)
            return self._build_empty_response()

    def _build_empty_response(self) -> dict[str, Any]:
        return {
            "total_score": 0,
            "dimension_scores": {
                "original_commentary": 0,
                "personal_anecdotes": 0,
                "subjective_storytelling": 0,
                "research_depth": 0,
                "authentic_voice": 0,
            },
            "summary": "Evaluation failed - API request error",
            "red_flags": ["evaluation_error"],
        }
