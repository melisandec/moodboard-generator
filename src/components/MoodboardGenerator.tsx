'use client';

import { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { sdk } from '@farcaster/miniapp-sdk';
import {
  loadImage, renderMoodboard, compressForStorage, createInitialPlacements,
  renderManualMoodboard, extractColors,
} from '@/lib/canvas';
import {
  saveArtwork, loadArtworks, deleteArtwork, saveTemplate, loadTemplates, deleteTemplate,
  saveDraft, loadDraft, clearDraft, ensureInLibrary, DEFAULT_CATEGORIES,
  type Artwork, type CanvasImage, type Orientation, type Template, type Draft, type LibraryImage,
} from '@/lib/storage';
import {
  CANVAS_DIMS, BUILT_IN_TEMPLATES, applyTemplate, artworkToTemplate,
  rescaleImages, templatePreviewSvg,
} from '@/lib/templates';
import InteractiveCanvas from './InteractiveCanvas';
import ImageLibrary from './ImageLibrary';
import { useCloud } from './CloudProvider';

const MIN_IMAGES = 4;
const MAX_IMAGES = 20;
const MAX_HISTORY = 50;
const AUTOSAVE_MS = 30_000;
const BG_PRESETS = ['#FFFFFF', '#F8F8F8', '#F0F0F0', '#FAF9F6', '#000000'];

type View = 'create' | 'auto-result' | 'manual' | 'library';
type ColSort = 'newest' | 'oldest' | 'title' | 'images';

// ---------------------------------------------------------------------------
// Tiny icon helpers
// ---------------------------------------------------------------------------

function Ico({ d, size = 20, sw = 1.5 }: { d: string; size?: number; sw?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round">
      <path d={d} />
    </svg>
  );
}

const DownloadIcon = () => <Ico d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3" />;
const PrintIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="6 9 6 2 18 2 18 9" /><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" /><rect x="6" y="14" width="12" height="8" />
  </svg>
);
const CastIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <line x1="22" y1="2" x2="11" y2="13" /><polygon points="22 2 15 22 11 13 2 9 22 2" />
  </svg>
);
const RefreshIcon = () => <Ico d="M23 4v6h-6M1 20v-6h6M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" size={18} />;
const Spinner = () => (
  <svg className="animate-spin" width="16" height="16" viewBox="0 0 24 24" fill="none">
    <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" opacity="0.25" />
    <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
  </svg>
);
const PlusIcon = () => (
  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round">
    <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
  </svg>
);
const UndoIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 10h10a5 5 0 0 1 0 10H9" /><path d="M7 6l-4 4 4 4" />
  </svg>
);
const RedoIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 10H11a5 5 0 0 0 0 10h4" /><path d="M17 6l4 4-4 4" />
  </svg>
);

const CloudIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z" />
  </svg>
);
const CloudSyncedIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z" /><path d="M9 15l2 2 4-4" />
  </svg>
);
const CloudErrorIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z" /><line x1="12" y1="13" x2="12" y2="16" /><circle cx="12" cy="10" r="0.5" />
  </svg>
);

