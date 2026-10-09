import { ReactNode } from "react";

export type AIStatus = "idle" | "loading" | "success" | "error";

interface AIResponseProps {
  open: boolean;
  status: AIStatus;
  feedback?: string;
  error?: string;
  onClose: () => void;
  onRetry?: () => void;
}

const STATUS_LABELS: Record<AIStatus, ReactNode> = {
  idle: "AI is idle",
  loading: "Sending HDL to AI...",
  success: "AI Feedback",
  error: "AI Error",
};

type Formatter = (text: string, key: string) => ReactNode[];

// Splits text on a global pattern: matches go through renderMatch, the text between them through renderRest
const splitOn =
  (
    pattern: RegExp,
    renderMatch: (inner: string, key: string) => ReactNode,
    renderRest: Formatter,
  ): Formatter =>
  (text, key) => {
    const parts: ReactNode[] = [];
    let last = 0;
    for (const match of text.matchAll(pattern)) {
      const index = match.index ?? 0;
      if (index > last) {
        parts.push(...renderRest(text.slice(last, index), `${key}-${last}`));
      }
      parts.push(renderMatch(match[1], `${key}-${index}`));
      last = index + match[0].length;
    }
    if (last < text.length) {
      parts.push(...renderRest(text.slice(last), `${key}-${last}`));
    }
    return parts;
  };

// **bold**
const formatBold = splitOn(
  /\*\*([^*]+)\*\*/g,
  (inner, key) => <strong key={key}>{inner}</strong>,
  (text) => [text],
);

// `inline code`, which may contain **bold**
const formatInline = splitOn(
  /`([^`\n]+)`/g,
  (inner, key) => <code key={key}>{formatBold(inner, key)}</code>,
  formatBold,
);

// ```lang fenced blocks```, which may contain **bold**
export const formatFeedback = splitOn(
  /```[^\n`]*\n?([\s\S]*?)\n?```\n?/g,
  (inner, key) => (
    <code key={key} className="ai-response__code-block">
      {formatBold(inner, key)}
    </code>
  ),
  formatInline,
);

export const AIResponse = ({
  open,
  status,
  feedback,
  error,
  onClose,
  onRetry,
}: AIResponseProps) => {
  if (!open) return null;

  const canRetry = typeof onRetry === "function" && status !== "loading";

  return (
    <dialog open className={`ai-response-dialog status-${status}`}>
      <article>
        <header>
          <div className="ai-response__title">
            <span role="img" aria-label="AI">
              🤖
            </span>
            <span>{STATUS_LABELS[status]}</span>
          </div>
          <a
            className="close"
            href="#close-ai-response"
            onClick={(event) => {
              event.preventDefault();
              onClose();
            }}
          />
        </header>
        <main>
          {status === "loading" && (
            <div className="ai-response__loading">
              <span className="spinner" aria-hidden="true" />
              <p>Comparing your HDL with our AI reviewer...</p>
            </div>
          )}
          {status === "success" && (
            <pre className="ai-response__content">
              {feedback ? formatFeedback(feedback, "ai") :"AI did not return any feedback."}
            </pre>
          )}
          {status === "error" && (
            <div className="ai-response__error">
              <p>{error ?? "Something went wrong while calling the AI."}</p>
            </div>
          )}
          {status === "idle" && (
            <div className="ai-response__idle">
              <p>Ready when you are!</p>
            </div>
          )}
        </main>
        <footer>
          <button onClick={onClose}>Close</button>
          {canRetry && (
            <button
              className="secondary"
              onClick={() => {
                onClose();
                onRetry?.();
              }}
            >
              Retry
            </button>
          )}
        </footer>
      </article>
    </dialog>
  );
};


