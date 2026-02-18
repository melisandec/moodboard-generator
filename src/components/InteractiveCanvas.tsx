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

  // Drag via window-level pointer events
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

  return (
    <div className="flex flex-col gap-2">
      <div
        ref={containerRef}
        className="relative w-full touch-none overflow-hidden rounded-sm"
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
            {img.pinned && <PinIndicator />}
          </div>
        ))}

        {images.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center">
            <p className="text-sm text-neutral-400">No images on canvas</p>
          </div>
        )}
      </div>

      {selected ? (
        <div className="flex items-center justify-center gap-2 py-1">
          <button
            onClick={() => resize(selected.id, 0.85)}
            disabled={selected.pinned}
            className="flex h-11 w-11 items-center justify-center rounded-full border border-neutral-300 text-neutral-500 transition-colors hover:text-neutral-700 disabled:opacity-30"
            aria-label="Make smaller"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
          </button>
          <button
            onClick={() => resize(selected.id, 1.18)}
            disabled={selected.pinned}
            className="flex h-11 w-11 items-center justify-center rounded-full border border-neutral-300 text-neutral-500 transition-colors hover:text-neutral-700 disabled:opacity-30"
            aria-label="Make larger"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
            </svg>
          </button>
          <div className="mx-1 h-5 w-px bg-neutral-200" />
          <button
            onClick={() => togglePin(selected.id)}
            className={`flex h-11 min-w-[44px] items-center justify-center gap-1.5 rounded-full border px-3 text-xs transition-colors ${
              selected.pinned
                ? 'border-neutral-400 bg-neutral-100 text-neutral-600'
                : 'border-neutral-300 text-neutral-500 hover:text-neutral-700'
            }`}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill={selected.pinned ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2">
              <path d="M16 12V4h1V2H7v2h1v8l-2 2v2h5v6h2v-6h5v-2l-2-2z" />
            </svg>
            {selected.pinned ? 'Unpin' : 'Pin'}
          </button>
          <div className="mx-1 h-5 w-px bg-neutral-200" />
          <button
            onClick={() => remove(selected.id)}
            className="flex h-11 w-11 items-center justify-center rounded-full border border-neutral-300 text-neutral-400 transition-colors hover:border-red-300 hover:text-red-500"
            aria-label="Remove from canvas"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
      ) : (
        images.length > 0 && (
          <p className="py-1 text-center text-[11px] text-neutral-400">Tap an image to select</p>
        )
      )}
    </div>
  );
}
