"use client";

import { useEffect, useState } from "react";
import { BoardCard } from "./BoardCard";

interface Board {
  id: string;
  title: string;
  caption: string;
  previewUrl: string | null;
  viewCount: number;
  remixCount: number;
  likeCount: number;
  isPublic: boolean;
  primaryCategory: string;
  createdAt: number;
  updatedAt: number;
}

interface TrendingBoardsProps {
  timeRange?: "week" | "month";
}

export function TrendingBoards({ timeRange = "week" }: TrendingBoardsProps) {
  const [boards, setBoards] = useState<Board[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchTrending = async () => {
      try {
        const response = await fetch(
          `/api/boards/trending?timeRange=${timeRange}&limit=12`,
        );
        if (!response.ok) throw new Error("Failed to fetch trending");

        const data = await response.json();
        setBoards(data.trending || []);
      } catch (error) {
        console.error("Trending error:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchTrending();
  }, [timeRange]);

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow-md p-6 mb-6">
        <p className="text-gray-500">⏳ Loading trending boards...</p>
      </div>
    );
  }

  if (boards.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow-md p-6 mb-6">
        <p className="text-gray-500">🔥 No trending boards yet</p>
      </div>
    );
  }

  return (
    <div>
      <h2 className="text-lg font-semibold mb-4">
        🔥 Trending This {timeRange === "week" ? "Week" : "Month"}
      </h2>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 mb-6">
        {boards.map((board) => (
          <BoardCard key={board.id} board={board} onPress={() => {}} />
        ))}
      </div>
    </div>
  );
}
