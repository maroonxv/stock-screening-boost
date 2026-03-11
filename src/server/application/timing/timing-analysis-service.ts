import { resolveTimingPresetConfig } from "~/server/domain/timing/preset";
import { TimingActionPolicy } from "~/server/domain/timing/services/timing-action-policy";
import { TimingConfidencePolicy } from "~/server/domain/timing/services/timing-confidence-policy";
import type {
  TechnicalAssessment,
  TimingCardDraft,
  TimingFactorBreakdownItem,
  TimingPresetConfig,
  TimingRiskFlag,
  TimingSignalData,
  TimingSourceType,
} from "~/server/domain/timing/types";
import { TechnicalSignalSet } from "~/server/domain/timing/value-objects/technical-signal-set";

function uniqueFlags(flags: string[]): TimingRiskFlag[] {
  return [...new Set(flags)] as TimingRiskFlag[];
}

function summarizeFactorLabel(factor: TimingFactorBreakdownItem) {
  return `${factor.label}：${factor.detail}`;
}

function applyFactorWeight(
  factor: TimingFactorBreakdownItem,
  presetConfig: TimingPresetConfig,
) {
  const weight =
    presetConfig.factorWeights?.[
      factor.key as keyof NonNullable<TimingPresetConfig["factorWeights"]>
    ] ?? 1;

  return {
    ...factor,
    score: Math.round(factor.score * weight),
  };
}

export class TimingAnalysisService {
  constructor(
    private readonly deps: {
      confidencePolicy?: TimingConfidencePolicy;
      actionPolicy?: TimingActionPolicy;
    } = {},
  ) {}

  private get confidencePolicy() {
    return this.deps.confidencePolicy ?? new TimingConfidencePolicy();
  }

  private get actionPolicy() {
    return this.deps.actionPolicy ?? new TimingActionPolicy();
  }

  buildTechnicalAssessments(
    signalSnapshots: TimingSignalData[],
    presetConfig?: TimingPresetConfig,
  ) {
    return signalSnapshots.map((snapshot) =>
      this.buildAssessment(snapshot, presetConfig),
    );
  }

  buildCards(params: {
    userId: string;
    workflowRunId?: string;
    sourceType: TimingSourceType;
    sourceId: string;
    watchListId?: string;
    presetId?: string;
    presetConfig?: TimingPresetConfig;
    signalSnapshots: TimingSignalData[];
    technicalAssessments: TechnicalAssessment[];
    hasPortfolioContext?: boolean;
  }): TimingCardDraft[] {
    const snapshotByCode = new Map(
      params.signalSnapshots.map((snapshot) => [snapshot.stockCode, snapshot]),
    );

    return params.technicalAssessments.map((assessment) => {
      const snapshot = snapshotByCode.get(assessment.stockCode);

      if (!snapshot) {
        throw new Error(`缺少 ${assessment.stockCode} 的信号快照`);
      }

      const actionBias = this.actionPolicy.decide(
        {
          direction: assessment.direction,
          confidence: assessment.confidence,
          signalStrength: assessment.signalStrength,
          hasPortfolioContext: params.hasPortfolioContext,
        },
        params.presetConfig,
      );

      const actionRationale =
        actionBias === "ADD"
          ? "趋势、量能与动量同时站在有利一侧，适合从观察升级到加仓候选。"
          : actionBias === "PROBE"
            ? "信号已具备试仓条件，但仍需等待更多确认。"
            : "当前更适合继续观察，等待趋势和量能继续验证。";

      return {
        userId: params.userId,
        workflowRunId: params.workflowRunId,
        watchListId: params.watchListId,
        presetId: params.presetId,
        stockCode: assessment.stockCode,
        stockName: assessment.stockName,
        sourceType: params.sourceType,
        sourceId: params.sourceId,
        actionBias,
        confidence: assessment.confidence,
        summary: `${assessment.stockName} 当前偏向${actionBias}，核心依据是${assessment.explanation}`,
        triggerNotes: assessment.triggerNotes,
        invalidationNotes: assessment.invalidationNotes,
        riskFlags: assessment.riskFlags,
        reasoning: {
          direction: assessment.direction,
          signalStrength: assessment.signalStrength,
          confidence: assessment.confidence,
          factorBreakdown: assessment.factorBreakdown,
          explanation: assessment.explanation,
          actionRationale,
          indicators: snapshot.indicators,
          ruleSummary: snapshot.ruleSummary,
        },
      };
    });
  }

