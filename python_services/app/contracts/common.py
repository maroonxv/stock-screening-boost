"""Shared request and response contracts."""

from pydantic import BaseModel, Field


class StockBatchRequest(BaseModel):
    stockCodes: list[str] = Field(..., min_length=1, max_length=100)


class BatchItemError(BaseModel):
    stockCode: str
    code: str
    message: str

