"""Indicator catalog loader for the screening workbench."""

from __future__ import annotations

from functools import lru_cache


CategorySpec = tuple[str, str, tuple[dict[str, object], ...]]


def _item(
    indicator_id: str,
    name: str,
    value_type: str,
    period_scope: str,
    retrieval_mode: str,
    source_dataset: str,
    keywords: tuple[str, ...],
) -> dict[str, object]:
    return {
        "id": indicator_id,
        "name": name,
        "valueType": value_type,
        "periodScope": period_scope,
        "retrievalMode": retrieval_mode,
        "sourceDataset": source_dataset,
        "keywords": list(keywords),
    }


_CATEGORY_SPECS: tuple[CategorySpec, ...] = (
    (
        "valuation_capital",
        "估值与股本",
        (
            _item(
                "pe_ttm",
                "PE(TTM)",
                "NUMBER",
                "latest_only",
                "latest_only",
                "daily_basic",
                ("pe", "市盈率", "ttm"),
            ),
            _item(
                "pb",
                "PB",
                "NUMBER",
                "latest_only",
                "latest_only",
                "daily_basic",
                ("pb", "市净率"),
            ),
            _item(
                "ps_ttm",
                "PS(TTM)",
                "NUMBER",
                "latest_only",
                "latest_only",
                "daily_basic",
                ("ps", "市销率", "市销率ttm"),
            ),
            _item(
                "market_cap",
                "总市值",
                "NUMBER",
                "latest_only",
                "latest_only",
                "daily_basic",
                ("总市值", "市值"),
            ),
            _item(
                "float_market_cap",
                "流通市值",
                "NUMBER",
                "latest_only",
                "latest_only",
                "daily_basic",
                ("流通市值", "流通盘"),
            ),
            _item(
                "total_shares",
                "总股本",
                "NUMBER",
                "latest_only",
                "latest_only",
                "daily_basic",
                ("总股本", "股本"),
            ),
            _item(
                "float_a_shares",
                "流通A股",
                "NUMBER",
                "latest_only",
                "latest_only",
                "daily_basic",
                ("流通a股", "流通股"),
            ),
            _item(
                "free_share",
                "自由流通股",
                "NUMBER",
                "latest_only",
                "latest_only",
                "daily_basic",
                ("自由流通股", "free float"),
            ),
            _item(
                "dv_ttm",
                "股息率(TTM)",
                "PERCENT",
                "latest_only",
                "latest_only",
                "daily_basic",
                ("股息率", "分红率", "ttm"),
            ),
        ),
    ),
    (
        "profit_quality",
        "盈利质量",
        (
            _item(
                "roe_report",
                "ROE(报告期)",
                "PERCENT",
                "series",
                "statement_series",
                "fina_indicator",
                ("roe", "净资产收益率"),
            ),
            _item(
                "eps_report",
                "EPS(报告期)",
                "NUMBER",
                "series",
                "statement_series",
                "fina_indicator",
                ("eps", "每股收益"),
            ),
            _item(
                "grossprofit_margin",
                "毛利率",
                "PERCENT",
                "series",
                "statement_series",
                "fina_indicator",
                ("毛利率", "gross margin"),
            ),
            _item(
                "netprofit_margin",
                "净利率",
                "PERCENT",
                "series",
                "statement_series",
                "fina_indicator",
                ("净利率", "销售净利率"),
            ),
            _item(
                "roa",
                "ROA",
                "PERCENT",
                "series",
                "statement_series",
                "fina_indicator",
                ("roa", "总资产收益率"),
            ),
            _item(
                "roic",
                "ROIC",
                "PERCENT",
                "series",
                "statement_series",
                "fina_indicator",
                ("roic", "投入资本回报率"),
            ),
            _item(
                "bps",
                "每股净资产",
                "NUMBER",
                "series",
                "statement_series",
                "fina_indicator",
                ("bps", "book value per share"),
            ),
        ),
    ),
    (
        "growth_quality",
        "成长质量",
        (
            _item(
                "revenue",
                "营业收入",
                "NUMBER",
                "series",
                "statement_series",
                "income",
                ("营收", "收入", "revenue"),
            ),
            _item(
                "net_profit_parent",
                "归母净利润",
                "NUMBER",
                "series",
                "statement_series",
                "income",
                ("归母净利润", "净利润", "profit"),
            ),
            _item(
                "q_sales_yoy",
                "单季营收同比",
                "PERCENT",
                "series",
                "statement_series",
                "fina_indicator",
                ("营收同比", "单季营收同比"),
            ),
            _item(
                "q_netprofit_yoy",
                "单季净利同比",
                "PERCENT",
                "series",
                "statement_series",
                "fina_indicator",
                ("净利同比", "单季净利同比"),
            ),
            _item(
                "dt_netprofit_yoy",
                "扣非净利同比",
                "PERCENT",
                "series",
                "statement_series",
                "fina_indicator",
                ("扣非净利同比", "扣非"),
            ),
        ),
    ),
    (
        "solvency",
        "偿债能力",
        (
            _item(
                "asset_liability_ratio",
                "资产负债率",
                "PERCENT",
                "series",
                "statement_series",
                "derived",
                ("资产负债率", "负债率"),
            ),
            _item(
                "current_ratio",
                "流动比率",
                "NUMBER",
                "series",
                "statement_series",
                "fina_indicator",
                ("流动比率", "current ratio"),
            ),
            _item(
                "quick_ratio",
                "速动比率",
                "NUMBER",
                "series",
                "statement_series",
                "fina_indicator",
                ("速动比率", "quick ratio"),
            ),
            _item(
                "cash_ratio",
                "现金比率",
                "NUMBER",
                "series",
                "statement_series",
                "fina_indicator",
                ("现金比率", "cash ratio"),
            ),
        ),
    ),
    (
        "cashflow_quality",
        "现金流质量",
        (
            _item(
                "ocfps",
                "每股经营现金流",
                "NUMBER",
                "series",
                "statement_series",
                "fina_indicator",
                ("ocfps", "经营现金流", "每股经营现金流"),
            ),
            _item(
                "cfps",
                "每股现金流",
                "NUMBER",
                "series",
                "statement_series",
                "fina_indicator",
                ("cfps", "每股现金流"),
            ),
            _item(
                "n_cashflow_act",
                "经营现金流净额",
                "NUMBER",
                "series",
                "statement_series",
                "cashflow",
                ("经营现金流净额", "经营现金流"),
            ),
            _item(
                "free_cashflow",
                "自由现金流",
                "NUMBER",
                "series",
                "statement_series",
                "cashflow",
                ("自由现金流", "fcf", "free cash flow"),
            ),
        ),
    ),
    (
        "operating_efficiency",
        "运营效率",
        (
            _item(
                "assets_turn",
                "总资产周转率",
                "NUMBER",
                "series",
                "statement_series",
                "fina_indicator",
                ("总资产周转率", "资产周转率"),
            ),
            _item(
                "ar_turn",
                "应收账款周转率",
                "NUMBER",
                "series",
                "statement_series",
                "fina_indicator",
                ("应收账款周转率", "应收周转"),
            ),
            _item(
                "inv_turn",
                "存货周转率",
                "NUMBER",
                "series",
                "statement_series",
                "fina_indicator",
                ("存货周转率", "存货周转"),
            ),
        ),
    ),
)


@lru_cache(maxsize=1)
def load_indicator_catalog() -> dict[str, list[dict[str, object]]]:
    categories: list[dict[str, object]] = []
    items: list[dict[str, object]] = []

    for category_index, (category_id, category_name, category_items) in enumerate(
        _CATEGORY_SPECS,
        start=1,
    ):
        categories.append(
            {
                "id": category_id,
                "name": category_name,
                "description": category_name,
                "indicatorCount": len(category_items),
                "sortOrder": category_index * 10,
            }
        )

        for item_index, item in enumerate(category_items, start=1):
            items.append(
                {
                    **item,
                    "categoryId": category_id,
                    "description": category_name,
                    "sortOrder": category_index * 100 + item_index,
                }
            )

    return {"categories": categories, "items": items}
