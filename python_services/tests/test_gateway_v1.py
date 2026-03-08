"""Tests for standardized v1 gateway endpoints and stale cache fallback."""

from __future__ import annotations

from fastapi.testclient import TestClient
from unittest.mock import patch

from app.gateway.common import build_cache_key, gateway_cache
from app.main import app
from app.policies.cache_policy import CachePolicy

client = TestClient(app)


def setup_function() -> None:
    gateway_cache.clear()


def test_get_v1_market_stock_success() -> None:
    with patch(
        "app.providers.akshare.client.AkShareProviderClient.get_stock_snapshot",
        return_value={
            "code": "600519",
            "name": "贵州茅台",
            "industry": "白酒",
            "marketCap": 21000.0,
            "floatMarketCap": 20500.0,
            "pe": 35.5,
            "pb": 10.2,
            "roe": 0.28,
            "dataDate": "2026-03-08",
        },
    ):
        response = client.get("/api/v1/market/stocks/600519")

    assert response.status_code == 200
    payload = response.json()
    assert payload["meta"]["provider"] == "akshare"
    assert payload["meta"]["cacheHit"] is False
    assert payload["data"]["stockCode"] == "600519"
    assert payload["data"]["exchange"] == "SSE"
    assert payload["data"]["stockName"] == "贵州茅台"


def test_get_v1_market_batch_reports_partial_errors() -> None:
    with patch(
        "app.providers.akshare.client.AkShareProviderClient.get_stock_batch",
        return_value=[
            {
                "code": "600519",
                "name": "贵州茅台",
                "industry": "白酒",
                "dataDate": "2026-03-08",
            }
        ],
    ):
        response = client.post(
            "/api/v1/market/stocks/batch",
            json={"stockCodes": ["600519", "000001"]},
        )

    assert response.status_code == 200
    payload = response.json()
    assert len(payload["data"]["items"]) == 1
    assert payload["data"]["items"][0]["stockCode"] == "600519"
    assert len(payload["data"]["errors"]) == 1
    assert payload["data"]["errors"][0]["stockCode"] == "000001"
    assert any(
        warning["code"] == "partial_results" for warning in payload["meta"]["warnings"]
    )


def test_get_v1_theme_news_success() -> None:
    with patch(
        "app.providers.akshare.client.AkShareProviderClient.get_theme_news",
        return_value=[
            {
                "id": "ai-1",
                "title": "AI 算力需求提升",
                "summary": "产业链景气度持续改善。",
                "source": "akshare",
                "publishedAt": "2026-03-08T08:00:00+00:00",
                "sentiment": "positive",
                "relevanceScore": 0.92,
                "relatedStocks": ["603019"],
            }
        ],
    ):
        response = client.get("/api/v1/intelligence/themes/AI/news")

    assert response.status_code == 200
    payload = response.json()
    assert payload["data"]["theme"] == "AI"
    assert payload["data"]["newsItems"][0]["id"] == "ai-1"


def test_market_gateway_uses_stale_cache_when_provider_fails() -> None:
    cache_key = build_cache_key(
        dataset="stock_snapshot",
        provider="akshare",
        params={"stockCode": "600519"},
    )
    gateway_cache.set(
        key=cache_key,
        value={
            "stockCode": "600519",
            "exchange": "SSE",
            "market": "CN-A",
            "securityType": "equity",
            "stockName": "贵州茅台",
            "industry": "白酒",
            "concepts": [],
            "marketCap": 21000.0,
            "floatMarketCap": 20500.0,
            "turnoverRate": None,
            "changePercent": None,
            "pe": 35.5,
            "pb": 10.2,
            "roe": 0.28,
            "eps": None,
            "revenue": None,
            "netProfit": None,
            "debtRatio": None,
            "asOf": "2026-03-08",
            "provider": "akshare",
        },
        policy=CachePolicy(fresh_ttl_seconds=0, stale_ttl_seconds=120),
        as_of="2026-03-08T08:00:00+00:00",
    )

    with patch(
        "app.providers.akshare.client.AkShareProviderClient.get_stock_snapshot",
        side_effect=Exception("provider down"),
    ):
        response = client.get("/api/v1/market/stocks/600519")

    assert response.status_code == 200
    payload = response.json()
    assert payload["meta"]["cacheHit"] is True
    assert payload["meta"]["isStale"] is True
    assert payload["data"]["stockCode"] == "600519"
    assert any(
        warning["code"] == "stale_cache" for warning in payload["meta"]["warnings"]
    )