function ActionBar({ onDownload, onPrint, onCast }: { onDownload: () => void; onPrint: () => void; onCast: () => void }) {
  const btn = 'flex min-h-[44px] min-w-[44px] flex-col items-center gap-1 text-neutral-500 transition-colors hover:text-neutral-700';
  return (
    <div className="sticky bottom-0 border-t border-neutral-200 bg-white/90 px-4 py-3 backdrop-blur-sm">
      <div className="mx-auto flex max-w-lg items-center justify-center gap-10">
        <button onClick={onDownload} className={btn}><DownloadIcon /><span className="text-[11px]">Save</span></button>
        <button onClick={onPrint} className={btn}><PrintIcon /><span className="text-[11px]">Print</span></button>
        <button onClick={onCast} className={btn}><CastIcon /><span className="text-[11px]">Cast</span></button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default function MoodboardGenerator() {
  const [files, setFiles] = useState<File[]>([]);
  const [previewUrls, setPreviewUrls] = useState<string[]>([]);
  const [title, setTitle] = useState('');
  const [caption, setCaption] = useState('');
  const [view, setView] = useState<View>('create');
  const [isProcessing, setIsProcessing] = useState(false);

  // Auto-mode
  const [moodboardUrl, setMoodboardUrl] = useState<string | null>(null);

  // Manual-mode
  const [canvasImages, setCanvasImages] = useState<CanvasImage[]>([]);
  const [artworkId, setArtworkId] = useState<string | null>(null);
  const [saveMsg, setSaveMsg] = useState<string | null>(null);
  const [orientation, setOrientationState] = useState<Orientation>('portrait');
  const [bgColor, setBgColor] = useState('#f5f5f4');
  const [imageMargin, setImageMargin] = useState(false);
  const [processedData, setProcessedData] = useState<Array<{ dataUrl: string; naturalWidth: number; naturalHeight: number }>>([]);

  // Categories
  const [categories, setCategories] = useState<string[]>([]);
  const [customCategories, setCustomCategories] = useState<string[]>([]);
  const [showCatRow, setShowCatRow] = useState(false);
  const [newCatDraft, setNewCatDraft] = useState('');

  // Undo / Redo
  const [undoStack, setUndoStack] = useState<CanvasImage[][]>([]);
  const [redoStack, setRedoStack] = useState<CanvasImage[][]>([]);

  // UI panels
  const [showBgPicker, setShowBgPicker] = useState(false);
  const [showTemplates, setShowTemplates] = useState(false);
  const [templateNameDraft, setTemplateNameDraft] = useState('');
  const [savingTemplate, setSavingTemplate] = useState(false);
  const [extractedColors, setExtractedColors] = useState<string[]>([]);

  // Auto-save draft
  const [draftIndicator, setDraftIndicator] = useState<string | null>(null);
  const [pendingDraft, setPendingDraft] = useState<Draft | null>(null);

  // Collection
  const [savedArtworks, setSavedArtworks] = useState<Artwork[]>([]);
  const [userTemplates, setUserTemplates] = useState<Template[]>([]);
  const [colSearch, setColSearch] = useState('');
  const [colSort, setColSort] = useState<ColSort>('newest');
  const [colCatFilter, setColCatFilter] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const { user: cloudUser, syncStatus, signIn: cloudSignIn, sync: cloudSync } = useCloud();
  const canGenerate = title.trim().length > 0 && files.length >= MIN_IMAGES;
  const dims = CANVAS_DIMS[orientation];

  // -----------------------------------------------------------------------
  // Initialize SDK, load persisted data, check for draft
  // -----------------------------------------------------------------------

  useEffect(() => {
    sdk.actions.ready({ disableNativeGestures: true }).catch(() => {});
    loadArtworks()
      .then((l) => setSavedArtworks(l.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))))
      .catch(() => {});
    loadTemplates().then(setUserTemplates).catch(() => {});

    loadDraft().then((d) => {
      if (d) setPendingDraft(d);
    }).catch(() => {});

    const stored = localStorage.getItem('moodboard-custom-categories');
    if (stored) {
      try { setCustomCategories(JSON.parse(stored)); } catch { /* ignore */ }
    }
  }, []);

  // Persist custom categories
  useEffect(() => {
    if (customCategories.length > 0) {
      localStorage.setItem('moodboard-custom-categories', JSON.stringify(customCategories));
    }
  }, [customCategories]);

  // Keyboard shortcuts for undo/redo
  useEffect(() => {
    if (view !== 'manual') return;
    const handler = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;
      if (mod && e.key === 'z' && !e.shiftKey) { e.preventDefault(); undo(); }
      else if ((mod && e.key === 'z' && e.shiftKey) || (mod && e.key === 'y')) { e.preventDefault(); redo(); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  });

  // -----------------------------------------------------------------------
  // Auto-save draft (every 30s in manual view)
  // -----------------------------------------------------------------------

  useEffect(() => {
    if (view !== 'manual' || canvasImages.length === 0) return;
    const timer = setInterval(() => {
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
        setDraftIndicator('Draft saved');
        setTimeout(() => setDraftIndicator(null), 1500);
      }).catch(() => {});
    }, AUTOSAVE_MS);
    return () => clearInterval(timer);
  }, [view, title, caption, canvasImages, orientation, bgColor, imageMargin, categories]);

  // -----------------------------------------------------------------------
  // Draft recovery
  // -----------------------------------------------------------------------

  const recoverDraft = useCallback(() => {
    if (!pendingDraft) return;
    setTitle(pendingDraft.title);
    setCaption(pendingDraft.caption);
    setCanvasImages(pendingDraft.images);
    setProcessedData(pendingDraft.images.map((i) => ({ dataUrl: i.dataUrl, naturalWidth: i.naturalWidth, naturalHeight: i.naturalHeight })));
    setOrientationState(pendingDraft.orientation ?? 'portrait');
    setBgColor(pendingDraft.bgColor ?? '#f5f5f4');
    setImageMargin(pendingDraft.imageMargin ?? false);
    setCategories(pendingDraft.categories ?? []);
    setArtworkId(null);
    setUndoStack([]);
    setRedoStack([]);
    setView('manual');
    setPendingDraft(null);
  }, [pendingDraft]);

  const dismissDraft = useCallback(() => {
    clearDraft().catch(() => {});
    setPendingDraft(null);
  }, []);

  // -----------------------------------------------------------------------
  // Undo / Redo
  // -----------------------------------------------------------------------

  const commitSnapshot = useCallback(() => {
    setUndoStack((prev) => [...prev.slice(-(MAX_HISTORY - 1)), canvasImages]);
    setRedoStack([]);
  }, [canvasImages]);

  const undo = useCallback(() => {
    setUndoStack((prev) => {
      if (prev.length === 0) return prev;
      const snapshot = prev[prev.length - 1];
      setRedoStack((r) => [...r, canvasImages]);
      setCanvasImages(snapshot);
      return prev.slice(0, -1);
    });
  }, [canvasImages]);

  const redo = useCallback(() => {
    setRedoStack((prev) => {
      if (prev.length === 0) return prev;
      const snapshot = prev[prev.length - 1];
      setUndoStack((u) => [...u, canvasImages]);
      setCanvasImages(snapshot);
      return prev.slice(0, -1);
    });
  }, [canvasImages]);

  // -----------------------------------------------------------------------
  // Category management
  // -----------------------------------------------------------------------

  const allCategories = useMemo(() => [...DEFAULT_CATEGORIES, ...customCategories], [customCategories]);

  const toggleCategory = useCallback((cat: string) => {
    setCategories((prev) => prev.includes(cat) ? prev.filter((c) => c !== cat) : [...prev, cat]);
  }, []);

  const addCustomCategory = useCallback(() => {
    const name = newCatDraft.trim();
    if (!name || allCategories.includes(name)) return;
    setCustomCategories((p) => [...p, name]);
    setCategories((p) => [...p, name]);
    setNewCatDraft('');
  }, [newCatDraft, allCategories]);

  // -----------------------------------------------------------------------
  // File handling
  // -----------------------------------------------------------------------

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const input = e.target.files;
      if (!input) return;
      const toAdd = Array.from(input).slice(0, MAX_IMAGES - files.length);
      if (toAdd.length === 0) return;
      setFiles((p) => [...p, ...toAdd]);
      setPreviewUrls((p) => [...p, ...toAdd.map((f) => URL.createObjectURL(f))]);
      if (fileInputRef.current) fileInputRef.current.value = '';
    },
    [files.length],
  );

  const removeImage = useCallback((index: number) => {
    setPreviewUrls((p) => { URL.revokeObjectURL(p[index]); return p.filter((_, i) => i !== index); });
    setFiles((p) => p.filter((_, i) => i !== index));
  }, []);

  // -----------------------------------------------------------------------
  // Auto-generate
  // -----------------------------------------------------------------------

  const generate = useCallback(async () => {
    if (!canGenerate || isProcessing) return;
    setIsProcessing(true);
    try {
      const loaded = await Promise.all(files.map((f) => loadImage(f)));
      setMoodboardUrl(renderMoodboard(loaded, title.trim(), caption.trim()));
      setView('auto-result');
    } catch (err) { console.error(err); }
    finally { setIsProcessing(false); }
  }, [canGenerate, isProcessing, files, title, caption]);

  const regenerate = useCallback(async () => {
    if (isProcessing) return;
    setIsProcessing(true);
    try {
      const loaded = await Promise.all(files.map((f) => loadImage(f)));
      setMoodboardUrl(renderMoodboard(loaded, title.trim(), caption.trim()));
    } catch (err) { console.error(err); }
    finally { setIsProcessing(false); }
  }, [isProcessing, files, title, caption]);

  // -----------------------------------------------------------------------
  // Enter manual mode
  // -----------------------------------------------------------------------

  const enterManualMode = useCallback(async () => {
    if (!canGenerate || isProcessing) return;
    setIsProcessing(true);
    try {
      const processed = await Promise.all(files.map((f) => compressForStorage(f)));
      setProcessedData(processed);
      const d = CANVAS_DIMS[orientation];
      setCanvasImages(createInitialPlacements(processed, d.w, d.h));
      setArtworkId(null);
      setBgColor('#f5f5f4');
      setImageMargin(false);
      setCategories([]);
      setUndoStack([]);
      setRedoStack([]);
      setExtractedColors([]);
      clearDraft().catch(() => {});
      setView('manual');

      // add images to library in background
      for (let i = 0; i < processed.length; i++) {
        ensureInLibrary(processed[i].dataUrl, files[i].name, processed[i].naturalWidth, processed[i].naturalHeight).catch(() => {});
      }
    } catch (err) { console.error(err); }
    finally { setIsProcessing(false); }
  }, [canGenerate, isProcessing, files, orientation]);

  const loadArtworkForEditing = useCallback((aw: Artwork) => {
    setTitle(aw.title);
    setCaption(aw.caption);
    setCanvasImages(aw.images);
    setProcessedData(aw.images.map((i) => ({ dataUrl: i.dataUrl, naturalWidth: i.naturalWidth, naturalHeight: i.naturalHeight })));
    setArtworkId(aw.id);
    setOrientationState(aw.orientation ?? 'portrait');
    setBgColor(aw.bgColor ?? '#f5f5f4');
    setImageMargin(aw.imageMargin ?? false);
    setCategories(aw.categories ?? []);
    setUndoStack([]);
    setRedoStack([]);
    setExtractedColors([]);
    setView('manual');
  }, []);

  const duplicateArtwork = useCallback((aw: Artwork) => {
    setTitle(`Copy of ${aw.title}`);
    setCaption(aw.caption);
    setCanvasImages(aw.images.map((i) => ({ ...i, id: `img-${Date.now()}-${Math.random().toString(36).slice(2, 8)}` })));
    setProcessedData(aw.images.map((i) => ({ dataUrl: i.dataUrl, naturalWidth: i.naturalWidth, naturalHeight: i.naturalHeight })));
    setArtworkId(null);
    setOrientationState(aw.orientation ?? 'portrait');
    setBgColor(aw.bgColor ?? '#f5f5f4');
    setImageMargin(aw.imageMargin ?? false);
    setCategories(aw.categories ?? []);
    setUndoStack([]);
    setRedoStack([]);
    setView('manual');
  }, []);

  // -----------------------------------------------------------------------
  // Add images from library to current canvas
  // -----------------------------------------------------------------------

  const addFromLibrary = useCallback((libImages: LibraryImage[]) => {
    const maxZ = canvasImages.length > 0 ? Math.max(...canvasImages.map((i) => i.zIndex)) + 1 : 0;
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

    if (view === 'manual' && canvasImages.length > 0) {
      commitSnapshot();
      setCanvasImages((prev) => [...prev, ...newImgs]);
      setProcessedData((prev) => [...prev, ...libImages.map((li) => ({ dataUrl: li.dataUrl, naturalWidth: li.naturalWidth, naturalHeight: li.naturalHeight }))]);
    } else {
      setCanvasImages(newImgs);
      setProcessedData(libImages.map((li) => ({ dataUrl: li.dataUrl, naturalWidth: li.naturalWidth, naturalHeight: li.naturalHeight })));
      setArtworkId(null);
      setUndoStack([]);
      setRedoStack([]);
    }
    setView('manual');
  }, [view, canvasImages, dims, commitSnapshot]);

  // -----------------------------------------------------------------------
  // Orientation switch
  // -----------------------------------------------------------------------

  const switchOrientation = useCallback((newOr: Orientation) => {
    if (newOr === orientation) return;
    commitSnapshot();
    const oldD = CANVAS_DIMS[orientation];
    const newD = CANVAS_DIMS[newOr];
    setCanvasImages((prev) => rescaleImages(prev, oldD.w, oldD.h, newD.w, newD.h));
    setOrientationState(newOr);
  }, [orientation, commitSnapshot]);

  // -----------------------------------------------------------------------
  // Save to collection
  // -----------------------------------------------------------------------

  const refreshCollection = useCallback(() => {
    loadArtworks().then((l) => setSavedArtworks(l.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)))).catch(() => {});
  }, []);

  const saveToCollection = useCallback(async () => {
    const now = new Date().toISOString();
    const id = artworkId ?? `artwork-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    let createdAt = now;
    if (artworkId) {
      const ex = savedArtworks.find((a) => a.id === artworkId);
      if (ex) createdAt = ex.createdAt;
    }
    await saveArtwork({
      id, title: title.trim() || 'Untitled', caption: caption.trim(),
      images: canvasImages, canvasWidth: dims.w, canvasHeight: dims.h,
      orientation, bgColor, imageMargin, categories,
      pinned: savedArtworks.find((a) => a.id === id)?.pinned ?? false,
      createdAt, updatedAt: now,
    });
    setArtworkId(id);
    setSaveMsg('Saved');
    setTimeout(() => setSaveMsg(null), 1500);
    refreshCollection();
    clearDraft().catch(() => {});
    if (cloudUser) cloudSync().catch(() => {});
  }, [artworkId, savedArtworks, title, caption, canvasImages, dims, orientation, bgColor, imageMargin, categories, refreshCollection, cloudUser, cloudSync]);

  const handleDeleteArtwork = useCallback(async (id: string) => {
    await deleteArtwork(id);
    setSavedArtworks((p) => p.filter((a) => a.id !== id));
  }, []);

  const togglePinArtwork = useCallback(async (aw: Artwork) => {
    const updated = { ...aw, pinned: !aw.pinned, updatedAt: aw.updatedAt };
    await saveArtwork(updated);
    refreshCollection();
  }, [refreshCollection]);

  // -----------------------------------------------------------------------
  // Templates
  // -----------------------------------------------------------------------

  const allTemplates = [...BUILT_IN_TEMPLATES, ...userTemplates];

  const applyTpl = useCallback((tpl: Template) => {
    commitSnapshot();
    const data = processedData.length > 0 ? processedData : canvasImages.map((i) => ({ dataUrl: i.dataUrl, naturalWidth: i.naturalWidth, naturalHeight: i.naturalHeight }));
    setCanvasImages(applyTemplate(tpl, data, dims.w, dims.h));
    setShowTemplates(false);
  }, [commitSnapshot, processedData, canvasImages, dims]);

  const saveAsTemplate = useCallback(async () => {
    const name = templateNameDraft.trim();
    if (!name) return;
    const tpl = artworkToTemplate(canvasImages, dims.w, dims.h, name);
    await saveTemplate(tpl);
    setUserTemplates((p) => [...p, tpl]);
    setTemplateNameDraft('');
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
  // Export helpers
  // -----------------------------------------------------------------------

  const downloadUrl = useCallback((url: string) => {
    const a = document.createElement('a');
    a.href = url;
    a.download = `${title.trim().replace(/\s+/g, '-').toLowerCase() || 'moodboard'}.png`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
  }, [title]);

  const printUrl = useCallback((url: string) => {
    const w = window.open('', '_blank');
    if (!w) return;
    w.document.write(
      `<!DOCTYPE html><html><head><title>${title || 'Moodboard'}</title><style>*{margin:0;padding:0;box-sizing:border-box}body{display:flex;justify-content:center;align-items:center;min-height:100vh;background:#fff}img{max-width:100%;max-height:100vh;object-fit:contain}@media print{body{min-height:auto}img{max-height:none;width:100%}}</style></head><body><img src="${url}"/><script>window.onload=function(){setTimeout(function(){window.print()},350)}<\/script></body></html>`,
    );
    w.document.close();
  }, [title]);

  const castToFarcaster = useCallback(async () => {
    let text = title.trim();
    if (caption.trim()) text += `\n\n${caption.trim()}`;
    try {
      await sdk.actions.composeCast({
        text,
        embeds: ['https://moodboard-generator-phi.vercel.app'],
      });
    } catch {
      window.open(`https://warpcast.com/~/compose?text=${encodeURIComponent(text)}`, '_blank');
    }
    clearDraft().catch(() => {});
  }, [title, caption]);

  const downloadAuto = useCallback(() => { if (moodboardUrl) downloadUrl(moodboardUrl); }, [moodboardUrl, downloadUrl]);
  const printAuto = useCallback(() => { if (moodboardUrl) printUrl(moodboardUrl); }, [moodboardUrl, printUrl]);

  const downloadManual = useCallback(async () => {
    const url = await renderManualMoodboard(canvasImages, title.trim(), caption.trim(), dims.w, dims.h, bgColor, imageMargin);
    downloadUrl(url);
    clearDraft().catch(() => {});
  }, [canvasImages, title, caption, dims, bgColor, imageMargin, downloadUrl]);

  const printManual = useCallback(async () => {
    const url = await renderManualMoodboard(canvasImages, title.trim(), caption.trim(), dims.w, dims.h, bgColor, imageMargin);
    printUrl(url);
  }, [canvasImages, title, caption, dims, bgColor, imageMargin, printUrl]);

  // -----------------------------------------------------------------------
  // Collection filtering & sorting
  // -----------------------------------------------------------------------

  const collectionCategories = useMemo(() => {
    const s = new Set<string>();
    savedArtworks.forEach((a) => (a.categories ?? []).forEach((c) => s.add(c)));
    return [...s].sort();
  }, [savedArtworks]);

  const filteredArtworks = useMemo(() => {
    let list = [...savedArtworks];

    if (colSearch) {
      const q = colSearch.toLowerCase();
      list = list.filter((a) =>
        a.title.toLowerCase().includes(q) ||
        a.caption.toLowerCase().includes(q) ||
        (a.categories ?? []).some((c) => c.toLowerCase().includes(q)),
      );
    }

    if (colCatFilter) {
      list = list.filter((a) => (a.categories ?? []).includes(colCatFilter));
    }

    const pinned = list.filter((a) => a.pinned);
    const unpinned = list.filter((a) => !a.pinned);

    const sortFn = (arr: Artwork[]) => {
      switch (colSort) {
        case 'newest': return arr.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
        case 'oldest': return arr.sort((a, b) => a.updatedAt.localeCompare(b.updatedAt));
        case 'title': return arr.sort((a, b) => a.title.localeCompare(b.title));
        case 'images': return arr.sort((a, b) => b.images.length - a.images.length);
      }
    };

    return [...sortFn(pinned), ...sortFn(unpinned)];
  }, [savedArtworks, colSearch, colSort, colCatFilter]);

  // =====================================================================
  // LIBRARY VIEW
  // =====================================================================

  if (view === 'library') {
    return (
      <ImageLibrary
        onBack={() => setView('create')}
        onAddToCanvas={addFromLibrary}
      />
    );
  }

  // =====================================================================
  // MANUAL VIEW
  // =====================================================================

  if (view === 'manual') {
    const orBtn = (o: Orientation, label: string) => (
      <button
        onClick={() => switchOrientation(o)}
        className={`flex h-8 items-center justify-center rounded px-2 text-[11px] transition-colors ${
          orientation === o ? 'bg-neutral-100 text-neutral-700' : 'text-neutral-400 hover:text-neutral-600'
        }`}
      >
        {label}
      </button>
    );

    const chipCls = (active: boolean) =>
      `rounded-full border px-2.5 py-1 text-[10px] transition-colors ${active ? 'border-neutral-500 bg-neutral-100 text-neutral-700' : 'border-neutral-200 text-neutral-400 hover:text-neutral-600'}`;

    return (
      <div className="flex min-h-[100dvh] flex-col bg-white">
        {/* Header */}
        <header className="flex items-center justify-between gap-2 px-4 py-2">
          <button onClick={() => setView('create')} className="flex min-h-[44px] min-w-[44px] items-center text-sm text-neutral-500 hover:text-neutral-700">
            ← Back
          </button>
          <div className="flex items-center gap-1">
            <button onClick={undo} disabled={undoStack.length === 0} className="flex h-10 w-10 items-center justify-center text-neutral-400 transition-colors hover:text-neutral-600 disabled:opacity-25" aria-label="Undo"><UndoIcon /></button>
            <button onClick={redo} disabled={redoStack.length === 0} className="flex h-10 w-10 items-center justify-center text-neutral-400 transition-colors hover:text-neutral-600 disabled:opacity-25" aria-label="Redo"><RedoIcon /></button>
          </div>
          <div className="flex items-center gap-2">
            {draftIndicator && <span className="text-[10px] text-neutral-400 animate-pulse">{draftIndicator}</span>}
            {saveMsg && <span className="text-xs text-green-600">{saveMsg}</span>}
            {cloudUser && syncStatus === 'syncing' && <span className="text-[10px] text-neutral-400 animate-pulse">Syncing</span>}
            <button onClick={saveToCollection} className="flex min-h-[44px] items-center rounded-full border border-neutral-300 px-3 text-[11px] text-neutral-600 hover:border-neutral-500">
              Save
            </button>
          </div>
        </header>

        {/* Toolbar */}
        <div className="scrollbar-hide flex items-center gap-2 overflow-x-auto px-4 pb-2">
          <div className="flex gap-0.5 rounded-md border border-neutral-200 p-0.5">
            {orBtn('portrait', 'A4 P')}
            {orBtn('landscape', 'A4 L')}
            {orBtn('square', '1 : 1')}
          </div>

          <div className="h-5 w-px bg-neutral-200" />

          <button onClick={() => setShowBgPicker((p) => !p)} className={`flex h-8 items-center gap-1.5 rounded px-2 text-[11px] transition-colors ${showBgPicker ? 'bg-neutral-100 text-neutral-700' : 'text-neutral-400 hover:text-neutral-600'}`}>
            <span className="inline-block h-3.5 w-3.5 rounded-full border border-neutral-300" style={{ backgroundColor: bgColor }} />
            BG
          </button>

          <button onClick={() => { commitSnapshot(); setImageMargin((p) => !p); }} className={`flex h-8 items-center gap-1 rounded px-2 text-[11px] transition-colors ${imageMargin ? 'bg-neutral-100 text-neutral-700' : 'text-neutral-400 hover:text-neutral-600'}`}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={imageMargin ? 2.5 : 1.5} strokeLinecap="round"><rect x="3" y="3" width="18" height="18" rx="2" /></svg>
            Margin
          </button>

          <div className="h-5 w-px bg-neutral-200" />

          <button onClick={() => setShowCatRow((p) => !p)} className={`flex h-8 items-center rounded px-2 text-[11px] transition-colors ${showCatRow ? 'bg-neutral-100 text-neutral-700' : 'text-neutral-400 hover:text-neutral-600'}`}>
            Tags
          </button>

          <button onClick={() => setShowTemplates(true)} className="flex h-8 items-center rounded px-2 text-[11px] text-neutral-400 hover:text-neutral-600">
            Templates
          </button>

          <button onClick={() => setView('library')} className="flex h-8 items-center rounded px-2 text-[11px] text-neutral-400 hover:text-neutral-600">
            Library
          </button>
        </div>

        {/* BG color picker (expandable) */}
        {showBgPicker && (
          <div className="flex flex-wrap items-center gap-2 px-4 pb-2">
            {BG_PRESETS.map((c) => (
              <button
                key={c}
                onClick={() => setBgColor(c)}
                className={`h-7 w-7 rounded-full border-2 transition-transform ${bgColor === c ? 'border-neutral-500 scale-110' : 'border-neutral-200 hover:scale-105'}`}
                style={{ backgroundColor: c }}
                aria-label={c}
              />
            ))}
            <div className="h-5 w-px bg-neutral-200" />
            {extractedColors.map((c) => (
              <button
                key={c}
                onClick={() => setBgColor(c)}
                className={`h-7 w-7 rounded-full border-2 transition-transform ${bgColor === c ? 'border-neutral-500 scale-110' : 'border-neutral-200 hover:scale-105'}`}
                style={{ backgroundColor: c }}
                aria-label={c}
              />
            ))}
            <button onClick={doExtract} className="text-[10px] text-neutral-400 hover:text-neutral-600 underline underline-offset-2">
              Extract
            </button>
          </div>
        )}

        {/* Category chips */}
        {showCatRow && (
          <div className="scrollbar-hide flex items-center gap-1.5 overflow-x-auto px-4 pb-2">
            {allCategories.map((cat) => (
              <button key={cat} onClick={() => toggleCategory(cat)} className={chipCls(categories.includes(cat))}>
                {cat}
              </button>
            ))}
            <div className="flex items-center gap-1">
              <input
                type="text"
                value={newCatDraft}
                onChange={(e) => setNewCatDraft(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') addCustomCategory(); }}
                placeholder="+"
                className="w-12 border-b border-neutral-200 bg-transparent text-center text-[10px] outline-none placeholder:text-neutral-300 focus:border-neutral-400"
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
        <ActionBar onDownload={downloadManual} onPrint={printManual} onCast={castToFarcaster} />

        {/* Template bottom sheet */}
        {showTemplates && (
          <div className="fixed inset-0 z-50 flex flex-col justify-end" onClick={() => setShowTemplates(false)}>
            <div className="flex-1 bg-black/15" />
            <div className="max-h-[65vh] overflow-y-auto rounded-t-xl bg-white px-4 pb-6 pt-3" onClick={(e) => e.stopPropagation()}>
              <div className="mx-auto mb-4 h-1 w-8 rounded-full bg-neutral-300" />
              <p className="mb-3 text-[11px] uppercase tracking-widest text-neutral-400">Templates</p>
              <div className="grid grid-cols-4 gap-3 sm:grid-cols-5">
                {allTemplates.map((tpl) => (
                  <div key={tpl.id} className="group relative">
                    <button onClick={() => applyTpl(tpl)} className="flex w-full flex-col items-center gap-1">
                      <img
                        src={`data:image/svg+xml;charset=utf-8,${encodeURIComponent(templatePreviewSvg(tpl.slots))}`}
                        alt={tpl.name}
                        className="w-full rounded border border-neutral-100"
                      />
                      <span className="text-[10px] text-neutral-500">{tpl.name}</span>
                    </button>
                    {!tpl.isBuiltIn && (
                      <button
                        onClick={(e) => { e.stopPropagation(); handleDeleteTemplate(tpl.id); }}
                        className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-white text-[9px] text-neutral-400 opacity-0 shadow-sm transition-opacity group-hover:opacity-100"
                        style={{ opacity: 1 }}
                        aria-label="Delete template"
                      >×</button>
                    )}
                  </div>
                ))}
              </div>

              <div className="mt-4 border-t border-neutral-100 pt-3">
                {savingTemplate ? (
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={templateNameDraft}
                      onChange={(e) => setTemplateNameDraft(e.target.value)}
                      placeholder="Template name"
                      maxLength={40}
                      className="flex-1 border-b border-neutral-300 bg-transparent pb-1 text-sm outline-none placeholder:text-neutral-400 focus:border-neutral-500"
                      autoFocus
                    />
                    <button onClick={saveAsTemplate} disabled={!templateNameDraft.trim()} className="text-xs text-neutral-600 hover:text-neutral-800 disabled:opacity-40">Save</button>
                    <button onClick={() => setSavingTemplate(false)} className="text-xs text-neutral-400">Cancel</button>
                  </div>
                ) : (
                  <button onClick={() => setSavingTemplate(true)} className="text-xs text-neutral-500 hover:text-neutral-700">
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

  if (view === 'auto-result' && moodboardUrl) {
    return (
      <div className="flex min-h-[100dvh] flex-col bg-white">
        <header className="flex items-center justify-between px-4 py-3">
          <button onClick={() => setView('create')} className="flex min-h-[44px] min-w-[44px] items-center text-sm text-neutral-500 hover:text-neutral-700">← Back</button>
          <button onClick={regenerate} disabled={isProcessing} className="flex min-h-[44px] min-w-[44px] items-center justify-center text-neutral-500 hover:text-neutral-700 disabled:opacity-40">
            {isProcessing ? <Spinner /> : <RefreshIcon />}
          </button>
        </header>
        <div className="flex flex-1 items-start justify-center px-4 pb-4">
          <img src={moodboardUrl} alt={title} className="w-full max-w-lg rounded-sm" />
        </div>
        <ActionBar onDownload={downloadAuto} onPrint={printAuto} onCast={castToFarcaster} />
      </div>
    );
  }

  // =====================================================================
  // CREATE VIEW
  // =====================================================================

  return (
    <div className="flex min-h-[100dvh] flex-col bg-white">
      <div className="mx-auto flex w-full max-w-lg flex-1 flex-col gap-5 px-5 py-6">

        {/* Draft recovery banner */}
        {pendingDraft && (
          <div className="flex items-center justify-between rounded-md border border-neutral-200 bg-neutral-50 px-4 py-3">
            <span className="text-sm text-neutral-600">Unsaved work found</span>
            <div className="flex gap-3">
              <button onClick={recoverDraft} className="text-sm font-medium text-neutral-700 hover:text-neutral-900">Recover</button>
              <button onClick={dismissDraft} className="text-sm text-neutral-400 hover:text-neutral-600">Dismiss</button>
            </div>
          </div>
        )}

        <div className="flex items-center justify-between">
          <p className="text-[11px] uppercase tracking-widest text-neutral-400">Moodboard</p>
          <div className="flex items-center gap-3">
            <button onClick={() => setView('library')} className="text-[11px] text-neutral-400 hover:text-neutral-600">
              Library
            </button>
            {cloudUser ? (
              <button
                onClick={() => cloudSync().catch(() => {})}
                disabled={syncStatus === 'syncing'}
                className="flex items-center gap-1.5 text-[11px] text-neutral-400 hover:text-neutral-600 disabled:opacity-40"
              >
                {cloudUser.pfpUrl && (
                  <img src={cloudUser.pfpUrl} alt="" className="h-4 w-4 rounded-full" />
                )}
                {syncStatus === 'syncing' ? (
                  <><Spinner /> Syncing</>
                ) : syncStatus === 'synced' ? (
                  <><CloudSyncedIcon /> Synced</>
                ) : syncStatus === 'error' ? (
                  <><CloudErrorIcon /> Retry</>
                ) : (
                  <><CloudIcon /> Sync</>
                )}
              </button>
            ) : (
              <button onClick={() => cloudSignIn().catch(() => {})} className="text-[11px] text-neutral-400 hover:text-neutral-600">
                Sign in
              </button>
            )}
          </div>
        </div>

        <input
          type="text" value={title} onChange={(e) => setTitle(e.target.value)}
          placeholder="Title" maxLength={80}
          className="w-full border-b border-neutral-300 bg-transparent pb-2 text-lg font-light text-neutral-800 outline-none transition-colors placeholder:text-neutral-400 focus:border-neutral-500"
        />

        <textarea
          value={caption} onChange={(e) => setCaption(e.target.value)}
          placeholder="Add a caption (optional)" maxLength={280} rows={2}
          className="w-full resize-none border-b border-neutral-300 bg-transparent pb-2 text-sm font-light text-neutral-600 outline-none transition-colors placeholder:text-neutral-400 focus:border-neutral-500"
        />

        <div>
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={files.length >= MAX_IMAGES}
            className="flex min-h-[88px] w-full flex-col items-center justify-center gap-2 rounded-sm border border-dashed border-neutral-300 py-8 text-neutral-400 hover:border-neutral-400 hover:text-neutral-500 disabled:cursor-not-allowed disabled:opacity-30"
          >
            <PlusIcon />
            <span className="text-xs">{files.length === 0 ? 'Add images' : 'Add more'}</span>
          </button>
          <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif" multiple onChange={handleFileChange} className="hidden" aria-label="Upload images" />
          {files.length > 0 && <p className="mt-1.5 text-right text-[11px] text-neutral-400">{files.length}/{MAX_IMAGES}</p>}
        </div>

        {files.length > 0 && (
          <div className="scrollbar-hide -mx-1 flex gap-2 overflow-x-auto px-1 pb-2">
            {previewUrls.map((url, i) => (
              <div key={url} className="relative h-[60px] w-[60px] flex-shrink-0">
                <img src={url} alt="" className="h-full w-full rounded-sm object-cover" />
                <button onClick={() => removeImage(i)} className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full border border-neutral-300 bg-white text-xs leading-none text-neutral-500 hover:text-neutral-700" aria-label="Remove image">×</button>
              </div>
            ))}
          </div>
        )}

        {files.length > 0 && files.length < MIN_IMAGES && (
          <p className="text-[11px] text-neutral-400">Add {MIN_IMAGES - files.length} more image{MIN_IMAGES - files.length > 1 ? 's' : ''}</p>
        )}

        {canGenerate && (
          <div className="flex gap-3">
            <button onClick={generate} disabled={isProcessing} className="flex min-h-[44px] flex-1 items-center justify-center rounded-sm border border-neutral-300 py-3 text-sm font-light text-neutral-600 hover:border-neutral-500 hover:text-neutral-800 disabled:opacity-50">
              {isProcessing ? <span className="flex items-center gap-2"><Spinner /> Processing…</span> : 'Generate'}
            </button>
            <button onClick={enterManualMode} disabled={isProcessing} className="flex min-h-[44px] flex-1 items-center justify-center rounded-sm border border-neutral-300 py-3 text-sm font-light text-neutral-600 hover:border-neutral-500 hover:text-neutral-800 disabled:opacity-50">
              Arrange
            </button>
          </div>
        )}

        {!title.trim() && files.length === 0 && savedArtworks.length === 0 && !pendingDraft && (
          <p className="pt-4 text-center text-[11px] text-neutral-400">Add title + {MIN_IMAGES}–{MAX_IMAGES} images</p>
        )}

        {/* ============================================================ */}
        {/* COLLECTION                                                    */}
        {/* ============================================================ */}

        {savedArtworks.length > 0 && (
          <div className="mt-2 border-t border-neutral-200 pt-4">
            <p className="mb-3 text-[11px] uppercase tracking-widest text-neutral-400">Collection</p>

            {/* Search */}
            <input
              type="text"
              value={colSearch}
              onChange={(e) => setColSearch(e.target.value)}
              placeholder="Search collection"
              className="mb-2 w-full border-b border-neutral-200 bg-transparent pb-1.5 text-sm outline-none placeholder:text-neutral-400 focus:border-neutral-400"
            />

            {/* Category filter + sort */}
            <div className="mb-2 flex items-center justify-between">
              <div className="scrollbar-hide flex gap-1 overflow-x-auto">
                <button
                  onClick={() => setColCatFilter(null)}
                  className={`whitespace-nowrap rounded-full border px-2 py-0.5 text-[10px] transition-colors ${colCatFilter === null ? 'border-neutral-500 bg-neutral-100 text-neutral-700' : 'border-neutral-200 text-neutral-400 hover:text-neutral-600'}`}
                >
                  All
                </button>
                {collectionCategories.map((cat) => (
                  <button
                    key={cat}
                    onClick={() => setColCatFilter(cat)}
                    className={`whitespace-nowrap rounded-full border px-2 py-0.5 text-[10px] transition-colors ${colCatFilter === cat ? 'border-neutral-500 bg-neutral-100 text-neutral-700' : 'border-neutral-200 text-neutral-400 hover:text-neutral-600'}`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
              <select
                value={colSort}
                onChange={(e) => setColSort(e.target.value as ColSort)}
                className="ml-2 flex-shrink-0 border-none bg-transparent text-[10px] text-neutral-500 outline-none"
                aria-label="Sort collection"
              >
                <option value="newest">Newest</option>
                <option value="oldest">Oldest</option>
                <option value="title">Title</option>
                <option value="images">Images</option>
              </select>
            </div>

            {/* Artwork list */}
            <div className="flex flex-col gap-1">
              {filteredArtworks.map((aw) => (
                <div key={aw.id} className="flex items-center gap-1 border-b border-neutral-100 py-2.5">
                  {/* Pin */}
                  <button
                    onClick={() => togglePinArtwork(aw)}
                    className={`flex h-10 w-8 flex-shrink-0 items-center justify-center ${aw.pinned ? 'text-neutral-500' : 'text-neutral-200 hover:text-neutral-400'}`}
                    aria-label={aw.pinned ? 'Unpin' : 'Pin'}
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill={aw.pinned ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.5">
                      <path d="M16 12V4h1V2H7v2h1v8l-2 2v2h5v6h2v-6h5v-2l-2-2z" />
                    </svg>
                  </button>

                  {/* Info */}
                  <button onClick={() => loadArtworkForEditing(aw)} className="min-h-[44px] flex-1 text-left">
                    <p className="text-sm text-neutral-700">{aw.title}</p>
                    <p className="text-[11px] text-neutral-400">
                      {aw.images.length} image{aw.images.length !== 1 ? 's' : ''} · {new Date(aw.updatedAt).toLocaleDateString()}
                    </p>
                    {(aw.categories ?? []).length > 0 && (
                      <div className="mt-0.5 flex flex-wrap gap-0.5">
                        {(aw.categories ?? []).map((c) => (
                          <span key={c} className="rounded-sm bg-neutral-100 px-1 text-[9px] text-neutral-500">{c}</span>
                        ))}
                      </div>
                    )}
                  </button>

                  {/* Actions */}
                  <button onClick={() => duplicateArtwork(aw)} className="flex h-10 w-10 items-center justify-center text-neutral-300 hover:text-neutral-500" aria-label="Duplicate">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="9" y="9" width="13" height="13" rx="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                    </svg>
                  </button>
                  <button onClick={() => handleDeleteArtwork(aw.id)} className="flex h-10 w-10 items-center justify-center text-neutral-300 hover:text-red-500" aria-label="Delete artwork">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                      <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                    </svg>
                  </button>
                </div>
              ))}

              {filteredArtworks.length === 0 && colSearch && (
                <p className="py-4 text-center text-[11px] text-neutral-400">No matching artworks</p>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
