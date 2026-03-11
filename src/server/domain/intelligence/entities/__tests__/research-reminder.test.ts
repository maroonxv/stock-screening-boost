import { describe, expect, it } from "vitest";
import { ResearchReminder } from "~/server/domain/intelligence/entities/research-reminder";

describe("ResearchReminder", () => {
  it("accepts a screening insight target", () => {
    const reminder = ResearchReminder.create({
      userId: "user-1",
      screeningInsightId: "insight-1",
      stockCode: "600519",
      reminderType: "REVIEW",
      targetType: "SCREENING_INSIGHT",
      scheduledAt: new Date("2026-03-20T00:00:00.000Z"),
      payload: {},
    });

    expect(reminder.screeningInsightId).toBe("insight-1");
    expect(reminder.timingReviewRecordId).toBeNull();
  });

  it("accepts a timing review target", () => {
    const reminder = ResearchReminder.create({
      userId: "user-1",
      timingReviewRecordId: "review-1",
      stockCode: "600519",
      reminderType: "REVIEW",
      targetType: "TIMING_REVIEW",
      scheduledAt: new Date("2026-03-20T00:00:00.000Z"),
      payload: {},
    });

    expect(reminder.timingReviewRecordId).toBe("review-1");
    expect(reminder.screeningInsightId).toBeNull();
  });

  it("rejects reminders bound to multiple targets", () => {
    expect(() =>
      ResearchReminder.create({
        userId: "user-1",
        screeningInsightId: "insight-1",
        timingReviewRecordId: "review-1",
        stockCode: "600519",
        reminderType: "REVIEW",
        targetType: "SCREENING_INSIGHT",
        scheduledAt: new Date("2026-03-20T00:00:00.000Z"),
        payload: {},
      }),
    ).toThrow("提醒目标必须且只能绑定一个实体");
  });
});
