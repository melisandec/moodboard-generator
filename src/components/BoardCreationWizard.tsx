"use client";

import { useState, useMemo } from "react";
import { useBoardCreationWizard } from "./hooks/useBoardCreationWizard";
import type { BoardCreationData } from "./hooks/useBoardCreationWizard";
import type { CanvasImage } from "@/lib/storage";

interface BoardCreationWizardProps {
  initialData?: Partial<BoardCreationData>;
  onComplete?: (boardId: string) => void;
  onCancel?: () => void;
  canvasImages: CanvasImage[];
  title: string;
  caption: string;
  bgColor: string;
  imageMargin: boolean;
  orientation: "portrait" | "landscape" | "square";
  categories: string[];
  canvasWidth: number;
  canvasHeight: number;
  remixOfId?: string;
  moodboardUrl?: string | null;
}

export function BoardCreationWizard({
  initialData,
  onComplete,
  onCancel,
  canvasImages,
  title,
  caption,
  bgColor,
  imageMargin,
  orientation,
  categories,
  canvasWidth,
  canvasHeight,
  remixOfId,
  moodboardUrl,
}: BoardCreationWizardProps) {
  const {
    step,
    isCreating,
    creationError,
    createdBoardId,
    progressPercent,
    createBoard,
    nextStep,
    prevStep,
    resetWizard,
    setStep,
  } = useBoardCreationWizard();

  const [publishImmediately, setPublishImmediately] = useState(false);

  const boardData = useMemo<BoardCreationData>(
    () => ({
      title: initialData?.title || title,
      caption: initialData?.caption || caption,
      canvasState: canvasImages,
      canvasWidth: canvasWidth || 1080,
      canvasHeight: canvasHeight || 1527,
      background: bgColor || "#f5f5f4",
      orientation,
      margin: imageMargin,
      categories: initialData?.categories || categories,
      isPublic: false,
      previewUrl: moodboardUrl || null,
      remixOfId,
    }),
    [
      initialData,
      title,
      caption,
      canvasImages,
      canvasWidth,
      canvasHeight,
      bgColor,
      orientation,
      imageMargin,
      categories,
      moodboardUrl,
      remixOfId,
    ],
  );

  const handleCreateAndPublish = async () => {
    const result = await createBoard(boardData, publishImmediately);
    if (result.success) {
      setStep("complete");
      onComplete?.(result.boardId);
    }
  };

  // =====================================================================
  // Step: Details
  // =====================================================================

  if (step === "details") {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
        <div className="w-full max-w-md rounded-lg bg-white p-6 dark:bg-neutral-800 shadow-lg">
          <h2 className="mb-1 text-xl font-semibold text-neutral-900 dark:text-white">
            Board Details
          </h2>
          <p className="mb-4 text-sm text-neutral-500 dark:text-neutral-400">
            Step 1 of 3 • {progressPercent}%
          </p>

          {/* Progress Bar */}
          <div className="mb-4 h-1 w-full rounded-full bg-neutral-200 dark:bg-neutral-700">
            <div
              className="h-full rounded-full bg-blue-500 transition-all duration-300"
              style={{ width: `${progressPercent}%` }}
            />
          </div>

          {/* Title */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300">
              Title *
            </label>
            <input
              type="text"
              value={boardData.title}
              maxLength={80}
              placeholder="Enter board title"
              title="Board title"
              className="mt-1 w-full rounded border border-neutral-300 px-3 py-2 dark:border-neutral-600 dark:bg-neutral-700 dark:text-white"
              disabled
            />
            <p className="mt-1 text-xs text-neutral-400">
              {boardData.title.length}/80
            </p>
          </div>

          {/* Caption */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300">
              Caption
            </label>
            <textarea
              value={boardData.caption}
              maxLength={280}
              rows={3}
              placeholder="Add a caption (optional)"
              title="Board caption"
              className="mt-1 w-full rounded border border-neutral-300 px-3 py-2 dark:border-neutral-600 dark:bg-neutral-700 dark:text-white"
              disabled
            />
            <p className="mt-1 text-xs text-neutral-400">
              {boardData.caption.length}/280
            </p>
          </div>

          {/* Error */}
          {creationError && (
            <div className="mb-4 rounded-md bg-red-50 p-3 dark:bg-red-900/30">
              <p className="text-sm text-red-600 dark:text-red-400">
                {creationError}
              </p>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3">
            <button
              onClick={onCancel}
              className="flex-1 rounded border border-neutral-300 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-50 dark:border-neutral-600 dark:text-neutral-300 dark:hover:bg-neutral-700"
            >
              Cancel
            </button>
            <button
              onClick={nextStep}
              className="flex-1 rounded bg-blue-500 py-2 text-sm font-medium text-white hover:bg-blue-600"
            >
              Next
            </button>
          </div>
        </div>
      </div>
    );
  }

  // =====================================================================
  // Step: Preview
  // =====================================================================

  if (step === "preview") {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
        <div className="w-full max-w-md rounded-lg bg-white p-6 dark:bg-neutral-800 shadow-lg">
          <h2 className="mb-1 text-xl font-semibold text-neutral-900 dark:text-white">
            Preview
          </h2>
          <p className="mb-4 text-sm text-neutral-500 dark:text-neutral-400">
            Step 2 of 3 • {progressPercent}%
          </p>

          {/* Progress Bar */}
          <div className="mb-4 h-1 w-full rounded-full bg-neutral-200 dark:bg-neutral-700">
            {/* eslint-disable-next-line @next/next/no-style-components-in-document */}
            <div
              className="h-full rounded-full bg-blue-500 transition-all duration-300"
              style={{ width: `${progressPercent}%` } as React.CSSProperties}
            />
          </div>

          {/* Preview Image */}
          <div className="mb-4 rounded-lg overflow-hidden bg-neutral-100 dark:bg-neutral-700">
            {moodboardUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={moodboardUrl}
                alt="Board preview"
                className="w-full object-cover"
              />
            ) : (
              <div className="flex h-48 items-center justify-center text-neutral-400">
                No preview available
              </div>
            )}
          </div>

          {/* Board Info */}
          <div className="mb-4 space-y-2 text-sm">
            <div>
              <p className="text-neutral-500 dark:text-neutral-400">Title</p>
              <p className="font-medium text-neutral-900 dark:text-white">
                {boardData.title}
              </p>
            </div>
            <div>
              <p className="text-neutral-500 dark:text-neutral-400">Images</p>
              <p className="font-medium text-neutral-900 dark:text-white">
                {canvasImages.length} image
                {canvasImages.length !== 1 ? "s" : ""}
              </p>
            </div>
            {boardData.categories.length > 0 && (
              <div>
                <p className="text-neutral-500 dark:text-neutral-400">
                  Categories
                </p>
                <div className="mt-1 flex flex-wrap gap-1">
                  {boardData.categories.map((cat) => (
                    <span
                      key={cat}
                      className="inline-block rounded-full bg-blue-100 px-2 py-1 text-xs font-medium text-blue-700 dark:bg-blue-900/30 dark:text-blue-400"
                    >
                      {cat}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Error */}
          {creationError && (
            <div className="mb-4 rounded-md bg-red-50 p-3 dark:bg-red-900/30">
              <p className="text-sm text-red-600 dark:text-red-400">
                {creationError}
              </p>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3">
            <button
              onClick={prevStep}
              className="flex-1 rounded border border-neutral-300 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-50 dark:border-neutral-600 dark:text-neutral-300 dark:hover:bg-neutral-700"
            >
              Back
            </button>
            <button
              onClick={nextStep}
              className="flex-1 rounded bg-blue-500 py-2 text-sm font-medium text-white hover:bg-blue-600"
            >
              Next
            </button>
          </div>
        </div>
      </div>
    );
  }

  // =====================================================================
  // Step: Publish
  // =====================================================================

  if (step === "publish") {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
        <div className="w-full max-w-md rounded-lg bg-white p-6 dark:bg-neutral-800 shadow-lg">
          <h2 className="mb-1 text-xl font-semibold text-neutral-900 dark:text-white">
            Publish Option
          </h2>
          <p className="mb-4 text-sm text-neutral-500 dark:text-neutral-400">
            Step 3 of 3 • {progressPercent}%
          </p>

          {/* Progress Bar */}
          <div className="mb-4 h-1 w-full rounded-full bg-neutral-200 dark:bg-neutral-700">
            {/* eslint-disable-next-line @next/next/no-style-components-in-document */}
            {/* eslint-disable-next-line @next/next/no-style-components-in-document */}
            <div
              className="h-full rounded-full bg-blue-500 transition-all duration-300"
              style={{ width: `${progressPercent}%` } as React.CSSProperties}
            />
          </div>

          {/* Publish Options */}
          <div className="mb-4 space-y-3">
            <label className="flex items-center gap-3 rounded-lg border-2 border-blue-200 bg-blue-50 p-3 cursor-pointer dark:border-blue-900/30 dark:bg-blue-900/20">
              <input
                type="radio"
                checked={!publishImmediately}
                onChange={() => setPublishImmediately(false)}
                className="h-4 w-4"
              />
              <div>
                <p className="font-medium text-neutral-900 dark:text-white">
                  Save as Draft
                </p>
                <p className="text-xs text-neutral-600 dark:text-neutral-400">
                  Keep private and publish later
                </p>
              </div>
            </label>

            <label className="flex items-center gap-3 rounded-lg border-2 border-green-200 bg-green-50 p-3 cursor-pointer dark:border-green-900/30 dark:bg-green-900/20">
              <input
                type="radio"
                checked={publishImmediately}
                onChange={() => setPublishImmediately(true)}
                className="h-4 w-4"
              />
              <div>
                <p className="font-medium text-neutral-900 dark:text-white">
                  Publish Now
                </p>
                <p className="text-xs text-neutral-600 dark:text-neutral-400">
                  Make public and share with community
                </p>
              </div>
            </label>
          </div>

          {/* Error */}
          {creationError && (
            <div className="mb-4 rounded-md bg-red-50 p-3 dark:bg-red-900/30">
              <p className="text-sm text-red-600 dark:text-red-400">
                {creationError}
              </p>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3">
            <button
              onClick={prevStep}
              disabled={isCreating}
              className="flex-1 rounded border border-neutral-300 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-50 disabled:opacity-50 dark:border-neutral-600 dark:text-neutral-300 dark:hover:bg-neutral-700"
            >
              Back
            </button>
            <button
              onClick={handleCreateAndPublish}
              disabled={isCreating}
              className="flex-1 rounded bg-blue-500 py-2 text-sm font-medium text-white hover:bg-blue-600 disabled:opacity-50"
            >
              {isCreating ? "Creating..." : "Create Board"}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // =====================================================================
  // Step: Complete
  // =====================================================================

  if (step === "complete") {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
        <div className="w-full max-w-md rounded-lg bg-white p-6 dark:bg-neutral-800 shadow-lg">
          <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/30 mx-auto">
            <svg
              className="h-8 w-8 text-green-600 dark:text-green-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M5 13l4 4L19 7"
              />
            </svg>
          </div>

          <h2 className="mb-2 text-center text-xl font-semibold text-neutral-900 dark:text-white">
            Success!
          </h2>
          <p className="mb-4 text-center text-sm text-neutral-600 dark:text-neutral-400">
            {publishImmediately
              ? "Your board has been published and is now visible to the community!"
              : "Your board has been saved as a draft. You can edit and publish it later."}
          </p>

          {/* Progress Bar at 100% */}
          <div className="mb-6 h-1 w-full rounded-full bg-neutral-200 dark:bg-neutral-700">
            {/* eslint-disable-next-line @next/next/no-style-components-in-document */}
            <div
              className="h-full rounded-full bg-blue-500"
              style={{ width: "100%" } as React.CSSProperties}
            />
          </div>

          {/* Actions */}
          <div className="flex gap-3">
            <button
              onClick={() => {
                resetWizard();
                onCancel?.();
              }}
              className="flex-1 rounded border border-neutral-300 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-50 dark:border-neutral-600 dark:text-neutral-300 dark:hover:bg-neutral-700"
            >
              Close
            </button>
            <button
              onClick={() => {
                resetWizard();
                onComplete?.(createdBoardId || "");
              }}
              className="flex-1 rounded bg-blue-500 py-2 text-sm font-medium text-white hover:bg-blue-600"
            >
              View Board
            </button>
          </div>
        </div>
      </div>
    );
  }

  return null;
}
