import { Annotation, END, START, StateGraph } from "@langchain/langgraph";
import type { TimingAnalysisService } from "~/server/application/timing/timing-analysis-service";
import type {
  TimingSignalPipelineGraphState,
  TimingSignalPipelineInput,
  TimingSignalPipelineNodeKey,
  WorkflowGraphState,
  WorkflowNodeKey,
} from "~/server/domain/workflow/types";
import {
  TIMING_SIGNAL_PIPELINE_NODE_KEYS,
  TIMING_SIGNAL_PIPELINE_TEMPLATE_CODE,
} from "~/server/domain/workflow/types";
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
  currentNodeKey: Annotation<TimingSignalPipelineNodeKey | undefined>,
  timingInput: Annotation<TimingSignalPipelineInput>,
  targets: Annotation<TimingSignalPipelineGraphState["targets"]>,
  signalSnapshots: Annotation<
    TimingSignalPipelineGraphState["signalSnapshots"]
  >,
  technicalAssessments: Annotation<
    TimingSignalPipelineGraphState["technicalAssessments"]
  >,
  cards: Annotation<TimingSignalPipelineGraphState["cards"]>,
  persistedSignalSnapshots: Annotation<
    TimingSignalPipelineGraphState["persistedSignalSnapshots"]
  >,
  persistedCards: Annotation<TimingSignalPipelineGraphState["persistedCards"]>,
  batchErrors: Annotation<TimingSignalPipelineGraphState["batchErrors"]>,
  errors: Annotation<string[]>({
    reducer: (left, right) => left.concat(right),
    default: () => [],
  }),
});

type NodeExecutor = (
  state: TimingSignalPipelineGraphState,
) => Promise<Partial<TimingSignalPipelineGraphState>>;

export class TimingSignalPipelineLangGraph implements WorkflowGraphRunner {
  readonly templateCode = TIMING_SIGNAL_PIPELINE_TEMPLATE_CODE;

  private readonly nodeExecutors: Record<
    TimingSignalPipelineNodeKey,
    NodeExecutor
  >;

  constructor(
    private readonly deps: {
      timingDataClient: PythonTimingDataClient;
      analysisService: TimingAnalysisService;
      signalSnapshotRepository: PrismaTimingSignalSnapshotRepository;
      analysisCardRepository: PrismaTimingAnalysisCardRepository;
    },
  ) {
    this.nodeExecutors = {
      load_targets: async (state) => ({
        targets: [
          {
            stockCode: state.timingInput.stockCode,
          },
        ],
      }),
      fetch_signal_snapshots: async (state) => {
        const snapshot = await this.deps.timingDataClient.getSignal({
          stockCode: state.timingInput.stockCode,
          asOfDate: state.timingInput.asOfDate,
        });

        return {
          signalSnapshots: [snapshot],
          batchErrors: [],
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
          sourceType: "single",
          sourceId: state.timingInput.stockCode,
          signalSnapshots: state.signalSnapshots,
          technicalAssessments: state.technicalAssessments,
        }),
      }),
      persist_cards: async (state) => {
        const persistedSignalSnapshots =
          await this.deps.signalSnapshotRepository.createMany({
            userId: state.userId,
            workflowRunId: state.runId,
            sourceType: "single",
            sourceId: state.timingInput.stockCode,
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
    return [...TIMING_SIGNAL_PIPELINE_NODE_KEYS];
  }

  buildInitialState(
    params: WorkflowGraphBuildInitialStateParams,
  ): TimingSignalPipelineGraphState {
    return {
      runId: params.runId,
      userId: params.userId,
      query: params.query,
      progressPercent: params.progressPercent,
      currentNodeKey: undefined,
      lastCompletedNodeKey: undefined,
      timingInput: params.input as TimingSignalPipelineInput,
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
    const timingState = state as TimingSignalPipelineGraphState;

    switch (nodeKey) {
      case "load_targets":
        return { targets: timingState.targets };
      case "fetch_signal_snapshots":
        return { signalSnapshots: timingState.signalSnapshots };
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
    const timingState = state as TimingSignalPipelineGraphState;

    if (nodeKey === "fetch_signal_snapshots") {
      return {
        signalSnapshotCount: timingState.signalSnapshots.length,
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
    const timingState = state as TimingSignalPipelineGraphState;

    return {
      signalSnapshotIds: timingState.persistedSignalSnapshots.map(
        (snapshot) => snapshot.id,
      ),
      cardIds: timingState.persistedCards.map((card) => card.id),
      stockCount: timingState.persistedCards.length,
    };
  }

  async execute(params: {
    initialState: WorkflowGraphState;
    startNodeIndex?: number;
    hooks?: WorkflowGraphExecutionHooks;
  }) {
    let state = {
      ...(params.initialState as TimingSignalPipelineGraphState),
      errors: (params.initialState.errors ?? []) as string[],
    };

    const startIndex = params.startNodeIndex ?? 0;

    for (
      let index = startIndex;
      index < TIMING_SIGNAL_PIPELINE_NODE_KEYS.length;
      index += 1
    ) {
      const nodeKey = TIMING_SIGNAL_PIPELINE_NODE_KEYS[index];

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
        ((index + 1) / TIMING_SIGNAL_PIPELINE_NODE_KEYS.length) * 100,
      );

      state = {
        ...(result as TimingSignalPipelineGraphState),
        currentNodeKey: nodeKey,
        progressPercent,
      };

      await params.hooks?.onNodeSucceeded?.(nodeKey, state);
    }

    return state;
  }

  private buildSingleNodeGraph(nodeKey: TimingSignalPipelineNodeKey) {
    return new StateGraph(WorkflowState)
      .addNode(nodeKey, (state) =>
        this.nodeExecutors[nodeKey](state as TimingSignalPipelineGraphState),
      )
      .addEdge(START, nodeKey)
      .addEdge(nodeKey, END)
      .compile();
  }
}
