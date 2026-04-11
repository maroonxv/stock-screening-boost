"""Timing gateway unit tests."""

from __future__ import annotations

import pandas as pd

from app.gateway.timing_gateway import SIGNAL_BENCHMARK_CODES, TimingGateway


def _sample_history(stock_code: str) -> pd.DataFrame:
    dates = pd.date_range("2025-01-02", periods=280, freq="B")
    rows: list[dict[str, object]] = []
    for index, trade_date in enumerate(dates):
        close = 10 + index * 0.05
        rows.append(
            {
                "日期": trade_date.strftime("%Y-%m-%d"),
                "股票代码": stock_code,
                "开盘": close - 0.02,
                "收盘": close,
                "最高": close + 0.08,
                "最低": close - 0.08,
                "成交量": 900_000 + index * 5_000,
                "成交额": (900_000 + index * 5_000) * close,
                "换手率": 1.1,
            }
        )
    return pd.DataFrame(rows)


class FakeSignalProvider:
    provider_name = "tushare"

    def __init__(self) -> None:
        self.snapshot_batch_calls: list[list[str]] = []
        self.snapshot_calls: list[str] = []
        self.stock_bar_calls: list[str] = []
        self.benchmark_bar_calls: list[str] = []

    def get_stock_snapshots(self, stock_codes: list[str]):
        self.snapshot_batch_calls.append(list(stock_codes))
        return {
            stock_code: {"code": stock_code, "name": f"Stock-{stock_code}"}
            for stock_code in stock_codes
        }

    def get_stock_snapshot(self, stock_code: str):
        self.snapshot_calls.append(stock_code)
        return {"code": stock_code, "name": f"Stock-{stock_code}"}

    def get_stock_bars(
        self,
        stock_code: str,
        start_date: str | None,
        end_date: str | None,
        adjust: str,
    ):
        del start_date, end_date, adjust
        self.stock_bar_calls.append(stock_code)
        return _sample_history(stock_code)

    def get_benchmark_bars(
        self,
        benchmark_code: str,
        start_date: str | None,
        end_date: str | None,
    ):
        del start_date, end_date
        self.benchmark_bar_calls.append(benchmark_code)
        return _sample_history(benchmark_code)


class FakeMarketContextProvider:
    provider_name = "akshare"

    def get_stock_universe(self):
        return []

    def get_stock_snapshot(self, stock_code: str):
        return {"code": stock_code, "name": stock_code}

    def get_stock_bars(
        self,
        stock_code: str,
        start_date: str | None,
        end_date: str | None,
        adjust: str,
    ):
        del start_date, end_date, adjust
        return _sample_history(stock_code)


def test_get_signal_batch_reuses_batch_metadata_and_benchmark_histories() -> None:
    signal_provider = FakeSignalProvider()
    gateway = TimingGateway(
        signal_data_provider=signal_provider,
        market_context_provider=FakeMarketContextProvider(),
    )

    response = gateway.get_signal_batch(
        request_id="req-1",
        stock_codes=["600519", "000001"],
        as_of_date="2025-12-31",
        lookback_days=None,
    )

    assert [item.stockCode for item in response.data.items] == ["600519", "000001"]
    assert signal_provider.snapshot_batch_calls == [["600519", "000001"]]
    assert signal_provider.snapshot_calls == []
    assert signal_provider.stock_bar_calls == ["600519", "000001"]
    assert signal_provider.benchmark_bar_calls == list(SIGNAL_BENCHMARK_CODES)
