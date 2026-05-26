# Code Review Agent Project Plan

## 1. Project Positioning

This project is a Python-first GitHub PR review agent for resume and portfolio use.

The MVP focuses on reviewing GitHub Pull Requests and producing a structured Markdown report. It should demonstrate agent architecture, LangGraph state management, deterministic tool use, context planning, lightweight verification, short-term memory, and multi-turn review conversations.

The first version will not automatically modify code, post GitHub review comments, or require full project test environments. Those can be added later after the core review workflow is stable.

Core choices:

- Input: GitHub PR URL
- Main target: Python repositories
- Output: JSON findings plus Markdown report
- Orchestration: LangGraph
- Review unit: diff hunk
- API layer: FastAPI as a thin adapter
- CLI: supported for local demos
- Memory: session-scoped short-term memory
- Verification: lightweight deterministic evidence, not hard blocking

## 2. High-Level Architecture

The core design separates product entry points from review logic.

```text
CLI / FastAPI / future frontend
        |
        v
ReviewService / SessionService
        |
        v
LangGraph workflow
        |
        v
tools / reviewers / memory / report renderer
```

FastAPI should not contain review logic directly. It should only validate HTTP requests, call services, and return stable API responses. This keeps the project ready for future frontend, CI bot, or GitHub App integrations.

## 3. Project Structure

```text
review_agent/
  pyproject.toml
  README.md
  CODE_REVIEW_AGENT_PLAN.md

  src/review_agent/
    __init__.py
    cli.py
    config.py

    api/
      __init__.py
      app.py
      routes.py
      schemas.py
      dependencies.py

    services/
      __init__.py
      review_service.py
      session_service.py
      review_store.py
      repo_cache.py
      command_runner.py

    graph/
      __init__.py
      state.py
      nodes.py
      edges.py
      workflow.py

    models/
      __init__.py
      pr.py
      diff.py
      context.py
      finding.py
      report.py
      session.py

    tools/
      __init__.py
      github_tools.py
      diff_tools.py
      repo_tools.py
      python_analysis_tools.py
      verification_tools.py
      report_tools.py

    reviewers/
      __init__.py
      prompts.py
      hunk_reviewer.py
      cross_file_reviewer.py
      finding_ranker.py

    memory/
      __init__.py
      conversation.py
      router.py

  tests/
    fixtures/
    test_diff_tools.py
    test_context_planner.py
    test_python_analysis.py
    test_finding_ranker.py
    test_report_renderer.py
    test_review_service.py
    test_api_routes.py
    test_workflow_integration.py
```

## 4. Tech Stack

Core dependencies:

```text
langgraph
langchain-core
pydantic
pydantic-settings
typer
fastapi
uvicorn
httpx
unidiff
gitpython
rich
pytest
ruff
```

Implementation notes:

- Use Python 3.11.
- Use standard library `ast` for Python code structure analysis.
- Use `rg` for symbol search when available, with a Python fallback.
- Do not use LSP in the MVP.
- Use SQLite for persisted review job status in the FastAPI MVP.
- Use LangGraph `InMemorySaver` for the first version of session memory.

## 5. Core Data Models

### PR Metadata

`PRMeta` should contain:

- owner
- repo
- pr_number
- title
- author
- base_ref
- head_ref
- base_sha
- head_sha
- changed_files
- html_url

### Diff Hunk

`DiffHunk` is the minimum review unit.

```python
class DiffLine(BaseModel):
    old_line_no: int | None = None
    new_line_no: int | None = None
    content: str
    line_type: Literal["added", "removed", "context"]


class DiffHunk(BaseModel):
    hunk_id: str
    file_path: str
    change_type: Literal["added", "modified", "deleted", "renamed"]
    old_start: int | None = None
    old_end: int | None = None
    new_start: int | None = None
    new_end: int | None = None
    raw_diff: str
    lines: list[DiffLine]
    added_code: str = ""
    removed_code: str = ""
    context_code: str = ""
    language: str | None = None
    enclosing_symbol: str | None = None
```

### Context Request

`ContextRequest` is produced by the context planner.

It should include:

