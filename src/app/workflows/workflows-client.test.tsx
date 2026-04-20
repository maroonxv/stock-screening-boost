/* biome-ignore lint/correctness/noUnusedImports: React is required for server-side JSX rendering in this test. */
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const listRunsUseQueryMock = vi.fn();
const startQuickResearchUseMutationMock = vi.fn();

vi.mock("next/link", () => ({
  default: (props: {
    href: string;
    className?: string;
    children: React.ReactNode;
  }) =>
    React.createElement(
      "a",
      {
        href: props.href,
        className: props.className,
      },
      props.children,
    ),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
  }),
  useSearchParams: () => ({
    get: () => null,
  }),
}));

vi.mock("~/app/_components/opportunity-intelligence-summary", () => ({
  OpportunityIntelligenceSummary: () =>
    React.createElement("div", null, "opportunity-intelligence-summary"),
}));

vi.mock("~/app/_components/research-voice-input", () => ({
  ResearchVoiceInput: () => React.createElement("div", null, "voice-input"),
}));

vi.mock("~/app/_components/ui", () => ({
  InlineNotice: (props: { description?: string }) =>
    React.createElement("div", null, props.description ?? ""),
  SectionCard: (props: {
    title?: string;
    description?: string;
    actions?: React.ReactNode;
    children?: React.ReactNode;
  }) =>
    React.createElement(
      "section",
      null,
      props.title ? React.createElement("h2", null, props.title) : null,
      props.description ? React.createElement("p", null, props.description) : null,
      props.actions ?? null,
      props.children,
    ),
  WorkspaceShell: (props: { children?: React.ReactNode }) =>
    React.createElement("div", null, props.children),
}));

vi.mock("~/app/_components/workflow-stage-switcher", () => ({
  WorkflowStageSwitcher: (props: { panels: Record<string, React.ReactNode> }) =>
    React.createElement("div", null, Object.values(props.panels)),
}));

vi.mock("~/app/_components/workspace-history", () => ({
  buildWorkflowRunHistoryItems: () => [],
}));

vi.mock("~/app/workflows/workflow-visualization-panel", () => ({
  WorkflowVisualizationPanel: (props: { runId?: string }) =>
    React.createElement(
      "div",
      {
        "data-testid": "workflow-visualization-panel",
        "data-run-id": props.runId ?? "",
      },
      "workflow visualization",
    ),
}));

vi.mock("~/app/workflows/quick-research-form", () => ({
  buildQuickResearchStartInput: (value: unknown) => value,
}));

vi.mock("~/app/workflows/workflows-stage-tabs", () => ({
  workflowsStageTabs: [
    { id: "question", label: "Question", summary: "Question summary" },
    { id: "constraints", label: "Constraints", summary: "Constraint summary" },
    { id: "launch", label: "Launch", summary: "Launch summary" },
  ],
}));

vi.mock("~/app/workflows/workflows-voice-adapter", () => ({
  applyWorkflowsVoicePatch: (state: unknown) => state,
  buildWorkflowsVoiceContext: () => ({}),
}));

vi.mock("~/trpc/react", () => ({
  api: {
    useUtils: () => ({
      workflow: {
        listRuns: {
          invalidate: vi.fn(async () => undefined),
        },
      },
    }),
    workflow: {
      listRuns: {
        useQuery: listRunsUseQueryMock,
      },
      startQuickResearch: {
        useMutation: startQuickResearchUseMutationMock,
      },
    },
  },
}));

describe("WorkflowsClient", () => {
  beforeEach(() => {
    listRunsUseQueryMock.mockReset();
    startQuickResearchUseMutationMock.mockReset();

    listRunsUseQueryMock.mockReturnValue({
      data: {
        items: [],
      },
      isLoading: false,
    });

    startQuickResearchUseMutationMock.mockReturnValue({
      isPending: false,
      error: null,
      mutateAsync: vi.fn(async () => undefined),
    });
  });

  it("renders the recent workflow visualization panel for the latest run", async () => {
    listRunsUseQueryMock.mockReturnValue({
      data: {
        items: [
          {
            id: "run_1",
            query: "AI infra",
            createdAt: new Date("2026-04-20T12:00:00.000Z"),
          },
        ],
      },
      isLoading: false,
    });

    const { WorkflowsClient } = await import("~/app/workflows/workflows-client");
    const markup = renderToStaticMarkup(React.createElement(WorkflowsClient));

    expect(markup).toContain("workflow-visualization-panel");
    expect(markup).toContain('data-run-id="run_1"');
  });

  it("still renders the recent workflow visualization panel when there is no latest run", async () => {
    const { WorkflowsClient } = await import("~/app/workflows/workflows-client");
    const markup = renderToStaticMarkup(React.createElement(WorkflowsClient));

    expect(markup).toContain("workflow-visualization-panel");
    expect(markup).toContain('data-run-id=""');
  });
});
