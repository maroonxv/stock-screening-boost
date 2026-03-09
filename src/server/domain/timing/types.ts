export const TIMING_SOURCE_TYPES = [
  "single",
  "watchlist",
  "screening",
] as const;

export const TIMING_ACTIONS = [
  "WATCH",
  "PROBE",
  "ADD",
  "HOLD",
  "TRIM",
  "EXIT",
] as const;

export const STAGE_ONE_TIMING_ACTIONS = ["WATCH", "PROBE", "ADD"] as const;

export const TIMING_RISK_FLAGS = [
  "HIGH_VOLATILITY",
  "OVERBOUGHT",
  "OVERSOLD",
  "TREND_WEAKENING",
  "HIGH_CORRELATION",
  "CROWDING_RISK",
  "EVENT_UNCERTAINTY",
] as const;

export const TIMING_MARKET_REGIMES = [
  "RISK_ON",
  "NEUTRAL",
  "RISK_OFF",
] as const;

export type TimingSourceType = (typeof TIMING_SOURCE_TYPES)[number];
export type TimingAction = (typeof TIMING_ACTIONS)[number];
export type StageOneTimingAction = (typeof STAGE_ONE_TIMING_ACTIONS)[number];
export type TimingRiskFlag = (typeof TIMING_RISK_FLAGS)[number];
export type TimingMarketRegime = (typeof TIMING_MARKET_REGIMES)[number];
export type TimingDirection = "bullish" | "neutral" | "bearish";
export type TimingTimeframe = "DAILY";
export type TimingFactorStatus = "positive" | "neutral" | "negative";

export type TimingBar = {
  tradeDate: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  amount?: number | null;
  turnoverRate?: number | null;
};

export type TimingMacd = {
  dif: number;
  dea: number;
  histogram: number;
};

export type TimingRsi = {
  value: number;
};

export type TimingBollinger = {
  upper: number;
  middle: number;
  lower: number;
  closePosition: number;
};

export type TimingObv = {
  value: number;
  slope: number;
};

export type TimingIndicators = {
  close: number;
  macd: TimingMacd;
  rsi: TimingRsi;
  bollinger: TimingBollinger;
  obv: TimingObv;
  ema20: number;
  ema60: number;
  atr14: number;
  volumeRatio20: number;
};

export type TimingRuleSummary = {
  direction: TimingDirection;
  signalStrength: number;
  warnings: string[];
};

export type TimingBarsData = {
  stockCode: string;
  stockName: string;
  timeframe: TimingTimeframe;
  adjust: string;
  bars: TimingBar[];
};

export type TimingSignalData = {
  stockCode: string;
  stockName: string;
  asOfDate: string;
  barsCount: number;
  indicators: TimingIndicators;
  ruleSummary: TimingRuleSummary;
};

export type TimingSignalBatchError = {
  stockCode: string;
  code: string;
  message: string;
};

export type TimingSignalBatchData = {
  items: TimingSignalData[];
  errors: TimingSignalBatchError[];
};

export type TimingFactorBreakdownItem = {
  key: string;
  label: string;
  status: TimingFactorStatus;
  score: number;
  detail: string;
};

export type TechnicalAssessment = {
  stockCode: string;
  stockName: string;
  asOfDate: string;
  direction: TimingDirection;
  signalStrength: number;
  confidence: number;
  factorBreakdown: TimingFactorBreakdownItem[];
  triggerNotes: string[];
  invalidationNotes: string[];
  riskFlags: TimingRiskFlag[];
  explanation: string;
};

export type TimingCardReasoning = {
  direction: TimingDirection;
  signalStrength: number;
  confidence: number;
  factorBreakdown: TimingFactorBreakdownItem[];
  explanation: string;
  actionRationale: string;
  indicators: TimingIndicators;
  ruleSummary: TimingRuleSummary;
};

export type TimingSignalSnapshotRecord = {
  id: string;
  userId: string;
  workflowRunId?: string | null;
  stockCode: string;
  stockName: string;
  asOfDate: string;
  sourceType: TimingSourceType;
  sourceId: string;
  timeframe: TimingTimeframe;
  barsCount: number;
  indicators: TimingIndicators;
  signalSummary: TimingRuleSummary;
  createdAt: Date;
};

export type TimingAnalysisCardRecord = {
  id: string;
  userId: string;
  workflowRunId?: string | null;
  watchListId?: string | null;
  stockCode: string;
  stockName: string;
  sourceType: TimingSourceType;
  sourceId: string;
  signalSnapshotId: string;
  actionBias: TimingAction;
  confidence: number;
  marketRegime?: string | null;
  summary: string;
  triggerNotes: string[];
  invalidationNotes: string[];
  riskFlags: TimingRiskFlag[];
  reasoning: TimingCardReasoning;
  createdAt: Date;
  updatedAt: Date;
  signalSnapshot?: TimingSignalSnapshotRecord;
};

