import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { WorkspaceShell } from "~/app/_components/ui";

describe("WorkspaceShell", () => {
  it("renders the top-level workflow navigation instead of a sidebar shell", () => {
    const markup = renderToStaticMarkup(
      React.createElement(
        WorkspaceShell,
        {
          section: "workflows",
          title: "行业研究",
          description: "围绕单一流程组织研究动作。",
          workflowTabs: [
            {
              id: "question",
              label: "研究问题",
              summary: "定义本轮研究目标",
            },
            {
              id: "constraints",
              label: "研究约束",
              summary: "限定证据和时效",
            },
          ],
        } as React.ComponentProps<typeof WorkspaceShell>,
        React.createElement("div", null, "body"),
      ),
    );

    expect(markup).toContain('data-workflow-shell="mistral"');
    expect(markup).toContain('href="/screening"');
    expect(markup).toContain('href="/workflows"');
    expect(markup).toContain('href="/company-research"');
    expect(markup).toContain('href="/timing"');
    expect(markup).toContain("研究问题");
    expect(markup).not.toContain("<aside");
  });
  it("renders a compact website navbar without the legacy brand masthead", () => {
    const markup = renderToStaticMarkup(
      React.createElement(
        WorkspaceShell,
        {
          section: "screening",
          title: "灏忔壒閲忕瓫閫夊伐浣滃彴",
          description: "body copy",
        } as React.ComponentProps<typeof WorkspaceShell>,
        React.createElement("div", null, "body"),
      ),
    );

    expect(markup).toContain('aria-label="Primary navigation"');
    expect(markup).toContain('href="/screening/history"');
    expect(markup).toContain('href="/workflows/history"');
    expect(markup).toContain('href="/timing/history"');
    expect(markup).not.toContain("Stock Screening Boost");
    expect(markup).not.toContain("鎶曡祫鍐崇瓥宸ヤ綔娴?");
    expect(markup).not.toContain('aria-label="Primary workflow"');
    expect(markup).not.toContain("data-stage-active=");
  });
});
