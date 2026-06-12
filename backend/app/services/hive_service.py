"""Sightengine Moderation service – scene change detection and deepfake scanning.

Uses OpenCV for local scene-change detection (frame differencing) and the
Sightengine API for per-frame deepfake analysis. Raw video is NEVER
sent to Sightengine – only individual frame images.
"""

from __future__ import annotations

import logging
import os
import tempfile
from typing import Any

import cv2
import httpx
import numpy as np

from app.config import get_settings

logger = logging.getLogger(__name__)


class SightengineService:
    """Scene change detection (local) + Sightengine deepfake scan (API)."""

    _SIGHTENGINE_API_URL = "https://api.sightengine.com/1.0/check.json"

    def __init__(self) -> None:
        settings = get_settings()
        self._api_user = settings.SIGHTENGINE_API_USER
        self._api_secret = settings.SIGHTENGINE_API_SECRET

    # ── Scene change detection (OpenCV) ───────────────────────────────────

    def detect_scene_changes(
        self,
        video_path: str,
        max_frames: int = 25,
        diff_threshold: float = 30.0,
    ) -> list[str]:
        """Detect scene changes in a video by frame differencing.

        Reads frames from *video_path*, computes the mean absolute
        difference between consecutive frames, and selects frames where
        the difference exceeds *diff_threshold*.

        Parameters
        ----------
        video_path:
            Path to the video file.
        max_frames:
            Maximum number of scene-change frames to return (default 25).
        diff_threshold:
            Mean pixel-difference threshold to count as a scene change.

        Returns
        -------
        List of absolute paths to saved JPEG frame images (up to *max_frames*).
        """
        if not os.path.isfile(video_path):
            raise FileNotFoundError(f"Video file not found: {video_path}")

        cap = cv2.VideoCapture(video_path)
        if not cap.isOpened():
            raise RuntimeError(f"Failed to open video: {video_path}")

        output_dir = os.path.join(
            tempfile.gettempdir(),
            "shieldnetwork_frames",
            os.path.splitext(os.path.basename(video_path))[0],
        )
        os.makedirs(output_dir, exist_ok=True)

        saved_paths: list[str] = []
        prev_gray: np.ndarray | None = None
        frame_idx = 0

        # Always capture the first frame
        ret, frame = cap.read()
        if ret:
            path = os.path.join(output_dir, f"frame_{frame_idx:06d}.jpg")
            cv2.imwrite(path, frame)
            saved_paths.append(path)
            prev_gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
            frame_idx += 1

        while True:
            ret, frame = cap.read()
            if not ret:
                break
            frame_idx += 1

            gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
            if prev_gray is not None:
                diff = cv2.absdiff(prev_gray, gray)
                mean_diff = float(np.mean(diff))

                if mean_diff > diff_threshold and len(saved_paths) < max_frames:
                    path = os.path.join(output_dir, f"frame_{frame_idx:06d}.jpg")
                    cv2.imwrite(path, frame)
                    saved_paths.append(path)

            prev_gray = gray

            if len(saved_paths) >= max_frames:
                break

        cap.release()
        logger.info(
            "Scene detection complete: %d frames extracted from %s",
            len(saved_paths),
            video_path,
        )
        return saved_paths

    # ── Deepfake scanning (Sightengine API) ───────────────────────────────────

    def scan_for_deepfakes(
        self, frame_paths: list[str]
    ) -> dict[str, Any]:
        """Send individual frame images to the Sightengine API for
        deepfake detection.

        Parameters
        ----------
        frame_paths:
            List of absolute paths to JPEG frame images.

        Returns
        -------
        A dict containing:
        - ``per_frame_scores``: list of dicts with frame path and score
        - ``overall_confidence``: average deepfake probability across frames
        - ``max_score``: highest single-frame deepfake probability
        - ``flagged_frames``: count of frames exceeding 0.7 threshold
        """
        if not self._api_user or not self._api_secret:
            logger.warning("Sightengine API credentials not configured – returning empty results")
            return {
                "per_frame_scores": [],
                "overall_confidence": 0.0,
                "max_score": 0.0,
                "flagged_frames": 0,
                "error": "Sightengine API credentials not configured",
            }

        per_frame: list[dict[str, Any]] = []
        scores: list[float] = []

        for frame_path in frame_paths:
            if not os.path.isfile(frame_path):
                logger.warning("Frame not found, skipping: %s", frame_path)
                continue

            try:
                with open(frame_path, "rb") as f:
                    files = {"media": (os.path.basename(frame_path), f, "image/jpeg")}
                    data = {
                        "models": "deepfake",
                        "api_user": self._api_user,
                        "api_secret": self._api_secret,
                    }
                    response = httpx.post(
                        self._SIGHTENGINE_API_URL,
                        data=data,
                        files=files,
                        timeout=30,
                    )
                    response.raise_for_status()

                data_json = response.json()
                deepfake_score = data_json.get("deepfake", {}).get("score", 0.0)
                scores.append(deepfake_score)

                per_frame.append({
                    "frame": os.path.basename(frame_path),
                    "deepfake_score": round(deepfake_score, 4),
                    "flagged": deepfake_score > 0.7,
                })

            except httpx.HTTPStatusError as exc:
                logger.error(
                    "Sightengine API HTTP error for %s: %s", frame_path, exc
                )
                per_frame.append({
                    "frame": os.path.basename(frame_path),
                    "deepfake_score": 0.0,
                    "error": str(exc),
                })
            except Exception as exc:
                logger.warning(
                    "Sightengine scan failed for %s: %s", frame_path, exc
                )
                per_frame.append({
                    "frame": os.path.basename(frame_path),
                    "deepfake_score": 0.0,
                    "error": str(exc),
                })

        overall = float(np.mean(scores)) if scores else 0.0
        max_score = float(max(scores)) if scores else 0.0
        flagged = sum(1 for s in scores if s > 0.7)

        logger.info(
            "Deepfake scan complete: %d frames, overall=%.3f, max=%.3f, flagged=%d",
            len(per_frame),
            overall,
            max_score,
            flagged,
        )

        return {
            "per_frame_scores": per_frame,
            "overall_confidence": round(overall, 4),
            "max_score": round(max_score, 4),
            "flagged_frames": flagged,
        }
