import { fireEvent, render, screen } from "@testing-library/react";
import { AIResponse, parseFeedback } from "./AIResponse";

describe("parseFeedback", () => {
  it("tags fenced code after Before/After labels", () => {
    const blocks = parseFeedback(
      [
        "The outputs are swapped.",
        "",
        "**Before:**",
        "```hdl",
        "    And(a=in, b=**sel**, out=a);",
        "```",
        "",
        "**After:**",
        "```hdl",
        "    And(a=in, b=**notSel**, out=a);",
        "```",
      ].join("\n"),
    );

    expect(blocks).toEqual([
      { kind: "paragraph", lines: ["The outputs are swapped."] },
      { kind: "code", code: "And(a=in, b=**sel**, out=a);", variant: "before" },
      {
        kind: "code",
        code: "And(a=in, b=**notSel**, out=a);",
        variant: "after",
      },
    ]);
  });

  it("joins consecutive `code` lines into one block", () => {
    const blocks = parseFeedback(
      [
        "Before:",
        "`And(a=a, b=**sel**, out=w1);`",
        "`And(a=b, b=**notSel**, out=w2);`",
        "",
        "Keep going!",
      ].join("\n"),
    );

    expect(blocks).toEqual([
      {
        kind: "code",
        code: "And(a=a, b=**sel**, out=w1);\nAnd(a=b, b=**notSel**, out=w2);",
        variant: "before",
      },
      { kind: "paragraph", lines: ["Keep going!"] },
    ]);
  });

  it("parses lists and leaves unlabelled code untagged", () => {
    expect(
      parseFeedback("Check:\n- the `sel` pin\n- the outputs\n\n`Not(in=a, out=b);`"),
    ).toEqual([
      { kind: "paragraph", lines: ["Check:"] },
      { kind: "list", items: ["the `sel` pin", "the outputs"] },
      { kind: "code", code: "Not(in=a, out=b);", variant: undefined },
    ]);
  });
});

describe("AIResponse", () => {
  const feedback = [
    "Route the output to a wire, then invert `x` with **one** more gate.",
    "",
    "**Before:**",
    "`Nand(a=a, b=b, out=**out**);`",
    "",
    "**After:**",
    "```hdl",
    "Nand(a=a, b=b, out=**x**);",
    "```",
  ].join("\n");

  it("renders the feedback as text, inline code and Before/After blocks", () => {
    const { container } = render(
      <AIResponse
        open
        status="success"
        chipName="And"
        feedback={feedback}
        onClose={() => {}}
      />,
    );

    expect(screen.getByText("And.hdl")).toBeVisible();
    expect(container.textContent).not.toMatch(/```|\*\*|`/);

    const before = container.querySelector(".ai-code--before");
    const after = container.querySelector(".ai-code--after");
    expect(before).toHaveTextContent("Before");
    expect(before).toHaveTextContent("Nand(a=a, b=b, out=out);");
    expect(after).toHaveTextContent("Nand(a=a, b=b, out=x);");
    expect(after?.querySelector("strong")).toHaveTextContent("x");

    expect(screen.getByText("x", { selector: "p code" })).toBeVisible();
    expect(screen.getByText("one").tagName).toBe("STRONG");
  });

  it("shows progress while loading and hides the retry button", () => {
    render(<AIResponse open status="loading" onClose={() => {}} onRetry={() => {}} />);

    expect(screen.getByText("Reading your HDL…")).toBeVisible();
    expect(screen.queryByText("Ask again")).toBeNull();
  });

  it("shows the error and retries", () => {
    const onRetry = vi.fn();
    render(
      <AIResponse
        open
        status="error"
        error="The AI is busy right now. Try again in a minute."
        onClose={() => {}}
        onRetry={onRetry}
      />,
    );

    expect(screen.getByRole("alert")).toHaveTextContent("The AI is busy right now");
    fireEvent.click(screen.getByText("Try again"));
    expect(onRetry).toHaveBeenCalledOnce();
  });

  it("closes on Escape, on the backdrop and on Got it", () => {
    const onClose = vi.fn();
    const { container } = render(
      <AIResponse open status="success" feedback="Great job!" onClose={onClose} />,
    );

    fireEvent.keyDown(window, { key: "Escape" });
    fireEvent.click(container.querySelector("dialog") as HTMLDialogElement);
    fireEvent.click(screen.getByText("Got it"));
    fireEvent.click(screen.getByText("Great job!"));

    expect(onClose).toHaveBeenCalledTimes(3);
  });
});
