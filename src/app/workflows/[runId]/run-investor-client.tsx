"use client";

import Link from "next/link";

import {
  ActionBanner,
  EmptyState,
  KeyPointList,
  KpiCard,
  Panel,
  StatusPill,
  statusTone,
  WorkspaceShell,
} from "~/app/_components/ui";
import { buildResearchDigest } from "~/app/workflows/research-view-models";
import {
  COMPANY_RESEARCH_TEMPLATE_CODE,
  QUICK_RESEARCH_TEMPLATE_CODE,
  SCREENING_INSIGHT_PIPELINE_TEMPLATE_CODE,
  SCREENING_TO_TIMING_TEMPLATE_CODE,
  TIMING_REVIEW_LOOP_TEMPLATE_CODE,
  TIMING_SIGNAL_PIPELINE_TEMPLATE_CODE,
  WATCHLIST_TIMING_CARDS_PIPELINE_TEMPLATE_CODE,
  WATCHLIST_TIMING_PIPELINE_TEMPLATE_CODE,
} from "~/server/domain/workflow/types";
import { api } from "~/trpc/react";

type RunInvestorClientProps = {
  runId: string;
};

function formatDate(value?: Date | null) {
  if (!value) {
    return "-";
  }

  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(value);
}

const statusLabels: Record<string, string> = {
  PENDING: "等待执行",
  RUNNING: "研究进行中",
  SUCCEEDED: "结论已生成",
  FAILED: "需要重跑",
  CANCELLED: "已取消",
};

function getBackLink(templateCode?: string) {
  if (templateCode === COMPANY_RESEARCH_TEMPLATE_CODE) {
    return "/company-research";
  }

  if (
    templateCode === TIMING_SIGNAL_PIPELINE_TEMPLATE_CODE ||
    templateCode === WATCHLIST_TIMING_CARDS_PIPELINE_TEMPLATE_CODE ||
    templateCode === WATCHLIST_TIMING_PIPELINE_TEMPLATE_CODE ||
    templateCode === TIMING_REVIEW_LOOP_TEMPLATE_CODE
  ) {
    return "/timing";
  }

  if (
    templateCode === SCREENING_INSIGHT_PIPELINE_TEMPLATE_CODE ||
    templateCode === SCREENING_TO_TIMING_TEMPLATE_CODE
  ) {
    return "/screening";
  }

  return "/workflows";
}

function getSection(templateCode?: string) {
  if (templateCode === COMPANY_RESEARCH_TEMPLATE_CODE) {
    return "companyResearch" as const;
  }

  if (
    templateCode === TIMING_SIGNAL_PIPELINE_TEMPLATE_CODE ||
    templateCode === WATCHLIST_TIMING_CARDS_PIPELINE_TEMPLATE_CODE ||
    templateCode === WATCHLIST_TIMING_PIPELINE_TEMPLATE_CODE ||
    templateCode === TIMING_REVIEW_LOOP_TEMPLATE_CODE
  ) {
    return "timing" as const;
  }

  if (
    templateCode === SCREENING_INSIGHT_PIPELINE_TEMPLATE_CODE ||
    templateCode === SCREENING_TO_TIMING_TEMPLATE_CODE
  ) {
    return "screening" as const;
  }

  return "workflows" as const;
}

function getTitle(templateCode?: string) {
  if (templateCode === COMPANY_RESEARCH_TEMPLATE_CODE) {
    return "公司结论详情";
  }

  if (templateCode === QUICK_RESEARCH_TEMPLATE_CODE) {
    return "行业结论详情";
  }

  if (
    templateCode === TIMING_SIGNAL_PIPELINE_TEMPLATE_CODE ||
    templateCode === WATCHLIST_TIMING_CARDS_PIPELINE_TEMPLATE_CODE ||
    templateCode === WATCHLIST_TIMING_PIPELINE_TEMPLATE_CODE ||
    templateCode === TIMING_REVIEW_LOOP_TEMPLATE_CODE
  ) {
    return "择时结论详情";
  }

  return "研究结论详情";
}

