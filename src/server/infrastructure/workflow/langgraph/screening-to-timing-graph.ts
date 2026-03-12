import { Annotation, StateGraph } from "@langchain/langgraph";
import type { TimingAnalysisService } from "~/server/application/timing/timing-analysis-service";
import type { TimingReviewSchedulingService } from "~/server/application/timing/timing-review-scheduling-service";
import { ScreeningSessionStatus } from "~/server/domain/screening/enums/screening-session-status";
import type { IScreeningSessionRepository } from "~/server/domain/screening/repositories/screening-session-repository";
import { resolveTimingPresetConfig } from "~/server/domain/timing/preset";
import type {
  ScreeningToTimingGraphState,
  ScreeningToTimingNodeKey,
  ScreeningToTimingPipelineInput,
  WorkflowGraphState,
  WorkflowNodeKey,
} from "~/server/domain/workflow/types";
import {
  SCREENING_TO_TIMING_NODE_KEYS,
  SCREENING_TO_TIMING_TEMPLATE_CODE,
} from "~/server/domain/workflow/types";
import type { PrismaTimingAnalysisCardRepository } from "~/server/infrastructure/timing/prisma-timing-analysis-card-repository";
import type { PrismaTimingPresetRepository } from "~/server/infrastructure/timing/prisma-timing-preset-repository";
import type { PrismaTimingSignalSnapshotRepository } from "~/server/infrastructure/timing/prisma-timing-signal-snapshot-repository";
import type { PythonTimingDataClient } from "~/server/infrastructure/timing/python-timing-data-client";
import type { WorkflowGraphBuildInitialStateParams } from "~/server/infrastructure/workflow/langgraph/workflow-graph";
import { BaseWorkflowLangGraph } from "~/server/infrastructure/workflow/langgraph/workflow-graph-base";
import {
  addResumeStart,
  addSequentialEdges,
  addWorkflowNodes,
} from "~/server/infrastructure/workflow/langgraph/workflow-graph-builder";

const WorkflowState = Annotation.Root({
  runId: Annotation<string>,
  userId: Annotation<string>,
  query: Annotation<string>,
  progressPercent: Annotation<number>,
  resumeFromNodeKey: Annotation<WorkflowNodeKey | undefined>,
  currentNodeKey: Annotation<ScreeningToTimingNodeKey | undefined>,
  timingInput: Annotation<ScreeningToTimingPipelineInput>,
  screeningSession: Annotation<ScreeningToTimingGraphState["screeningSession"]>,
  preset: Annotation<ScreeningToTimingGraphState["preset"]>,
  presetConfig: Annotation<ScreeningToTimingGraphState["presetConfig"]>,
  targets: Annotation<ScreeningToTimingGraphState["targets"]>,
  selectedTargets: Annotation<ScreeningToTimingGraphState["selectedTargets"]>,
  signalSnapshots: Annotation<ScreeningToTimingGraphState["signalSnapshots"]>,
  technicalAssessments: Annotation<
    ScreeningToTimingGraphState["technicalAssessments"]
  >,
  cards: Annotation<ScreeningToTimingGraphState["cards"]>,
  persistedSignalSnapshots: Annotation<
    ScreeningToTimingGraphState["persistedSignalSnapshots"]
  >,
  persistedCards: Annotation<ScreeningToTimingGraphState["persistedCards"]>,
  reviewRecords: Annotation<ScreeningToTimingGraphState["reviewRecords"]>,
  scheduledReminderIds: Annotation<
    ScreeningToTimingGraphState["scheduledReminderIds"]
  >,
  batchErrors: Annotation<ScreeningToTimingGraphState["batchErrors"]>,
  errors: Annotation<string[]>({
    reducer: (left, right) => left.concat(right),
    default: () => [],
  }),
});

type NodeExecutor = (
  state: ScreeningToTimingGraphState,
) => Promise<Partial<ScreeningToTimingGraphState>>;

