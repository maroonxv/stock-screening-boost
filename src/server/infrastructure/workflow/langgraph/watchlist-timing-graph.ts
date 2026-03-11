import { Annotation, END, START, StateGraph } from "@langchain/langgraph";
import type { MarketRegimeService } from "~/server/application/timing/market-regime-service";
import type { TimingAnalysisService } from "~/server/application/timing/timing-analysis-service";
import type { TimingReviewSchedulingService } from "~/server/application/timing/timing-review-scheduling-service";
import type { WatchlistPortfolioManagerService } from "~/server/application/timing/watchlist-portfolio-manager-service";
import type { WatchlistRiskManagerService } from "~/server/application/timing/watchlist-risk-manager-service";
import { resolveTimingPresetConfig } from "~/server/domain/timing/preset";
import type {
  WatchlistTimingPipelineGraphState,
  WatchlistTimingPipelineInput,
  WatchlistTimingPipelineNodeKey,
  WorkflowGraphState,
  WorkflowNodeKey,
} from "~/server/domain/workflow/types";
import {
  WATCHLIST_TIMING_PIPELINE_NODE_KEYS,
  WATCHLIST_TIMING_PIPELINE_TEMPLATE_CODE,
} from "~/server/domain/workflow/types";
import type { PrismaWatchListRepository } from "~/server/infrastructure/screening/prisma-watch-list-repository";
import type { PrismaPortfolioSnapshotRepository } from "~/server/infrastructure/timing/prisma-portfolio-snapshot-repository";
import type { PrismaTimingPresetRepository } from "~/server/infrastructure/timing/prisma-timing-preset-repository";
import type { PrismaTimingRecommendationRepository } from "~/server/infrastructure/timing/prisma-timing-recommendation-repository";
import type { PythonTimingDataClient } from "~/server/infrastructure/timing/python-timing-data-client";
import type {
  WorkflowGraphBuildInitialStateParams,
  WorkflowGraphExecutionHooks,
  WorkflowGraphRunner,
} from "~/server/infrastructure/workflow/langgraph/workflow-graph";

const WorkflowState = Annotation.Root({
  runId: Annotation<string>,
  userId: Annotation<string>,
  query: Annotation<string>,
  progressPercent: Annotation<number>,
  currentNodeKey: Annotation<WatchlistTimingPipelineNodeKey | undefined>,
  timingInput: Annotation<WatchlistTimingPipelineInput>,
  preset: Annotation<WatchlistTimingPipelineGraphState["preset"]>,
  presetConfig: Annotation<WatchlistTimingPipelineGraphState["presetConfig"]>,
  watchlist: Annotation<WatchlistTimingPipelineGraphState["watchlist"]>,
  portfolioSnapshot: Annotation<
    WatchlistTimingPipelineGraphState["portfolioSnapshot"]
  >,
  targets: Annotation<WatchlistTimingPipelineGraphState["targets"]>,
  signalSnapshots: Annotation<
    WatchlistTimingPipelineGraphState["signalSnapshots"]
  >,
  technicalAssessments: Annotation<
    WatchlistTimingPipelineGraphState["technicalAssessments"]
  >,
  cards: Annotation<WatchlistTimingPipelineGraphState["cards"]>,
  marketRegimeSnapshot: Annotation<
    WatchlistTimingPipelineGraphState["marketRegimeSnapshot"]
  >,
  marketRegimeAnalysis: Annotation<
    WatchlistTimingPipelineGraphState["marketRegimeAnalysis"]
  >,
  riskPlan: Annotation<WatchlistTimingPipelineGraphState["riskPlan"]>,
  recommendations: Annotation<
    WatchlistTimingPipelineGraphState["recommendations"]
  >,
  persistedRecommendations: Annotation<
    WatchlistTimingPipelineGraphState["persistedRecommendations"]
  >,
  reviewRecords: Annotation<WatchlistTimingPipelineGraphState["reviewRecords"]>,
  scheduledReminderIds: Annotation<
    WatchlistTimingPipelineGraphState["scheduledReminderIds"]
  >,
  batchErrors: Annotation<WatchlistTimingPipelineGraphState["batchErrors"]>,
  errors: Annotation<string[]>({
    reducer: (left, right) => left.concat(right),
    default: () => [],
  }),
});

