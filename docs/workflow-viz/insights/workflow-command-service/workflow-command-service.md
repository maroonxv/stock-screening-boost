# 热点洞察：command-service.ts

- 源文件: `src/server/application/workflow/command-service.ts`
- 实际阅读入口: `startWatchlistTimingPipeline()` -> `startWorkflow()`
- 推荐配套阅读: [`watchlist-timing-graph`](../langgraph-watchlist-timing-graph/analysis.md)
- 这页重点: 搞清楚“前端点击生成组合建议”之后，系统怎样生成一个可执行的 workflow run

这个文件的难点在于它同时服务很多种工作流模板，`startWatchlistTimingPipeline()` 只是其中一条分支。阅读时不要平均分配注意力，先抓住“组合建议入口如何组装命令”，再看通用的 `startWorkflow()` 如何做幂等、模板补齐和 run 创建。

## 架构图组

### 架构总览图

图前说明：这张图回答“router 把请求交给谁，以及 service 再向谁申请可执行的 run”。

![架构总览图](../../charts/src-server-application-workflow-command-service-ts-b8963d50-architecture-context.svg)

图后解读：对择时组合来说，`workflow.ts` router 只负责校验 `watchListId / portfolioSnapshotId / presetId` 是否存在；真正的工作是在 `WorkflowCommandService` 里把它们翻译成 query、templateCode、input、idempotencyKey，随后交给 `PrismaWorkflowRunRepository` 产出 run。

### 模块拆解图

图前说明：内部职责其实可以拆成“命令翻译层”“通用启动层”“运行状态修正层”三块。

![模块拆解图](../../charts/src-server-application-workflow-command-service-ts-b8963d50-architecture-modules.svg)

图后解读：`startWatchlistTimingPipeline()` 这种公开方法只是命令翻译层；复杂度真正集中在 `startWorkflow()`。如果以后要新增新的 timing pipeline，优先复用 `startWorkflow()`，不要复制模板解析和幂等逻辑。

### 依赖职责图

图前说明：重点看 repository 和 runtimeStore 各自负责什么。

![依赖职责图](../../charts/src-server-application-workflow-command-service-ts-b8963d50-architecture-dependencies.svg)

图后解读：repository 负责模板与 run 的持久化边界，`runtimeStore` 只在恢复、事件发布等运行期场景中出场。组合建议启动链路本身几乎完全围绕 repository 展开。

## 主流程活动图

### 主流程活动图

图前说明：沿着 `startWatchlistTimingPipeline()` 进入，再切到 `startWorkflow()` 看通用步骤。

![主流程活动图](../../charts/src-server-application-workflow-command-service-ts-b8963d50-activity.svg)

图后解读：最关键的 4 步是：
1. 把 watchlist、snapshot、preset 翻译成 `query / input / templateCode / idempotencyKey`。
2. 如果幂等键命中已有运行，直接复用已有 run。
3. 按 `templateCode` 解析或自动补齐工作流模板。
4. 从 `graphConfig` 提取节点顺序并创建新的 workflow run。

## 协作顺序图

### 协作顺序图

图前说明：看“命中已有 run”和“真正创建新 run”这两条时序谁更早发生。

![协作顺序图](../../charts/src-server-application-workflow-command-service-ts-b8963d50-sequence.svg)

图后解读：时序上最容易漏掉的是幂等短路。只要 `idempotencyKey` 对应的 pending/running run 已经存在，后面的模板解析、节点提取、创建 run 都不会发生。

## 分支判定图

### 分支判定图

图前说明：这张图只看会改变返回结果的关键守卫。

![分支判定图](../../charts/src-server-application-workflow-command-service-ts-b8963d50-branch-decision.svg)

图后解读：对组合建议链路来说，最重要的分支有三个：幂等命中直接复用、模板不存在时按 `WATCHLIST_TIMING_PIPELINE_TEMPLATE_CODE` 自动补模板、模板存在但缺少节点配置时直接抛错。

## 状态图

### 状态图

图前说明：这张图帮助理解 command service 顺手还承担了哪些“运行态修正”职责。

![状态图](../../charts/src-server-application-workflow-command-service-ts-b8963d50-state.svg)

图后解读：虽然本次阅读重点是“启动组合建议 run”，但同一个 service 里还包着 `cancelRun()` 和 `approveScreeningInsights()`。所以它不只是 run creator，也是 workflow 生命周期的一部分。

## 异步/并发图

### 异步/并发图

图前说明：这一页看的是 repository IO 的顺序依赖，而不是业务图里的节点并发。

![异步/并发图](../../charts/src-server-application-workflow-command-service-ts-b8963d50-async-concurrency.svg)

图后解读：这个文件里的异步更像“多次远端持久化调用”。真正需要按顺序完成的是：查幂等 -> 找模板/补模板 -> 提取 nodeKeys -> `createRun()`。如果你在这里加并发，最容易破坏的就是幂等语义。

结尾总结：理解组合建议入口时，只记住一句就够了: `command-service` 负责把“业务上的一次组合建议请求”翻译成“平台里一条可运行的 workflow run 记录”。
