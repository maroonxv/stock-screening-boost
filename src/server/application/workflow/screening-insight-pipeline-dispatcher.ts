import type { WorkflowCommandService } from "~/server/application/workflow/command-service";
import type { ScreeningSession } from "~/server/domain/screening/aggregates/screening-session";

type DispatchResult = Awaited<
  ReturnType<WorkflowCommandService["startScreeningInsightPipeline"]>
>;

export class ScreeningInsightPipelineDispatcher {
  constructor(private readonly commandService: WorkflowCommandService) {}

  async dispatchCompletedSession(session: ScreeningSession) {
    const results = await Promise.allSettled([
      this.commandService.startScreeningInsightPipeline({
        userId: session.userId,
        screeningSessionId: session.id,
        strategyName: session.strategyName,
        idempotencyKey: `screening-insight-pipeline:${session.id}`,
      }),
      this.commandService.startScreeningToTimingPipeline({
        userId: session.userId,
        screeningSessionId: session.id,
        strategyName: session.strategyName,
        idempotencyKey: `screening-to-timing:${session.id}`,
      }),
    ]);

    const successful = results.filter(
      (item): item is PromiseFulfilledResult<DispatchResult> =>
        item.status === "fulfilled",
    );

    if (successful.length === 0) {
      const rejected = results.find(
        (item): item is PromiseRejectedResult => item.status === "rejected",
      );

      throw rejected?.reason ?? new Error("筛选后置工作流派发失败");
    }

    return successful.map((item) => item.value);
  }
}
