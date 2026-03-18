"use client";

import { useState, useEffect, useCallback } from "react";
import { sdk } from "@farcaster/miniapp-sdk";
import type { PublicBoardDetail } from "@/lib/cloud";
import type { EditHistoryEntry } from "@/lib/storage";
import { formatAttribution } from "@/lib/canvas";
import MintButton from "./MintButton";

interface BoardDetailModalProps {
  boardId: string;
  onClose: () => void;
  onRemix: (boardId: string) => void;
  onEditPublished?: (boardId: string) => void;
  isAuthenticated: boolean;
  viewerFid?: string;
}

function timeAgo(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diff = now - then;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  return `${months}mo ago`;
}

function formatDateTime(dateStr: string): string {
  return new Date(dateStr).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

export default function BoardDetailModal({
  boardId,
  onClose,
  onRemix,
  onEditPublished,
  isAuthenticated,
  viewerFid,
}: BoardDetailModalProps) {
  const [board, setBoard] = useState<PublicBoardDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [remixing, setRemixing] = useState(false);

  const sortedCanvas = board
    ? (board.canvasState ?? []).slice().sort((a, b) => a.zIndex - b.zIndex)
    : [];
  const renderableCanvas =
    board && board.canvasWidth > 0 && board.canvasHeight > 0
      ? sortedCanvas.filter((ci) => !!board.imageMap?.[ci.imageHash]?.url)
      : [];
  const missingAssetCount = Math.max(
    0,
    sortedCanvas.length - renderableCanvas.length,
  );
  const isOwner = !!board && !!viewerFid && board.creatorFid === viewerFid;

  // Fetch board detail + increment view
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    (async () => {
      try {
        const [detailRes] = await Promise.all([
          fetch(`/api/boards/${boardId}/public`),
          fetch(`/api/boards/${boardId}/view`, { method: "POST" }).catch(
            () => {},
          ),
        ]);
        if (cancelled) return;
        if (!detailRes.ok) throw new Error("Board not found");
        const data: PublicBoardDetail = await detailRes.json();
        setBoard(data);
      } catch (err) {
        if (!cancelled)
          setError(err instanceof Error ? err.message : "Failed to load board");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [boardId]);

  const handleRemix = useCallback(async () => {
    setRemixing(true);
    try {
      onRemix(boardId);
    } finally {
      setRemixing(false);
    }
  }, [boardId, onRemix]);

  const handleEditPublished = useCallback(() => {
    if (!onEditPublished) return;
    onEditPublished(boardId);
    onClose();
  }, [boardId, onClose, onEditPublished]);

  const handleShare = useCallback(async () => {
    if (!board) return;
    const appDomain =
      process.env.NEXT_PUBLIC_APP_DOMAIN || "moodboard-generator-phi.vercel.app";
    const appUrl = appDomain.startsWith("http") ? appDomain : `https://${appDomain}`;
    const boardUrl = `${appUrl}/viewer/${boardId}`;
    const text = `Check out "${board.title}" 🎨`;
    try {
      // Open Farcaster cast composer with the board URL embedded as a Frame
      await sdk.actions.openUrl(
        `https://warpcast.com/~/compose?text=${encodeURIComponent(text)}&embeds[]=${encodeURIComponent(boardUrl)}`,
      );
    } catch {
      // Fallback: copy URL to clipboard
      await navigator.clipboard.writeText(boardUrl).catch(() => {});
    }
  }, [board, boardId]);

  // Close on escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 dark:bg-black/60 p-4 pt-[10vh]"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-lg rounded-xl bg-white dark:bg-neutral-800 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute right-3 top-3 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-white/80 dark:bg-neutral-700/80 text-neutral-500 shadow-sm hover:text-neutral-700 dark:hover:text-neutral-300"
          aria-label="Close"
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
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>

        {/* Content */}
        {loading ? (
          <div className="flex h-64 items-center justify-center">
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-neutral-300 dark:border-neutral-600 border-t-neutral-600 dark:border-t-neutral-300" />
          </div>
        ) : error ? (
          <div className="flex h-64 flex-col items-center justify-center gap-3">
            <p className="text-sm text-neutral-500 dark:text-neutral-400">
              {error}
            </p>
            <button
              onClick={onClose}
              className="text-sm text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300"
            >
              Close
            </button>
          </div>
        ) : board ? (
          <>
            {/* Canvas preview */}
            <div
              className="relative w-full overflow-hidden rounded-t-xl"
              style={{
                backgroundColor: board.background || "#f5f5f4",
                aspectRatio:
                  board.canvasWidth > 0 && board.canvasHeight > 0
                    ? `${board.canvasWidth}/${board.canvasHeight}`
                    : "3/4",
              }}
            >
              {renderableCanvas.length > 0 ? (
                renderableCanvas.map((ci) => {
                  const src = board.imageMap?.[ci.imageHash]?.url;
                  if (!src) return null;
                  return (
                    <img
                      key={ci.id}
                      src={src}
                      alt=""
                      className="absolute object-cover"
                      style={{
                        left: `${(ci.x / board.canvasWidth) * 100}%`,
                        top: `${(ci.y / board.canvasHeight) * 100}%`,
                        width: `${(ci.width / board.canvasWidth) * 100}%`,
                        height: `${(ci.height / board.canvasHeight) * 100}%`,
                        transform: `rotate(${ci.rotation}deg)`,
                        transformOrigin: "center center",
                      }}
                    />
                  );
                })
              ) : board.thumbnailUrl ? (
                <img
                  src={board.thumbnailUrl}
                  alt={board.title}
                  className="h-full w-full object-cover"
                />
              ) : (
                <span className="text-sm text-neutral-400">
                  No preview available
                </span>
              )}
            </div>

            {/* Board info */}
            <div className="px-5 py-4">
              <h2 className="text-lg font-semibold text-neutral-800 dark:text-neutral-100">
                {board.title}
              </h2>

              {board.caption && (
                <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
                  {board.caption}
                </p>
              )}

              {/* Creator */}
              <div className="mt-3 flex items-center gap-2">
                {board.creatorPfpUrl ? (
                  <img
                    src={board.creatorPfpUrl}
                    alt=""
                    className="h-6 w-6 rounded-full"
                  />
                ) : (
                  <div className="h-6 w-6 rounded-full bg-neutral-200 dark:bg-neutral-600" />
                )}
                <span className="text-sm text-neutral-600 dark:text-neutral-300">
                  @{board.creatorUsername}
                </span>
                <span className="text-xs text-neutral-400">
                  {timeAgo(board.createdAt)}
                </span>
              </div>

              {/* Stats */}
              <div className="mt-3 flex items-center gap-4 text-xs text-neutral-400">
                <span className="flex items-center gap-1">
                  <svg
                    width="12"
                    height="12"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                    <circle cx="12" cy="12" r="3" />
                  </svg>
                  {(board.viewCount || 0) + 1} views
                </span>
                {(board.editCount || 0) > 0 && (
                  <span className="flex items-center gap-1">
                    🔀 {board.editCount} remixes
                  </span>
                )}
              </div>

              {missingAssetCount > 0 && (
                <div className="mt-2 rounded-md bg-amber-50 dark:bg-amber-900/20 px-2.5 py-1.5 text-[11px] text-amber-700 dark:text-amber-300">
                  Preview is partial: {missingAssetCount} image source
                  {missingAssetCount > 1 ? "s are" : " is"} unavailable.
                </div>
              )}

              {/* Published / Updated timestamps */}
              <div className="mt-2 flex flex-col gap-0.5 text-[11px] text-neutral-400">
                {board.publishedAt && (
                  <span>Published on {formatDateTime(board.publishedAt)}</span>
                )}
                <span>Last updated {formatDateTime(board.updatedAt)}</span>
              </div>

              {/* Attribution chain */}
              {board.editHistory && board.editHistory.length > 0 && (
                <div className="mt-3 rounded-md bg-neutral-50 dark:bg-neutral-700/50 px-3 py-2">
                  <p className="text-[10px] uppercase tracking-wider text-neutral-400 mb-1.5">
                    Attribution Chain
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {board.editHistory.map(
                      (entry: EditHistoryEntry, i: number) => (
                        <span
                          key={i}
                          className="inline-flex items-center rounded-full bg-white dark:bg-neutral-600 px-2 py-0.5 text-[11px] text-neutral-600 dark:text-neutral-300 shadow-sm"
                        >
                          {i === 0 ? "🎨" : "🔀"} @{entry.username}
                        </span>
                      ),
                    )}
                  </div>
                  <p className="mt-1.5 text-[10px] text-neutral-400">
                    {formatAttribution(
                      board.creatorUsername,
                      board.editHistory,
                    )}
                  </p>
                </div>
              )}

              {/* Categories */}
              {board.categories.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {board.categories.map((c) => (
                    <span
                      key={c}
                      className="rounded-full border border-neutral-200 dark:border-neutral-600 px-2.5 py-0.5 text-[11px] text-neutral-500 dark:text-neutral-400"
                    >
                      {c}
                    </span>
                  ))}
                </div>
              )}

              {/* Action buttons */}
              <div className="mt-4 flex gap-3">
                {isOwner && (
                  <button
                    onClick={handleEditPublished}
                    className="flex flex-1 items-center justify-center gap-2 rounded-lg border border-neutral-200 dark:border-neutral-600 bg-white dark:bg-neutral-700 py-2.5 text-sm font-medium text-neutral-700 dark:text-neutral-200 transition-colors hover:bg-neutral-50 dark:hover:bg-neutral-600"
                  >
                    ✏️ Edit
                  </button>
                )}
                <button
                  onClick={handleRemix}
                  disabled={!isAuthenticated || remixing}
                  className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-neutral-800 dark:bg-neutral-200 py-2.5 text-sm font-medium text-white dark:text-neutral-800 transition-colors hover:bg-neutral-700 dark:hover:bg-neutral-300 disabled:opacity-50"
                >
                  {remixing ? (
                    <>
                      <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/30 dark:border-neutral-800/30 border-t-white dark:border-t-neutral-800" />
                      Remixing…
                    </>
                  ) : (
                    <>🔀 Remix</>
                  )}
                </button>
                <button
                  onClick={handleShare}
                  className="flex items-center justify-center gap-1.5 rounded-lg border border-neutral-200 dark:border-neutral-600 bg-white dark:bg-neutral-700 px-3 py-2.5 text-sm font-medium text-neutral-700 dark:text-neutral-200 transition-colors hover:bg-neutral-50 dark:hover:bg-neutral-600"
                  title="Share as Farcaster Frame"
                >
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/>
                    <polyline points="16 6 12 2 8 6"/>
                    <line x1="12" y1="2" x2="12" y2="15"/>
                  </svg>
                  Cast
                </button>
              </div>

              {/* Mint on Base — only shown to the board owner */}
              {isOwner && (
                <div className="mt-3">
                  <MintButton
                    boardId={boardId}
                    boardTitle={board.title}
                    existingTxHash={(board as PublicBoardDetail & { mintTxHash?: string }).mintTxHash}
                    existingContract={(board as PublicBoardDetail & { mintContractAddress?: string }).mintContractAddress}
                  />
                </div>
              )}

              {!isAuthenticated && (
                <p className="mt-2 text-center text-[10px] text-neutral-400">
                  Sign in via Warpcast to remix boards
                </p>
              )}
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
}
