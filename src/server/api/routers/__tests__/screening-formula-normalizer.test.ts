import { describe, expect, it } from "vitest";
import { normalizeFormulaExpression } from "~/server/api/routers/screening-formula-normalizer";

describe("normalizeFormulaExpression", () => {
  const catalogItems = [
    {
      id: "roe_ttm",
      name: "ROE(TTM)",
      categoryId: "profitability",
      valueType: "PERCENT",
      periodScope: "latest_only",
      retrievalMode: "latest_only",
    },
    {
      id: "eps_ttm",
      name: "EPS(TTM)",
      categoryId: "profitability",
      valueType: "NUMBER",
      periodScope: "latest_only",
      retrievalMode: "latest_only",
    },
  ] as const;

  it("converts selected metric placeholders to safe var indexes", () => {
    expect(
      normalizeFormulaExpression({
        expression: "[ROE(TTM)] + [EPS(TTM)]",
        targetIndicatorIds: ["roe_ttm", "eps_ttm"],
        catalogItems,
      }),
    ).toBe("var[0] + var[1]");
  });

  it("rejects placeholders that are not part of selected target indicators", () => {
    expect(() =>
      normalizeFormulaExpression({
        expression: "[ROE(TTM)] + [PB(TTM)]",
        targetIndicatorIds: ["roe_ttm", "eps_ttm"],
        catalogItems,
      }),
    ).toThrow(/PB\(TTM\)/);
  });
});
