from __future__ import annotations

import httpx
import pytest

from app.services.tavily_capability_client import TavilyCapabilityClient


class _MockResponse:
    def __init__(self, payload: dict[str, object], status_code: int = 200) -> None:
        self._payload = payload
        self.status_code = status_code

    def raise_for_status(self) -> None:
        if self.status_code >= 400:
            request = httpx.Request("POST", "https://api.tavily.com")
            response = httpx.Response(
                self.status_code,
                request=request,
                json=self._payload,
            )
            raise httpx.HTTPStatusError(
                f"{self.status_code} error",
                request=request,
                response=response,
            )

    def json(self) -> dict[str, object]:
        return self._payload


def test_search_maps_tavily_results(monkeypatch: pytest.MonkeyPatch) -> None:
    requests: list[tuple[str, dict[str, object], dict[str, str]]] = []

    def fake_post(
        self,
        url: str,
        *,
        json: dict[str, object],
        headers: dict[str, str],
    ) -> _MockResponse:
        requests.append((url, json, headers))
        return _MockResponse(
            {
                "results": [
                    {
                        "title": "Tavily result",
                        "url": "https://example.com/report",
                        "content": "Short description",
                        "raw_content": "# Headline\nDetailed source body",
                    }
                ]
            }
        )

    monkeypatch.setattr(httpx.Client, "post", fake_post)

    client = TavilyCapabilityClient(
        api_key="test-key",
        base_url="https://api.tavily.com",
        timeout_seconds=3,
    )

    result = client.search(query="AI infra", limit=3)

    assert result == [
        {
            "title": "Tavily result",
            "url": "https://example.com/report",
            "description": "Short description",
            "markdown": "# Headline\nDetailed source body",
        }
    ]
    assert requests == [
        (
            "https://api.tavily.com/search",
            {
                "query": "AI infra",
                "max_results": 3,
                "include_raw_content": True,
            },
            {
                "Authorization": "Bearer test-key",
                "Content-Type": "application/json",
            },
        )
    ]


def test_fetch_maps_extract_result_to_gateway_shape(monkeypatch: pytest.MonkeyPatch) -> None:
    def fake_post(
        self,
        url: str,
        *,
        json: dict[str, object],
        headers: dict[str, str],
    ) -> _MockResponse:
        return _MockResponse(
            {
                "results": [
                    {
                        "url": "https://example.com/article",
                        "raw_content": "# Example title\nSecond paragraph with more details.",
                    }
                ]
            }
        )

    monkeypatch.setattr(httpx.Client, "post", fake_post)

    client = TavilyCapabilityClient(
        api_key="test-key",
        base_url="https://api.tavily.com",
        timeout_seconds=3,
    )

    result = client.fetch(url="https://example.com/article")

    assert result == {
        "title": "Example title",
        "url": "https://example.com/article",
        "markdown": "# Example title\nSecond paragraph with more details.",
        "description": "Second paragraph with more details.",
    }


def test_search_raises_upstream_http_error(monkeypatch: pytest.MonkeyPatch) -> None:
    def fake_post(
        self,
        url: str,
        *,
        json: dict[str, object],
        headers: dict[str, str],
    ) -> _MockResponse:
        return _MockResponse({"detail": "upstream failed"}, status_code=429)

    monkeypatch.setattr(httpx.Client, "post", fake_post)

    client = TavilyCapabilityClient(
        api_key="test-key",
        base_url="https://api.tavily.com",
        timeout_seconds=3,
    )

    with pytest.raises(httpx.HTTPStatusError):
        client.search(query="AI infra", limit=3)
