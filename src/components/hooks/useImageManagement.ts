import { useState, useCallback, useRef } from "react";
import {
  compressForStorage,
  createInitialPlacements,
  loadImage,
  renderMoodboard,
} from "@/lib/canvas";
import {
  clearDraft,
  ensureInLibrary,
  type CanvasImage,
  type Orientation,
  type LibraryImage,
} from "@/lib/storage";
import { CANVAS_DIMS } from "@/lib/templates";

const MIN_IMAGES = 4;
const MAX_IMAGES = 20;

type View = "create" | "auto-result" | "manual" | "library";

interface ImageManagementSetters {
  setCanvasImages: React.Dispatch<React.SetStateAction<CanvasImage[]>>;
  setProcessedData: React.Dispatch<
    React.SetStateAction<
      Array<{ dataUrl: string; naturalWidth: number; naturalHeight: number }>
    >
  >;
  setArtworkId: (id: string | null) => void;
  setView: (v: View) => void;
  setBgColor: (c: string) => void;
  setImageMargin: (v: boolean) => void;
  setCategories: (c: string[]) => void;
  setExtractedColors: (c: string[]) => void;
  setMoodboardUrl: (url: string | null) => void;
  setIsProcessing: (v: boolean) => void;
  clearHistory: () => void;
  commitSnapshot: () => void;
}

interface ImageManagementDeps {
  canvasImages: CanvasImage[];
  orientation: Orientation;
  view: View;
  isProcessing: boolean;
  title: string;
  caption: string;
  dims: { w: number; h: number };
}

/**
 * Manages image file input, previews, and operations to add images
 * to the canvas or enter manual/auto modes.
 */
