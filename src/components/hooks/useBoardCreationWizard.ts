import { useState, useCallback } from "react";
import { sdk } from "@farcaster/miniapp-sdk";
import type { CanvasImage } from "@/lib/storage";

export interface BoardWizardStep {
  step: "details" | "preview" | "publish" | "complete";
  progressPercent: number;
}

// Helper to perform authenticated fetch, using sdk.quickAuth.fetch when available
async function authFetch(
  input: RequestInfo | URL,
  init?: RequestInit,
): Promise<Response> {
  try {
    // Try sdk.quickAuth.fetch first - this handles auth automatically in Farcaster context
    try {
      console.debug("🔑 Attempting sdk.quickAuth.fetch...");
      const response = await sdk.quickAuth.fetch(input, init);
      console.debug("✓ sdk.quickAuth.fetch succeeded");
      return response;
    } catch (err) {
      console.warn("⚠ sdk.quickAuth.fetch failed, trying manual token...", err);
    }

    // Fallback: manually get token
    console.debug("🔑 Getting token manually...");
    const result = await sdk.quickAuth.getToken();
    
    if (result?.token) {
      console.debug("✓ Got token:", result.token.substring(0, 20) + "...");
      const headers = new Headers(init?.headers);
      headers.set("Authorization", `Bearer ${result.token}`);
      return fetch(input, { ...init, headers });
    } else {
      console.warn("❌ No token in result:", result);
    }
  } catch (err) {
    console.error("❌ authFetch error:", err);
  }

  // Last resort: try without auth (will likely get 401)
  console.warn("⚠ No auth token available - proceeding without auth (expected to fail)");
  try {
    return await fetch(input, init);
  } catch (fetchErr) {
    console.error("❌ Even basic fetch failed:", fetchErr);
    throw new Error(
      "Network error - check your connection and try opening the app from Warpcast",
    );
  }
}

export interface BoardCreationData {
  title: string;
  caption: string;
  canvasState: CanvasImage[];
  canvasWidth: number;
  canvasHeight: number;
  background: string;
  orientation: "portrait" | "landscape" | "square";
  margin: boolean;
  categories: string[];
  isPublic: boolean;
  previewUrl: string | null;
  remixOfId?: string;
}

import type { CloudCanvasImage } from "@/lib/schema";

