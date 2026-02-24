"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import type { CanvasImage } from "@/lib/storage";
import {
  getObjectUrl,
  reconcileObjectUrls,
  releaseAllObjectUrls,
} from "@/lib/object-url-cache";

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
      setDragState(null);
    };

    window.addEventListener("pointermove", onMove, { passive: false });
    window.addEventListener("pointerup", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
  }, [dragState, getScale, images, onChange]);

  // ---- Pointer down (multi-select + long-press) ----

  const handlePointerDown = useCallback(
    (e: React.PointerEvent, id: string) => {
      e.preventDefault();
      e.stopPropagation();
      const img = images.find((i) => i.id === id);
      if (!img) return;

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
    [images, bringToFront, onCommit, selectedIds],
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
    if (selectedIds.size === 0) return;
    const handler = (e: KeyboardEvent) => {
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      )
        return;
      if (e.key === "Escape") {
        setSelectedIds(new Set());
      } else if (e.key === "Delete" || e.key === "Backspace") {
        e.preventDefault();
        if (selectedIds.size > 1) batchDelete();
        else remove([...selectedIds][0]);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [selectedIds, batchDelete, remove]);

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
        if (e.target === containerRef.current) setSelectedIds(new Set());
      }}
    >
      {sorted.map((img) => (
        <div
          key={img.id}
          className={`absolute select-none ${
            img.pinned ? "cursor-default" : "cursor-grab active:cursor-grabbing"
          } ${selectedIds.has(img.id) ? "ring-2 ring-blue-400/50 ring-offset-1" : ""}`}
          style={{
            left: `${(img.x / canvasWidth) * 100}%`,
            top: `${(img.y / canvasHeight) * 100}%`,
            width: `${(img.width / canvasWidth) * 100}%`,
            height: `${(img.height / canvasHeight) * 100}%`,
            zIndex: img.zIndex,
            transform: `rotate(${img.rotation}deg)`,
            boxShadow: marginPx > 0 ? `0 0 0 ${marginPx}px white` : "none",
          }}
          onPointerDown={(e) => handlePointerDown(e, img.id)}
        >
          <img
            src={getObjectUrl(img.id, img.dataUrl)}
            alt=""
            className="pointer-events-none h-full w-full object-cover"
            draggable={false}
          />
          {img.pinned && !selectedIds.has(img.id) && <PinIndicator />}
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
      ))}

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
