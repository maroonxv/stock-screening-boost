"""Strict iFinD gateway used by the screening workbench."""

from __future__ import annotations

from datetime import date
import re

from app.providers.screening.ifind_provider import THS_DR, IFindScreeningProvider


class IFindWorkbenchGateway:
    def __init__(self, provider: IFindScreeningProvider | None = None) -> None:
        self._provider = provider or IFindScreeningProvider()

    def load_universe(self) -> list[dict[str, str]]:
        self._provider._ensure_login()  # noqa: SLF001
        self._provider._ensure_ifind_api_loaded()  # noqa: SLF001
        if THS_DR is None:
            raise RuntimeError("iFinDPy 未安装，无法加载股票池")

        raw = THS_DR(
            "001005001",
            "ths_stock_code_stock,ths_stock_short_name_stock",
            "block:001005001",
        )
        frame = self._provider._extract_frame(  # noqa: SLF001
            self._provider._ensure_success(raw, "THS_DR")  # noqa: SLF001
        )
        records: list[dict[str, str]] = []
        for _, row in frame.iterrows():
            stock_code = self._provider._normalize_stock_code(row.iloc[0])  # noqa: SLF001
            stock_name = self._provider._clean_text(row.iloc[1])  # noqa: SLF001
            if not stock_code or not stock_name:
                continue
            records.append(
                {
                    "stockCode": stock_code,
                    "stockName": stock_name,
                    "market": "SH" if stock_code.startswith("6") else "SZ",
                }
            )
        return records

    def resolve_stock_metadata(self, stock_codes: list[str]) -> dict[str, dict[str, str]]:
        snapshot = self._provider.get_stock_batch(stock_codes)
        return {
            item["code"]: {
                "stockName": item.get("name", item["code"]),
                "market": "SH" if str(item["code"]).startswith("6") else "SZ",
            }
            for item in snapshot
        }

    def query_statement_series(
        self,
        stock_codes: list[str],
        indicators: list[dict[str, str]],
        period: str,
    ) -> dict[str, dict[str, float | None]]:
        query_date = normalize_period_label(period)
        results = {stock_code: {} for stock_code in stock_codes}
        for indicator in indicators:
            provider_field = indicator.get("providerField") or indicator["id"]
            try:
                value_map = self._provider._query_batch_basic_data(  # noqa: SLF001
                    stock_codes,
                    provider_field,
                    f"{query_date},101",
                )
            except Exception:
                value_map = self._provider._query_batch_basic_data(  # noqa: SLF001
                    stock_codes,
                    provider_field,
                    "101",
                )
            for stock_code in stock_codes:
                results[stock_code][indicator["id"]] = self._provider._safe_float(  # noqa: SLF001
                    value_map.get(stock_code)
                )
        return results

    def query_latest_snapshot(
        self,
        stock_codes: list[str],
        indicators: list[dict[str, str]],
    ) -> dict[str, dict[str, float | None]]:
        results = {stock_code: {} for stock_code in stock_codes}
        for indicator in indicators:
            provider_field = indicator.get("providerField") or indicator["id"]
            value_map = self._provider._query_batch_basic_data(  # noqa: SLF001
                stock_codes,
                provider_field,
                "",
            )
            for stock_code in stock_codes:
                results[stock_code][indicator["id"]] = self._provider._safe_float(  # noqa: SLF001
                    value_map.get(stock_code)
                )
        return results


def normalize_period_label(period: str) -> str:
    if re.fullmatch(r"\d{4}", period):
        return f"{period}-12-31"

    match = re.fullmatch(r"(\d{4})Q([1-4])", period)
    if not match:
        return period

    year = match.group(1)
    quarter = match.group(2)
    month_day = {
        "1": "03-31",
        "2": "06-30",
        "3": "09-30",
        "4": "12-31",
    }
    return f"{year}-{month_day[quarter]}"


def resolve_periods(time_config: dict[str, str], today: date | None = None) -> list[str]:
    reference_date = today or date.today()
    period_type = time_config["periodType"]
    range_mode = time_config["rangeMode"]

    if range_mode == "CUSTOM":
        start = time_config.get("customStart", "")
        end = time_config.get("customEnd", "")
        if period_type == "ANNUAL" and start.isdigit() and end.isdigit():
            start_year = int(start)
            end_year = int(end)
            return [str(year) for year in range(start_year, end_year + 1)]
        if period_type == "QUARTERLY":
            return _quarter_range(start, end)
        return [value for value in [start, end] if value]

    if period_type == "ANNUAL":
        count = {"1Y": 1, "3Y": 3, "5Y": 5}[time_config["presetKey"]]
        end_year = reference_date.year - 1
        return [str(year) for year in range(end_year - count + 1, end_year + 1)]

    count = {"4Q": 4, "8Q": 8, "12Q": 12}[time_config["presetKey"]]
    current_quarter = ((reference_date.month - 1) // 3) + 1
    year = reference_date.year
    quarter = current_quarter - 1
    if quarter == 0:
        quarter = 4
        year -= 1

    periods: list[str] = []
    for _ in range(count):
        periods.append(f"{year}Q{quarter}")
        quarter -= 1
        if quarter == 0:
            quarter = 4
            year -= 1
    return list(reversed(periods))


def _quarter_range(start: str, end: str) -> list[str]:
    start_match = re.fullmatch(r"(\d{4})Q([1-4])", start)
    end_match = re.fullmatch(r"(\d{4})Q([1-4])", end)
    if not start_match or not end_match:
        return [value for value in [start, end] if value]

    year = int(start_match.group(1))
    quarter = int(start_match.group(2))
    end_year = int(end_match.group(1))
    end_quarter = int(end_match.group(2))

    periods: list[str] = []
    while year < end_year or (year == end_year and quarter <= end_quarter):
        periods.append(f"{year}Q{quarter}")
        quarter += 1
        if quarter == 5:
            quarter = 1
            year += 1
    return periods
