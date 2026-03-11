import { describe, expect, it, vi } from "vitest";
import { TimingReviewSchedulingService } from "~/server/application/timing/timing-review-scheduling-service";
import type {
  TimingAnalysisCardRecord,
  TimingRecommendationRecord,
  TimingReviewRecord,
} from "~/server/domain/timing/types";

function createReviewRecord(
  overrides?: Partial<TimingReviewRecord>,
): TimingReviewRecord {
  return {
    id: "review-1",
    userId: "user-1",
    analysisCardId: "card-1",
    recommendationId: null,
    stockCode: "600519",
    stockName: "贵州茅台",
    sourceAsOfDate: "2026-03-08",
    reviewHorizon: "T5",
    scheduledAt: new Date("2026-03-15T00:00:00.000Z"),
    completedAt: null,
    expectedAction: "ADD",
    actualReturnPct: null,
    maxFavorableExcursionPct: null,
    maxAdverseExcursionPct: null,
    verdict: null,
    reviewSummary: null,
    createdAt: new Date("2026-03-08T00:00:00.000Z"),
    updatedAt: new Date("2026-03-08T00:00:00.000Z"),
    ...overrides,
  };
}

function createCard(
  overrides?: Partial<TimingAnalysisCardRecord>,
): TimingAnalysisCardRecord {
  return {
    id: "card-1",
    userId: "user-1",
    workflowRunId: "run-1",
    watchListId: null,
    presetId: "preset-1",
    stockCode: "600519",
    stockName: "贵州茅台",
    sourceType: "screening",
    sourceId: "session-1",
    signalSnapshotId: "snapshot-1",
    actionBias: "ADD",
    confidence: 82,
    marketRegime: null,
    summary: "summary",
    triggerNotes: [],
    invalidationNotes: [],
    riskFlags: [],
    reasoning: {
      direction: "bullish",
      signalStrength: 80,
      confidence: 82,
      factorBreakdown: [],
      explanation: "趋势向上",
      actionRationale: "适合加仓",
      indicators: {
        close: 100,
        macd: { dif: 1, dea: 0.5, histogram: 0.5 },
        rsi: { value: 60 },
        bollinger: {
          upper: 110,
          middle: 100,
          lower: 90,
          closePosition: 0.6,
        },
        obv: { value: 1000, slope: 1 },
        ema20: 98,
        ema60: 95,
        atr14: 3,
        volumeRatio20: 1.2,
      },
      ruleSummary: {
        direction: "bullish",
        signalStrength: 80,
        warnings: [],
      },
    },
    createdAt: new Date("2026-03-08T00:00:00.000Z"),
    updatedAt: new Date("2026-03-08T00:00:00.000Z"),
    signalSnapshot: {
      id: "snapshot-1",
      userId: "user-1",
      workflowRunId: "run-1",
      stockCode: "600519",
      stockName: "贵州茅台",
      asOfDate: "2026-03-08",
      sourceType: "screening",
      sourceId: "session-1",
      timeframe: "DAILY",
      barsCount: 120,
      indicators: {
        close: 100,
        macd: { dif: 1, dea: 0.5, histogram: 0.5 },
        rsi: { value: 60 },
        bollinger: {
          upper: 110,
          middle: 100,
          lower: 90,
          closePosition: 0.6,
        },
        obv: { value: 1000, slope: 1 },
        ema20: 98,
        ema60: 95,
        atr14: 3,
        volumeRatio20: 1.2,
      },
      signalSummary: {
        direction: "bullish",
        signalStrength: 80,
        warnings: [],
      },
      createdAt: new Date("2026-03-08T00:00:00.000Z"),
    },
    ...overrides,
  };
}

