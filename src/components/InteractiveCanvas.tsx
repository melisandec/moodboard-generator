"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import type { CanvasImage, ImageStyle, CropSettings } from "@/lib/storage";
import { DEFAULT_IMAGE_STYLE } from "@/lib/storage";
import {
  getObjectUrl,
  reconcileObjectUrls,
  releaseAllObjectUrls,
} from "@/lib/object-url-cache";
import { snapToGuides, type GuideLine } from "@/lib/alignment";

interface Props {
  images: CanvasImage[];
  onChange: (images: CanvasImage[]) => void;
  onCommit?: () => void;
  canvasWidth: number;
  canvasHeight: number;
  bgColor?: string;
  imageMargin?: boolean;
}

function PinIndicator() {
  return (
    <div className="absolute right-1 top-1 rounded-full bg-white/80 dark:bg-neutral-800/80 p-[3px] shadow-sm">
      <svg
        width="10"
        height="10"
        viewBox="0 0 24 24"
        fill="currentColor"
        className="text-neutral-500 dark:text-neutral-400"
      >
        <path d="M16 12V4h1V2H7v2h1v8l-2 2v2h5v6h2v-6h5v-2l-2-2z" />
      </svg>
    </div>
  );
}

function Toggle({ on, onToggle }: { on: boolean; onToggle: () => void }) {
  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        onToggle();
      }}
      className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors ${on ? "bg-neutral-700 dark:bg-neutral-500" : "bg-neutral-300 dark:bg-neutral-600"}`}
      aria-label={on ? "Unpin" : "Pin"}
    >
      <span
        className={`inline-block h-3.5 w-3.5 rounded-full bg-white shadow-sm transition-transform ${on ? "translate-x-[18px]" : "translate-x-[3px]"}`}
      />
    </button>
  );
}

export default function InteractiveCanvas({
  images,
  onChange,
  onCommit,
  canvasWidth,
  canvasHeight,
  bgColor = "#f5f5f4",
  imageMargin = false,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [dragState, setDragState] = useState<{
    startX: number;
    startY: number;
    origPositions: Map<string, { x: number; y: number }>;
  } | null>(null);

  // Alignment guide lines (shown during drag)
  const [guides, setGuides] = useState<GuideLine[]>([]);

  // --- Crop mode ---
  const [cropId, setCropId] = useState<string | null>(null);
  const [cropDrag, setCropDrag] = useState<{
    startX: number;
    startY: number;
    origOffsetX: number;
    origOffsetY: number;
  } | null>(null);

  // --- Style panel ---
  const [styleId, setStyleId] = useState<string | null>(null);

  // Double-tap detection
  const lastTapRef = useRef<{ id: string; time: number } | null>(null);

  // Pinch-to-zoom refs
  const pinchRef = useRef<{
    initialDist: number;
    origSizes: Map<string, { w: number; h: number }>;
  } | null>(null);

  // Long-press multi-select refs
  const longPressRef = useRef<{
    timer: ReturnType<typeof setTimeout>;
    triggered: boolean;
  } | null>(null);
  const prevSelectedRef = useRef<Set<string>>(new Set());

  // Stable refs for touch handler closures (avoid stale state)
  const imagesRef = useRef(images);
  imagesRef.current = images;
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const onCommitRef = useRef(onCommit);
  onCommitRef.current = onCommit;

  const singleSelected =
    selectedIds.size === 1
      ? (images.find((i) => i.id === [...selectedIds][0]) ?? null)
      : null;

  const getScale = useCallback(() => {
    if (!containerRef.current) return 1;
    return containerRef.current.clientWidth / canvasWidth;
  }, [canvasWidth]);

  const updateOne = useCallback(
    (id: string, patch: Partial<CanvasImage>) => {
      onChange(
        images.map((img) => (img.id === id ? { ...img, ...patch } : img)),
      );
    },
    [images, onChange],
  );

  const bringToFront = useCallback(
    (id: string) => {
      const maxZ = Math.max(...images.map((i) => i.zIndex), 0);
      updateOne(id, { zIndex: maxZ + 1 });
    },
    [images, updateOne],
  );

  const remove = useCallback(
    (id: string) => {
      onCommit?.();
      onChange(images.filter((i) => i.id !== id));
      setSelectedIds((prev) => {
        const n = new Set(prev);
        n.delete(id);
        return n;
      });
    },
    [images, onChange, onCommit],
  );

  const togglePin = useCallback(
    (id: string) => {
      onCommit?.();
      const img = images.find((i) => i.id === id);
      if (img) updateOne(id, { pinned: !img.pinned });
    },
    [images, onCommit, updateOne],
  );

  const resize = useCallback(
    (id: string, factor: number) => {
      const img = images.find((i) => i.id === id);
      if (!img || img.pinned) return;
      onCommit?.();
      const aspect = img.naturalWidth / img.naturalHeight;
      const newW = Math.max(
        30,
        Math.min(canvasWidth * 0.95, img.width * factor),
      );
      updateOne(id, { width: newW, height: newW / aspect });
    },
    [images, canvasWidth, onCommit, updateOne],
  );

  const rotate = useCallback(
    (id: string, angle: number) => {
      const img = images.find((i) => i.id === id);
      if (!img || img.pinned) return;
      onCommit?.();
      updateOne(id, { rotation: ((img.rotation || 0) + angle + 360) % 360 });
    },
    [images, onCommit, updateOne],
  );

  // ---- Crop helpers ----

  const updateCrop = useCallback(
    (id: string, patch: Partial<CropSettings>) => {
      const img = images.find((i) => i.id === id);
      if (!img) return;
      const prev: CropSettings = img.crop ?? { offsetX: 0, offsetY: 0, zoom: 1 };
      updateOne(id, { crop: { ...prev, ...patch } });
    },
    [images, updateOne],
  );

  const updateStyle = useCallback(
    (id: string, patch: Partial<ImageStyle>) => {
      const img = images.find((i) => i.id === id);
      if (!img) return;
      onCommit?.();
      const prev = img.style ?? {};
      updateOne(id, { style: { ...prev, ...patch } });
    },
    [images, onCommit, updateOne],
  );

  const enterCropMode = useCallback(
    (id: string) => {
      onCommit?.();
      setCropId(id);
      setSelectedIds(new Set([id]));
      setStyleId(null);
    },
    [onCommit],
  );

  const exitCropMode = useCallback(() => {
    setCropId(null);
    setCropDrag(null);
  }, []);

  // ---- Batch operations ----

  const batchDelete = useCallback(() => {
    onCommit?.();
    onChange(images.filter((i) => !selectedIds.has(i.id)));
    setSelectedIds(new Set());
  }, [images, onChange, onCommit, selectedIds]);

  const batchPin = useCallback(
    (pin: boolean) => {
      onCommit?.();
      onChange(
        images.map((i) => (selectedIds.has(i.id) ? { ...i, pinned: pin } : i)),
      );
    },
    [images, onChange, onCommit, selectedIds],
  );

  const batchResize = useCallback(
    (factor: number) => {
      onCommit?.();
      onChange(
        images.map((i) => {
          if (!selectedIds.has(i.id) || i.pinned) return i;
          const aspect = i.naturalWidth / i.naturalHeight;
          const newW = Math.max(
            30,
            Math.min(canvasWidth * 0.95, i.width * factor),
          );
          return { ...i, width: newW, height: newW / aspect };
        }),
      );
    },
    [images, canvasWidth, onChange, onCommit, selectedIds],
  );

  const batchRotate = useCallback(
    (angle: number) => {
      onCommit?.();
      onChange(
        images.map((i) => {
          if (!selectedIds.has(i.id) || i.pinned) return i;
          return {
            ...i,
            rotation: ((i.rotation || 0) + angle + 360) % 360,
          };
        }),
      );
    },
    [images, onChange, onCommit, selectedIds],
  );

  // ---- Drag handling (multi-select aware) ----

  useEffect(() => {
    if (!dragState) return;
    const moveThreshold = 5;
    let movedBeyond = false;

    const onMove = (e: PointerEvent) => {
      e.preventDefault();
      if (!movedBeyond) {
        const mx = Math.abs(e.clientX - dragState.startX);
        const my = Math.abs(e.clientY - dragState.startY);
        if (mx > moveThreshold || my > moveThreshold) {
          movedBeyond = true;
          if (longPressRef.current && !longPressRef.current.triggered) {
            clearTimeout(longPressRef.current.timer);
            longPressRef.current = null;
          }
        } else {
          return;
        }
      }
      const s = getScale();
      const dx = (e.clientX - dragState.startX) / s;
      const dy = (e.clientY - dragState.startY) / s;

      // Single-image drag → apply snap-to-guide logic
      const draggedIds = [...dragState.origPositions.keys()];
      const isSingleDrag = draggedIds.length === 1;

      if (isSingleDrag) {
        const id = draggedIds[0];
        const orig = dragState.origPositions.get(id)!;
        const img = images.find((i) => i.id === id);
        if (img) {
          const rawX = orig.x + dx;
          const rawY = orig.y + dy;
          const otherImages = images.filter((i) => i.id !== id);
          const snap = snapToGuides(
            { x: rawX, y: rawY, width: img.width, height: img.height },
            otherImages,
            canvasWidth,
            canvasHeight,
          );
          setGuides(snap.guides);
          onChange(
            images.map((i) =>
              i.id === id ? { ...i, x: snap.x, y: snap.y } : i,
            ),
          );
          return;
        }
      }

      // Multi-image drag – no snapping, just move
      setGuides([]);
      onChange(
        images.map((img) => {
          const orig = dragState.origPositions.get(img.id);
          if (!orig) return img;
          return { ...img, x: orig.x + dx, y: orig.y + dy };
        }),
      );
    };

    const onUp = () => {
      if (longPressRef.current) {
        clearTimeout(longPressRef.current.timer);
        longPressRef.current = null;
      }
      setGuides([]);
      setDragState(null);
    };

    window.addEventListener("pointermove", onMove, { passive: false });
    window.addEventListener("pointerup", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
  }, [dragState, getScale, images, onChange, canvasWidth, canvasHeight]);

  // ---- Crop-mode pan drag ----

  useEffect(() => {
    if (!cropDrag || !cropId) return;
    const onMove = (e: PointerEvent) => {
      e.preventDefault();
      const img = images.find((i) => i.id === cropId);
      if (!img) return;
      const s = getScale();
      const dx = (e.clientX - cropDrag.startX) / s;
      const dy = (e.clientY - cropDrag.startY) / s;
      const zoom = img.crop?.zoom ?? 1;
      // Convert px delta to normalised offset (fraction of image dimension)
      const newOffsetX = clampOffset(cropDrag.origOffsetX + dx / (img.width * zoom));
      const newOffsetY = clampOffset(cropDrag.origOffsetY + dy / (img.height * zoom));
      updateCrop(cropId, { offsetX: newOffsetX, offsetY: newOffsetY });
    };
    const onUp = () => setCropDrag(null);
    window.addEventListener("pointermove", onMove, { passive: false });
    window.addEventListener("pointerup", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
  }, [cropDrag, cropId, images, getScale, updateCrop]);

  // ---- Pointer down (multi-select + long-press) ----

  const handlePointerDown = useCallback(
    (e: React.PointerEvent, id: string) => {
      e.preventDefault();
      e.stopPropagation();
      const img = images.find((i) => i.id === id);
      if (!img) return;

      // ---- Double-tap detection → enter crop mode ----
      const now = Date.now();
      if (
        lastTapRef.current &&
        lastTapRef.current.id === id &&
        now - lastTapRef.current.time < 350
      ) {
        lastTapRef.current = null;
        enterCropMode(id);
        return;
      }
      lastTapRef.current = { id, time: now };

      // ---- If in crop mode, start crop-pan drag ----
      if (cropId === id) {
        const crop = img.crop ?? { offsetX: 0, offsetY: 0, zoom: 1 };
        setCropDrag({
          startX: e.clientX,
          startY: e.clientY,
          origOffsetX: crop.offsetX,
          origOffsetY: crop.offsetY,
        });
        return;
      }

      // Exit crop mode if tapping another image
      if (cropId && cropId !== id) exitCropMode();

      const additive = e.shiftKey || e.metaKey;

      if (additive) {
        setSelectedIds((prev) => {
          const next = new Set(prev);
          if (next.has(id)) next.delete(id);
          else next.add(id);
          return next;
        });
        return;
      }

      const isInMultiSelection = selectedIds.has(id) && selectedIds.size > 1;

      if (!isInMultiSelection) {
        prevSelectedRef.current = new Set(selectedIds);
        setSelectedIds(new Set([id]));

        if (longPressRef.current) clearTimeout(longPressRef.current.timer);
        longPressRef.current = {
          timer: setTimeout(() => {
            if (longPressRef.current && !longPressRef.current.triggered) {
              longPressRef.current.triggered = true;
              setSelectedIds(() => {
                const merged = new Set(prevSelectedRef.current);
                merged.add(id);
                return merged;
              });
              setDragState(null);
              if (navigator.vibrate) navigator.vibrate(50);
            }
          }, 400),
          triggered: false,
        };
      }

      if (!img.pinned) {
        onCommit?.();
        bringToFront(id);
        const origPositions = new Map<string, { x: number; y: number }>();

        if (isInMultiSelection) {
          for (const sid of selectedIds) {
            const simg = images.find((i) => i.id === sid);
            if (simg && !simg.pinned)
              origPositions.set(sid, { x: simg.x, y: simg.y });
          }
        } else {
          origPositions.set(id, { x: img.x, y: img.y });
        }

        setDragState({
          startX: e.clientX,
          startY: e.clientY,
          origPositions,
        });
      }
    },
    [images, bringToFront, onCommit, selectedIds, cropId, enterCropMode, exitCropMode],
  );

  // ---- Pinch-to-zoom gesture ----

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length !== 2) return;
      const imgs = imagesRef.current;
      const sel = selectedIds;
      if (sel.size === 0) return;

      const dist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY,
      );

      const origSizes = new Map<string, { w: number; h: number }>();
      for (const id of sel) {
        const img = imgs.find((i) => i.id === id);
        if (img && !img.pinned)
          origSizes.set(id, { w: img.width, h: img.height });
      }
      if (origSizes.size === 0) return;

      pinchRef.current = { initialDist: dist, origSizes };
      setDragState(null);
      if (longPressRef.current) {
        clearTimeout(longPressRef.current.timer);
        longPressRef.current = null;
      }
    };

    const onTouchMove = (e: TouchEvent) => {
      if (e.touches.length !== 2 || !pinchRef.current) return;
      e.preventDefault();
      const dist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY,
      );
      const ratio = dist / pinchRef.current.initialDist;
      const imgs = imagesRef.current;
      const { origSizes } = pinchRef.current;

      onChangeRef.current(
        imgs.map((img) => {
          const orig = origSizes.get(img.id);
          if (!orig) return img;
          const aspect = img.naturalWidth / img.naturalHeight;
          const newW = Math.max(
            30,
            Math.min(canvasWidth * 0.95, orig.w * ratio),
          );
          return { ...img, width: newW, height: newW / aspect };
        }),
      );
    };

    const onTouchEnd = () => {
      if (pinchRef.current) {
        onCommitRef.current?.();
        pinchRef.current = null;
      }
    };

    el.addEventListener("touchstart", onTouchStart, { passive: true });
    el.addEventListener("touchmove", onTouchMove, { passive: false });
    el.addEventListener("touchend", onTouchEnd, { passive: true });

    return () => {
      el.removeEventListener("touchstart", onTouchStart);
      el.removeEventListener("touchmove", onTouchMove);
      el.removeEventListener("touchend", onTouchEnd);
    };
  }, [selectedIds, canvasWidth]);

  // ---- Keyboard shortcuts (Delete/Backspace, Escape) ----

  useEffect(() => {
    if (selectedIds.size === 0 && !cropId) return;
    const handler = (e: KeyboardEvent) => {
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      )
        return;
      if (e.key === "Escape") {
        if (cropId) { exitCropMode(); return; }
        if (styleId) { setStyleId(null); return; }
        setSelectedIds(new Set());
      } else if (e.key === "Delete" || e.key === "Backspace") {
        e.preventDefault();
        if (selectedIds.size > 1) batchDelete();
        else remove([...selectedIds][0]);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [selectedIds, batchDelete, remove, cropId, exitCropMode, styleId]);

  // Reconcile Object URL cache
  useEffect(() => {
    const activeIds = new Set(images.map((i) => i.id));
    reconcileObjectUrls(activeIds);
    return () => {
      releaseAllObjectUrls();
    };
  }, [images]);

  // Clean up selections when images are removed externally
  useEffect(() => {
    const ids = new Set(images.map((i) => i.id));
    setSelectedIds((prev) => {
      const cleaned = new Set([...prev].filter((id) => ids.has(id)));
      return cleaned.size !== prev.size ? cleaned : prev;
    });
  }, [images]);

  const sorted = [...images].sort((a, b) => a.zIndex - b.zIndex);
  const marginPx = imageMargin ? 3 : 0;
  const topZ =
    images.length > 0 ? Math.max(...images.map((i) => i.zIndex)) + 10 : 10;

  const selectedImages = images.filter((i) => selectedIds.has(i.id));
  const allSelectedPinned =
    selectedImages.length > 0 && selectedImages.every((i) => i.pinned);
  const anySelectedPinned = selectedImages.some((i) => i.pinned);

  const tbBtn =
    "flex h-7 w-7 items-center justify-center rounded-full text-neutral-500 transition-colors hover:bg-neutral-100 dark:hover:bg-neutral-700 hover:text-neutral-700 dark:hover:text-neutral-300 disabled:opacity-30";

  return (
    <div
      ref={containerRef}
      className="relative w-full touch-none overflow-visible rounded-sm"
      style={{
        aspectRatio: `${canvasWidth} / ${canvasHeight}`,
        backgroundColor: bgColor,
      }}
      onPointerDown={(e) => {
        if (e.target === containerRef.current) {
          setSelectedIds(new Set());
          if (cropId) exitCropMode();
          if (styleId) setStyleId(null);
        }
      }}
    >
      {sorted.map((img) => {
        const s = img.style ?? {};
        const m = { ...DEFAULT_IMAGE_STYLE, ...s };
        const crop = img.crop ?? { offsetX: 0, offsetY: 0, zoom: 1 };
        const borderR =
          (m.borderRadius / 100) *
          Math.min(img.width, img.height) /
          2;
        const isCropping = cropId === img.id;
        const hasShadow = m.shadowBlur > 0 || m.shadowOffsetX !== 0 || m.shadowOffsetY !== 0;

        // Build box shadow: margin border + per-image drop shadow
        const shadows: string[] = [];
        if (marginPx > 0) shadows.push(`0 0 0 ${marginPx}px white`);
        if (hasShadow) shadows.push(`${m.shadowOffsetX}px ${m.shadowOffsetY}px ${m.shadowBlur}px ${m.shadowColor}`);
        const boxShadow = shadows.length > 0 ? shadows.join(", ") : "none";

        return (
          <div
            key={img.id}
            className={`absolute select-none ${
              isCropping
                ? "cursor-move ring-2 ring-amber-400 ring-offset-1"
                : img.pinned
                  ? "cursor-default"
                  : "cursor-grab active:cursor-grabbing"
            } ${!isCropping && selectedIds.has(img.id) ? "ring-2 ring-blue-400/50 ring-offset-1" : ""}`}
            style={{
              left: `${(img.x / canvasWidth) * 100}%`,
              top: `${(img.y / canvasHeight) * 100}%`,
              width: `${(img.width / canvasWidth) * 100}%`,
              height: `${(img.height / canvasHeight) * 100}%`,
              zIndex: img.zIndex,
              transform: `rotate(${img.rotation}deg)`,
              borderRadius: borderR > 0 ? `${(borderR / img.width) * 100}% / ${(borderR / img.height) * 100}%` : undefined,
              border: m.borderWidth > 0 ? `${m.borderWidth}px solid ${m.borderColor}` : undefined,
              boxShadow,
              opacity: m.opacity,
              overflow: "hidden",
            }}
            onPointerDown={(e) => handlePointerDown(e, img.id)}
          >
            <img
              src={getObjectUrl(img.id, img.dataUrl)}
              alt=""
              className="pointer-events-none"
              draggable={false}
              style={{
                width: `${crop.zoom * 100}%`,
                height: `${crop.zoom * 100}%`,
                objectFit: "cover",
                transform: `translate(${crop.offsetX * 100}%, ${crop.offsetY * 100}%)`,
                marginLeft: `${-((crop.zoom - 1) / 2) * 100}%`,
                marginTop: `${-((crop.zoom - 1) / 2) * 100}%`,
              }}
            />
            {img.pinned && !selectedIds.has(img.id) && !isCropping && <PinIndicator />}
            {selectedIds.size > 1 && selectedIds.has(img.id) && (
            <div className="absolute left-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-blue-500 shadow-sm">
              <svg
                width="10"
                height="10"
                viewBox="0 0 24 24"
                fill="none"
                stroke="white"
                strokeWidth="3"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M5 12l5 5L20 7" />
              </svg>
            </div>
          )}
        </div>
        );
      })}

      {/* Crop mode toolbar */}
      {cropId && (() => {
        const cropImg = images.find((i) => i.id === cropId);
        if (!cropImg) return null;
        const crop = cropImg.crop ?? { offsetX: 0, offsetY: 0, zoom: 1 };
        return (
          <div
            className="pointer-events-none absolute bottom-0 left-0 right-0"
            style={{ zIndex: topZ + 2 }}
          >
            <div
              className="pointer-events-auto mx-auto mb-2 flex w-fit items-center gap-2 rounded-xl bg-white dark:bg-neutral-800 px-3 py-2 shadow-lg"
              onPointerDown={(e) => e.stopPropagation()}
            >
              <span className="text-[10px] font-medium text-amber-600 dark:text-amber-400">Crop</span>
              <div className="h-4 w-px bg-neutral-200 dark:bg-neutral-600" />
              {/* Zoom slider */}
              <label className="flex items-center gap-1.5 text-[10px] text-neutral-500 dark:text-neutral-400">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/><line x1="11" y1="8" x2="11" y2="14"/><line x1="8" y1="11" x2="14" y2="11"/></svg>
                <input
                  type="range"
                  min="1"
                  max="3"
                  step="0.05"
                  value={crop.zoom}
                  onChange={(e) => updateCrop(cropId, { zoom: parseFloat(e.target.value) })}
                  className="h-1 w-16 cursor-pointer accent-amber-500"
                />
                <span className="w-7 text-right">{crop.zoom.toFixed(1)}×</span>
              </label>
              <div className="h-4 w-px bg-neutral-200 dark:bg-neutral-600" />
              {/* Reset */}
              <button
                onClick={() => updateCrop(cropId, { offsetX: 0, offsetY: 0, zoom: 1 })}
                className="text-[10px] text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300"
              >
                Reset
              </button>
              <div className="h-4 w-px bg-neutral-200 dark:bg-neutral-600" />
              {/* Done */}
              <button
                onClick={exitCropMode}
                className="rounded-full bg-amber-500 px-2.5 py-0.5 text-[10px] font-medium text-white hover:bg-amber-600"
              >
                Done
              </button>
            </div>
          </div>
        );
      })()}

      {/* Alignment guide lines overlay */}
      {guides.length > 0 && (
        <svg
          className="pointer-events-none absolute inset-0 h-full w-full"
          viewBox={`0 0 ${canvasWidth} ${canvasHeight}`}
          preserveAspectRatio="none"
          style={{ zIndex: topZ - 1 }}
        >
          {guides.map((g, i) =>
            g.orientation === "vertical" ? (
              <line
                key={`g-${i}`}
                x1={g.position}
                y1={g.start}
                x2={g.position}
                y2={g.end}
                stroke="#3b82f6"
                strokeWidth="1.5"
                strokeDasharray="6 3"
                opacity="0.7"
              />
            ) : (
              <line
                key={`g-${i}`}
                x1={g.start}
                y1={g.position}
                x2={g.end}
                y2={g.position}
                stroke="#3b82f6"
                strokeWidth="1.5"
                strokeDasharray="6 3"
                opacity="0.7"
              />
            ),
          )}
        </svg>
      )}

      {/* Single-select floating toolbar */}
      {singleSelected &&
        (() => {
          const nearTop = singleSelected.y / canvasHeight < 0.1;
          return (
            <div
              className="pointer-events-none absolute"
              style={{
                left: `${(singleSelected.x / canvasWidth) * 100}%`,
                top: nearTop
                  ? `${((singleSelected.y + singleSelected.height) / canvasHeight) * 100}%`
                  : `${(singleSelected.y / canvasHeight) * 100}%`,
                width: `${(singleSelected.width / canvasWidth) * 100}%`,
                zIndex: topZ,
              }}
            >
              <div
                className={`pointer-events-auto absolute left-1/2 flex -translate-x-1/2 items-center gap-1.5 rounded-full bg-white dark:bg-neutral-800 px-2 py-1 shadow-md ${
                  nearTop ? "top-full mt-1.5" : "bottom-full mb-1.5"
                }`}
                onPointerDown={(e) => e.stopPropagation()}
              >
                {/* Resize smaller */}
                <button
                  onClick={() => resize(singleSelected.id, 0.85)}
                  disabled={singleSelected.pinned}
                  className={tbBtn}
                  aria-label="Smaller"
                >
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                  >
                    <line x1="5" y1="12" x2="19" y2="12" />
                  </svg>
                </button>

                {/* Resize larger */}
                <button
                  onClick={() => resize(singleSelected.id, 1.18)}
                  disabled={singleSelected.pinned}
                  className={tbBtn}
                  aria-label="Larger"
                >
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                  >
                    <line x1="12" y1="5" x2="12" y2="19" />
                    <line x1="5" y1="12" x2="19" y2="12" />
                  </svg>
                </button>

                <div className="h-4 w-px bg-neutral-200 dark:bg-neutral-600" />

                {/* Rotate left */}
                <button
                  onClick={() => rotate(singleSelected.id, -15)}
                  disabled={singleSelected.pinned}
                  className={tbBtn}
                  aria-label="Rotate left"
                >
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M1 4v6h6" />
                    <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" />
                  </svg>
                </button>

                {/* Rotate right */}
                <button
                  onClick={() => rotate(singleSelected.id, 15)}
                  disabled={singleSelected.pinned}
                  className={tbBtn}
                  aria-label="Rotate right"
                >
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M23 4v6h-6" />
                    <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
                  </svg>
                </button>

                <div className="h-4 w-px bg-neutral-200 dark:bg-neutral-600" />

                {/* Pin toggle */}
                <span className="text-[10px] text-neutral-500 dark:text-neutral-400">
                  {singleSelected.pinned ? "unpin" : "pin"}
                </span>
                <Toggle
                  on={singleSelected.pinned}
                  onToggle={() => togglePin(singleSelected.id)}
                />

                <div className="h-4 w-px bg-neutral-200 dark:bg-neutral-600" />

                {/* Crop */}
                <button
                  onClick={() => enterCropMode(singleSelected.id)}
                  className={tbBtn}
                  aria-label="Crop"
                  title="Double-tap image to crop"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                    <path d="M6 2v4H2M18 22v-4h4M2 6h16a2 2 0 0 1 2 2v8M22 18H6a2 2 0 0 1-2-2V8" />
                  </svg>
                </button>

                {/* Style */}
                <button
                  onClick={() => setStyleId(styleId === singleSelected.id ? null : singleSelected.id)}
                  className={`${tbBtn} ${styleId === singleSelected.id ? "!bg-neutral-100 dark:!bg-neutral-700 !text-neutral-700 dark:!text-neutral-200" : ""}`}
                  aria-label="Style"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="3" />
                    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
                  </svg>
                </button>

                <div className="h-4 w-px bg-neutral-200 dark:bg-neutral-600" />

                {/* Delete */}
                <button
                  onClick={() => remove(singleSelected.id)}
                  className="flex h-7 w-7 items-center justify-center rounded-full text-neutral-400 transition-colors hover:bg-red-50 dark:hover:bg-red-900/30 hover:text-red-500 dark:hover:text-red-400"
                  aria-label="Remove"
                >
                  <svg
                    width="12"
                    height="12"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                  >
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
              </div>
            </div>
          );
        })()}

      {/* Per-image style panel */}
      {styleId && singleSelected && styleId === singleSelected.id && (() => {
        const st = { ...DEFAULT_IMAGE_STYLE, ...singleSelected.style };
        const sliderCls = "h-1 w-full cursor-pointer accent-blue-500";
        const labelCls = "text-[10px] text-neutral-500 dark:text-neutral-400";
        const valCls = "text-[10px] text-neutral-600 dark:text-neutral-300 w-8 text-right tabular-nums";
        return (
          <div
            className="pointer-events-none absolute left-0 right-0"
            style={{
              zIndex: topZ + 3,
              top: `${((singleSelected.y + singleSelected.height) / canvasHeight) * 100}%`,
            }}
          >
            <div
              className="pointer-events-auto mx-auto mt-12 w-64 rounded-xl bg-white dark:bg-neutral-800 p-3 shadow-lg"
              onPointerDown={(e) => e.stopPropagation()}
            >
              <div className="mb-2 flex items-center justify-between">
                <span className="text-[11px] font-medium text-neutral-600 dark:text-neutral-300">Image Style</span>
                <button onClick={() => setStyleId(null)} className="text-[10px] text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300">✕</button>
              </div>

              {/* Border Radius */}
              <div className="mb-2">
                <div className="mb-1 flex items-center justify-between">
                  <span className={labelCls}>Roundness</span>
                  <span className={valCls}>{st.borderRadius}%</span>
                </div>
                <div className="flex items-center gap-2">
                  <input type="range" min="0" max="50" step="1" value={st.borderRadius} onChange={(e) => updateStyle(singleSelected.id, { borderRadius: parseInt(e.target.value) })} className={sliderCls} aria-label="Border radius" />
                  <div className="flex gap-1">
                    {[0, 8, 50].map((v) => (
                      <button key={v} onClick={() => updateStyle(singleSelected.id, { borderRadius: v })} className={`h-5 w-5 rounded border text-[8px] ${st.borderRadius === v ? "border-blue-400 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400" : "border-neutral-200 dark:border-neutral-600 text-neutral-400"}`}>
                        {v === 0 ? "▢" : v === 8 ? "▣" : "●"}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Border */}
              <div className="mb-2">
                <div className="mb-1 flex items-center justify-between">
                  <span className={labelCls}>Border</span>
                  <span className={valCls}>{st.borderWidth}px</span>
                </div>
                <div className="flex items-center gap-2">
                  <input type="range" min="0" max="8" step="1" value={st.borderWidth} onChange={(e) => updateStyle(singleSelected.id, { borderWidth: parseInt(e.target.value) })} className={sliderCls} aria-label="Border width" />
                  <input type="color" value={st.borderColor} onChange={(e) => updateStyle(singleSelected.id, { borderColor: e.target.value })} className="h-5 w-5 cursor-pointer rounded border border-neutral-200 dark:border-neutral-600" aria-label="Border color" />
                </div>
              </div>

              {/* Shadow */}
              <div className="mb-2">
                <div className="mb-1 flex items-center justify-between">
                  <span className={labelCls}>Shadow</span>
                  <span className={valCls}>{st.shadowBlur}px</span>
                </div>
                <input type="range" min="0" max="30" step="1" value={st.shadowBlur} onChange={(e) => updateStyle(singleSelected.id, { shadowBlur: parseInt(e.target.value) })} className={sliderCls} aria-label="Shadow blur" />
              </div>

              {/* Opacity */}
              <div className="mb-1">
                <div className="mb-1 flex items-center justify-between">
                  <span className={labelCls}>Opacity</span>
                  <span className={valCls}>{Math.round(st.opacity * 100)}%</span>
                </div>
                <input type="range" min="0.1" max="1" step="0.05" value={st.opacity} onChange={(e) => updateStyle(singleSelected.id, { opacity: parseFloat(e.target.value) })} className={sliderCls} aria-label="Opacity" />
              </div>

              {/* Reset */}
              <button
                onClick={() => updateStyle(singleSelected.id, DEFAULT_IMAGE_STYLE)}
                className="mt-1 text-[10px] text-neutral-400 underline underline-offset-2 hover:text-neutral-600 dark:hover:text-neutral-300"
              >
                Reset to default
              </button>
            </div>
          </div>
        );
      })()}

      {/* Multi-select batch toolbar */}
      {selectedIds.size > 1 && (
        <div
          className="pointer-events-none absolute bottom-0 left-0 right-0"
          style={{ zIndex: topZ + 1 }}
        >
          <div
            className="pointer-events-auto mx-auto mb-2 flex w-fit items-center gap-1.5 rounded-full bg-white dark:bg-neutral-800 px-3 py-1.5 shadow-lg"
            onPointerDown={(e) => e.stopPropagation()}
          >
            <span className="mr-1 text-[10px] font-medium text-neutral-500 dark:text-neutral-400">
              {selectedIds.size} selected
            </span>

            <div className="h-4 w-px bg-neutral-200 dark:bg-neutral-600" />

            {/* Batch resize */}
            <button
              onClick={() => batchResize(0.85)}
              className={tbBtn}
              aria-label="Shrink all"
            >
              <svg
                width="12"
                height="12"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              >
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
            </button>
            <button
              onClick={() => batchResize(1.18)}
              className={tbBtn}
              aria-label="Grow all"
            >
              <svg
                width="12"
                height="12"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              >
                <line x1="12" y1="5" x2="12" y2="19" />
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
            </button>

            <div className="h-4 w-px bg-neutral-200 dark:bg-neutral-600" />

            {/* Batch rotate */}
            <button
              onClick={() => batchRotate(-15)}
              className={tbBtn}
              aria-label="Rotate all left"
            >
              <svg
                width="12"
                height="12"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M1 4v6h6" />
                <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" />
              </svg>
            </button>
            <button
              onClick={() => batchRotate(15)}
              className={tbBtn}
              aria-label="Rotate all right"
            >
              <svg
                width="12"
                height="12"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M23 4v6h-6" />
                <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
              </svg>
            </button>

            <div className="h-4 w-px bg-neutral-200 dark:bg-neutral-600" />

            {/* Batch pin */}
            <button
              onClick={() => batchPin(!allSelectedPinned)}
              className="flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] text-neutral-500 dark:text-neutral-400 transition-colors hover:bg-neutral-100 dark:hover:bg-neutral-700"
            >
              <svg
                width="10"
                height="10"
                viewBox="0 0 24 24"
                fill={anySelectedPinned ? "currentColor" : "none"}
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M16 12V4h1V2H7v2h1v8l-2 2v2h5v6h2v-6h5v-2l-2-2z" />
              </svg>
              {allSelectedPinned ? "Unpin" : "Pin"}
            </button>

            <div className="h-4 w-px bg-neutral-200 dark:bg-neutral-600" />

            {/* Batch delete */}
            <button
              onClick={batchDelete}
              className="flex h-7 w-7 items-center justify-center rounded-full text-neutral-400 transition-colors hover:bg-red-50 dark:hover:bg-red-900/30 hover:text-red-500 dark:hover:text-red-400"
              aria-label="Delete all selected"
            >
              <svg
                width="12"
                height="12"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              >
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>

            {/* Deselect */}
            <button
              onClick={() => setSelectedIds(new Set())}
              className="ml-1 text-[10px] text-neutral-400 underline underline-offset-2 hover:text-neutral-600 dark:hover:text-neutral-300"
            >
              Clear
            </button>
          </div>
        </div>
      )}

      {images.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center">
          <p className="text-sm text-neutral-400">No images on canvas</p>
        </div>
      )}
    </div>
  );
}

/** Clamp a normalised pan offset so the image doesn't leave the frame */
function clampOffset(v: number): number {
  return Math.max(-0.5, Math.min(0.5, v));
}
