# Code Review Agent Progress

## Current Status
- 当前阶段状态：九个阶段全部完成。
- 当前阶段状态补充：继续优化计划 P0-P4 已完成，项目达到作品集级可演示 MVP。
- 下一阶段目标：可选接入真实公开 PR 做人工验收，或创建 GitHub PR。

## Capability Snapshot
- 当前能力：支持 GitHub PR URL、diff hunk 解析、repo/head 代码上下文、Python AST、符号搜索、相关测试发现、LangGraph workflow、DeepSeek reviewer、轻量验证、Markdown report、FastAPI、SQLite review store、follow-up chat 和静态 demo。
- 已知限制：默认测试不触发真实 DeepSeek；跨文件 review 仍偏规则化；不会自动修复代码或发布 GitHub review comments。
- 本地环境约束：所有命令使用 `UV_PROJECT_ENVIRONMENT=review-agent`，依赖保留在项目本地虚拟环境。

## Optimization P0-P4 - Portfolio Demo Readiness
- 当前阶段状态：完成。
- 本阶段完成内容：补充 README 和 demo 示例；实现 PR repo materialization、clone/cache checkout、DeepSeek JSON 失败 warning、SQLite findings hydrate、CLI/API chat 持久化读取，以及 `review-agent demo`。
- 验证命令与结果：`UV_PROJECT_ENVIRONMENT=review-agent uv run --extra dev pytest`，28 passed；`UV_PROJECT_ENVIRONMENT=review-agent uv run --extra dev ruff check`，All checks passed。
- 已知限制：真实公开 PR + DeepSeek 质量还需要人工验收；当前 demo 是静态示例报告。
- 下一阶段目标：选择一个公开 Python PR 做端到端展示录屏或发布 PR。

## Phase 1 - Project Skeleton And Models
- 当前阶段状态：完成。
- 本阶段完成内容：创建项目配置、包结构、配置加载、CLI health/review/chat 命令空壳，以及核心 Pydantic 模型。
- 验证命令与结果：`UV_PROJECT_ENVIRONMENT=review-agent uv run --extra dev pytest tests/test_phase1_models.py`，2 passed。
- 已知限制：CLI review/chat 的服务实现将在后续阶段补齐。
- 下一阶段目标：实现 PR fetching 与 diff parsing。

## Phase 2 - PR Fetching And Diff Parsing
- 当前阶段状态：完成。
- 本阶段完成内容：实现 GitHub PR URL 解析、HTTP PR 元数据/原始 diff/文件读取客户端，以及容错 diff hunk 解析、行号映射和语言识别。
- 验证命令与结果：`UV_PROJECT_ENVIRONMENT=review-agent uv run --extra dev pytest tests/test_phase1_models.py tests/test_phase2_diff_and_github.py`，6 passed。
- 已知限制：真实 GitHub 调用依赖网络和可选 `GITHUB_TOKEN`，单测只覆盖无网络路径。
- 下一阶段目标：实现 repo cache、项目结构扫描和 Python AST 分析。

## Phase 3 - Repo Index And Python Context
- 当前阶段状态：完成。
- 本阶段完成内容：实现本地 repo cache、项目树扫描、文件切片、`rg` 优先的符号搜索、相关测试发现，以及 Python AST imports/classes/functions/signatures/enclosing symbol 提取。
- 验证命令与结果：`UV_PROJECT_ENVIRONMENT=review-agent uv run --extra dev pytest tests/test_phase1_models.py tests/test_phase2_diff_and_github.py tests/test_phase3_python_context.py`，9 passed。
- 已知限制：repo cache 的真实 clone/update 依赖 git 和远端可用性，单测覆盖路径策略与本地上下文工具。
- 下一阶段目标：把 PR、diff、repo index 和 context fetch 串进 LangGraph workflow。

## Phase 4 - LangGraph Workflow
- 当前阶段状态：完成。
- 本阶段完成内容：实现 `ReviewState`、fetch PR、parse diff、repo index、change classify、context planner、context fetch 节点，并加入最多一次 context retry 条件边。
- 验证命令与结果：`UV_PROJECT_ENVIRONMENT=review-agent uv run --extra dev pytest tests/test_phase1_models.py tests/test_phase2_diff_and_github.py tests/test_phase3_python_context.py tests/test_phase4_workflow.py`，10 passed。
- 已知限制：workflow 当前只跑到 context bundle，review/verify/report 节点将在后续阶段接入。
- 下一阶段目标：实现 hunk reviewer、DeepSeek 适配和跨文件评审入口。

