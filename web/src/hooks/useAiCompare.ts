import { useCallback, useEffect } from "react";

const AI_ENDPOINT =
  "https://nand2tetrisai-881742200158.europe-west1.run.app/compare";
//const AI_ENDPOINT = "http://localhost:3000/compare";

// Projects the AI service has reference solutions for
const AI_PROJECTS = ["01", "02", "03", "05"];

export const isAiProject = (project: string) => AI_PROJECTS.includes(project);

export const AI_UNAVAILABLE_MESSAGE =
  "AI hints are available for projects 1, 2, 3 and 5.";

interface UseAiCompareParams {
  project: string;
  chipName: string;
  hdlContent: string;
}

interface UseAiCompareHandlers {
  onStart?: () => void;
  onSuccess?: (feedback: string) => void;
  onError?: (message: string) => void;
}

// Turns the service's HTTP status into something a student can act on
function describeServerError(status: number, chipName: string): string {
  if (status === 404) {
    return `There's no reference solution for ${chipName} yet, so the AI can't check it.`;
  }
  if (status === 429 || status === 503) {
    return "The AI is busy right now. Try again in a minute.";
  }
  return "The AI couldn't answer this time. Try again.";
}

/**
 * Custom hook that exposes an ai() function globally for comparing HDL files
 * with the AI endpoint. The function can be called from the browser console.
 *
 * @param project - Current project ID (e.g., "01", "02", "03", "05")
 * @param chipName - Name of the current chip (without .hdl extension)
 * @param hdlContent - Current HDL file content
 */
export function useAiCompare(
  { project, chipName, hdlContent }: UseAiCompareParams,
  handlers: UseAiCompareHandlers = {},
) {
  const validateInputs = useCallback((): string | undefined => {
    if (!isAiProject(project)) {
      return AI_UNAVAILABLE_MESSAGE;
    }
    if (!chipName || chipName === "") {
      return "Open a chip first, then ask for a hint.";
    }
    if (!hdlContent || hdlContent.trim() === "") {
      return "Your HDL file is empty. Write some code first.";
    }
    return undefined;
  }, [project, chipName, hdlContent]);

  const triggerAi = useCallback(async () => {
    const validationMessage = validateInputs();
    if (validationMessage) {
      console.log(validationMessage);
      handlers.onError?.(validationMessage);
      return;
    }

    handlers.onStart?.();

    const fileName = `${chipName}.hdl`;
    const fileBlob = new Blob([hdlContent], { type: "text/plain" });
    const file = new File([fileBlob], fileName, { type: "text/plain" });

    const formData = new FormData();
    formData.append("practiceFile", file);

    console.log("Sending request to AI endpoint...", {
      fileName,
      project,
      contentLength: hdlContent.length,
    });

    try {
      const response = await fetch(AI_ENDPOINT, {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response
          .json()
          .catch(() => ({ error: "Unknown error" }));
        console.error("AI endpoint error:", response.status, errorData);
        handlers.onError?.(describeServerError(response.status, chipName));
        return;
      }

      const feedback = await response.text();
      console.log("AI Response:", feedback);
      handlers.onSuccess?.(feedback);
    } catch (error) {
      // fetch only throws on network failures (offline, DNS, CORS)
      console.error("Error calling AI endpoint:", error);
      handlers.onError?.(
        "Couldn't reach the AI service. Check your internet connection and try again.",
      );
    }
  }, [chipName, hdlContent, handlers, project, validateInputs]);

  useEffect(() => {
    const win = window as Window & { ai?: () => Promise<void> };
    win.ai = triggerAi;
    return () => {
      delete win.ai;
    };
  }, [triggerAi]);

  return { triggerAi };
}