export function useBoardCreationWizard() {
  const [step, setStep] = useState<BoardWizardStep["step"]>("details");
  const [isCreating, setIsCreating] = useState(false);
  const [creationError, setCreationError] = useState<string | null>(null);
  const [createdBoardId, setCreatedBoardId] = useState<string | null>(null);

  const getProgressPercent = useCallback((currentStep: typeof step) => {
    const steps: Record<typeof step, number> = {
      details: 25,
      preview: 50,
      publish: 75,
      complete: 100,
    };
    return steps[currentStep];
  }, []);

  const validateDetails = useCallback(
    (data: Partial<BoardCreationData>): string[] => {
      const errors: string[] = [];

      if (!data.title?.trim()) {
        errors.push("Title is required");
      } else if (data.title.length > 200) {
        errors.push("Title must be 200 characters or less");
      }

      if (data.caption && data.caption.length > 1000) {
        errors.push("Caption must be 1000 characters or less");
      }

      if (!Array.isArray(data.canvasState) || data.canvasState.length === 0) {
        errors.push("At least one image is required");
      } else if (data.canvasState.length > 20) {
        errors.push("Maximum 20 images allowed");
      }

      if (!data.canvasWidth || !data.canvasHeight) {
        errors.push("Canvas dimensions are required");
      }

      if (
        data.orientation &&
        !["portrait", "landscape", "square"].includes(data.orientation)
      ) {
        errors.push("Invalid orientation");
      }

      if (data.categories && data.categories.length > 20) {
        errors.push("Maximum 20 categories allowed");
      }

      return errors;
    },
    [],
  );

  const createBoard = useCallback(
    async (data: BoardCreationData, publish = false) => {
      setIsCreating(true);
      setCreationError(null);

      try {
        // Validate
        const errors = validateDetails(data);
        if (errors.length > 0) {
          setCreationError(errors[0]);
          return { success: false, error: errors[0] };
        }

        console.debug("📤 Creating board...");
        const response = await authFetch("/api/boards/create", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...data,
            isPublic: publish,
          }),
        });

        console.debug(
          "📥 Response:",
          response.status,
          response.statusText,
        );

        if (!response.ok) {
          let errorMsg = `Server error: ${response.status} ${response.statusText}`;
          
          try {
            const error = await response.json();
            if (error.details?.[0]) {
              errorMsg = error.details[0];
            } else if (error.error) {
              errorMsg = error.error;
            }
          } catch {
            // If JSON parse fails, use status-based messages
            if (response.status === 401) {
              errorMsg = "Authentication failed. Please open the app from Warpcast to sign in.";
            } else if (response.status === 403) {
              errorMsg = "Permission denied. Make sure you are signed in to Farcaster.";
            }
          }

          console.error("❌ Board creation failed:", errorMsg);
          setCreationError(errorMsg);
          return { success: false, error: errorMsg };
        }

        const result = await response.json();
        console.debug("✅ Board created:", result.boardId);
        setCreatedBoardId(result.boardId);

        return { success: true, boardId: result.boardId };
      } catch (err) {
        const errorMsg =
          err instanceof Error ? err.message : "Failed to create board";
        console.error("❌ Error:", errorMsg, err);
        setCreationError(errorMsg);
        return { success: false, error: errorMsg };
      } finally {
        setIsCreating(false);
      }
    },
    [validateDetails],
  );

  const updateBoard = useCallback(
    async (boardId: string, data: Partial<BoardCreationData>) => {
      setIsCreating(true);
      setCreationError(null);

      try {
        const response = await authFetch(`/api/boards/${boardId}/update`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(data),
        });

        if (!response.ok) {
          const error = await response.json();
          const errorMsg = error.error || "Failed to update board";
          setCreationError(errorMsg);
          return { success: false, error: errorMsg };
        }

        return { success: true, boardId };
      } catch (err) {
        const errorMsg =
          err instanceof Error ? err.message : "Failed to update board";
        setCreationError(errorMsg);
        return { success: false, error: errorMsg };
      } finally {
        setIsCreating(false);
      }
    },
    [],
  );

  const publishBoard = useCallback(async (boardId: string) => {
    setIsCreating(true);
    setCreationError(null);

    try {
      const response = await authFetch(`/api/boards/${boardId}/publish`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });

      if (!response.ok) {
        const error = await response.json();
        const errorMsg = error.error || "Failed to publish board";
        setCreationError(errorMsg);
        return { success: false, error: errorMsg };
      }

      return { success: true, boardId };
    } catch (err) {
      const errorMsg =
        err instanceof Error ? err.message : "Failed to publish board";
      setCreationError(errorMsg);
      return { success: false, error: errorMsg };
    } finally {
      setIsCreating(false);
    }
  }, []);

  const nextStep = useCallback(() => {
    const steps: BoardWizardStep["step"][] = [
      "details",
      "preview",
      "publish",
      "complete",
    ];
    const currentIndex = steps.indexOf(step);
    if (currentIndex < steps.length - 1) {
      setStep(steps[currentIndex + 1]);
    }
  }, [step]);

  const prevStep = useCallback(() => {
    const steps: BoardWizardStep["step"][] = [
      "details",
      "preview",
      "publish",
      "complete",
    ];
    const currentIndex = steps.indexOf(step);
    if (currentIndex > 0) {
      setStep(steps[currentIndex - 1]);
    }
  }, [step]);

  const resetWizard = useCallback(() => {
    setStep("details");
    setIsCreating(false);
    setCreationError(null);
    setCreatedBoardId(null);
  }, []);

  return {
    step,
    isCreating,
    creationError,
    createdBoardId,
    progressPercent: getProgressPercent(step),
    validateDetails,
    createBoard,
    updateBoard,
    publishBoard,
    nextStep,
    prevStep,
    resetWizard,
    setStep,
    setCreationError,
  };
}
