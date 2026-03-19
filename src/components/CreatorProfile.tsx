"use client";

import { useEffect, useState, useMemo } from "react";
import Image from "next/image";
import Link from "next/link";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface CreatorStats {
  totalBoardsPublished: number;
  totalViews: number;
  totalRemixes: number;
}

interface Board {
  id: string;
  title: string;
  previewUrl: string | null;
  viewCount: number | null;
  publishedAt: number | null;
  isPublic?: boolean;
  canvasWidth?: number;
  canvasHeight?: number;
}

interface Collection {
  id: string;
  title: string;
  description: string;
  boardCount: number;
}

interface CreatorProfileData {
  fid: string;
  username: string | null;
  pfpUrl: string | null;
  bio: string;
  socialLinks: Record<string, string>;
  followerCount: number;
  stats: CreatorStats;
  recentBoards: Board[];
  boards?: Board[];
  collections?: Collection[];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Deterministic gradient from fid — gives each creator a unique palette */
function fidToGradient(fid: string): string {
  let h = 0;
  for (let i = 0; i < fid.length; i++) {
    h = (h * 31 + fid.charCodeAt(i)) & 0xffffffff;
  }
  const hue1 = Math.abs(h % 360);
  const hue2 = (hue1 + 40) % 360;
  return `linear-gradient(135deg, hsl(${hue1},60%,70%) 0%, hsl(${hue2},70%,55%) 100%)`;
}

function formatCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return String(n);
}

