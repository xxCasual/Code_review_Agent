import type { ChatResponse, ReviewCreateResponse, ReviewResponse } from "./types";

export const PR_URL_PATTERN = /^https:\/\/github\.com\/[^/]+\/[^/]+\/pull\/\d+\/?$/;

export class ApiError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ApiError";
  }
}

export async function createReview(prUrl: string, signal?: AbortSignal): Promise<ReviewCreateResponse> {
  return readJson<ReviewCreateResponse>(
    await fetch("/api/reviews", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pr_url: prUrl }),
      signal,
    }),
  );
}

export async function fetchReview(reviewId: string, signal?: AbortSignal): Promise<ReviewResponse> {
  return readJson<ReviewResponse>(
    await fetch(`/api/reviews/${encodeURIComponent(reviewId)}`, { signal }),
  );
}

export async function fetchDemoReport(signal?: AbortSignal): Promise<ReviewResponse> {
  return readJson<ReviewResponse>(await fetch("/api/demo-report", { signal }));
}

export async function sendChat(
  reviewId: string,
  message: string,
  signal?: AbortSignal,
): Promise<ChatResponse> {
  return readJson<ChatResponse>(
    await fetch(`/api/reviews/${encodeURIComponent(reviewId)}/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message }),
      signal,
    }),
  );
}

async function readJson<T>(response: Response): Promise<T> {
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message =
      typeof payload === "object" && payload !== null && "detail" in payload
        ? String(payload.detail)
        : "请求失败，请检查服务状态。";
    throw new ApiError(message);
  }
  return payload as T;
}

export function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === "AbortError";
}
