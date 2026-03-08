"""Dataset cache policies for the unified gateway."""

from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class CachePolicy:
    fresh_ttl_seconds: int
    stale_ttl_seconds: int


_DEFAULT_POLICY = CachePolicy(fresh_ttl_seconds=300, stale_ttl_seconds=1800)

_DATASET_POLICIES: dict[str, CachePolicy] = {
    "stock_snapshot": CachePolicy(fresh_ttl_seconds=30, stale_ttl_seconds=120),
    "stock_batch": CachePolicy(fresh_ttl_seconds=30, stale_ttl_seconds=120),
    "theme_candidates": CachePolicy(fresh_ttl_seconds=300, stale_ttl_seconds=1800),
    "theme_news": CachePolicy(fresh_ttl_seconds=300, stale_ttl_seconds=1800),
    "theme_concepts": CachePolicy(fresh_ttl_seconds=600, stale_ttl_seconds=7200),
    "company_evidence": CachePolicy(fresh_ttl_seconds=21600, stale_ttl_seconds=86400),
}


def get_cache_policy(dataset: str) -> CachePolicy:
    return _DATASET_POLICIES.get(dataset, _DEFAULT_POLICY)