export function useImageManagement(
  deps: ImageManagementDeps,
  setters: ImageManagementSetters,
) {
  const {
    canvasImages,
    orientation,
    view,
    isProcessing,
    title,
    caption,
    dims,
  } = deps;

  const [files, setFiles] = useState<File[]>([]);
  const [previewUrls, setPreviewUrls] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const manualFileRef = useRef<HTMLInputElement>(null);

  const canGenerate = title.trim().length > 0 && files.length >= MIN_IMAGES;

  // ---- File picker (create view) ----
  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const input = e.target.files;
      if (!input) return;
      const toAdd = Array.from(input).slice(0, MAX_IMAGES - files.length);
      if (toAdd.length === 0) return;
      setFiles((p) => [...p, ...toAdd]);
      setPreviewUrls((p) => [
        ...p,
        ...toAdd.map((f) => URL.createObjectURL(f)),
      ]);
      if (fileInputRef.current) fileInputRef.current.value = "";
    },
    [files.length],
  );

  const removeImage = useCallback((index: number) => {
    setPreviewUrls((p) => {
      URL.revokeObjectURL(p[index]);
      return p.filter((_, i) => i !== index);
    });
    setFiles((p) => p.filter((_, i) => i !== index));
  }, []);

  // ---- Auto-generate ----
  const generate = useCallback(async () => {
    if (!canGenerate || isProcessing) return;
    setters.setIsProcessing(true);
    try {
      const loaded = await Promise.all(files.map((f) => loadImage(f)));
      setters.setMoodboardUrl(
        renderMoodboard(loaded, title.trim(), caption.trim()),
      );
      setters.setView("auto-result");
    } catch (err) {
      console.error(err);
    } finally {
      setters.setIsProcessing(false);
    }
  }, [canGenerate, isProcessing, files, title, caption, setters]);

  const regenerate = useCallback(async () => {
    if (isProcessing) return;
    setters.setIsProcessing(true);
    try {
      const loaded = await Promise.all(files.map((f) => loadImage(f)));
      setters.setMoodboardUrl(
        renderMoodboard(loaded, title.trim(), caption.trim()),
      );
    } catch (err) {
      console.error(err);
    } finally {
      setters.setIsProcessing(false);
    }
  }, [isProcessing, files, title, caption, setters]);

  // ---- Enter manual mode ----
  const enterManualMode = useCallback(async () => {
    if (!canGenerate || isProcessing) return;
    setters.setIsProcessing(true);
    try {
      const processed = await Promise.all(
        files.map((f) => compressForStorage(f)),
      );
      setters.setProcessedData(processed);
      const d = CANVAS_DIMS[orientation];
      setters.setCanvasImages(createInitialPlacements(processed, d.w, d.h));
      setters.setArtworkId(null);
      setters.setBgColor("#f5f5f4");
      setters.setImageMargin(false);
      setters.setCategories([]);
      setters.setExtractedColors([]);
      setters.clearHistory();
      clearDraft().catch(() => {});
      setters.setView("manual");

      // add images to library in background
      for (let i = 0; i < processed.length; i++) {
        ensureInLibrary(
          processed[i].dataUrl,
          files[i].name,
          processed[i].naturalWidth,
          processed[i].naturalHeight,
        ).catch(() => {});
      }
    } catch (err) {
      console.error(err);
    } finally {
      setters.setIsProcessing(false);
    }
  }, [canGenerate, isProcessing, files, orientation, setters]);

  // ---- Add images from library to canvas ----
  const addFromLibrary = useCallback(
    (libImages: LibraryImage[]) => {
      const maxZ =
        canvasImages.length > 0
          ? Math.max(...canvasImages.map((i) => i.zIndex)) + 1
          : 0;
      const newImgs: CanvasImage[] = libImages.map((li, idx) => {
        const aspect = li.naturalWidth / li.naturalHeight;
        const w = dims.w * 0.3;
        const h = w / aspect;
        return {
          id: `img-${Date.now()}-${idx}-${Math.random().toString(36).slice(2, 8)}`,
          dataUrl: li.dataUrl,
          x: dims.w * 0.1 + Math.random() * dims.w * 0.5,
          y: dims.h * 0.1 + Math.random() * dims.h * 0.5,
          width: w,
          height: h,
          rotation: 0,
          pinned: false,
          zIndex: maxZ + idx,
          naturalWidth: li.naturalWidth,
          naturalHeight: li.naturalHeight,
        };
      });

      if (view === "manual" && canvasImages.length > 0) {
        setters.commitSnapshot();
        setters.setCanvasImages((prev) => [...prev, ...newImgs]);
        setters.setProcessedData((prev) => [
          ...prev,
          ...libImages.map((li) => ({
            dataUrl: li.dataUrl,
            naturalWidth: li.naturalWidth,
            naturalHeight: li.naturalHeight,
          })),
        ]);
      } else {
        setters.setCanvasImages(newImgs);
        setters.setProcessedData(
          libImages.map((li) => ({
            dataUrl: li.dataUrl,
            naturalWidth: li.naturalWidth,
            naturalHeight: li.naturalHeight,
          })),
        );
        setters.setArtworkId(null);
        setters.clearHistory();
      }
      setters.setView("manual");
    },
    [view, canvasImages, dims, setters],
  );

  // ---- Add images from file picker directly to canvas (manual mode) ----
  const handleManualFileAdd = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const input = e.target.files;
      if (!input || input.length === 0) return;
      const newFiles = Array.from(input).slice(
        0,
        MAX_IMAGES - canvasImages.length,
      );
      if (newFiles.length === 0) return;

      const processed = await Promise.all(
        newFiles.map((f) => compressForStorage(f)),
      );
      const maxZ =
        canvasImages.length > 0
          ? Math.max(...canvasImages.map((i) => i.zIndex)) + 1
          : 0;

      const newImgs: CanvasImage[] = processed.map((p, idx) => {
        const aspect = p.naturalWidth / p.naturalHeight;
        const w = dims.w * 0.3;
        const h = w / aspect;
        return {
          id: `img-${Date.now()}-${idx}-${Math.random().toString(36).slice(2, 8)}`,
          dataUrl: p.dataUrl,
          x: dims.w * 0.1 + Math.random() * dims.w * 0.5,
          y: dims.h * 0.1 + Math.random() * dims.h * 0.5,
          width: w,
          height: h,
          rotation: 0,
          pinned: false,
          zIndex: maxZ + idx,
          naturalWidth: p.naturalWidth,
          naturalHeight: p.naturalHeight,
        };
      });

      setters.commitSnapshot();
      setters.setCanvasImages((prev) => [...prev, ...newImgs]);
      setters.setProcessedData((prev) => [...prev, ...processed]);

      for (let i = 0; i < processed.length; i++) {
        ensureInLibrary(
          processed[i].dataUrl,
          newFiles[i].name,
          processed[i].naturalWidth,
          processed[i].naturalHeight,
        ).catch(() => {});
      }

      if (manualFileRef.current) manualFileRef.current.value = "";
    },
    [canvasImages, dims, setters],
  );

  return {
    files,
    previewUrls,
    fileInputRef,
    manualFileRef,
    canGenerate,
    handleFileChange,
    removeImage,
    generate,
    regenerate,
    enterManualMode,
    addFromLibrary,
    handleManualFileAdd,
  };
}
