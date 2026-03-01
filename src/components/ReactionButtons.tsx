"use client";

import { useEffect, useState } from "react";
import Image from "next/image";

interface Reactor {
  fid: string;
  username: string | null;
  pfpUrl: string | null;
}

interface ReactionData {
  count: number;
  reactors: Reactor[];
}

interface ReactionButtonsProps {
  boardId: string;
  onlyDisplay?: boolean;
}

const EMOJIS = ["👍", "❤️", "🔥", "✨"];

export default function ReactionButtons({
  boardId,
  onlyDisplay = false,
}: ReactionButtonsProps) {
  const [reactions, setReactions] = useState<Record<string, ReactionData>>({});
  const [userReactions, setUserReactions] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchReactions();
  }, [boardId]);

  const fetchReactions = async () => {
    try {
      const response = await fetch(`/api/boards/${boardId}/reactions`);
      if (response.ok) {
        const data = await response.json();
        setReactions(data.reactions || {});
      }
    } catch (error) {
      console.error("Error fetching reactions:", error);
    } finally {
      setLoading(false);
    }
  };

  const toggleReaction = async (emoji: string) => {
    if (onlyDisplay) return;

    try {
      const response = await fetch(`/api/boards/${boardId}/reactions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ emoji }),
      });

      if (response.ok) {
        const data = await response.json();
        if (data.action === "added") {
          setUserReactions((prev) => new Set([...prev, emoji]));
        } else {
          setUserReactions((prev) => {
            const next = new Set(prev);
            next.delete(emoji);
            return next;
          });
        }
        // Refresh reactions
        fetchReactions();
      }
    } catch (error) {
      console.error("Error toggling reaction:", error);
    }
  };

  if (loading) {
    return <div className="text-sm text-gray-500 dark:text-gray-400">...</div>;
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {EMOJIS.map((emoji) => {
        const data = reactions[emoji];
        const isSelected = userReactions.has(emoji);

        return (
          <div key={emoji}>
            <button
              onClick={() => toggleReaction(emoji)}
              disabled={onlyDisplay}
              className={`flex items-center gap-2 rounded-full px-3 py-2 text-sm font-medium transition-colors ${
                isSelected
                  ? "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300"
                  : "bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
              } ${onlyDisplay ? "cursor-default" : "cursor-pointer"}`}
            >
              <span>{emoji}</span>
              {data && <span>{data.count}</span>}
            </button>

            {/* Reactors Tooltip */}
            {data && data.reactors.length > 0 && (
              <div className="group relative">
                <div
                  className="absolute bottom-full left-0 mb-2 hidden flex-col gap-1 rounded-lg border border-gray-200 bg-white p-2 shadow-lg group-hover:flex dark:border-gray-700 dark:bg-gray-900"
                  style={{ minWidth: "180px" }}
                >
                  {data.reactors.slice(0, 5).map((reactor) => (
                    <div
                      key={reactor.fid}
                      className="flex items-center gap-2 text-xs"
                    >
                      {reactor.pfpUrl && (
                        <Image
                          src={reactor.pfpUrl}
                          alt={reactor.username || "User"}
                          width={20}
                          height={20}
                          className="rounded-full"
                        />
                      )}
                      <span className="truncate text-gray-700 dark:text-gray-300">
                        {reactor.username || "Anonymous"}
                      </span>
                    </div>
                  ))}
                  {data.reactors.length > 5 && (
                    <div className="text-xs text-gray-500 dark:text-gray-400">
                      +{data.reactors.length - 5} more
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
