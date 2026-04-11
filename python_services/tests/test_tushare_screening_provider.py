from __future__ import annotations

from dataclasses import dataclass

import pandas as pd
import pytest

from app.providers.screening.tushare_provider import TushareScreeningProvider
import app.providers.screening.tushare_provider as tushare_module


@dataclass
class FakeProClient:
    stock_basic_frame: pd.DataFrame
    daily_basic_frames: dict[str, pd.DataFrame]
    fina_indicator_frames: dict[str, pd.DataFrame]
    income_frames: dict[str, pd.DataFrame]
    balancesheet_frames: dict[str, pd.DataFrame]
    cashflow_frames: dict[str, pd.DataFrame]

    def stock_basic(self, **_kwargs):
        return self.stock_basic_frame.copy()

    def daily_basic(self, **kwargs):
        trade_date = kwargs["trade_date"]
        return self.daily_basic_frames.get(trade_date, pd.DataFrame()).copy()

    def fina_indicator(self, **kwargs):
        return self.fina_indicator_frames[kwargs["ts_code"]].copy()

    def income(self, **kwargs):
        return self.income_frames[kwargs["ts_code"]].copy()

    def balancesheet(self, **kwargs):
        return self.balancesheet_frames[kwargs["ts_code"]].copy()

    def cashflow(self, **kwargs):
        return self.cashflow_frames[kwargs["ts_code"]].copy()


