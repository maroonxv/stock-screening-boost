import type {
  TimingDirection,
  TimingFactorBreakdownItem,
  TimingRiskFlag,
} from "~/server/domain/timing/types";

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

export class TimingConfidencePolicy {
  calculate(params: {
    direction: TimingDirection;
    signalStrength: number;
    factorBreakdown: TimingFactorBreakdownItem[];
    riskFlags: TimingRiskFlag[];
  }) {
    const total = params.factorBreakdown.length || 1;
    const aligned = params.factorBreakdown.filter((factor) => {
      if (params.direction === "bullish") {
        return factor.status === "positive";
      }
      if (params.direction === "bearish") {
        return factor.status === "negative";
      }
      return factor.status === "neutral";
    }).length;

    const alignmentScore = (aligned / total) * 35;
    const riskPenalty = params.riskFlags.length * 4;
    const neutralPenalty = params.direction === "neutral" ? 8 : 0;

    return clamp(
      Math.round(
        params.signalStrength * 0.55 +
          alignmentScore -
          riskPenalty -
          neutralPenalty,
      ),
      25,
      95,
    );
  }
}
