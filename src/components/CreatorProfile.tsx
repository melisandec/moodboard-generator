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

/** Derive a deterministic accent hue + gradient from fid */
function fidToAccent(fid: string): { hue: number; gradient: string } {
  let h = 0;
  for (let i = 0; i < fid.length; i++) {
    h = (h * 31 + fid.charCodeAt(i)) & 0xffffffff;
  }
  const hue = Math.abs(h % 360);
  const hue2 = (hue + 45) % 360;
  return {
    hue,
    gradient: `linear-gradient(135deg, hsl(${hue},65%,65%) 0%, hsl(${hue2},75%,50%) 100%)`,
  };
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
      <div className="h-56 bg-neutral-200 dark:bg-neutral-800" />
      <div className="bg-white dark:bg-neutral-900 rounded-t-3xl -mt-6 px-5 pt-5 pb-4">
        <div className="flex items-start justify-between">
          <div className="space-y-2">
            <div className="h-5 w-28 rounded-full bg-neutral-200 dark:bg-neutral-700" />
            <div className="h-3 w-20 rounded-full bg-neutral-100 dark:bg-neutral-800" />
          </div>
          <div className="h-8 w-28 rounded-full bg-neutral-200 dark:bg-neutral-700" />
        </div>
        <div className="mt-3 space-y-1.5">
          <div className="h-3 w-3/4 rounded bg-neutral-100 dark:bg-neutral-800" />
          <div className="h-3 w-1/2 rounded bg-neutral-100 dark:bg-neutral-800" />
        </div>
        <div className="mt-4 grid grid-cols-3 gap-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-16 rounded-2xl bg-neutral-100 dark:bg-neutral-800" />
          ))}
        </div>
        <div className="mt-5 grid grid-cols-2 gap-2.5">
          <div className="col-span-2 aspect-[4/3] rounded-2xl bg-neutral-100 dark:bg-neutral-800" />
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="aspect-[3/4] rounded-xl bg-neutral-100 dark:bg-neutral-800" />
          ))}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Social icons
// ---------------------------------------------------------------------------

const SOCIAL_ICONS: Record<string, React.ReactNode> = {
  twitter: (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor">
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.23H2.744l7.737-8.835L1.254 2.25H8.08l4.253 5.622L18.244 2.25zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  ),
  warpcast: (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor">
      <path d="M11.994 0C5.368 0 0 5.374 0 12s5.368 12 11.994 12C18.626 24 24 18.626 24 12S18.626 0 11.994 0zm5.167 17.14h-2.04v-4.79c0-1.143-.413-1.92-1.447-1.92-.79 0-1.26.531-1.467 1.044-.076.183-.095.44-.095.697v4.969H10.07s.027-8.065 0-8.899h2.042v1.261c-.004.006-.01.013-.013.02h.013v-.02c.271-.418.756-1.015 1.841-1.015 1.343 0 2.348.878 2.348 2.766v5.887z" />
    </svg>
  ),
  instagram: (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z" />
    </svg>
  ),
  website: (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
      <circle cx="12" cy="12" r="10" />
      <path d="M2 12h20M12 2a15.3 15.3 0 010 20M12 2a15.3 15.3 0 000 20" />
    </svg>
  ),
};

function SocialPill({ platform, url }: { platform: string; url: string }) {
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1.5 rounded-full border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 px-3 py-1 text-[11px] font-medium text-neutral-600 dark:text-neutral-400 hover:border-neutral-400 dark:hover:border-neutral-500 transition-colors"
    >
      {SOCIAL_ICONS[platform] ?? (
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
          <path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71" />
        </svg>
      )}
      <span className="capitalize">{platform}</span>
    </a>
  );
}

// ---------------------------------------------------------------------------
// Spotlight board (top-viewed, full-width)
// ---------------------------------------------------------------------------

