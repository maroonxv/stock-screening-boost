import { describe, expect, it } from "vitest";
import {
  buildCatalogNotice,
  buildFormulaMetricOptions,
  groupCatalogItems,
} from "~/app/screening/screening-ui";

describe("buildCatalogNotice", () => {
  it("returns a danger notice when the catalog query fails", () => {
    expect(
      buildCatalogNotice({
        isLoading: false,
        errorMessage: "Python screening service error: 500",
        categories: [],
        items: [],
      }),
    ).toEqual({
      tone: "danger",
      description: "官方指标目录加载失败：Python screening service error: 500",
    });
  });

  it("returns an info notice when the catalog query succeeds but is empty", () => {
    expect(
      buildCatalogNotice({
        isLoading: false,
        errorMessage: null,
        categories: [],
        items: [],
      }),
    ).toEqual({
      tone: "info",
      description:
        "官方指标目录当前为空，请检查 Python 服务的指标目录接口是否正常。",
    });
  });

  it("returns null while loading or when catalog data is present", () => {
    expect(
      buildCatalogNotice({
        isLoading: true,
        errorMessage: null,
        categories: [],
        items: [],
      }),
    ).toBeNull();

    expect(
      buildCatalogNotice({
        isLoading: false,
        errorMessage: null,
        categories: [
          {
            id: "profitability",
            name: "盈利能力",
            indicatorCount: 1,
            sortOrder: 1,
          },
        ],
        items: [
          {
            id: "roe",
            name: "ROE",
            categoryId: "profitability",
            valueType: "NUMBER",
            periodScope: "series",
            retrievalMode: "statement_series",
            sortOrder: 1,
            keywords: ["roe"],
            sourceDataset: "fina_indicator",
          },
        ],
      }),
    ).toBeNull();
  });

  it("groups catalog items by category sort order and item sort order", () => {
    expect(
      groupCatalogItems({
        categories: [
          {
            id: "growth_quality",
            name: "成长质量",
            indicatorCount: 1,
            sortOrder: 3,
          },
          {
            id: "valuation_capital",
            name: "估值与股本",
            indicatorCount: 2,
            sortOrder: 1,
          },
        ],
        items: [
          {
            id: "pb",
            name: "PB",
            categoryId: "valuation_capital",
            valueType: "NUMBER",
            periodScope: "latest_only",
            retrievalMode: "latest_only",
            sortOrder: 30,
            keywords: ["pb"],
            sourceDataset: "daily_basic",
          },
          {
            id: "ps_ttm",
            name: "PS(TTM)",
            categoryId: "valuation_capital",
            valueType: "NUMBER",
            periodScope: "latest_only",
            retrievalMode: "latest_only",
            sortOrder: 20,
            keywords: ["市销率"],
            sourceDataset: "daily_basic",
          },
          {
            id: "q_sales_yoy",
            name: "单季营收同比",
            categoryId: "growth_quality",
            valueType: "PERCENT",
            periodScope: "series",
            retrievalMode: "statement_series",
            sortOrder: 10,
            keywords: ["营收同比"],
            sourceDataset: "fina_indicator",
          },
        ],
      }),
    ).toMatchObject([
      {
        id: "valuation_capital",
        items: [{ id: "ps_ttm" }, { id: "pb" }],
      },
      {
        id: "growth_quality",
        items: [{ id: "q_sales_yoy" }],
      },
    ]);
  });

  it("filters formula metric options by search term and does not cap the list to 30 items", () => {
    const items = Array.from({ length: 35 }, (_, index) => ({
      id: `metric_${index + 1}`,
      name: index === 34 ? "自由现金流" : `指标${index + 1}`,
      categoryId: "cashflow_quality",
      valueType: "NUMBER" as const,
      periodScope: "series" as const,
      retrievalMode: "statement_series" as const,
      sortOrder: index + 1,
      keywords:
        index === 34 ? ["fcf", "free cash flow"] : [`关键词${index + 1}`],
      sourceDataset: "cashflow" as const,
    }));

    expect(
      buildFormulaMetricOptions({
        items,
        query: "自由",
      }),
    ).toEqual([expect.objectContaining({ id: "metric_35" })]);
  });
});
