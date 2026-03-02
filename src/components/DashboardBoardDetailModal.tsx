"use client";

import { useState, useEffect, useCallback } from "react";
import Image from "next/image";

interface Activity {
  id: string;
  type: string;
  username: string | null;
  createdAt: number;
  details: Record<string, unknown>;
}

interface BoardImage {
  id: string;
  imageHash: string;
  url: string;
  filename: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

interface RemixItem {
  remixBoardId: string;
  remixTitle: string;
  remixPreviewUrl: string | null;
  creatorUsername: string | null;
  createdAt: number;
}

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

type DetailTab = "overview" | "history" | "gallery" | "remixes";

interface DashboardBoardDetailModalProps {
  board: Board | null;
  isOpen: boolean;
  onClose: () => void;
}

const getActivityIcon = (type: string) => {
  switch (type) {
    case "created":
      return "➕";
    case "modified":
      return "✏️";
    case "remixed":
      return "🔄";
    case "liked":
      return "❤️";
    default:
      return "◉";
  }
};

const getActivityLabel = (type: string) => {
  switch (type) {
    case "created":
      return "Created";
    case "modified":
      return "Modified";
    case "remixed":
      return "Remixed";
    case "liked":
      return "Liked";
    default:
      return type.charAt(0).toUpperCase() + type.slice(1);
  }
};

export function DashboardBoardDetailModal({
  board,
  isOpen,
  onClose,
}: DashboardBoardDetailModalProps) {
  const [activeTab, setActiveTab] = useState<DetailTab>("overview");
  const [activities, setActivities] = useState<Activity[]>([]);
  const [boardImages, setBoardImages] = useState<BoardImage[]>([]);
  const [remixes, setRemixes] = useState<RemixItem[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchActivity = useCallback(async () => {
    if (!board) return;
    try {
      setLoading(true);
      const response = await fetch(`/api/boards/${board.id}/activity?limit=20`);
      const data = await response.json();
      setActivities(data.activities || []);
    } catch (error) {
      console.error("Error fetching activity:", error);
    } finally {
      setLoading(false);
    }
  }, [board]);

  const fetchImages = useCallback(async () => {
    if (!board) return;
    try {
      setLoading(true);
      const response = await fetch(
        `/api/boards/${board.id}/images?page=1&limit=20`,
      );
      const data = await response.json();
      setBoardImages(data.images || []);
    } catch (error) {
      console.error("Error fetching images:", error);
    } finally {
      setLoading(false);
    }
  }, [board]);

  const fetchRemixes = useCallback(async () => {
    if (!board) return;
    try {
      setLoading(true);
      const response = await fetch(`/api/boards/${board.id}/remixes`);
      const data = await response.json();
      setRemixes(data.remixHistory || []);
    } catch (error) {
      console.error("Error fetching remixes:", error);
    } finally {
      setLoading(false);
    }
  }, [board]);

  // Fetch activity when history tab is opened
  useEffect(() => {
    if (isOpen && activeTab === "history" && board) {
      fetchActivity();
    }
  }, [isOpen, activeTab, board, fetchActivity]);

  // Fetch images when gallery tab is opened
  useEffect(() => {
    if (isOpen && activeTab === "gallery" && board) {
      fetchImages();
    }
  }, [isOpen, activeTab, board, fetchImages]);

  // Fetch remixes when remixes tab is opened
  useEffect(() => {
    if (isOpen && activeTab === "remixes" && board) {
      fetchRemixes();
    }
  }, [isOpen, activeTab, board, fetchRemixes]);

  if (!isOpen || !board) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 z-40 transition-opacity"
        onClick={onClose}
      />

      {/* Modal - Bottom Sheet Style */}
      <div className="fixed inset-x-0 bottom-0 z-50 max-h-[90vh] bg-white rounded-t-2xl overflow-hidden flex flex-col shadow-2xl">
        {/* Handle Bar */}
        <div className="flex justify-center py-3">
          <div className="w-12 h-1 bg-gray-300 rounded-full" />
        </div>

        {/* Header */}
        <div className="flex items-start justify-between px-6 py-3 border-b border-gray-200">
          <div className="flex-1 pr-4">
            <h2 className="text-xl font-bold text-gray-900 line-clamp-2">
              {board.title}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="flex-shrink-0 text-gray-400 hover:text-gray-600 transition-colors"
            title="Close modal"
          >
            ✕
          </button>
        </div>

        {/* Tab Buttons */}
        <div className="flex border-b border-gray-200 px-6 overflow-x-auto">
          {(["overview", "history", "gallery", "remixes"] as DetailTab[]).map(
            (tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-4 py-3 font-medium text-sm transition-colors border-b-2 whitespace-nowrap ${
                  activeTab === tab
                    ? "text-indigo-600 border-indigo-600"
                    : "text-gray-600 border-transparent hover:text-gray-900"
                }`}
              >
                {tab === "overview" && "Overview"}
                {tab === "history" && "History"}
                {tab === "gallery" && "Gallery"}
                {tab === "remixes" && `🔄 Remixes (${remixes.length})`}
              </button>
            ),
          )}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {/* Overview Tab */}
          {activeTab === "overview" && (
            <div className="space-y-6 px-6 py-6">
              {/* Stats Grid */}
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                <div className="bg-gray-50 rounded-lg p-4 text-center">
                  <div className="text-2xl font-bold text-indigo-600">
                    {board.viewCount}
                  </div>
                  <div className="text-sm text-gray-600 mt-1">👁️ Views</div>
                </div>
                <div className="bg-gray-50 rounded-lg p-4 text-center">
                  <div className="text-2xl font-bold text-amber-600">
                    {board.remixCount}
                  </div>
                  <div className="text-sm text-gray-600 mt-1">🔄 Remixes</div>
                </div>
                <div className="bg-gray-50 rounded-lg p-4 text-center">
                  <div className="text-2xl font-bold text-red-600">
                    {board.likeCount}
                  </div>
                  <div className="text-sm text-gray-600 mt-1">❤️ Likes</div>
                </div>
                <div className="bg-gray-50 rounded-lg p-4 text-center">
                  <div className="text-sm font-bold text-gray-900">
                    {board.isPublic ? "Public" : "Private"}
                  </div>
                  <div className="text-sm text-gray-600 mt-1">Status</div>
                </div>
              </div>

              {/* Description */}
              {board.caption && (
                <div>
                  <h3 className="font-semibold text-gray-900 mb-2">
                    Description
                  </h3>
                  <p className="text-gray-700 text-sm leading-relaxed">
                    {board.caption}
                  </p>
                </div>
              )}

              {/* Details */}
              <div>
                <h3 className="font-semibold text-gray-900 mb-3">Details</h3>
                <div className="space-y-2">
                  <div className="flex justify-between py-2 border-b border-gray-100">
                    <span className="text-sm text-gray-600">Category</span>
                    <span className="font-medium text-gray-900">
                      {board.primaryCategory}
                    </span>
                  </div>
                  <div className="flex justify-between py-2 border-b border-gray-100">
                    <span className="text-sm text-gray-600">Created</span>
                    <span className="font-medium text-gray-900">
                      {new Date(board.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                  <div className="flex justify-between py-2">
                    <span className="text-sm text-gray-600">Updated</span>
                    <span className="font-medium text-gray-900">
                      {new Date(board.updatedAt).toLocaleDateString()}
                    </span>
                  </div>
                </div>
              </div>

              {/* Quick Actions */}
              <div className="grid grid-cols-3 gap-2 sm:gap-3 pt-4">
                <button className="flex items-center justify-center gap-2 py-3 px-4 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors font-medium text-sm">
                  ✏️ <span className="hidden sm:inline">Edit</span>
                </button>
                <button className="flex items-center justify-center gap-2 py-3 px-4 bg-amber-600 text-white rounded-lg hover:bg-amber-700 transition-colors font-medium text-sm">
                  🔄 <span className="hidden sm:inline">Remix</span>
                </button>
                <button className="flex items-center justify-center gap-2 py-3 px-4 bg-gray-200 text-gray-900 rounded-lg hover:bg-gray-300 transition-colors font-medium text-sm">
                  📤 <span className="hidden sm:inline">Share</span>
                </button>
              </div>
            </div>
          )}

          {/* History Tab */}
          {activeTab === "history" && (
            <div className="px-6 py-6">
              {loading ? (
                <div className="text-center py-8 text-gray-500">
                  Loading activity...
                </div>
              ) : activities.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  No activity yet
                </div>
              ) : (
                <div className="space-y-4">
                  {activities.map((activity) => (
                    <div key={activity.id} className="flex gap-4">
                      <div className="flex-shrink-0 w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center text-lg">
                        {getActivityIcon(activity.type)}
                      </div>
                      <div className="flex-1">
                        <p className="font-medium text-gray-900">
                          {getActivityLabel(activity.type)}
                          {activity.username && (
                            <span className="text-gray-600 ml-2">
                              by {activity.username}
                            </span>
                          )}
                        </p>
                        <p className="text-sm text-gray-500">
                          {new Date(activity.createdAt).toLocaleString()}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Gallery Tab */}
          {activeTab === "gallery" && (
            <div className="px-6 py-6">
              {loading ? (
                <div className="text-center py-8 text-gray-500">
                  Loading images...
                </div>
              ) : boardImages.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  No images in this board
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
                  {boardImages.map((image) => (
                    <div
                      key={image.id}
                      className="group rounded-lg overflow-hidden bg-gray-100 aspect-square"
                    >
                      {image.url ? (
                        <Image
                          src={image.url}
                          alt={image.filename}
                          fill
                          className="object-cover group-hover:scale-105 transition-transform"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-gray-400">
                          <span className="text-sm">No preview</span>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Remixes Tab - Phase 6 */}
          {activeTab === "remixes" && (
            <div className="px-6 py-6">
              {loading ? (
                <div className="text-center py-8 text-gray-500">
                  Loading remixes...
                </div>
              ) : remixes.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  No remixes yet. Be the first to remix this board! 🎨
                </div>
              ) : (
                <div className="space-y-4">
                  {remixes.map((remix) => (
                    <div
                      key={remix.remixBoardId}
                      className="flex gap-4 p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition"
                    >
                      {/* Thumbnail */}
                      <div className="flex-shrink-0 w-16 h-16 bg-gray-100 rounded-lg overflow-hidden">
                        {remix.remixPreviewUrl ? (
                          <Image
                            src={remix.remixPreviewUrl}
                            alt={remix.remixTitle}
                            width={64}
                            height={64}
                            className="object-cover w-full h-full"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-gray-400">
                            <span className="text-xs">No preview</span>
                          </div>
                        )}
                      </div>

                      {/* Info */}
                      <div className="flex-1">
                        <h4 className="font-medium text-gray-900 truncate">
                          {remix.remixTitle}
                        </h4>
                        <p className="text-sm text-gray-600 mt-1">
                          Remixed by {remix.creatorUsername || "Unknown"}
                        </p>
                        <p className="text-xs text-gray-500 mt-2">
                          {new Date(remix.createdAt).toLocaleDateString()}
                        </p>
                      </div>

                      {/* Action */}
                      <div className="flex-shrink-0">
                        <button className="p-2 text-gray-400 hover:text-gray-600 transition">
                          →
                        </button>
                      </div>
                    </div>
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