def test_tushare_provider_maps_universe_latest_metrics_and_history(monkeypatch):
    fake_client = FakeProClient(
        stock_basic_frame=pd.DataFrame(
            {
                "ts_code": ["600519.SH", "300750.SZ", "430001.BJ"],
                "symbol": ["600519", "300750", "430001"],
                "name": ["贵州茅台", "宁德时代", "北交样本"],
                "industry": ["白酒", "电池", "专精特新"],
            }
        ),
        daily_basic_frames={
            "20260408": pd.DataFrame(),
            "20260407": pd.DataFrame(
                {
                    "ts_code": ["600519.SH", "300750.SZ", "430001.BJ"],
                    "pe_ttm": [25.0, 18.0, 30.0],
                    "pb": [8.0, 4.0, 2.0],
                    "ps_ttm": [10.0, 5.0, 2.0],
                    "dv_ttm": [3.2, 1.5, 0.8],
                    "total_mv": [210_380_000.0, 800_000.0, 100_000.0],
                    "circ_mv": [205_000_000.0, 700_000.0, 80_000.0],
                    "total_share": [125_600.0, 1_000.0, 500.0],
                    "float_share": [122_500.0, 900.0, 400.0],
                    "free_share": [120_000.0, 850.0, 380.0],
                }
            ),
        },
        fina_indicator_frames={
            "600519.SH": pd.DataFrame(
                {
                    "end_date": ["20241231", "20231231"],
                    "roe": [21.5, 19.0],
                    "eps": [50.3, 46.0],
                    "grossprofit_margin": [91.2, 90.5],
                    "netprofit_margin": [52.1, 49.4],
                    "roa": [17.8, 16.2],
                    "roic": [25.4, 24.1],
                    "bps": [189.5, 172.4],
                    "current_ratio": [4.6, 4.2],
                    "quick_ratio": [3.8, 3.4],
                    "cash_ratio": [2.1, 1.9],
                    "q_sales_yoy": [15.0, 13.0],
                    "q_netprofit_yoy": [18.0, 16.0],
                    "dt_netprofit_yoy": [14.0, 11.0],
                    "assets_turn": [0.62, 0.58],
                    "ar_turn": [145.0, 138.0],
                    "inv_turn": [0.17, 0.15],
                    "ocfps": [42.6, 39.5],
                    "cfps": [38.4, 35.2],
                }
            )
        },
        income_frames={
            "600519.SH": pd.DataFrame(
                {
                    "end_date": ["20241231", "20231231"],
                    "total_revenue": [174_144_000_000.0, 150_560_000_000.0],
                    "n_income_attr_p": [86_228_000_000.0, 74_734_000_000.0],
                }
            )
        },
        balancesheet_frames={
            "600519.SH": pd.DataFrame(
                {
                    "end_date": ["20241231", "20231231"],
                    "total_assets": [300_000_000_000.0, 280_000_000_000.0],
                    "total_liab": [75_000_000_000.0, 70_000_000_000.0],
                }
            )
        },
        cashflow_frames={
            "600519.SH": pd.DataFrame(
                {
                    "end_date": ["20241231", "20231231"],
                    "n_cashflow_act": [92_360_000_000.0, 84_520_000_000.0],
                    "free_cashflow": [51_200_000_000.0, 45_800_000_000.0],
                }
            )
        },
    )

    monkeypatch.setenv("TUSHARE_TOKEN", "token-1")
    monkeypatch.setattr(tushare_module, "_create_tushare_client", lambda _token: fake_client)
    monkeypatch.setattr(
        tushare_module.TushareScreeningProvider,
        "_today_trade_dates",
        lambda self: ["20260408", "20260407"],
    )

    provider = TushareScreeningProvider()

    assert provider.get_all_stock_codes() == ["600519", "300750", "430001"]

    batch = provider.get_stock_batch(["600519", "430001"])
    assert batch[0]["name"] == "贵州茅台"
    assert batch[0]["industry"] == "白酒"
    assert batch[0]["sector"] == "主板"
    assert batch[0]["pe"] == 25.0
    assert batch[0]["marketCap"] == pytest.approx(21038.0)
    assert batch[0]["floatMarketCap"] == pytest.approx(20500.0)
    assert batch[0]["totalShares"] == 1_256_000_000.0
    assert batch[0]["floatAShares"] == 1_225_000_000.0
    assert batch[0]["roe"] == pytest.approx(0.215)
    assert batch[0]["eps"] == 50.3
    assert batch[0]["revenue"] == pytest.approx(1741.44)
    assert batch[0]["netProfit"] == pytest.approx(862.28)
    assert batch[0]["debtRatio"] == pytest.approx(0.25)
    assert batch[1]["sector"] == "北交所"

    latest = provider.query_latest_metrics(
        ["600519"],
        ["pe_ttm", "ps_ttm", "dv_ttm", "market_cap", "total_shares", "free_share"],
    )
    assert latest == {
        "600519": {
            "pe_ttm": 25.0,
            "ps_ttm": 10.0,
            "dv_ttm": pytest.approx(0.032),
            "market_cap": pytest.approx(21038.0),
            "total_shares": 1_256_000_000.0,
            "free_share": 1_200_000_000.0,
        }
    }

    series = provider.query_series_metrics(
        ["600519"],
        [
            "roe_report",
            "grossprofit_margin",
            "current_ratio",
            "ocfps",
            "n_cashflow_act",
            "free_cashflow",
            "asset_liability_ratio",
        ],
        ["2023", "2024"],
    )
    assert series["600519"]["roe_report"] == {"2023": pytest.approx(0.19), "2024": pytest.approx(0.215)}
    assert series["600519"]["grossprofit_margin"] == {
        "2023": pytest.approx(0.905),
        "2024": pytest.approx(0.912),
    }
    assert series["600519"]["current_ratio"] == {
        "2023": pytest.approx(4.2),
        "2024": pytest.approx(4.6),
    }
    assert series["600519"]["ocfps"] == {"2023": pytest.approx(39.5), "2024": pytest.approx(42.6)}
    assert series["600519"]["n_cashflow_act"] == {
        "2023": pytest.approx(845.2),
        "2024": pytest.approx(923.6),
    }
    assert series["600519"]["free_cashflow"] == {
        "2023": pytest.approx(458.0),
        "2024": pytest.approx(512.0),
    }
    assert series["600519"]["asset_liability_ratio"] == {
        "2023": pytest.approx(0.25),
        "2024": pytest.approx(0.25),
    }


def test_tushare_provider_requires_token(monkeypatch):
    monkeypatch.delenv("TUSHARE_TOKEN", raising=False)

    with pytest.raises(RuntimeError, match="TUSHARE_TOKEN"):
        TushareScreeningProvider().get_all_stock_codes()