export type TimingCardDraft = {
  userId: string;
  workflowRunId?: string;
  watchListId?: string;
  stockCode: string;
  stockName: string;
  sourceType: TimingSourceType;
  sourceId: string;
  actionBias: TimingAction;
  confidence: number;
  marketRegime?: string;
  summary: string;
  triggerNotes: string[];
  invalidationNotes: string[];
  riskFlags: TimingRiskFlag[];
  reasoning: TimingCardReasoning;
};

export type PortfolioPosition = {
  stockCode: string;
  stockName: string;
  quantity: number;
  costBasis: number;
  currentWeightPct: number;
  sector?: string;
  themes?: string[];
};

export type PortfolioRiskPreferences = {
  maxSingleNamePct: number;
  maxThemeExposurePct: number;
  defaultProbePct: number;
  maxPortfolioRiskBudgetPct: number;
};

export type PortfolioSnapshotRecord = {
  id: string;
  userId: string;
  name: string;
  baseCurrency: string;
  cash: number;
  totalCapital: number;
  positions: PortfolioPosition[];
  riskPreferences: PortfolioRiskPreferences;
  createdAt: Date;
  updatedAt: Date;
};

export type PortfolioSnapshotDraft = {
  userId: string;
  name: string;
  baseCurrency: string;
  cash: number;
  totalCapital: number;
  positions: PortfolioPosition[];
  riskPreferences: PortfolioRiskPreferences;
};

export type MarketIndexSnapshot = {
  code: string;
  name: string;
  close: number;
  changePct: number;
  ema20: number;
  ema60: number;
  aboveEma20: boolean;
  aboveEma60: boolean;
  atrRatio: number;
};

export type MarketBreadthSnapshot = {
  totalCount: number;
  advancingCount: number;
  decliningCount: number;
  flatCount: number;
  positiveRatio: number;
  medianChangePct: number;
  aboveThreePctCount: number;
  belowThreePctCount: number;
  averageTurnoverRate?: number | null;
};

export type MarketVolatilitySnapshot = {
  highVolatilityCount: number;
  highVolatilityRatio: number;
  limitDownLikeCount: number;
};

export type MarketRegimeFeatureSnapshot = {
  benchmarkStrength: number;
  breadthScore: number;
  riskScore: number;
};

export type MarketRegimeSnapshot = {
  asOfDate: string;
  indexes: MarketIndexSnapshot[];
  breadth: MarketBreadthSnapshot;
  volatility: MarketVolatilitySnapshot;
  features: MarketRegimeFeatureSnapshot;
};

export type MarketRegimeAnalysis = {
  marketRegime: TimingMarketRegime;
  regimeConfidence: number;
  summary: string;
  constraints: string[];
  snapshot: MarketRegimeSnapshot;
};

export type PortfolioRiskPlan = {
  portfolioRiskBudgetPct: number;
  maxSingleNamePct: number;
  defaultProbePct: number;
  blockedActions: TimingAction[];
  correlationWarnings: string[];
  notes: string[];
};

export type TimingRecommendationReasoning = {
  timingSummary: string;
  actionRationale: string;
  marketRegimeSummary: string;
  regimeConstraints: string[];
  riskPlan: PortfolioRiskPlan;
  positionContext: {
    held: boolean;
    currentWeightPct: number;
    targetDeltaPct: number;
    availableCashPct: number;
  };
  factorBreakdown: TimingFactorBreakdownItem[];
  triggerNotes: string[];
  invalidationNotes: string[];
};

export type TimingRecommendationRecord = {
  id: string;
  userId: string;
  workflowRunId?: string | null;
  portfolioSnapshotId: string;
  watchListId: string;
  stockCode: string;
  stockName: string;
  action: TimingAction;
  priority: number;
  confidence: number;
  suggestedMinPct: number;
  suggestedMaxPct: number;
  riskBudgetPct: number;
  marketRegime: TimingMarketRegime;
  riskFlags: TimingRiskFlag[];
  reasoning: TimingRecommendationReasoning;
  createdAt: Date;
  updatedAt: Date;
};

export type TimingRecommendationDraft = {
  userId: string;
  workflowRunId?: string;
  portfolioSnapshotId: string;
  watchListId: string;
  stockCode: string;
  stockName: string;
  action: TimingAction;
  priority: number;
  confidence: number;
  suggestedMinPct: number;
  suggestedMaxPct: number;
  riskBudgetPct: number;
  marketRegime: TimingMarketRegime;
  riskFlags: TimingRiskFlag[];
  reasoning: TimingRecommendationReasoning;
};