  private buildAssessment(
    snapshot: TimingSignalData,
    presetConfig?: TimingPresetConfig,
  ): TechnicalAssessment {
    const resolvedPresetConfig = resolveTimingPresetConfig(presetConfig);
    const indicators = TechnicalSignalSet.create(
      snapshot.indicators,
    ).toObject();
    const volatilityRatio =
      indicators.atr14 / Math.max(indicators.close, 0.0001);

    const factorBreakdown: TimingFactorBreakdownItem[] = [
      indicators.close >= indicators.ema20 &&
      indicators.ema20 >= indicators.ema60
        ? {
            key: "trend",
            label: "趋势结构",
            status: "positive",
            score: 18,
            detail: "收盘价站上 EMA20，且 EMA20 位于 EMA60 上方。",
          }
        : indicators.close <= indicators.ema20 &&
            indicators.ema20 <= indicators.ema60
          ? {
              key: "trend",
              label: "趋势结构",
              status: "negative",
              score: -18,
              detail: "收盘价跌破 EMA20，且 EMA20 位于 EMA60 下方。",
            }
          : {
              key: "trend",
              label: "趋势结构",
              status: "neutral",
              score: 0,
              detail: "短中期均线与收盘价尚未形成明确同向结构。",
            },
      indicators.macd.histogram > 0 && indicators.macd.dif > indicators.macd.dea
        ? {
            key: "macd",
            label: "动量共振",
            status: "positive",
            score: 16,
            detail: "MACD 红柱扩张，DIF 位于 DEA 上方。",
          }
        : indicators.macd.histogram < 0 &&
            indicators.macd.dif < indicators.macd.dea
          ? {
              key: "macd",
              label: "动量共振",
              status: "negative",
              score: -16,
              detail: "MACD 绿柱占优，DIF 位于 DEA 下方。",
            }
          : {
              key: "macd",
              label: "动量共振",
              status: "neutral",
              score: 0,
              detail: "MACD 动量方向不够集中。",
            },
      indicators.rsi.value >= 52 && indicators.rsi.value <= 68
        ? {
            key: "rsi",
            label: "强弱区间",
            status: "positive",
            score: 12,
            detail: `RSI 处于 ${indicators.rsi.value.toFixed(1)}，强势但未明显过热。`,
          }
        : indicators.rsi.value <= 45
          ? {
              key: "rsi",
              label: "强弱区间",
              status: "negative",
              score: -12,
              detail: `RSI 仅 ${indicators.rsi.value.toFixed(1)}，买盘强度偏弱。`,
            }
          : {
              key: "rsi",
              label: "强弱区间",
              status: "neutral",
              score: 0,
              detail: `RSI 为 ${indicators.rsi.value.toFixed(1)}，多空尚未拉开。`,
            },
      indicators.bollinger.closePosition >= 0.58
        ? {
            key: "bollinger",
            label: "波段位置",
            status: "positive",
            score: 10,
            detail: "价格位于布林中上轨，更接近主动进攻区域。",
          }
        : indicators.bollinger.closePosition <= 0.42
          ? {
              key: "bollinger",
              label: "波段位置",
              status: "negative",
              score: -10,
              detail: "价格靠近布林中下轨，反弹确认不足。",
            }
          : {
              key: "bollinger",
              label: "波段位置",
              status: "neutral",
              score: 0,
              detail: "价格位于布林中性区域，暂无明显突破。",
            },
      indicators.volumeRatio20 >= 1.15
        ? {
            key: "volume",
            label: "量能确认",
            status: "positive",
            score: 12,
            detail: `量比 ${indicators.volumeRatio20.toFixed(2)}，资金参与度高于 20 日均值。`,
          }
        : indicators.volumeRatio20 <= 0.85
          ? {
              key: "volume",
              label: "量能确认",
              status: "negative",
              score: -10,
              detail: `量比 ${indicators.volumeRatio20.toFixed(2)}，量能配合不足。`,
            }
          : {
              key: "volume",
              label: "量能确认",
              status: "neutral",
              score: 0,
              detail: `量比 ${indicators.volumeRatio20.toFixed(2)}，量能基本持平。`,
            },
      indicators.obv.slope > 0
        ? {
            key: "obv",
            label: "资金流向",
            status: "positive",
            score: 10,
            detail: "OBV 斜率上行，资金净流向仍在改善。",
          }
        : indicators.obv.slope < 0
          ? {
              key: "obv",
              label: "资金流向",
              status: "negative",
              score: -10,
              detail: "OBV 斜率转负，资金面开始走弱。",
            }
          : {
              key: "obv",
              label: "资金流向",
              status: "neutral",
              score: 0,
              detail: "OBV 方向不明显。",
            },
      volatilityRatio <= 0.035
        ? {
            key: "volatility",
            label: "波动风险",
            status: "positive",
            score: 8,
            detail: "ATR 相对收盘价处于可控区间。",
          }
        : volatilityRatio >= 0.055
          ? {
              key: "volatility",
              label: "波动风险",
              status: "negative",
              score: -12,
              detail: "ATR 占比偏高，走势容错率较低。",
            }
          : {
              key: "volatility",
              label: "波动风险",
              status: "neutral",
              score: 0,
              detail: "波动水平中性。",
            },
    ];

    const weightedFactorBreakdown = factorBreakdown.map((factor) =>
      applyFactorWeight(factor, resolvedPresetConfig),
    );
    const signalStrength = Math.max(
      0,
      Math.min(
        100,
        Math.round(
          snapshot.ruleSummary.signalStrength *
            (resolvedPresetConfig.agentWeights?.technicalSignal ?? 1),
        ),
      ),
    );

    const confidence = this.confidencePolicy.calculate(
      {
        direction: snapshot.ruleSummary.direction,
        signalStrength,
        factorBreakdown: weightedFactorBreakdown,
        riskFlags: uniqueFlags(snapshot.ruleSummary.warnings),
      },
      resolvedPresetConfig,
    );

    const positiveFactors = weightedFactorBreakdown.filter(
      (factor) => factor.status === "positive",
    );
    const negativeFactors = weightedFactorBreakdown.filter(
      (factor) => factor.status === "negative",
    );

    const triggerNotes = positiveFactors
      .slice(0, 3)
      .map((factor) => summarizeFactorLabel(factor));
    const invalidationNotes = negativeFactors.length
      ? negativeFactors
          .slice(0, 3)
          .map((factor) => summarizeFactorLabel(factor))
      : ["若收盘价重新跌破 EMA20 且量能无法放大，本次择时假设需要重评。"];

    const riskFlags = uniqueFlags(snapshot.ruleSummary.warnings);
    const explanation =
      snapshot.ruleSummary.direction === "bullish"
        ? "趋势、动量与量能整体偏正向"
        : snapshot.ruleSummary.direction === "bearish"
          ? "弱势信号占优，仍需等待结构修复"
          : "多空因子相互拉扯，宜以观察为主";

    return {
      stockCode: snapshot.stockCode,
      stockName: snapshot.stockName,
      asOfDate: snapshot.asOfDate,
      direction: snapshot.ruleSummary.direction,
      signalStrength,
      confidence,
      factorBreakdown: weightedFactorBreakdown,
      triggerNotes,
      invalidationNotes,
      riskFlags,
      explanation,
    };
  }
}
