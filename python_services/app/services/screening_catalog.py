"""Indicator catalog loader for the screening workbench."""

from __future__ import annotations

from functools import lru_cache
import importlib.util
from pathlib import Path


LATEST_ONLY_KEYWORDS = ("估值", "资金流向")


def _infer_value_type(name: str) -> str:
    if "率" in name or "占比" in name or "比率" in name or "周转" in name:
        return "PERCENT"
    if "价" in name or "市值" in name or "收入" in name or "利润" in name:
        return "NUMBER"
    return "NUMBER"


def _infer_retrieval_mode(category_name: str) -> tuple[str, str]:
    if any(keyword in category_name for keyword in LATEST_ONLY_KEYWORDS):
        return ("latest_only", "latest_only")
    return ("statement_series", "series")


@lru_cache(maxsize=1)
def load_indicator_catalog() -> dict[str, list[dict[str, object]]]:
    project_root = Path(__file__).resolve().parents[2]
    mapping_path = (
        project_root
        / "temp"
        / "-v3"
        / "backend"
        / "app"
        / "utils"
        / "indicators_mapping.py"
    )

    spec = importlib.util.spec_from_file_location(
        "temp_v3_indicators_mapping",
        mapping_path,
    )
    if spec is None or spec.loader is None:
        raise RuntimeError(f"Unable to load temp-v3 indicator mapping: {mapping_path}")

    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    raw_categories = getattr(module, "FINANCIAL_STATEMENT_CATEGORIES", {})

    categories: list[dict[str, object]] = []
    items: list[dict[str, object]] = []
    for category_name, payload in raw_categories.items():
        category_id = str(category_name)
        indicators = payload.get("indicators", {})
        categories.append(
            {
                "id": category_id,
                "name": payload.get("name", category_name),
                "indicatorCount": len(indicators),
            }
        )
        retrieval_mode, period_scope = _infer_retrieval_mode(category_id)
        for indicator_name, provider_field in indicators.items():
            items.append(
                {
                    "id": str(provider_field),
                    "name": str(indicator_name),
                    "categoryId": category_id,
                    "providerField": str(provider_field),
                    "valueType": _infer_value_type(str(indicator_name)),
                    "periodScope": period_scope,
                    "retrievalMode": retrieval_mode,
                    "description": str(category_name),
                }
            )

    return {"categories": categories, "items": items}
