import { describe, expect, it } from "vitest";
import { MarketRegimeService } from "~/server/application/timing/market-regime-service";

describe("MarketRegimeService", () => {
  it("classifies bullish breadth and trend as RISK_ON", () => {
    const service = new MarketRegimeService();

    const result = service.analyze({
      asOfDate: "2026-03-06",
      indexes: [
        {
          code: "510300",
          name: "CSI 300 ETF",
          close: 4.1,
          changePct: 1.2,
          ema20: 4,
          ema60: 3.8,
          aboveEma20: true,
          aboveEma60: true,
          atrRatio: 0.02,
        },
        {
          code: "510500",
          name: "CSI 500 ETF",
          close: 6.2,
          changePct: 0.9,
          ema20: 6,
          ema60: 5.7,
          aboveEma20: true,
          aboveEma60: true,
          atrRatio: 0.021,
        },
      ],
      breadth: {
        totalCount: 100,
        advancingCount: 68,
        decliningCount: 24,
        flatCount: 8,
        positiveRatio: 0.68,
        medianChangePct: 1.1,
        aboveThreePctCount: 18,
        belowThreePctCount: 4,
        averageTurnoverRate: 1.3,
      },
      volatility: {
        highVolatilityCount: 8,
        highVolatilityRatio: 0.08,
        limitDownLikeCount: 0,
      },
      features: {
        benchmarkStrength: 78,
        breadthScore: 72,
        riskScore: 22,
      },
    });

    expect(result.marketRegime).toBe("RISK_ON");
    expect(result.regimeConfidence).toBeGreaterThan(60);
  });

  it("classifies weak breadth and elevated volatility as RISK_OFF", () => {
    const service = new MarketRegimeService();

    const result = service.analyze({
      asOfDate: "2026-03-06",
      indexes: [
        {
          code: "510300",
          name: "CSI 300 ETF",
          close: 3.7,
          changePct: -1.8,
          ema20: 3.9,
          ema60: 4,
          aboveEma20: false,
          aboveEma60: false,
          atrRatio: 0.04,
        },
      ],
      breadth: {
        totalCount: 100,
        advancingCount: 28,
        decliningCount: 61,
        flatCount: 11,
        positiveRatio: 0.28,
        medianChangePct: -1.5,
        aboveThreePctCount: 3,
        belowThreePctCount: 16,
        averageTurnoverRate: 1.8,
      },
      volatility: {
        highVolatilityCount: 34,
        highVolatilityRatio: 0.34,
        limitDownLikeCount: 4,
      },
      features: {
        benchmarkStrength: 32,
        breadthScore: 26,
        riskScore: 76,
      },
    });

    expect(result.marketRegime).toBe("RISK_OFF");
    expect(result.constraints.length).toBeGreaterThan(0);
  });
});
