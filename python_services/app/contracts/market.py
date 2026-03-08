"""Standardized market data contracts."""

from __future__ import annotations

from pydantic import BaseModel, Field

from app.contracts.common import BatchItemError
from app.contracts.meta import GatewayResponse


class MarketStock(BaseModel):
    stockCode: str
    exchange: str
    market: str
    securityType: str
    stockName: str
    industry: str
    concepts: list[str] = Field(default_factory=list)
    marketCap: float | None = None
    floatMarketCap: float | None = None
    turnoverRate: float | None = None
    changePercent: float | None = None
    pe: float | None = None
    pb: float | None = None
    roe: float | None = None
    eps: float | None = None
    revenue: float | None = None
    netProfit: float | None = None
    debtRatio: float | None = None
    asOf: str
    provider: str


class ThemeCandidate(BaseModel):
    stockCode: str
    stockName: str
    concept: str
    reason: str
    heat: float = Field(..., ge=0, le=100)


class MarketStockBatchData(BaseModel):
    items: list[MarketStock]
    errors: list[BatchItemError] = Field(default_factory=list)


class ThemeCandidatesData(BaseModel):
    theme: str
    candidates: list[ThemeCandidate]


class MarketStockResponse(GatewayResponse[MarketStock]):
    pass


class MarketStockBatchResponse(GatewayResponse[MarketStockBatchData]):
    pass


class ThemeCandidatesResponse(GatewayResponse[ThemeCandidatesData]):
    pass

