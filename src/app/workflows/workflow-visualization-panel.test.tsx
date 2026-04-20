/* biome-ignore lint/correctness/noUnusedImports: React is required for server-side JSX rendering in this test. */
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { RunView } from "~/server/application/workflow/run-view";

const getRunUseQueryMock = vi.fn();

vi.mock("~/trpc/react", () => ({
  api: {
    workflow: {
      getRun: {
        useQuery: getRunUseQueryMock,
      },
    },
  },
}));

vi.mock("~/app/workflows/flow-graph", () => ({
  FlowGraph: (props: { mode: "user" | "debug" }) =>
    React.createElement(
      "div",
      {
        "data-testid": "workflow-visualization-graph",
        "data-mode": props.mode,
      },
      "graph",
    ),
}));

function buildRunViewFixture(): RunView {
  return {
    flow: {
      templateCode: "quick_industry_research",
      templateVersion: 1,
      name: "Quick Research",
    },
    user: {
      stages: [{ key: "scope", name: "Scope" }],
      nodes: [
        {
          key: "clarify",
          name: "Clarify",
          kind: "agent",
          goal: "Clarify the request",
          stage: "scope",
          state: "done",
          result: null,
          note: "Scope locked",
          stats: {},
        },
      ],
      edges: [],
      activePath: ["clarify"],
      current: null,
    },
    debug: {
      stages: [{ key: "scope", name: "Scope" }],
      nodes: [
        {
          key: "clarify",
          name: "Clarify",
          kind: "agent",
          goal: "Clarify the request",
          stage: "scope",
          state: "done",
          result: null,
          note: "Scope locked",
          stats: {},
        },
      ],
      edges: [],
      activePath: ["clarify"],
      current: null,
      events: [],
    },
    status: "SUCCEEDED",
    progressPercent: 100,
    result: {},
  };
}

describe("WorkflowVisualizationPanel", () => {
  beforeEach(() => {
    getRunUseQueryMock.mockReset();
    getRunUseQueryMock.mockReturnValue({
      data: undefined,
      error: null,
      isLoading: false,
    });
  });

  it("renders the graph directly from an existing runView", async () => {
    const { WorkflowVisualizationPanel } = await import(
      "~/app/workflows/workflow-visualization-panel"
    );

    const markup = renderToStaticMarkup(
      <WorkflowVisualizationPanel
        title="Latest Flow"
        description="Latest workflow graph"
        runView={buildRunViewFixture()}
      />,
    );

    expect(markup).toContain("Latest Flow");
    expect(markup).toContain("Latest workflow graph");
    expect(markup).toContain("workflow-visualization-graph");
    expect(markup).toContain('data-mode="user"');
  });

  it("loads the run by runId and renders the graph when runView is available", async () => {
    getRunUseQueryMock.mockReturnValue({
      data: {
        id: "run_1",
        runView: buildRunViewFixture(),
      },
      error: null,
      isLoading: false,
    });

    const { WorkflowVisualizationPanel } = await import(
      "~/app/workflows/workflow-visualization-panel"
    );
    const markup = renderToStaticMarkup(
      <WorkflowVisualizationPanel
        runId="run_1"
        detailHref="/workflows/run_1"
        title="Recent Run"
      />,
    );

    expect(markup).toContain("workflow-visualization-graph");
    expect(markup).toContain("/workflows/run_1");
  });

  it("renders an empty state when neither runView nor runId can provide graph data", async () => {
    const { WorkflowVisualizationPanel } = await import(
      "~/app/workflows/workflow-visualization-panel"
    );
    const markup = renderToStaticMarkup(
      <WorkflowVisualizationPanel title="Recent Run" />,
    );

    expect(markup).toContain("Recent Run");
    expect(markup).toContain("当前记录没有可视化流程数据");
    expect(markup).not.toContain("workflow-visualization-graph");
  });

  it("renders an error notice when loading the workflow visualization fails", async () => {
    getRunUseQueryMock.mockReturnValue({
      data: undefined,
      error: {
        message: "workflow failed",
      },
      isLoading: false,
    });

    const { WorkflowVisualizationPanel } = await import(
      "~/app/workflows/workflow-visualization-panel"
    );
    const markup = renderToStaticMarkup(
      <WorkflowVisualizationPanel runId="run_2" />,
    );

    expect(markup).toContain("workflow failed");
    expect(markup).not.toContain("workflow-visualization-graph");
  });
});
