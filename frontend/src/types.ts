export type ReviewStatus = "queued" | "running" | "succeeded" | "failed";

export type UiStatus =
  | "idle"
  | "submitting"
  | "queued"
  | "running"
  | "succeeded"
  | "failed"
  | "demo";

export type Severity = "critical" | "high" | "medium" | "low" | "info";

export interface Finding {
  finding_id: string;
  hunk_id: string;
  file_path: string;
  start_line: number;
  end_line: number;
  severity: Severity;
  category: string;
  title: string;
  evidence: string;
  explanation: string;
  suggestion: string;
  confidence: number;
  is_blocking: boolean;
}

export interface ReviewCreateResponse {
  review_id: string;
  thread_id: string;
  status: ReviewStatus;
}

export interface ReviewResponse {
  review_id: string;
  thread_id: string;
  pr_url: string;
  status: ReviewStatus;
  findings: Finding[];
  final_report: string | null;
  error: string | null;
}

export interface ChatResponse {
  answer: string;
  review_id: string;
  thread_id: string;
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  isError?: boolean;
}

export interface InlineStatus {
  tone: "neutral" | "success" | "error";
  message: string;
}
