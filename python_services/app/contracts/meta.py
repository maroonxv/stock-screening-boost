"""Standardized response metadata contracts."""

from __future__ import annotations

from typing import Generic, TypeVar

from pydantic import BaseModel, Field

_T = TypeVar("_T")


class GatewayWarning(BaseModel):
    code: str
    message: str


class GatewayMeta(BaseModel):
    requestId: str
    provider: str
    cacheHit: bool
    isStale: bool
    latencyMs: int = Field(..., ge=0)
    asOf: str
    warnings: list[GatewayWarning] = Field(default_factory=list)


class GatewayResponse(BaseModel, Generic[_T]):
    meta: GatewayMeta
    data: _T


class GatewayErrorBody(BaseModel):
    code: str
    message: str


class GatewayErrorResponse(BaseModel):
    meta: GatewayMeta
    error: GatewayErrorBody

