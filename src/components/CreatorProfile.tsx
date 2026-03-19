"use client";

import { useEffect, useState, useMemo } from "react";
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

function fidToAccent(fid: string): { hue: number; gradient: string } {
  let h = 0;
  for (let i = 0; i < fid.length; i++) {
    h = (h * 31 + fid.charCodeAt(i)) & 0xffffffff;
  }
  const hue = Math.abs(h % 360);
  const hue2 = (hue + 45) % 360;
  return {
    hue,
    gradient: `linear-gradient(135deg, hsl(${hue},55%,65%) 0%, hsl(${hue2},65%,50%) 100%)`,
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
      <div className="h-52 bg-neutral-200 dark:bg-neutral-800" />
      <div className="bg-white dark:bg-neutral-900 rounded-t-3xl -mt-6 px-5 pt-5 pb-6">
        <div className="flex items-start justify-between">
          <div className="space-y-2">
            <div className="h-4 w-24 rounded bg-neutral-200 dark:bg-neutral-700" />
            <div className="h-3 w-16 rounded bg-neutral-100 dark:bg-neutral-800" />
          </div>
          <div className="h-8 w-24 rounded-full bg-neutral-200 dark:bg-neutral-700" />
        </div>
        <div className="mt-3 space-y-1.5">
          <div className="h-3 w-3/4 rounded bg-neutral-100 dark:bg-neutral-800" />
          <div className="h-3 w-1/2 rounded bg-neutral-100 dark:bg-neutral-800" />
        </div>
        {/* Stats skeleton */}
        <div className="mt-6 flex divide-x divide-neutral-100 dark:divide-neutral-800 border-y border-neutral-100 dark:border-neutral-800">
          {[0, 1, 2].map((i) => (
            <div key={i} className="flex-1 py-4 flex flex-col items-center gap-1.5">
              <div className="h-5 w-8 rounded bg-neutral-200 dark:bg-neutral-700" />
              <div className="h-2.5 w-10 rounded bg-neutral-100 dark:bg-neutral-800" />
            </div>
          ))}
        </div>
        {/* Grid skeleton */}
        <div className="mt-5 grid grid-cols-2 gap-2">
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
// Social links — SVG icons only, no labels
// ---------------------------------------------------------------------------

const SOCIAL_ICONS: Record<string, React.ReactNode> = {
  twitter: (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.23H2.744l7.737-8.835L1.254 2.25H8.08l4.253 5.622L18.244 2.25zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  ),
  warpcast: (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
      <path d="M11.994 0C5.368 0 0 5.374 0 12s5.368 12 11.994 12C18.626 24 24 18.626 24 12S18.626 0 11.994 0zm5.167 17.14h-2.04v-4.79c0-1.143-.413-1.92-1.447-1.92-.79 0-1.26.531-1.467 1.044-.076.183-.095.44-.095.697v4.969H10.07s.027-8.065 0-8.899h2.042v1.261c-.004.006-.01.013-.013.02h.013v-.02c.271-.418.756-1.015 1.841-1.015 1.343 0 2.348.878 2.348 2.766v5.887z" />
    </svg>
  ),
  instagram: (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z" />
    </svg>
  ),
  website: (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="10" />
      <path d="M2 12h20M12 2a15.3 15.3 0 010 20M12 2a15.3 15.3 0 000 20" />
    </svg>
  ),
};

// Generic link icon
const LinkIcon = (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71" />
  </svg>
);

// ---------------------------------------------------------------------------
// Spotlight board (full-width featured)
// ---------------------------------------------------------------------------

function SpotlightBoard({ board }: { board: Board }) {
  return (
    <Link
      href={`/viewer/${board.id}`}
      className="group relative block w-full overflow-hidden rounded-2xl bg-neutral-100 dark:bg-neutral-800"
      style={{ aspectRatio: "4/3" }}
    >
      {board.previewUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={board.previewUrl}
          alt={board.title}
          className="absolute inset-0 h-full w-full object-cover transition-transform duration-700 group-hover:scale-[1.03]"
        />
      ) : (
        <div className="absolute inset-0 bg-neutral-100 dark:bg-neutral-800" />
      )}

      {/* Always-on bottom gradient + info */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />

      <div className="absolute inset-x-0 bottom-0 p-4">
        <p className="text-sm font-semibold text-white leading-snug line-clamp-2">
          {board.title}
        </p>
        <div className="mt-1 flex items-center gap-3 text-[11px] text-white/50">
          {(board.viewCount ?? 0) > 0 && (
            <span>{formatCount(board.viewCount!)} views</span>
          )}
          {board.publishedAt && <span>{timeAgo(board.publishedAt)}</span>}
        </div>
      </div>
    </Link>
  );
}

// ---------------------------------------------------------------------------
// Board card
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
        animation: "fadeUp 0.35s ease both",
        animationDelay: `${index * 50}ms`,
      }}
    >
      {board.previewUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={board.previewUrl}
          alt={board.title}
          className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.04]"
        />
      ) : (
        <div className="absolute inset-0 bg-neutral-100 dark:bg-neutral-800" />
      )}

      <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

      <div className="absolute inset-x-0 bottom-0 p-2.5 opacity-0 translate-y-1 group-hover:opacity-100 group-hover:translate-y-0 transition-all duration-300">
        <p className="text-[11px] font-medium text-white leading-snug line-clamp-2">
          {board.title}
        </p>
      </div>

      {board.isPublic === false && (
        <div className="absolute top-2 right-2 rounded-full bg-black/40 backdrop-blur-sm px-1.5 py-0.5 text-[9px] text-white/60">
          Draft
        </div>
      )}
    </Link>
  );
}

