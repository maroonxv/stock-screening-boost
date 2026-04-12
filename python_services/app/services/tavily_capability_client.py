"""Strict Tavily adapter for external capability gateway."""

from __future__ import annotations

import os
import re
from typing import Any
from urllib.parse import urlparse

import httpx


class TavilyCapabilityClient:
    def __init__(
        self,
        *,
        api_key: str | None = None,
        base_url: str | None = None,
        timeout_seconds: float | None = None,
    ) -> None:
        self.api_key = (api_key or os.getenv("TAVILY_API_KEY", "")).strip()
        self.base_url = (
            base_url or os.getenv("TAVILY_BASE_URL", "https://api.tavily.com")
        ).rstrip("/")
        self.timeout_seconds = timeout_seconds or float(
            os.getenv("TAVILY_TIMEOUT_MS", "15000")
        ) / 1000

    def is_configured(self) -> bool:
        return bool(self.api_key)

    def diagnostics(self) -> dict[str, Any]:
        return {
            "endpoint": self.base_url,
            "configured": self.is_configured(),
            "timeoutSeconds": self.timeout_seconds,
        }

    def search(self, *, query: str, limit: int) -> list[dict[str, Any]]:
        if not self.api_key:
            raise RuntimeError("TAVILY_API_KEY not configured")

        response = self._request(
            "/search",
            {
                "query": query,
                "max_results": limit,
                "search_depth": "basic",
                "topic": "general",
                "include_raw_content": "markdown",
            },
        )
        results = response.get("results")
        if not isinstance(results, list):
            return []

        return [
            self._compact(
                {
                    "title": self._coerce_title(item),
                    "url": item.get("url") or "",
                    "description": item.get("content") or None,
                    "markdown": item.get("raw_content") or None,
                }
            )
            for item in results
            if isinstance(item, dict) and item.get("url")
        ]

    def fetch(self, *, url: str) -> dict[str, Any] | None:
        if not self.api_key:
            raise RuntimeError("TAVILY_API_KEY not configured")

        response = self._request(
            "/extract",
            {
                "urls": [url],
                "include_raw_content": True,
            },
        )
        results = response.get("results")
        if not isinstance(results, list) or not results:
            return None

        item = results[0]
        if not isinstance(item, dict):
            return None

        markdown = self._coerce_string(item.get("raw_content"))
        resolved_url = self._coerce_string(item.get("url")) or url
        title = self._extract_title(markdown) or self._hostname_or_url(resolved_url)
        description = self._extract_description(markdown)

        return self._compact(
            {
                "title": title,
                "url": resolved_url,
                "markdown": markdown or None,
                "description": description or None,
            }
        )

    def _request(self, path: str, body: dict[str, Any]) -> dict[str, Any]:
        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
        }
        with httpx.Client(timeout=self.timeout_seconds) as client:
            response = client.post(f"{self.base_url}{path}", json=body, headers=headers)
        response.raise_for_status()
        payload = response.json()
        return payload if isinstance(payload, dict) else {}

    def _coerce_title(self, item: dict[str, Any]) -> str:
        title = self._coerce_string(item.get("title"))
        if title:
            return title

        url = self._coerce_string(item.get("url"))
        return self._hostname_or_url(url)

    def _extract_title(self, markdown: str) -> str:
        if not markdown:
            return ""

        for line in markdown.splitlines():
            normalized = line.strip()
            if not normalized:
                continue
            heading = re.match(r"^#{1,6}\s+(.*)$", normalized)
            if heading:
                return heading.group(1).strip()
            return normalized[:160]

        return ""

    def _extract_description(self, markdown: str) -> str:
        if not markdown:
            return ""

        for line in markdown.splitlines():
            normalized = line.strip()
            if not normalized or normalized.startswith("#"):
                continue
            return normalized[:280]

        sanitized = re.sub(r"^#{1,6}\s+", "", markdown, flags=re.MULTILINE).strip()
        return sanitized[:280]

    def _hostname_or_url(self, url: str) -> str:
        parsed = urlparse(url)
        return parsed.netloc or url or "Untitled source"

    def _coerce_string(self, value: Any) -> str:
        return value.strip() if isinstance(value, str) else ""

    def _compact(self, payload: dict[str, Any]) -> dict[str, Any]:
        return {
            key: value for key, value in payload.items() if value is not None
        }
