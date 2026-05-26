import type { Finding, ReviewStatus, Severity, UiStatus } from "./types";

export const POLL_DELAY_MS = 2000;

const STATUS_LABELS: Record<UiStatus | ReviewStatus, string> = {
  idle: "等待输入",
  submitting: "提交中",
  queued: "排队中",
  running: "评审中",
  succeeded: "已完成",
  failed: "失败",
  demo: "静态示例报告",
};

const SEVERITY_ORDER: Record<Severity, number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
  info: 4,
};

export function statusLabel(status: UiStatus | ReviewStatus): string {
  return STATUS_LABELS[status] ?? status;
}

export function isTerminalReviewStatus(status: ReviewStatus): boolean {
  return status === "succeeded" || status === "failed";
}

export function sortFindings(findings: Finding[]): Finding[] {
  return [...findings].sort((a, b) => {
    const severity = SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity];
    if (severity !== 0) return severity;
    if (a.is_blocking !== b.is_blocking) return a.is_blocking ? -1 : 1;
    return b.confidence - a.confidence || a.file_path.localeCompare(b.file_path);
  });
}

export function findingKey(finding: Finding): string {
  return [
    finding.finding_id,
    finding.file_path,
    finding.start_line,
    finding.end_line,
    finding.title,
  ].join(":");
}

export function confidenceLabel(value: number): string {
  return `confidence ${Math.round(value * 100)}%`;
}

export function copyTextFallback(text: string): void {
  const textArea = document.createElement("textarea");
  textArea.value = text;
  textArea.setAttribute("readonly", "");
  textArea.style.position = "fixed";
  textArea.style.opacity = "0";
  textArea.style.pointerEvents = "none";
  document.body.append(textArea);
  textArea.select();
  document.execCommand("copy");
  textArea.remove();
}

export function makeMessageId(prefix: string): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `${prefix}-${crypto.randomUUID()}`;
  }
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}