// ---------------------------------------------------------------------------
// Collection row
// ---------------------------------------------------------------------------

function CollectionRow({ collection }: { collection: Collection }) {
  return (
    <div className="group flex items-center justify-between py-3.5 border-b border-neutral-100 dark:border-neutral-800 last:border-0">
      <div className="min-w-0">
        <p className="text-sm font-medium text-neutral-900 dark:text-neutral-100 truncate">
          {collection.title}
        </p>
        {collection.description && (
          <p className="mt-0.5 text-xs text-neutral-400 dark:text-neutral-500 truncate">
            {collection.description}
          </p>
        )}
      </div>
      <span className="ml-4 flex-shrink-0 text-xs text-neutral-400 dark:text-neutral-600 tabular-nums">
        {collection.boardCount} {collection.boardCount === 1 ? "board" : "boards"}
      </span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

type Tab = "boards" | "collections";

export default function CreatorProfile({ fid }: { fid: string }) {
  const [profile, setProfile] = useState<CreatorProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>("boards");

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/creators/${fid}`)
      .then((r) => {
        if (!r.ok) throw new Error("Creator not found");
        return r.json();
      })
      .then((d) => { if (!cancelled) setProfile(d); })
      .catch((e) => { if (!cancelled) setError(e.message ?? "Failed to load"); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [fid]);

  const { hue, gradient } = useMemo(() => fidToAccent(fid), [fid]);

  const allBoards = useMemo(() => {
    if (!profile) return [];
    const map = new Map<string, Board>();
    for (const b of profile.recentBoards ?? []) map.set(b.id, b);
    for (const b of profile.boards ?? []) { if (!map.has(b.id)) map.set(b.id, b); }
    return [...map.values()].sort((a, b) => {
      if (a.isPublic !== b.isPublic) return (b.isPublic ? 1 : 0) - (a.isPublic ? 1 : 0);
      return (b.publishedAt ?? 0) - (a.publishedAt ?? 0);
    });
  }, [profile]);

  const spotlightBoard = useMemo(() => {
    const pub = allBoards.filter((b) => b.isPublic !== false && b.previewUrl);
    if (!pub.length) return null;
    return pub.reduce((best, b) => (b.viewCount ?? 0) >= (best.viewCount ?? 0) ? b : best);
  }, [allBoards]);

  const gridBoards = useMemo(
    () => allBoards.filter((b) => b.id !== spotlightBoard?.id),
    [allBoards, spotlightBoard],
  );

  const collections: Collection[] = profile?.collections ?? [];

  const warpcastUrl = profile?.username
    ? `https://warpcast.com/${profile.username}`
    : `https://warpcast.com/~/profiles/${fid}`;

  const heroBg = spotlightBoard?.previewUrl ?? null;

  if (loading) return <ProfileSkeleton />;

  if (error || !profile) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-2 text-center px-4">
        <p className="text-sm text-neutral-400 dark:text-neutral-600">
          {error ?? "Profile not found"}
        </p>
      </div>
    );
  }

  const stats = [
    { label: "Boards",  value: profile.stats.totalBoardsPublished },
    { label: "Views",   value: profile.stats.totalViews },
    { label: "Remixes", value: profile.stats.totalRemixes },
  ];

  const hasSocial = Object.keys(profile.socialLinks ?? {}).length > 0;

  return (
    <>
      <style>{`
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(10px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>

      {/* ── HERO ── */}
      <div className="relative h-52 overflow-hidden bg-black">
        {heroBg ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={heroBg}
            alt=""
            aria-hidden
            className="absolute inset-0 h-full w-full object-cover scale-110 blur-2xl opacity-50"
          />
        ) : (
          <div className="absolute inset-0" style={{ background: gradient }} />
        )}
        <div className="absolute inset-0 bg-gradient-to-b from-black/5 via-black/25 to-black/80" />

        {/* Avatar */}
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="relative h-16 w-16 rounded-full overflow-hidden ring-[2.5px] ring-white/20 shadow-xl shadow-black/40">
            {profile.pfpUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={profile.pfpUrl} alt={profile.username ?? ""} className="absolute inset-0 h-full w-full object-cover" />
            ) : (
              <div className="absolute inset-0" style={{ background: gradient }} />
            )}
          </div>
        </div>
      </div>

      {/* ── CARD ── */}
      <div className="relative -mt-6 rounded-t-3xl bg-white dark:bg-neutral-900 min-h-screen">
        <div className="px-5 pt-5">

          {/* Identity */}
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h1 className="text-[15px] font-semibold text-neutral-900 dark:text-white tracking-tight truncate">
                {profile.username ? `@${profile.username}` : `fid:${fid}`}
              </h1>
              {profile.followerCount > 0 && (
                <p className="mt-0.5 text-xs text-neutral-400 dark:text-neutral-600">
                  {formatCount(profile.followerCount)} followers
                </p>
              )}
            </div>

            <a
              href={warpcastUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-shrink-0 inline-flex items-center gap-1.5 rounded-full border border-neutral-200 dark:border-neutral-700 px-3.5 py-1.5 text-xs font-medium text-neutral-700 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors"
            >
              Follow
              <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M7 17L17 7M17 7H7M17 7v10" />
              </svg>
            </a>
          </div>

          {/* Bio */}
          {profile.bio && (
            <p className="mt-2.5 text-sm text-neutral-500 dark:text-neutral-400 leading-relaxed">
              {profile.bio}
            </p>
          )}

          {/* Social icons — icon only, no labels */}
          {hasSocial && (
            <div className="mt-3 flex items-center gap-3">
              {Object.entries(profile.socialLinks).map(([platform, url]) => (
                <a
                  key={platform}
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  title={platform}
                  className="text-neutral-400 dark:text-neutral-600 hover:text-neutral-700 dark:hover:text-neutral-300 transition-colors"
                >
                  {SOCIAL_ICONS[platform] ?? LinkIcon}
                </a>
              ))}
            </div>
          )}

          {/* ── Stats — pure typography, no boxes ── */}
          <div className="mt-5 flex divide-x divide-neutral-100 dark:divide-neutral-800 border-y border-neutral-100 dark:border-neutral-800">
            {stats.map((s) => (
              <div key={s.label} className="flex-1 flex flex-col items-center py-4 gap-0.5">
                <span className="text-[22px] font-semibold tracking-tight text-neutral-900 dark:text-white leading-none">
                  {formatCount(s.value)}
                </span>
                <span className="text-[10px] uppercase tracking-[0.12em] text-neutral-400 dark:text-neutral-600">
                  {s.label}
                </span>
              </div>
            ))}
          </div>

          {/* ── Tabs ── */}
          <div className="mt-5 flex gap-5 border-b border-neutral-100 dark:border-neutral-800">
            {(["boards", "collections"] as Tab[]).map((tab) => {
              const count = tab === "boards" ? allBoards.length : collections.length;
              const active = activeTab === tab;
              return (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`relative pb-3 text-sm capitalize transition-colors ${
                    active
                      ? "text-neutral-900 dark:text-white font-medium"
                      : "text-neutral-400 dark:text-neutral-600 hover:text-neutral-600 dark:hover:text-neutral-400"
                  }`}
                >
                  {tab}
                  {count > 0 && (
                    <span className="ml-1 text-[11px] text-neutral-400 dark:text-neutral-600">
                      {count}
                    </span>
                  )}
                  {active && (
                    <span
                      className="absolute bottom-0 left-0 right-0 h-[1.5px] rounded-full"
                      style={{ backgroundColor: `hsl(${hue},55%,55%)` }}
                    />
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* ── Tab content ── */}
        <div className="px-4 pb-16 mt-4">

          {/* BOARDS */}
          {activeTab === "boards" && (
            <div style={{ animation: "fadeUp 0.2s ease both" }}>
              {allBoards.length === 0 ? (
                <div className="py-20 text-center">
                  <p className="text-sm text-neutral-400 dark:text-neutral-600">
                    No boards published yet
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {spotlightBoard && <SpotlightBoard board={spotlightBoard} />}

                  {gridBoards.length > 0 && (
                    <>
                      {spotlightBoard && (
                        <div className="py-2 flex items-center gap-3">
                          <div className="flex-1 h-px bg-neutral-100 dark:bg-neutral-800" />
                          <span className="text-[9px] uppercase tracking-[0.15em] text-neutral-300 dark:text-neutral-700">
                            All
                          </span>
                          <div className="flex-1 h-px bg-neutral-100 dark:bg-neutral-800" />
                        </div>
                      )}
                      <div className="columns-2 gap-2 space-y-2">
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

          {/* COLLECTIONS */}
          {activeTab === "collections" && (
            <div style={{ animation: "fadeUp 0.2s ease both" }}>
              {collections.length === 0 ? (
                <div className="py-20 text-center">
                  <p className="text-sm text-neutral-400 dark:text-neutral-600">
                    No collections yet
                  </p>
                </div>
              ) : (
                <div>
                  {collections.map((c) => (
                    <CollectionRow key={c.id} collection={c} />
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

export async function fetchCreatorActivity(fid: string) {
  try {
    const res = await fetch(`/api/creators/${encodeURIComponent(fid)}/activity`);
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}
