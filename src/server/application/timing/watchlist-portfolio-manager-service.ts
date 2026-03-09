import type {
  MarketRegimeAnalysis,
  PortfolioPosition,
  PortfolioRiskPlan,
  PortfolioSnapshotRecord,
  TimingAction,
  TimingCardDraft,
  TimingRecommendationDraft,
  TimingRiskFlag,
} from "~/server/domain/timing/types";

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function round(value: number) {
  return Math.round(value * 100) / 100;
}

function unique<T>(values: T[]) {
  return [...new Set(values)];
}

type Candidate = {
  card: TimingCardDraft;
  action: TimingAction;
  confidence: number;
  minPct: number;
  maxPct: number;
  heldPosition?: PortfolioPosition;
  score: number;
  riskFlags: TimingRiskFlag[];
};

export class WatchlistPortfolioManagerService {
  buildRecommendations(params: {
    userId: string;
    workflowRunId: string;
    watchListId: string;
    portfolioSnapshot: PortfolioSnapshotRecord;
    timingCards: TimingCardDraft[];
    riskPlan: PortfolioRiskPlan;
    marketRegimeAnalysis: MarketRegimeAnalysis;
  }): TimingRecommendationDraft[] {
    const positionsByCode = new Map(
      params.portfolioSnapshot.positions.map((position) => [
        position.stockCode,
        position,
      ]),
    );

    let remainingRiskBudget = params.riskPlan.portfolioRiskBudgetPct;

    const candidates = params.timingCards
      .map((card) => {
        const heldPosition = positionsByCode.get(card.stockCode);
        const normalizedAction = this.normalizeAction(
          card.actionBias,
          Boolean(heldPosition),
          params.riskPlan.blockedActions,
          params.marketRegimeAnalysis.marketRegime,
          card.confidence,
        );

        const range = this.getSuggestedRange(
          normalizedAction,
          heldPosition,
          params.riskPlan,
        );

        const riskFlags = [...card.riskFlags];
        if (params.riskPlan.correlationWarnings.length > 0 && heldPosition) {
          riskFlags.push("HIGH_CORRELATION");
        }

        if (
          params.marketRegimeAnalysis.marketRegime === "RISK_OFF" &&
          (normalizedAction === "ADD" || normalizedAction === "PROBE")
        ) {
          riskFlags.push("CROWDING_RISK");
        }

        return {
          card,
          action: normalizedAction,
          confidence: this.adjustConfidence(
            card.confidence,
            card.actionBias,
            normalizedAction,
            params.marketRegimeAnalysis.marketRegime,
          ),
          minPct: range.minPct,
          maxPct: range.maxPct,
          heldPosition,
          score: this.computeScore(
            card,
            normalizedAction,
            Boolean(heldPosition),
          ),
          riskFlags: unique(riskFlags),
        } satisfies Candidate;
      })
      .sort((left, right) => right.score - left.score);

    const budgeted = candidates.map((candidate) => {
      const currentWeight = candidate.heldPosition?.currentWeightPct ?? 0;
      const incrementalRisk = Math.max(0, candidate.maxPct - currentWeight);

      if (incrementalRisk > 0) {
        const allowedIncrementalRisk = Math.min(
          incrementalRisk,
          remainingRiskBudget,
        );

        if (allowedIncrementalRisk <= 0.25) {
          return this.downgradeForBudget(candidate);
        }

        remainingRiskBudget = round(
          Math.max(0, remainingRiskBudget - allowedIncrementalRisk),
        );

        candidate.maxPct = round(currentWeight + allowedIncrementalRisk);
        candidate.minPct = round(Math.min(candidate.minPct, candidate.maxPct));
      }

      return candidate;
    });

    return budgeted.map((candidate, index) => {
      const currentWeight = candidate.heldPosition?.currentWeightPct ?? 0;
      const targetDeltaPct = round(candidate.maxPct - currentWeight);
      const availableCashPct =
        params.portfolioSnapshot.totalCapital > 0
          ? round(
              (params.portfolioSnapshot.cash /
                params.portfolioSnapshot.totalCapital) *
                100,
            )
          : 0;

      return {
        userId: params.userId,
        workflowRunId: params.workflowRunId,
        portfolioSnapshotId: params.portfolioSnapshot.id,
        watchListId: params.watchListId,
        stockCode: candidate.card.stockCode,
        stockName: candidate.card.stockName,
        action: candidate.action,
        priority: index + 1,
        confidence: candidate.confidence,
        suggestedMinPct: round(candidate.minPct),
        suggestedMaxPct: round(candidate.maxPct),
        riskBudgetPct: params.riskPlan.portfolioRiskBudgetPct,
        marketRegime: params.marketRegimeAnalysis.marketRegime,
        riskFlags: candidate.riskFlags,
        reasoning: {
          timingSummary: candidate.card.summary,
          actionRationale: this.buildActionRationale(
            candidate,
            params.marketRegimeAnalysis,
          ),
          marketRegimeSummary: params.marketRegimeAnalysis.summary,
          regimeConstraints: params.marketRegimeAnalysis.constraints,
          riskPlan: params.riskPlan,
          positionContext: {
            held: Boolean(candidate.heldPosition),
            currentWeightPct: round(currentWeight),
            targetDeltaPct,
            availableCashPct,
          },
          factorBreakdown: candidate.card.reasoning.factorBreakdown,
          triggerNotes: candidate.card.triggerNotes,
          invalidationNotes: candidate.card.invalidationNotes,
        },
      };
    });
  }

