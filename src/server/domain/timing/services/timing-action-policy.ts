import type {
  StageOneTimingAction,
  TimingAction,
  TimingDirection,
} from "~/server/domain/timing/types";

export class TimingActionPolicy {
  decide(params: {
    direction: TimingDirection;
    confidence: number;
    signalStrength: number;
    hasPortfolioContext?: boolean;
  }): TimingAction {
    if (!params.hasPortfolioContext) {
      return this.decideStageOneAction(params);
    }

    if (params.direction === "bearish" && params.confidence >= 82) {
      return "EXIT";
    }

    if (params.direction === "bearish" && params.confidence >= 68) {
      return "TRIM";
    }

    if (params.direction === "neutral" && params.confidence >= 60) {
      return "HOLD";
    }

    return this.decideStageOneAction(params);
  }

  private decideStageOneAction(params: {
    direction: TimingDirection;
    confidence: number;
    signalStrength: number;
  }): StageOneTimingAction {
    if (
      params.direction === "bullish" &&
      params.confidence >= 74 &&
      params.signalStrength >= 68
    ) {
      return "ADD";
    }

    if (
      params.direction === "bullish" &&
      params.confidence >= 56 &&
      params.signalStrength >= 52
    ) {
      return "PROBE";
    }

    return "WATCH";
  }
}
