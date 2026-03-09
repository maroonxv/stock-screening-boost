import { describe, expect, it } from "vitest";
import { WatchlistPortfolioManagerService } from "~/server/application/timing/watchlist-portfolio-manager-service";
import type { TimingCardDraft } from "~/server/domain/timing/types";

const sampleCard = (overrides?: Partial<TimingCardDraft>): TimingCardDraft => ({
  userId: "u_1",
  workflowRunId: "run_1",
  watchListId: "wl_1",
  stockCode: "600519",
  stockName: "茅台",
  sourceType: "watchlist",
  sourceId: "wl_1",
  actionBias: "ADD",
  confidence: 82,
  marketRegime: "RISK_ON",
  summary: "Bullish setup",
  triggerNotes: ["trend aligned"],
  invalidationNotes: ["lose ema20"],
  riskFlags: [],
  reasoning: {
    direction: "bullish",
    signalStrength: 80,
    confidence: 82,
    factorBreakdown: [],
    explanation: "trend and momentum aligned",
    actionRationale: "signals support adding",
    indicators: {
      close: 10,
      macd: { dif: 1, dea: 0.5, histogram: 0.5 },
      rsi: { value: 62 },
      bollinger: {
        upper: 10.8,
        middle: 10.2,
        lower: 9.6,
        closePosition: 0.7,
      },
      obv: { value: 10, slope: 1 },
      ema20: 9.8,
      ema60: 9.3,
      atr14: 0.3,
      volumeRatio20: 1.2,
    },
    ruleSummary: {
      direction: "bullish",
      signalStrength: 80,
      warnings: [],
    },
  },
  ...overrides,
});

describe("WatchlistPortfolioManagerService", () => {
  it("downgrades aggressive adds when risk budget is exhausted", () => {
    const service = new WatchlistPortfolioManagerService();

    const result = service.buildRecommendations({
      userId: "u_1",
      workflowRunId: "run_1",
      watchListId: "wl_1",
      portfolioSnapshot: {
        id: "ps_1",
        userId: "u_1",
        name: "Core",
        baseCurrency: "CNY",
        cash: 2_000,
        totalCapital: 100_000,
        positions: [],
        riskPreferences: {
          maxSingleNamePct: 12,
          maxThemeExposurePct: 25,
          defaultProbePct: 3,
          maxPortfolioRiskBudgetPct: 3,
        },
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      timingCards: [
        sampleCard({ stockCode: "600519", stockName: "茅台" }),
        sampleCard({ stockCode: "000858", stockName: "五粮液" }),
      ],
      riskPlan: {
        portfolioRiskBudgetPct: 2,
        maxSingleNamePct: 8,
        defaultProbePct: 2,
        blockedActions: [],
        correlationWarnings: [],
        notes: [],
      },
      marketRegimeAnalysis: {
        marketRegime: "NEUTRAL",
        regimeConfidence: 58,
        summary: "mixed market",
        constraints: [],
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
            benchmarkStrength: 55,
            breadthScore: 50,
            riskScore: 48,
          },
        },
      },
    });

    expect(result).toHaveLength(2);
    expect(result[0]?.suggestedMaxPct).toBeLessThanOrEqual(2);
    expect(result[1]?.action).toBe("WATCH");
  });
});
