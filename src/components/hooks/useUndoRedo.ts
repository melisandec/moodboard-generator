import { useState, useCallback, useRef, useEffect } from 'react';
import {
  stripDataUrls, rehydrateImages,
  type CanvasImage, type LightCanvasImage,
} from '@/lib/storage';

const MAX_HISTORY = 50;

/**
 * Manages undo/redo stacks for canvas image state.
 *
 * The stacks store lightweight metadata only (no dataUrl blobs). The
 * heavy image data lives in the imageStoreRef map, keyed by image id.
 *
 * @param canvasImages   current canvas images (read-only — the hook never
 *                       mutates this directly)
 * @param setCanvasImages state setter for the canvas images
 */
export function useUndoRedo(
  canvasImages: CanvasImage[],
  setCanvasImages: React.Dispatch<React.SetStateAction<CanvasImage[]>>,
) {
  const [undoStack, setUndoStack] = useState<LightCanvasImage[][]>([]);
  const [redoStack, setRedoStack] = useState<LightCanvasImage[][]>([]);
  const imageStoreRef = useRef<Map<string, string>>(new Map());

  // Keep the image store in sync with the current canvas images
  const syncImageStore = useCallback((imgs: CanvasImage[]) => {
    const store = imageStoreRef.current;
    for (const img of imgs) {
      if (!store.has(img.id)) store.set(img.id, img.dataUrl);
    }
  }, []);

  useEffect(() => {
    syncImageStore(canvasImages);
  }, [canvasImages, syncImageStore]);

  /** Push the current state onto the undo stack (call before mutations). */
  const commitSnapshot = useCallback(() => {
    setUndoStack((prev) => [...prev.slice(-(MAX_HISTORY - 1)), stripDataUrls(canvasImages)]);
    setRedoStack([]);
  }, [canvasImages]);

  const undo = useCallback(() => {
    setUndoStack((prev) => {
      if (prev.length === 0) return prev;
      const snapshot = prev[prev.length - 1];
      setRedoStack((r) => [...r, stripDataUrls(canvasImages)]);
      setCanvasImages(rehydrateImages(snapshot, imageStoreRef.current));
      return prev.slice(0, -1);
    });
  }, [canvasImages, setCanvasImages]);

  const redo = useCallback(() => {
    setRedoStack((prev) => {
      if (prev.length === 0) return prev;
      const snapshot = prev[prev.length - 1];
      setUndoStack((u) => [...u, stripDataUrls(canvasImages)]);
      setCanvasImages(rehydrateImages(snapshot, imageStoreRef.current));
      return prev.slice(0, -1);
    });
  }, [canvasImages, setCanvasImages]);

  /** Clear both stacks (e.g. when loading a new artwork). */
  const clearHistory = useCallback(() => {
    setUndoStack([]);
    setRedoStack([]);
  }, []);

  return {
    undoStack,
    redoStack,
    commitSnapshot,
    undo,
    redo,
    clearHistory,
    imageStoreRef,
  };
}
