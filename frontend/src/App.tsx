import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { fetchDemoReport, fetchReview, isAbortError, PR_URL_PATTERN, sendChat, createReview } from "./api";
import { ChatPanel } from "./components/ChatPanel";
import { FindingsPanel } from "./components/FindingsPanel";
import { ReportPanel } from "./components/ReportPanel";
import { ReviewForm } from "./components/ReviewForm";
import { StatusStrip } from "./components/StatusStrip";
import type { ChatMessage, Finding, InlineStatus, ReviewResponse, UiStatus } from "./types";
import { copyTextFallback, isTerminalReviewStatus, makeMessageId, POLL_DELAY_MS } from "./utils";

const EMPTY_REPORT = "报告会在评审完成后显示。";

const INITIAL_STATUS: InlineStatus = {
  tone: "neutral",
  message: "输入 GitHub Pull Request 链接，或直接打开静态示例报告。",
};

export function App() {
  const [prUrl, setPrUrl] = useState("");
  const [uiStatus, setUiStatus] = useState<UiStatus>("idle");
  const [currentReview, setCurrentReview] = useState<ReviewResponse | null>(null);
  const [status, setStatus] = useState<InlineStatus>(INITIAL_STATUS);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatDraft, setChatDraft] = useState("");
  const [chatBusy, setChatBusy] = useState(false);
  const [copyState, setCopyState] = useState<"idle" | "copied">("idle");
  const activeController = useRef<AbortController | null>(null);
  const pollTimer = useRef<number | null>(null);
  const chatController = useRef<AbortController | null>(null);

  useEffect(() => {
    return () => {
      clearActiveWork();
      abortChat();
    };
  }, []);

  const findings = currentReview?.findings ?? [];
  const report = currentReview?.final_report || EMPTY_REPORT;
  const blockingCount = useMemo(
    () => findings.filter((finding: Finding) => finding.is_blocking).length,
    [findings],
  );
  const isReviewBusy = uiStatus === "submitting" || uiStatus === "queued" || uiStatus === "running";
  const isDemo = uiStatus === "demo" || currentReview?.review_id === "demo";
  const chatEnabled = uiStatus === "succeeded" && !isDemo;
  const chatStatus = isDemo
    ? "静态示例报告不启用追问"
    : chatEnabled
      ? "可继续追问"
      : uiStatus === "failed"
        ? "评审失败，无法追问"
        : "评审完成后可追问";

  const clearActiveWork = useCallback(() => {
    activeController.current?.abort();
    activeController.current = null;
    if (pollTimer.current !== null) {
      window.clearTimeout(pollTimer.current);
      pollTimer.current = null;
    }
  }, []);

  const abortChat = useCallback(() => {
    chatController.current?.abort();
    chatController.current = null;
  }, []);

  const resetSessionUi = useCallback(() => {
    setCurrentReview(null);
    setChatMessages([]);
    setChatDraft("");
    setChatBusy(false);
    setCopyState("idle");
  }, []);

  const applyReviewPayload = useCallback((payload: ReviewResponse, source: "poll" | "demo" = "poll") => {
    setCurrentReview(payload);
    setCopyState("idle");

    if (source === "demo") {
      setUiStatus("demo");
      setStatus({ tone: "success", message: "静态示例报告已载入，可以直接用于演示。" });
      return;
    }

    if (payload.status === "failed") {
      setUiStatus("failed");
      setStatus({ tone: "error", message: payload.error || "评审失败，请查看后端日志。" });
      return;
    }

    if (payload.status === "queued" || payload.status === "running") {
      setUiStatus(payload.status);
      setStatus({ tone: "neutral", message: "评审仍在进行，页面会继续自动刷新。" });
      return;
    }

    setUiStatus("succeeded");
    setStatus({ tone: "success", message: "评审完成。" });
  }, []);

  const schedulePoll = useCallback(
    (reviewId: string, signal: AbortSignal) => {
      if (pollTimer.current !== null) {
        window.clearTimeout(pollTimer.current);
      }

      pollTimer.current = window.setTimeout(async () => {
        pollTimer.current = null;
        try {
          const payload = await fetchReview(reviewId, signal);
          if (signal.aborted) return;
          applyReviewPayload(payload);
          if (!isTerminalReviewStatus(payload.status)) {
            schedulePoll(reviewId, signal);
          }
        } catch (error) {
          if (isAbortError(error)) return;
          setUiStatus("failed");
          setStatus({
            tone: "error",
            message: error instanceof Error ? error.message : "轮询评审结果失败，请稍后重试。",
          });
        }
      }, POLL_DELAY_MS);
    },
    [applyReviewPayload],
  );

  const handleSubmitReview = useCallback(async () => {
    const trimmed = prUrl.trim();
    if (!PR_URL_PATTERN.test(trimmed)) {
      setStatus({
        tone: "error",
        message: "请输入 GitHub Pull Request 链接，例如 https://github.com/owner/repo/pull/123。",
      });
      return;
    }

    clearActiveWork();
    abortChat();
    resetSessionUi();
    const controller = new AbortController();
    activeController.current = controller;
    setUiStatus("submitting");
    setStatus({ tone: "neutral", message: "评审任务已提交，正在等待后端处理。" });

    try {
      const created = await createReview(trimmed, controller.signal);
      if (controller.signal.aborted) return;
      setCurrentReview({
        review_id: created.review_id,
        thread_id: created.thread_id,
        pr_url: trimmed,
        status: created.status,
        findings: [],
        final_report: "报告生成中，请稍候。",
        error: null,
      });
      setUiStatus(created.status === "running" ? "running" : "queued");
      setStatus({ tone: "neutral", message: "评审任务已进入队列，页面会自动刷新。" });
      schedulePoll(created.review_id, controller.signal);
    } catch (error) {
      if (isAbortError(error)) return;
      setUiStatus("failed");
      setStatus({ tone: "error", message: error instanceof Error ? error.message : "提交评审失败。" });
    }
  }, [abortChat, clearActiveWork, prUrl, resetSessionUi, schedulePoll]);

  const handleLoadDemo = useCallback(async () => {
    clearActiveWork();
    abortChat();
    resetSessionUi();
    const controller = new AbortController();
    activeController.current = controller;
    setUiStatus("submitting");
    setStatus({ tone: "neutral", message: "正在载入静态示例报告。" });

    try {
      const payload = await fetchDemoReport(controller.signal);
      if (controller.signal.aborted) return;
      applyReviewPayload(payload, "demo");
    } catch (error) {
      if (isAbortError(error)) return;
      setUiStatus("failed");
      setStatus({ tone: "error", message: error instanceof Error ? error.message : "静态示例报告载入失败。" });
    }
  }, [abortChat, applyReviewPayload, clearActiveWork, resetSessionUi]);

  const handleCopyReport = useCallback(async () => {
    if (!report || report === EMPTY_REPORT) return;
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(report);
      } else {
        copyTextFallback(report);
      }
      setCopyState("copied");
      setStatus({ tone: "success", message: "报告已复制到剪贴板。" });
      window.setTimeout(() => setCopyState("idle"), 1400);
    } catch {
      copyTextFallback(report);
      setCopyState("copied");
      setStatus({ tone: "success", message: "报告已复制到剪贴板。" });
    }
  }, [report]);

  const handleSendChat = useCallback(
    async (message: string) => {
      const trimmed = message.trim();
      if (!trimmed || !chatEnabled || !currentReview || chatBusy) return;

      abortChat();
      const controller = new AbortController();
      chatController.current = controller;
      setChatBusy(true);
      setChatDraft("");
      setChatMessages((messages) => [
        ...messages,
        { id: makeMessageId("user"), role: "user", content: trimmed },
      ]);

      try {
        const payload = await sendChat(currentReview.review_id, trimmed, controller.signal);
        if (controller.signal.aborted) return;
        setChatMessages((messages) => [
          ...messages,
          { id: makeMessageId("assistant"), role: "assistant", content: payload.answer || "没有返回回答。" },
        ]);
        setStatus({ tone: "success", message: "追问已回复。" });
      } catch (error) {
        if (isAbortError(error)) return;
        const messageText = error instanceof Error ? error.message : "追问失败。";
        setChatMessages((messages) => [
          ...messages,
          { id: makeMessageId("assistant"), role: "assistant", content: messageText, isError: true },
        ]);
        setStatus({ tone: "error", message: messageText });
      } finally {
        if (!controller.signal.aborted) {
          setChatBusy(false);
        }
      }
    },
    [abortChat, chatBusy, chatEnabled, currentReview],
  );

  return (
    <main className="app-shell">
      <section className="workspace" aria-labelledby="page-title">
        <div className="workspace__intro">
          <p className="eyebrow">Python PR Review Dashboard</p>
          <h1 id="page-title">Code Review Agent</h1>
          <p className="intro-copy">
            输入 GitHub Pull Request 链接，启动代码评审流程，并在同一页查看风险摘要、结构化 findings 和 Markdown 报告。
          </p>
        </div>

        <ReviewForm
          prUrl={prUrl}
          onPrUrlChange={setPrUrl}
          onSubmitReview={handleSubmitReview}
          onLoadDemo={handleLoadDemo}
          isBusy={isReviewBusy}
          status={status}
        />
      </section>

      <StatusStrip
        status={uiStatus}
        reviewId={currentReview?.review_id ?? null}
        findingCount={findings.length}
        blockingCount={blockingCount}
      />

      <section className="results-grid" aria-label="评审结果">
        <FindingsPanel findings={findings} prTarget={currentReview?.pr_url ?? null} isLoading={isReviewBusy} />
        <ReportPanel
          report={report}
          canCopy={report !== EMPTY_REPORT && report.length > 0}
          copyState={copyState}
          onCopy={handleCopyReport}
        />
      </section>

      <ChatPanel
        enabled={chatEnabled}
        isBusy={chatBusy}
        statusText={chatStatus}
        messages={chatMessages}
        draft={chatDraft}
        onDraftChange={setChatDraft}
        onSend={handleSendChat}
      />
    </main>
  );
}