function timeAgo(ts: number | string | null): string {
  if (!ts) return "";
  const ms = typeof ts === "number" ? ts : new Date(ts).getTime();
  const diff = Date.now() - ms;
  const days = Math.floor(diff / 86_400_000);
  if (days === 0) return "today";
  if (days === 1) return "yesterday";
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months}mo ago`;
  return `${Math.floor(months / 12)}y ago`;
}

// ---------------------------------------------------------------------------
// Skeleton
// ---------------------------------------------------------------------------

function ProfileSkeleton() {
  return (
    <div className="animate-pulse">
      {/* Cover */}
      <div className="h-36 sm:h-48 rounded-2xl bg-neutral-200 dark:bg-neutral-800" />
      {/* Avatar + name */}
      <div className="px-4 sm:px-6 -mt-12 flex items-end gap-4">
        <div className="h-24 w-24 rounded-full bg-neutral-300 dark:bg-neutral-700 ring-4 ring-white dark:ring-neutral-900 flex-shrink-0" />
        <div className="pb-2 space-y-2 flex-1">
          <div className="h-5 w-32 rounded bg-neutral-300 dark:bg-neutral-700" />
          <div className="h-3 w-20 rounded bg-neutral-200 dark:bg-neutral-800" />
        </div>
      </div>
      {/* Stats */}
      <div className="mt-6 px-4 sm:px-6 grid grid-cols-3 gap-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-16 rounded-xl bg-neutral-200 dark:bg-neutral-800" />
        ))}
      </div>
      {/* Grid */}
      <div className="mt-6 px-4 sm:px-6 grid grid-cols-2 sm:grid-cols-3 gap-3">
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <div
            key={i}
            className="aspect-[3/4] rounded-xl bg-neutral-200 dark:bg-neutral-800"
          />
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Social icon SVGs (inline, no extra deps)
// ---------------------------------------------------------------------------

function SocialLink({
  platform,
  url,
}: {
  platform: string;
  url: string;
}) {
  const icons: Record<string, React.ReactNode> = {
    twitter: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
        <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.23H2.744l7.737-8.835L1.254 2.25H8.08l4.253 5.622L18.244 2.25zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
      </svg>
    ),
    warpcast: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
        <path d="M11.994 0C5.368 0 0 5.374 0 12s5.368 12 11.994 12C18.626 24 24 18.626 24 12S18.626 0 11.994 0zm5.167 17.14h-2.04v-4.79c0-1.143-.413-1.92-1.447-1.92-.79 0-1.26.531-1.467 1.044-.076.183-.095.44-.095.697v4.969H10.07s.027-8.065 0-8.899h2.042v1.261c-.004.006-.01.013-.013.02h.013v-.02c.271-.418.756-1.015 1.841-1.015 1.343 0 2.348.878 2.348 2.766v5.887z" />
      </svg>
    ),
    instagram: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z" />
      </svg>
    ),
    website: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="12" cy="12" r="10" />
        <line x1="2" y1="12" x2="22" y2="12" />
        <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
      </svg>
    ),
  };

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1.5 rounded-full bg-neutral-100 dark:bg-neutral-800 px-3 py-1.5 text-xs font-medium text-neutral-700 dark:text-neutral-300 hover:bg-neutral-200 dark:hover:bg-neutral-700 transition-colors"
    >
      {icons[platform] ?? (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71" />
          <path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71" />
        </svg>
      )}
      <span className="capitalize">{platform}</span>
    </a>
  );
}

// ---------------------------------------------------------------------------
// Board card
// ---------------------------------------------------------------------------

function BoardCard({ board }: { board: Board }) {
  const aspectRatio =
    board.canvasWidth && board.canvasHeight
      ? board.canvasWidth / board.canvasHeight
      : 3 / 4;

  return (
    <Link
      href={`/viewer/${board.id}`}
      className="group relative block overflow-hidden rounded-xl bg-neutral-100 dark:bg-neutral-800"
      style={{ aspectRatio }}
    >
      {board.previewUrl ? (
        <Image
          src={board.previewUrl}
          alt={board.title}
          fill
          sizes="(max-width: 640px) 50vw, 33vw"
          className="object-cover transition-transform duration-500 group-hover:scale-105"
        />
      ) : (
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-2xl opacity-30">🎨</span>
        </div>
      )}

      {/* Hover overlay */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
      <div className="absolute inset-x-0 bottom-0 p-3 translate-y-2 opacity-0 group-hover:translate-y-0 group-hover:opacity-100 transition-all duration-300">
        <p className="text-sm font-semibold text-white leading-tight line-clamp-2">
          {board.title}
        </p>
        <div className="mt-1 flex items-center gap-2 text-xs text-white/70">
          {(board.viewCount ?? 0) > 0 && (
            <span>{formatCount(board.viewCount!)} views</span>
          )}
          {board.publishedAt && (
            <span>{timeAgo(board.publishedAt)}</span>
          )}
        </div>
      </div>

      {/* Public badge */}
      {board.isPublic === false && (
        <div className="absolute top-2 right-2 rounded-full bg-black/60 px-2 py-0.5 text-[10px] text-white/80">
          Draft
        </div>
      )}
    </Link>
  );
}

// ---------------------------------------------------------------------------
// Collection card
// ---------------------------------------------------------------------------

function CollectionCard({ collection }: { collection: Collection }) {
  return (
    <div className="group rounded-xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 p-5 hover:border-neutral-400 dark:hover:border-neutral-500 transition-colors">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-neutral-100 dark:bg-neutral-700 text-lg">
          📁
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-neutral-900 dark:text-neutral-100 truncate">
            {collection.title}
          </p>
          {collection.description && (
            <p className="mt-0.5 text-xs text-neutral-500 dark:text-neutral-400 line-clamp-2">
              {collection.description}
            </p>
          )}
          <p className="mt-1.5 text-xs text-neutral-400 dark:text-neutral-500">
            {collection.boardCount} board{collection.boardCount !== 1 ? "s" : ""}
          </p>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

type Tab = "boards" | "collections";

export default function CreatorProfile({ fid }: { fid: string }) {
  const [profile, setProfile] = useState<CreatorProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>("boards");

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetch(`/api/creators/${fid}`)
      .then((r) => {
        if (!r.ok) throw new Error("Creator not found");
        return r.json();
      })
      .then((data) => {
        if (!cancelled) setProfile(data);
      })
      .catch((err) => {
        if (!cancelled) setError(err.message ?? "Failed to load");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [fid]);

  const gradient = useMemo(() => fidToGradient(fid), [fid]);

  // Merge recentBoards + boards (deduplicate by id), public first
  const allBoards = useMemo(() => {
    if (!profile) return [];
    const map = new Map<string, Board>();
    for (const b of profile.recentBoards ?? []) map.set(b.id, b);
    for (const b of profile.boards ?? []) {
      if (!map.has(b.id)) map.set(b.id, b);
    }
    return [...map.values()].sort((a, b) => {
      // public boards first, then by publishedAt desc
      if (a.isPublic !== b.isPublic)
        return (b.isPublic ? 1 : 0) - (a.isPublic ? 1 : 0);
      return (b.publishedAt ?? 0) - (a.publishedAt ?? 0);
    });
  }, [profile]);

  const collections: Collection[] = profile?.collections ?? [];

  if (loading) return <ProfileSkeleton />;

  if (error || !profile) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-3">
        <span className="text-3xl">🙈</span>
        <p className="text-sm text-neutral-500 dark:text-neutral-400">
          {error ?? "Profile not found"}
        </p>
      </div>
    );
  }

  const stats = [
    {
      label: "Boards",
      value: formatCount(profile.stats.totalBoardsPublished),
    },
    { label: "Views", value: formatCount(profile.stats.totalViews) },
    { label: "Remixes", value: formatCount(profile.stats.totalRemixes) },
  ];

  const hasSocialLinks = Object.keys(profile.socialLinks ?? {}).length > 0;

  return (
    <div className="pb-16">
      {/* ── Cover ── */}
      <div
        className="relative h-36 sm:h-52 rounded-2xl overflow-hidden"
        style={{ background: gradient }}
      >
        {/* subtle noise texture */}
        <div
          className="absolute inset-0 opacity-20"
          style={{
            backgroundImage:
              "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)' opacity='1'/%3E%3C/svg%3E\")",
            backgroundSize: "200px 200px",
          }}
        />
      </div>

      {/* ── Avatar + identity ── */}
      <div className="px-4 sm:px-6">
        <div className="flex items-end gap-4 -mt-12 mb-4">
          <div className="relative h-24 w-24 flex-shrink-0 rounded-full ring-4 ring-white dark:ring-neutral-900 overflow-hidden bg-neutral-200 dark:bg-neutral-700 shadow-lg">
            {profile.pfpUrl ? (
              <Image
                src={profile.pfpUrl}
                alt={profile.username ?? "Creator"}
                fill
                className="object-cover"
              />
            ) : (
              <div className="absolute inset-0 flex items-center justify-center text-3xl">
                🎨
              </div>
            )}
          </div>

          <div className="pb-1 min-w-0">
            <h1 className="text-xl font-bold text-neutral-900 dark:text-white truncate leading-tight">
              {profile.username ? `@${profile.username}` : `fid:${profile.fid}`}
            </h1>
            {profile.followerCount > 0 && (
              <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
                {formatCount(profile.followerCount)} followers on Farcaster
              </p>
            )}
          </div>
        </div>

        {/* Bio */}
        {profile.bio && (
          <p className="text-sm text-neutral-600 dark:text-neutral-300 leading-relaxed max-w-lg">
            {profile.bio}
          </p>
        )}

        {/* Social links */}
        {hasSocialLinks && (
          <div className="mt-3 flex flex-wrap gap-2">
            {Object.entries(profile.socialLinks).map(([platform, url]) => (
              <SocialLink key={platform} platform={platform} url={url} />
            ))}
          </div>
        )}

        {/* ── Stats strip ── */}
        <div className="mt-5 grid grid-cols-3 divide-x divide-neutral-200 dark:divide-neutral-700 rounded-2xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800/60 overflow-hidden">
          {stats.map((s) => (
            <div key={s.label} className="flex flex-col items-center py-4 px-2">
              <span className="text-2xl font-bold tracking-tight text-neutral-900 dark:text-white">
                {s.value}
              </span>
              <span className="mt-0.5 text-[11px] uppercase tracking-wider text-neutral-400 dark:text-neutral-500">
                {s.label}
              </span>
            </div>
          ))}
        </div>

        {/* ── Tabs ── */}
        <div className="mt-6 flex gap-1 border-b border-neutral-200 dark:border-neutral-700">
          {(["boards", "collections"] as Tab[]).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`relative pb-3 px-4 text-sm font-medium capitalize transition-colors ${
                activeTab === tab
                  ? "text-neutral-900 dark:text-white"
                  : "text-neutral-400 dark:text-neutral-500 hover:text-neutral-600 dark:hover:text-neutral-300"
              }`}
            >
              {tab}
              {tab === "boards" && allBoards.length > 0 && (
                <span className="ml-1.5 rounded-full bg-neutral-100 dark:bg-neutral-700 px-1.5 py-0.5 text-[10px] text-neutral-500 dark:text-neutral-400">
                  {allBoards.length}
                </span>
              )}
              {tab === "collections" && collections.length > 0 && (
                <span className="ml-1.5 rounded-full bg-neutral-100 dark:bg-neutral-700 px-1.5 py-0.5 text-[10px] text-neutral-500 dark:text-neutral-400">
                  {collections.length}
                </span>
              )}
              {activeTab === tab && (
                <span className="absolute bottom-0 left-0 right-0 h-0.5 rounded-full bg-neutral-900 dark:bg-white" />
              )}
            </button>
          ))}
        </div>

        {/* ── Tab content ── */}
        <div className="mt-5">
          {activeTab === "boards" && (
            <>
              {allBoards.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 gap-3 text-center">
                  <span className="text-4xl">🎨</span>
                  <p className="text-sm text-neutral-500 dark:text-neutral-400">
                    No boards published yet
                  </p>
                </div>
              ) : (
                <div className="columns-2 sm:columns-3 gap-3 space-y-3">
                  {allBoards.map((board) => (
                    <div key={board.id} className="break-inside-avoid">
                      <BoardCard board={board} />
                    </div>
                  ))}
                </div>
              )}
            </>
          )}

          {activeTab === "collections" && (
            <>
              {collections.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 gap-3 text-center">
                  <span className="text-4xl">📁</span>
                  <p className="text-sm text-neutral-500 dark:text-neutral-400">
                    No collections yet
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {collections.map((c) => (
                    <CollectionCard key={c.id} collection={c} />
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Keep the activity helper export so nothing else breaks
// ---------------------------------------------------------------------------

export async function fetchCreatorActivity(fid: string) {
  try {
    const res = await fetch(`/api/creators/${encodeURIComponent(fid)}/activity`);
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}
