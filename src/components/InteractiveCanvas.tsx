'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import type { CanvasImage } from '@/lib/storage';

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
    <div className="absolute right-1 top-1 rounded-full bg-white/80 p-[3px] shadow-sm">
      <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor" className="text-neutral-500">
        <path d="M16 12V4h1V2H7v2h1v8l-2 2v2h5v6h2v-6h5v-2l-2-2z" />
      </svg>
    </div>
  );
}

function Toggle({ on, onToggle }: { on: boolean; onToggle: () => void }) {
  return (
    <button
      onClick={(e) => { e.stopPropagation(); onToggle(); }}
      className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors ${on ? 'bg-neutral-700' : 'bg-neutral-300'}`}
      aria-label={on ? 'Unpin' : 'Pin'}
    >
      <span className={`inline-block h-3.5 w-3.5 rounded-full bg-white shadow-sm transition-transform ${on ? 'translate-x-[18px]' : 'translate-x-[3px]'}`} />
    </button>
  );
}

export default function InteractiveCanvas({
  images,
  onChange,
  onCommit,
  canvasWidth,
  canvasHeight,
  bgColor = '#f5f5f4',
  imageMargin = false,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [dragState, setDragState] = useState<{
    id: string;
    startX: number;
    startY: number;
    origX: number;
    origY: number;
  } | null>(null);

  const selected = images.find((i) => i.id === selectedId) ?? null;

  const getScale = useCallback(() => {
    if (!containerRef.current) return 1;
    return containerRef.current.clientWidth / canvasWidth;
  }, [canvasWidth]);

  const updateOne = useCallback(
    (id: string, patch: Partial<CanvasImage>) => {
      onChange(images.map((img) => (img.id === id ? { ...img, ...patch } : img)));
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
      if (selectedId === id) setSelectedId(null);
    },
    [images, onChange, onCommit, selectedId],
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
      const newW = Math.max(30, Math.min(canvasWidth * 0.95, img.width * factor));
      updateOne(id, { width: newW, height: newW / aspect });
    },
    [images, canvasWidth, onCommit, updateOne],
  );

  useEffect(() => {
    if (!dragState) return;
    const onMove = (e: PointerEvent) => {
      e.preventDefault();
      const s = getScale();
      updateOne(dragState.id, {
        x: dragState.origX + (e.clientX - dragState.startX) / s,
        y: dragState.origY + (e.clientY - dragState.startY) / s,
      });
    };
    const onUp = () => setDragState(null);
    window.addEventListener('pointermove', onMove, { passive: false });
    window.addEventListener('pointerup', onUp);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
  }, [dragState, getScale, updateOne]);

  const handlePointerDown = useCallback(
    (e: React.PointerEvent, id: string) => {
      e.preventDefault();
      e.stopPropagation();
      const img = images.find((i) => i.id === id);
      if (!img) return;
      setSelectedId(id);
      if (!img.pinned) {
        onCommit?.();
        bringToFront(id);
        setDragState({ id, startX: e.clientX, startY: e.clientY, origX: img.x, origY: img.y });
      }
    },
    [images, bringToFront, onCommit],
  );

  const sorted = [...images].sort((a, b) => a.zIndex - b.zIndex);
  const marginPx = imageMargin ? 3 : 0;
  const topZ = images.length > 0 ? Math.max(...images.map((i) => i.zIndex)) + 10 : 10;

  return (
    <div
      ref={containerRef}
      className="relative w-full touch-none overflow-visible rounded-sm"
      style={{ aspectRatio: `${canvasWidth} / ${canvasHeight}`, backgroundColor: bgColor }}
      onPointerDown={(e) => {
        if (e.target === containerRef.current) setSelectedId(null);
      }}
    >
      {sorted.map((img) => (
        <div
          key={img.id}
          className={`absolute select-none ${
            img.pinned ? 'cursor-default' : 'cursor-grab active:cursor-grabbing'
          } ${selectedId === img.id ? 'ring-2 ring-blue-400/50 ring-offset-1' : ''}`}
          style={{
            left: `${(img.x / canvasWidth) * 100}%`,
            top: `${(img.y / canvasHeight) * 100}%`,
            width: `${(img.width / canvasWidth) * 100}%`,
            height: `${(img.height / canvasHeight) * 100}%`,
            zIndex: img.zIndex,
            transform: `rotate(${img.rotation}deg)`,
            boxShadow: marginPx > 0 ? `0 0 0 ${marginPx}px white` : 'none',
          }}
          onPointerDown={(e) => handlePointerDown(e, img.id)}
        >
          <img src={img.dataUrl} alt="" className="pointer-events-none h-full w-full object-cover" draggable={false} />
          {img.pinned && selectedId !== img.id && <PinIndicator />}
        </div>
      ))}

      {/* Floating toolbar — flips below image when near the top edge */}
      {selected && (() => {
        const nearTop = selected.y / canvasHeight < 0.1;
        return (
        <div
          className="pointer-events-none absolute"
          style={{
            left: `${(selected.x / canvasWidth) * 100}%`,
            top: nearTop
              ? `${((selected.y + selected.height) / canvasHeight) * 100}%`
              : `${(selected.y / canvasHeight) * 100}%`,
            width: `${(selected.width / canvasWidth) * 100}%`,
            zIndex: topZ,
          }}
        >
          <div
            className={`pointer-events-auto absolute left-1/2 flex -translate-x-1/2 items-center gap-2 rounded-full bg-white px-2 py-1 shadow-md ${
              nearTop ? 'top-full mt-1.5' : 'bottom-full mb-1.5'
            }`}
            onPointerDown={(e) => e.stopPropagation()}
          >
            {/* Resize smaller */}
            <button
              onClick={() => resize(selected.id, 0.85)}
              disabled={selected.pinned}
              className="flex h-7 w-7 items-center justify-center rounded-full text-neutral-500 transition-colors hover:bg-neutral-100 hover:text-neutral-700 disabled:opacity-30"
              aria-label="Smaller"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
            </button>

            {/* Resize larger */}
            <button
              onClick={() => resize(selected.id, 1.18)}
              disabled={selected.pinned}
              className="flex h-7 w-7 items-center justify-center rounded-full text-neutral-500 transition-colors hover:bg-neutral-100 hover:text-neutral-700 disabled:opacity-30"
              aria-label="Larger"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
              </svg>
            </button>

            <div className="h-4 w-px bg-neutral-200" />

            {/* Pin toggle */}
            <span className="text-[10px] text-neutral-500">{selected.pinned ? 'unpin' : 'pin'}</span>
            <Toggle on={selected.pinned} onToggle={() => togglePin(selected.id)} />

            <div className="h-4 w-px bg-neutral-200" />

            {/* Delete */}
            <button
              onClick={() => remove(selected.id)}
              className="flex h-7 w-7 items-center justify-center rounded-full text-neutral-400 transition-colors hover:bg-red-50 hover:text-red-500"
              aria-label="Remove"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>
        </div>
        );
      })()}

      {images.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center">
          <p className="text-sm text-neutral-400">No images on canvas</p>
        </div>
      )}
    </div>
  );
}
