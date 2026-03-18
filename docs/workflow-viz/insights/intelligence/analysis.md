# 公司研究热点地图

这页把本次 `workflow-viz` 定向扫描结果和源码分层对齐。可以把“为什么公司研究难读”浓缩成一句话：同一条主链跨了前端、工作流模板、LangGraph、执行 orchestrator、规则内核、工具门面、证据后处理 7 层，而且 graph 与 agent 两个文件里都混着历史实现。

## 扫描结果速览

| 文件 | 分数 | 难点摘要 | 建议先回答的问题 |
| --- | --- | --- | --- |
| `company-research-workflow-service.ts` | 85 | 多阶段编排 + 并发批次执行 + gap loop | 研究单元到底怎么跑？ |
| `company-research-agent-service.ts` | 82 | 旧 collector 与新后处理混在一起 | 证据怎么变结论？ |
| `command-service.ts` | 81 | 一个通用入口同时承载多条工作流 | 公司研究 run 怎么被创建？ |
| `company-research-client.tsx` | 78 | 表单状态、历史运行、跳转逻辑都在同一文件 | 页面把什么送给后端？ |
| `company-research-graph.ts` | 77 | V1/V2/V3/V4 并存 + pause/resume/fan-out | 当前线上到底走哪条图？ |
| `research-tool-registry.ts` | 68 | 多 provider 分支被藏在统一门面后面 | 数据到底从哪拿？ |
| `research-workflow-kernel.ts` | 65 | LLM 规划与 fallback 规则写在同一层 | 计划是如何形成的？ |

## 主链路先看哪几层

1. 前端入口：[`../company-research-client/company-research-client.md`](../company-research-client/company-research-client.md)
   `handleStart()` 负责清洗表单输入、组装 `researchPreferences`、发起 `startCompanyResearch`。
2. 工作流启动：[`../workflow-command-service/workflow-command-service.md`](../workflow-command-service/workflow-command-service.md)
   `startCompanyResearch()` 只是薄适配层，真正复杂的是 `startWorkflow()` 里的幂等校验与模板补齐。
3. 图编排：[`../langgraph-company-research-graph/langgraph-company-research-graph.md`](../langgraph-company-research-graph/langgraph-company-research-graph.md)
   这里决定节点顺序、fan-out/join、pause/resume 和最终反思阶段。
4. 执行核心：[`./company-research-workflow-service.md`](./company-research-workflow-service.md)
   这里真正把 brief 变成 `researchUnits`，并把采集、补洞、定稿串起来。
5. 规则与工具：[`./research-workflow-kernel.md`](./research-workflow-kernel.md) + [`./research-tool-registry.md`](./research-tool-registry.md)
   前者决定“做什么”，后者决定“怎么拿数据”。
6. 证据收束：[`./company-research-agent-service.md`](./company-research-agent-service.md)
   这里把分散采集回来的证据排好序、补上引用、回答问题并产出 verdict。

## 先看这两张图

先看 V4 图编排，建立“现行主流程到底有几段”的心智模型：

![公司研究图主流程](../../charts/src-server-infrastructure-workflow-langgraph-company-research-graph-ts-39959170-activity.svg)

读这张图时不要一开始陷在节点细节里，先记住三段结构：

- 前置阶段：`agent0_clarify_scope -> agent1_write_research_brief -> agent2_plan_research_units`
- 首轮采集阶段：`agent3_source_grounding` 后 fan-out 到四个 collector
- 收束阶段：`agent4_synthesis` 之后依次进入 gap loop、压缩、补引用、报告定稿、reflection

再看执行核心，理解真正干活的逻辑在哪一层：

![公司研究执行核心](../../charts/src-server-application-intelligence-company-research-workflow-service-ts-69962f95-activity.svg)

这张图最值得盯住的四个方法是：

- `planUnits`：把 brief 转成 `researchUnits`
- `runCollectorUnit` / `executeUnits`：把 capability 变成真实工具调用
- `runGapLoop`：决定是否追加 follow-up units
- `finalizeReport`：把 findings、verdict、confidenceAnalysis、reflection 汇总为结果

## 为什么这块会读乱

- 多代实现并存：`company-research-graph.ts` 里同时有 V1/V2/V3/V4，`company-research-agent-service.ts` 里同时有旧 collector 和新后处理。
- 同一概念在多层重命名：例如 `industry_search` 是 capability，`collector_industry_sources` 是节点名，`industry_sources` 是 collectorKey。
- “规划”和“执行”分层：kernel 只负责结构化规划，workflow service 才是真正执行；如果不先分层，很容易在两个文件间来回迷路。
- 主线不是纯线性的：`runGapLoop()` 会根据压缩结果和 gap analysis 决定是否回头追加研究单元。

## 推荐阅读方式

1. 先确认当前关注的问题属于哪一层。
2. 先用图定位阶段和依赖，再回源码找函数。
3. 只盯 V4 主路径，除非你正在排查兼容性。
4. 读到 `researchUnits` 时，先问自己这是“计划阶段的产物”还是“执行阶段的输入”。
5. 读到 agent service 时，优先看 `groundSources`、`curateEvidence`、`enrichReferences`、`answerQuestions`、`buildVerdict` 这条新路径。
