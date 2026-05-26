# Code Review Agent

一个面向 Python 项目的 GitHub Pull Request 代码审查 Agent。

它会读取 GitHub PR diff，围绕变更片段收集相关上下文，执行轻量级确定性检查，并输出结构化审查结果与 Markdown 报告。核心审查流程由 LangGraph 编排，对外通过 FastAPI 提供接口，同时包含一个 React + Vite 构建的前端仪表盘。

## 功能特性

- 输入 GitHub Pull Request URL，自动拉取并解析 PR diff。
- 输出经过 schema 校验的 findings，以及适合阅读和归档的 Markdown 报告。
- 当前优先支持 Python 仓库审查。
- 上下文采集覆盖 diff hunk、邻近代码、import、AST 摘要、符号引用、相关测试和仓库目录树。
- 内置轻量验证能力，包括 `ast.parse`、compile/import 预检查、可选 `ruff`，以及在发现相关测试时运行定向 `pytest`。
- 支持配置 DeepSeek 的 OpenAI 兼容 API；模型不可用时会记录 warning，并跳过对应 hunk 的 LLM findings。
- 使用 SQLite 持久化审查结果，可基于历史 findings 进行后续问答、解释和过滤。

## 当前边界

这个项目定位为 MVP 和演示级代码审查系统，因此有一些明确的非目标：

- 不会自动修改业务代码。
- 不会自动向 GitHub 发布 review comment。
- 不依赖 Celery、Redis 或分布式 worker。
- 不宣称对所有语言和所有仓库都具备生产级审查准确率。

## 快速开始

建议使用项目本地虚拟环境 `review-agent`，避免把依赖安装到系统 Python：

```bash
UV_PROJECT_ENVIRONMENT=review-agent uv run --extra dev pytest
```

常用环境变量：

```bash
export DEEPSEEK_API_KEY="..."
export DEEPSEEK_BASE_URL="https://api.deepseek.com"
export DEEPSEEK_MODEL="deepseek-v4-pro"
export GITHUB_TOKEN="..." # 可选，用于提高 GitHub API rate limit
export REPO_CACHE_DIR=".cache/repos"
export REVIEW_AGENT_LLM_TIMEOUT_SECONDS="45"
export REVIEW_AGENT_LLM_MAX_RETRIES="1"
export REVIEW_AGENT_LOG_LEVEL="INFO"
```

## 启动后端

```bash
UV_PROJECT_ENVIRONMENT=review-agent uv run uvicorn review_agent.api.app:app --reload
```

可用接口：

- `POST /api/reviews`
- `GET /api/reviews/{review_id}`
- `POST /api/reviews/{review_id}/chat`
- `GET /api/health`

## 启动前端

前端使用 React、TypeScript 和 Vite 构建，源码位于 `frontend/`。生产构建会把静态资源输出到 `src/review_agent/web`，由 FastAPI 直接托管。

```bash
npm install
npm run dev
npm run build
npm run test
```

修改前端后请运行 `npm run build`，确保 `GET /`、`/static/app.js` 和 `/static/styles.css` 与 React 源码保持同步。

## 架构概览

```text
FastAPI
    |
    v
ReviewService / SessionService / ReviewStore
    |
    v
LangGraph workflow
    |
    v
GitHub tools / diff tools / repo context / Python AST / reviewers / verification / report renderer
```

工作流刻意保持有界：优先使用确定性工具，不采用无限制的 ReAct 循环。上下文补充最多重试一次；如果仍无法完整获取上下文，系统会带着结构化 warning 继续生成审查结果。日志以 JSON 形式输出，包含 review/job 上下文、工作流阶段、耗时和错误码，便于排查问题。

## 静态示例报告

无需提交真实 PR 即可生成一份静态示例报告：

```bash
UV_PROJECT_ENVIRONMENT=review-agent uv run python -c "from review_agent.demo import write_demo_report; write_demo_report('examples/demo-report.md')"
```

静态示例报告包含 blocking 级安全问题、工具证据，以及适合放入作品集展示的 Markdown 报告格式。

## 质量检查

```bash
UV_PROJECT_ENVIRONMENT=review-agent uv run --extra dev pytest
UV_PROJECT_ENVIRONMENT=review-agent uv run --extra dev ruff check
```

## 项目亮点

- 使用 LangGraph 构建 PR 审查工作流，将 Pull Request diff 拆解为 hunk 级审查任务。
- 设计了确定性工具层，覆盖 GitHub 拉取、diff 解析、Python AST 分析、符号搜索、验证证据和 Markdown 报告渲染。
- 支持克隆和缓存 PR head revision，将本地仓库上下文注入语义审查流程。
- DeepSeek 模型审查不可用时会保留结构化 warning，让报告清楚呈现缺失的 LLM 审查结果。
- 实现了 FastAPI 异步审查任务、SQLite 持久化，以及基于已存 findings 的后续问答能力。
