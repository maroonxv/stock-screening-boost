import { Annotation, StateGraph } from "@langchain/langgraph";
import type { TimingReviewPolicy } from "~/server/domain/timing/services/timing-review-policy";
import type {
  TimingReviewLoopGraphState,
  TimingReviewLoopInput,
  TimingReviewLoopNodeKey,
  WorkflowGraphState,
  WorkflowNodeKey,
} from "~/server/domain/workflow/types";
import {
  TIMING_REVIEW_LOOP_NODE_KEYS,
  TIMING_REVIEW_LOOP_TEMPLATE_CODE,
} from "~/server/domain/workflow/types";
import type { PrismaResearchReminderRepository } from "~/server/infrastructure/intelligence/prisma-research-reminder-repository";
import type { PrismaTimingReviewRecordRepository } from "~/server/infrastructure/timing/prisma-timing-review-record-repository";
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
  currentNodeKey: Annotation<TimingReviewLoopNodeKey | undefined>,
  timingInput: Annotation<TimingReviewLoopInput>,
  dueReviews: Annotation<TimingReviewLoopGraphState["dueReviews"]>,
  evaluatedReviews: Annotation<TimingReviewLoopGraphState["evaluatedReviews"]>,
  persistedReviews: Annotation<TimingReviewLoopGraphState["persistedReviews"]>,
  consumedReminderIds: Annotation<
    TimingReviewLoopGraphState["consumedReminderIds"]
  >,
  errors: Annotation<string[]>({
    reducer: (left, right) => left.concat(right),
    default: () => [],
  }),
});

type NodeExecutor = (
  state: TimingReviewLoopGraphState,
) => Promise<Partial<TimingReviewLoopGraphState>>;

export class TimingReviewLoopLangGraph extends BaseWorkflowLangGraph<
  TimingReviewLoopGraphState,
  TimingReviewLoopNodeKey
> {
  readonly templateCode = TIMING_REVIEW_LOOP_TEMPLATE_CODE;

  constructor(deps: {
    timingDataClient: PythonTimingDataClient;
    reviewRecordRepository: PrismaTimingReviewRecordRepository;
    reminderRepository: PrismaResearchReminderRepository;
    reviewPolicy: TimingReviewPolicy;
  }) {
    const nodeExecutors: Record<TimingReviewLoopNodeKey, NodeExecutor> = {
      load_due_reviews: async (state) => {
        const targetDate = state.timingInput.date
          ? new Date(`${state.timingInput.date}T23:59:59.999Z`)
          : new Date();

        return {
          dueReviews: await deps.reviewRecordRepository.listDuePending({
            userId: state.userId,
            targetDate,
            limit: state.timingInput.limit ?? 100,
          }),
        };
      },
      evaluate_outcomes: async (state) => {
        const targetDate = state.timingInput.date
          ? new Date(`${state.timingInput.date}T23:59:59.999Z`)
          : new Date();
        const targetDateText = targetDate.toISOString().slice(0, 10);

        const evaluatedReviews = [];

        for (const review of state.dueReviews) {
          const bars = await deps.timingDataClient.getBars({
            stockCode: review.stockCode,
            start: review.sourceAsOfDate,
            end: targetDateText,
          });

          const completion = deps.reviewPolicy.evaluate({
            reviewRecord: review,
            bars: bars.bars.map((bar) => ({
              close: bar.close,
              high: bar.high,
              low: bar.low,
            })),
            completedAt: targetDate,
          });

          evaluatedReviews.push({
            ...completion,
            stockCode: review.stockCode,
            reviewHorizon: review.reviewHorizon,
            expectedAction: review.expectedAction,
          });
        }

        return { evaluatedReviews };
      },
      review_agent: async (state) => ({
        evaluatedReviews: state.evaluatedReviews,
      }),
      persist_reviews: async (state) => ({
        persistedReviews: await deps.reviewRecordRepository.completeMany({
          items: state.evaluatedReviews,
        }),
      }),
      schedule_next_review: async (state) => {
        const consumedReminderIds: string[] = [];

        for (const review of state.persistedReviews) {
          const reminders =
            await deps.reminderRepository.findByTimingReviewRecordId(review.id);

          for (const reminder of reminders) {
            if (reminder.status !== "PENDING") {
              continue;
            }

            reminder.markTriggered(review.completedAt ?? new Date());
            await deps.reminderRepository.save(reminder);
            consumedReminderIds.push(reminder.id);
          }
        }

        return { consumedReminderIds };
      },
    };

    const graphBuilder = new StateGraph(WorkflowState) as StateGraph<
      unknown,
      TimingReviewLoopGraphState,
      Partial<TimingReviewLoopGraphState>,
      string
    >;
    addWorkflowNodes(graphBuilder, TIMING_REVIEW_LOOP_NODE_KEYS, nodeExecutors);
    addResumeStart(graphBuilder, TIMING_REVIEW_LOOP_NODE_KEYS);
    addSequentialEdges(graphBuilder, TIMING_REVIEW_LOOP_NODE_KEYS);

    super({
      graph: graphBuilder.compile(),
      nodeOrder: TIMING_REVIEW_LOOP_NODE_KEYS,
    });
  }

  buildInitialState(
    params: WorkflowGraphBuildInitialStateParams,
  ): TimingReviewLoopGraphState {
    return {
      runId: params.runId,
      userId: params.userId,
      query: params.query,
      progressPercent: params.progressPercent,
      resumeFromNodeKey: undefined,
      currentNodeKey: undefined,
      lastCompletedNodeKey: undefined,
      timingInput: params.input as TimingReviewLoopInput,
      dueReviews: [],
      evaluatedReviews: [],
      persistedReviews: [],
      consumedReminderIds: [],
      errors: [],
    };
  }

  getNodeOutput(nodeKey: WorkflowNodeKey, state: WorkflowGraphState) {
    const reviewState = state as TimingReviewLoopGraphState;

    switch (nodeKey) {
      case "load_due_reviews":
        return { dueReviews: reviewState.dueReviews };
      case "evaluate_outcomes":
      case "review_agent":
        return { evaluatedReviews: reviewState.evaluatedReviews };
      case "persist_reviews":
        return { persistedReviews: reviewState.persistedReviews };
      default:
        return { consumedReminderIds: reviewState.consumedReminderIds };
    }
  }

  getNodeEventPayload(nodeKey: WorkflowNodeKey, state: WorkflowGraphState) {
    const reviewState = state as TimingReviewLoopGraphState;

    if (nodeKey === "load_due_reviews") {
      return { dueReviewCount: reviewState.dueReviews.length };
    }

    if (nodeKey === "persist_reviews") {
      return { persistedReviewCount: reviewState.persistedReviews.length };
    }

    if (nodeKey === "schedule_next_review") {
      return { consumedReminderCount: reviewState.consumedReminderIds.length };
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
    const reviewState = state as TimingReviewLoopGraphState;

    return {
      reviewCount: reviewState.persistedReviews.length,
      reviewIds: reviewState.persistedReviews.map((review) => review.id),
      consumedReminderIds: reviewState.consumedReminderIds,
    };
  }
}
