import type {
  MarketRegimeAnalysis,
  MarketRegimeSnapshot,
  TimingMarketRegime,
} from "~/server/domain/timing/types";

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function round(value: number) {
  return Math.round(value * 100) / 100;
}

export class MarketRegimeService {
  analyze(snapshot: MarketRegimeSnapshot): MarketRegimeAnalysis {
    const indexesAboveTrend = snapshot.indexes.filter(
      (item) => item.aboveEma20 && item.aboveEma60,
    ).length;
    const breadthPositive = snapshot.breadth.positiveRatio;
    const highVolatilityRatio = snapshot.volatility.highVolatilityRatio;
    const benchmarkStrength = snapshot.features.benchmarkStrength;
    const riskScore = snapshot.features.riskScore;

    const riskOffSignals = [
      breadthPositive < 0.42,
      highVolatilityRatio >= 0.28,
      benchmarkStrength < 45,
      indexesAboveTrend <= 1,
      riskScore >= 62,
    ].filter(Boolean).length;

    const riskOnSignals = [
      breadthPositive >= 0.58,
      highVolatilityRatio <= 0.18,
      benchmarkStrength >= 60,
      indexesAboveTrend >= 2,
      riskScore <= 40,
    ].filter(Boolean).length;

    let marketRegime: TimingMarketRegime = "NEUTRAL";
    if (riskOffSignals >= 3) {
      marketRegime = "RISK_OFF";
    } else if (riskOnSignals >= 3) {
      marketRegime = "RISK_ON";
    }

    const separation = Math.abs(riskOnSignals - riskOffSignals);
    const regimeConfidence = clamp(
      round(54 + separation * 9 + Math.abs(breadthPositive - 0.5) * 28),
      45,
      92,
    );

    const constraints =
      marketRegime === "RISK_OFF"
        ? [
            "Prefer WATCH/PROBE over aggressive ADD ideas.",
            "Tighten single-name exposure and preserve cash flexibility.",
            "Require stronger confirmation before adding new risk.",
          ]
        : marketRegime === "RISK_ON"
          ? [
              "Allow higher conviction names to use the risk budget first.",
              "Keep probe positions disciplined instead of spreading too thin.",
            ]
          : [
              "Favor balanced sizing and wait for stronger breadth confirmation.",
              "Use the risk budget selectively and keep trim/exit rules active.",
            ];

    const summary =
      marketRegime === "RISK_OFF"
        ? `Market breadth is weak (${round(breadthPositive * 100)}%), volatility is elevated, and benchmark trend support is thin.`
        : marketRegime === "RISK_ON"
          ? `Benchmark trend and breadth are aligned, with ${indexesAboveTrend} major proxies above medium-term trend.`
          : `The market is mixed: breadth sits at ${round(breadthPositive * 100)}% and benchmark strength remains balanced.`;

    return {
      marketRegime,
      regimeConfidence,
      summary,
      constraints,
      snapshot,
    };
  }
}
