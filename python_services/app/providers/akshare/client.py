"""Provider client backed by existing AkShare adapters."""

from __future__ import annotations

from app.gateway.common import GatewayError
from app.services.akshare_adapter import AkShareAdapter
from app.services.intelligence_data_adapter import IntelligenceDataAdapter


class AkShareProviderClient:
    provider_name = "akshare"

    def get_stock_snapshot(self, stock_code: str) -> dict:
        items = AkShareAdapter.get_stocks_by_codes([stock_code])
        if not items:
            raise GatewayError(
                code="stock_not_found",
                message=f"未找到股票 {stock_code}",
                status_code=404,
                provider=self.provider_name,
            )

        return items[0]

    def get_stock_batch(self, stock_codes: list[str]) -> list[dict]:
        return AkShareAdapter.get_stocks_by_codes(stock_codes)

    def get_theme_candidates(self, theme: str, limit: int) -> list[dict]:
        return IntelligenceDataAdapter.get_candidates(theme=theme, limit=limit)

    def get_theme_news(self, theme: str, days: int, limit: int) -> list[dict]:
        return IntelligenceDataAdapter.get_theme_news(theme=theme, days=days, limit=limit)

    def get_theme_concepts(self, theme: str, limit: int) -> dict:
        return IntelligenceDataAdapter.match_theme_concepts(theme=theme, limit=limit)

    def get_stock_evidence(self, stock_code: str, concept: str | None) -> dict:
        return IntelligenceDataAdapter.get_company_evidence(
            stock_code=stock_code,
            concept=concept,
        )

