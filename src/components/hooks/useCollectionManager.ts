import { useState, useCallback, useMemo, useEffect } from "react";
import {
  saveArtwork,
  loadArtworks,
  deleteArtwork,
  clearDraft,
  type Artwork,
  type CanvasImage,
  type Orientation,
} from "@/lib/storage";
import { renderThumbnail } from "@/lib/canvas";
import { renderThumbnailOffscreen } from "@/lib/canvas-offscreen";
import type { CloudUser } from "@/lib/cloud";

type ColSort = "newest" | "oldest" | "title" | "images";

interface CollectionDeps {
  syncStatus: string | null;
  cloudUser: CloudUser | null;
  cloudSync: (localOverride?: Artwork[]) => Promise<Artwork[]>;
}

interface ArtworkSetters {
  setTitle: (t: string) => void;
  setCaption: (c: string) => void;
  setCanvasImages: React.Dispatch<React.SetStateAction<CanvasImage[]>>;
  setProcessedData: React.Dispatch<
    React.SetStateAction<
      Array<{ dataUrl: string; naturalWidth: number; naturalHeight: number }>
    >
  >;
  setArtworkId: (id: string | null) => void;
  setOrientationState: (o: Orientation) => void;
  setBgColor: (c: string) => void;
  setImageMargin: (v: boolean) => void;
  setCategories: (c: string[]) => void;
  setView: (v: "create" | "auto-result" | "manual" | "library") => void;
  clearHistory: () => void;
  setExtractedColors: (c: string[]) => void;
}

interface SaveContext {
  artworkId: string | null;
  title: string;
  caption: string;
  canvasImages: CanvasImage[];
  dimsW: number;
  dimsH: number;
  orientation: Orientation;
  bgColor: string;
  imageMargin: boolean;
  categories: string[];
}

/**
 * Manages the saved-artworks collection: CRUD, search, sort, filter,
 * pin, duplicate, and loading an artwork for editing.
 */
