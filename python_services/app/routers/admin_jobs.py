"""Admin endpoints for gateway jobs and metrics."""

from __future__ import annotations

from fastapi import APIRouter, Body

from app.contracts.admin import (
    JobExecutionSummary,
    MetricsSnapshotResponse,
    PrewarmHotThemesJobRequest,
    RefreshConceptsJobRequest,
    RefreshUniverseJobRequest,
)
from app.infrastructure.metrics.recorder import metrics_recorder
from app.jobs.prewarm_hot_themes import PrewarmHotThemesJob
from app.jobs.refresh_concepts import RefreshConceptsJob
from app.jobs.refresh_universe import RefreshUniverseJob

router = APIRouter(prefix="/api/admin", tags=["admin-jobs"])


@router.get("/metrics", response_model=MetricsSnapshotResponse)
async def get_gateway_metrics():
    return metrics_recorder.snapshot()


@router.post("/jobs/refresh-universe", response_model=JobExecutionSummary)
async def refresh_universe(
    body: RefreshUniverseJobRequest | None = Body(default=None),
):
    payload = body or RefreshUniverseJobRequest()
    return RefreshUniverseJob().run(limit=payload.limit, batch_size=payload.batchSize)


@router.post("/jobs/refresh-concepts", response_model=JobExecutionSummary)
async def refresh_concepts(
    body: RefreshConceptsJobRequest | None = Body(default=None),
):
    payload = body or RefreshConceptsJobRequest()
    return RefreshConceptsJob().run(limit=payload.limit)


@router.post("/jobs/prewarm-hot-themes", response_model=JobExecutionSummary)
async def prewarm_hot_themes(
    body: PrewarmHotThemesJobRequest | None = Body(default=None),
):
    payload = body or PrewarmHotThemesJobRequest()
    return PrewarmHotThemesJob().run(
        themes=payload.themes,
        max_themes=payload.maxThemes,
        evidence_per_theme=payload.evidencePerTheme,
    )

