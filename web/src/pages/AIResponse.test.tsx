import { render, screen } from "@testing-library/react";
import { AIResponse } from "./AIResponse";

describe("AIResponse", () => {
  it("renders code fences, inline code and bold from the AI feedback", () => {
    const feedback = [
      "Route the output to a wire:",
      "```hdl",
      "Nand(a=a, b=b, out=**x**);",
      "```",
      "Then invert `x` with **one** more gate.",
    ].join("\n");

    const { container } = render(
      <AIResponse open status="success" feedback={feedback} onClose={() => {}} />,
    );

    expect(container.textContent).not.toContain("```");
    expect(container.textContent).not.toContain("**");

    const block = container.querySelector(".ai-response__code-block");
    expect(block).toHaveTextContent("Nand(a=a, b=b, out=x);");
    expect(block?.querySelector("strong")).toHaveTextContent("x");

    expect(screen.getByText("x", { selector: "pre > code" })).toBeVisible();
    expect(screen.getByText("one").tagName).toBe("STRONG");
  });

  it("leaves plain feedback untouched", () => {
    render(
      <AIResponse
        open
        status="success"
        feedback="Great job! Your chip is correct."
        onClose={() => {}}
      />,
    );

    expect(screen.getByText("Great job! Your chip is correct.")).toBeVisible();
  });
});
