import type { WorkflowCommandService } from "~/server/application/workflow/command-service";
import type { ScreeningSession } from "~/server/domain/screening/aggregates/screening-session";

export class ScreeningInsightPipelineDispatcher {
  constructor(private readonly commandService: WorkflowCommandService) {}

  async dispatchCompletedSession(session: ScreeningSession) {
    return this.commandService.startScreeningInsightPipeline({
      userId: session.userId,
      screeningSessionId: session.id,
      strategyName: session.strategyName,
      idempotencyKey: `screening-insight-pipeline:${session.id}`,
    });
  }
}
