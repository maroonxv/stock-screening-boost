"""Contracts for admin jobs and metrics endpoints."""

from __future__ import annotations

from typing import Any, Literal

from pydantic import BaseModel, Field


class RefreshUniverseJobRequest(BaseModel):
    limit: int | None = Field(default=None, ge=1, le=6000)
    batchSize: int = Field(default=200, ge=1, le=1000)


class RefreshConceptsJobRequest(BaseModel):
    limit: int | None = Field(default=None, ge=1, le=1000)


class PrewarmHotThemesJobRequest(BaseModel):
    themes: list[str] = Field(default_factory=list, max_length=20)
    maxThemes: int = Field(default=5, ge=1, le=20)
    evidencePerTheme: int = Field(default=3, ge=1, le=10)


class JobExecutionSummary(BaseModel):
    job: str
    status: Literal["completed", "failed"]
    startedAt: str
    finishedAt: str
    stats: dict[str, Any] = Field(default_factory=dict)


class MetricCounterPoint(BaseModel):
    labels: dict[str, str] = Field(default_factory=dict)
    value: float


class MetricObservationPoint(BaseModel):
    labels: dict[str, str] = Field(default_factory=dict)
    count: int
    total: float
    avg: float
    min: float | None = None
    max: float | None = None
    last: float | None = None


class MetricsSnapshotResponse(BaseModel):
    capturedAt: str
    counters: dict[str, list[MetricCounterPoint]] = Field(default_factory=dict)
    observations: dict[str, list[MetricObservationPoint]] = Field(default_factory=dict)