## Phase 5 - Hunk Review And Cross-File Review
- 当前阶段状态：完成。
- 本阶段完成内容：实现 DeepSeek OpenAI-compatible reviewer、结构化 `Finding` 校验、hunk review 节点、cross-file gate 和基础跨文件风险 finding。
- 验证命令与结果：`UV_PROJECT_ENVIRONMENT=review-agent uv run --extra dev pytest tests/test_phase1_models.py tests/test_phase2_diff_and_github.py tests/test_phase3_python_context.py tests/test_phase4_workflow.py tests/test_phase5_reviewers.py`，12 passed。
- 已知限制：真实 DeepSeek 调用需要 `DEEPSEEK_API_KEY`；无 key 时会记录 warning 并跳过 LLM findings。
- 下一阶段目标：加入语法、ruff、pytest 等轻量验证，并对 findings 去重排序。

## Phase 6 - Verification And Ranking
- 当前阶段状态：完成。
- 本阶段完成内容：实现 Python 语法检查、compile/import 预检、可选 ruff、定向 pytest 证据记录，以及 finding 去重、严重级排序和置信度校准。
- 验证命令与结果：`UV_PROJECT_ENVIRONMENT=review-agent uv run --extra dev pytest tests/test_phase1_models.py tests/test_phase2_diff_and_github.py tests/test_phase3_python_context.py tests/test_phase4_workflow.py tests/test_phase5_reviewers.py tests/test_phase6_verification_ranker.py`，14 passed。
- 已知限制：ruff/pytest 只作为证据工具，失败不会直接终止 review workflow。
- 下一阶段目标：渲染 Markdown report，并让 CLI review/chat 可演示。

## Phase 7 - Report And CLI
- 当前阶段状态：完成。
- 本阶段完成内容：实现 Markdown report renderer，包含风险概览、blocking/non-blocking findings、tool evidence 和 warnings；CLI `review` 已接入 `ReviewService`，`health` 可运行。
- 验证命令与结果：`UV_PROJECT_ENVIRONMENT=review-agent uv run --extra dev pytest tests/test_phase1_models.py tests/test_phase2_diff_and_github.py tests/test_phase3_python_context.py tests/test_phase4_workflow.py tests/test_phase5_reviewers.py tests/test_phase6_verification_ranker.py tests/test_phase7_report_cli.py`，16 passed。
- 已知限制：CLI `chat` 的持久会话语义将在阶段 9 完成。
- 下一阶段目标：实现 FastAPI 适配层和 SQLite review job 状态存储。

## Phase 8 - FastAPI Layer
- 当前阶段状态：完成。
- 本阶段完成内容：实现 FastAPI schemas/routes、SQLite `ReviewStore`、review job 状态流转、后台任务边界、health/review/chat endpoint 和 API 测试。
- 验证命令与结果：`UV_PROJECT_ENVIRONMENT=review-agent uv run --extra dev pytest tests/test_phase1_models.py tests/test_phase2_diff_and_github.py tests/test_phase3_python_context.py tests/test_phase4_workflow.py tests/test_phase5_reviewers.py tests/test_phase6_verification_ranker.py tests/test_phase7_report_cli.py tests/test_phase8_api_store.py`，19 passed。
- 已知限制：测试 app 未注入 `ReviewService` 时会快速写入 failed 状态，避免测试触发真实 GitHub 网络调用。
- 下一阶段目标：实现 session memory、conversation router 和 follow-up chat。

## Phase 9 - Memory And Conversation
- 当前阶段状态：完成。
- 本阶段完成内容：实现 session-scoped memory、LangGraph `InMemorySaver` 挂载、conversation intent router、finding 解释、finding 筛选、报告精简和有限重新评估回复。
- 验证命令与结果：`UV_PROJECT_ENVIRONMENT=review-agent uv run --extra dev pytest`，21 passed。
- 已知限制：MVP 的重新评估只记录澄清并提示人工确认，完整 re-review 可在后续扩展。
- 下一阶段目标：补真实仓库 fixture、演示脚本、README 使用说明或 GitHub PR 发布。
