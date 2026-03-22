import { WorkflowHistoryClient } from "~/app/_components/workflow-history-client";
import {
  TIMING_REVIEW_LOOP_TEMPLATE_CODE,
  TIMING_SIGNAL_PIPELINE_TEMPLATE_CODE,
  WATCHLIST_TIMING_CARDS_PIPELINE_TEMPLATE_CODE,
  WATCHLIST_TIMING_PIPELINE_TEMPLATE_CODE,
} from "~/server/domain/workflow/types";

export default function TimingHistoryPage() {
  return (
    <WorkflowHistoryClient
      section="timing"
      eyebrow="择时组合历史"
      title="择时组合历史"
      description="按时间回看每次单股择时、批量信号、组合建议和复盘任务，方便核对这次产出的动作与上下文。"
      emptyTitle="还没有择时记录"
      searchPlaceholder="搜索股票代码、清单名、组合名、节点或报错"
      moduleHref="/timing"
      moduleLabel="返回择时组合"
      templateCodes={[
        TIMING_SIGNAL_PIPELINE_TEMPLATE_CODE,
        WATCHLIST_TIMING_CARDS_PIPELINE_TEMPLATE_CODE,
        WATCHLIST_TIMING_PIPELINE_TEMPLATE_CODE,
        TIMING_REVIEW_LOOP_TEMPLATE_CODE,
      ]}
      headerActions={[
        {
          href: "/screening/history",
          label: "机会池历史",
          tone: "success",
        },
      ]}
    />
  );
}
