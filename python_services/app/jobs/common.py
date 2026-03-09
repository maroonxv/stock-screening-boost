"""Shared helpers for gateway jobs."""

from __future__ import annotations

from datetime import UTC, datetime
from typing import Any, TypeVar

from app.contracts.admin import JobExecutionSummary

_T = TypeVar("_T")


def iso_now() -> str:
    return datetime.now(UTC).isoformat()


def build_job_summary(
    job_name: str,
    started_at: str,
    stats: dict[str, Any],
    status: str = "completed",
) -> JobExecutionSummary:
    return JobExecutionSummary(
        job=job_name,
        status=status,
        startedAt=started_at,
        finishedAt=iso_now(),
        stats=stats,
    )


def chunked(items: list[_T], size: int) -> list[list[_T]]:
    if size <= 0:
        raise ValueError("chunk size must be greater than 0")
    return [items[index : index + size] for index in range(0, len(items), size)]

