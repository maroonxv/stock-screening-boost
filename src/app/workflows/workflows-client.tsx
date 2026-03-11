"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

import {
  EmptyState,
  KeyPointList,
  KpiCard,
  Panel,
  ProgressBar,
  StatusPill,
  statusTone,
  WorkspaceShell,
} from "~/app/_components/ui";
import {
  buildResearchDigest,
  type InvestorTone,
} from "~/app/workflows/research-view-models";
import { QUICK_RESEARCH_TEMPLATE_CODE } from "~/server/domain/workflow/types";
import { api, type RouterOutputs } from "~/trpc/react";

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
  }).format(value);
}

const statusLabelMap: Record<string, string> = {
  PENDING: "等待执行",
  RUNNING: "研究进行中",
  SUCCEEDED: "结论已生成",
  FAILED: "需要重跑",
  CANCELLED: "已取消",
};

const quickPrompts = [
  "半导体设备国产替代，未来 12 个月最关键的兑现节点是什么？",
  "创新药出海链条里，哪些商业化指标最值得持续跟踪？",
  "AI 算力基础设施的盈利兑现节奏，应该看哪些领先指标？",
];

type RunListItem = RouterOutputs["workflow"]["listRuns"]["items"][number];

function InvestorRunCard({
  run,
  onCancel,
}: {
  run: RunListItem;
  onCancel: (runId: string) => void;
}) {
  const detailQuery = api.workflow.getRun.useQuery(
    { runId: run.id },
    {
      enabled: run.status === "SUCCEEDED",
      refetchOnWindowFocus: false,
    },
  );

  const digest = buildResearchDigest({
    templateCode: run.templateCode,
    query: run.query,
    status: run.status,
    progressPercent: run.progressPercent,
    currentNodeKey: run.currentNodeKey,
    result: detailQuery.data?.result,
  });

  const verdictTone: InvestorTone =
    run.status === "FAILED" ? "danger" : digest.verdictTone;

  return (
    <article className="rounded-[18px] border border-[var(--app-border)] bg-[rgba(12,16,22,0.88)] p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <StatusPill label={digest.templateLabel} tone="info" />
            <StatusPill
              label={statusLabelMap[run.status] ?? run.status}
              tone={statusTone(run.status)}
            />
            <StatusPill label={digest.verdictLabel} tone={verdictTone} />
          </div>
          <p className="mt-3 text-lg font-medium text-[var(--app-text)]">
            {run.query}
          </p>
          <p className="mt-2 text-sm leading-6 text-[var(--app-text-muted)]">
            {digest.summary}
          </p>
        </div>

        <div className="text-right text-xs text-[var(--app-text-soft)]">
          <p>{formatDate(run.createdAt)}</p>
          {run.status === "RUNNING" || run.status === "PENDING" ? (
            <p className="mt-2">{run.currentNodeKey ?? "等待更新"}</p>
          ) : null}
        </div>
      </div>

      {run.status === "RUNNING" || run.status === "PENDING" ? (
        <div className="mt-4">
          <div className="mb-2 flex items-center justify-between gap-3 text-xs text-[var(--app-text-soft)]">
            <span>当前进度</span>
            <span>{run.progressPercent}%</span>
          </div>
          <ProgressBar
            value={run.progressPercent}
            tone={statusTone(run.status)}
          />
        </div>
      ) : null}

      <div className="mt-4 grid gap-3 md:grid-cols-4">
        {digest.metrics.slice(0, 4).map((metric) => (
          <div
            key={`${run.id}-${metric.label}`}
            className="rounded-[12px] border border-[var(--app-border)] bg-[rgba(16,21,29,0.84)] px-4 py-3"
          >
            <div className="text-xs text-[var(--app-text-soft)]">
              {metric.label}
            </div>
            <div className="app-data mt-2 text-lg text-[var(--app-text)]">
              {metric.value}
            </div>
          </div>
        ))}
      </div>

      <div className="mt-4 grid gap-3 xl:grid-cols-3">
        <KeyPointList
          title="看多理由"
          items={digest.bullPoints}
          emptyText="等待正式结论后补充。"
          tone="success"
        />
        <KeyPointList
          title="风险点"
          items={digest.bearPoints}
          emptyText="当前未单独标注风险点。"
          tone="warning"
        />
        <KeyPointList
          title="下一步动作"
          items={digest.nextActions}
          emptyText="进入详情页查看完整后续动作。"
          tone="info"
        />
      </div>

      <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
        <div className="text-xs text-[var(--app-text-soft)]">
          {digest.headline}
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href={`/workflows/${run.id}`}
            className="app-button app-button-primary"
          >
            查看结论
          </Link>
          {(run.status === "PENDING" || run.status === "RUNNING") && (
            <button
              type="button"
              onClick={() => onCancel(run.id)}
              className="app-button app-button-danger"
            >
              取消研究
            </button>
          )}
        </div>
      </div>
    </article>
  );
}

