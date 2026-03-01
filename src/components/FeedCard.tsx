"use client";

import type { PublicBoardSummary } from "@/lib/cloud";

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

interface FeedCardProps {
  board: PublicBoardSummary;
  onClick: () => void;
}

export default function FeedCard({ board, onClick }: FeedCardProps) {
  return (
    <button
      onClick={onClick}
      className="group relative block w-full overflow-hidden rounded-lg border border-neutral-100 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-left shadow-sm transition-shadow hover:shadow-md"
    >
      {/* Thumbnail */}
      {board.thumbnailUrl ? (
        <img
          src={board.thumbnailUrl}
          alt={board.title}
          loading="lazy"
          className="aspect-[3/4] w-full object-cover"
        />
      ) : (
        <div className="flex aspect-[3/4] w-full items-center justify-center bg-neutral-100 dark:bg-neutral-700">
          <svg
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1"
            className="text-neutral-300 dark:text-neutral-500"
          >
            <rect x="3" y="3" width="18" height="18" rx="2" />
            <circle cx="8.5" cy="8.5" r="1.5" />
            <path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21" />
          </svg>
        </div>
      )}

      {/* Info */}
      <div className="px-3 py-2.5">
        <p className="truncate text-sm font-medium text-neutral-700 dark:text-neutral-200">
          {board.title}
        </p>

        {/* Creator */}
        <div className="mt-1 flex items-center gap-1.5">
          {board.creatorPfpUrl ? (
            <img
              src={board.creatorPfpUrl}
              alt=""
              className="h-4 w-4 rounded-full"
            />
          ) : (
            <div className="h-4 w-4 rounded-full bg-neutral-200 dark:bg-neutral-600" />
          )}
          <span className="truncate text-[11px] text-neutral-500 dark:text-neutral-400">
            @{board.creatorUsername}
          </span>
        </div>

        {/* Meta row */}
        <div className="mt-1.5 flex items-center gap-3 text-[10px] text-neutral-400">
          <span>{timeAgo(board.updatedAt)}</span>
          {board.viewCount > 0 && (
            <span className="flex items-center gap-0.5">
              <svg
                width="10"
                height="10"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                <circle cx="12" cy="12" r="3" />
              </svg>
              {board.viewCount}
            </span>
          )}
          {board.editCount > 0 && (
            <span className="flex items-center gap-0.5">
              🔀 {board.editCount}
            </span>
          )}
        </div>

        {/* Categories */}
        {board.categories.length > 0 && (
          <div className="mt-1.5 flex flex-wrap gap-1">
            {board.categories.slice(0, 2).map((c) => (
              <span
                key={c}
                className="rounded-sm bg-neutral-100 dark:bg-neutral-700 px-1.5 py-0.5 text-[9px] text-neutral-500 dark:text-neutral-400"
              >
                {c}
              </span>
            ))}
            {board.categories.length > 2 && (
              <span className="text-[9px] text-neutral-400">
                +{board.categories.length - 2}
              </span>
            )}
          </div>
        )}

        {/* Attribution chain */}
        {board.editHistory.length > 1 && (
          <div className="mt-1.5 flex items-center gap-1 text-[10px] text-blue-500 dark:text-blue-400">
            <span>🔀</span>
            <span className="truncate">
              {board.editHistory
                .slice(0, 3)
                .map((e) => `@${e.username}`)
                .join(" → ")}
              {board.editHistory.length > 3 &&
                ` +${board.editHistory.length - 3}`}
            </span>
          </div>
        )}
      </div>
    </button>
  );
}
