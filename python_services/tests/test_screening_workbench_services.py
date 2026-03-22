from __future__ import annotations

from app.services.screening_formula_engine import SafeFormulaEngine
from app.services.screening_query_service import ScreeningQueryService
from app.services.screening_universe import ScreeningStockSearcher


def test_stock_searcher_uses_cached_universe_loader():
    calls: list[str] = []

    def load_universe():
        calls.append("load")
        return [
            {"stockCode": "600519", "stockName": "贵州茅台", "market": "SH"},
            {"stockCode": "000001", "stockName": "平安银行", "market": "SZ"},
        ]

    searcher = ScreeningStockSearcher(
        universe_loader=load_universe,
        ttl_seconds=300,
        now_fn=lambda: 100.0,
    )

    first = searcher.search("茅台", limit=20)
    second = searcher.search("6005", limit=20)

    assert calls == ["load"]
    assert first == [
        {
            "stockCode": "600519",
            "stockName": "贵州茅台",
            "market": "SH",
            "matchField": "NAME",
        }
    ]
    assert second == [
        {
            "stockCode": "600519",
            "stockName": "贵州茅台",
            "market": "SH",
            "matchField": "CODE",
        }
    ]


def test_safe_formula_engine_validates_expression_and_target_limit():
    engine = SafeFormulaEngine()

    valid = engine.validate(
        expression="var[0] / var[1]",
        target_indicators=["营业收入", "归母净利润"],
    )
    invalid = engine.validate(
        expression="max(var[0], var[1])",
        target_indicators=["A", "B"],
    )
    too_many_targets = engine.validate(
        expression="var[0] + var[1]",
        target_indicators=["A", "B", "C", "D", "E", "F"],
    )

    assert valid.valid is True
    assert valid.normalized_expression == "var[0] / var[1]"
    assert invalid.valid is False
    assert invalid.errors
    assert too_many_targets.valid is False


def test_screening_query_service_chunks_statement_queries_by_budget():
    class FakeGateway:
        def __init__(self) -> None:
            self.statement_calls: list[tuple[list[str], list[str], str]] = []

        def query_statement_series(
            self,
            stock_codes: list[str],
            indicators: list[dict[str, str]],
            period: str,
        ) -> dict[str, dict[str, float | None]]:
            self.statement_calls.append(
                (stock_codes[:], [item["id"] for item in indicators], period)
            )
            return {
                stock_code: {
                    indicator["id"]: float(index + len(stock_code))
                    for index, indicator in enumerate(indicators)
                }
                for stock_code in stock_codes
            }

        def query_latest_snapshot(
            self,
            stock_codes: list[str],
            indicators: list[dict[str, str]],
        ) -> dict[str, dict[str, float | None]]:
            return {
                stock_code: {
                    indicator["id"]: float(index + len(stock_code))
                    for index, indicator in enumerate(indicators)
                }
                for stock_code in stock_codes
            }

    gateway = FakeGateway()
    service = ScreeningQueryService(gateway=gateway)

    stock_codes = [f"{600000 + index}" for index in range(20)]
    indicators = [
        {
            "id": f"metric_{index}",
            "name": f"指标{index}",
            "retrievalMode": "statement_series",
            "periodScope": "series",
            "valueType": "NUMBER",
        }
        for index in range(10)
    ]

    result = service.query_dataset(
        stock_codes=stock_codes,
        indicators=indicators,
        formulas=[],
        periods=["2022", "2023", "2024"],
    )

    assert result["provider"] == "ifind"
    assert len(gateway.statement_calls) == 24
    assert gateway.statement_calls[0] == (
        stock_codes[:5],
        [f"metric_{index}" for index in range(8)],
        "2022",
    )
    assert gateway.statement_calls[1] == (
        stock_codes[:5],
        ["metric_8", "metric_9"],
        "2022",
    )
    assert gateway.statement_calls[2][2] == "2023"
