import { Annotation, END, START, StateGraph } from "@langchain/langgraph";
import type { TimingAnalysisService } from "~/server/application/timing/timing-analysis-service";
import type {
  WatchlistTimingCardsPipelineGraphState,
  WatchlistTimingCardsPipelineInput,
  WatchlistTimingCardsPipelineNodeKey,
  WorkflowGraphState,
  WorkflowNodeKey,
} from "~/server/domain/workflow/types";
import {
  WATCHLIST_TIMING_CARDS_PIPELINE_NODE_KEYS,
  WATCHLIST_TIMING_CARDS_PIPELINE_TEMPLATE_CODE,
} from "~/server/domain/workflow/types";
import type { PrismaWatchListRepository } from "~/server/infrastructure/screening/prisma-watch-list-repository";
import type { PrismaTimingAnalysisCardRepository } from "~/server/infrastructure/timing/prisma-timing-analysis-card-repository";
import type { PrismaTimingSignalSnapshotRepository } from "~/server/infrastructure/timing/prisma-timing-signal-snapshot-repository";
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
  currentNodeKey: Annotation<WatchlistTimingCardsPipelineNodeKey | undefined>,
  timingInput: Annotation<WatchlistTimingCardsPipelineInput>,
  watchlist: Annotation<WatchlistTimingCardsPipelineGraphState["watchlist"]>,
  targets: Annotation<WatchlistTimingCardsPipelineGraphState["targets"]>,
  signalSnapshots: Annotation<
    WatchlistTimingCardsPipelineGraphState["signalSnapshots"]
  >,
  technicalAssessments: Annotation<
    WatchlistTimingCardsPipelineGraphState["technicalAssessments"]
  >,
  cards: Annotation<WatchlistTimingCardsPipelineGraphState["cards"]>,
  persistedSignalSnapshots: Annotation<
    WatchlistTimingCardsPipelineGraphState["persistedSignalSnapshots"]
  >,
  persistedCards: Annotation<
    WatchlistTimingCardsPipelineGraphState["persistedCards"]
  >,
  batchErrors: Annotation<
    WatchlistTimingCardsPipelineGraphState["batchErrors"]
  >,
  errors: Annotation<string[]>({
    reducer: (left, right) => left.concat(right),
    default: () => [],
  }),
});

type NodeExecutor = (
  state: WatchlistTimingCardsPipelineGraphState,
) => Promise<Partial<WatchlistTimingCardsPipelineGraphState>>;

