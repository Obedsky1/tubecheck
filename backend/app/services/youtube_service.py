"""YouTube Data API v3 service – channel metadata, video listing, and caption scraping."""

from __future__ import annotations

import logging
import re
from typing import Any, Optional

from googleapiclient.discovery import build
from googleapiclient.errors import HttpError

from app.config import get_settings

logger = logging.getLogger(__name__)


class YouTubeService:
    """Wrapper around the YouTube Data API v3 and youtube-transcript-api."""

    def __init__(self, access_token: Optional[str] = None) -> None:
        settings = get_settings()
        self._api_key = settings.YOUTUBE_API_KEY
        
        if access_token:
            from google.oauth2.credentials import Credentials
            creds = Credentials(token=access_token)
            self._youtube = build("youtube", "v3", credentials=creds)
        else:
            self._youtube = build("youtube", "v3", developerKey=self._api_key)

    # ── Channel metadata ──────────────────────────────────────────────────

    def fetch_channel_metadata(self, channel_id: str) -> dict[str, Any]:
        """Fetch channel snippet + statistics for a single channel ID.

        Returns a dict with: title, description, subscriber_count,
        video_count, thumbnail_url, custom_url.
        """
        try:
            response = (
                self._youtube.channels()
                .list(part="snippet,statistics", id=channel_id)
                .execute()
            )
        except HttpError as exc:
            logger.error("YouTube API error fetching channel %s: %s", channel_id, exc)
            raise

        items = response.get("items", [])
        if not items:
            logger.warning("No channel found for ID %s", channel_id)
            return {}

        item = items[0]
        snippet = item.get("snippet", {})
        stats = item.get("statistics", {})

        return {
            "title": snippet.get("title", ""),
            "description": snippet.get("description", ""),
            "subscriber_count": int(stats.get("subscriberCount", 0)),
            "video_count": int(stats.get("videoCount", 0)),
            "thumbnail_url": snippet.get("thumbnails", {}).get("high", {}).get("url", ""),
            "custom_url": snippet.get("customUrl", ""),
        }

    # ── Video listing ─────────────────────────────────────────────────────

    def fetch_channel_videos(
        self, channel_id: str, max_results: int = 50
    ) -> list[dict[str, Any]]:
        """Fetch the most recent uploads for a channel.

        Returns a list of dicts with: youtube_video_id, title, description,
        published_at, thumbnail_url.
        """
        try:
            # First, get the uploads playlist ID
            ch_response = (
                self._youtube.channels()
                .list(part="contentDetails", id=channel_id)
                .execute()
            )
            items = ch_response.get("items", [])
            if not items:
                return []

            uploads_id = (
                items[0]
                .get("contentDetails", {})
                .get("relatedPlaylists", {})
                .get("uploads", "")
            )
            if not uploads_id:
                return []

            # Paginate through the uploads playlist
            videos: list[dict[str, Any]] = []
            next_page: Optional[str] = None

            while len(videos) < max_results:
                page_size = min(50, max_results - len(videos))
                pl_response = (
                    self._youtube.playlistItems()
                    .list(
                        part="snippet",
                        playlistId=uploads_id,
                        maxResults=page_size,
                        pageToken=next_page,
                    )
                    .execute()
                )

                for item in pl_response.get("items", []):
                    snippet = item.get("snippet", {})
                    resource = snippet.get("resourceId", {})
                    videos.append({
                        "youtube_video_id": resource.get("videoId", ""),
                        "title": snippet.get("title", ""),
                        "description": snippet.get("description", ""),
                        "published_at": snippet.get("publishedAt", ""),
                        "thumbnail_url": (
                            snippet.get("thumbnails", {})
                            .get("high", {})
                            .get("url", "")
                        ),
                    })

                next_page = pl_response.get("nextPageToken")
                if not next_page:
                    break

            return videos[:max_results]

        except HttpError as exc:
            logger.error("YouTube API error listing videos for %s: %s", channel_id, exc)
            raise

    # ── Video details (batch) ─────────────────────────────────────────────

    def fetch_video_details(
        self, video_ids: list[str]
    ) -> dict[str, dict[str, Any]]:
        """Batch-fetch video details (duration, view/like counts).

        Accepts up to 50 IDs per call (API limit). Returns a dict keyed by
        video ID.
        """
        results: dict[str, dict[str, Any]] = {}

        # Process in chunks of 50
        for start in range(0, len(video_ids), 50):
            chunk = video_ids[start : start + 50]
            try:
                response = (
                    self._youtube.videos()
                    .list(part="contentDetails,statistics", id=",".join(chunk))
                    .execute()
                )
            except HttpError as exc:
                logger.error("YouTube API error fetching video details: %s", exc)
                continue

            for item in response.get("items", []):
                vid_id = item["id"]
                content = item.get("contentDetails", {})
                stats = item.get("statistics", {})

                # Parse ISO 8601 duration (e.g. "PT15M33S" → seconds)
                duration_str = content.get("duration", "PT0S")
                duration_seconds = self._parse_iso8601_duration(duration_str)

                results[vid_id] = {
                    "duration_seconds": duration_seconds,
                    "view_count": int(stats.get("viewCount", 0)),
                    "like_count": int(stats.get("likeCount", 0)),
                }

        return results

    # ── Captions / Transcripts ────────────────────────────────────────────

    def scrape_captions(self, video_id: str) -> Optional[str]:
        """Attempt to retrieve auto-generated captions via youtube-transcript-api.

        Returns concatenated text or None if captions are unavailable.
        """
        from youtube_transcript_api import (
            NoTranscriptFound,
            TranscriptsDisabled,
            YouTubeTranscriptApi,
        )

        try:
            transcript_list = YouTubeTranscriptApi.list_transcripts(video_id)

            # Prefer manually created English transcript, fall back to auto-generated
            transcript = None
            try:
                transcript = transcript_list.find_manually_created_transcript(["en"])
            except NoTranscriptFound:
                try:
                    transcript = transcript_list.find_generated_transcript(["en"])
                except NoTranscriptFound:
                    # Try any available language
                    for t in transcript_list:
                        transcript = t
                        break

            if transcript is None:
                return None

            entries = transcript.fetch()
            text = " ".join(entry.get("text", "") for entry in entries)
            return text.strip() if text.strip() else None

        except TranscriptsDisabled:
            logger.info("Transcripts disabled for video %s", video_id)
            return None
        except NoTranscriptFound:
            logger.info("No transcript found for video %s", video_id)
            return None
        except Exception as exc:
            logger.warning("Caption scraping failed for %s: %s", video_id, exc)
            return None

    # ── Bulk sync ─────────────────────────────────────────────────────────

    def bulk_sync_channels(
        self, channel_ids: list[str]
    ) -> dict[str, dict[str, Any]]:
        """Sync metadata for up to 50 channels in a single API call.

        Returns a dict keyed by channel ID.
        """
        results: dict[str, dict[str, Any]] = {}

        for start in range(0, len(channel_ids), 50):
            chunk = channel_ids[start : start + 50]
            try:
                response = (
                    self._youtube.channels()
                    .list(part="snippet,statistics", id=",".join(chunk))
                    .execute()
                )
            except HttpError as exc:
                logger.error("Bulk sync API error: %s", exc)
                continue

            for item in response.get("items", []):
                cid = item["id"]
                snippet = item.get("snippet", {})
                stats = item.get("statistics", {})
                results[cid] = {
                    "title": snippet.get("title", ""),
                    "description": snippet.get("description", ""),
                    "subscriber_count": int(stats.get("subscriberCount", 0)),
                    "video_count": int(stats.get("videoCount", 0)),
                    "thumbnail_url": (
                        snippet.get("thumbnails", {}).get("high", {}).get("url", "")
                    ),
                    "custom_url": snippet.get("customUrl", ""),
                }

        return results

    # ── Helpers ───────────────────────────────────────────────────────────

    @staticmethod
    def _parse_iso8601_duration(duration: str) -> int:
        """Convert ISO 8601 duration (PT1H2M3S) to total seconds."""
        match = re.match(
            r"PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?", duration
        )
        if not match:
            return 0
        hours = int(match.group(1) or 0)
        minutes = int(match.group(2) or 0)
        seconds = int(match.group(3) or 0)
        return hours * 3600 + minutes * 60 + seconds
