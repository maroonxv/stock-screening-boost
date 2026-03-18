# 行业研究 Workflow Viz 导览

这组文档聚焦公司/行业研究工作流里最难建立心智模型的代码。图已经由 `workflow-viz` 自动生成，我额外补了人工导览，帮助你区分“现行主路径”和“兼容旧版本路径”。

## 先看这页

- [行业研究阅读导览](./industry-research-reading-guide.md)

## 推荐阅读顺序

1. [company-research-graph.ts 洞察](./src-server-infrastructure-workflow-langgraph-company-research-graph-ts-39959170.md)
2. [company-research-workflow-service.ts 洞察](./src-server-application-intelligence-company-research-workflow-service-ts-69962f95.md)
3. [research-workflow-kernel.ts 洞察](./src-server-application-intelligence-research-workflow-kernel-ts-85dd475b.md)
4. [research-tool-registry.ts 洞察](./src-server-application-intelligence-research-tool-registry-ts-ef9a2c67.md)
5. [company-research-agent-service.ts 洞察](./src-server-application-intelligence-company-research-agent-service-ts-d175b6d7.md)

## 热点文件

| 文件 | 角色 | 为什么难读 | 文档 |
| --- | --- | --- | --- |
| `src/server/infrastructure/workflow/langgraph/company-research-graph.ts` | LangGraph 编排入口 | 同一个文件并存 V1/V2/V3/V4 四代公司研究图 | [打开](./src-server-infrastructure-workflow-langgraph-company-research-graph-ts-39959170.md) |
| `src/server/application/intelligence/company-research-workflow-service.ts` | V3/V4 执行核心 | 同时处理任务计划结果、并发执行、补洞循环和最终报告 | [打开](./src-server-application-intelligence-company-research-workflow-service-ts-69962f95.md) |
| `src/server/application/intelligence/research-workflow-kernel.ts` | 研究工作流策略内核 | 默认任务合同、默认研究单元、补洞策略都定义在这里 | [打开](./src-server-application-intelligence-research-workflow-kernel-ts-85dd475b.md) |
| `src/server/application/intelligence/research-tool-registry.ts` | 外部工具边界 | 搜索、抓取、摘要、Python 金融数据都被包装在这一层 | [打开](./src-server-application-intelligence-research-tool-registry-ts-ef9a2c67.md) |
| `src/server/application/intelligence/company-research-agent-service.ts` | 研究代理与汇总层 | 新旧采集路径和当前仍在使用的整理/总结逻辑混在一个大文件里 | [打开](./src-server-application-intelligence-company-research-agent-service-ts-d175b6d7.md) |

## 这套文档回答什么问题

- `industry_search` 到底从哪里被计划出来，又在哪里真正执行。
- 为什么同样叫“公司研究”，代码里会出现多套图版本和两条不同的采集链路。
- 哪一层负责“决定做什么”，哪一层负责“去搜什么”，哪一层负责“把证据整理成结论”。
- 如果只想追行业研究相关逻辑，应该优先跳过哪些旧路径。
