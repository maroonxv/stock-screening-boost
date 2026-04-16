import { describe, expect, it } from "vitest";
import {
  formatTimingDirectionLabel,
  formatTimingMarketStateLabel,
  formatTimingMetricLabel,
  formatTimingSignalKeyLabel,
} from "~/app/timing/timing-labels";

describe("timing-labels", () => {
  it("formats core report labels in Chinese", () => {
    expect(formatTimingDirectionLabel("bullish")).toBe("看多");
    expect(formatTimingSignalKeyLabel("volatilityPercentile")).toBe("波动分位");
    expect(formatTimingMetricLabel("distanceTo60dHighPct")).toBe("距60日高点");
    expect(formatTimingMarketStateLabel("RISK_ON")).toBe("风险偏好");
  });

  it("falls back to the original value for unknown labels", () => {
    expect(formatTimingMetricLabel("unknownMetric")).toBe("unknownMetric");
  });
});
