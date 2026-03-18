# 行业研究阅读导览

这页是给“先建立心智模型，再回源码”的读法准备的。建议先看这里，再按链接进入各个带图页面。

## 一句话心智模型

`execution-service` 负责注册可运行的图，`company-research-graph.ts` 负责定义节点和边，`company-research-workflow-service.ts` 负责真正执行研究单元，`research-workflow-kernel.ts` 负责默认策略和计划规则，`research-tool-registry.ts` 负责外部搜索/抓取/金融数据边界，`company-research-agent-service.ts` 负责概念拆解、证据整理、引用增强和最终结论。

## 为什么这部分特别难读

- 同一个“公司研究”能力同时保留了 V1、V2、V3、V4 多套 LangGraph 版本。
- “行业研究”这个概念会在不同层改名：`industry_search`、`collector_industry_sources`、`industry_sources`。
- V3 把所有研究单元塞进一个执行节点里，V4 又把四类采集器重新拆成显式 fan-out 节点。
- `company-research-agent-service.ts` 既包含旧版采集逻辑，也包含新版仍在使用的整理和总结逻辑，第一次读很容易误判主路径。

## 建议阅读顺序

1. 先看 [company-research-graph.ts 洞察](./src-server-infrastructure-workflow-langgraph-company-research-graph-ts-39959170.md)，确认你正在读哪一代图。
2. 再看 [company-research-workflow-service.ts 洞察](./src-server-application-intelligence-company-research-workflow-service-ts-69962f95.md)，理解 V3/V4 是怎么执行研究单元的。
3. 接着看 [research-workflow-kernel.ts 洞察](./src-server-application-intelligence-research-workflow-kernel-ts-85dd475b.md)，理解 `industry_search` 为什么会被计划出来。
4. 然后看 [research-tool-registry.ts 洞察](./src-server-application-intelligence-research-tool-registry-ts-ef9a2c67.md)，理解搜索结果在进入证据池前被做了什么处理。
5. 最后看 [company-research-agent-service.ts 洞察](./src-server-application-intelligence-company-research-agent-service-ts-d175b6d7.md)，把“证据如何变成回答、结论和置信度”补齐。

## 当前最值得追的主路径

如果你关注的是现在这套更“合同化/单元化”的行业研究流程，优先看 V4：

1. `src/server/application/workflow/execution-service.ts:144-152`
   这里把 `LegacyCompanyResearchLangGraph`、`CompanyResearchLangGraph`、`ODRCompanyResearchLangGraph`、`CompanyResearchContractLangGraph` 都注册进来了，说明多代图同时存在。
2. `src/server/infrastructure/workflow/langgraph/company-research-graph.ts:1122-1197`
   V4 的 `agent2_plan_research_units` 和 `collector_industry_sources` 都委托给 `CompanyResearchWorkflowService`。
3. `src/server/application/intelligence/research-workflow-kernel.ts:502-569`
   默认公司研究单元里，`industry_landscape` 对应的 capability 就是 `industry_search`。
4. `src/server/application/intelligence/company-research-workflow-service.ts:709-795`
   `executeUnits()` 会按依赖关系和 `maxConcurrentResearchUnits` 做批次调度。
5. `src/server/application/intelligence/company-research-workflow-service.ts:494-537`
   `runCollectorUnit()` 把 `industry_search` 映射成 `industry_sources`，构造查询词并调用 `ResearchToolRegistry.searchWeb()`。
6. `src/server/application/intelligence/research-tool-registry.ts:117-170`
   `searchWeb()` 会并发搜多个 query、按 canonical URL 去重、再把网页内容压缩成可用摘要。
7. `src/server/application/intelligence/company-research-agent-service.ts:1326-1390`
   `curateEvidence()` 对所有采集回来的证据做打分、去重、裁剪和引用对象生成。
8. `src/server/application/intelligence/company-research-workflow-service.ts:798-924`
   `runGapLoop()` 会检查是否还有研究空洞，必要时再追加 follow-up 单元。

## 版本差异

| 版本 | 主要特征 | 行业研究怎么跑 |
| --- | --- | --- |
| V1 | 单一 `agent4_evidence_collection` 节点 | `CompanyResearchAgentService.collectEvidence()` 内部一次性并发采集 |
| V2 | 显式 `collector_*` fan-out | `collector_industry_sources` 直接调用 `CompanyResearchAgentService.collectIndustrySources()` |
| V3 | ODR 风格，研究单元化 | `agent3_execute_research_units` 一次性执行所有 unit，由 `CompanyResearchWorkflowService.executeUnits()` 调度 |
| V4 | 合同化 + 显式 fan-out + gap loop | `collector_industry_sources` 从 `researchUnits` 找到 `industry_search` unit，再委托 `executeCollectorUnit()` |

## 读图时要抓的关键词

- 看见 `industry_search`，就把它理解成“一个被计划出来的研究单元能力”。
- 看见 `collector_industry_sources`，就把它理解成“LangGraph 里的显式采集节点”。
- 看见 `industry_sources`，就把它理解成“证据分类后的 collectorKey”。
- 看见 `gapAnalysis` 或 `followupUnits`，就把它理解成“这不是主流程，而是补洞循环”。

## 如果你只想追 `industry_search`

按下面这条链路找就够了：

1. `research-workflow-kernel.ts`
   `buildUnitPlanFallback()` 里定义默认 `industry_landscape` 单元。
2. `company-research-graph.ts`
   `collector_industry_sources` 节点把这个单元接入图。
3. `company-research-workflow-service.ts`
   `executeCollectorUnit()` 和 `runCollectorUnit()` 真正执行采集。
4. `research-tool-registry.ts`
   `searchWeb()` 负责调用 Firecrawl 并做去重摘要。
5. `company-research-agent-service.ts`
   `curateEvidence()` 把行业证据和其他来源一起排序整合进最终证据集。

## 首次阅读时可以先跳过什么

- `LegacyCompanyResearchLangGraph`：除非你在排查旧模板。
- `CompanyResearchAgentService.collectEvidence()`：这是 V1 的整包采集入口，不是 V4 主路径。
- `CompanyResearchAgentService.collectIndustrySources()`：它对理解 V2 很重要，但不是 V4 的实际行业采集实现。
