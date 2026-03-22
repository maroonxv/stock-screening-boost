"""Dataset assembly service for the screening workbench."""

from __future__ import annotations

from typing import Protocol

from app.services.screening_formula_engine import SafeFormulaEngine


class ScreeningGateway(Protocol):
    def query_statement_series(
        self,
        stock_codes: list[str],
        indicators: list[dict[str, str]],
        period: str,
    ) -> dict[str, dict[str, float | None]]: ...

    def query_latest_snapshot(
        self,
        stock_codes: list[str],
        indicators: list[dict[str, str]],
    ) -> dict[str, dict[str, float | None]]: ...

    def resolve_stock_metadata(self, stock_codes: list[str]) -> dict[str, dict[str, str]]: ...


def _chunked(items: list[str] | list[dict[str, str]], size: int):
    return [items[index : index + size] for index in range(0, len(items), size)]


class ScreeningQueryService:
    def __init__(
        self,
        *,
        gateway: ScreeningGateway,
        formula_engine: SafeFormulaEngine | None = None,
    ) -> None:
        self._gateway = gateway
        self._formula_engine = formula_engine or SafeFormulaEngine()

    def query_dataset(
        self,
        *,
        stock_codes: list[str],
        indicators: list[dict[str, str]],
        formulas: list[dict[str, object]],
        periods: list[str],
    ) -> dict[str, object]:
        stock_chunks = _chunked(stock_codes, 5)
        indicator_chunks = _chunked(indicators, 8)
        stock_meta = (
            self._gateway.resolve_stock_metadata(stock_codes)
            if hasattr(self._gateway, "resolve_stock_metadata")
            else {stock_code: {"stockName": stock_code} for stock_code in stock_codes}
        )

        series_values: dict[str, dict[str, dict[str, float | None]]] = {
            stock_code: {} for stock_code in stock_codes
        }
        latest_values: dict[str, dict[str, float | None]] = {
            stock_code: {} for stock_code in stock_codes
        }

        series_indicators = [
            indicator
            for indicator in indicators
            if indicator.get("retrievalMode") == "statement_series"
        ]
        latest_indicators = [
            indicator
            for indicator in indicators
            if indicator.get("retrievalMode") == "latest_only"
        ]

        for stock_chunk in stock_chunks:
            for period in periods:
                for indicator_chunk in _chunked(series_indicators, 8):
                    if not indicator_chunk:
                        continue
                    payload = self._gateway.query_statement_series(
                        stock_chunk,
                        indicator_chunk,
                        period,
                    )
                    for stock_code, metric_values in payload.items():
                        stock_bucket = series_values.setdefault(stock_code, {})
                        for metric_id, value in metric_values.items():
                            metric_bucket = stock_bucket.setdefault(metric_id, {})
                            metric_bucket[period] = value

        for stock_chunk in stock_chunks:
            for indicator_chunk in _chunked(latest_indicators, 8):
                if not indicator_chunk:
                    continue
                payload = self._gateway.query_latest_snapshot(
                    stock_chunk,
                    indicator_chunk,
                )
                for stock_code, metric_values in payload.items():
                    latest_values.setdefault(stock_code, {}).update(metric_values)

        inferred_formula_meta: list[dict[str, str]] = []
        for formula in formulas:
            formula_id = str(formula["id"])
            expression = str(formula["expression"])
            target_indicators = list(formula.get("targetIndicators", []))
            formula_period_scope = (
                "series"
                if any(metric_id in series_values[stock_codes[0]] for metric_id in target_indicators)
                else "latest_only"
            )
            inferred_formula_meta.append(
                {
                    "id": formula_id,
                    "name": str(formula["name"]),
                    "valueType": "NUMBER",
                    "periodScope": formula_period_scope,
                    "retrievalMode": "formula",
                }
            )

            if formula_period_scope == "series":
                for stock_code in stock_codes:
                    stock_bucket = series_values.setdefault(stock_code, {})
                    metric_bucket = stock_bucket.setdefault(formula_id, {})
                    for period in periods:
                        variables = [
                            stock_bucket.get(metric_id, {}).get(period)
                            or latest_values.get(stock_code, {}).get(metric_id)
                            for metric_id in target_indicators
                        ]
                        metric_bucket[period] = self._formula_engine.evaluate(
                            expression=expression,
                            variables=variables,
                        )
            else:
                for stock_code in stock_codes:
                    variables = [
                        latest_values.get(stock_code, {}).get(metric_id)
                        for metric_id in target_indicators
                    ]
                    latest_values.setdefault(stock_code, {})[formula_id] = (
                        self._formula_engine.evaluate(
                            expression=expression,
                            variables=variables,
                        )
                    )

        indicator_meta = [
            {
                "id": indicator["id"],
                "name": indicator["name"],
                "valueType": indicator["valueType"],
                "periodScope": indicator["periodScope"],
                "retrievalMode": indicator["retrievalMode"],
            }
            for indicator in indicators
        ] + inferred_formula_meta

        latest_snapshot_rows: list[dict[str, object]] = []
        rows: list[dict[str, object]] = []
        for stock_code in stock_codes:
            stock_name = stock_meta.get(stock_code, {}).get("stockName", stock_code)
            metric_rows: dict[str, dict[str, dict[str, float | None]]] = {}
            metric_latest: dict[str, dict[str, float | str | None]] = {}

            for meta in indicator_meta:
                metric_id = meta["id"]
                if meta["periodScope"] == "series":
                    by_period = series_values.get(stock_code, {}).get(metric_id, {})
                    metric_rows[metric_id] = {"byPeriod": by_period}
                    latest_period = next(
                        (
                            period
                            for period in reversed(periods)
                            if by_period.get(period) is not None
                        ),
                        None,
                    )
                    metric_latest[metric_id] = {
                        "value": by_period.get(latest_period) if latest_period else None,
                        "period": latest_period,
                    }
                else:
                    metric_latest[metric_id] = {
                        "value": latest_values.get(stock_code, {}).get(metric_id),
                        "period": None,
                    }

            rows.append(
                {
                    "stockCode": stock_code,
                    "stockName": stock_name,
                    "metrics": metric_rows,
                }
            )
            latest_snapshot_rows.append(
                {
                    "stockCode": stock_code,
                    "stockName": stock_name,
                    "metrics": metric_latest,
                }
            )

        return {
            "periods": periods,
            "indicatorMeta": indicator_meta,
            "rows": rows,
            "latestSnapshotRows": latest_snapshot_rows,
            "warnings": [],
            "dataStatus": "READY" if rows else "EMPTY",
            "provider": "ifind",
        }
