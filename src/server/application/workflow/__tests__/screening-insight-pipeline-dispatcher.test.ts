import { describe, expect, it, vi } from "vitest";
import { ScreeningInsightPipelineDispatcher } from "~/server/application/workflow/screening-insight-pipeline-dispatcher";
import type { ScreeningSession } from "~/server/domain/screening/aggregates/screening-session";

function createSession(): ScreeningSession {
  return {
    id: "session-1",
    userId: "user-1",
    strategyName: "高质量动量",
  } as ScreeningSession;
}

describe("ScreeningInsightPipelineDispatcher", () => {
  it("dispatches screening insight and screening-to-timing pipelines together", async () => {
    const commandService = {
      startScreeningInsightPipeline: vi
        .fn()
        .mockResolvedValue({ runId: "run-insight", status: "PENDING" }),
      startScreeningToTimingPipeline: vi
        .fn()
        .mockResolvedValue({ runId: "run-timing", status: "PENDING" }),
    };

    const dispatcher = new ScreeningInsightPipelineDispatcher(
      commandService as never,
    );
    const result = await dispatcher.dispatchCompletedSession(createSession());

    expect(commandService.startScreeningInsightPipeline).toHaveBeenCalledWith({
      userId: "user-1",
      screeningSessionId: "session-1",
      strategyName: "高质量动量",
      idempotencyKey: "screening-insight-pipeline:session-1",
    });
    expect(commandService.startScreeningToTimingPipeline).toHaveBeenCalledWith({
      userId: "user-1",
      screeningSessionId: "session-1",
      strategyName: "高质量动量",
      idempotencyKey: "screening-to-timing:session-1",
    });
    expect(result).toEqual([
      { runId: "run-insight", status: "PENDING" },
      { runId: "run-timing", status: "PENDING" },
    ]);
  });

  it("keeps the successful dispatch when the parallel branch partially fails", async () => {
    const commandService = {
      startScreeningInsightPipeline: vi
        .fn()
        .mockRejectedValue(new Error("insight failed")),
      startScreeningToTimingPipeline: vi
        .fn()
        .mockResolvedValue({ runId: "run-timing", status: "PENDING" }),
    };

    const dispatcher = new ScreeningInsightPipelineDispatcher(
      commandService as never,
    );

    await expect(
      dispatcher.dispatchCompletedSession(createSession()),
    ).resolves.toEqual([{ runId: "run-timing", status: "PENDING" }]);
  });
});
