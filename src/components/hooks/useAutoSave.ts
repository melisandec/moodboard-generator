import { useState, useCallback, useRef, useEffect } from 'react';
import {
  saveDraft, loadDraft, clearDraft,
  type CanvasImage, type Draft, type Orientation,
} from '@/lib/storage';

const AUTOSAVE_MS = 30_000;

interface AutoSaveConfig {
  view: string;
  title: string;
  caption: string;
  canvasImages: CanvasImage[];
  orientation: Orientation;
  bgColor: string;
  imageMargin: boolean;
  categories: string[];
}

/**
 * Auto-save draft state every 30 seconds (only when the canvas is active
 * and state has actually changed since the last save).
 *
 * Also manages draft recovery (pending draft from a previous session).
 */
export function useAutoSave(config: AutoSaveConfig) {
  const { view, title, caption, canvasImages, orientation, bgColor, imageMargin, categories } = config;

  const [draftIndicator, setDraftIndicator] = useState<string | null>(null);
  const [pendingDraft, setPendingDraft] = useState<Draft | null>(null);
  const lastSavedDraftHash = useRef<string>('');

  // Load any pending draft on mount
  useEffect(() => {
    loadDraft().then((d) => {
      if (d) setPendingDraft(d);
    }).catch(() => {});
  }, []);

  // Interval-based auto-save with fingerprint comparison
  useEffect(() => {
    if (view !== 'manual' || canvasImages.length === 0) return;
    const timer = setInterval(() => {
      const hash = JSON.stringify([
        title.trim(),
        caption.trim(),
        canvasImages.map((img) => [img.id, img.x, img.y, img.width, img.height, img.rotation, img.zIndex, img.pinned]),
        orientation,
        bgColor,
        imageMargin,
        categories,
      ]);

      if (hash === lastSavedDraftHash.current) return;

      const draft: Draft = {
        id: 'current',
        title: title.trim(),
        caption: caption.trim(),
        images: canvasImages,
        orientation,
        bgColor,
        imageMargin,
        categories,
        savedAt: new Date().toISOString(),
      };
      saveDraft(draft).then(() => {
        lastSavedDraftHash.current = hash;
        setDraftIndicator('Draft saved');
        setTimeout(() => setDraftIndicator(null), 1500);
      }).catch(() => {});
    }, AUTOSAVE_MS);
    return () => clearInterval(timer);
  }, [view, title, caption, canvasImages, orientation, bgColor, imageMargin, categories]);

  /** Dismiss the pending draft and delete it from storage. */
  const dismissDraft = useCallback(() => {
    clearDraft().catch(() => {});
    setPendingDraft(null);
  }, []);

  /** Mark the pending draft as consumed (caller restores state from it). */
  const consumeDraft = useCallback(() => {
    setPendingDraft(null);
  }, []);

  /** Clear the current draft from disk (e.g. after saving to collection). */
  const clearCurrentDraft = useCallback(() => {
    clearDraft().catch(() => {});
  }, []);

  return {
    draftIndicator,
    pendingDraft,
    dismissDraft,
    consumeDraft,
    clearCurrentDraft,
  };
}
