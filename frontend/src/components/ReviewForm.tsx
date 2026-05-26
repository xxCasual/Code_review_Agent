import { FileText, Play, RefreshCw } from "lucide-react";
import type { InlineStatus as InlineStatusModel } from "../types";
import { InlineStatus } from "./InlineStatus";

interface ReviewFormProps {
  prUrl: string;
  onPrUrlChange: (value: string) => void;
  onSubmitReview: () => void;
  onLoadDemo: () => void;
  isBusy: boolean;
  status: InlineStatusModel;
}

export function ReviewForm({
  prUrl,
  onPrUrlChange,
  onSubmitReview,
  onLoadDemo,
  isBusy,
  status,
}: ReviewFormProps) {
  return (
    <form
      id="review-form"
      className="review-form"
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        onSubmitReview();
      }}
    >
      <label htmlFor="pr-url">Pull Request URL</label>
      <div className="input-row">
        <input
          id="pr-url"
          name="pr-url"
          type="url"
          autoComplete="url"
          inputMode="url"
          placeholder="https://github.com/owner/repo/pull/123"
          value={prUrl}
          disabled={isBusy}
          aria-invalid={status.tone === "error"}
          onChange={(event) => onPrUrlChange(event.target.value)}
          required
        />
        <button id="submit-button" type="submit" disabled={isBusy}>
          {isBusy ? <RefreshCw aria-hidden="true" size={18} className="spin-icon" /> : <Play aria-hidden="true" size={18} />}
          <span>{isBusy ? "处理中" : "开始评审"}</span>
        </button>
        <button
          id="demo-button"
          className="button-secondary"
          type="button"
          disabled={isBusy}
          onClick={onLoadDemo}
        >
          <FileText aria-hidden="true" size={18} />
          <span>查看静态示例报告</span>
        </button>
      </div>
      <InlineStatus status={status} />
    </form>
  );
}
