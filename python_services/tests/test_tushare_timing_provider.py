"""TuShare timing provider unit tests."""

from __future__ import annotations

from dataclasses import dataclass

import pandas as pd
import pytest

import app.providers.timing.tushare_provider as timing_module
from app.gateway.common import GatewayError
from app.providers.timing.tushare_provider import (
    INDEX_BENCHMARK_TS_CODES,
    TushareTimingProvider,
)


@dataclass
class FakeProClient:
    stock_basic_frame: pd.DataFrame
    daily_frames: dict[str, pd.DataFrame]
    adj_factor_frames: dict[str, pd.DataFrame]
    daily_basic_frames: dict[str, pd.DataFrame]
    index_daily_frames: dict[str, pd.DataFrame]

    def stock_basic(self, **_kwargs):
        return self.stock_basic_frame.copy()

    def daily(self, **kwargs):
        return self.daily_frames.get(kwargs["ts_code"], pd.DataFrame()).copy()

    def adj_factor(self, **kwargs):
        return self.adj_factor_frames.get(kwargs["ts_code"], pd.DataFrame()).copy()

    def daily_basic(self, **kwargs):
        return self.daily_basic_frames.get(kwargs["ts_code"], pd.DataFrame()).copy()

    def index_daily(self, **kwargs):
        return self.index_daily_frames.get(kwargs["ts_code"], pd.DataFrame()).copy()


def test_tushare_timing_provider_maps_snapshot_and_qfq_bars(monkeypatch):
    fake_client = FakeProClient(
        stock_basic_frame=pd.DataFrame(
            {
                "ts_code": ["600519.SH"],
                "symbol": ["600519"],
                "name": ["Moutai"],
                "industry": ["Liquor"],
            }
        ),
        daily_frames={
            "600519.SH": pd.DataFrame(
                {
                    "trade_date": ["20250103", "20250102"],
                    "open": [102.0, 100.0],
                    "high": [104.0, 102.0],
                    "low": [101.0, 99.0],
                    "close": [103.0, 101.0],
                    "vol": [2_000.0, 1_800.0],
                    "amount": [200_000.0, 181_800.0],
                }
            )
        },
        adj_factor_frames={
            "600519.SH": pd.DataFrame(
                {
                    "trade_date": ["20250103", "20250102"],
                    "adj_factor": [2.0, 1.0],
                }
            )
        },
        daily_basic_frames={
            "600519.SH": pd.DataFrame(
                {
                    "trade_date": ["20250103", "20250102"],
                    "turnover_rate": [1.5, 1.2],
                }
            )
        },
        index_daily_frames={},
    )

    monkeypatch.setenv("TUSHARE_TOKEN", "token-1")
    monkeypatch.setattr(
        timing_module,
        "_create_tushare_client",
        lambda _token: fake_client,
    )

    provider = TushareTimingProvider()

    snapshot = provider.get_stock_snapshot("600519")
    bars = provider.get_stock_bars(
        stock_code="600519",
        start_date="20250101",
        end_date="20250103",
        adjust="qfq",
    )

    assert snapshot["name"] == "Moutai"
    assert snapshot["industry"] == "Liquor"
    assert bars["收盘"].tolist() == [50.5, 103.0]
    assert bars["换手率"].tolist() == [1.2, 1.5]


def test_tushare_timing_provider_keeps_missing_turnover_rate_as_nan(monkeypatch):
    fake_client = FakeProClient(
        stock_basic_frame=pd.DataFrame(
            {
                "ts_code": ["600519.SH"],
                "symbol": ["600519"],
                "name": ["Moutai"],
                "industry": ["Liquor"],
            }
        ),
        daily_frames={
            "600519.SH": pd.DataFrame(
                {
                    "trade_date": ["20250103"],
                    "open": [102.0],
                    "high": [104.0],
                    "low": [101.0],
                    "close": [103.0],
                    "vol": [2_000.0],
                    "amount": [200_000.0],
                }
            )
        },
        adj_factor_frames={
            "600519.SH": pd.DataFrame(
                {
                    "trade_date": ["20250103"],
                    "adj_factor": [1.0],
                }
            )
        },
        daily_basic_frames={"600519.SH": pd.DataFrame({"trade_date": [], "turnover_rate": []})},
        index_daily_frames={},
    )

    monkeypatch.setenv("TUSHARE_TOKEN", "token-1")
    monkeypatch.setattr(
        timing_module,
        "_create_tushare_client",
        lambda _token: fake_client,
    )

    provider = TushareTimingProvider()
    bars = provider.get_stock_bars(
        stock_code="600519",
        start_date="20250101",
        end_date="20250103",
        adjust="qfq",
    )

    assert pd.isna(bars.iloc[0]["换手率"])


def test_tushare_timing_provider_resolves_index_benchmarks(monkeypatch):
    fake_client = FakeProClient(
        stock_basic_frame=pd.DataFrame(
            {
                "ts_code": ["600519.SH"],
                "symbol": ["600519"],
                "name": ["Moutai"],
                "industry": ["Liquor"],
            }
        ),
        daily_frames={},
        adj_factor_frames={},
        daily_basic_frames={},
        index_daily_frames={
            INDEX_BENCHMARK_TS_CODES["510300"]: pd.DataFrame(
                {
                    "trade_date": ["20250103"],
                    "open": [4_000.0],
                    "high": [4_050.0],
                    "low": [3_980.0],
                    "close": [4_020.0],
                    "vol": [1_000_000.0],
                    "amount": [4_020_000_000.0],
                }
            )
        },
    )

    monkeypatch.setenv("TUSHARE_TOKEN", "token-1")
    monkeypatch.setattr(
        timing_module,
        "_create_tushare_client",
        lambda _token: fake_client,
    )

    provider = TushareTimingProvider()
    bars = provider.get_benchmark_bars(
        benchmark_code="510300",
        start_date="20250101",
        end_date="20250103",
    )

    assert bars.iloc[0]["股票代码"] == "510300"
    assert bars.iloc[0]["收盘"] == 4020.0


def test_tushare_timing_provider_rejects_unknown_stock_code(monkeypatch):
    fake_client = FakeProClient(
        stock_basic_frame=pd.DataFrame(
            {"ts_code": ["600519.SH"], "symbol": ["600519"], "name": ["Moutai"], "industry": ["Liquor"]}
        ),
        daily_frames={},
        adj_factor_frames={},
        daily_basic_frames={},
        index_daily_frames={},
    )

    monkeypatch.setenv("TUSHARE_TOKEN", "token-1")
    monkeypatch.setattr(
        timing_module,
        "_create_tushare_client",
        lambda _token: fake_client,
    )

    provider = TushareTimingProvider()

    with pytest.raises(GatewayError, match="Stock not found"):
        provider.get_stock_snapshot("000001")


def test_tushare_timing_provider_requires_token(monkeypatch):
    monkeypatch.delenv("TUSHARE_TOKEN", raising=False)

    with pytest.raises(RuntimeError, match="TUSHARE_TOKEN"):
        TushareTimingProvider().get_stock_snapshot("600519")
