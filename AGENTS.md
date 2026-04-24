# AGENTS

## 工作流约定

1. 非只读修改必须先在 `.worktrees/<branch>` 的独立 worktree 中完成。
2. 修改、测试、提交都在该 worktree 内执行。
3. 若改动影响运行时行为：
   - 先将功能分支合并到默认分支（如 `main`）
   - 再将 `.worktrees/deploy-main` fast-forward 到默认分支
   - 只允许通过 `deploy/deploy-main.ps1` 执行部署与验证
4. 部署验证至少应覆盖：
   - `docker compose config` 成功
   - 目标服务启动成功
   - 容器内关键环境变量检查成功
5. 只有目标提交已进入 `.worktrees/deploy-main` 且部署验证通过，才能称为“已完成 / 已修复 / 可部署”。
6. 验证通过后，清理对应功能分支与 worktree；`.worktrees/deploy-main` 不允许产生独立提交。

## 自动 Git 提交规则

当你完成以下任何一类操作后，必须自动执行 `git add {修改的文件}`、`git commit -m "<message>"`、`git push`：

1. 修复 bug 或错误（如导入路径修复、运行时报错修复）
2. 新增功能或文件
3. 重构代码（如重命名、移动文件、调整结构）
4. 修改配置文件（如 Dockerfile、pytest.ini、requirements.txt 等）
5. 更新或新增测试
6. 更新文档（如 README、需求文档、AGENTS.md 等）

## Commit 消息格式

使用中文，遵循 Conventional Commits 风格：

```
<type>: <简要描述>

<可选的详细说明>
```

type 取值：
- `fix`: 修复 bug
- `feat`: 新功能
- `refactor`: 重构
- `docs`: 文档变更
- `chore`: 构建/配置/工具变更
- `test`: 测试相关
- `style`: 格式调整（不影响逻辑）

## 注意事项

- 每次操作完成后立即提交，不要积攒多个不相关的变更到一个 commit
- commit 消息要准确描述本次变更内容
- 如果一次用户请求涉及多个不相关的改动，拆分为多个 commit