type NodeExecutor = (
  state: WatchlistTimingPipelineGraphState,
) => Promise<Partial<WatchlistTimingPipelineGraphState>>;

export class WatchlistTimingPipelineLangGraph implements WorkflowGraphRunner {
  readonly templateCode = WATCHLIST_TIMING_PIPELINE_TEMPLATE_CODE;

  private readonly nodeExecutors: Record<
    WatchlistTimingPipelineNodeKey,
    NodeExecutor
  >;

  constructor(
    private readonly deps: {
      watchListRepository: PrismaWatchListRepository;
      portfolioSnapshotRepository: PrismaPortfolioSnapshotRepository;
      timingDataClient: PythonTimingDataClient;
      analysisService: TimingAnalysisService;
      presetRepository: PrismaTimingPresetRepository;
      marketRegimeService: MarketRegimeService;
      riskManagerService: WatchlistRiskManagerService;
      portfolioManagerService: WatchlistPortfolioManagerService;
      recommendationRepository: PrismaTimingRecommendationRepository;
      reviewSchedulingService: TimingReviewSchedulingService;
    },
  ) {
    this.nodeExecutors = {
      load_watchlist_context: async (state) => {
        const [watchList, portfolioSnapshot, preset] = await Promise.all([
          this.deps.watchListRepository.findById(state.timingInput.watchListId),
          this.deps.portfolioSnapshotRepository.getByIdForUser(
            state.userId,
            state.timingInput.portfolioSnapshotId,
          ),
          state.timingInput.presetId
            ? this.deps.presetRepository.getByIdForUser(
                state.userId,
                state.timingInput.presetId,
              )
            : Promise.resolve(null),
        ]);

        if (!watchList || watchList.userId !== state.userId) {
          throw new Error("Watchlist not found or access denied");
        }

        if (!portfolioSnapshot) {
          throw new Error("Portfolio snapshot not found or access denied");
        }

        return {
          preset: preset ?? undefined,
          presetConfig: resolveTimingPresetConfig(preset?.config),
          watchlist: {
            id: watchList.id,
            name: watchList.name,
            stockCount: watchList.stocks.length,
          },
          portfolioSnapshot,
          targets: watchList.stocks.map((stock) => ({
            stockCode: stock.stockCode.value,
            stockName: stock.stockName,
          })),
        };
      },
      fetch_signal_snapshots_batch: async (state) => {
        if (state.targets.length === 0) {
          return {
            signalSnapshots: [],
            batchErrors: [],
          };
        }

        const response = await this.deps.timingDataClient.getSignalsBatch({
          stockCodes: state.targets.map((target) => target.stockCode),
          asOfDate: state.timingInput.asOfDate,
        });

        if (response.items.length === 0 && response.errors.length > 0) {
          throw new Error(
            response.errors.map((error) => error.message).join(", "),
          );
        }

        return {
          signalSnapshots: response.items,
          batchErrors: response.errors,
        };
      },
      technical_signal_agent: async (state) => ({
        technicalAssessments:
          this.deps.analysisService.buildTechnicalAssessments(
            state.signalSnapshots,
            state.presetConfig,
          ),
      }),
      timing_synthesis_agent: async (state) => ({
        cards: this.deps.analysisService.buildCards({
          userId: state.userId,
          workflowRunId: state.runId,
          sourceType: "watchlist",
          sourceId: state.timingInput.watchListId,
          watchListId: state.timingInput.watchListId,
          presetId: state.preset?.id,
          presetConfig: state.presetConfig,
          signalSnapshots: state.signalSnapshots,
          technicalAssessments: state.technicalAssessments,
          hasPortfolioContext: true,
        }),
      }),
      market_regime_agent: async (state) => {
        const marketRegimeSnapshot =
          await this.deps.timingDataClient.getMarketRegimeSnapshot({
            asOfDate: state.timingInput.asOfDate,
          });

        return {
          marketRegimeSnapshot,
          marketRegimeAnalysis:
            this.deps.marketRegimeService.analyze(marketRegimeSnapshot),
        };
      },
      watchlist_risk_manager: async (state) => {
        if (!state.portfolioSnapshot || !state.marketRegimeAnalysis) {
          throw new Error("Portfolio snapshot or market regime missing");
        }

        return {
          riskPlan: this.deps.riskManagerService.buildRiskPlan({
            portfolioSnapshot: state.portfolioSnapshot,
            timingCards: state.cards,
            marketRegimeAnalysis: state.marketRegimeAnalysis,
          }),
        };
      },
      watchlist_portfolio_manager: async (state) => {
        if (
          !state.watchlist ||
          !state.portfolioSnapshot ||
          !state.marketRegimeAnalysis ||
          !state.riskPlan
        ) {
          throw new Error("Recommendation inputs are incomplete");
        }

        return {
          recommendations: this.deps.portfolioManagerService
            .buildRecommendations({
              userId: state.userId,
              workflowRunId: state.runId,
              watchListId: state.watchlist.id,
              portfolioSnapshot: state.portfolioSnapshot,
              timingCards: state.cards,
              riskPlan: state.riskPlan,
              marketRegimeAnalysis: state.marketRegimeAnalysis,
            })
            .map((recommendation) => ({
              ...recommendation,
              presetId: state.preset?.id,
            })),
        };
      },
      persist_recommendations: async (state) => {
        const persistedRecommendations =
          await this.deps.recommendationRepository.createMany({
            items: state.recommendations,
          });
        const reviewArtifacts =
          await this.deps.reviewSchedulingService.scheduleForRecommendations({
            recommendations: persistedRecommendations,
            sourceAsOfDateByStockCode: new Map(
              state.signalSnapshots.map((snapshot) => [
                snapshot.stockCode,
                snapshot.asOfDate,
              ]),
            ),
            presetConfig: state.presetConfig,
          });

        return {
          persistedRecommendations,
          reviewRecords: reviewArtifacts.records,
          scheduledReminderIds: reviewArtifacts.reminderIds,
        };
      },
    };
  }

