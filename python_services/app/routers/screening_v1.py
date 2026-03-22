"""Strict iFinD-backed screening workbench routes."""

from __future__ import annotations

from functools import lru_cache

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel, Field

from app.services.akshare_adapter import AkShareAdapter
from app.services.screening_catalog import load_indicator_catalog
from app.services.screening_formula_engine import SafeFormulaEngine
from app.services.screening_ifind_gateway import IFindWorkbenchGateway, resolve_periods
from app.services.screening_query_service import ScreeningQueryService
from app.services.screening_universe import ScreeningStockSearcher

router = APIRouter(prefix="/api/v1/screening", tags=["screening-v1"])


class FormulaValidationRequest(BaseModel):
    expression: str = Field(..., min_length=1)
    targetIndicators: list[str] = Field(default_factory=list, max_length=5)


class ScreeningQueryRequest(BaseModel):
    stockCodes: list[str] = Field(..., min_length=1, max_length=20)
    indicators: list[dict[str, str]]
    formulas: list[dict[str, object]] = Field(default_factory=list)
    timeConfig: dict[str, str]


def _infer_market(stock_code: str) -> str:
    if stock_code.startswith(("0", "3")):
        return "SZ"
    if stock_code.startswith(("4", "8")):
        return "BJ"
    return "SH"


def load_stock_search_universe() -> list[dict[str, str]]:
    frame = AkShareAdapter.get_stock_code_name_frame()
    if frame.empty:
        return []

    records: list[dict[str, str]] = []
    for _, row in frame.iterrows():
        stock_code = str(row.get("code") or "").strip()
        stock_name = str(row.get("name") or "").strip()
        if not stock_code or not stock_name:
            continue

        records.append(
            {
                "stockCode": stock_code,
                "stockName": stock_name,
                "market": _infer_market(stock_code),
            }
        )

    return records


@lru_cache(maxsize=1)
def get_stock_searcher() -> ScreeningStockSearcher:
    return ScreeningStockSearcher(universe_loader=load_stock_search_universe)


@router.get("/stocks/search")
def search_stocks(
    keyword: str = Query(..., min_length=1),
    limit: int = Query(20, ge=1, le=20),
):
    try:
        return get_stock_searcher().search(keyword, limit)
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@router.get("/indicator-categories")
def list_indicator_categories():
    return load_indicator_catalog()["categories"]


@router.get("/indicators")
def list_indicators():
    return load_indicator_catalog()["items"]


@router.post("/formulas/validate")
def validate_formula(request: FormulaValidationRequest):
    engine = SafeFormulaEngine()
    result = engine.validate(
        expression=request.expression,
        target_indicators=request.targetIndicators,
    )
    return {
        "valid": result.valid,
        "normalizedExpression": result.normalized_expression,
        "referencedMetrics": result.referenced_metrics,
        "errors": result.errors,
    }


@router.post("/query")
def query_dataset(request: ScreeningQueryRequest):
    try:
        gateway = IFindWorkbenchGateway()
        service = ScreeningQueryService(gateway=gateway)
        periods = resolve_periods(request.timeConfig)
        return service.query_dataset(
            stock_codes=request.stockCodes,
            indicators=request.indicators,
            formulas=request.formulas,
            periods=periods,
        )
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=500, detail=str(exc)) from exc
