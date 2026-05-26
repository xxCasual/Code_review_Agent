import { act, fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { App } from "./App";
import type { ReviewResponse } from "./types";

const demoPayload: ReviewResponse = {
  review_id: "demo",
  thread_id: "demo",
  pr_url: "https://github.com/portfolio/demo-python-service/pull/42",
  status: "succeeded",
  findings: [
    {
      finding_id: "F-1",
      hunk_id: "h1",
      file_path: "src/app.py",
      start_line: 10,
      end_line: 10,
      severity: "high",
      category: "security",
      title: "Unsafe dynamic code execution",
      evidence: "eval(user_input)",
      explanation: "Dynamic execution can run untrusted input.",
      suggestion: "Use a parser.",
      confidence: 0.9,
      is_blocking: true,
    },
  ],
  final_report: "# Code Review\n\nUnsafe dynamic code execution",
  error: null,
};

describe("App", () => {
  it("validates PR URLs before submitting", async () => {
    render(<App />);

    fireEvent.change(screen.getByLabelText("Pull Request URL"), {
      target: { value: "https://github.com/octo/demo/issues/1" },
    });
    fireEvent.click(screen.getByRole("button", { name: /开始评审/ }));

    expect(await screen.findByText(/请输入 GitHub Pull Request 链接/)).toBeInTheDocument();
  });

  it("loads and renders the demo report", async () => {
    mockFetch([{ body: demoPayload }]);
    render(<App />);

    fireEvent.click(screen.getByRole("button", { name: /查看静态示例报告/ }));

    expect(await screen.findByText("Unsafe dynamic code execution")).toBeInTheDocument();
    expect(screen.getByText("静态示例报告")).toBeInTheDocument();
    expect(screen.getByText(/# Code Review/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /发送/ })).toBeDisabled();
  });

  it("polls queued and running reviews until success", async () => {
    vi.useFakeTimers();
    mockFetch([
      { body: { review_id: "r1", thread_id: "r1", status: "queued" } },
      { body: { ...demoPayload, review_id: "r1", thread_id: "r1", status: "running", findings: [], final_report: null } },
      { body: { ...demoPayload, review_id: "r1", thread_id: "r1", pr_url: "https://github.com/octo/demo/pull/1" } },
    ]);
    render(<App />);

    fireEvent.change(screen.getByLabelText("Pull Request URL"), {
      target: { value: "https://github.com/octo/demo/pull/1" },
    });
    fireEvent.click(screen.getByRole("button", { name: /开始评审/ }));

    await flushPromises();
    expect(screen.getByText("排队中")).toBeInTheDocument();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(2000);
    });
    expect(screen.getByText("评审中")).toBeInTheDocument();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(2000);
    });

    expect(screen.getByText("已完成")).toBeInTheDocument();
    expect(screen.getByText("Unsafe dynamic code execution")).toBeInTheDocument();
    expect(fetch).toHaveBeenCalledTimes(3);
  });

  it("sends chat after a real review succeeds and records failures", async () => {
    vi.useFakeTimers();
    mockFetch([
      { body: { review_id: "r1", thread_id: "r1", status: "queued" } },
      { body: { ...demoPayload, review_id: "r1", thread_id: "r1", pr_url: "https://github.com/octo/demo/pull/1" } },
      { body: { answer: "Finding 1 explains the eval risk.", review_id: "r1", thread_id: "r1" } },
      { ok: false, body: { detail: "Chat unavailable" } },
    ]);
    render(<App />);

    fireEvent.change(screen.getByLabelText("Pull Request URL"), {
      target: { value: "https://github.com/octo/demo/pull/1" },
    });
    fireEvent.click(screen.getByRole("button", { name: /开始评审/ }));
    await flushPromises();
    expect(screen.getByText("排队中")).toBeInTheDocument();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(2000);
    });
    expect(screen.getByText("Unsafe dynamic code execution")).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("追问内容"), {
      target: { value: "解释 finding 1" },
    });
    fireEvent.click(screen.getByRole("button", { name: /发送/ }));
    await flushPromises();
    expect(screen.getByText("Finding 1 explains the eval risk.")).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("追问内容"), {
      target: { value: "再解释一次" },
    });
    fireEvent.click(screen.getByRole("button", { name: /发送/ }));
    await flushPromises();
    expect(screen.getAllByText("Chat unavailable")).toHaveLength(2);
  });
});

interface MockFetchStep {
  ok?: boolean;
  body: unknown;
}

function mockFetch(steps: MockFetchStep[]) {
  const fetchMock = vi.fn();
  for (const step of steps) {
    fetchMock.mockResolvedValueOnce(jsonResponse(step.body, step.ok ?? true));
  }
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

function jsonResponse(body: unknown, ok = true): Response {
  return {
    ok,
    json: async () => body,
  } as Response;
}

async function flushPromises(): Promise<void> {
  await act(async () => {
    await Promise.resolve();
  });
}