function SpotlightBoard({ board }: { board: Board }) {
  return (
    <Link
      href={`/viewer/${board.id}`}
      className="group relative block w-full overflow-hidden rounded-2xl bg-neutral-100 dark:bg-neutral-800"
      style={{ aspectRatio: "4/3" }}
    >
      {board.previewUrl ? (
        <Image
          src={board.previewUrl}
          alt={board.title}
          fill
          sizes="100vw"
          priority
          className="object-cover transition-transform duration-700 group-hover:scale-[1.03]"
        />
      ) : (
        <div className="absolute inset-0 flex items-center justify-center text-4xl opacity-20">🎨</div>
      )}

      {/* Gradient overlay - always visible at bottom */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />

      {/* Top badge */}
      <div className="absolute top-3 left-3 flex items-center gap-1.5 rounded-full bg-white/10 backdrop-blur-md border border-white/20 px-2.5 py-1 text-[11px] font-semibold text-white">
        <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
        </svg>
        Top board
      </div>

      {/* Bottom info */}
      <div className="absolute inset-x-0 bottom-0 p-4">
        <p className="text-base font-bold text-white leading-tight line-clamp-2">
          {board.title}
        </p>
        <div className="mt-1.5 flex items-center gap-3 text-xs text-white/60">
          {(board.viewCount ?? 0) > 0 && (
            <span className="flex items-center gap-1">
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" />
              </svg>
              {formatCount(board.viewCount!)} views
            </span>
          )}
          {board.publishedAt && <span>{timeAgo(board.publishedAt)}</span>}
        </div>

        {/* Quick action button */}
        <div className="mt-3 flex gap-2 translate-y-2 opacity-0 group-hover:translate-y-0 group-hover:opacity-100 transition-all duration-300">
          <span className="rounded-lg bg-white text-neutral-900 px-3 py-1.5 text-xs font-semibold">
            Open →
          </span>
        </div>
      </div>
    </Link>
  );
}

// ---------------------------------------------------------------------------
// Regular board card
// ---------------------------------------------------------------------------

function BoardCard({ board, index }: { board: Board; index: number }) {
  const aspectRatio =
    board.canvasWidth && board.canvasHeight
      ? board.canvasWidth / board.canvasHeight
      : 3 / 4;

  return (
    <Link
      href={`/viewer/${board.id}`}
      className="group relative block overflow-hidden rounded-xl bg-neutral-100 dark:bg-neutral-800"
      style={{
        aspectRatio,
        animationDelay: `${index * 60}ms`,
        animation: "fadeInUp 0.4s ease both",
      }}
    >
      {board.previewUrl ? (
        <Image
          src={board.previewUrl}
          alt={board.title}
          fill
          sizes="(max-width: 480px) 50vw, 33vw"
          className="object-cover transition-transform duration-500 group-hover:scale-[1.04]"
        />
      ) : (
        <div className="absolute inset-0 flex items-center justify-center text-xl opacity-20">🎨</div>
      )}

      {/* Hover overlay */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/30 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

      {/* Info on hover */}
      <div className="absolute inset-x-0 bottom-0 p-2.5 translate-y-1.5 opacity-0 group-hover:translate-y-0 group-hover:opacity-100 transition-all duration-300">
        <p className="text-[11px] font-semibold text-white leading-snug line-clamp-2">
          {board.title}
        </p>
        {(board.viewCount ?? 0) > 0 && (
          <p className="mt-0.5 text-[10px] text-white/60">
            {formatCount(board.viewCount!)} views
          </p>
        )}
        <div className="mt-2">
          <span className="inline-block rounded-md bg-white/15 backdrop-blur-sm border border-white/20 px-2 py-0.5 text-[10px] font-medium text-white">
            Open →
          </span>
        </div>
      </div>

      {/* Draft badge */}
      {board.isPublic === false && (
        <div className="absolute top-2 right-2 rounded-full bg-black/50 backdrop-blur-sm px-1.5 py-0.5 text-[9px] font-medium text-white/70">
          Draft
        </div>
      )}

      {/* View count always-visible bubble (for boards with notable views) */}
      {(board.viewCount ?? 0) >= 100 && (
        <div className="absolute top-2 left-2 flex items-center gap-0.5 rounded-full bg-black/40 backdrop-blur-sm px-1.5 py-0.5 text-[9px] text-white/80 opacity-0 group-hover:opacity-100 transition-opacity">
          <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" />
          </svg>
          {formatCount(board.viewCount!)}
        </div>
      )}
    </Link>
  );
}

// ---------------------------------------------------------------------------
// Collection card
// ---------------------------------------------------------------------------

function CollectionCard({ collection, hue }: { collection: Collection; hue: number }) {
  // Generate a subtle tinted background per collection
  const bg = `hsl(${(hue + collection.id.charCodeAt(0) * 7) % 360}, 40%, 96%)`;
  const bgDark = `hsl(${(hue + collection.id.charCodeAt(0) * 7) % 360}, 25%, 18%)`;

  return (
    <div
      className="group relative overflow-hidden rounded-2xl border border-neutral-200 dark:border-neutral-700 p-4 hover:border-neutral-300 dark:hover:border-neutral-600 transition-all hover:shadow-sm"
      style={{ background: bg }}
    >
      <style>{`.dark .collection-card-${collection.id.slice(0,8)} { background: ${bgDark}; }`}</style>
      <div className="flex items-center gap-3">
        {/* Stacked boards visual */}
        <div className="relative flex-shrink-0 h-12 w-12">
          <div className="absolute inset-0 rounded-xl bg-white/60 dark:bg-white/10 rotate-6 scale-90 border border-white/50" />
          <div className="absolute inset-0 rounded-xl bg-white/80 dark:bg-white/15 rotate-3 scale-95 border border-white/60" />
          <div className="absolute inset-0 rounded-xl bg-white dark:bg-neutral-700 border border-white/80 dark:border-neutral-600 flex items-center justify-center text-xl">
            📁
          </div>
        </div>

        <div className="min-w-0 flex-1">
          <p className="font-semibold text-neutral-900 dark:text-neutral-100 truncate text-sm">
            {collection.title}
          </p>
          {collection.description && (
            <p className="mt-0.5 text-xs text-neutral-500 dark:text-neutral-400 line-clamp-1">
              {collection.description}
            </p>
          )}
          <p className="mt-1 text-[11px] font-medium text-neutral-400 dark:text-neutral-500">
            {collection.boardCount} board{collection.boardCount !== 1 ? "s" : ""}
          </p>
        </div>

        <svg
          className="flex-shrink-0 text-neutral-300 dark:text-neutral-600 group-hover:text-neutral-400 transition-colors"
          width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
        >
          <path d="M9 18l6-6-6-6" />
        </svg>
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
    return () => { cancelled = true; };
  }, [fid]);

  const { hue, gradient } = useMemo(() => fidToAccent(fid), [fid]);

  // Deduplicated, sorted boards
  const allBoards = useMemo(() => {
    if (!profile) return [];
    const map = new Map<string, Board>();
    for (const b of profile.recentBoards ?? []) map.set(b.id, b);
    for (const b of profile.boards ?? []) {
      if (!map.has(b.id)) map.set(b.id, b);
    }
    return [...map.values()].sort((a, b) => {
      if (a.isPublic !== b.isPublic)
        return (b.isPublic ? 1 : 0) - (a.isPublic ? 1 : 0);
      return (b.publishedAt ?? 0) - (a.publishedAt ?? 0);
    });
  }, [profile]);

  // Top-viewed public board for spotlight
  const spotlightBoard = useMemo(() => {
    const pub = allBoards.filter((b) => b.isPublic !== false && b.previewUrl);
    if (pub.length === 0) return null;
    return pub.reduce((best, b) =>
      (b.viewCount ?? 0) >= (best.viewCount ?? 0) ? b : best,
    );
  }, [allBoards]);

  const gridBoards = useMemo(
    () => allBoards.filter((b) => b.id !== spotlightBoard?.id),
    [allBoards, spotlightBoard],
  );

  const collections: Collection[] = profile?.collections ?? [];

  const warpcastUrl = profile?.username
    ? `https://warpcast.com/${profile.username}`
    : `https://warpcast.com/~/profiles/${fid}`;

  // Hero background: blurred version of spotlight board, else gradient
  const heroBg = spotlightBoard?.previewUrl ?? null;

  if (loading) return <ProfileSkeleton />;

  if (error || !profile) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-3 text-center px-4">
        <div className="h-16 w-16 rounded-full bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center text-2xl">
          🙈
        </div>
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
      icon: "🎨",
      color: `hsl(${hue},70%,55%)`,
    },
    {
      label: "Views",
      value: formatCount(profile.stats.totalViews),
      icon: "👁",
      color: `hsl(${(hue + 120) % 360},65%,50%)`,
    },
    {
      label: "Remixes",
      value: formatCount(profile.stats.totalRemixes),
      icon: "🔀",
      color: `hsl(${(hue + 240) % 360},65%,55%)`,
    },
  ];

  const hasSocial = Object.keys(profile.socialLinks ?? {}).length > 0;

  return (
    <>
      <style>{`
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(12px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>

      {/* ═══════════════════════════════════════════════════════════
          HERO — cinematic blurred artwork backdrop
      ═══════════════════════════════════════════════════════════ */}
      <div className="relative h-56 overflow-hidden bg-black">
        {/* Background layer */}
        {heroBg ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={heroBg}
            alt=""
            aria-hidden
            className="absolute inset-0 h-full w-full object-cover scale-110 blur-2xl opacity-60"
          />
        ) : (
          <div className="absolute inset-0" style={{ background: gradient }} />
        )}

        {/* Vignette */}
        <div className="absolute inset-0 bg-gradient-to-b from-black/10 via-black/30 to-black/85" />

        {/* Centered avatar */}
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <div
            className="relative h-[72px] w-[72px] rounded-full overflow-hidden shadow-2xl"
            style={{ boxShadow: `0 0 0 3px rgba(255,255,255,0.25), 0 8px 32px rgba(0,0,0,0.5)` }}
          >
            {profile.pfpUrl ? (
              <Image
                src={profile.pfpUrl}
                alt={profile.username ?? "Creator"}
                fill
                className="object-cover"
              />
            ) : (
              <div
                className="absolute inset-0 flex items-center justify-center text-2xl"
                style={{ background: gradient }}
              >
                🎨
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════
          CONTENT CARD — rises over the hero
      ═══════════════════════════════════════════════════════════ */}
      <div className="relative -mt-6 rounded-t-[28px] bg-white dark:bg-neutral-900 min-h-screen shadow-[0_-8px_40px_rgba(0,0,0,0.12)]">
        <div className="px-4 pt-5">

          {/* ── Identity row ── */}
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h1 className="text-lg font-bold text-neutral-900 dark:text-white leading-tight truncate">
                {profile.username ? `@${profile.username}` : `fid:${fid}`}
              </h1>
              {profile.followerCount > 0 && (
                <p className="mt-0.5 text-xs text-neutral-400 dark:text-neutral-500">
                  {formatCount(profile.followerCount)} followers
                </p>
              )}
            </div>

            {/* Follow on Warpcast */}
            <a
              href={warpcastUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-shrink-0 inline-flex items-center gap-1.5 rounded-full px-3.5 py-2 text-xs font-semibold text-white transition-opacity hover:opacity-90 active:scale-95"
              style={{ background: `hsl(${hue},65%,55%)` }}
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                <path d="M11.994 0C5.368 0 0 5.374 0 12s5.368 12 11.994 12C18.626 24 24 18.626 24 12S18.626 0 11.994 0zm5.167 17.14h-2.04v-4.79c0-1.143-.413-1.92-1.447-1.92-.79 0-1.26.531-1.467 1.044-.076.183-.095.44-.095.697v4.969H10.07s.027-8.065 0-8.899h2.042v1.261c-.004.006-.01.013-.013.02h.013v-.02c.271-.418.756-1.015 1.841-1.015 1.343 0 2.348.878 2.348 2.766v5.887z" />
              </svg>
              Follow
            </a>
          </div>

          {/* ── Bio ── */}
          {profile.bio && (
            <p className="mt-2.5 text-sm text-neutral-500 dark:text-neutral-400 leading-relaxed">
              {profile.bio}
            </p>
          )}

          {/* ── Social pills ── */}
          {hasSocial && (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {Object.entries(profile.socialLinks).map(([p, u]) => (
                <SocialPill key={p} platform={p} url={u} />
              ))}
            </div>
          )}

          {/* ── Stats strip ── */}
          <div className="mt-4 grid grid-cols-3 gap-2.5">
            {stats.map((s) => (
              <div
                key={s.label}
                className="flex flex-col items-center rounded-2xl py-3.5 px-2 bg-neutral-50 dark:bg-neutral-800/60"
              >
                <span className="text-base">{s.icon}</span>
                <span
                  className="mt-1 text-xl font-bold tracking-tight"
                  style={{ color: s.color }}
                >
                  {s.value}
                </span>
                <span className="text-[10px] uppercase tracking-widest text-neutral-400 dark:text-neutral-500 mt-0.5">
                  {s.label}
                </span>
              </div>
            ))}
          </div>

          {/* ── Tabs ── */}
          <div className="mt-5 flex gap-0 border-b border-neutral-100 dark:border-neutral-800">
            {(["boards", "collections"] as Tab[]).map((tab) => {
              const count =
                tab === "boards" ? allBoards.length : collections.length;
              const active = activeTab === tab;
              return (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`relative pb-3 pr-5 text-sm font-semibold capitalize transition-colors ${
                    active
                      ? "text-neutral-900 dark:text-white"
                      : "text-neutral-400 dark:text-neutral-600 hover:text-neutral-600 dark:hover:text-neutral-400"
                  }`}
                >
                  {tab}
                  {count > 0 && (
                    <span
                      className={`ml-1.5 rounded-full px-1.5 py-0.5 text-[10px] font-medium transition-colors ${
                        active
                          ? "text-white"
                          : "bg-neutral-100 dark:bg-neutral-800 text-neutral-500"
                      }`}
                      style={active ? { backgroundColor: `hsl(${hue},65%,55%)` } : {}}
                    >
                      {count}
                    </span>
                  )}
                  {active && (
                    <span
                      className="absolute bottom-0 left-0 right-5 h-[2px] rounded-full"
                      style={{ backgroundColor: `hsl(${hue},65%,55%)` }}
                    />
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* ── Tab content ── */}
        <div className="px-4 pb-16 mt-4">
          {/* BOARDS TAB */}
          {activeTab === "boards" && (
            <div style={{ animation: "fadeInUp 0.25s ease both" }}>
              {allBoards.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 gap-3 text-center">
                  <div
                    className="h-16 w-16 rounded-2xl flex items-center justify-center text-2xl"
                    style={{ background: `hsl(${hue},50%,95%)` }}
                  >
                    🎨
                  </div>
                  <p className="text-sm font-medium text-neutral-500 dark:text-neutral-400">
                    No boards yet
                  </p>
                  <p className="text-xs text-neutral-400 dark:text-neutral-600">
                    Published boards will appear here
                  </p>
                </div>
              ) : (
                <div className="space-y-2.5">
                  {/* Spotlight board */}
                  {spotlightBoard && <SpotlightBoard board={spotlightBoard} />}

                  {/* Remaining boards: 2-col masonry */}
                  {gridBoards.length > 0 && (
                    <>
                      {spotlightBoard && gridBoards.length > 0 && (
                        <div className="flex items-center gap-3 py-1">
                          <div className="flex-1 h-px bg-neutral-100 dark:bg-neutral-800" />
                          <span className="text-[10px] uppercase tracking-widest text-neutral-300 dark:text-neutral-700">
                            All boards
                          </span>
                          <div className="flex-1 h-px bg-neutral-100 dark:bg-neutral-800" />
                        </div>
                      )}
                      <div className="columns-2 gap-2.5 space-y-2.5">
                        {gridBoards.map((board, i) => (
                          <div key={board.id} className="break-inside-avoid">
                            <BoardCard board={board} index={i} />
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
          )}

          {/* COLLECTIONS TAB */}
          {activeTab === "collections" && (
            <div style={{ animation: "fadeInUp 0.25s ease both" }}>
              {collections.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 gap-3 text-center">
                  <div
                    className="h-16 w-16 rounded-2xl flex items-center justify-center text-2xl"
                    style={{ background: `hsl(${hue},50%,95%)` }}
                  >
                    📁
                  </div>
                  <p className="text-sm font-medium text-neutral-500 dark:text-neutral-400">
                    No collections yet
                  </p>
                </div>
              ) : (
                <div className="space-y-2.5">
                  {collections.map((c) => (
                    <CollectionCard key={c.id} collection={c} hue={hue} />
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </>
  );
}

// Keep export for any existing callers
export async function fetchCreatorActivity(fid: string) {
  try {
    const res = await fetch(`/api/creators/${encodeURIComponent(fid)}/activity`);
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}
