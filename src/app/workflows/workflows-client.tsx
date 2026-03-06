"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { api } from "~/trpc/react";

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

const statusColorMap: Record<string, string> = {
  PENDING: "text-[#ffd180]",
  RUNNING: "text-[#71dcff]",
  SUCCEEDED: "text-[#63f2c1]",
  FAILED: "text-[#ff93a2]",
  CANCELLED: "text-[#b3c5d7]",
};

export function WorkflowsClient() {
  const router = useRouter();
  const utils = api.useUtils();
  const [query, setQuery] = useState("");
  const [idempotencyKey, setIdempotencyKey] = useState("");

  const runsQuery = api.workflow.listRuns.useQuery({
    limit: 20,
  });

  const startMutation = api.workflow.startQuickResearch.useMutation({
    onSuccess: async (result) => {
      await utils.workflow.listRuns.invalidate();
      router.push(`/workflows/${result.runId}`);
    },
  });

  const cancelMutation = api.workflow.cancelRun.useMutation({
    onSuccess: async () => {
      await utils.workflow.listRuns.invalidate();
    },
  });

  const sortedRuns = useMemo(() => {
    return [...(runsQuery.data?.items ?? [])].sort((left, right) => {
      return (
        (right.createdAt?.getTime?.() ?? 0) - (left.createdAt?.getTime?.() ?? 0)
      );
    });
  }, [runsQuery.data?.items]);

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
    <main className="market-shell px-6 py-10 text-[var(--market-text)]">
      <div className="market-frame flex w-full max-w-6xl flex-col gap-6">
        <header className="market-panel rounded-3xl p-6 md:p-8">
          <p className="font-[family-name:var(--font-display)] text-xs tracking-[0.35em] text-[#8cdfff]">
            WORKFLOW STUDIO
          </p>
          <h1 className="mt-3 font-[family-name:var(--font-display)] text-3xl font-semibold tracking-tight text-[#eef7ff] md:text-4xl">
            LangGraph 快速行业研究
          </h1>
          <p className="mt-3 max-w-3xl text-sm leading-7 text-[#9db6cd]">
            固定 5-Agent 工作流已接入异步执行。输入赛道关键词后将立即返回
            runId，后台 Worker 继续执行并推送实时进度。
          </p>
          <div className="mt-5 flex flex-wrap gap-3">
            <Link
              href="/"
              className="rounded-full border border-[#49657f] bg-[#0b182a]/70 px-4 py-2 text-sm text-[#caddef] transition hover:border-[#74cfff] hover:text-[#e6f6ff]"
            >
              返回首页
            </Link>
          </div>
        </header>

        <section className="market-panel rounded-2xl p-5">
          <h2 className="font-[family-name:var(--font-display)] text-lg font-semibold text-[#edf6ff]">
            发起新任务
          </h2>
          <div className="mt-4 grid gap-3 md:grid-cols-[2fr_1fr_auto]">
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="例如：快速了解 AI 算力赛道"
              className="rounded-xl border border-[#4d6d87] bg-[#09172a] px-4 py-3 text-sm text-[#e7f3ff] placeholder:text-[#6c89a7] focus:border-[#5fd8ff] focus:outline-none"
            />
            <input
              value={idempotencyKey}
              onChange={(event) => setIdempotencyKey(event.target.value)}
              placeholder="幂等键（可选）"
              className="rounded-xl border border-[#4d6d87] bg-[#09172a] px-4 py-3 text-sm text-[#e7f3ff] placeholder:text-[#6c89a7] focus:border-[#5fd8ff] focus:outline-none"
            />
            <button
              type="button"
              onClick={handleStart}
              disabled={startMutation.isPending}
              className="market-button-primary rounded-xl px-4 py-3 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-60"
            >
              {startMutation.isPending ? "创建中..." : "启动研究"}
            </button>
          </div>
          {startMutation.error ? (
            <p className="mt-3 rounded-lg border border-[#ff7f92]/45 bg-[#5b2432]/45 px-3 py-2 text-xs text-[#ffbdc8]">
              {startMutation.error.message}
            </p>
          ) : null}
        </section>

        <section className="market-panel rounded-2xl p-5">
          <div className="flex items-center justify-between">
            <h2 className="font-[family-name:var(--font-display)] text-lg font-semibold text-[#edf6ff]">
              最近运行
            </h2>
            <button
              type="button"
              onClick={() => runsQuery.refetch()}
              className="rounded-full border border-[#4c6883] px-3 py-1 text-xs text-[#9cb6cd] transition hover:border-[#6fd8ff] hover:text-[#d8f2ff]"
            >
              刷新
            </button>
          </div>

          {runsQuery.isLoading ? (
            <p className="mt-4 text-sm text-[#9db7cf]">加载中...</p>
          ) : sortedRuns.length === 0 ? (
            <p className="mt-4 text-sm text-[#859fb9]">暂无运行记录。</p>
          ) : (
            <div className="mt-4 grid gap-3">
              {sortedRuns.map((run) => (
                <article
                  key={run.id}
                  className="market-soft-panel grid gap-3 rounded-xl p-4 md:grid-cols-[2fr_1fr_1fr_auto]"
                >
                  <div>
                    <p className="text-sm text-[#d8e9f8]">{run.query}</p>
                    <p className="market-data mt-1 text-xs text-[#7895b2]">
                      runId: {run.id}
                    </p>
                    <p className="mt-1 text-xs text-[#7895b2]">
                      创建于 {formatDate(run.createdAt)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-[#7895b2]">状态</p>
                    <p
                      className={`text-sm font-semibold ${statusColorMap[run.status] ?? "text-[#d6e8f8]"}`}
                    >
                      {run.status}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-[#7895b2]">进度</p>
                    <p className="market-data text-sm text-[#66daff]">
                      {run.progressPercent}%
                    </p>
                    <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-[#0b1b2f]">
                      <div
                        className="h-full rounded-full bg-[#48d9ff] transition-all"
                        style={{ width: `${run.progressPercent}%` }}
                      />
                    </div>
                  </div>
                  <div className="flex items-start justify-end gap-2">
                    <Link
                      href={`/workflows/${run.id}`}
                      className="rounded-full border border-[#5ecfff]/70 px-3 py-1 text-xs text-[#89deff] transition hover:bg-[#175a80]/35"
                    >
                      详情
                    </Link>
                    {(run.status === "PENDING" || run.status === "RUNNING") && (
                      <button
                        type="button"
                        onClick={() => cancelMutation.mutate({ runId: run.id })}
                        className="rounded-full border border-[#f6bf63]/70 px-3 py-1 text-xs text-[#ffd695] transition hover:bg-[#5f4620]/35"
                      >
                        取消
                      </button>
                    )}
                  </div>
                </article>
              ))}
            </div>
          )}

          {runsQuery.error ? (
            <p className="mt-4 rounded-lg border border-[#ff7f92]/45 bg-[#5b2432]/45 px-3 py-2 text-xs text-[#ffbdc8]">
              {runsQuery.error.message}
            </p>
          ) : null}
        </section>
      </div>
    </main>
  );
}
