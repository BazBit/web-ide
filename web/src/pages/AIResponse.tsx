import { ReactNode, useEffect, useState } from "react";

export type AIStatus = "idle" | "loading" | "success" | "error";

interface AIResponseProps {
  open: boolean;
  status: AIStatus;
  chipName?: string;
  feedback?: string;
  error?: string;
  onClose: () => void;
  onRetry?: () => void;
}

// Rotating status lines while the AI is working (a hint usually takes 5-10s)
const LOADING_STEPS = [
  "Reading your HDL…",
  "Comparing it with the reference solution…",
  "Writing a hint for you…",
];
const LOADING_STEP_MS = 2500;

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

// *italic*
const formatItalic = splitOn(
  /\*([^*\n]+)\*/g,
  (inner, key) => <em key={key}>{inner}</em>,
  (text) => [text],
);

// **bold**
const formatBold = splitOn(
  /\*\*([^*]+)\*\*/g,
  (inner, key) => <strong key={key}>{inner}</strong>,
  (text) => [text],
);

// **bold**, then *italic* in the rest
const formatEmphasis = splitOn(
  /\*\*([^*]+)\*\*/g,
  (inner, key) => <strong key={key}>{inner}</strong>,
  formatItalic,
);

// `inline code`, which may contain **bold**
const formatInline = splitOn(
  /`([^`\n]+)`/g,
  (inner, key) => <code key={key}>{formatBold(inner, key)}</code>,
  formatEmphasis,
);

type CodeVariant = "before" | "after";

export type FeedbackBlock =
  | { kind: "paragraph"; lines: string[] }
  | { kind: "list"; items: string[] }
  | { kind: "code"; code: string; variant?: CodeVariant };

const FENCE = /```[^\n`]*\n?([\s\S]*?)\n?```/g;
// "Before:", "**Before:**", "**After**:" on a line of their own
const LABEL =
  /^\s*(?:\*\*)?\s*(before|after)\s*(?:\*\*)?\s*:?\s*(?:\*\*)?\s*:?\s*$/i;
// A line that is nothing but `code`
const CODE_LINE = /^\s*`([^`]+)`\s*$/;
const LIST_ITEM = /^\s*(?:[-*•]|\d+\.)\s+(.*)$/;

// Removes the indentation shared by every non-empty line
const dedent = (code: string) => {
  const lines = code.split("\n");
  const indents = lines
    .filter((line) => line.trim() !== "")
    .map((line) => line.match(/^\s*/)?.[0].length ?? 0);
  const shared = Math.min(...indents, Infinity);
  return Number.isFinite(shared)
    ? lines.map((line) => line.slice(shared)).join("\n")
    : code;
};

// Splits the AI's markdown-ish answer into paragraphs, lists and code blocks.
// Code right after a "Before:" / "After:" label is tagged so it can be shown as a diff.
export const parseFeedback = (text: string): FeedbackBlock[] => {
  const blocks: FeedbackBlock[] = [];
  let current: FeedbackBlock | undefined;
  let variant: CodeVariant | undefined;

  const start = (block: FeedbackBlock) => {
    blocks.push(block);
    current = block;
  };
  const close = () => {
    if (current?.kind === "code") {
      variant = undefined;
    }
    current = undefined;
  };

  const addText = (segment: string) => {
    for (const line of segment.split("\n")) {
      if (line.trim() === "") {
        close();
        continue;
      }

      const label = line.match(LABEL);
      if (label) {
        close();
        variant = label[1].toLowerCase() as CodeVariant;
        continue;
      }

      const codeLine = line.match(CODE_LINE);
      if (codeLine) {
        if (current?.kind === "code") {
          current.code += `\n${codeLine[1]}`;
        } else {
          start({ kind: "code", code: codeLine[1], variant });
        }
        continue;
      }

      if (current?.kind === "code") {
        close();
      }
      variant = undefined;

      const item = line.match(LIST_ITEM);
      if (item) {
        if (current?.kind === "list") {
          current.items.push(item[1]);
        } else {
          start({ kind: "list", items: [item[1]] });
        }
      } else if (current?.kind === "paragraph") {
        current.lines.push(line.trim());
      } else {
        start({ kind: "paragraph", lines: [line.trim()] });
      }
    }
  };

  let last = 0;
  for (const match of text.matchAll(FENCE)) {
    const index = match.index ?? 0;
    addText(text.slice(last, index));
    close();
    blocks.push({ kind: "code", code: dedent(match[1]), variant });
    variant = undefined;
    last = index + match[0].length;
  }
  addText(text.slice(last));

  return blocks;
};

const renderBlock = (block: FeedbackBlock, index: number) => {
  const key = `block-${index}`;
  switch (block.kind) {
    case "paragraph":
      return (
        <p key={key}>
          {block.lines.flatMap((line, i) => [
            ...(i > 0 ? [<br key={`${key}-br-${i}`} />] : []),
            ...formatInline(line, `${key}-${i}`),
          ])}
        </p>
      );
    case "list":
      return (
        <ul key={key}>
          {block.items.map((item, i) => (
            <li key={`${key}-${i}`}>{formatInline(item, `${key}-${i}`)}</li>
          ))}
        </ul>
      );
    case "code":
      return (
        <figure
          key={key}
          className={`ai-code${block.variant ? ` ai-code--${block.variant}` : ""}`}
        >
          {block.variant && (
            <figcaption>
              {block.variant === "before" ? "Before" : "After"}
            </figcaption>
          )}
          <pre>
            <code>{formatBold(block.code, key)}</code>
          </pre>
        </figure>
      );
  }
};

export const AIResponse = ({
  open,
  status,
  chipName,
  feedback,
  error,
  onClose,
  onRetry,
}: AIResponseProps) => {
  const [step, setStep] = useState(0);

  useEffect(() => {
    if (status !== "loading") {
      return;
    }
    setStep(0);
    const timer = setInterval(
      () => setStep((s) => Math.min(s + 1, LOADING_STEPS.length - 1)),
      LOADING_STEP_MS,
    );
    return () => clearInterval(timer);
  }, [status]);

  useEffect(() => {
    if (!open) {
      return;
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  const canRetry = typeof onRetry === "function" && status !== "loading";

  return (
    <dialog
      open
      className={`ai-response-dialog status-${status}`}
      aria-labelledby="ai-response-title"
      onClick={(event) => {
        // Clicking the dimmed backdrop (outside the card) closes the dialog
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <article>
        <header>
          <div id="ai-response-title" className="ai-response__title">
            <span className="ai-response__avatar" aria-hidden="true">
              🤖
            </span>
            <div>
              <div className="ai-response__heading">AI hint</div>
              {chipName && (
                <div className="ai-response__subheading">{chipName}.hdl</div>
              )}
            </div>
          </div>
          <a
            className="close"
            href="#close-ai-response"
            aria-label="Close"
            onClick={(event) => {
              event.preventDefault();
              onClose();
            }}
          />
        </header>

        <div
          className="ai-response__body"
          aria-live="polite"
          aria-busy={status === "loading"}
        >
          {status === "loading" && (
            <div className="ai-response__loading">
              <div className="ai-response__skeleton" aria-hidden="true">
                <span />
                <span />
                <span />
              </div>
              <p>{LOADING_STEPS[step]}</p>
            </div>
          )}
          {status === "success" &&
            (feedback?.trim() ? (
              <div className="ai-response__content">
                {parseFeedback(feedback).map(renderBlock)}
              </div>
            ) : (
              <p>The AI didn't return any feedback. Try asking again.</p>
            ))}
          {status === "error" && (
            <div className="ai-response__error" role="alert">
              <p className="ai-response__error-title">Couldn't get a hint</p>
              <p>{error ?? "Something went wrong while calling the AI."}</p>
            </div>
          )}
        </div>

        <footer>
          <small className="ai-response__disclaimer">
            AI hints can be wrong. Run the tests to be sure.
          </small>
          <div className="ai-response__actions">
            {canRetry && (
              <button className="secondary outline" onClick={onRetry}>
                {status === "error" ? "Try again" : "Ask again"}
              </button>
            )}
            <button onClick={onClose}>
              {status === "loading" ? "Close" : "Got it"}
            </button>
          </div>
        </footer>
      </article>
    </dialog>
  );
};
