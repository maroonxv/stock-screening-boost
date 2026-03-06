"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
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

const statusStyles: Record<string, string> = {
  PENDING: "text-[#ffd180]",
  RUNNING: "text-[#71dcff]",
  SUCCEEDED: "text-[#63f2c1]",
  FAILED: "text-[#ff93a2]",
  CANCELLED: "text-[#b3c5d7]",
};

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

  return (
    <main className="market-shell px-6 py-10 text-[var(--market-text)]">
      <div className="market-frame flex w-full max-w-6xl flex-col gap-6">
        <header className="market-panel rounded-3xl p-6 md:p-8">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="font-[family-name:var(--font-display)] text-xs tracking-[0.35em] text-[#8cdfff]">
                RUN DETAIL
              </p>
              <h1 className="mt-3 font-[family-name:var(--font-display)] text-2xl font-semibold text-[#eef7ff] md:text-3xl">
                工作流运行详情
              </h1>
              <p className="market-data mt-2 text-xs text-[#88a3bf]">
                runId: {runId}
              </p>
            </div>
            <div className="flex gap-2">
              <Link
                href="/workflows"
                className="rounded-full border border-[#4d6882] px-4 py-2 text-sm text-[#c8dced] transition hover:border-[#73d0ff] hover:text-[#e4f5ff]"
              >
                返回列表
              </Link>
              {run && (run.status === "RUNNING" || run.status === "PENDING") ? (
                <button
                  type="button"
                  onClick={() => cancelMutation.mutate({ runId })}
                  className="rounded-full border border-[#f8bf64]/72 px-4 py-2 text-sm text-[#ffd697] transition hover:bg-[#5f4520]/35"
                >
                  取消任务
                </button>
              ) : null}
            </div>
          </div>
        </header>

        {!run ? (
          <section className="market-soft-panel rounded-2xl p-5 text-sm text-[#9eb8cf]">
            {runQuery.isLoading
              ? "加载运行信息..."
              : (runQuery.error?.message ?? "未找到该运行")}
          </section>
        ) : (
          <>
            <section className="grid gap-4 md:grid-cols-4">
              <article className="market-soft-panel rounded-2xl p-4">
                <p className="text-xs text-[#7f9ab5]">状态</p>
                <p
                  className={`mt-2 text-lg font-semibold ${statusStyles[run.status] ?? "text-[#d8e8f8]"}`}
                >
                  {run.status}
                </p>
              </article>
              <article className="market-soft-panel rounded-2xl p-4">
                <p className="text-xs text-[#7f9ab5]">当前节点</p>
                <p className="mt-2 text-sm text-[#cddff0]">
                  {run.currentNodeKey ?? "-"}
                </p>
              </article>
              <article className="market-soft-panel rounded-2xl p-4">
                <p className="text-xs text-[#7f9ab5]">创建时间</p>
                <p className="market-data mt-2 text-sm text-[#cddff0]">
                  {formatDate(run.createdAt)}
                </p>
              </article>
              <article className="market-soft-panel rounded-2xl p-4">
                <p className="text-xs text-[#7f9ab5]">完成时间</p>
                <p className="market-data mt-2 text-sm text-[#cddff0]">
                  {formatDate(run.completedAt)}
                </p>
              </article>
            </section>

            <section className="market-panel rounded-2xl p-5">
              <p className="text-sm text-[#cbddef]">任务主题: {run.query}</p>
              <div className="mt-3 h-3 w-full overflow-hidden rounded-full bg-[#0c1b2f]">
                <div
                  className="h-full rounded-full bg-[#4fd8ff] transition-all"
                  style={{ width: `${run.progressPercent}%` }}
                />
              </div>
              <p className="market-data mt-2 text-xs text-[#77deff]">
                总体进度 {run.progressPercent}%
              </p>
              {run.errorMessage ? (
                <p className="mt-3 rounded-lg border border-[#ff7f92]/45 bg-[#5a2432]/45 px-3 py-2 text-xs text-[#ffbdc8]">
                  {run.errorCode ? `${run.errorCode}: ` : ""}
                  {run.errorMessage}
                </p>
              ) : null}
            </section>

            <section className="market-panel rounded-2xl p-5">
              <h2 className="font-[family-name:var(--font-display)] text-lg font-semibold text-[#eef7ff]">
                节点状态
              </h2>
              <div className="mt-4 grid gap-3">
                {run.nodes.map((node) => (
                  <article
                    key={node.id}
                    className="market-soft-panel rounded-xl p-4"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <p className="text-sm font-medium text-[#d8e8f8]">
                          {node.nodeKey}
                        </p>
                        <p className="text-xs text-[#839db8]">
                          agent: {node.agentName}
                        </p>
                      </div>
                      <p
                        className={`text-sm ${statusStyles[node.status] ?? "text-[#d8e8f8]"}`}
                      >
                        {node.status}
                      </p>
                    </div>
                    <p className="market-data mt-2 text-xs text-[#8ca6c0]">
                      开始 {formatDate(node.startedAt)} | 结束{" "}
                      {formatDate(node.completedAt)} | 耗时{" "}
                      {node.durationMs ?? "-"} ms
                    </p>
                    {node.errorMessage ? (
                      <p className="mt-2 rounded-lg border border-[#ff7f92]/45 bg-[#5a2432]/45 px-3 py-2 text-xs text-[#ffbdc8]">
                        {node.errorCode ? `${node.errorCode}: ` : ""}
                        {node.errorMessage}
                      </p>
                    ) : null}
                  </article>
                ))}
              </div>
            </section>

            {run.result ? (
              <section className="rounded-2xl border border-[#4ce0af]/45 bg-[#12352f]/55 p-5">
                <h2 className="font-[family-name:var(--font-display)] text-lg font-semibold text-[#7cf7cd]">
                  最终报告
                </h2>
                <pre className="market-data mt-3 overflow-auto rounded-xl border border-[#4ce0af]/25 bg-[#071626]/90 p-4 text-xs leading-6 text-[#d4e8fa]">
                  {JSON.stringify(run.result, null, 2)}
                </pre>
              </section>
            ) : null}

            <section className="market-panel rounded-2xl p-5">
              <h2 className="font-[family-name:var(--font-display)] text-lg font-semibold text-[#eef7ff]">
                事件时间线
              </h2>
              {timeline.length === 0 ? (
                <p className="mt-3 text-sm text-[#8ca5be]">暂无事件。</p>
              ) : (
                <div className="mt-3 grid gap-2">
                  {timeline.map((event) => (
                    <article
                      key={`${event.sequence}-${event.type}`}
                      className="market-soft-panel rounded-lg px-3 py-2"
                    >
                      <p className="market-data text-xs text-[#8da7c1]">
                        #{event.sequence} · {event.type} ·{" "}
                        {event.nodeKey ?? "run"} · {formatDate(event.timestamp)}
                      </p>
                    </article>
                  ))}
                </div>
              )}
              {streamError ? (
                <p className="mt-3 rounded-lg border border-[#f6bf64]/45 bg-[#5d4621]/35 px-3 py-2 text-xs text-[#ffd697]">
                  {streamError}
                </p>
              ) : null}
            </section>
          </>
        )}
      </div>
    </main>
  );
}