export function WorkflowsClient() {
  const router = useRouter();
  const utils = api.useUtils();
  const [query, setQuery] = useState("");
  const [idempotencyKey, setIdempotencyKey] = useState("");

  const runsQuery = api.workflow.listRuns.useQuery({
    limit: 20,
    templateCode: QUICK_RESEARCH_TEMPLATE_CODE,
  });

  const startMutation = api.workflow.startQuickResearch.useMutation({
    onSuccess: async (result) => {
      await utils.workflow.listRuns.invalidate({
        limit: 20,
        templateCode: QUICK_RESEARCH_TEMPLATE_CODE,
      });
      router.push(`/workflows/${result.runId}`);
    },
  });

  const cancelMutation = api.workflow.cancelRun.useMutation({
    onSuccess: async () => {
      await utils.workflow.listRuns.invalidate({
        limit: 20,
        templateCode: QUICK_RESEARCH_TEMPLATE_CODE,
      });
    },
  });

  const sortedRuns = useMemo(() => {
    return [...(runsQuery.data?.items ?? [])].sort(
      (left, right) =>
        (right.createdAt?.getTime?.() ?? 0) -
        (left.createdAt?.getTime?.() ?? 0),
    );
  }, [runsQuery.data?.items]);

  const liveRuns = sortedRuns.filter(
    (run) => run.status === "PENDING" || run.status === "RUNNING",
  );
  const finishedRuns = sortedRuns.filter((run) => run.status === "SUCCEEDED");

  const handleStart = async () => {
    if (!query.trim()) {
      return;
    }

    await startMutation.mutateAsync({
      query: query.trim(),
      idempotencyKey: idempotencyKey.trim() || undefined,
    });
  };

  return (
    <WorkspaceShell
      section="workflows"
      eyebrow="Industry Judgement"
      title="行业判断"
      description="围绕一个清晰问题生成行业结论，默认先给出判断、风险与下一步动作；过程细节退到次级页面。"
      actions={
        <>
          <Link href="/" className="app-button">
            返回看板
          </Link>
          <Link
            href="/company-research"
            className="app-button app-button-primary"
          >
            打开公司判断
          </Link>
          <Link href="/screening" className="app-button app-button-success">
            查看机会池
          </Link>
        </>
      }
      summary={
        <>
          <KpiCard
            label="研究卡片"
            value={sortedRuns.length}
            hint="最近 20 条行业判断记录"
            tone="info"
          />
          <KpiCard
            label="进行中"
            value={liveRuns.length}
            hint="仍在生成结论与证据"
            tone="warning"
          />
          <KpiCard
            label="已完成"
            value={finishedRuns.length}
            hint="已可进入详情页阅读"
            tone="success"
          />
          <KpiCard
            label="最近更新"
            value={formatDate(sortedRuns[0]?.createdAt ?? null)}
            hint="用于确认当前研究节奏"
            tone="neutral"
          />
        </>
      }
    >
      <div className="grid gap-6 xl:grid-cols-[1.12fr_0.88fr]">
        <Panel
          title="形成行业判断"
          description="建议使用“行业 / 链条 / 主题 + 关键问题”的格式，把真正影响投资动作的判断问清楚。"
          actions={
            <button
              type="button"
              onClick={handleStart}
              disabled={startMutation.isPending || !query.trim()}
              className="app-button app-button-primary"
            >
              {startMutation.isPending ? "正在生成判断" : "开始判断"}
            </button>
          }
        >
          <div className="grid gap-4">
            <textarea
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="例如：AI 眼镜供应链中，哪几个环节会最先兑现利润？"
              className="app-textarea min-h-[180px]"
            />

            <details className="rounded-[14px] border border-[var(--app-border)] bg-[rgba(12,16,22,0.82)] p-4">
              <summary className="cursor-pointer text-sm font-medium text-[var(--app-text)]">
                高级选项
              </summary>
              <div className="mt-4 grid gap-3">
                <input
                  value={idempotencyKey}
                  onChange={(event) => setIdempotencyKey(event.target.value)}
                  placeholder="可选：幂等键，用于避免重复创建"
                  className="app-input"
                />
              </div>
            </details>

            {startMutation.error ? (
              <div className="rounded-[12px] border border-[rgba(201,119,132,0.34)] bg-[rgba(81,33,43,0.2)] px-4 py-3 text-sm text-[var(--app-danger)]">
                {startMutation.error.message}
              </div>
            ) : null}
          </div>
        </Panel>

        <Panel
          title="优质提问模板"
          description="先套一个成熟框架，再补你最关心的变量与验证口径。"
        >
          <div className="grid gap-3">
            {quickPrompts.map((prompt) => (
              <button
                key={prompt}
                type="button"
                onClick={() => setQuery(prompt)}
                className="rounded-[14px] border border-[var(--app-border)] bg-[rgba(12,16,22,0.84)] px-4 py-3 text-left text-sm leading-6 text-[var(--app-text-muted)] transition-colors hover:border-[var(--app-border-strong)] hover:bg-[rgba(16,21,29,0.94)] hover:text-[var(--app-text)]"
              >
                {prompt}
              </button>
            ))}
            <div className="rounded-[14px] border border-[var(--app-border)] bg-[rgba(12,16,22,0.72)] p-4 text-sm leading-6 text-[var(--app-text-muted)]">
              一个好的行业判断问题，通常同时包含范围、变量和验证口径，例如“盈利兑现节奏如何判断”会比“怎么看这个行业”更容易产出投资动作。
            </div>
          </div>
        </Panel>
      </div>

      <Panel
        title="最新行业判断"
        description="优先显示已形成结论的研究卡；只有仍在运行的任务才显示进度。"
        actions={
          <button
            type="button"
            onClick={() => runsQuery.refetch()}
            className="app-button"
          >
            刷新列表
          </button>
        }
      >
        {runsQuery.isLoading ? (
          <EmptyState
            title="正在加载行业判断"
            description="研究卡会在查询完成后显示。"
          />
        ) : sortedRuns.length === 0 ? (
          <EmptyState
            title="还没有行业判断记录"
            description="从上方发起一个清晰问题，系统会自动生成新的行业判断。"
          />
        ) : (
          <div className="grid gap-4">
            {sortedRuns.map((run) => (
              <InvestorRunCard
                key={run.id}
                run={run}
                onCancel={(runId) => cancelMutation.mutate({ runId })}
              />
            ))}
          </div>
        )}

        {runsQuery.error ? (
          <div className="mt-4 rounded-[12px] border border-[rgba(201,119,132,0.34)] bg-[rgba(81,33,43,0.2)] px-4 py-3 text-sm text-[var(--app-danger)]">
            {runsQuery.error.message}
          </div>
        ) : null}
      </Panel>
    </WorkspaceShell>
  );
}