export function RunInvestorClient({ runId }: RunInvestorClientProps) {
  const utils = api.useUtils();

  const runQuery = api.workflow.getRun.useQuery(
    { runId },
    {
      refetchInterval: (query) => {
        const status = query.state.data?.status;

        if (
          status === "SUCCEEDED" ||
          status === "FAILED" ||
          status === "CANCELLED"
        ) {
          return false;
        }

        return 10_000;
      },
    },
  );

  const cancelMutation = api.workflow.cancelRun.useMutation({
    onSuccess: async () => {
      await utils.workflow.getRun.invalidate({ runId });
    },
  });

  const run = runQuery.data;
  const digest = buildResearchDigest({
    templateCode: run?.template.code,
    query: run?.query,
    status: run?.status,
    progressPercent: run?.progressPercent,
    currentNodeKey: run?.currentNodeKey,
    result: run?.result,
  });

  const nextSectionItems =
    digest.gaps.length > 0 ? digest.gaps : digest.nextActions;

  return (
    <WorkspaceShell
      section={getSection(run?.template.code)}
      eyebrow="Investment Conclusion"
      title={getTitle(run?.template.code)}
      description="默认视图只保留一句话结论、多空要点、证据摘要与下一步动作；节点、事件与原始结果请移步调试页。"
      actions={
        <>
          <Link href={getBackLink(run?.template.code)} className="app-button">
            返回上一页
          </Link>
          <Link href={`/workflows/${runId}/debug`} className="app-button">
            查看调试信息
          </Link>
          {run && (run.status === "RUNNING" || run.status === "PENDING") ? (
            <button
              type="button"
              onClick={() => cancelMutation.mutate({ runId })}
              className="app-button app-button-danger"
            >
              取消研究
            </button>
          ) : null}
        </>
      }
      summary={
        <>
          <KpiCard
            label="当前状态"
            value={run ? (statusLabels[run.status] ?? run.status) : "-"}
            hint={run?.currentNodeKey ?? "结论页默认隐藏流程细节"}
            tone={statusTone(run?.status)}
          />
          <KpiCard
            label="发起时间"
            value={formatDate(run?.createdAt)}
            hint="用于确认结论时效性"
            tone="neutral"
          />
          <KpiCard
            label="完成时间"
            value={formatDate(run?.completedAt)}
            hint="运行中任务会持续刷新"
            tone="info"
          />
          <KpiCard
            label="核心指标"
            value={digest.metrics[0]?.value ?? "-"}
            hint={digest.metrics[0]?.label ?? "暂无指标"}
            tone={digest.verdictTone}
          />
        </>
      }
    >
      {runQuery.isLoading ? (
        <EmptyState
          title="正在加载结论详情"
          description="结果摘要会在读取完成后显示。"
        />
      ) : !run ? (
        <EmptyState
          title="未找到对应研究"
          description="这条研究记录可能已被删除，或当前账号无权访问。"
        />
      ) : (
        <>
          <ActionBanner
            title={digest.headline}
            description={digest.summary}
            tone={digest.verdictTone}
            actions={
              <StatusPill
                label={digest.verdictLabel}
                tone={digest.verdictTone}
              />
            }
          />

          {run.errorMessage ? (
            <div className="rounded-[16px] border border-[rgba(201,119,132,0.34)] bg-[rgba(81,33,43,0.22)] px-4 py-3 text-sm text-[var(--app-danger)]">
              {run.errorCode ? `${run.errorCode}：` : ""}
              {run.errorMessage}
            </div>
          ) : null}

          <Panel
            title="关键指标"
            description="这些指标帮助你快速判断这份研究值得不值得继续往下读。"
          >
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              {digest.metrics.length === 0 ? (
                <div className="rounded-[12px] border border-[var(--app-border)] bg-[rgba(16,21,29,0.84)] px-4 py-3 text-sm text-[var(--app-text-muted)]">
                  当前没有结构化指标，建议直接阅读结论摘要与后续动作。
                </div>
              ) : (
                digest.metrics.map((metric) => (
                  <div
                    key={`${metric.label}-${metric.value}`}
                    className="rounded-[12px] border border-[var(--app-border)] bg-[rgba(16,21,29,0.84)] px-4 py-3"
                  >
                    <div className="text-xs text-[var(--app-text-soft)]">
                      {metric.label}
                    </div>
                    <div className="app-data mt-2 text-lg text-[var(--app-text)]">
                      {metric.value}
                    </div>
                  </div>
                ))
              )}
            </div>
          </Panel>

          <div className="grid gap-4 xl:grid-cols-2">
            <KeyPointList
              title="多头理由"
              items={digest.bullPoints}
              emptyText="当前没有单独提炼多头理由。"
              tone="success"
            />
            <KeyPointList
              title="风险与反证"
              items={digest.bearPoints}
              emptyText="当前没有单独提炼风险与反证。"
              tone="warning"
            />
            <KeyPointList
              title="证据摘要"
              items={digest.evidence}
              emptyText="当前没有结构化证据摘要。"
              tone="info"
            />
            <KeyPointList
              title={digest.gaps.length > 0 ? "待核验缺口" : "建议动作"}
              items={nextSectionItems}
              emptyText="当前没有单独列出待办动作。"
              tone="neutral"
            />
          </div>
        </>
      )}
    </WorkspaceShell>
  );
}
