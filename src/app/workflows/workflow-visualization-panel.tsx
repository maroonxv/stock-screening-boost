"use client";

/* biome-ignore lint/correctness/noUnusedImports: React is required by the current JSX transform in tests. */
import React from "react";
import Link from "next/link";
import {
  EmptyState,
  InlineNotice,
  LoadingSkeleton,
  Panel,
} from "~/app/_components/ui";
import { FlowGraph } from "~/app/workflows/flow-graph";
import type { RunView } from "~/server/application/workflow/run-view";
import { api } from "~/trpc/react";

type WorkflowVisualizationPanelProps = {
  runId?: string;
  runView?: RunView | null;
  title?: string;
  description?: string;
  detailHref?: string;
  mode?: "user" | "debug";
};

export function WorkflowVisualizationPanel(
  props: WorkflowVisualizationPanelProps,
) {
  const {
    runId,
    runView,
    title = "流程可视化",
    description = "展示这次工作流应该如何推进，以及当前记录实际走到了哪一步。",
    detailHref,
    mode = "user",
  } = props;

  const shouldQuery = Boolean(runId) && !runView;
  const runQuery = api.workflow.getRun.useQuery(
    { runId: runId ?? "" },
    {
      enabled: shouldQuery,
      refetchOnWindowFocus: false,
    },
  );

  const resolvedRunView = runView ?? runQuery.data?.runView ?? null;

  return (
    <Panel
      title={title}
      description={description}
      actions={
        detailHref ? (
          <Link href={detailHref} className="app-button">
            查看运行详情
          </Link>
        ) : undefined
      }
    >
      {runQuery.isLoading && !runView ? <LoadingSkeleton rows={3} /> : null}
      {runQuery.error ? (
        <InlineNotice
          tone="danger"
          title="流程可视化加载失败"
          description={runQuery.error.message}
        />
      ) : null}
      {!runQuery.isLoading && !runQuery.error && !resolvedRunView ? (
        <EmptyState
          title="当前记录没有可视化流程数据"
          description="这条记录目前没有可用于渲染流程图的工作流视图。"
        />
      ) : null}
      {resolvedRunView ? (
        <FlowGraph
          graph={mode === "debug" ? resolvedRunView.debug : resolvedRunView.user}
          mode={mode}
        />
      ) : null}
    </Panel>
  );
}