export class ScreeningToTimingPipelineLangGraph extends BaseWorkflowLangGraph<
  ScreeningToTimingGraphState,
  ScreeningToTimingNodeKey
> {
  readonly templateCode = SCREENING_TO_TIMING_TEMPLATE_CODE;

  constructor(deps: {
    screeningSessionRepository: IScreeningSessionRepository;
    presetRepository: PrismaTimingPresetRepository;
    timingDataClient: PythonTimingDataClient;
    analysisService: TimingAnalysisService;
    signalSnapshotRepository: PrismaTimingSignalSnapshotRepository;
    analysisCardRepository: PrismaTimingAnalysisCardRepository;
    reviewSchedulingService: TimingReviewSchedulingService;
  }) {
    const nodeExecutors: Record<ScreeningToTimingNodeKey, NodeExecutor> = {
      load_screening_results: async (state) => {
        const [session, preset] = await Promise.all([
          deps.screeningSessionRepository.findById(
            state.timingInput.screeningSessionId,
          ),
          state.timingInput.presetId
            ? deps.presetRepository.getByIdForUser(
                state.userId,
                state.timingInput.presetId,
              )
            : Promise.resolve(null),
        ]);

        if (!session || session.userId !== state.userId) {
          throw new Error("Screening session not found or access denied");
        }

        if (session.status !== ScreeningSessionStatus.SUCCEEDED) {
          throw new Error(
            "Screening session must finish before timing linkage",
          );
        }

        return {
          screeningSession: {
            id: session.id,
            strategyName: session.strategyName,
            executedAt: session.executedAt.toISOString(),
            completedAt: session.completedAt?.toISOString(),
            matchedCount: session.countMatched(),
          },
          preset: preset ?? undefined,
          presetConfig: resolveTimingPresetConfig(preset?.config),
          targets: session.topStocks.map((stock) => ({
            stockCode: stock.stockCode.value,
            stockName: stock.stockName,
          })),
        };
      },
      select_top_candidates: async (state) => ({
        selectedTargets: state.targets.slice(
          0,
          state.timingInput.candidateLimit ?? 20,
        ),
      }),
      run_timing_pipeline: async (state) => {
        if (state.selectedTargets.length === 0) {
          return {
            signalSnapshots: [],
            technicalAssessments: [],
            cards: [],
            persistedSignalSnapshots: [],
            persistedCards: [],
            reviewRecords: [],
            scheduledReminderIds: [],
            batchErrors: [],
          };
        }

        const response = await deps.timingDataClient.getSignalsBatch({
          stockCodes: state.selectedTargets.map((target) => target.stockCode),
          asOfDate: state.timingInput.asOfDate,
        });

        if (response.items.length === 0 && response.errors.length > 0) {
          throw new Error(
            response.errors.map((error) => error.message).join(", "),
          );
        }

        const technicalAssessments =
          deps.analysisService.buildTechnicalAssessments(
            response.items,
            state.presetConfig,
          );
        const cards = deps.analysisService.buildCards({
          userId: state.userId,
          workflowRunId: state.runId,
          sourceType: "screening",
          sourceId: state.timingInput.screeningSessionId,
          presetId: state.preset?.id,
          presetConfig: state.presetConfig,
          signalSnapshots: response.items,
          technicalAssessments,
        });
        const persistedSignalSnapshots =
          await deps.signalSnapshotRepository.createMany({
            userId: state.userId,
            workflowRunId: state.runId,
            sourceType: "screening",
            sourceId: state.timingInput.screeningSessionId,
            items: response.items,
          });
        const snapshotByCode = new Map(
          persistedSignalSnapshots.map((snapshot) => [
            snapshot.stockCode,
            snapshot.id,
          ]),
        );
        const persistedCards = await deps.analysisCardRepository.createMany({
          items: cards.map((card) => ({
            ...card,
            signalSnapshotId: snapshotByCode.get(card.stockCode) ?? "",
          })),
        });
        const reviewArtifacts =
          await deps.reviewSchedulingService.scheduleForCards({
            cards: persistedCards,
            presetConfig: state.presetConfig,
          });

        return {
          signalSnapshots: response.items,
          technicalAssessments,
          cards,
          persistedSignalSnapshots,
          persistedCards,
          reviewRecords: reviewArtifacts.records,
          scheduledReminderIds: reviewArtifacts.reminderIds,
          batchErrors: response.errors,
        };
      },
      archive_results: async () => ({}),
    };

    const graphBuilder = new StateGraph(WorkflowState) as StateGraph<
      unknown,
      ScreeningToTimingGraphState,
      Partial<ScreeningToTimingGraphState>,
      string
    >;
    addWorkflowNodes(
      graphBuilder,
      SCREENING_TO_TIMING_NODE_KEYS,
      nodeExecutors,
    );
    addResumeStart(graphBuilder, SCREENING_TO_TIMING_NODE_KEYS);
    addSequentialEdges(graphBuilder, SCREENING_TO_TIMING_NODE_KEYS);

    super({
      graph: graphBuilder.compile(),
      nodeOrder: SCREENING_TO_TIMING_NODE_KEYS,
    });
  }

  buildInitialState(
    params: WorkflowGraphBuildInitialStateParams,
  ): ScreeningToTimingGraphState {
    return {
      runId: params.runId,
      userId: params.userId,
      query: params.query,
      progressPercent: params.progressPercent,
      resumeFromNodeKey: undefined,
      currentNodeKey: undefined,
      lastCompletedNodeKey: undefined,
      timingInput: params.input as ScreeningToTimingPipelineInput,
      screeningSession: undefined,
      preset: undefined,
      presetConfig: undefined,
      targets: [],
      selectedTargets: [],
      signalSnapshots: [],
      technicalAssessments: [],
      cards: [],
      persistedSignalSnapshots: [],
      persistedCards: [],
      reviewRecords: [],
      scheduledReminderIds: [],
      batchErrors: [],
      errors: [],
    };
  }

  getNodeOutput(nodeKey: WorkflowNodeKey, state: WorkflowGraphState) {
    const timingState = state as ScreeningToTimingGraphState;

    switch (nodeKey) {
      case "load_screening_results":
        return {
          screeningSession: timingState.screeningSession,
          targets: timingState.targets,
        };
      case "select_top_candidates":
        return { selectedTargets: timingState.selectedTargets };
      case "run_timing_pipeline":
        return {
          persistedSignalSnapshots: timingState.persistedSignalSnapshots,
          persistedCards: timingState.persistedCards,
          reviewRecords: timingState.reviewRecords,
          scheduledReminderIds: timingState.scheduledReminderIds,
          batchErrors: timingState.batchErrors,
        };
      default:
        return {
          cardCount: timingState.persistedCards.length,
        };
    }
  }

  getNodeEventPayload(nodeKey: WorkflowNodeKey, state: WorkflowGraphState) {
    const timingState = state as ScreeningToTimingGraphState;

    if (nodeKey === "select_top_candidates") {
      return {
        selectedCount: timingState.selectedTargets.length,
      };
    }

    if (nodeKey === "run_timing_pipeline") {
      return {
        cardCount: timingState.persistedCards.length,
        reviewRecordCount: timingState.reviewRecords.length,
        reminderCount: timingState.scheduledReminderIds.length,
        batchErrorCount: timingState.batchErrors.length,
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
    const timingState = state as ScreeningToTimingGraphState;

    return {
      screeningSessionId: timingState.timingInput.screeningSessionId,
      signalSnapshotIds: timingState.persistedSignalSnapshots.map(
        (snapshot) => snapshot.id,
      ),
      cardIds: timingState.persistedCards.map((card) => card.id),
      reviewRecordIds: timingState.reviewRecords.map((record) => record.id),
      reminderIds: timingState.scheduledReminderIds,
      partialErrors: timingState.batchErrors,
    };
  }
}