export function useCollectionManager(
  deps: CollectionDeps,
  setters: ArtworkSetters,
  saveCtx: SaveContext,
) {
  const { syncStatus, cloudUser, cloudSync } = deps;

  const [savedArtworks, setSavedArtworks] = useState<Artwork[]>([]);
  const [colSearch, setColSearch] = useState("");
  const [colSort, setColSort] = useState<ColSort>("newest");
  const [colCatFilter, setColCatFilter] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [saveMsg, setSaveMsg] = useState<string | null>(null);

  // ---- Load on mount ----
  useEffect(() => {
    loadArtworks()
      .then((l) =>
        setSavedArtworks(
          l.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
        ),
      )
      .catch(() => {});
  }, []);

  const refreshCollection = useCallback(() => {
    loadArtworks()
      .then((l) =>
        setSavedArtworks(
          l.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
        ),
      )
      .catch(() => {});
  }, []);

  // Refresh after sync completes
  useEffect(() => {
    if (syncStatus === "synced") refreshCollection();
  }, [syncStatus, refreshCollection]);

  // ---- Save to collection ----
  const saveToCollection = useCallback(async () => {
    const {
      artworkId,
      title,
      caption,
      canvasImages,
      dimsW,
      dimsH,
      orientation,
      bgColor,
      imageMargin,
      categories,
    } = saveCtx;
    const now = new Date().toISOString();
    const id =
      artworkId ??
      `artwork-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    let createdAt = now;
    if (artworkId) {
      const ex = savedArtworks.find((a) => a.id === artworkId);
      if (ex) createdAt = ex.createdAt;
    }

    let thumbnail: string | undefined;
    try {
      thumbnail = await renderThumbnailOffscreen(
        canvasImages,
        dimsW,
        dimsH,
        bgColor,
        imageMargin,
        () => renderThumbnail(canvasImages, dimsW, dimsH, bgColor, imageMargin),
      );
    } catch {
      /* non-critical */
    }

    await saveArtwork({
      id,
      title: title.trim() || "Untitled",
      caption: caption.trim(),
      images: canvasImages,
      canvasWidth: dimsW,
      canvasHeight: dimsH,
      orientation,
      bgColor,
      imageMargin,
      categories,
      thumbnail,
      pinned: savedArtworks.find((a) => a.id === id)?.pinned ?? false,
      createdAt,
      updatedAt: now,
    });
    setters.setArtworkId(id);
    setSaveMsg("Saved");
    setTimeout(() => setSaveMsg(null), 1500);
    refreshCollection();
    clearDraft().catch(() => {});
    if (cloudUser)
      cloudSync()
        .then(() => refreshCollection())
        .catch(() => {});
  }, [
    saveCtx,
    savedArtworks,
    setters,
    refreshCollection,
    cloudUser,
    cloudSync,
  ]);

  // ---- Delete ----
  const confirmDeleteArtwork = useCallback((id: string) => {
    setDeleteConfirmId(id);
  }, []);

  const handleDeleteArtwork = useCallback(async (id: string) => {
    await deleteArtwork(id);
    setSavedArtworks((p) => p.filter((a) => a.id !== id));
    setDeleteConfirmId(null);
  }, []);

  // ---- Pin ----
  const togglePinArtwork = useCallback(
    async (aw: Artwork) => {
      const updated = { ...aw, pinned: !aw.pinned, updatedAt: aw.updatedAt };
      await saveArtwork(updated);
      refreshCollection();
    },
    [refreshCollection],
  );

  // ---- Load for editing ----
  const loadArtworkForEditing = useCallback(
    (aw: Artwork) => {
      setters.setTitle(aw.title);
      setters.setCaption(aw.caption);
      setters.setCanvasImages(aw.images);
      setters.setProcessedData(
        aw.images.map((i) => ({
          dataUrl: i.dataUrl,
          naturalWidth: i.naturalWidth,
          naturalHeight: i.naturalHeight,
        })),
      );
      setters.setArtworkId(aw.id);
      setters.setOrientationState(aw.orientation ?? "portrait");
      setters.setBgColor(aw.bgColor ?? "#f5f5f4");
      setters.setImageMargin(aw.imageMargin ?? false);
      setters.setCategories(aw.categories ?? []);
      setters.clearHistory();
      setters.setExtractedColors([]);
      setters.setView("manual");
    },
    [setters],
  );

  // ---- Duplicate ----
  const duplicateArtwork = useCallback(
    (aw: Artwork) => {
      setters.setTitle(`Copy of ${aw.title}`);
      setters.setCaption(aw.caption);
      setters.setCanvasImages(
        aw.images.map((i) => ({
          ...i,
          id: `img-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        })),
      );
      setters.setProcessedData(
        aw.images.map((i) => ({
          dataUrl: i.dataUrl,
          naturalWidth: i.naturalWidth,
          naturalHeight: i.naturalHeight,
        })),
      );
      setters.setArtworkId(null);
      setters.setOrientationState(aw.orientation ?? "portrait");
      setters.setBgColor(aw.bgColor ?? "#f5f5f4");
      setters.setImageMargin(aw.imageMargin ?? false);
      setters.setCategories(aw.categories ?? []);
      setters.clearHistory();
      setters.setView("manual");
    },
    [setters],
  );

  // ---- Derived (memoised) ----
  const collectionCategories = useMemo(() => {
    const s = new Set<string>();
    savedArtworks.forEach((a) => (a.categories ?? []).forEach((c) => s.add(c)));
    return [...s].sort();
  }, [savedArtworks]);

  const filteredArtworks = useMemo(() => {
    let list = [...savedArtworks];

    if (colSearch) {
      const q = colSearch.toLowerCase();
      list = list.filter(
        (a) =>
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
        case "newest":
          return arr.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
        case "oldest":
          return arr.sort((a, b) => a.updatedAt.localeCompare(b.updatedAt));
        case "title":
          return arr.sort((a, b) => a.title.localeCompare(b.title));
        case "images":
          return arr.sort((a, b) => b.images.length - a.images.length);
      }
    };

    return [...sortFn(pinned), ...sortFn(unpinned)];
  }, [savedArtworks, colSearch, colSort, colCatFilter]);

  return {
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
  };
}
