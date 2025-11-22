import { useCallback, useEffect } from "react";

//const AI_ENDPOINT = "https://nand2tetrisai-881742200158.europe-west1.run.app/compare";
const AI_ENDPOINT = "http://localhost:3000/compare";
const VALID_PROJECTS = ["01", "02", "03", "05"];

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
    if (!VALID_PROJECTS.includes(project)) {
      return `AI feature is only available for projects 1, 2, 3, or 5. Current project: ${project}`;
    }
    if (!chipName || chipName === "") {
      return "No chip is currently loaded. Please select a chip first.";
    }
    if (!hdlContent || hdlContent.trim() === "") {
      return "Current HDL file is empty.";
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
        const errorData = await response.json().catch(() => ({ error: "Unknown error" }));
        throw new Error(errorData.error || `Server error: ${response.status}`);
      }

      const feedback = await response.text();
      console.log("AI Response:", feedback);
      handlers.onSuccess?.(feedback);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "An error occurred while comparing files";
      console.error("Error calling AI endpoint:", message);
      handlers.onError?.(message);
    }
  }, [chipName, hdlContent, handlers, project, validateInputs]);

  useEffect(() => {
    (window as any).ai = triggerAi;
    return () => {
      delete (window as any).ai;
    };
  }, [triggerAi]);

  return { triggerAi };
}

