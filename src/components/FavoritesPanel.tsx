"use client";

import { useState, useEffect } from "react";
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

interface FavoritesPanelProps {
  isOpen: boolean;
}

export function FavoritesPanel({ isOpen }: FavoritesPanelProps) {
  const [favorites, setFavorites] = useState<Board[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isOpen) return;

    const fetchFavorites = async () => {
      try {
        const response = await fetch("/api/favorites");
        if (!response.ok) throw new Error("Failed to fetch favorites");

        const data = await response.json();
        setFavorites(data.favorites || []);
      } catch (error) {
        console.error("Favorites error:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchFavorites();
  }, [isOpen]);

  if (!isOpen) {
    return null;
  }

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow-md p-6 mb-6">
        <p className="text-gray-500">⏳ Loading favorites...</p>
      </div>
    );
  }

  if (favorites.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow-md p-6 mb-6">
        <p className="text-gray-500">❤️ No favorites yet</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-md p-6 mb-6">
      <h2 className="text-lg font-semibold mb-4">
        ❤️ Your Favorites ({favorites.length})
      </h2>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {favorites.map((board) => (
          <BoardCard key={board.id} board={board} onPress={() => {}} />
        ))}
      </div>
    </div>
  );
}