  getNodeOrder() {
    return [...WATCHLIST_TIMING_PIPELINE_NODE_KEYS];
  }

  buildInitialState(
    params: WorkflowGraphBuildInitialStateParams,
  ): WatchlistTimingPipelineGraphState {
    return {
      runId: params.runId,
      userId: params.userId,
      query: params.query,
      progressPercent: params.progressPercent,
      currentNodeKey: undefined,
      lastCompletedNodeKey: undefined,
      timingInput: params.input as WatchlistTimingPipelineInput,
      preset: undefined,
      presetConfig: undefined,
      watchlist: undefined,
      portfolioSnapshot: undefined,
      targets: [],
      signalSnapshots: [],
      technicalAssessments: [],
      cards: [],
      marketRegimeSnapshot: undefined,
      marketRegimeAnalysis: undefined,
      riskPlan: undefined,
      recommendations: [],
      persistedRecommendations: [],
      reviewRecords: [],
      scheduledReminderIds: [],
      batchErrors: [],
      errors: [],
    };
  }

  getNodeOutput(nodeKey: WorkflowNodeKey, state: WorkflowGraphState) {
    const timingState = state as WatchlistTimingPipelineGraphState;

    switch (nodeKey) {
      case "load_watchlist_context":
        return {
          watchlist: timingState.watchlist,
          portfolioSnapshot: timingState.portfolioSnapshot,
          targets: timingState.targets,
        };
      case "fetch_signal_snapshots_batch":
        return {
          signalSnapshots: timingState.signalSnapshots,
          batchErrors: timingState.batchErrors,
        };
      case "technical_signal_agent":
        return { technicalAssessments: timingState.technicalAssessments };
      case "timing_synthesis_agent":
        return { cards: timingState.cards };
      case "market_regime_agent":
        return {
          marketRegimeSnapshot: timingState.marketRegimeSnapshot,
          marketRegimeAnalysis: timingState.marketRegimeAnalysis,
        };
      case "watchlist_risk_manager":
        return { riskPlan: timingState.riskPlan };
      case "watchlist_portfolio_manager":
        return { recommendations: timingState.recommendations };
      default:
        return {
          persistedRecommendations: timingState.persistedRecommendations,
        };
    }
  }