export class WatchlistTimingCardsPipelineLangGraph
  implements WorkflowGraphRunner
{
  readonly templateCode = WATCHLIST_TIMING_CARDS_PIPELINE_TEMPLATE_CODE;

  private readonly nodeExecutors: Record<
    WatchlistTimingCardsPipelineNodeKey,
    NodeExecutor
  >;

  constructor(
    private readonly deps: {
      watchListRepository: PrismaWatchListRepository;
      timingDataClient: PythonTimingDataClient;
      analysisService: TimingAnalysisService;
      signalSnapshotRepository: PrismaTimingSignalSnapshotRepository;
      analysisCardRepository: PrismaTimingAnalysisCardRepository;
    },
  ) {
    this.nodeExecutors = {
      load_watchlist_context: async (state) => {
        const watchList = await this.deps.watchListRepository.findById(
          state.timingInput.watchListId,
        );

        if (!watchList || watchList.userId !== state.userId) {
          throw new Error("自选股列表不存在或无权访问");
        }

        return {
          watchlist: {
            id: watchList.id,
            name: watchList.name,
            stockCount: watchList.stocks.length,
          },
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
            response.errors.map((error) => error.message).join("；"),
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
          ),
      }),
      timing_synthesis_agent: async (state) => ({
        cards: this.deps.analysisService.buildCards({
          userId: state.userId,
          workflowRunId: state.runId,
          sourceType: "watchlist",
          sourceId: state.timingInput.watchListId,
          watchListId: state.timingInput.watchListId,
          signalSnapshots: state.signalSnapshots,
          technicalAssessments: state.technicalAssessments,
        }),
      }),
      persist_cards: async (state) => {
        const persistedSignalSnapshots =
          await this.deps.signalSnapshotRepository.createMany({
            userId: state.userId,
            workflowRunId: state.runId,
            sourceType: "watchlist",
            sourceId: state.timingInput.watchListId,
            items: state.signalSnapshots,
          });

        const snapshotByCode = new Map(
          persistedSignalSnapshots.map((snapshot) => [
            snapshot.stockCode,
            snapshot.id,
          ]),
        );

        const persistedCards =
          await this.deps.analysisCardRepository.createMany({
            items: state.cards.map((card) => ({
              ...card,
              signalSnapshotId: snapshotByCode.get(card.stockCode) ?? "",
            })),
          });

        return {
          persistedSignalSnapshots,
          persistedCards,
        };
      },
    };
  }

  getNodeOrder() {
    return [...WATCHLIST_TIMING_CARDS_PIPELINE_NODE_KEYS];
  }

  buildInitialState(
    params: WorkflowGraphBuildInitialStateParams,
  ): WatchlistTimingCardsPipelineGraphState {
    return {
      runId: params.runId,
      userId: params.userId,
      query: params.query,
      progressPercent: params.progressPercent,
      currentNodeKey: undefined,
      lastCompletedNodeKey: undefined,
      timingInput: params.input as WatchlistTimingCardsPipelineInput,
      watchlist: undefined,
      targets: [],
      signalSnapshots: [],
      technicalAssessments: [],
      cards: [],
      persistedSignalSnapshots: [],
      persistedCards: [],
      batchErrors: [],
      errors: [],
    };
  }

  getNodeOutput(nodeKey: WorkflowNodeKey, state: WorkflowGraphState) {
    const timingState = state as WatchlistTimingCardsPipelineGraphState;

    switch (nodeKey) {
      case "load_watchlist_context":
        return {
          watchlist: timingState.watchlist,
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
      default:
        return {
          persistedSignalSnapshots: timingState.persistedSignalSnapshots,
          persistedCards: timingState.persistedCards,
        };
    }
  }

  getNodeEventPayload(nodeKey: WorkflowNodeKey, state: WorkflowGraphState) {
    const timingState = state as WatchlistTimingCardsPipelineGraphState;

    if (nodeKey === "fetch_signal_snapshots_batch") {
      return {
        signalSnapshotCount: timingState.signalSnapshots.length,
        batchErrorCount: timingState.batchErrors.length,
      };
    }

    if (nodeKey === "persist_cards") {
      return {
        cardCount: timingState.persistedCards.length,
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
    const timingState = state as WatchlistTimingCardsPipelineGraphState;

    return {
      signalSnapshotIds: timingState.persistedSignalSnapshots.map(
        (snapshot) => snapshot.id,
      ),
      cardIds: timingState.persistedCards.map((card) => card.id),
      stockCount: timingState.persistedCards.length,
      partialErrors: timingState.batchErrors,
    };
  }

  async execute(params: {
    initialState: WorkflowGraphState;
    startNodeIndex?: number;
    hooks?: WorkflowGraphExecutionHooks;
  }) {
    let state = {
      ...(params.initialState as WatchlistTimingCardsPipelineGraphState),
      errors: (params.initialState.errors ?? []) as string[],
    };

    const startIndex = params.startNodeIndex ?? 0;

    for (
      let index = startIndex;
      index < WATCHLIST_TIMING_CARDS_PIPELINE_NODE_KEYS.length;
      index += 1
    ) {
      const nodeKey = WATCHLIST_TIMING_CARDS_PIPELINE_NODE_KEYS[index];

      if (!nodeKey) {
        continue;
      }

      const nodeGraph = this.buildSingleNodeGraph(nodeKey);

      await params.hooks?.onNodeStarted?.(nodeKey);
      await params.hooks?.onNodeProgress?.(nodeKey, {
        message: "节点执行中",
      });

      state = {
        ...state,
        currentNodeKey: nodeKey,
      };

      const result = (await nodeGraph.invoke(
        state,
      )) as typeof WorkflowState.State;
      const progressPercent = Math.round(
        ((index + 1) / WATCHLIST_TIMING_CARDS_PIPELINE_NODE_KEYS.length) * 100,
      );

      state = {
        ...(result as WatchlistTimingCardsPipelineGraphState),
        currentNodeKey: nodeKey,
        progressPercent,
      };

      await params.hooks?.onNodeSucceeded?.(nodeKey, state);
    }

    return state;
  }

  private buildSingleNodeGraph(nodeKey: WatchlistTimingCardsPipelineNodeKey) {
    return new StateGraph(WorkflowState)
      .addNode(nodeKey, (state) =>
        this.nodeExecutors[nodeKey](
          state as WatchlistTimingCardsPipelineGraphState,
        ),
      )
      .addEdge(START, nodeKey)
      .addEdge(nodeKey, END)
      .compile();
  }
}
