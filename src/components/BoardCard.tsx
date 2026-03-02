"use client";

import Image from "next/image";
import { useState } from "react";

interface Board {
  id: string;
  title: string;
  previewUrl: string | null;
  viewCount: number;
  remixCount: number;
  likeCount: number;
  isPublic: boolean;
  primaryCategory: string;
  updatedAt: number;
}

interface BoardCardProps {
  board: Board;
  onPress: (boardId: string) => void;
  onFavorite?: (boardId: string) => void;
  onDelete?: (boardId: string) => void;
}

export function BoardCard({
  board,
  onPress,
  onFavorite,
  onDelete,
}: BoardCardProps) {
  const [isFavorite, setIsFavorite] = useState(false);

  const handleFavorite = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsFavorite(!isFavorite);
    onFavorite?.(board.id);
  };

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (window.confirm("Are you sure you want to delete this board?")) {
      onDelete?.(board.id);
    }
  };

  return (
    <div
      onClick={() => onPress(board.id)}
      className="group cursor-pointer rounded-lg overflow-hidden bg-white shadow-sm hover:shadow-md transition-shadow"
    >
      {/* Board Thumbnail */}
      <div className="relative w-full aspect-video bg-gray-200 overflow-hidden">
        {board.previewUrl ? (
          <Image
            src={board.previewUrl}
            alt={board.title}
            fill
            className="object-cover group-hover:scale-105 transition-transform duration-300"
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-gray-300 to-gray-400 flex items-center justify-center">
            <span className="text-gray-500 text-sm">No Preview</span>
          </div>
        )}

        {/* Visibility Badge */}
        <div className="absolute top-3 right-3 flex items-center gap-1 bg-black/60 text-white px-2 py-1 rounded-full text-xs backdrop-blur-sm">
          {board.isPublic ? (
            <>
              <span>🌐</span>
              <span>Public</span>
            </>
          ) : (
            <>
              <span>🔒</span>
              <span>Private</span>
            </>
          )}
        </div>

        {/* Stats Badges */}
        <div className="absolute bottom-3 left-3 flex gap-2 flex-wrap">
          <div className="bg-black/60 text-white px-2 py-1 rounded text-xs backdrop-blur-sm flex items-center gap-1">
            <span>👁️</span>
            <span>{board.viewCount}</span>
          </div>
          <div className="bg-black/60 text-white px-2 py-1 rounded text-xs backdrop-blur-sm flex items-center gap-1">
            <span>🔄</span>
            <span>{board.remixCount}</span>
          </div>
        </div>
      </div>

      {/* Board Info */}
      <div className="p-3">
        <h3 className="font-semibold text-sm text-gray-900 truncate">
          {board.title}
        </h3>
        <div className="flex items-center justify-between mt-2 text-xs text-gray-500">
          <span className="bg-gray-100 px-2 py-1 rounded text-gray-700 font-medium">
            {board.primaryCategory}
          </span>
          <span>
            {new Date(board.updatedAt).toLocaleDateString("en-US", {
              month: "short",
              day: "numeric",
            })}
          </span>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="flex items-center justify-between gap-2 p-3 border-t border-gray-100 bg-gray-50 opacity-0 group-hover:opacity-100 transition-opacity">
        <button
          onClick={handleFavorite}
          className="flex-1 flex items-center justify-center gap-1 py-2 text-gray-700 hover:text-red-500 transition-colors"
          title="Favorite"
        >
          {isFavorite ? "❤️" : "🤍"}
        </button>
        <button
          onClick={handleDelete}
          className="flex-1 flex items-center justify-center gap-1 py-2 text-gray-700 hover:text-red-500 transition-colors"
          title="Delete"
        >
          🗑️
        </button>
      </div>
    </div>
  );
}