  getNodeEventPayload(nodeKey: WorkflowNodeKey, state: WorkflowGraphState) {
    const timingState = state as WatchlistTimingPipelineGraphState;

    if (nodeKey === "fetch_signal_snapshots_batch") {
      return {
        signalSnapshotCount: timingState.signalSnapshots.length,
        batchErrorCount: timingState.batchErrors.length,
      };
    }

    if (nodeKey === "watchlist_portfolio_manager") {
      return {
        recommendationCount: timingState.recommendations.length,
      };
    }

    if (nodeKey === "persist_recommendations") {
      return {
        persistedRecommendationCount:
          timingState.persistedRecommendations.length,
        reviewRecordCount: timingState.reviewRecords.length,
        reminderCount: timingState.scheduledReminderIds.length,
      };
    }

    return {};
  }

  mergeNodeOutput(
    state: WorkflowGraphState,
    nodeKey: WorkflowNodeKey,
    output: Record<string, unknown>,
  ) {
    return {
      ...state,
      ...output,
      currentNodeKey: nodeKey,
      lastCompletedNodeKey: nodeKey,
    };
  }

  getRunResult(state: WorkflowGraphState): Record<string, unknown> {
    const timingState = state as WatchlistTimingPipelineGraphState;

    return {
      recommendationIds: timingState.persistedRecommendations.map(
        (recommendation) => recommendation.id,
      ),
      recommendationCount: timingState.persistedRecommendations.length,
      partialErrors: timingState.batchErrors,
      marketRegime: timingState.marketRegimeAnalysis?.marketRegime,
      riskPlan: timingState.riskPlan,
      reviewRecordIds: timingState.reviewRecords.map((record) => record.id),
      reminderIds: timingState.scheduledReminderIds,
    };
  }

  async execute(params: {
    initialState: WorkflowGraphState;
    startNodeIndex?: number;
    hooks?: WorkflowGraphExecutionHooks;
  }) {
    let state = {
      ...(params.initialState as WatchlistTimingPipelineGraphState),
      errors: (params.initialState.errors ?? []) as string[],
    };

    const startIndex = params.startNodeIndex ?? 0;

    for (
      let index = startIndex;
      index < WATCHLIST_TIMING_PIPELINE_NODE_KEYS.length;
      index += 1
    ) {
      const nodeKey = WATCHLIST_TIMING_PIPELINE_NODE_KEYS[index];

      if (!nodeKey) {
        continue;
      }

      const nodeGraph = this.buildSingleNodeGraph(nodeKey);

      await params.hooks?.onNodeStarted?.(nodeKey);
      await params.hooks?.onNodeProgress?.(nodeKey, {
        message: "Node executing",
      });

      state = {
        ...state,
        currentNodeKey: nodeKey,
      };

      const result = (await nodeGraph.invoke(
        state,
      )) as typeof WorkflowState.State;
      const progressPercent = Math.round(
        ((index + 1) / WATCHLIST_TIMING_PIPELINE_NODE_KEYS.length) * 100,
      );

      state = {
        ...(result as WatchlistTimingPipelineGraphState),
        currentNodeKey: nodeKey,
        progressPercent,
      };

      await params.hooks?.onNodeSucceeded?.(nodeKey, state);
    }

    return state;
  }

  private buildSingleNodeGraph(nodeKey: WatchlistTimingPipelineNodeKey) {
    return new StateGraph(WorkflowState)
      .addNode(nodeKey, (state) =>
        this.nodeExecutors[nodeKey](state as WatchlistTimingPipelineGraphState),
      )
      .addEdge(START, nodeKey)
      .addEdge(nodeKey, END)
      .compile();
  }
}
