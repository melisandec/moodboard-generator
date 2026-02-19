"use client";

import { useState, useCallback, useEffect, useMemo } from "react";
import { sdk } from "@farcaster/miniapp-sdk";
import { extractColors } from "@/lib/canvas";
import {
  saveTemplate,
  loadTemplates,
  deleteTemplate,
  DEFAULT_CATEGORIES,
  isIndexedDBAvailable,
  type CanvasImage,
  type Orientation,
  type Template,
} from "@/lib/storage";
import {
  CANVAS_DIMS,
  BUILT_IN_TEMPLATES,
  applyTemplate,
  artworkToTemplate,
  rescaleImages,
  templatePreviewSvg,
} from "@/lib/templates";
import InteractiveCanvas from "./InteractiveCanvas";
import ImageLibrary from "./ImageLibrary";
import { useCloud } from "./CloudProvider";
import { useUndoRedo } from "./hooks/useUndoRedo";
import { useAutoSave } from "./hooks/useAutoSave";
import { useCanvasExport } from "./hooks/useCanvasExport";
import { useCollectionManager } from "./hooks/useCollectionManager";
import { useImageManagement } from "./hooks/useImageManagement";

const MIN_IMAGES = 4;
const MAX_IMAGES = 20;
const BG_PRESETS = ["#FFFFFF", "#F8F8F8", "#F0F0F0", "#FAF9F6", "#000000"];

type View = "create" | "auto-result" | "manual" | "library";
type ColSort = "newest" | "oldest" | "title" | "images";

// ---------------------------------------------------------------------------
// Tiny icon helpers
// ---------------------------------------------------------------------------

function Ico({
  d,
  size = 20,
  sw = 1.5,
}: {
  d: string;
  size?: number;
  sw?: number;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={sw}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d={d} />
    </svg>
  );
}

const DownloadIcon = () => (
  <Ico d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3" />
);
const PrintIcon = () => (
  <svg
    width="20"
    height="20"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.5"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <polyline points="6 9 6 2 18 2 18 9" />
    <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
    <rect x="6" y="14" width="12" height="8" />
  </svg>
);
const CastIcon = () => (
  <svg
    width="20"
    height="20"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.5"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <line x1="22" y1="2" x2="11" y2="13" />
    <polygon points="22 2 15 22 11 13 2 9 22 2" />
  </svg>
);
const RefreshIcon = () => (
  <Ico
    d="M23 4v6h-6M1 20v-6h6M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"
    size={18}
  />
);
const Spinner = () => (
  <svg
    className="animate-spin"
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
  >
    <circle
      cx="12"
      cy="12"
      r="10"
      stroke="currentColor"
      strokeWidth="2"
      opacity="0.25"
    />
    <path
      d="M12 2a10 10 0 0 1 10 10"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
    />
  </svg>
);
const PlusIcon = () => (
  <svg
    width="28"
    height="28"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1"
    strokeLinecap="round"
  >
    <line x1="12" y1="5" x2="12" y2="19" />
    <line x1="5" y1="12" x2="19" y2="12" />
  </svg>
);
const UndoIcon = () => (
  <svg
    width="18"
    height="18"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.5"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M3 10h10a5 5 0 0 1 0 10H9" />
    <path d="M7 6l-4 4 4 4" />
  </svg>
);
const RedoIcon = () => (
  <svg
    width="18"
    height="18"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.5"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M21 10H11a5 5 0 0 0 0 10h4" />
    <path d="M17 6l4 4-4 4" />
  </svg>
);

const CloudIcon = () => (
  <svg
    width="14"
    height="14"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.5"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z" />
  </svg>
);

const SunIcon = () => (
  <svg
    width="18"
    height="18"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.5"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <circle cx="12" cy="12" r="5" />
    <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
  </svg>
);

const MoonIcon = () => (
  <svg
    width="18"
    height="18"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.5"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
  </svg>
);
const CloudSyncedIcon = () => (
  <svg
    width="14"
    height="14"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.5"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z" />
    <path d="M9 15l2 2 4-4" />
  </svg>
);
const CloudErrorIcon = () => (
  <svg
    width="14"
    height="14"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.5"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z" />
    <line x1="12" y1="13" x2="12" y2="16" />
    <circle cx="12" cy="10" r="0.5" />
  </svg>
);

