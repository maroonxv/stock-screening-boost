import { describe, expect, it } from "vitest";
import { WatchlistRiskManagerService } from "~/server/application/timing/watchlist-risk-manager-service";

describe("WatchlistRiskManagerService", () => {
  it("shrinks budget and blocks ADD in risk-off regime", () => {
    const service = new WatchlistRiskManagerService();

    const result = service.buildRiskPlan({
      portfolioSnapshot: {
        id: "ps_1",
        userId: "u_1",
        name: "Core",
        baseCurrency: "CNY",
        cash: 80_000,
        totalCapital: 100_000,
        positions: [
          {
            stockCode: "600519",
            stockName: "茅台",
            quantity: 100,
            costBasis: 1500,
            currentWeightPct: 18,
            sector: "白酒",
            themes: ["消费"],
          },
        ],
        riskPreferences: {
          maxSingleNamePct: 15,
          maxThemeExposurePct: 20,
          defaultProbePct: 4,
          maxPortfolioRiskBudgetPct: 24,
        },
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      timingCards: [],
      marketRegimeAnalysis: {
        marketRegime: "RISK_OFF",
        regimeConfidence: 78,
        summary: "weak breadth",
        constraints: ["stay defensive"],
        snapshot: {
          asOfDate: "2026-03-06",
          indexes: [],
          breadth: {
            totalCount: 0,
            advancingCount: 0,
            decliningCount: 0,
            flatCount: 0,
            positiveRatio: 0,
            medianChangePct: 0,
            aboveThreePctCount: 0,
            belowThreePctCount: 0,
            averageTurnoverRate: null,
          },
          volatility: {
            highVolatilityCount: 0,
            highVolatilityRatio: 0,
            limitDownLikeCount: 0,
          },
          features: {
            benchmarkStrength: 25,
            breadthScore: 20,
            riskScore: 80,
          },
        },
      },
    });

    expect(result.blockedActions).toContain("ADD");
    expect(result.maxSingleNamePct).toBeLessThan(15);
    expect(result.correlationWarnings.length).toBeGreaterThan(0);
  });
});
