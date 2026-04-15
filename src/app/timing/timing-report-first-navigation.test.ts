import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

function readSource(relativePath: string) {
  return readFileSync(new URL(relativePath, import.meta.url), "utf8");
}

describe("timing report-first navigation", () => {
  it("switches the timing workspace to report history data instead of workflow run history", () => {
    const timingSource = readSource("./timing-client.tsx");

    expect(timingSource).toContain("buildTimingReportHistoryItems");
    expect(timingSource).not.toContain(
      "buildWorkflowRunHistoryItems(runsQuery.data?.items ?? [])",
    );
    expect(timingSource).not.toContain(
      String.raw`router.push(\`/workflows/\${result.runId}\`)`,
    );
  });

  it("turns the timing history page into a report-history experience", () => {
    const timingHistorySource = readSource("./history/page.tsx");

    expect(timingHistorySource).toContain("TimingHistoryClient");
    expect(timingHistorySource).not.toContain("WorkflowHistoryClient");
  });

  it("uses report history in the timing report page sidebar and highlights the active report card", () => {
    const timingReportSource = readSource(
      "./reports/[cardId]/timing-report-client.tsx",
    );

    expect(timingReportSource).toContain("buildTimingReportHistoryItems");
    expect(timingReportSource).toContain("activeHistoryId={cardId}");
    expect(timingReportSource).not.toContain(
      String.raw`href={\`/workflows/\${report.card.workflowRunId}\`}`,
    );
  });

  it("removes old timing workflow-detail links from the home page", () => {
    const homeSource = readSource("../page.tsx");

    expect(homeSource).not.toContain(
      String.raw`/workflows/\${priorityRecommendation.workflowRunId}`,
    );
    expect(homeSource).not.toContain(
      String.raw`/workflows/\${item.workflowRunId}`,
    );
  });
});