function ActionBar({
  onDownload,
  onPrint,
  onCast,
  castStatus,
}: {
  onDownload: () => void;
  onPrint: () => void;
  onCast: () => void;
  castStatus?: string | null;
}) {
  const btn =
    "flex min-h-[44px] min-w-[44px] flex-col items-center gap-1 text-neutral-500 transition-colors hover:text-neutral-700 dark:hover:text-neutral-300 disabled:opacity-40";
  const isCasting = !!castStatus;
  return (
    <div className="sticky bottom-0 border-t border-neutral-200 dark:border-neutral-700 bg-white/90 dark:bg-neutral-900/90 px-4 py-3 backdrop-blur-sm">
      {isCasting && (
        <p className="mb-2 text-center text-[11px] text-neutral-500 animate-pulse">
          {castStatus}
        </p>
      )}
      <div className="mx-auto flex max-w-lg items-center justify-center gap-10">
        <button onClick={onDownload} className={btn}>
          <DownloadIcon />
          <span className="text-[11px]">Save</span>
        </button>
        <button onClick={onPrint} className={btn}>
          <PrintIcon />
          <span className="text-[11px]">Print</span>
        </button>
        <button onClick={onCast} disabled={isCasting} className={btn}>
          <CastIcon />
          <span className="text-[11px]">{isCasting ? "…" : "Cast"}</span>
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default function MoodboardGenerator() {
  const [title, setTitle] = useState("");
  const [caption, setCaption] = useState("");
  const [view, setView] = useState<View>("create");
  const [isProcessing, setIsProcessing] = useState(false);

  // Auto-mode
  const [moodboardUrl, setMoodboardUrl] = useState<string | null>(null);

  // Manual-mode
  const [canvasImages, setCanvasImages] = useState<CanvasImage[]>([]);
  const [artworkId, setArtworkId] = useState<string | null>(null);
  const [orientation, setOrientationState] = useState<Orientation>("portrait");
  const [bgColor, setBgColor] = useState("#f5f5f4");
  const [imageMargin, setImageMargin] = useState(false);
  const [processedData, setProcessedData] = useState<
    Array<{ dataUrl: string; naturalWidth: number; naturalHeight: number }>
  >([]);

  // Categories
  const [categories, setCategories] = useState<string[]>([]);
  const [customCategories, setCustomCategories] = useState<string[]>([]);
  const [showCatRow, setShowCatRow] = useState(false);
  const [newCatDraft, setNewCatDraft] = useState("");

  // UI panels
  const [showBgPicker, setShowBgPicker] = useState(false);
  const [showTemplates, setShowTemplates] = useState(false);
  const [templateNameDraft, setTemplateNameDraft] = useState("");
  const [savingTemplate, setSavingTemplate] = useState(false);
  const [extractedColors, setExtractedColors] = useState<string[]>([]);

  // Storage availability
  const [storageAvailable, setStorageAvailable] = useState(true);

  const {
    user: cloudUser,
    syncStatus,
    signIn: cloudSignIn,
    sync: cloudSync,
  } = useCloud();
  const dims = CANVAS_DIMS[orientation];

  // ---- Extracted hooks ----

  const { undoStack, redoStack, commitSnapshot, undo, redo, clearHistory } =
    useUndoRedo(canvasImages, setCanvasImages);

  const { draftIndicator, pendingDraft, dismissDraft, consumeDraft } =
    useAutoSave({
      view,
      title,
      caption,
      canvasImages,
      orientation,
      bgColor,
      imageMargin,
      categories,
    });

  const {
    castStatus,
    downloadAuto,
    printAuto,
    downloadManual,
    printManual,
    castToFarcaster,
  } = useCanvasExport({
    title,
    caption,
    view,
    canvasImages,
    dimsW: dims.w,
    dimsH: dims.h,
    bgColor,
    imageMargin,
    moodboardUrl,
  });

  const collectionSetters = useMemo(
    () => ({
      setTitle,
      setCaption,
      setCanvasImages,
      setProcessedData,
      setArtworkId,
      setOrientationState,
      setBgColor,
      setImageMargin,
      setCategories,
      setView,
      clearHistory,
      setExtractedColors,
    }),
    [clearHistory],
  );

  const saveCtx = useMemo(
    () => ({
      artworkId,
      title,
      caption,
      canvasImages,
      dimsW: dims.w,
      dimsH: dims.h,
      orientation,
      bgColor,
      imageMargin,
      categories,
    }),
    [
      artworkId,
      title,
      caption,
      canvasImages,
      dims.w,
      dims.h,
      orientation,
      bgColor,
      imageMargin,
      categories,
    ],
  );

  const {
    savedArtworks,
    saveMsg,
    colSearch,
    setColSearch,
    colSort,
    setColSort,
    colCatFilter,
    setColCatFilter,
    deleteConfirmId,
    setDeleteConfirmId,
    collectionCategories,
    filteredArtworks,
    refreshCollection,
    saveToCollection,
    confirmDeleteArtwork,
    handleDeleteArtwork,
    togglePinArtwork,
    loadArtworkForEditing,
    duplicateArtwork,
  } = useCollectionManager(
    { syncStatus, cloudUser, cloudSync },
    collectionSetters,
    saveCtx,
  );

  const imageSetters = useMemo(
    () => ({
      setCanvasImages,
      setProcessedData,
      setArtworkId,
      setView,
      setBgColor,
      setImageMargin,
      setCategories,
      setExtractedColors,
      setMoodboardUrl,
      setIsProcessing,
      clearHistory,
      commitSnapshot,
    }),
    [clearHistory, commitSnapshot],
  );

  const {
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
  } = useImageManagement(
    { canvasImages, orientation, view, isProcessing, title, caption, dims },
    imageSetters,
  );

  // Templates
  const [userTemplates, setUserTemplates] = useState<Template[]>([]);

  // Dark mode — initialise after mount to avoid SSR hydration mismatch
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    setIsDark(document.documentElement.classList.contains("dark"));
  }, []);

  const toggleTheme = useCallback(() => {
    setIsDark((prev) => {
      const next = !prev;
      if (next) {
        document.documentElement.classList.add("dark");
        localStorage.setItem("theme", "dark");
      } else {
        document.documentElement.classList.remove("dark");
        localStorage.setItem("theme", "light");
      }
      return next;
    });
  }, []);

  // -----------------------------------------------------------------------
  // Initialize SDK, load persisted data, check for draft
  // -----------------------------------------------------------------------

  useEffect(() => {
    sdk.actions.ready({ disableNativeGestures: true }).catch(() => {});
    isIndexedDBAvailable()
      .then((ok) => setStorageAvailable(ok))
      .catch(() => setStorageAvailable(false));
    loadTemplates()
      .then(setUserTemplates)
      .catch(() => {});

    const stored = localStorage.getItem("moodboard-custom-categories");
    if (stored) {
      try {
        setCustomCategories(JSON.parse(stored));
      } catch {
        /* ignore */
      }
    }
  }, []);

  // Persist custom categories
  useEffect(() => {
    if (customCategories.length > 0) {
      localStorage.setItem(
        "moodboard-custom-categories",
        JSON.stringify(customCategories),
      );
    }
  }, [customCategories]);

  // Keyboard shortcuts for undo/redo
  useEffect(() => {
    if (view !== "manual") return;
    const handler = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;
      if (mod && e.key === "z" && !e.shiftKey) {
        e.preventDefault();
        undo();
      } else if (
        (mod && e.key === "z" && e.shiftKey) ||
        (mod && e.key === "y")
      ) {
        e.preventDefault();
        redo();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  });

  // -----------------------------------------------------------------------
  // Draft recovery
  // -----------------------------------------------------------------------

  const recoverDraft = useCallback(() => {
    if (!pendingDraft) return;
    setTitle(pendingDraft.title);
    setCaption(pendingDraft.caption);
    setCanvasImages(pendingDraft.images);
    setProcessedData(
      pendingDraft.images.map((i) => ({
        dataUrl: i.dataUrl,
        naturalWidth: i.naturalWidth,
        naturalHeight: i.naturalHeight,
      })),
    );
    setOrientationState(pendingDraft.orientation ?? "portrait");
    setBgColor(pendingDraft.bgColor ?? "#f5f5f4");
    setImageMargin(pendingDraft.imageMargin ?? false);
    setCategories(pendingDraft.categories ?? []);
    setArtworkId(null);
    clearHistory();
    setView("manual");
    consumeDraft();
  }, [pendingDraft, clearHistory, consumeDraft]);

  // -----------------------------------------------------------------------
  // Category management
  // -----------------------------------------------------------------------

  const allCategories = useMemo(
    () => [...DEFAULT_CATEGORIES, ...customCategories],
    [customCategories],
  );

  const toggleCategory = useCallback((cat: string) => {
    setCategories((prev) =>
      prev.includes(cat) ? prev.filter((c) => c !== cat) : [...prev, cat],
    );
  }, []);

  const addCustomCategory = useCallback(() => {
    const name = newCatDraft.trim();
    if (!name || allCategories.includes(name)) return;
    setCustomCategories((p) => [...p, name]);
    setCategories((p) => [...p, name]);
    setNewCatDraft("");
  }, [newCatDraft, allCategories]);

  // -----------------------------------------------------------------------
  // Orientation switch
  // -----------------------------------------------------------------------

  const switchOrientation = useCallback(
    (newOr: Orientation) => {
      if (newOr === orientation) return;
      commitSnapshot();
      const oldD = CANVAS_DIMS[orientation];
      const newD = CANVAS_DIMS[newOr];
      setCanvasImages((prev) =>
        rescaleImages(prev, oldD.w, oldD.h, newD.w, newD.h),
      );
      setOrientationState(newOr);
    },
    [orientation, commitSnapshot],
  );

  // -----------------------------------------------------------------------
  // Templates
  // -----------------------------------------------------------------------

  const allTemplates = [...BUILT_IN_TEMPLATES, ...userTemplates];

  const applyTpl = useCallback(
    (tpl: Template) => {
      commitSnapshot();
      const data =
        processedData.length > 0
          ? processedData
          : canvasImages.map((i) => ({
              dataUrl: i.dataUrl,
              naturalWidth: i.naturalWidth,
              naturalHeight: i.naturalHeight,
            }));
      setCanvasImages(applyTemplate(tpl, data, dims.w, dims.h));
      setShowTemplates(false);
    },
    [commitSnapshot, processedData, canvasImages, dims],
  );

  const saveAsTemplate = useCallback(async () => {
    const name = templateNameDraft.trim();
    if (!name) return;
    const tpl = artworkToTemplate(canvasImages, dims.w, dims.h, name);
    await saveTemplate(tpl);
    setUserTemplates((p) => [...p, tpl]);
    setTemplateNameDraft("");
    setSavingTemplate(false);
  }, [templateNameDraft, canvasImages, dims]);

  const handleDeleteTemplate = useCallback(async (id: string) => {
    await deleteTemplate(id);
    setUserTemplates((p) => p.filter((t) => t.id !== id));
  }, []);

  // -----------------------------------------------------------------------
  // Color extraction
  // -----------------------------------------------------------------------

  const doExtract = useCallback(async () => {
    const colors = await extractColors(canvasImages);
    setExtractedColors(colors);
  }, [canvasImages]);

  // -----------------------------------------------------------------------
  // Collection filtering & sorting (now in useCollectionManager)
  // -----------------------------------------------------------------------

  // =====================================================================
  // LIBRARY VIEW
  // =====================================================================

  if (view === "library") {
    return (
      <ImageLibrary
        onBack={() => setView("create")}
        onAddToCanvas={addFromLibrary}
      />
    );
  }

  // =====================================================================
  // MANUAL VIEW
  // =====================================================================

  if (view === "manual") {
    const formatBtn = (o: Orientation, icon: React.ReactNode) => (
      <button
        onClick={() => switchOrientation(o)}
        className={`flex h-8 w-8 items-center justify-center rounded transition-colors ${
          orientation === o
            ? "bg-neutral-100 dark:bg-neutral-700 text-neutral-700 dark:text-neutral-200"
            : "text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300"
        }`}
        aria-label={
          o === "portrait"
            ? "Tall rectangle"
            : o === "landscape"
              ? "Long rectangle"
              : "Square"
        }
      >
        {icon}
      </button>
    );

    const chipCls = (active: boolean) =>
      `rounded-full border px-2.5 py-1 text-[10px] transition-colors ${active ? "border-neutral-500 bg-neutral-100 dark:bg-neutral-700 text-neutral-700 dark:text-neutral-200" : "border-neutral-200 dark:border-neutral-700 text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300"}`;

    return (
      <div className="flex min-h-[100dvh] flex-col bg-white dark:bg-neutral-900">
        {/* Header */}
        <header className="flex items-center justify-between gap-2 px-4 py-2">
          <button
            onClick={() => setView("create")}
            className="flex min-h-[44px] min-w-[44px] items-center text-sm text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300"
          >
            ← Back
          </button>
          <div className="flex items-center gap-1">
            <button
              onClick={undo}
              disabled={undoStack.length === 0}
              className="flex h-10 w-10 items-center justify-center text-neutral-400 transition-colors hover:text-neutral-600 dark:hover:text-neutral-300 disabled:opacity-25"
              aria-label="Undo"
            >
              <UndoIcon />
            </button>
            <button
              onClick={redo}
              disabled={redoStack.length === 0}
              className="flex h-10 w-10 items-center justify-center text-neutral-400 transition-colors hover:text-neutral-600 dark:hover:text-neutral-300 disabled:opacity-25"
              aria-label="Redo"
            >
              <RedoIcon />
            </button>
          </div>
          <div className="flex items-center gap-2">
            {draftIndicator && (
              <span className="text-[10px] text-neutral-400 animate-pulse">
                {draftIndicator}
              </span>
            )}
            {saveMsg && (
              <span className="text-xs text-green-600 dark:text-green-400">
                {saveMsg}
              </span>
            )}
            {cloudUser && syncStatus === "syncing" && (
              <span className="text-[10px] text-neutral-400 animate-pulse">
                Syncing
              </span>
            )}
            <button
              onClick={saveToCollection}
              className="flex min-h-[44px] items-center rounded-full border border-neutral-300 dark:border-neutral-600 px-3 text-[11px] text-neutral-600 dark:text-neutral-300 hover:border-neutral-500"
            >
              Save
            </button>
          </div>
        </header>

        {/* Toolbar */}
        <div className="scrollbar-hide flex items-center gap-2 overflow-x-auto px-4 pb-2">
          <div className="flex gap-0.5 rounded-md border border-neutral-200 dark:border-neutral-700 p-0.5">
            {formatBtn(
              "portrait",
              <svg
                width="12"
                height="16"
                viewBox="0 0 12 16"
                fill="currentColor"
              >
                <rect x="1" y="1" width="10" height="14" rx="1" />
              </svg>,
            )}
            {formatBtn(
              "landscape",
              <svg
                width="16"
                height="12"
                viewBox="0 0 16 12"
                fill="currentColor"
              >
                <rect x="1" y="1" width="14" height="10" rx="1" />
              </svg>,
            )}
            {formatBtn(
              "square",
              <svg
                width="14"
                height="14"
                viewBox="0 0 14 14"
                fill="currentColor"
              >
                <rect x="1" y="1" width="12" height="12" rx="1" />
              </svg>,
            )}
          </div>

          <div className="h-5 w-px bg-neutral-200 dark:bg-neutral-700" />

          <button
            onClick={() => setShowBgPicker((p) => !p)}
            className={`flex h-8 items-center gap-1.5 rounded px-2 text-[11px] transition-colors ${showBgPicker ? "bg-neutral-100 dark:bg-neutral-700 text-neutral-700 dark:text-neutral-200" : "text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300"}`}
          >
            <span
              className="inline-block h-3.5 w-3.5 rounded-full border border-neutral-300 dark:border-neutral-600"
              style={{ backgroundColor: bgColor }}
            />
            BG
          </button>

          <button
            onClick={() => {
              commitSnapshot();
              setImageMargin((p) => !p);
            }}
            className={`flex h-8 items-center gap-1 rounded px-2 text-[11px] transition-colors ${imageMargin ? "bg-neutral-100 dark:bg-neutral-700 text-neutral-700 dark:text-neutral-200" : "text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300"}`}
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={imageMargin ? 2.5 : 1.5}
              strokeLinecap="round"
            >
              <rect x="3" y="3" width="18" height="18" rx="2" />
            </svg>
            Margin
          </button>

          <div className="h-5 w-px bg-neutral-200 dark:bg-neutral-700" />

          <button
            onClick={() => setShowCatRow((p) => !p)}
            className={`flex h-8 items-center rounded px-2 text-[11px] transition-colors ${showCatRow ? "bg-neutral-100 dark:bg-neutral-700 text-neutral-700 dark:text-neutral-200" : "text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300"}`}
          >
            Tags
          </button>

          <button
            onClick={() => setShowTemplates(true)}
            className="flex h-8 items-center rounded px-2 text-[11px] text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300"
          >
            Templates
          </button>

          <button
            onClick={() => setView("library")}
            className="flex h-8 items-center rounded px-2 text-[11px] text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300"
          >
            Library
          </button>

          <div className="h-5 w-px bg-neutral-200 dark:bg-neutral-700" />

          <button
            onClick={() => manualFileRef.current?.click()}
            className="flex h-8 items-center gap-1 rounded px-2 text-[11px] text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300"
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
            >
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            Add
          </button>
          <input
            ref={manualFileRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            multiple
            onChange={handleManualFileAdd}
            className="hidden"
            aria-label="Add images to canvas"
          />
        </div>

        {/* BG color picker (expandable) */}
        {showBgPicker && (
          <div className="flex flex-wrap items-center gap-2 px-4 pb-2">
            {BG_PRESETS.map((c) => (
              <button
                key={c}
                onClick={() => setBgColor(c)}
                className={`h-7 w-7 rounded-full border-2 transition-transform ${bgColor === c ? "border-neutral-500 scale-110" : "border-neutral-200 dark:border-neutral-600 hover:scale-105"}`}
                style={{ backgroundColor: c }}
                aria-label={c}
              />
            ))}
            <div className="h-5 w-px bg-neutral-200 dark:bg-neutral-700" />
            {extractedColors.map((c) => (
              <button
                key={c}
                onClick={() => setBgColor(c)}
                className={`h-7 w-7 rounded-full border-2 transition-transform ${bgColor === c ? "border-neutral-500 scale-110" : "border-neutral-200 dark:border-neutral-600 hover:scale-105"}`}
                style={{ backgroundColor: c }}
                aria-label={c}
              />
            ))}
            <button
              onClick={doExtract}
              className="text-[10px] text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300 underline underline-offset-2"
            >
              Extract
            </button>
          </div>
        )}

        {/* Category chips */}
        {showCatRow && (
          <div className="scrollbar-hide flex items-center gap-1.5 overflow-x-auto px-4 pb-2">
            {allCategories.map((cat) => (
              <button
                key={cat}
                onClick={() => toggleCategory(cat)}
                className={chipCls(categories.includes(cat))}
              >
                {cat}
              </button>
            ))}
            <div className="flex items-center gap-1">
              <input
                type="text"
                value={newCatDraft}
                onChange={(e) => setNewCatDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") addCustomCategory();
                }}
                placeholder="+"
                className="w-12 border-b border-neutral-200 dark:border-neutral-700 bg-transparent text-center text-[10px] text-neutral-700 dark:text-neutral-300 outline-none placeholder:text-neutral-300 dark:placeholder:text-neutral-600 focus:border-neutral-400"
              />
            </div>
          </div>
        )}

        {/* Canvas */}
        <div className="flex-1 px-4 pb-2">
          <InteractiveCanvas
            images={canvasImages}
            onChange={setCanvasImages}
            onCommit={commitSnapshot}
            canvasWidth={dims.w}
            canvasHeight={dims.h}
            bgColor={bgColor}
            imageMargin={imageMargin}
          />
        </div>

        {/* Export actions */}
        <ActionBar
          onDownload={downloadManual}
          onPrint={printManual}
          onCast={castToFarcaster}
          castStatus={castStatus}
        />

        {/* Template bottom sheet */}
        {showTemplates && (
          <div
            className="fixed inset-0 z-50 flex flex-col justify-end"
            onClick={() => setShowTemplates(false)}
          >
            <div className="flex-1 bg-black/15 dark:bg-black/40" />
            <div
              className="max-h-[65vh] overflow-y-auto rounded-t-xl bg-white dark:bg-neutral-800 px-4 pb-6 pt-3"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="mx-auto mb-4 h-1 w-8 rounded-full bg-neutral-300 dark:bg-neutral-600" />
              <p className="mb-3 text-[11px] uppercase tracking-widest text-neutral-400">
                Templates
              </p>
              <div className="grid grid-cols-4 gap-3 sm:grid-cols-5">
                {allTemplates.map((tpl) => (
                  <div key={tpl.id} className="group relative">
                    <button
                      onClick={() => applyTpl(tpl)}
                      className="flex w-full flex-col items-center gap-1"
                    >
                      <img
                        src={`data:image/svg+xml;charset=utf-8,${encodeURIComponent(templatePreviewSvg(tpl.slots))}`}
                        alt={tpl.name}
                        className="w-full rounded border border-neutral-100 dark:border-neutral-700"
                      />
                      <span className="text-[10px] text-neutral-500 dark:text-neutral-400">
                        {tpl.name}
                      </span>
                    </button>
                    {!tpl.isBuiltIn && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteTemplate(tpl.id);
                        }}
                        className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-white dark:bg-neutral-700 text-[9px] text-neutral-400 opacity-0 shadow-sm transition-opacity group-hover:opacity-100"
                        style={{ opacity: 1 }}
                        aria-label="Delete template"
                      >
                        ×
                      </button>
                    )}
                  </div>
                ))}
              </div>

              <div className="mt-4 border-t border-neutral-100 dark:border-neutral-700 pt-3">
                {savingTemplate ? (
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={templateNameDraft}
                      onChange={(e) => setTemplateNameDraft(e.target.value)}
                      placeholder="Template name"
                      maxLength={40}
                      className="flex-1 border-b border-neutral-300 dark:border-neutral-600 bg-transparent pb-1 text-sm text-neutral-700 dark:text-neutral-200 outline-none placeholder:text-neutral-400 focus:border-neutral-500"
                      autoFocus
                    />
                    <button
                      onClick={saveAsTemplate}
                      disabled={!templateNameDraft.trim()}
                      className="text-xs text-neutral-600 dark:text-neutral-300 hover:text-neutral-800 dark:hover:text-white disabled:opacity-40"
                    >
                      Save
                    </button>
                    <button
                      onClick={() => setSavingTemplate(false)}
                      className="text-xs text-neutral-400"
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setSavingTemplate(true)}
                    className="text-xs text-neutral-500 dark:text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-300"
                  >
                    Save current layout as template
                  </button>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // =====================================================================
  // AUTO-RESULT VIEW
  // =====================================================================

  if (view === "auto-result" && moodboardUrl) {
    return (
      <div className="flex min-h-[100dvh] flex-col bg-white dark:bg-neutral-900">
        <header className="flex items-center justify-between px-4 py-3">
          <button
            onClick={() => setView("create")}
            className="flex min-h-[44px] min-w-[44px] items-center text-sm text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300"
          >
            ← Back
          </button>
          <button
            onClick={regenerate}
            disabled={isProcessing}
            className="flex min-h-[44px] min-w-[44px] items-center justify-center text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300 disabled:opacity-40"
          >
            {isProcessing ? <Spinner /> : <RefreshIcon />}
          </button>
        </header>
        <div className="flex flex-1 items-start justify-center px-4 pb-4">
          <img
            src={moodboardUrl}
            alt={title}
            className="w-full max-w-lg rounded-sm"
          />
        </div>
        <ActionBar
          onDownload={downloadAuto}
          onPrint={printAuto}
          onCast={castToFarcaster}
          castStatus={castStatus}
        />
      </div>
    );
  }

  // =====================================================================
  // CREATE VIEW
  // =====================================================================

  return (
    <div className="flex min-h-[100dvh] flex-col bg-white dark:bg-neutral-900">
      <div className="mx-auto flex w-full max-w-lg flex-1 flex-col gap-5 px-5 py-6">
        {/* Storage unavailable banner */}
        {!storageAvailable && (
          <div className="flex items-center gap-3 rounded-md border border-amber-300 dark:border-amber-600 bg-amber-50 dark:bg-amber-900/30 px-4 py-3">
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="shrink-0 text-amber-600 dark:text-amber-400"
            >
              <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0zM12 9v4M12 17h.01" />
            </svg>
            <span className="text-sm text-amber-800 dark:text-amber-200">
              Storage unavailable — your work won&apos;t be saved between
              sessions
            </span>
          </div>
        )}

        {/* Draft recovery banner */}
        {pendingDraft && (
          <div className="flex items-center justify-between rounded-md border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800 px-4 py-3">
            <span className="text-sm text-neutral-600 dark:text-neutral-300">
              Unsaved work found
            </span>
            <div className="flex gap-3">
              <button
                onClick={recoverDraft}
                className="text-sm font-medium text-neutral-700 dark:text-neutral-200 hover:text-neutral-900 dark:hover:text-white"
              >
                Recover
              </button>
              <button
                onClick={dismissDraft}
                className="text-sm text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300"
              >
                Dismiss
              </button>
            </div>
          </div>
        )}

        <div className="flex items-center justify-between">
          <p className="text-[11px] uppercase tracking-widest text-neutral-400">
            Moodboard
          </p>
          <div className="flex items-center gap-3">
            <button
              onClick={toggleTheme}
              className="flex h-8 w-8 items-center justify-center rounded-full text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800 hover:text-neutral-600 dark:hover:text-neutral-300 transition-colors"
              aria-label={
                isDark ? "Switch to light mode" : "Switch to dark mode"
              }
            >
              {isDark ? <SunIcon /> : <MoonIcon />}
            </button>
            <button
              onClick={() => setView("library")}
              className="text-[11px] text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300"
            >
              Library
            </button>
            {cloudUser ? (
              <button
                onClick={() =>
                  cloudSync()
                    .then(() => refreshCollection())
                    .catch(() => {})
                }
                disabled={syncStatus === "syncing"}
                className="flex items-center gap-1.5 text-[11px] text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300 disabled:opacity-40"
              >
                {cloudUser.pfpUrl && (
                  <img
                    src={cloudUser.pfpUrl}
                    alt=""
                    className="h-4 w-4 rounded-full"
                  />
                )}
                {syncStatus === "syncing" ? (
                  <>
                    <Spinner /> Syncing
                  </>
                ) : syncStatus === "synced" ? (
                  <>
                    <CloudSyncedIcon /> Synced
                  </>
                ) : syncStatus === "error" ? (
                  <>
                    <CloudErrorIcon /> Retry
                  </>
                ) : (
                  <>
                    <CloudIcon /> Sync
                  </>
                )}
              </button>
            ) : (
              <button
                onClick={() => cloudSignIn().catch(() => {})}
                className="text-[11px] text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300"
              >
                Sign in
              </button>
            )}
          </div>
        </div>

        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Title"
          maxLength={80}
          className="w-full border-b border-neutral-300 dark:border-neutral-600 bg-transparent pb-2 text-lg font-light text-neutral-800 dark:text-neutral-100 outline-none transition-colors placeholder:text-neutral-400 focus:border-neutral-500"
        />

        <textarea
          value={caption}
          onChange={(e) => setCaption(e.target.value)}
          placeholder="Add a caption (optional)"
          maxLength={280}
          rows={2}
          className="w-full resize-none border-b border-neutral-300 dark:border-neutral-600 bg-transparent pb-2 text-sm font-light text-neutral-600 dark:text-neutral-300 outline-none transition-colors placeholder:text-neutral-400 focus:border-neutral-500"
        />

        <div>
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={files.length >= MAX_IMAGES}
            className="flex min-h-[88px] w-full flex-col items-center justify-center gap-2 rounded-sm border border-dashed border-neutral-300 dark:border-neutral-600 py-8 text-neutral-400 hover:border-neutral-400 dark:hover:border-neutral-500 hover:text-neutral-500 dark:hover:text-neutral-300 disabled:cursor-not-allowed disabled:opacity-30"
          >
            <PlusIcon />
            <span className="text-xs">
              {files.length === 0 ? "Add images" : "Add more"}
            </span>
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            multiple
            onChange={handleFileChange}
            className="hidden"
            aria-label="Upload images"
          />
          {files.length > 0 && (
            <p className="mt-1.5 text-right text-[11px] text-neutral-400">
              {files.length}/{MAX_IMAGES}
            </p>
          )}
        </div>

        {files.length > 0 && (
          <div className="scrollbar-hide -mx-1 flex gap-2 overflow-x-auto px-1 pb-2">
            {previewUrls.map((url, i) => (
              <div
                key={url}
                className="relative h-[60px] w-[60px] flex-shrink-0"
              >
                <img
                  src={url}
                  alt=""
                  className="h-full w-full rounded-sm object-cover"
                />
                <button
                  onClick={() => removeImage(i)}
                  className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 text-xs leading-none text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300"
                  aria-label="Remove image"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        )}

        {files.length > 0 && files.length < MIN_IMAGES && (
          <p className="text-[11px] text-neutral-400">
            Add {MIN_IMAGES - files.length} more image
            {MIN_IMAGES - files.length > 1 ? "s" : ""}
          </p>
        )}

        {canGenerate && (
          <div className="flex gap-3">
            <button
              onClick={generate}
              disabled={isProcessing}
              className="flex min-h-[44px] flex-1 items-center justify-center rounded-sm border border-neutral-300 dark:border-neutral-600 py-3 text-sm font-light text-neutral-600 dark:text-neutral-300 hover:border-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-100 disabled:opacity-50"
            >
              {isProcessing ? (
                <span className="flex items-center gap-2">
                  <Spinner /> Processing…
                </span>
              ) : (
                "Generate"
              )}
            </button>
            <button
              onClick={enterManualMode}
              disabled={isProcessing}
              className="flex min-h-[44px] flex-1 items-center justify-center rounded-sm border border-neutral-300 dark:border-neutral-600 py-3 text-sm font-light text-neutral-600 dark:text-neutral-300 hover:border-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-100 disabled:opacity-50"
            >
              Arrange
            </button>
          </div>
        )}

        {!title.trim() &&
          files.length === 0 &&
          savedArtworks.length === 0 &&
          !pendingDraft && (
            <p className="pt-4 text-center text-[11px] text-neutral-400">
              Add title + {MIN_IMAGES}–{MAX_IMAGES} images
            </p>
          )}

        {/* ============================================================ */}
        {/* COLLECTION                                                    */}
        {/* ============================================================ */}

        {savedArtworks.length > 0 && (
          <div className="mt-2 border-t border-neutral-200 dark:border-neutral-700 pt-4">
            <p className="mb-3 text-[11px] uppercase tracking-widest text-neutral-400">
              Collection
            </p>

            {/* Search */}
            <input
              type="text"
              value={colSearch}
              onChange={(e) => setColSearch(e.target.value)}
              placeholder="Search collection"
              className="mb-2 w-full border-b border-neutral-200 dark:border-neutral-700 bg-transparent pb-1.5 text-sm text-neutral-700 dark:text-neutral-200 outline-none placeholder:text-neutral-400 focus:border-neutral-400"
            />

            {/* Category filter + sort */}
            <div className="mb-2 flex items-center justify-between">
              <div className="scrollbar-hide flex gap-1 overflow-x-auto">
                <button
                  onClick={() => setColCatFilter(null)}
                  className={`whitespace-nowrap rounded-full border px-2 py-0.5 text-[10px] transition-colors ${colCatFilter === null ? "border-neutral-500 bg-neutral-100 dark:bg-neutral-700 text-neutral-700 dark:text-neutral-200" : "border-neutral-200 dark:border-neutral-700 text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300"}`}
                >
                  All
                </button>
                {collectionCategories.map((cat) => (
                  <button
                    key={cat}
                    onClick={() => setColCatFilter(cat)}
                    className={`whitespace-nowrap rounded-full border px-2 py-0.5 text-[10px] transition-colors ${colCatFilter === cat ? "border-neutral-500 bg-neutral-100 dark:bg-neutral-700 text-neutral-700 dark:text-neutral-200" : "border-neutral-200 dark:border-neutral-700 text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300"}`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
              <select
                value={colSort}
                onChange={(e) => setColSort(e.target.value as ColSort)}
                className="ml-2 flex-shrink-0 border-none bg-transparent text-[10px] text-neutral-500 dark:text-neutral-400 outline-none"
                aria-label="Sort collection"
              >
                <option value="newest">Newest</option>
                <option value="oldest">Oldest</option>
                <option value="title">Title</option>
                <option value="images">Images</option>
              </select>
            </div>

            {/* Artwork grid */}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {filteredArtworks.map((aw) => (
                <div
                  key={aw.id}
                  className="group relative overflow-hidden rounded-md border border-neutral-100 dark:border-neutral-700"
                >
                  {/* Thumbnail / preview */}
                  <button
                    onClick={() => loadArtworkForEditing(aw)}
                    className="block w-full text-left"
                  >
                    {aw.thumbnail ? (
                      <img
                        src={aw.thumbnail}
                        alt={aw.title}
                        loading="lazy"
                        className="aspect-[3/4] w-full object-cover"
                      />
                    ) : (
                      <div
                        className="flex aspect-[3/4] w-full items-center justify-center"
                        style={{ backgroundColor: aw.bgColor || "#f5f5f4" }}
                      >
                        <span className="text-[10px] text-neutral-400">
                          {aw.images.length} images
                        </span>
                      </div>
                    )}
                    <div className="px-2 py-1.5 bg-white dark:bg-neutral-800">
                      <p className="truncate text-xs font-medium text-neutral-700 dark:text-neutral-200">
                        {aw.title}
                      </p>
                      <p className="text-[10px] text-neutral-400">
                        {new Date(aw.updatedAt).toLocaleDateString()}
                      </p>
                      {(aw.categories ?? []).length > 0 && (
                        <div className="mt-0.5 flex flex-wrap gap-0.5">
                          {(aw.categories ?? []).slice(0, 2).map((c) => (
                            <span
                              key={c}
                              className="rounded-sm bg-neutral-100 dark:bg-neutral-700 px-1 text-[8px] text-neutral-500 dark:text-neutral-400"
                            >
                              {c}
                            </span>
                          ))}
                          {(aw.categories ?? []).length > 2 && (
                            <span className="text-[8px] text-neutral-400">
                              +{(aw.categories ?? []).length - 2}
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  </button>

                  {/* Pin indicator */}
                  {aw.pinned && (
                    <div className="absolute left-1.5 top-1.5 rounded-full bg-white/80 dark:bg-neutral-800/80 p-1 shadow-sm">
                      <svg
                        width="10"
                        height="10"
                        viewBox="0 0 24 24"
                        fill="currentColor"
                        className="text-neutral-600 dark:text-neutral-300"
                      >
                        <path d="M16 12V4h1V2H7v2h1v8l-2 2v2h5v6h2v-6h5v-2l-2-2z" />
                      </svg>
                    </div>
                  )}

                  {/* Hover actions */}
                  <div className="absolute right-1 top-1 flex gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        togglePinArtwork(aw);
                      }}
                      className="flex h-7 w-7 items-center justify-center rounded-full bg-white/90 dark:bg-neutral-800/90 text-neutral-500 shadow-sm hover:text-neutral-700 dark:hover:text-neutral-300"
                      aria-label={aw.pinned ? "Unpin" : "Pin"}
                    >
                      <svg
                        width="11"
                        height="11"
                        viewBox="0 0 24 24"
                        fill={aw.pinned ? "currentColor" : "none"}
                        stroke="currentColor"
                        strokeWidth="1.5"
                      >
                        <path d="M16 12V4h1V2H7v2h1v8l-2 2v2h5v6h2v-6h5v-2l-2-2z" />
                      </svg>
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        duplicateArtwork(aw);
                      }}
                      className="flex h-7 w-7 items-center justify-center rounded-full bg-white/90 dark:bg-neutral-800/90 text-neutral-500 shadow-sm hover:text-neutral-700 dark:hover:text-neutral-300"
                      aria-label="Duplicate"
                    >
                      <svg
                        width="12"
                        height="12"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <rect x="9" y="9" width="13" height="13" rx="2" />
                        <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                      </svg>
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        confirmDeleteArtwork(aw.id);
                      }}
                      className="flex h-7 w-7 items-center justify-center rounded-full bg-white/90 dark:bg-neutral-800/90 text-neutral-400 shadow-sm hover:text-red-500 dark:hover:text-red-400"
                      aria-label="Delete artwork"
                    >
                      <svg
                        width="12"
                        height="12"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                      >
                        <line x1="18" y1="6" x2="6" y2="18" />
                        <line x1="6" y1="6" x2="18" y2="18" />
                      </svg>
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {filteredArtworks.length === 0 && colSearch && (
              <p className="py-4 text-center text-[11px] text-neutral-400">
                No matching artworks
              </p>
            )}
          </div>
        )}
      </div>

      {/* Delete confirmation dialog */}
      {deleteConfirmId && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 dark:bg-black/50"
          onClick={() => setDeleteConfirmId(null)}
        >
          <div
            className="mx-4 w-full max-w-xs rounded-lg bg-white dark:bg-neutral-800 p-5 shadow-lg"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="text-sm text-neutral-700 dark:text-neutral-200">
              Delete this moodboard?
            </p>
            <p className="mt-1 text-[11px] text-neutral-400">
              This action cannot be undone.
            </p>
            <div className="mt-4 flex justify-end gap-3">
              <button
                onClick={() => setDeleteConfirmId(null)}
                className="rounded-md px-3 py-1.5 text-xs text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDeleteArtwork(deleteConfirmId)}
                className="rounded-md bg-red-50 dark:bg-red-900/30 px-3 py-1.5 text-xs text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/50"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
