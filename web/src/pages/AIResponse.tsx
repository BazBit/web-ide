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

// Helper function to format text with ** ** as bold
const formatFeedback = (text: string): ReactNode[] => {
  const parts: ReactNode[] = [];
  let currentIndex = 0;
  const regex = /\*\*([^*]+)\*\*/g;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(text)) !== null) {
    // Add text before the match
    if (match.index > currentIndex) {
      parts.push(text.substring(currentIndex, match.index));
    }
    // Add the bold text
    parts.push(<strong key={match.index}>{match[1]}</strong>);
    currentIndex = regex.lastIndex;
  }

  // Add remaining text
  if (currentIndex < text.length) {
    parts.push(text.substring(currentIndex));
  }

  return parts.length > 0 ? parts : [text];
};

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
              {feedback ? formatFeedback(feedback) : "AI did not return any feedback."}
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


