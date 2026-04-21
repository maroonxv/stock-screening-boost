# Stock Screening Python Service

Python FastAPI 微服务，向主应用提供 iFinD 主用、AkShare 兜底的数据接口。

默认开发方式已经切换到根目录的 `WSL + dev container`。Python 依赖现在以 `pyproject.toml` + `uv.lock` 为唯一真源，`requirements*.txt` 只保留为兼容性参考，不再作为日常安装入口。

## 在 dev container 中开发

首次进入开发箱后执行：

```bash
cd python_services
uv sync --frozen --dev
```

启动 FastAPI：

```bash
cd python_services
uv run uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

运行 Python 测试：

```bash
cd python_services
uv run pytest
```

可选的 RefChecker 依赖组：

```bash
cd python_services
uv sync --frozen --dev --extra refchecker
```

## 依赖结构

- 运行时依赖：定义在 `pyproject.toml` 的 `dependencies`
- 测试依赖：定义在 `dependency-groups.dev`
- 可选 RefChecker：定义在 `project.optional-dependencies.refchecker`

发布式验证中的 Docker 构建也应当以 `pyproject.toml` / `uv.lock` 为准，避免 dev 与 release 使用不同的 Python 依赖真源。

## 能力概览

- 股票基础数据：代码列表、批量行情、历史指标、行业列表
- Screening 兼容链路：legacy `/api/stocks/*` 默认优先走 iFinD，失败后按配置回退 AkShare
- Workflow 情报数据：主题资讯、候选股、公司证据（含批量）
- 主题词 -> A 股概念映射：白名单/黑名单 + 智谱 Web Search + 本地自动匹配
- 智能降级：AkShare 请求失败时优先读缓存，再走兜底数据
- 统一网关缓存：`L1 内存缓存 + L2 Redis 缓存 + stale fallback`
- 管理任务：`refresh-universe`、`refresh-concepts`、`prewarm-hot-themes`

## 目录结构

```text
python_services/
  app/
  tests/
  pyproject.toml
  uv.lock
  requirements.txt
  requirements-dev.txt
  requirements-refchecker.txt
```

## 关键接口

- `GET /api/intelligence/news?theme&days&limit`
- `GET /api/intelligence/candidates?theme&limit`
- `GET /api/intelligence/evidence/{stock_code}?concept`
- `POST /api/intelligence/evidence/batch`
- `POST /api/intelligence/confidence/check`
- `POST /api/intelligence/confidence/check-batch`
- `GET /api/intelligence/concepts/match?theme=...&limit=...`
- `GET /api/intelligence/concepts/rules?theme=...`
- `PUT /api/intelligence/concepts/rules`
- `GET /api/admin/metrics`
- `POST /api/admin/jobs/refresh-universe`
- `POST /api/admin/jobs/refresh-concepts`
- `POST /api/admin/jobs/prewarm-hot-themes`

## 环境变量

Screening provider：

- `IFIND_USERNAME`
- `IFIND_PASSWORD`
- `SCREENING_PRIMARY_PROVIDER`
- `SCREENING_ENABLE_AKSHARE_FALLBACK`

缓存与降级：

- `INTELLIGENCE_CACHE_TTL_SECONDS`
- `INTELLIGENCE_CACHE_STALE_SECONDS`
- `INTELLIGENCE_SPOT_CACHE_TTL_SECONDS`
- `INTELLIGENCE_ENABLE_MOCK_FALLBACK`
- `GATEWAY_REDIS_URL`
- `GATEWAY_REDIS_PREFIX`
- `GATEWAY_HOT_THEMES`

智谱 Web Search：

- `ZHIPU_API_KEY`
- `ZHIPU_WEB_SEARCH_MODEL`
- `ZHIPU_WEB_SEARCH_TIMEOUT_SECONDS`
- `ZHIPU_WEB_SEARCH_RETRIES`

可信度分析：

- `REFCHECKER_ENABLED`
- `REFCHECKER_MODEL`
- `REFCHECKER_API_BASE`
- `REFCHECKER_TIMEOUT_SECONDS`
- `REFCHECKER_BATCH_SIZE`
