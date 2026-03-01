"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { useCloud } from "@/components/CloudProvider";
import FeedCard from "@/components/FeedCard";
import BoardDetailModal from "@/components/BoardDetailModal";
import type { PublicBoardSummary } from "@/lib/cloud";
import type { FeedSortBy } from "@/lib/cloud";

const PAGE_SIZE = 12;

export default function FeedPage() {
  const router = useRouter();
  const { user } = useCloud();

  const [boards, setBoards] = useState<PublicBoardSummary[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState<FeedSortBy>("newest");
  const [selectedBoardId, setSelectedBoardId] = useState<string | null>(null);

  const searchDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);
  const observerRef = useRef<IntersectionObserver | null>(null);
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  // Fetch boards
  const fetchBoards = useCallback(
    async (offset: number, append: boolean) => {
      if (append) setLoadingMore(true);
      else setLoading(true);
      setError(null);

      try {
        const params = new URLSearchParams({
          limit: String(PAGE_SIZE),
          offset: String(offset),
          sortBy,
        });
        if (search.trim()) params.set("search", search.trim());

        const res = await fetch(`/api/boards/public?${params.toString()}`);
        if (!res.ok) throw new Error("Failed to load feed");
        const data = await res.json();

        setBoards((prev) => (append ? [...prev, ...data.boards] : data.boards));
        setTotal(data.total);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Something went wrong");
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [sortBy, search],
  );

  // Initial load + reload on sort/search change
  useEffect(() => {
    fetchBoards(0, false);
  }, [fetchBoards]);

  // Debounced search
  const handleSearchChange = useCallback((value: string) => {
    setSearch(value);
    if (searchDebounce.current) clearTimeout(searchDebounce.current);
    searchDebounce.current = setTimeout(() => {
      // fetchBoards will be called by the useEffect above
    }, 300);
  }, []);

  // Infinite scroll with Intersection Observer
  const hasMore = boards.length < total;

  useEffect(() => {
    if (observerRef.current) observerRef.current.disconnect();

    observerRef.current = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && hasMore && !loadingMore && !loading) {
          fetchBoards(boards.length, true);
        }
      },
      { threshold: 0.1 },
    );

    if (sentinelRef.current) {
      observerRef.current.observe(sentinelRef.current);
    }

    return () => observerRef.current?.disconnect();
  }, [hasMore, loadingMore, loading, boards.length, fetchBoards]);

  // Handle remix from board detail modal
  const handleRemix = useCallback(
    async (boardId: string) => {
      if (!user) return;
      try {
        // For remix, we need auth — redirect to main app with remix query
        router.push(`/?remix=${boardId}`);
      } catch {
        // handled in main app
      }
    },
    [user, router],
  );

  const handleEditPublished = useCallback(
    (boardId: string) => {
      if (!user) return;
      router.push(`/?editPublished=${boardId}`);
    },
    [user, router],
  );

  // Theme
  const [isDark, setIsDark] = useState(false);
  useEffect(() => {
    setIsDark(document.documentElement.classList.contains("dark"));
  }, []);
  const toggleTheme = useCallback(() => {
    const next = !isDark;
    setIsDark(next);
    document.documentElement.classList.toggle("dark", next);
    try {
      localStorage.setItem("theme", next ? "dark" : "light");
    } catch {
      /* ignore */
    }
  }, [isDark]);

  const SunIcon = () => (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="5" />
      <line x1="12" y1="1" x2="12" y2="3" />
      <line x1="12" y1="21" x2="12" y2="23" />
      <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
      <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
      <line x1="1" y1="12" x2="3" y2="12" />
      <line x1="21" y1="12" x2="23" y2="12" />
      <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
      <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
    </svg>
  );

  const MoonIcon = () => (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
    </svg>
  );

  return (
    <div className="min-h-[100dvh] bg-white dark:bg-neutral-900">
      {/* Header */}
      <div className="sticky top-0 z-30 bg-white/90 dark:bg-neutral-900/90 backdrop-blur-sm border-b border-neutral-100 dark:border-neutral-800">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <a
              href="/"
              className="text-[11px] uppercase tracking-widest text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300 transition-colors"
            >
              ← Create
            </a>
            <span className="text-[11px] uppercase tracking-widest text-neutral-700 dark:text-neutral-200 font-medium">
              Feed
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={toggleTheme}
              className="flex h-8 w-8 items-center justify-center rounded-full text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800 hover:text-neutral-600 dark:hover:text-neutral-300 transition-colors"
              aria-label={
                isDark ? "Switch to light mode" : "Switch to dark mode"
              }
            >
              {isDark ? <SunIcon /> : <MoonIcon />}
            </button>
            {user?.pfpUrl && (
              <img src={user.pfpUrl} alt="" className="h-6 w-6 rounded-full" />
            )}
          </div>
        </div>
      </div>

      {/* Search & Sort */}
      <div className="mx-auto max-w-3xl px-4 pt-4 pb-2">
        <div className="flex items-center gap-3">
          <div className="relative flex-1">
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400"
            >
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <input
              type="text"
              value={search}
              onChange={(e) => handleSearchChange(e.target.value)}
              placeholder="Search public boards…"
              className="w-full rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 py-2 pl-9 pr-3 text-sm text-neutral-700 dark:text-neutral-200 outline-none placeholder:text-neutral-400 focus:border-neutral-400 dark:focus:border-neutral-500 transition-colors"
            />
          </div>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as FeedSortBy)}
            className="rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 px-3 py-2 text-sm text-neutral-600 dark:text-neutral-300 outline-none"
          >
            <option value="newest">Newest</option>
            <option value="most_viewed">Most Viewed</option>
            <option value="trending">Trending</option>
          </select>
        </div>
      </div>

      {/* Feed grid */}
      <div className="mx-auto max-w-3xl px-4 py-4">
        {loading && boards.length === 0 ? (
          <div className="flex h-60 items-center justify-center">
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-neutral-300 dark:border-neutral-600 border-t-neutral-600 dark:border-t-neutral-300" />
          </div>
        ) : error ? (
          <div className="flex h-60 flex-col items-center justify-center gap-3">
            <p className="text-sm text-neutral-500 dark:text-neutral-400">
              {error}
            </p>
            <button
              onClick={() => fetchBoards(0, false)}
              className="text-sm text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300"
            >
              Try again
            </button>
          </div>
        ) : boards.length === 0 ? (
          <div className="flex h-60 flex-col items-center justify-center gap-2">
            <svg
              width="32"
              height="32"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1"
              className="text-neutral-300 dark:text-neutral-600"
            >
              <circle cx="12" cy="12" r="10" />
              <path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
            </svg>
            <p className="text-sm text-neutral-400">No public boards yet</p>
            <p className="text-[11px] text-neutral-400">
              Be the first to{" "}
              <a
                href="/"
                className="underline hover:text-neutral-600 dark:hover:text-neutral-300"
              >
                create and share
              </a>{" "}
              a moodboard!
            </p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {boards.map((board) => (
                <FeedCard
                  key={board.id}
                  board={board}
                  onClick={() => setSelectedBoardId(board.id)}
                />
              ))}
            </div>

            {/* Infinite scroll sentinel */}
            {hasMore && (
              <div ref={sentinelRef} className="flex justify-center py-6">
                {loadingMore && (
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-neutral-300 dark:border-neutral-600 border-t-neutral-600 dark:border-t-neutral-300" />
                )}
              </div>
            )}

            {!hasMore && boards.length > 0 && (
              <p className="py-6 text-center text-[11px] text-neutral-400">
                You&apos;ve seen all {total} boards
              </p>
            )}
          </>
        )}
      </div>

      {/* Board detail modal */}
      {selectedBoardId && (
        <BoardDetailModal
          boardId={selectedBoardId}
          onClose={() => setSelectedBoardId(null)}
          onRemix={handleRemix}
          onEditPublished={handleEditPublished}
          isAuthenticated={!!user}
          viewerFid={user?.fid ? String(user.fid) : undefined}
        />
      )}
    </div>
  );
}
