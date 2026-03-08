"""Standardized v1 market data endpoints."""

from __future__ import annotations

from fastapi import APIRouter, Query, Request

from app.contracts.common import StockBatchRequest
from app.contracts.market import (
    MarketStockBatchResponse,
    MarketStockResponse,
    ThemeCandidatesResponse,
)
from app.gateway.common import GatewayError, is_valid_stock_code
from app.gateway.market_gateway import market_gateway

router = APIRouter(prefix="/api/v1/market")


@router.get("/stocks/{stock_code}", response_model=MarketStockResponse)
async def get_stock_snapshot(request: Request, stock_code: str):
    if not is_valid_stock_code(stock_code):
        raise GatewayError(
            code="invalid_stock_code",
            message=f"无效的股票代码格式: {stock_code}",
            status_code=400,
        )

    return market_gateway.get_stock(
        request_id=request.state.request_id,
        stock_code=stock_code,
    )


@router.post("/stocks/batch", response_model=MarketStockBatchResponse)
async def get_stock_batch(request: Request, body: StockBatchRequest):
    invalid_codes = [code for code in body.stockCodes if not is_valid_stock_code(code)]
    if invalid_codes:
        raise GatewayError(
            code="invalid_stock_code",
            message=f"无效的股票代码格式: {', '.join(invalid_codes)}",
            status_code=400,
        )

    return market_gateway.get_stock_batch(
        request_id=request.state.request_id,
        stock_codes=body.stockCodes,
    )


@router.get("/themes/{theme}/candidates", response_model=ThemeCandidatesResponse)
async def get_theme_candidates(
    request: Request,
    theme: str,
    limit: int = Query(6, ge=1, le=30),
):
    normalized_theme = theme.strip()
    if not normalized_theme:
        raise GatewayError(
            code="invalid_theme",
            message="主题不能为空",
            status_code=400,
        )

    return market_gateway.get_theme_candidates(
        request_id=request.state.request_id,
        theme=normalized_theme,
        limit=limit,
    )

