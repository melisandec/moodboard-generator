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
  const { isCreating, creationError, createBoard } = useBoardCreationWizard();
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
      initialData, title, caption, canvasImages, canvasWidth, canvasHeight,
      bgColor, orientation, imageMargin, categories, moodboardUrl, remixOfId,
    ],
  );

  const handleSave = async () => {
    const result = await createBoard(boardData, publishImmediately);
    if (result.success) {
      onComplete?.(result.boardId);
    }
  };

  const previewImages = canvasImages.slice(0, 4);

  return (
    // Backdrop
    <div
      className="fixed inset-0 z-[9999] flex items-end justify-center"
      style={{ background: "rgba(0,0,0,0.45)" }}
      onClick={(e) => { if (e.target === e.currentTarget && !isCreating) onCancel?.(); }}
    >
      {/* Bottom sheet */}
      <div className="w-full max-w-lg rounded-t-3xl bg-white dark:bg-neutral-900 shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Drag handle */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="h-1 w-10 rounded-full bg-neutral-200 dark:bg-neutral-700" />
        </div>

        <div className="px-5 pb-8">
          {/* Header */}
          <div className="flex items-center justify-between pt-2 pb-4">
            <h2 className="text-base font-semibold text-neutral-900 dark:text-white">
              Save board
            </h2>
            <button
              onClick={onCancel}
              disabled={isCreating}
              className="flex h-7 w-7 items-center justify-center rounded-full bg-neutral-100 dark:bg-neutral-800 text-neutral-500 hover:bg-neutral-200 dark:hover:bg-neutral-700 disabled:opacity-40 transition-colors"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Preview */}
          <div
            className="mb-4 w-full rounded-2xl overflow-hidden"
            style={{
              background: bgColor || "#f5f5f4",
              aspectRatio: canvasWidth && canvasHeight ? `${canvasWidth}/${canvasHeight}` : "3/4",
              maxHeight: "220px",
            }}
          >
            {moodboardUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={moodboardUrl} alt="Board preview" className="w-full h-full object-cover" />
            ) : previewImages.length > 0 ? (
              <div
                className="grid h-full w-full gap-0.5 p-1"
                style={{ gridTemplateColumns: previewImages.length === 1 ? "1fr" : "1fr 1fr" }}
              >
                {previewImages.map((img) => (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img key={img.id} src={img.dataUrl} alt="" className="h-full w-full object-cover rounded-xl" />
                ))}
              </div>
            ) : (
              <div className="flex h-full items-center justify-center text-neutral-300 dark:text-neutral-600 text-sm">
                No preview
              </div>
            )}
          </div>

          {/* Board info */}
          <div className="mb-5">
            <p className="text-[15px] font-semibold text-neutral-900 dark:text-white leading-snug line-clamp-1">
              {boardData.title || "Untitled"}
            </p>
            <p className="mt-0.5 text-xs text-neutral-400 dark:text-neutral-500">
              {canvasImages.length} image{canvasImages.length !== 1 ? "s" : ""}
              {categories.length > 0 && ` · ${categories[0]}${categories.length > 1 ? ` +${categories.length - 1}` : ""}`}
            </p>
          </div>

          {/* Publish toggle */}
          <div className="mb-5 flex rounded-xl border border-neutral-200 dark:border-neutral-700 overflow-hidden">
            <button
              onClick={() => setPublishImmediately(false)}
              disabled={isCreating}
              className={`flex-1 py-2.5 text-sm font-medium transition-colors ${
                !publishImmediately
                  ? "bg-neutral-900 dark:bg-white text-white dark:text-neutral-900"
                  : "text-neutral-500 dark:text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-300"
              }`}
            >
              Save as draft
            </button>
            <button
              onClick={() => setPublishImmediately(true)}
              disabled={isCreating}
              className={`flex-1 py-2.5 text-sm font-medium transition-colors ${
                publishImmediately
                  ? "bg-neutral-900 dark:bg-white text-white dark:text-neutral-900"
                  : "text-neutral-500 dark:text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-300"
              }`}
            >
              Publish now
            </button>
          </div>

          {/* Publish explanation */}
          <p className="mb-5 text-xs text-neutral-400 dark:text-neutral-600 text-center">
            {publishImmediately
              ? "Visible to the community in the public feed"
              : "Only you can see this — publish any time"}
          </p>

          {/* Error */}
          {creationError && (
            <div className="mb-4 rounded-xl border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 px-3 py-2.5">
              <p className="text-xs text-red-600 dark:text-red-400 leading-relaxed">
                {creationError}
              </p>
            </div>
          )}

          {/* Save button */}
          <button
            onClick={handleSave}
            disabled={isCreating || canvasImages.length === 0}
            className="w-full rounded-2xl py-3.5 text-sm font-semibold text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98]"
            style={{ background: "linear-gradient(135deg, #1a1a1a 0%, #404040 100%)" }}
          >
            {isCreating ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4l3-3-3-3v4a8 8 0 00-8 8h4z" />
                </svg>
                Saving…
              </span>
            ) : (
              publishImmediately ? "Publish board" : "Save draft"
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
