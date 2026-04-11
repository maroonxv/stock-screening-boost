"""TuShare-backed provider for timing stock bars and signal inputs."""

from __future__ import annotations

from importlib.util import find_spec
import os
from typing import Any

import pandas as pd

from app.gateway.common import GatewayError

_UNIVERSE_CACHE_TTL_SECONDS = 86_400
_FRAME_CACHE_TTL_SECONDS = 3_600

INDEX_BENCHMARK_TS_CODES = {
    "510300": "000300.SH",
    "510500": "000905.SH",
    "159915": "399006.SZ",
    "588000": "000688.SH",
}


def _create_tushare_client(token: str):
    if find_spec("tushare") is None:
        raise RuntimeError("tushare SDK is not installed")

    import tushare as ts  # pragma: no cover - runtime dependency

    return ts.pro_api(token)


def _now_timestamp() -> float:
    return pd.Timestamp.utcnow().timestamp()


class TushareTimingProvider:
    provider_name = "tushare"

    def __init__(self, *, token: str | None = None) -> None:
        self._token = token
        self._client = None
        self._universe_cache: tuple[float, dict[str, dict[str, str]]] | None = None
        self._daily_cache: dict[tuple[str, str | None, str | None], tuple[float, pd.DataFrame]] = {}
        self._adj_factor_cache: dict[
            tuple[str, str | None, str | None],
            tuple[float, pd.DataFrame],
        ] = {}
        self._daily_basic_cache: dict[
            tuple[str, str | None, str | None],
            tuple[float, pd.DataFrame],
        ] = {}
        self._index_daily_cache: dict[
            tuple[str, str | None, str | None],
            tuple[float, pd.DataFrame],
        ] = {}

    def get_stock_snapshot(self, stock_code: str) -> dict[str, Any]:
        normalized_code = self._normalize_stock_code(stock_code)
        record = self._lookup_stock_record(normalized_code)
        return {
            "code": normalized_code,
            "name": record["name"],
            "industry": record["industry"],
            "stockName": record["name"],
        }

    def get_stock_snapshots(self, stock_codes: list[str]) -> dict[str, dict[str, Any]]:
        universe_map = self._load_universe_map()
        snapshots: dict[str, dict[str, Any]] = {}
        for stock_code in self._normalize_requested_codes(stock_codes):
            record = universe_map.get(stock_code)
            if record is None:
                continue
            snapshots[stock_code] = {
                "code": stock_code,
                "name": record["name"],
                "industry": record["industry"],
                "stockName": record["name"],
            }
        return snapshots

    def get_stock_bars(
        self,
        stock_code: str,
        start_date: str | None,
        end_date: str | None,
        adjust: str,
    ) -> pd.DataFrame:
        normalized_code = self._normalize_stock_code(stock_code)
        if adjust not in {"", "qfq", "hfq"}:
            raise GatewayError(
                code="invalid_adjust",
                message=f"Unsupported adjust mode: {adjust}",
                status_code=400,
                provider=self.provider_name,
            )

        ts_code = self._lookup_stock_record(normalized_code)["ts_code"]
        daily_frame = self._load_daily_frame(ts_code, start_date, end_date)
        if daily_frame.empty:
            raise GatewayError(
                code="bars_not_found",
                message=f"Daily bars not found for {normalized_code}",
                status_code=404,
                provider=self.provider_name,
            )

        turnover_frame = self._load_daily_basic_frame(ts_code, start_date, end_date)
        merged = daily_frame.merge(turnover_frame, on="trade_date", how="left")

        if adjust:
            adj_factor_frame = self._load_adj_factor_frame(ts_code, start_date, end_date)
            if adj_factor_frame.empty:
                raise GatewayError(
                    code="bars_unavailable",
                    message=f"Missing adj factor for {normalized_code}",
                    status_code=503,
                    provider=self.provider_name,
                )
            merged = merged.merge(adj_factor_frame, on="trade_date", how="left")
            merged = self._apply_adjustment(merged, adjust)

        return self._to_timing_history_frame(merged, normalized_code)

    def get_benchmark_bars(
        self,
        benchmark_code: str,
        start_date: str | None,
        end_date: str | None,
    ) -> pd.DataFrame:
        normalized_code = self._normalize_stock_code(benchmark_code)
        ts_code = INDEX_BENCHMARK_TS_CODES.get(normalized_code)
        if ts_code is None:
            raise GatewayError(
                code="benchmark_not_supported",
                message=f"Benchmark not supported: {benchmark_code}",
                status_code=400,
                provider=self.provider_name,
            )

        frame = self._load_index_daily_frame(ts_code, start_date, end_date)
        if frame.empty:
            raise GatewayError(
                code="bars_not_found",
                message=f"Benchmark bars not found for {benchmark_code}",
                status_code=404,
                provider=self.provider_name,
            )

        return self._to_timing_history_frame(frame, normalized_code)

    def _get_client(self):
        if self._client is not None:
            return self._client

        token = self._token or os.getenv("TUSHARE_TOKEN", "").strip()
        if not token:
            raise RuntimeError("Missing TUSHARE_TOKEN")

        self._client = _create_tushare_client(token)
        return self._client

    def _load_universe_map(self) -> dict[str, dict[str, str]]:
        cached = self._universe_cache
        if cached is not None and _now_timestamp() - cached[0] <= _UNIVERSE_CACHE_TTL_SECONDS:
            return cached[1]

        frame = self._get_client().stock_basic(
            exchange="",
            list_status="L",
            fields="ts_code,symbol,name,industry",
        )
        universe_map: dict[str, dict[str, str]] = {}
        for _, row in frame.iterrows():
            stock_code = self._normalize_stock_code(row.get("symbol"))
            ts_code = str(row.get("ts_code") or "").strip().upper()
            if not stock_code or not ts_code:
                continue
            universe_map[stock_code] = {
                "ts_code": ts_code,
                "name": str(row.get("name") or stock_code).strip(),
                "industry": str(row.get("industry") or "").strip(),
            }

        self._universe_cache = (_now_timestamp(), universe_map)
        return universe_map

    def _lookup_stock_record(self, stock_code: str) -> dict[str, str]:
        record = self._load_universe_map().get(stock_code)
        if record is None:
            raise GatewayError(
                code="stock_not_found",
                message=f"Stock not found: {stock_code}",
                status_code=404,
                provider=self.provider_name,
            )
        return record

    def _load_daily_frame(
        self,
        ts_code: str,
        start_date: str | None,
        end_date: str | None,
    ) -> pd.DataFrame:
        cache_key = (ts_code, start_date, end_date)
        cached = self._read_frame_cache(self._daily_cache, cache_key)
        if cached is not None:
            return cached

        params = self._build_range_params(
            ts_code=ts_code,
            start_date=start_date,
            end_date=end_date,
            fields="trade_date,open,high,low,close,vol,amount",
        )
        frame = self._get_client().daily(**params)
        normalized = self._normalize_market_frame(frame)
        self._write_frame_cache(self._daily_cache, cache_key, normalized)
        return normalized

    def _load_adj_factor_frame(
        self,
        ts_code: str,
        start_date: str | None,
        end_date: str | None,
    ) -> pd.DataFrame:
        cache_key = (ts_code, start_date, end_date)
        cached = self._read_frame_cache(self._adj_factor_cache, cache_key)
        if cached is not None:
            return cached

        params = self._build_range_params(
            ts_code=ts_code,
            start_date=start_date,
            end_date=end_date,
            fields="trade_date,adj_factor",
        )
        frame = self._get_client().adj_factor(**params)
        normalized = self._normalize_market_frame(frame)
        self._write_frame_cache(self._adj_factor_cache, cache_key, normalized)
        return normalized

    def _load_daily_basic_frame(
        self,
        ts_code: str,
        start_date: str | None,
        end_date: str | None,
    ) -> pd.DataFrame:
        cache_key = (ts_code, start_date, end_date)
        cached = self._read_frame_cache(self._daily_basic_cache, cache_key)
        if cached is not None:
            return cached

        params = self._build_range_params(
            ts_code=ts_code,
            start_date=start_date,
            end_date=end_date,
            fields="trade_date,turnover_rate",
        )
        frame = self._get_client().daily_basic(**params)
        normalized = self._normalize_market_frame(frame)
        self._write_frame_cache(self._daily_basic_cache, cache_key, normalized)
        return normalized

    def _load_index_daily_frame(
        self,
        ts_code: str,
        start_date: str | None,
        end_date: str | None,
    ) -> pd.DataFrame:
        cache_key = (ts_code, start_date, end_date)
        cached = self._read_frame_cache(self._index_daily_cache, cache_key)
        if cached is not None:
            return cached

        params = self._build_range_params(
            ts_code=ts_code,
            start_date=start_date,
            end_date=end_date,
            fields="trade_date,open,high,low,close,vol,amount",
        )
        frame = self._get_client().index_daily(**params)
        normalized = self._normalize_market_frame(frame)
        self._write_frame_cache(self._index_daily_cache, cache_key, normalized)
        return normalized

    def _build_range_params(
        self,
        *,
        ts_code: str,
        start_date: str | None,
        end_date: str | None,
        fields: str,
    ) -> dict[str, str]:
        params = {
            "ts_code": ts_code,
            "fields": fields,
        }
        if start_date:
            params["start_date"] = self._normalize_ymd(start_date)
        if end_date:
            params["end_date"] = self._normalize_ymd(end_date)
        return params

    def _normalize_market_frame(self, frame: pd.DataFrame | None) -> pd.DataFrame:
        if frame is None:
            return pd.DataFrame()
        if frame.empty:
            return frame.copy()

        normalized = frame.copy()
        if "trade_date" in normalized.columns:
            normalized["trade_date"] = normalized["trade_date"].astype(str)
        return normalized.sort_values("trade_date").reset_index(drop=True)

    def _apply_adjustment(self, frame: pd.DataFrame, adjust: str) -> pd.DataFrame:
        adjusted = frame.copy()
        adjusted["adj_factor"] = pd.to_numeric(
            adjusted["adj_factor"],
            errors="coerce",
        )
        valid_adj_factors = adjusted["adj_factor"].dropna()
        if valid_adj_factors.empty:
            raise GatewayError(
                code="bars_unavailable",
                message="Adjustment factors are unavailable",
                status_code=503,
                provider=self.provider_name,
            )

        if adjust == "qfq":
            base_factor = float(valid_adj_factors.iloc[-1])
        else:
            base_factor = float(valid_adj_factors.iloc[0])

        if base_factor == 0:
            raise GatewayError(
                code="bars_unavailable",
                message="Adjustment factor baseline is invalid",
                status_code=503,
                provider=self.provider_name,
            )

        ratio = adjusted["adj_factor"] / base_factor
        for column in ("open", "high", "low", "close"):
            adjusted[column] = pd.to_numeric(adjusted[column], errors="coerce") * ratio

        return adjusted

    def _to_timing_history_frame(
        self,
        frame: pd.DataFrame,
        stock_code: str,
    ) -> pd.DataFrame:
        normalized = frame.copy()
        for column in ("open", "high", "low", "close", "vol", "amount", "turnover_rate"):
            if column in normalized.columns:
                normalized[column] = pd.to_numeric(normalized[column], errors="coerce")

        if "turnover_rate" not in normalized.columns:
            normalized["turnover_rate"] = pd.NA

        return pd.DataFrame(
            {
                "日期": normalized["trade_date"],
                "股票代码": stock_code,
                "开盘": normalized["open"],
                "收盘": normalized["close"],
                "最高": normalized["high"],
                "最低": normalized["low"],
                "成交量": normalized["vol"],
                "成交额": normalized["amount"],
                "换手率": normalized["turnover_rate"],
            }
        ).reset_index(drop=True)

    def _read_frame_cache(
        self,
        cache: dict[tuple[str, str | None, str | None], tuple[float, pd.DataFrame]],
        key: tuple[str, str | None, str | None],
    ) -> pd.DataFrame | None:
        cached = cache.get(key)
        if cached is None:
            return None
        if _now_timestamp() - cached[0] > _FRAME_CACHE_TTL_SECONDS:
            return None
        return cached[1].copy()

    def _write_frame_cache(
        self,
        cache: dict[tuple[str, str | None, str | None], tuple[float, pd.DataFrame]],
        key: tuple[str, str | None, str | None],
        frame: pd.DataFrame,
    ) -> None:
        cache[key] = (_now_timestamp(), frame.copy())

    def _normalize_requested_codes(self, stock_codes: list[str]) -> list[str]:
        normalized_codes: list[str] = []
        seen: set[str] = set()
        for stock_code in stock_codes:
            normalized_code = self._normalize_stock_code(stock_code)
            if not normalized_code or normalized_code in seen:
                continue
            seen.add(normalized_code)
            normalized_codes.append(normalized_code)
        return normalized_codes

    def _normalize_stock_code(self, raw_code: Any) -> str:
        text = str(raw_code or "").strip().upper()
        if "." in text:
            text = text.split(".", 1)[0]
        return text if len(text) == 6 and text.isdigit() else ""

    def _normalize_ymd(self, raw_date: str) -> str:
        return raw_date.replace("-", "")
