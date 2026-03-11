import type {
  TimingPresetConfig,
  TimingReviewHorizon,
} from "~/server/domain/timing/types";

export const DEFAULT_TIMING_REVIEW_HORIZONS: TimingReviewHorizon[] = [
  "T5",
  "T10",
  "T20",
];

export const DEFAULT_TIMING_PRESET_CONFIG: TimingPresetConfig = {
  factorWeights: {
    trend: 1,
    macd: 1,
    rsi: 1,
    bollinger: 1,
    volume: 1,
    obv: 1,
    volatility: 1,
  },
  agentWeights: {
    technicalSignal: 1,
  },
  confidenceThresholds: {
    signalStrengthWeight: 0.55,
    alignmentWeight: 35,
    riskPenaltyPerFlag: 4,
    neutralPenalty: 8,
    minConfidence: 25,
    maxConfidence: 95,
  },
  actionThresholds: {
    addConfidence: 74,
    addSignalStrength: 68,
    probeConfidence: 56,
    probeSignalStrength: 52,
    holdConfidence: 60,
    trimConfidence: 68,
    exitConfidence: 82,
  },
  reviewSchedule: {
    horizons: DEFAULT_TIMING_REVIEW_HORIZONS,
  },
};

export function resolveTimingPresetConfig(
  value?: TimingPresetConfig | null,
): TimingPresetConfig {
  return {
    factorWeights: {
      ...DEFAULT_TIMING_PRESET_CONFIG.factorWeights,
      ...value?.factorWeights,
    },
    agentWeights: {
      ...DEFAULT_TIMING_PRESET_CONFIG.agentWeights,
      ...value?.agentWeights,
    },
    confidenceThresholds: {
      ...DEFAULT_TIMING_PRESET_CONFIG.confidenceThresholds,
      ...value?.confidenceThresholds,
    },
    actionThresholds: {
      ...DEFAULT_TIMING_PRESET_CONFIG.actionThresholds,
      ...value?.actionThresholds,
    },
    reviewSchedule: {
      horizons: value?.reviewSchedule?.horizons?.length
        ? value.reviewSchedule.horizons
        : DEFAULT_TIMING_REVIEW_HORIZONS,
    },
  };
}
