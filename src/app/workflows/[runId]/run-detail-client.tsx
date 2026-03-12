"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import {
  EmptyState,
  KpiCard,
  Panel,
  ProgressBar,
  StatusPill,
  statusTone,
  WorkspaceShell,
} from "~/app/_components/ui";
import {
  COMPANY_RESEARCH_TEMPLATE_CODE,
  type CompanyResearchResultDto,
  SCREENING_INSIGHT_PIPELINE_TEMPLATE_CODE,
} from "~/server/domain/workflow/types";
import { api } from "~/trpc/react";

type RunDetailClientProps = {
  runId: string;
};

type StreamEvent = {
  runId: string;
  sequence: number;
  type: string;
  nodeKey?: string;
  progressPercent: number;
  timestamp: string;
  payload: Record<string, unknown>;
};

function formatDate(value?: Date | string | null) {
  if (!value) {
    return "-";
  }

  const date = value instanceof Date ? value : new Date(value);

  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(date);
}

function formatUnknownValue(value: unknown): string {
  if (value === null || value === undefined) {
    return "-";
  }

  if (typeof value === "string") {
    return value;
  }

  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }

  return JSON.stringify(value);
}

function buildResultHighlights(
  result: unknown,
): Array<{ key: string; value: string }> {
  if (!result || typeof result !== "object" || Array.isArray(result)) {
    return [];
  }

  return Object.entries(result as Record<string, unknown>)
    .slice(0, 8)
    .map(([key, value]) => {
      const text = formatUnknownValue(value);
      return {
        key,
        value: text.length > 180 ? `${text.slice(0, 180)}...` : text,
      };
    });
}

function isCompanyResearchResult(
  value: unknown,
): value is CompanyResearchResultDto {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }

  const candidate = value as Record<string, unknown>;
  return (
    !!candidate.brief &&
    !!candidate.verdict &&
    Array.isArray(candidate.conceptInsights) &&
    Array.isArray(candidate.findings) &&
    Array.isArray(candidate.evidence)
  );
}

function getBackLink(templateCode?: string) {
  return templateCode === COMPANY_RESEARCH_TEMPLATE_CODE
    ? "/company-research"
    : "/workflows";
}

function getSection(templateCode?: string) {
  return templateCode === COMPANY_RESEARCH_TEMPLATE_CODE
    ? "companyResearch"
    : "workflows";
}

const statusLabels: Record<string, string> = {
  PENDING: "排队中",
  RUNNING: "进行中",
  SUCCEEDED: "已完成",
  FAILED: "失败",
  CANCELLED: "已取消",
};

statusLabels.PAUSED = "Paused";