- request_id
- hunk_id
- file_path
- target_symbols
- required_files
- need_enclosing_symbol
- need_imports
- need_callers
- need_related_tests
- reason

### Context Bundle

`ContextBundle` is the actual context fetched for a hunk.

It should include:

- hunk_id
- file_path
- file_slices
- enclosing_symbol
- ast_summary
- imports
- related_symbols
- symbol_references
- related_tests
- tool_evidence
- missing_context

### Finding

`Finding` is the structured review output.

```python
class Finding(BaseModel):
    finding_id: str
    hunk_id: str
    file_path: str
    start_line: int
    end_line: int
    severity: Literal["critical", "high", "medium", "low", "info"]
    category: Literal[
        "bug",
        "security",
        "performance",
        "readability",
        "maintainability",
        "test",
        "style",
        "compatibility",
    ]
    title: str
    evidence: str
    explanation: str
    suggestion: str
    confidence: float
    is_blocking: bool = False
```

### Review State

```python
class ReviewState(TypedDict):
    messages: list
    pr_meta: PRMeta | None
    repo_summary: RepoSummary | None
    diff_hunks: list[DiffHunk]
    context_requests: list[ContextRequest]
    context_bundles: dict[str, ContextBundle]
    file_contexts: dict[str, FileContext]
    tool_evidence: list[ToolEvidence]
    findings: list[Finding]
    errors: list[str]
    final_report: str | None
    session_summary: str
    user_preferences: dict
```

## 6. LangGraph Workflow

The graph should be mostly deterministic, with LLM calls used only where semantic judgment is needed.

Main workflow:

```text
START
  -> fetch_pr_node
  -> parse_diff_node
  -> repo_index_node
  -> classify_change_node
  -> context_planner_node
  -> context_fetch_node
  -> review_hunks_node
  -> cross_file_gate
  -> lightweight_verify_node
  -> rerank_findings_node
  -> report_node
  -> END
```

Conditional edges:

```text
context_fetch_node -> context_planner_node
  condition: context is insufficient and context_retry_count < 1

context_fetch_node -> review_hunks_node
  condition: context is sufficient or retry limit reached

review_hunks_node -> cross_file_review_node
  condition: public API, import, schema, config, dependency, or test-related changes exist

review_hunks_node -> lightweight_verify_node
  condition: no obvious cross-file impact

cross_file_review_node -> lightweight_verify_node
lightweight_verify_node -> rerank_findings_node
rerank_findings_node -> report_node
```

The MVP should not use an unlimited ReAct loop. At most one context retry is enough for a stable, debuggable portfolio project.

## 7. Tool Layer

Tools are deterministic functions where possible. LangGraph nodes decide when tools are used.

### GitHub Tools

- `parse_pr_url_tool`
  - Input: GitHub PR URL
  - Output: owner, repo, pr_number
- `fetch_pr_meta_tool`
  - Output: PR title, author, base/head refs, shas, changed files
- `fetch_pr_diff_tool`
  - Output: raw diff
- `fetch_file_at_ref_tool`
  - Input: file_path and git ref
  - Output: file content at that ref

### Diff Tools

- `parse_diff_hunks_tool`
  - Input: raw diff
  - Output: list of `DiffHunk`
- `map_line_numbers_tool`
  - Input: hunk
  - Output: old/new line mapping
- `detect_language_tool`
  - Input: file path
  - Output: python or unknown

### Repo And Context Tools

- `repo_tree_tool`
  - Output: project tree, key configs, test directories
- `read_file_slice_tool`
  - Input: file path and line range
  - Output: local code slice
- `search_symbol_tool`
  - Input: symbol name
  - Output: reference locations
- `find_related_tests_tool`
  - Input: file path or symbol
  - Output: likely related test files and test functions

### Python Analysis Tools

- `python_ast_summary_tool`
  - Output: imports, classes, functions, signatures
- `find_enclosing_symbol_tool`
  - Input: file path and line number
  - Output: containing function or class
- `extract_imports_tool`
  - Output: import statements
- `extract_signatures_tool`
  - Output: function and class signatures

### Verification Tools

