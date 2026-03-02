import { useState, useCallback } from "react";
import { sdk } from "@farcaster/miniapp-sdk";
import type { CanvasImage } from "@/lib/storage";

export interface BoardWizardStep {
  step: "details" | "preview" | "publish" | "complete";
  progressPercent: number;
}

// Helper to add Farcaster auth token to fetch headers
async function getAuthHeaders(): Promise<HeadersInit> {
  try {
    const { token } = await sdk.quickAuth
      .getToken()
      .catch(() => ({ token: null }));
    if (token) {
      return {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      };
    }
  } catch {
    // Token retrieval failed, fall back to no auth
  }
  return { "Content-Type": "application/json" };
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

        // Create board with auth token
        const headers = await getAuthHeaders();
        const response = await fetch("/api/boards/create", {
          method: "POST",
          headers,
          body: JSON.stringify({
            ...data,
            isPublic: publish,
          }),
        });

        if (!response.ok) {
          const error = await response.json();
          const errorMsg =
            error.details?.[0] || error.error || "Failed to create board";
          setCreationError(errorMsg);
          return { success: false, error: errorMsg };
        }

        const result = await response.json();
        setCreatedBoardId(result.boardId);

        // Note: Publishing is handled by the API endpoint based on isPublic flag
        return { success: true, boardId: result.boardId };
      } catch (err) {
        const errorMsg =
          err instanceof Error ? err.message : "Failed to create board";
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
        const headers = await getAuthHeaders();
        const response = await fetch(`/api/boards/${boardId}/update`, {
          method: "PATCH",
          headers,
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
      const headers = await getAuthHeaders();
      const response = await fetch(`/api/boards/${boardId}/publish`, {
        method: "POST",
        headers,
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