export function RunDetailClient({ runId }: RunDetailClientProps) {
  const utils = api.useUtils();
  const [streamEvents, setStreamEvents] = useState<StreamEvent[]>([]);
  const [streamError, setStreamError] = useState<string | null>(null);

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
  const approveMutation = api.workflow.approveScreeningInsights.useMutation({
    onSuccess: async () => {
      await utils.workflow.getRun.invalidate({ runId });
    },
  });

  useEffect(() => {
    const eventSource = new EventSource(`/api/workflows/runs/${runId}/events`);

    eventSource.onmessage = (event) => {
      try {
        const parsed = JSON.parse(event.data) as StreamEvent;
        setStreamEvents((previous) => {
          if (previous.some((item) => item.sequence === parsed.sequence)) {
            return previous;
          }

          return [...previous, parsed].sort(
            (left, right) => left.sequence - right.sequence,
          );
        });

        void utils.workflow.getRun.invalidate({ runId });

        if (
          parsed.type === "RUN_SUCCEEDED" ||
          parsed.type === "RUN_FAILED" ||
          parsed.type === "RUN_CANCELLED"
        ) {
          eventSource.close();
        }
      } catch {
        setStreamError("实时事件解析失败");
      }
    };

    eventSource.onerror = () => {
      setStreamError("实时连接中断，页面将继续轮询刷新。");
      eventSource.close();
    };

    return () => {
      eventSource.close();
    };
  }, [runId, utils.workflow.getRun]);

  const timeline = useMemo(() => {
    const dbEvents =
      runQuery.data?.events.map((event) => ({
        runId,
        sequence: event.sequence,
        type: event.eventType,
        nodeKey:
          typeof (event.payload as Record<string, unknown> | null)?.nodeKey ===
          "string"
            ? ((event.payload as Record<string, unknown>).nodeKey as string)
            : undefined,
        progressPercent: runQuery.data?.progressPercent ?? 0,
        timestamp: event.occurredAt.toISOString(),
        payload: (event.payload ?? {}) as Record<string, unknown>,
      })) ?? [];

    const merged = [...dbEvents, ...streamEvents];
    const uniqueBySequence = new Map<number, StreamEvent>();

    for (const event of merged) {
      uniqueBySequence.set(event.sequence, event);
    }

    return [...uniqueBySequence.values()].sort(
      (left, right) => right.sequence - left.sequence,
    );
  }, [
    runId,
    runQuery.data?.events,
    runQuery.data?.progressPercent,
    streamEvents,
  ]);

  const run = runQuery.data;
  const canApprove =
    run?.template.code === SCREENING_INSIGHT_PIPELINE_TEMPLATE_CODE &&
    run.status === "PAUSED";
  const companyResult = isCompanyResearchResult(run?.result)
    ? run.result
    : null;
  const resultHighlights = useMemo(
    () => buildResultHighlights(run?.result),
    [run?.result],
  );
  const backLink = getBackLink(run?.template.code);
  const section = getSection(run?.template.code);

  return (
    <WorkspaceShell
      section={section}
      eyebrow="Research Run Detail"
      title="研究任务详情"
      description="以运行视角查看状态、进度、节点、时间线和结果摘要。对进行中的任务，页面会自动接收事件并刷新。"
      actions={
        <>
          <Link href={backLink} className="app-button">
            返回任务列表
          </Link>
          {canApprove ? (
            <button
              type="button"
              onClick={() => approveMutation.mutate({ runId })}
              disabled={approveMutation.isPending}
              className="app-button app-button-primary"
            >
              {approveMutation.isPending ? "Resuming..." : "Approve & Resume"}
            </button>
          ) : null}
          {run &&
          (run.status === "RUNNING" ||
            run.status === "PENDING" ||
            run.status === "PAUSED") ? (
            <button
              type="button"
              onClick={() => cancelMutation.mutate({ runId })}
              className="app-button app-button-danger"
            >
              取消任务
            </button>
          ) : null}
        </>
      }
      summary={
        <>
          <KpiCard
            label="状态"
            value={run ? (statusLabels[run.status] ?? run.status) : "加载中"}
            hint="当前运行状态"
            tone={statusTone(run?.status)}
          />
          <KpiCard
            label="进度"
            value={run ? `${run.progressPercent}%` : "-"}
            hint="按节点事件自动刷新"
            tone={statusTone(run?.status)}
          />
          <KpiCard
            label="当前阶段"
            value={run?.currentNodeKey ?? "准备中"}
            hint="显示当前执行节点"
            tone="info"
          />
          <KpiCard
            label="发起时间"
            value={run ? formatDate(run.createdAt) : "-"}
            hint="用于回溯本轮研究上下文"
            tone="neutral"
          />
        </>
      }
    >
      {!run ? (
        <Panel>
          <EmptyState
            title={runQuery.isLoading ? "正在加载任务详情" : "未找到该任务"}
            description={
              runQuery.isLoading
                ? "任务数据获取完成后，这里会出现运行状态与结果面板。"
                : (runQuery.error?.message ??
                  "该任务可能不存在，或当前账号无权访问。")
            }
          />
        </Panel>
      ) : (
        <>
          <Panel
            title="研究主题"
            description="题目、进度条和错误信息统一放在顶层，便于先判断是否需要继续等待。"
          >
            <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_180px] lg:items-start">
              <div>
                <p className="text-base leading-7 text-[var(--app-text)]">
                  {run.query}
                </p>
                <ProgressBar
                  value={run.progressPercent}
                  tone={statusTone(run.status)}
                  className="mt-4"
                />
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <StatusPill
                    label={statusLabels[run.status] ?? run.status}
                    tone={statusTone(run.status)}
                  />
                  <StatusPill
                    label={run.template.code}
                    tone={
                      run.template.code === COMPANY_RESEARCH_TEMPLATE_CODE
                        ? "info"
                        : "neutral"
                    }
                  />
                  <span className="app-data text-xs text-[var(--app-text-soft)]">
                    {run.progressPercent}%
                  </span>
                  <span className="text-xs text-[var(--app-text-soft)]">
                    创建于 {formatDate(run.createdAt)}
                  </span>
                </div>
                {run.errorMessage ? (
                  <div className="mt-4 rounded-[10px] border border-[rgba(239,142,157,0.34)] bg-[rgba(97,39,50,0.2)] px-4 py-3 text-sm text-[var(--app-danger)]">
                    {run.errorCode ? `${run.errorCode}: ` : ""}
                    {run.errorMessage}
                  </div>
                ) : null}
                {canApprove ? (
                  <div className="mt-4 rounded-[10px] border border-[rgba(191,154,96,0.34)] bg-[rgba(77,58,27,0.22)] px-4 py-3 text-sm text-[var(--app-warning)]">
                    Manual review is required before this screening insight
                    pipeline can continue.
                  </div>
                ) : null}
                {approveMutation.error ? (
                  <div className="mt-4 rounded-[10px] border border-[rgba(239,142,157,0.34)] bg-[rgba(97,39,50,0.2)] px-4 py-3 text-sm text-[var(--app-danger)]">
                    {approveMutation.error.message}
                  </div>
                ) : null}
              </div>

              <div className="rounded-[12px] border border-[var(--app-border)] bg-[rgba(13,18,25,0.74)] p-4 text-sm text-[var(--app-text-muted)]">
                <p className="text-xs uppercase tracking-[0.16em] text-[var(--app-text-soft)]">
                  完成时间
                </p>
                <p className="app-data mt-3 text-[15px] text-[var(--app-text)]">
                  {formatDate(run.completedAt)}
                </p>
                <p className="mt-4 text-xs uppercase tracking-[0.16em] text-[var(--app-text-soft)]">
                  Run ID
                </p>
                <p className="app-data mt-3 break-all text-[11px] text-[var(--app-text-soft)]">
                  {runId}
                </p>
              </div>
            </div>
          </Panel>

          {companyResult ? (
            <>
              <Panel
                title="投资判断"
                description="先看公司研究最终 stance，再决定是否继续下钻问题与证据。"
              >
                <div className="grid gap-4 lg:grid-cols-[220px_minmax(0,1fr)]">
                  <div className="rounded-[12px] border border-[var(--app-border)] bg-[rgba(13,18,25,0.72)] p-4">
                    <p className="text-xs uppercase tracking-[0.16em] text-[var(--app-text-soft)]">
                      结论
                    </p>
                    <p className="app-display mt-3 text-2xl text-[var(--app-text)]">
                      {companyResult.verdict.stance}
                    </p>
                    <div className="mt-4 flex flex-wrap gap-2">
                      {companyResult.brief.focusConcepts.map((concept) => (
                        <StatusPill key={concept} label={concept} tone="info" />
                      ))}
                    </div>
                  </div>
                  <div className="rounded-[12px] border border-[var(--app-border)] bg-[rgba(13,18,25,0.72)] p-4">
                    <p className="text-sm leading-7 text-[var(--app-text)]">
                      {companyResult.verdict.summary}
                    </p>
                    <div className="mt-4 grid gap-4 md:grid-cols-3">
                      <div>
                        <p className="text-xs uppercase tracking-[0.16em] text-[var(--app-text-soft)]">
                          看多要点
                        </p>
                        <div className="mt-3 space-y-2 text-sm text-[var(--app-text-muted)]">
                          {companyResult.verdict.bullPoints.map((item) => (
                            <p key={item}>{item}</p>
                          ))}
                        </div>
                      </div>
                      <div>
                        <p className="text-xs uppercase tracking-[0.16em] text-[var(--app-text-soft)]">
                          风险要点
                        </p>
                        <div className="mt-3 space-y-2 text-sm text-[var(--app-text-muted)]">
                          {companyResult.verdict.bearPoints.map((item) => (
                            <p key={item}>{item}</p>
                          ))}
                        </div>
                      </div>
                      <div>
                        <p className="text-xs uppercase tracking-[0.16em] text-[var(--app-text-soft)]">
                          后续核验
                        </p>
                        <div className="mt-3 space-y-2 text-sm text-[var(--app-text-muted)]">
                          {companyResult.verdict.nextChecks.map((item) => (
                            <p key={item}>{item}</p>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </Panel>

              <div className="grid gap-6 xl:grid-cols-3">
                <Panel
                  title="概念解析"
                  description="重点看概念、商业化路径和阶段判断。"
                >
                  <div className="grid gap-3">
                    {companyResult.conceptInsights.map((item) => (
                      <article
                        key={item.concept}
                        className="rounded-[12px] border border-[var(--app-border)] bg-[rgba(13,18,25,0.72)] p-4"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <p className="text-[15px] font-medium text-[var(--app-text)]">
                            {item.concept}
                          </p>
                          <StatusPill label={item.maturity} tone="info" />
                        </div>
                        <div className="mt-3 space-y-2 text-sm leading-6 text-[var(--app-text-muted)]">
                          <p>{item.whyItMatters}</p>
                          <p>{item.companyFit}</p>
                          <p>{item.monetizationPath}</p>
                        </div>
                      </article>
                    ))}
                  </div>
                </Panel>

                <Panel
                  title="深问题与回答"
                  description="优先找出尚未被充分披露、但最影响投资判断的变量。"
                >
                  <div className="grid gap-3">
                    {companyResult.findings.map((item, index) => {
                      const question = companyResult.deepQuestions[index];
                      return (
                        <article
                          key={item.question}
                          className="rounded-[12px] border border-[var(--app-border)] bg-[rgba(13,18,25,0.72)] p-4"
                        >
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <p className="text-[15px] font-medium text-[var(--app-text)]">
                              {item.question}
                            </p>
                            <StatusPill
                              label={item.confidence}
                              tone="warning"
                            />
                          </div>
                          <p className="mt-3 text-sm leading-6 text-[var(--app-text)]">
                            {item.answer}
                          </p>
                          {question ? (
                            <p className="mt-3 text-xs leading-5 text-[var(--app-text-soft)]">
                              目标指标: {question.targetMetric}
                            </p>
                          ) : null}
                          {item.gaps.length > 0 ? (
                            <div className="mt-3 space-y-1 text-xs text-[var(--app-text-muted)]">
                              {item.gaps.map((gap) => (
                                <p key={gap}>- {gap}</p>
                              ))}
                            </div>
                          ) : null}
                        </article>
                      );
                    })}
                  </div>
                </Panel>

                <Panel
                  title="网页证据"
                  description="Firecrawl 抓到的网页证据会优先出现在这里。"
                >
                  <div className="grid gap-3">
                    <article className="rounded-[12px] border border-[var(--app-border)] bg-[rgba(13,18,25,0.72)] p-4">
                      <div className="flex flex-wrap items-center gap-2">
                        <StatusPill
                          label={
                            companyResult.crawler.configured
                              ? "Firecrawl 已启用"
                              : "Firecrawl 未配置"
                          }
                          tone={
                            companyResult.crawler.configured
                              ? "success"
                              : "warning"
                          }
                        />
                        <span className="text-xs text-[var(--app-text-soft)]">
                          查询数 {companyResult.crawler.queries.length}
                        </span>
                      </div>
                      <div className="mt-3 space-y-1 text-xs text-[var(--app-text-muted)]">
                        {companyResult.crawler.queries.map((query) => (
                          <p key={query}>{query}</p>
                        ))}
                      </div>
                      {companyResult.crawler.notes.length > 0 ? (
                        <div className="mt-3 space-y-1 text-xs text-[var(--app-text-muted)]">
                          {companyResult.crawler.notes.map((note) => (
                            <p key={note}>- {note}</p>
                          ))}
                        </div>
                      ) : null}
                    </article>

                    {companyResult.evidence.map((item) => (
                      <article
                        key={item.url}
                        className="rounded-[12px] border border-[var(--app-border)] bg-[rgba(13,18,25,0.72)] p-4"
                      >
                        <div className="flex flex-wrap items-center gap-2">
                          <StatusPill label={item.sourceType} tone="info" />
                          <a
                            href={item.url}
                            target="_blank"
                            rel="noreferrer"
                            className="text-sm text-[var(--app-accent-strong)] hover:underline"
                          >
                            {item.title}
                          </a>
                        </div>
                        <p className="mt-3 text-sm leading-6 text-[var(--app-text)]">
                          {item.extractedFact}
                        </p>
                        <p className="mt-2 text-xs leading-5 text-[var(--app-text-muted)]">
                          {item.snippet}
                        </p>
                      </article>
                    ))}
                  </div>
                </Panel>
              </div>
            </>
          ) : resultHighlights.length > 0 ? (
            <Panel
              title="研究结论摘要"
              description="先看压缩后的结构化要点，再决定是否展开原始结果。"
            >
              <div className="grid gap-3 md:grid-cols-2">
                {resultHighlights.map((item) => (
                  <article
                    key={item.key}
                    className="rounded-[12px] border border-[var(--app-border)] bg-[rgba(13,18,25,0.72)] p-4"
                  >
                    <p className="text-xs uppercase tracking-[0.16em] text-[var(--app-text-soft)]">
                      {item.key}
                    </p>
                    <p className="mt-3 text-sm leading-6 text-[var(--app-text)]">
                      {item.value}
                    </p>
                  </article>
                ))}
              </div>
            </Panel>
          ) : null}

          <div className="grid gap-6 xl:grid-cols-[1.02fr_0.98fr]">
            <Panel
              title="研究步骤状态"
              description="每个节点保留处理器、起止时间和错误信息。"
            >
              {run.nodes.length === 0 ? (
                <EmptyState
                  title="还没有节点状态"
                  description="工作流开始执行后，节点状态会按顺序出现在这里。"
                />
              ) : (
                <div className="grid gap-3">
                  {run.nodes.map((node) => (
                    <article
                      key={node.id}
                      className="rounded-[12px] border border-[var(--app-border)] bg-[rgba(13,18,25,0.72)] p-4"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <p className="text-[15px] font-medium text-[var(--app-text)]">
                            {node.nodeKey}
                          </p>
                          <p className="mt-1 text-xs text-[var(--app-text-soft)]">
                            处理器: {node.agentName}
                          </p>
                        </div>
                        <StatusPill
                          label={statusLabels[node.status] ?? node.status}
                          tone={statusTone(node.status)}
                        />
                      </div>

                      <div className="mt-3 grid gap-2 text-xs text-[var(--app-text-muted)] sm:grid-cols-3">
                        <p>开始: {formatDate(node.startedAt)}</p>
                        <p>结束: {formatDate(node.completedAt)}</p>
                        <p className="app-data">
                          耗时: {node.durationMs ?? "-"} ms
                        </p>
                      </div>

                      {node.errorMessage ? (
                        <div className="mt-4 rounded-[10px] border border-[rgba(239,142,157,0.34)] bg-[rgba(97,39,50,0.2)] px-4 py-3 text-sm text-[var(--app-danger)]">
                          {node.errorCode ? `${node.errorCode}: ` : ""}
                          {node.errorMessage}
                        </div>
                      ) : null}
                    </article>
                  ))}
                </div>
              )}
            </Panel>

            <Panel
              title="事件时间线"
              description="数据库事件和 SSE 实时事件会自动合并，按序号倒序展示。"
            >
              {timeline.length === 0 ? (
                <EmptyState
                  title="暂无事件"
                  description="只要工作流开始产生日志，时间线会立刻在这里滚动更新。"
                />
              ) : (
                <div className="grid gap-2">
                  {timeline.map((event) => (
                    <article
                      key={`${event.sequence}-${event.type}`}
                      className="rounded-[12px] border border-[var(--app-border)] bg-[rgba(13,18,25,0.72)] px-4 py-3"
                    >
                      <div className="flex flex-wrap items-center gap-2">
                        <StatusPill
                          label={`#${event.sequence}`}
                          tone="neutral"
                        />
                        <StatusPill label={event.type} tone="info" />
                        <span className="text-xs text-[var(--app-text-soft)]">
                          {event.nodeKey ?? "主流程"}
                        </span>
                      </div>
                      <p className="app-data mt-3 text-[11px] text-[var(--app-text-soft)]">
                        {formatDate(event.timestamp)}
                      </p>
                    </article>
                  ))}
                </div>
              )}

              {streamError ? (
                <div className="mt-4 rounded-[10px] border border-[rgba(226,181,111,0.34)] bg-[rgba(86,60,23,0.2)] px-4 py-3 text-sm text-[var(--app-warning)]">
                  {streamError}
                </div>
              ) : null}
            </Panel>
          </div>

          <Panel
            title="原始结果 JSON"
            description="需要更细节的研究输出时，再展开完整结果对象。"
          >
            <pre className="app-data app-scroll overflow-auto rounded-[10px] border border-[var(--app-border)] bg-[rgba(10,14,18,0.88)] p-4 text-xs leading-6 text-[var(--app-accent-strong)]">
              {JSON.stringify(run.result ?? {}, null, 2)}
            </pre>
          </Panel>
        </>
      )}
    </WorkspaceShell>
  );
}
