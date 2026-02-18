'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  loadLibrary, saveLibraryImage, deleteLibraryImage,
  type LibraryImage,
} from '@/lib/storage';

interface Props {
  onBack: () => void;
  onAddToCanvas: (images: LibraryImage[]) => void;
}

type Sort = 'newest' | 'oldest' | 'name';

export default function ImageLibrary({ onBack, onAddToCanvas }: Props) {
  const [images, setImages] = useState<LibraryImage[]>([]);
  const [search, setSearch] = useState('');
  const [tagFilter, setTagFilter] = useState<string | null>(null);
  const [sort, setSort] = useState<Sort>('newest');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [tagDraft, setTagDraft] = useState('');

  useEffect(() => {
    loadLibrary().then(setImages).catch(() => {});
  }, []);

  const allTags = useMemo(() => {
    const s = new Set<string>();
    images.forEach((img) => img.tags.forEach((t) => s.add(t)));
    return [...s].sort();
  }, [images]);

  const filtered = useMemo(() => {
    let result = images;
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(
        (img) =>
          img.filename.toLowerCase().includes(q) ||
          img.tags.some((t) => t.toLowerCase().includes(q)),
      );
    }
    if (tagFilter) result = result.filter((img) => img.tags.includes(tagFilter));
    const sorted = [...result];
    switch (sort) {
      case 'newest': sorted.sort((a, b) => b.uploadedAt.localeCompare(a.uploadedAt)); break;
      case 'oldest': sorted.sort((a, b) => a.uploadedAt.localeCompare(b.uploadedAt)); break;
      case 'name': sorted.sort((a, b) => a.filename.localeCompare(b.filename)); break;
    }
    return sorted;
  }, [images, search, tagFilter, sort]);

  const toggle = useCallback((id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, []);

  const addTag = useCallback(async (imgId: string, tag: string) => {
    const trimmed = tag.trim().toLowerCase();
    if (!trimmed) return;
    const img = images.find((i) => i.id === imgId);
    if (!img || img.tags.includes(trimmed)) return;
    const updated = { ...img, tags: [...img.tags, trimmed] };
    await saveLibraryImage(updated);
    setImages((p) => p.map((i) => (i.id === imgId ? updated : i)));
  }, [images]);

  const removeTag = useCallback(async (imgId: string, tag: string) => {
    const img = images.find((i) => i.id === imgId);
    if (!img) return;
    const updated = { ...img, tags: img.tags.filter((t) => t !== tag) };
    await saveLibraryImage(updated);
    setImages((p) => p.map((i) => (i.id === imgId ? updated : i)));
  }, [images]);

  const deleteImg = useCallback(async (id: string) => {
    await deleteLibraryImage(id);
    setImages((p) => p.filter((i) => i.id !== id));
    setSelected((p) => { const n = new Set(p); n.delete(id); return n; });
  }, []);

  const handleAdd = useCallback(() => {
    const imgs = images.filter((i) => selected.has(i.id));
    if (imgs.length > 0) onAddToCanvas(imgs);
  }, [images, selected, onAddToCanvas]);

  const chip = 'rounded-full border px-2.5 py-1 text-[10px] transition-colors';
  const chipActive = 'border-neutral-500 bg-neutral-100 text-neutral-700';
  const chipDefault = 'border-neutral-200 text-neutral-400 hover:text-neutral-600';

  return (
    <div className="flex min-h-[100dvh] flex-col bg-white">
      {/* Header */}
      <header className="flex items-center justify-between px-4 py-2">
        <button onClick={onBack} className="flex min-h-[44px] min-w-[44px] items-center text-sm text-neutral-500 hover:text-neutral-700">
          ← Back
        </button>
        <p className="text-[11px] uppercase tracking-widest text-neutral-400">Library</p>
        <div className="w-11" />
      </header>

      {/* Search */}
      <div className="px-4 pb-2">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search images or tags"
          className="w-full border-b border-neutral-200 bg-transparent pb-1.5 text-sm outline-none placeholder:text-neutral-400 focus:border-neutral-400"
        />
      </div>

      {/* Tag filters */}
      {allTags.length > 0 && (
        <div className="scrollbar-hide flex gap-1.5 overflow-x-auto px-4 pb-2">
          <button onClick={() => setTagFilter(null)} className={`${chip} ${tagFilter === null ? chipActive : chipDefault}`}>All</button>
          {allTags.map((t) => (
            <button key={t} onClick={() => setTagFilter(t)} className={`${chip} ${tagFilter === t ? chipActive : chipDefault}`}>{t}</button>
          ))}
        </div>
      )}

      {/* Sort + count */}
      <div className="flex items-center justify-between px-4 pb-2">
        <p className="text-[11px] text-neutral-400">{filtered.length} image{filtered.length !== 1 ? 's' : ''}</p>
        <select
          value={sort}
          onChange={(e) => setSort(e.target.value as Sort)}
          className="border-none bg-transparent text-[11px] text-neutral-500 outline-none"
          aria-label="Sort images"
        >
          <option value="newest">Newest</option>
          <option value="oldest">Oldest</option>
          <option value="name">Name</option>
        </select>
      </div>

      {/* Grid */}
      <div className="flex-1 overflow-y-auto px-4 pb-24">
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
          {filtered.map((img) => (
            <div key={img.id} className="group relative">
              <button onClick={() => toggle(img.id)} className="w-full text-left">
                <img
                  src={img.dataUrl}
                  alt={img.filename}
                  className={`aspect-square w-full rounded-sm object-cover transition-shadow ${selected.has(img.id) ? 'ring-2 ring-blue-400' : ''}`}
                />
              </button>

              {/* Tags */}
              {img.tags.length > 0 && (
                <div className="mt-0.5 flex flex-wrap gap-0.5">
                  {img.tags.map((t) => (
                    <span
                      key={t}
                      className="inline-flex items-center gap-0.5 rounded-sm bg-neutral-100 px-1 text-[9px] text-neutral-500"
                    >
                      {t}
                      {editingId === img.id && (
                        <button onClick={() => removeTag(img.id, t)} className="text-neutral-400 hover:text-red-500">×</button>
                      )}
                    </span>
                  ))}
                </div>
              )}

              {/* Tag editing */}
              {editingId === img.id ? (
                <div className="mt-1 flex gap-1">
                  <input
                    type="text"
                    value={tagDraft}
                    onChange={(e) => setTagDraft(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') { addTag(img.id, tagDraft); setTagDraft(''); }
                    }}
                    placeholder="tag"
                    className="w-full border-b border-neutral-200 bg-transparent pb-0.5 text-[10px] outline-none placeholder:text-neutral-400"
                    autoFocus
                  />
                  <button onClick={() => { setEditingId(null); setTagDraft(''); }} className="text-[9px] text-neutral-400">Done</button>
                </div>
              ) : (
                <button
                  onClick={(e) => { e.stopPropagation(); setEditingId(img.id); }}
                  className="mt-0.5 text-[9px] text-neutral-300 hover:text-neutral-500"
                >
                  + tag
                </button>
              )}

              {/* Selection indicator */}
              {selected.has(img.id) && (
                <div className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-blue-500 text-[10px] font-medium text-white">✓</div>
              )}

              {/* Delete */}
              <button
                onClick={(e) => { e.stopPropagation(); deleteImg(img.id); }}
                className="absolute left-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-white/80 text-[10px] text-neutral-400 opacity-0 shadow-sm transition-opacity group-hover:opacity-100"
                style={{ opacity: undefined }}
                aria-label="Delete"
              >×</button>
            </div>
          ))}
        </div>

        {filtered.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <p className="text-sm text-neutral-400">
              {images.length === 0 ? 'No images in library yet' : 'No matching images'}
            </p>
            <p className="mt-1 text-[11px] text-neutral-300">
              {images.length === 0 ? 'Images are added when you create moodboards' : 'Try a different search or filter'}
            </p>
          </div>
        )}
      </div>

      {/* Action bar */}
      {selected.size > 0 && (
        <div className="sticky bottom-0 border-t border-neutral-200 bg-white/90 px-4 py-3 backdrop-blur-sm">
          <div className="mx-auto flex max-w-lg items-center justify-between">
            <p className="text-[11px] text-neutral-500">{selected.size} selected</p>
            <button
              onClick={handleAdd}
              className="flex min-h-[44px] items-center rounded-full border border-neutral-300 px-4 text-xs text-neutral-600 hover:border-neutral-500"
            >
              Add to Canvas
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