- `python_syntax_check_tool`
  - Uses `ast.parse`
- `ruff_check_tool`
  - Runs ruff when available
- `pytest_targeted_tool`
  - Runs selected related tests when available
- `import_check_tool`
  - Checks obvious broken imports

Verification tools should add evidence. They should not make the whole review fail unless the workflow itself cannot continue.

### Review And Report Helpers

- `severity_classifier`
- `finding_deduper`
- `confidence_calibrator`
- `markdown_report_renderer`

## 8. Review Context Strategy

Each hunk should be reviewed with layered context.

```text
PR Diff
  -> changed lines, file path, change type, line numbers

Local Context
  -> enclosing function/class, imports, nearby code

Repo Context
  -> project structure, package paths, configs, tests

Cross-file Context
  -> symbol references, related tests, public API usage, import dependencies

Tool Evidence
  -> ast.parse, ruff, targeted pytest, symbol search
```

Context planning rules:

- Internal function logic changes: fetch enclosing function and related tests.
- Function signature changes: fetch callers, tests, and public API references.
- Class/model/schema changes: fetch instantiation, inheritance, serialization, and tests.
- Import/config/dependency changes: fetch config files, entrypoints, and import references.
- Deleted code: prioritize references, compatibility risk, and test coverage.

## 9. FastAPI Design

FastAPI is a thin adapter for frontend and external integrations.

### API Endpoints

```text
POST /api/reviews
Input:  { "pr_url": "https://github.com/owner/repo/pull/123" }
Output: { "review_id": "...", "thread_id": "...", "status": "queued" }

GET /api/reviews/{review_id}
Output: review_id, pr_url, status, findings, final_report, error

POST /api/reviews/{review_id}/chat
Input:  { "message": "Explain finding 2" }
Output: { "answer": "...", "review_id": "...", "thread_id": "..." }

GET /api/health
Output: { "status": "ok" }
```

### Review Job State

Status values:

- queued
- running
- succeeded
- failed

MVP execution model:

- `POST /api/reviews` creates a review job.
- FastAPI `BackgroundTasks` runs the review in the same process.
- Review result is saved to SQLite via `ReviewStore`.
- Frontend can poll `GET /api/reviews/{review_id}`.

Do not introduce Celery, RQ, Redis, or distributed workers in the first version.

### ReviewStore

`ReviewStore` should support:

- `create_review(pr_url) -> review_id`
- `mark_running(review_id)`
- `save_success(review_id, findings, final_report)`
- `save_failed(review_id, error)`
- `get_review(review_id)`

SQLite columns:

- review_id
- thread_id
- pr_url
- status
- findings_json
- final_report
- error
- created_at
- updated_at

## 10. Memory And Multi-Turn Conversation

First version memory is session-scoped.

Design:

- `review_id == thread_id` by default.
- LangGraph uses a checkpointer.
- MVP uses `InMemorySaver`.
- `ReviewStore` persists final findings and report.
- Long-term user preferences and repo memory are future extensions.

Conversation router:

```text
user_input
  -> intent_router_node
      -> explain_finding_node
      -> filter_findings_node
      -> refine_report_node
      -> rerun_related_hunks_node
```

Supported conversations:

- "Why is finding 2 high severity?"
- "Show only security findings."
- "Generate a shorter PR comment version."
- "This function is internal only; reconsider that issue."
- "Which findings are blocking?"

## 11. Public Interfaces

### CLI

```bash
review-agent review https://github.com/owner/repo/pull/123 --output report.md
review-agent chat <review_id> "Why is finding 2 high?"
```

### FastAPI

```bash
uvicorn review_agent.api.app:app --reload
```

### Future Frontend

The frontend should use only the FastAPI endpoints. It should not depend on LangGraph internals, tool internals, or local repository cache paths.

## 12. Module Implementation Plan

### Phase 1: Project Skeleton And Models

- Initialize `pyproject.toml`, package layout, config loading, CLI shell.
- Create PR, diff, context, finding, report, and session models.
- Add model validation tests.

### Phase 2: PR Fetching And Diff Parsing

