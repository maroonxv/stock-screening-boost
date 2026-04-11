"""Provider protocol for timing signal data."""

from __future__ import annotations

from typing import Any, Protocol

import pandas as pd


class TimingSignalDataProvider(Protocol):
    """Minimal contract required by timing stock bars and signal routes."""

    provider_name: str

    def get_stock_snapshot(self, stock_code: str) -> dict[str, Any]:
        """Return a single stock metadata snapshot."""

    def get_stock_snapshots(self, stock_codes: list[str]) -> dict[str, dict[str, Any]]:
        """Return stock metadata snapshots keyed by stock code."""

    def get_stock_bars(
        self,
        stock_code: str,
        start_date: str | None,
        end_date: str | None,
        adjust: str,
    ) -> pd.DataFrame:
        """Return stock bars compatible with timing indicator normalization."""

    def get_benchmark_bars(
        self,
        benchmark_code: str,
        start_date: str | None,
        end_date: str | None,
    ) -> pd.DataFrame:
        """Return benchmark bars for relative-strength calculations."""