  private normalizeAction(
    action: TimingAction,
    hasPosition: boolean,
    blockedActions: TimingAction[],
    marketRegime: MarketRegimeAnalysis["marketRegime"],
    confidence: number,
  ): TimingAction {
    if (!hasPosition && ["HOLD", "TRIM", "EXIT"].includes(action)) {
      return "WATCH";
    }

    if (blockedActions.includes(action)) {
      if (action === "ADD") {
        return blockedActions.includes("PROBE") ? "WATCH" : "PROBE";
      }

      if (action === "PROBE") {
        return "WATCH";
      }
    }

    if (marketRegime === "RISK_OFF" && action === "ADD") {
      return confidence >= 78 ? "PROBE" : "WATCH";
    }

    if (marketRegime === "RISK_OFF" && action === "PROBE" && confidence < 68) {
      return "WATCH";
    }

    return action;
  }

  private getSuggestedRange(
    action: TimingAction,
    heldPosition: PortfolioPosition | undefined,
    riskPlan: PortfolioRiskPlan,
  ) {
    const currentWeight = heldPosition?.currentWeightPct ?? 0;
    const maxSingleNamePct = riskPlan.maxSingleNamePct;
    const defaultProbePct = riskPlan.defaultProbePct;

    if (!heldPosition) {
      switch (action) {
        case "PROBE":
          return {
            minPct: round(Math.max(0.5, defaultProbePct * 0.5)),
            maxPct: round(defaultProbePct),
          };
        case "ADD":
          return {
            minPct: round(Math.max(defaultProbePct, maxSingleNamePct * 0.45)),
            maxPct: round(maxSingleNamePct),
          };
        default:
          return { minPct: 0, maxPct: 0 };
      }
    }

    switch (action) {
      case "EXIT":
        return { minPct: 0, maxPct: round(Math.min(currentWeight * 0.1, 1)) };
      case "TRIM":
        return {
          minPct: round(Math.max(0, currentWeight * 0.35)),
          maxPct: round(Math.max(0, currentWeight - defaultProbePct)),
        };
      case "HOLD":
        return {
          minPct: round(Math.max(0, currentWeight - 1)),
          maxPct: round(Math.min(maxSingleNamePct, currentWeight + 1)),
        };
      case "PROBE":
        return {
          minPct: round(currentWeight),
          maxPct: round(
            Math.min(maxSingleNamePct, currentWeight + defaultProbePct),
          ),
        };
      case "ADD":
        return {
          minPct: round(
            Math.min(maxSingleNamePct, currentWeight + defaultProbePct * 0.75),
          ),
          maxPct: round(
            Math.min(maxSingleNamePct, currentWeight + defaultProbePct * 2),
          ),
        };
      default:
        return { minPct: round(currentWeight), maxPct: round(currentWeight) };
    }
  }

  private adjustConfidence(
    confidence: number,
    originalAction: TimingAction,
    normalizedAction: TimingAction,
    marketRegime: MarketRegimeAnalysis["marketRegime"],
  ) {
    let next = confidence;
    if (marketRegime === "RISK_OFF" && normalizedAction !== originalAction) {
      next -= 8;
    }
    if (normalizedAction === "WATCH") {
      next -= 4;
    }
    return clamp(Math.round(next), 25, 95);
  }

  private computeScore(
    card: TimingCardDraft,
    action: TimingAction,
    hasPosition: boolean,
  ) {
    const actionScore: Record<TimingAction, number> = {
      WATCH: 20,
      PROBE: 55,
      ADD: 72,
      HOLD: 46,
      TRIM: 78,
      EXIT: 90,
    };

    return (
      actionScore[action] +
      card.confidence +
      card.reasoning.signalStrength * 0.45 +
      (hasPosition ? 6 : 0)
    );
  }

  private downgradeForBudget(candidate: Candidate): Candidate {
    if (candidate.heldPosition) {
      return {
        ...candidate,
        action:
          candidate.action === "ADD" || candidate.action === "PROBE"
            ? "HOLD"
            : candidate.action,
        minPct: round(candidate.heldPosition.currentWeightPct),
        maxPct: round(candidate.heldPosition.currentWeightPct),
      };
    }

    return {
      ...candidate,
      action: "WATCH",
      minPct: 0,
      maxPct: 0,
    };
  }

  private buildActionRationale(
    candidate: Candidate,
    marketRegimeAnalysis: MarketRegimeAnalysis,
  ) {
    const heldText = candidate.heldPosition
      ? `Existing weight is ${round(candidate.heldPosition.currentWeightPct)}%.`
      : "This name is not currently held.";

    return `${candidate.card.reasoning.actionRationale} ${heldText} ${marketRegimeAnalysis.summary}`;
  }
}
