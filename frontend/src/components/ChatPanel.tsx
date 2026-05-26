import { MessageSquare, Send, Sparkles } from "lucide-react";
import type { ChatMessage } from "../types";
import { EmptyState } from "./EmptyState";

const CHAT_SUGGESTIONS = [
  "解释 finding 1",
  "只看 security findings",
  "生成简短 PR comment",
  "这个函数是内部用的，重新评估 finding 1",
];

interface ChatPanelProps {
  enabled: boolean;
  isBusy: boolean;
  statusText: string;
  messages: ChatMessage[];
  draft: string;
  onDraftChange: (value: string) => void;
  onSend: (message: string) => void;
}

export function ChatPanel({
  enabled,
  isBusy,
  statusText,
  messages,
  draft,
  onDraftChange,
  onSend,
}: ChatPanelProps) {
  const disabled = !enabled || isBusy;

  return (
    <section id="chat-panel" className="result-panel chat-panel" aria-labelledby="chat-title">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">Follow-Up Chat</p>
          <h2 id="chat-title">追问</h2>
        </div>
        <span id="chat-status" className="target-label">
          {statusText}
        </span>
      </div>

      <div id="chat-log" className="chat-log" aria-live="polite">
        {messages.length === 0 ? (
          <EmptyState compact>真实 PR 评审完成后，可以继续追问 findings、筛选问题或生成简短 PR comment。</EmptyState>
        ) : (
          messages.map((message) => <ChatBubble key={message.id} message={message} />)
        )}
      </div>

      <div className="chat-suggestions" aria-label="常用追问">
        {CHAT_SUGGESTIONS.map((suggestion) => (
          <button
            key={suggestion}
            className="button-secondary compact chat-suggestion"
            type="button"
            disabled={disabled}
            onClick={() => onSend(suggestion)}
          >
            <Sparkles aria-hidden="true" size={15} />
            <span>{suggestion === "这个函数是内部用的，重新评估 finding 1" ? "重新评估 finding 1" : suggestion}</span>
          </button>
        ))}
      </div>

      <form
        id="chat-form"
        className="chat-form"
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          onSend(draft);
        }}
      >
        <label htmlFor="chat-message">追问内容</label>
        <div className="chat-input-row">
          <input
            id="chat-message"
            name="chat-message"
            type="text"
            placeholder="例如：解释 finding 1"
            autoComplete="off"
            value={draft}
            disabled={disabled}
            onChange={(event) => onDraftChange(event.target.value)}
          />
          <button id="chat-submit" type="submit" disabled={disabled || draft.trim().length === 0}>
            {isBusy ? <MessageSquare aria-hidden="true" size={18} className="pulse-icon" /> : <Send aria-hidden="true" size={18} />}
            <span>{isBusy ? "发送中" : "发送"}</span>
          </button>
        </div>
      </form>
    </section>
  );
}

function ChatBubble({ message }: { message: ChatMessage }) {
  return (
    <article className={`chat-message chat-message-${message.role}${message.isError ? " chat-message-error" : ""}`}>
      <strong>{message.role === "user" ? "你" : "Review Agent"}</strong>
      <p>{message.content}</p>
    </article>
  );
}