function createRecommendation(
  overrides?: Partial<TimingRecommendationRecord>,
): TimingRecommendationRecord {
  return {
    id: "rec-1",
    userId: "user-1",
    workflowRunId: "run-1",
    portfolioSnapshotId: "portfolio-1",
    watchListId: "watchlist-1",
    presetId: "preset-1",
    stockCode: "600519",
    stockName: "贵州茅台",
    action: "ADD",
    priority: 1,
    confidence: 82,
    suggestedMinPct: 2,
    suggestedMaxPct: 5,
    riskBudgetPct: 6,
    marketRegime: "RISK_ON",
    riskFlags: [],
    reasoning: {
      timingSummary: "summary",
      actionRationale: "适合加仓",
      marketRegimeSummary: "risk on",
      regimeConstraints: [],
      riskPlan: {
        portfolioRiskBudgetPct: 20,
        maxSingleNamePct: 10,
        defaultProbePct: 2,
        blockedActions: [],
        correlationWarnings: [],
        notes: [],
      },
      positionContext: {
        held: false,
        currentWeightPct: 0,
        targetDeltaPct: 3,
        availableCashPct: 40,
      },
      factorBreakdown: [],
      triggerNotes: [],
      invalidationNotes: [],
    },
    createdAt: new Date("2026-03-08T00:00:00.000Z"),
    updatedAt: new Date("2026-03-08T00:00:00.000Z"),
    ...overrides,
  };
}

describe("TimingReviewSchedulingService", () => {
  it("schedules review records and reminders for timing cards", async () => {
    const createdRecords = [
      createReviewRecord({ id: "review-t5", reviewHorizon: "T5" }),
      createReviewRecord({
        id: "review-t20",
        reviewHorizon: "T20",
        scheduledAt: new Date("2026-04-05T00:00:00.000Z"),
      }),
    ];

    const reviewRecordRepository = {
      createMany: vi.fn().mockResolvedValue(createdRecords),
    };
    const reminderSchedulingService = {
      scheduleTimingReviewReminder: vi
        .fn()
        .mockImplementation(async (record: TimingReviewRecord) => ({
          id: `reminder-${record.id}`,
        })),
    };

    const service = new TimingReviewSchedulingService({
      reviewRecordRepository: reviewRecordRepository as never,
      reminderSchedulingService: reminderSchedulingService as never,
    });

    const result = await service.scheduleForCards({
      cards: [createCard()],
      presetConfig: {
        reviewSchedule: {
          horizons: ["T5", "T20"],
        },
      },
    });

    expect(reviewRecordRepository.createMany).toHaveBeenCalledTimes(1);
    expect(reviewRecordRepository.createMany).toHaveBeenCalledWith({
      items: [
        expect.objectContaining({
          analysisCardId: "card-1",
          stockCode: "600519",
          reviewHorizon: "T5",
          scheduledAt: new Date("2026-03-15T00:00:00.000Z"),
        }),
        expect.objectContaining({
          analysisCardId: "card-1",
          stockCode: "600519",
          reviewHorizon: "T20",
          scheduledAt: new Date("2026-04-05T00:00:00.000Z"),
        }),
      ],
    });
    expect(
      reminderSchedulingService.scheduleTimingReviewReminder,
    ).toHaveBeenCalledTimes(2);
    expect(result.records).toEqual(createdRecords);
    expect(result.reminderIds).toEqual([
      "reminder-review-t5",
      "reminder-review-t20",
    ]);
  });

  it("schedules review records from recommendations using source date map", async () => {
    const createdRecords = [
      createReviewRecord({
        id: "review-rec",
        analysisCardId: null,
        recommendationId: "rec-1",
        reviewHorizon: "T10",
        scheduledAt: new Date("2026-03-22T00:00:00.000Z"),
      }),
    ];

    const reviewRecordRepository = {
      createMany: vi.fn().mockResolvedValue(createdRecords),
    };
    const reminderSchedulingService = {
      scheduleTimingReviewReminder: vi
        .fn()
        .mockResolvedValue({ id: "reminder-review-rec" }),
    };

    const service = new TimingReviewSchedulingService({
      reviewRecordRepository: reviewRecordRepository as never,
      reminderSchedulingService: reminderSchedulingService as never,
    });

    const result = await service.scheduleForRecommendations({
      recommendations: [createRecommendation()],
      sourceAsOfDateByStockCode: new Map([["600519", "2026-03-08"]]),
      presetConfig: {
        reviewSchedule: {
          horizons: ["T10"],
        },
      },
    });

    expect(reviewRecordRepository.createMany).toHaveBeenCalledWith({
      items: [
        expect.objectContaining({
          recommendationId: "rec-1",
          stockCode: "600519",
          sourceAsOfDate: "2026-03-08",
          reviewHorizon: "T10",
          scheduledAt: new Date("2026-03-22T00:00:00.000Z"),
        }),
      ],
    });
    expect(result.records).toEqual(createdRecords);
    expect(result.reminderIds).toEqual(["reminder-review-rec"]);
  });
});
