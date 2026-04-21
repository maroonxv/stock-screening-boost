# 发布式验证说明

`deploy/` 目录用于接近生产环境的本机验收，而不是默认开发循环。

日常开发请优先使用根目录的 `WSL + Dev Container` 工作流；只有在需要阶段性验收时，才运行这里的 Docker 链路。

## 验证目标

这条链路保留不可变镜像构建与容器启动，用来回答三个问题：

1. Compose 配置是否仍然有效。
2. `web`、`python-service`、`workflow-worker` 是否能以发布方式启动。
3. 关键环境变量是否真的进入目标容器。

## 服务范围

- `web`: Next.js 生产服务
- `python-service`: FastAPI 数据网关
- `workflow-worker`: 工作流执行器
- `redis`: 运行时缓存与队列
- `postgres`: PostgreSQL 数据库

## 使用入口

唯一支持的 Docker 验证入口是 `deploy/deploy-main.ps1`：

```powershell
powershell -ExecutionPolicy Bypass -File deploy\deploy-main.ps1 `
  -Services web,python-service,workflow-worker `
  -RequiredEnv AUTH_SECRET,NEXTAUTH_URL
```

脚本始终从 `.worktrees/deploy-main` 解析这些路径，而不是依赖当前 shell 目录：

- `.worktrees/deploy-main`
- `.worktrees/deploy-main/deploy/docker-compose.yml`
- `.worktrees/deploy-main/.env`

## 验证内容

脚本会顺序完成以下检查：

1. `docker compose config`
2. 目标服务到达 running 状态
3. 目标容器内存在所需环境变量

如果传入 `-ForceRebuild` 且服务列表包含 `python-service`，脚本会先预构建 Python voice base 层，再重建 `python-service` 镜像，以复用更稳定的语音/运行时依赖层。

## 准备环境变量

先创建发布式验证环境：

```bash
cp deploy/.env.example .env
```

最低必填项：

- `AUTH_SECRET`
- `POSTGRES_PASSWORD`
- `WEB_PORT` / `PYTHON_SERVICE_PORT` / `POSTGRES_PORT`

`deploy/.env.example` 面向 Docker 网络内的发布式服务地址；根目录 `.env.example` 则面向 dev container 内的开发箱。

## 常用命令

```bash
docker compose --env-file deploy/.env -f deploy/docker-compose.yml logs -f
docker compose --env-file deploy/.env -f deploy/docker-compose.yml ps
docker compose --env-file deploy/.env -f deploy/docker-compose.yml down
docker compose --env-file deploy/.env -f deploy/docker-compose.yml down -v
```
