import { describe, expect, it } from "vitest";
import { TimingConfidencePolicy } from "~/server/domain/timing/services/timing-confidence-policy";

describe("TimingConfidencePolicy", () => {
  it("gives higher confidence to aligned bullish factors", () => {
    const policy = new TimingConfidencePolicy();

    const confidence = policy.calculate({
      direction: "bullish",
      signalStrength: 78,
      factorBreakdown: [
        {
          key: "trend",
          label: "趋势",
          status: "positive",
          score: 18,
          detail: "ok",
        },
        {
          key: "macd",
          label: "动量",
          status: "positive",
          score: 16,
          detail: "ok",
        },
        {
          key: "volume",
          label: "量能",
          status: "positive",
          score: 12,
          detail: "ok",
        },
        {
          key: "volatility",
          label: "波动",
          status: "neutral",
          score: 0,
          detail: "ok",
        },
      ],
      riskFlags: [],
    });

    expect(confidence).toBeGreaterThanOrEqual(68);
  });

  it("penalizes multiple risk flags", () => {
    const policy = new TimingConfidencePolicy();

    const base = policy.calculate({
      direction: "bullish",
      signalStrength: 72,
      factorBreakdown: [
        {
          key: "trend",
          label: "趋势",
          status: "positive",
          score: 18,
          detail: "ok",
        },
        {
          key: "macd",
          label: "动量",
          status: "positive",
          score: 16,
          detail: "ok",
        },
      ],
      riskFlags: [],
    });
    const penalized = policy.calculate({
      direction: "bullish",
      signalStrength: 72,
      factorBreakdown: [
        {
          key: "trend",
          label: "趋势",
          status: "positive",
          score: 18,
          detail: "ok",
        },
        {
          key: "macd",
          label: "动量",
          status: "positive",
          score: 16,
          detail: "ok",
        },
      ],
      riskFlags: ["HIGH_VOLATILITY", "TREND_WEAKENING"],
    });

    expect(penalized).toBeLessThan(base);
  });
});
