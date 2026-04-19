"use client";

import Link from "next/link";
import { InlineNotice, SectionCard, StatusPill } from "~/app/_components/ui";
import {
  buildMarketContextHref,
  findMatchingHotThemes,
  type MarketContextSectionTarget,
} from "~/app/market-context/market-context-links";
import { api } from "~/trpc/react";

const regimeToneMap = {
  risk_on: "success",
  neutral: "info",
  risk_off: "warning",
  unknown: "neutral",
} as const;

const regimeLabelMap = {
  risk_on: "风险偏好修复",
  neutral: "中性环境",
  risk_off: "防守环境",
  unknown: "环境待确认",
} as const;

const flowToneMap = {
  inflow: "success",
  outflow: "warning",
  flat: "info",
  unknown: "neutral",
} as const;

const flowLabelMap = {
  inflow: "北向净流入",
  outflow: "北向净流出",
  flat: "北向平衡",
  unknown: "北向待确认",
} as const;

const refreshSourceLabelMap = {
  INITIAL: "首次创建",
  MANUAL: "手动刷新",
  AUTO: "自动刷新",
} as const;

const actionLabelMap: Record<MarketContextSectionTarget, string> = {
  workflows: "发起行业研究",
  companyResearch: "打开公司研究",
  screening: "导入种子池",
  timing: "打开择时",
};

function formatRefreshTimestamp(value: string | null) {
  if (!value) {
    return "暂无";
  }

  return new Intl.DateTimeFormat("zh-CN", {
    timeZone: "Asia/Shanghai",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(value));
}

export function MarketContextSection(props: {
  section: MarketContextSectionTarget;
  currentStockCodes?: string[];
}) {
  const { section, currentStockCodes = [] } = props;
  const utils = api.useUtils();
  const snapshotQuery = api.marketContext.getSnapshot.useQuery(undefined, {
    refetchOnWindowFocus: false,
  });
  const refreshMutation = api.marketContext.refreshSnapshot.useMutation({
    onSuccess: (data) => {
      utils.marketContext.getSnapshot.setData(undefined, data);
    },
  });

  const refreshButton = (
    <button
      type="button"
      onClick={() => refreshMutation.mutate()}
      className="app-button"
      disabled={refreshMutation.isPending}
    >
      {refreshMutation.isPending ? "刷新中..." : "刷新"}
    </button>
  );

  if (snapshotQuery.isLoading) {
    return (
      <SectionCard
        title="市场上下文"
        description="正在读取宏观慢变量、资金方向和热门主题。"
        actions={refreshButton}
      >
        <div className="text-sm leading-6 text-[var(--app-text-muted)]">
          正在整理当前市场环境。
        </div>
      </SectionCard>
    );
  }

  if (snapshotQuery.isError || !snapshotQuery.data) {
    return (
      <SectionCard
        title="市场上下文"
        description="当前未能获取完整市场上下文。"
        actions={refreshButton}
      >
        <InlineNotice
          tone="warning"
          description={
            refreshMutation.error?.message ??
            snapshotQuery.error?.message ??
            "市场上下文暂不可用。"
          }
        />
      </SectionCard>
    );
  }

  const snapshot = snapshotQuery.data.snapshot;
  const refreshState = snapshotQuery.data.refreshState;
  const sectionHint = snapshot.downstreamHints[section];
  const hotThemes = snapshot.hotThemes.slice(0, 3);
  const matchedThemes = findMatchingHotThemes(hotThemes, currentStockCodes);
  const statusLabel =
    snapshot.status === "complete"
      ? "上下文完整"
      : snapshot.status === "partial"
        ? "上下文部分可用"
        : "上下文待补齐";

  return (
    <SectionCard
      title="市场上下文"
      description={sectionHint.summary}
      actions={refreshButton}
    >
      <div className="grid gap-4">
        <div className="flex flex-wrap gap-2">
          <StatusPill
            label={regimeLabelMap[snapshot.regime.overallTone]}
            tone={regimeToneMap[snapshot.regime.overallTone]}
          />
          <StatusPill
            label={flowLabelMap[snapshot.flow.direction]}
            tone={flowToneMap[snapshot.flow.direction]}
          />
          <StatusPill label={statusLabel} tone="neutral" />
          <StatusPill
            label={`更新 ${formatRefreshTimestamp(refreshState.lastSuccessfulRefreshAt)}`}
            tone="neutral"
          />
          <StatusPill
            label={refreshSourceLabelMap[refreshState.source]}
            tone="info"
          />
        </div>

        <div className="grid gap-2 text-sm leading-6 text-[var(--app-text-muted)]">
          <p>{snapshot.regime.summary}</p>
          <p>{snapshot.flow.summary}</p>
        </div>

        {refreshState.lastRefreshError ? (
          <InlineNotice
            tone="warning"
            description={refreshState.lastRefreshError}
          />
        ) : null}

        {matchedThemes.length > 0 ? (
          <InlineNotice
            tone="info"
            description={`当前选择命中热门主题：${matchedThemes.join("、")}。`}
          />
        ) : null}

        {hotThemes.length === 0 ? (
          <InlineNotice
            tone="warning"
            description="当前没有可用的热门主题结果。"
          />
        ) : (
          <div className="grid gap-3 xl:grid-cols-3">
            {hotThemes.map((theme) => (
              <div
                key={theme.theme}
                className="rounded-[14px] border border-[var(--app-border-soft)] bg-[var(--app-panel-soft)] p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-xs tracking-[0.08em] text-[var(--app-text-subtle)]">
                      热门主题
                    </div>
                    <div className="mt-2 text-lg leading-7 text-[var(--app-text-strong)]">
                      {theme.theme}
                    </div>
                  </div>
                  <StatusPill
                    label={`热度 ${theme.heatScore.toFixed(0)}`}
                    tone="info"
                  />
                </div>
                <p className="mt-3 text-sm leading-6 text-[var(--app-text-muted)]">
                  {theme.whyHot}
                </p>
                <div className="mt-3 text-xs leading-5 text-[var(--app-text-subtle)]">
                  候选股：
                  {theme.candidateStocks.length > 0
                    ? ` ${theme.candidateStocks
                        .slice(0, 3)
                        .map((item) => item.stockName)
                        .join("、")}`
                    : " 暂无"}
                </div>
                <div className="mt-4">
                  <Link
                    href={buildMarketContextHref({
                      section,
                      theme,
                      snapshot,
                    })}
                    className="app-button app-button-primary"
                  >
                    {actionLabelMap[section]}
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </SectionCard>
  );
}