- Implement GitHub PR URL parsing.
- Fetch PR metadata and raw diff.
- Parse raw diff into `DiffHunk` with `unidiff`.
- Cover added, modified, deleted, and renamed files in tests.

### Phase 3: Repo Index And Python Context

- Implement repo cache or temporary clone.
- Scan Python project structure, package roots, tests, and config files.
- Use `ast` to extract imports, classes, functions, signatures, and enclosing symbols.
- Implement symbol search and related test detection.

### Phase 4: LangGraph Workflow

- Implement `fetch_pr_node`, `parse_diff_node`, `repo_index_node`, and `classify_change_node`.
- Implement `context_planner_node` and `context_fetch_node`.
- Add conditional edge for at most one context retry.
- Run a fixture PR through the graph up to context bundle generation.

### Phase 5: Hunk Review And Cross-File Review

- Design structured hunk review prompt.
- Generate schema-validated `Finding` objects.
- Implement cross-file gate.
- Handle public API, import, schema/config, dependency, and related-test cases.

### Phase 6: Verification And Ranking

- Add syntax check with `ast.parse`.
- Run ruff when available.
- Run targeted pytest when related tests exist.
- Record verification output as evidence.
- Implement deduplication, severity normalization, and confidence calibration.

### Phase 7: Report And CLI

- Render Markdown report.
- Add CLI `review` command.
- Add CLI `chat` command.
- Include risk overview, blocking findings, non-blocking findings, tool evidence, and warnings.

### Phase 8: FastAPI Layer

- Add API request and response schemas.
- Implement `ReviewStore`.
- Implement `POST /api/reviews`.
- Implement `GET /api/reviews/{review_id}`.
- Implement `POST /api/reviews/{review_id}/chat`.
- Implement `GET /api/health`.
- Add API route tests.

### Phase 9: Memory And Conversation

- Add LangGraph checkpointer.
- Implement `SessionService`.
- Implement intent router.
- Support finding explanation, filtering, report refinement, and limited re-review based on user clarification.

## 13. Test Plan

### Unit Tests

- Diff hunk parsing and line-number mapping.
- AST enclosing symbol detection.
- Import and signature extraction.
- Context planner decisions.
- Finding deduplication and ranking.
- Markdown report rendering.
- ReviewStore status transitions.

### API Tests

- `POST /api/reviews` returns review id and queued status.
- `GET /api/reviews/{review_id}` returns queued, running, succeeded, or failed.
- Unknown review id returns 404.
- Chat endpoint can read existing review findings.
- Failed review returns clear error state.

### Integration Tests

- Fixture PR runs through the full workflow.
- API-created review can be polled until final report is available.
- Tool failures are captured as errors or warnings instead of crashing silently.

### Memory Tests

- Same `review_id/thread_id` can answer follow-up questions about existing findings.
- Different `thread_id` values do not share session memory.

## 14. Resume Highlights

Possible resume bullets:

- Built a LangGraph-based PR review agent that decomposes GitHub Pull Request diffs into hunk-level review tasks.
- Designed deterministic tool layers for GitHub diff fetching, Python AST analysis, symbol search, targeted verification, and Markdown report rendering.
- Implemented context planning to retrieve only relevant code context for each diff hunk, reducing prompt noise and improving review precision.
- Added FastAPI endpoints for asynchronous PR review jobs and multi-turn review conversations.
- Added thread-scoped short-term memory to support follow-up questions, finding explanation, report filtering, and report refinement.
- Combined LLM reasoning with static analysis and lightweight test evidence to produce structured, severity-ranked code review findings.

## 15. Assumptions And Non-Goals

Assumptions:

- First version focuses on Python repositories.
- Input is a GitHub PR URL.
- Output includes JSON findings and Markdown report.
- FastAPI is a thin adapter, not the core review engine.
- MVP uses same-process FastAPI background tasks.
- MVP uses local SQLite for review job results.
- MVP uses session-scoped memory.

Non-goals for the first version:

- No automatic code fixes.
- No direct GitHub PR comments.
- No mandatory full test environment setup.
- No Celery, Redis, or distributed worker system.
- No long-term repo memory.
- No full language-server integration.
