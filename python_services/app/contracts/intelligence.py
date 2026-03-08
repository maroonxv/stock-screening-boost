"""Standardized intelligence data contracts."""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field

from app.contracts.meta import GatewayResponse


class ThemeNewsItem(BaseModel):
    id: str
    title: str
    summary: str
    source: str
    publishedAt: str
    sentiment: str
    relevanceScore: float
    relatedStocks: list[str] = Field(default_factory=list)


class ThemeNewsData(BaseModel):
    theme: str
    newsItems: list[ThemeNewsItem]


class ConceptMatchItem(BaseModel):
    name: str
    code: str | None = None
    aliases: list[str] = Field(default_factory=list)
    confidence: float = Field(..., ge=0, le=1)
    reason: str
    source: str


class ThemeConceptsData(BaseModel):
    theme: str
    matchedBy: Literal["whitelist", "zhipu", "auto"]
    conceptMatches: list[ConceptMatchItem]


class CompanyEvidence(BaseModel):
    stockCode: str
    companyName: str
    concept: str
    evidenceSummary: str
    catalysts: list[str] = Field(default_factory=list)
    risks: list[str] = Field(default_factory=list)
    credibilityScore: int = Field(..., ge=0, le=100)
    updatedAt: str


class StockEvidenceData(BaseModel):
    stockCode: str
    concept: str
    evidence: CompanyEvidence


class ThemeNewsResponse(GatewayResponse[ThemeNewsData]):
    pass


class ThemeConceptsResponse(GatewayResponse[ThemeConceptsData]):
    pass


class StockEvidenceResponse(GatewayResponse[StockEvidenceData]):
    pass

