"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import {
  ActionStrip,
  EmptyState,
  InlineNotice,
  SectionCard,
  StatusPill,
  WorkspaceShell,
} from "~/app/_components/ui";
import { api, type RouterOutputs } from "~/trpc/react";

type SpaceSummary = RouterOutputs["space"]["list"][number];

function parseDelimitedParam(value: string | null) {
  return value
    ? value
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean)
    : [];
}

function parsePendingStocks(searchParams: URLSearchParams) {
  const stockCodes = parseDelimitedParam(searchParams.get("stockCodes"));
  const stockNames = parseDelimitedParam(searchParams.get("stockNames"));

  return stockCodes.map((stockCode, index) => ({
    stockCode,
    stockName: stockNames[index] ?? stockCode,
  }));
}

export function SpacesClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const utils = api.useUtils();
  const [notice, setNotice] = useState<string | null>(null);
  const [archiveNote, setArchiveNote] = useState("");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [researchGoal, setResearchGoal] = useState("");
  const [coreThesis, setCoreThesis] = useState("");
  const [keyQuestions, setKeyQuestions] = useState("");
  const [focusDimensions, setFocusDimensions] = useState("");
  const [notes, setNotes] = useState("");

  const addRunId = searchParams.get("addRunId");
  const watchListId = searchParams.get("watchListId");
  const pendingStocks = useMemo(
    () => parsePendingStocks(searchParams),
    [searchParams],
  );

  const spacesQuery = api.space.list.useQuery({
    limit: 50,
    offset: 0,
  });
  const pendingRunQuery = api.workflow.getRun.useQuery(
    { runId: addRunId ?? "" },
    {
      enabled: Boolean(addRunId),
      refetchOnWindowFocus: false,
    },
  );
  const pendingWatchListQuery = api.watchlist.getDetail.useQuery(
    { id: watchListId ?? "" },
    {
      enabled: Boolean(watchListId),
      refetchOnWindowFocus: false,
    },
  );

  const createMutation = api.space.create.useMutation({
    onSuccess: async () => {
      await utils.space.list.invalidate();
    },
  });
  const addRunMutation = api.space.addRun.useMutation();
  const linkWatchlistMutation = api.space.linkWatchlist.useMutation();
  const linkStocksMutation = api.space.linkStocks.useMutation();

  async function attachPendingContext(spaceId: string) {
    if (addRunId) {
      await addRunMutation.mutateAsync({
        spaceId,
        runId: addRunId,
        note: archiveNote.trim() || undefined,
      });
    }

    if (watchListId) {
      await linkWatchlistMutation.mutateAsync({
        spaceId,
        watchListId,
      });
    }

    if (pendingStocks.length > 0) {
      await linkStocksMutation.mutateAsync({
        spaceId,
        stocks: pendingStocks,
      });
    }

    if (addRunId || watchListId || pendingStocks.length > 0) {
      setNotice("已完成当前待处理上下文的归档/关联。");
      router.replace("/spaces");
      await Promise.all([
        utils.space.list.invalidate(),
        utils.space.getDetail.invalidate(),
      ]);
    }
  }

  async function handleCreateSpace() {
    const created = await createMutation.mutateAsync({
      name: name.trim(),
      description: description.trim() || null,
      brief: {
        researchGoal: researchGoal.trim(),
        coreThesis: coreThesis.trim(),
        keyQuestions: keyQuestions
          .split("\n")
          .map((item) => item.trim())
          .filter(Boolean),
        focusDimensions: focusDimensions
          .split("\n")
          .map((item) => item.trim())
          .filter(Boolean),
        notes: notes.trim(),
      },
    });

    setName("");
    setDescription("");
    setResearchGoal("");
    setCoreThesis("");
    setKeyQuestions("");
    setFocusDimensions("");
    setNotes("");

    await attachPendingContext(created.id);
  }

  const pendingContext =
    pendingRunQuery.data ||
    pendingWatchListQuery.data ||
    pendingStocks.length > 0;

  return (
    <WorkspaceShell
      section="spaces"
      eyebrow="Research Space"
      title="研究空间"
      description="把 thesis、关键问题、关联标的和运行过的 session 聚合到一个长期研究容器里。"
      actions={
        <Link href="/watchlists" className="app-button app-button-primary">
          打开自选股列表
        </Link>
      }
    >
      {pendingContext ? (
        <ActionStrip
          title="当前有待处理的归档/关联上下文"
          description={
            pendingRunQuery.data
              ? `待加入 Space 的运行记录：${pendingRunQuery.data.query}`
              : pendingWatchListQuery.data
                ? `待关联的自选股列表：${pendingWatchListQuery.data.name}`
                : `待关联的股票：${pendingStocks.map((item) => item.stockName).join("、")}`
          }
          tone="warning"
        />
      ) : null}

      {notice ? <InlineNotice tone="success" description={notice} /> : null}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.05fr)_380px]">
        <SectionCard
          title="已有研究空间"
          description="空间是项目容器，run 不会自动归档，必须手动加入。"
        >
          {spacesQuery.isLoading ? (
            <EmptyState title="正在加载研究空间" />
          ) : (spacesQuery.data ?? []).length === 0 ? (
            <EmptyState title="还没有 Research Space" />
          ) : (
            <div className="grid gap-4">
              {(spacesQuery.data ?? []).map((space: SpaceSummary) => (
                <article
                  key={space.id}
                  className="rounded-[16px] border border-[var(--app-border-soft)] bg-[var(--app-surface)] p-5"
                >
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <StatusPill
                          label={`${space.runCount} runs`}
                          tone="info"
                        />
                        <StatusPill
                          label={`${space.watchListCount} watchlists`}
                          tone="neutral"
                        />
                        <StatusPill
                          label={`${space.stockCount} stocks`}
                          tone="success"
                        />
                      </div>
                      <h2 className="mt-3 text-xl text-[var(--app-text-strong)]">
                        {space.name}
                      </h2>
                      <p className="mt-2 text-sm leading-6 text-[var(--app-text-muted)]">
                        {space.brief.coreThesis ||
                          space.description ||
                          "暂无 thesis 摘要"}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Link
                        href={`/spaces/${space.id}`}
                        className="app-button app-button-primary"
                      >
                        打开空间
                      </Link>
                      {pendingContext ? (
                        <button
                          type="button"
                          onClick={() => void attachPendingContext(space.id)}
                          className="app-button"
                        >
                          加入当前上下文
                        </button>
                      ) : null}
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}
        </SectionCard>

        <SectionCard
          title="创建 Research Space"
          description="v1 使用半结构化 brief，后续发起行业/公司/筛选/择时时会预填，但仍可编辑。"
        >
          <div className="grid gap-3">
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="空间名称"
              className="app-input"
            />
            <input
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="一句话说明"
              className="app-input"
            />
            <textarea
              value={researchGoal}
              onChange={(event) => setResearchGoal(event.target.value)}
              placeholder="研究目标"
              className="app-textarea min-h-[90px]"
            />
            <textarea
              value={coreThesis}
              onChange={(event) => setCoreThesis(event.target.value)}
              placeholder="Core thesis"
              className="app-textarea min-h-[120px]"
            />
            <textarea
              value={keyQuestions}
              onChange={(event) => setKeyQuestions(event.target.value)}
              placeholder="关键问题，每行一条"
              className="app-textarea min-h-[90px]"
            />
            <textarea
              value={focusDimensions}
              onChange={(event) => setFocusDimensions(event.target.value)}
              placeholder="关注维度，每行一条"
              className="app-textarea min-h-[90px]"
            />
            <textarea
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              placeholder="补充说明"
              className="app-textarea min-h-[90px]"
            />
            {addRunId ? (
              <textarea
                value={archiveNote}
                onChange={(event) => setArchiveNote(event.target.value)}
                placeholder="可选：这条 run 为什么应该进入这个 Space"
                className="app-textarea min-h-[80px]"
              />
            ) : null}
            <button
              type="button"
              onClick={() => void handleCreateSpace()}
              disabled={createMutation.isPending || !name.trim()}
              className="app-button app-button-primary"
            >
              {createMutation.isPending ? "创建中..." : "创建空间"}
            </button>
          </div>
        </SectionCard>
      </div>
    </WorkspaceShell>
  );
}
