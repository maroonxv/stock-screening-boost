# AlphaFlow

面向股票投研场景的智能工作流平台。

AlphaFlow 将选股筛选、行业研究、公司研究与异步任务编排整合到一个可配置、可追踪的系统中，帮助研究者减少信息噪音，更快聚焦高价值标的，并沉淀可复用的投研流程。

## 开发主入口：WSL + Dev Container

默认开发链路已经切换到 `WSL + Dev Container`。目标是把日常“改代码 -> 看效果”的循环从 Docker 镜像重建中解耦出来：

- WSL 下的仓库路径作为主工作区，避免 Windows 文件系统挂载带来的 I/O 损耗。
- `dev container` 提供统一的 Node.js 20、npm 11、Python 3.11、`uv` 与 Docker CLI 环境。
- `postgres` 与 `redis` 由 `.devcontainer/docker-compose.yml` 管理，应用进程直接在开发箱内运行。
- 一键联调入口统一为 `npm run dev:all`，默认拉起 `web`、`python-service` 与 `workflow-worker`。

### 启动步骤

1. 把仓库放到 WSL 文件系统，例如 `~/workspace/stock-screening-boost`。
2. 使用 VS Code / Cursor 的 Dev Containers 打开仓库。
3. 首次进入容器后会自动执行：

```bash
npm ci
cd python_services && uv sync --frozen --dev
```

4. 在 dev container 内复制开发环境变量并启动联调：

```bash
cp .env.example .env
npm run dev:all
```

### 常用开发命令

| 命令 | 说明 |
| --- | --- |
| `npm run dev:all` | 检查 `postgres`/`redis`、执行 `db:push`，并并发拉起 Web、Python 与 workflow worker |
| `npm run dev` | 单独启动 Next.js 开发服务器 |
| `npm run worker:workflow` | 单独启动 workflow worker |
| `npm run typecheck` | 运行 TypeScript 严格类型检查 |
| `npm test` | 运行 Vitest |
| `cd python_services && uv run pytest` | 运行 Python 测试 |

## 发布式验证

`deploy/` 目录现在用于接近生产的本机验收，不再是默认开发入口。

- `deploy/docker-compose.yml` 继续使用不可变镜像构建。
- `deploy/deploy-main.ps1` 继续负责发布式验证。
- 只有在需要阶段性验收时，才进入 `.worktrees/deploy-main` 运行部署验证链路。

详细说明见 [deploy/README.md](./deploy/README.md)。

## 架构概览

- T3 Web App：Next.js App Router、tRPC、Prisma、NextAuth。
- Python 数据网关：FastAPI，负责 AkShare / iFinD / intelligence 数据接口。
- 异步运行时：`workflow-worker` 轮询执行 LangGraph 工作流任务。
- 数据与基础设施：PostgreSQL 持久化，Redis 维护运行态与缓存。

## 项目结构

```text
AlphaFlow/
├─ .devcontainer/                    # WSL + Dev Container 主开发入口
├─ src/                              # Next.js / tRPC / DDD 代码
├─ prisma/                           # Prisma schema
├─ python_services/                  # FastAPI 服务与 uv 项目配置
├─ tooling/workers/                  # 异步 worker 入口
├─ deploy/                           # 发布式验证 compose 与镜像构建
└─ docs/                             # 方案与上下文文档
```

## 延伸阅读

- [发布式验证说明](./deploy/README.md)
- [Python 数据服务说明](./python_services/README.md)
- [产品与方案文档](./docs/)
