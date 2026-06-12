"""Deepgram transcription service – only processes explicitly new user uploads.

Sends audio to the Deepgram API and returns the transcript text.
Includes a strict guard against accidental transcription of existing content.
"""

from __future__ import annotations

import logging
import os

import httpx

from app.config import get_settings

logger = logging.getLogger(__name__)


class DeepgramService:
    """Thin wrapper around the Deepgram Transcription API with an upload-only safety guard."""

    # Approximate cost per minute of audio (Deepgram Nova-2 pricing)
    _COST_PER_MINUTE_USD = 0.0043

    def __init__(self) -> None:
        settings = get_settings()
        self._api_key = settings.DEEPGRAM_API_KEY

    def transcribe(self, file_path: str, is_new_upload: bool = False) -> str:
        """Transcribe an audio/video file using Deepgram.

        Parameters
        ----------
        file_path:
            Absolute path to the media file.
        is_new_upload:
            **Must be True** to proceed. This guard prevents accidental
            Deepgram costs on scraped / pre-existing content.

        Returns
        -------
        The full transcript text.

        Raises
        ------
        ValueError
            If ``is_new_upload`` is not True.
        FileNotFoundError
            If ``file_path`` does not exist.
        RuntimeError
            If the Deepgram API call fails.
        """
        if not is_new_upload:
            raise ValueError(
                "DeepgramService.transcribe() may ONLY be called on files "
                "explicitly marked as new user uploads (is_new_upload=True). "
                "Use YouTube auto-captions for existing videos."
            )

        if not os.path.isfile(file_path):
            raise FileNotFoundError(f"Audio file not found: {file_path}")

        file_size_mb = os.path.getsize(file_path) / (1024 * 1024)
        logger.info(
            "Deepgram transcription starting – file=%s, size=%.1f MB",
            os.path.basename(file_path),
            file_size_mb,
        )

        # Estimate duration for cost logging (rough: ~1 MB ≈ 1 min for compressed audio)
        estimated_duration_min = max(file_size_mb * 0.8, 0.1)
        estimated_cost = estimated_duration_min * self._COST_PER_MINUTE_USD

        if not self._api_key:
            raise RuntimeError("Deepgram API Key is not configured.")

        try:
            with open(file_path, "rb") as audio_file:
                headers = {
                    "Authorization": f"Token {self._api_key}",
                    "Content-Type": "application/octet-stream",
                }
                params = {
                    "model": "nova-2",
                    "smart_format": "true",
                }
                response = httpx.post(
                    "https://api.deepgram.com/v1/listen",
                    headers=headers,
                    params=params,
                    content=audio_file.read(),
                    timeout=120.0,
                )
                response.raise_for_status()

            data = response.json()
            transcript = data["results"]["channels"][0]["alternatives"][0]["transcript"]
            transcript = str(transcript).strip()

            logger.info(
                "Deepgram transcription complete – file=%s, "
                "est_duration=%.1f min, est_cost=$%.4f, chars=%d",
                os.path.basename(file_path),
                estimated_duration_min,
                estimated_cost,
                len(transcript),
            )

            return transcript

        except httpx.HTTPStatusError as exc:
            logger.error("Deepgram API HTTP error for %s: %s", file_path, exc)
            raise RuntimeError(f"Deepgram transcription failed: {exc}") from exc
        except Exception as exc:
            logger.exception("Unexpected error during Deepgram transcription")
            raise RuntimeError(f"Deepgram transcription failed: {exc}") from exc
