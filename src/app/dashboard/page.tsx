"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import StatCard from "@/components/StatCard";
import { BoardCard } from "@/components/BoardCard";
import { DashboardBoardDetailModal } from "@/components/DashboardBoardDetailModal";

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

interface AnalyticsData {
  totalBoardsPublished: number;
  totalViews: number;
  totalRemixes: number;
  thisMonthViews: number;
  mostViewedBoard: Board | null;
}

interface Activity {
  id: string;
  type: string;
  boardId: string | null;
  fid: string | null;
  username?: string;
  details: Record<string, unknown>;
  createdAt: number;
}

type TabType = "boards" | "activity";
type VisibilityFilter = "all" | "public" | "private";

const DEFAULT_CATEGORIES = [
  "Art",
  "Design",
  "Mood",
  "Photography",
  "Fashion",
  "Lifestyle",
];

export default function DashboardPage() {
  const [activeTab, setActiveTab] = useState<TabType>("boards");
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [boards, setBoards] = useState<Board[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Filter states
  const [visibilityFilter, setVisibilityFilter] =
    useState<VisibilityFilter>("all");
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  // Pagination
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [selectedBoardId, setSelectedBoardId] = useState<string | null>(null);

  // Fetch analytics
  useEffect(() => {
    const fetchAnalytics = async () => {
      try {
        const response = await fetch("/api/creators/me/analytics");
        if (!response.ok) {
          throw new Error("Failed to fetch analytics");
        }
        const data = await response.json();
        setAnalytics(data);
      } catch (err) {
        console.error("Error fetching analytics:", err);
      }
    };

    fetchAnalytics();
  }, []);

  // Fetch boards with filters
  const fetchBoards = async (pageNum = 1, isRefresh = false) => {
    try {
      if (isRefresh) setRefreshing(true);
      else setLoading(true);

      const params = new URLSearchParams({
        page: pageNum.toString(),
        limit: "12",
        visibility: visibilityFilter !== "all" ? visibilityFilter : "all",
        ...(selectedCategory && { category: selectedCategory }),
        ...(searchQuery && { search: searchQuery }),
      });

      const response = await fetch(`/api/boards/user?${params.toString()}`);
      const data = await response.json();

      if (isRefresh) {
        setBoards(data.boards);
        setPage(1);
      } else {
        setBoards((prev) =>
          pageNum === 1 ? data.boards : [...prev, ...data.boards],
        );
        setPage(pageNum);
      }

      setHasMore(pageNum < (data.pagination?.pages || 0));
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch boards");
      console.error("Error fetching boards:", err);
    } finally {
      setRefreshing(false);
      setLoading(false);
    }
  };

  // Fetch activities
  const fetchActivities = async () => {
    try {
      setLoading(true);
      const response = await fetch("/api/creators/me/analytics");
      if (!response.ok) throw new Error("Failed to fetch activities");
      // For now, we'll use a placeholder - in production, create a separate /api/activity endpoint
      setActivities([]);
      setError(null);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to fetch activities",
      );
    } finally {
      setLoading(false);
    }
  };

  // Fetch data based on active tab
  useEffect(() => {
    if (activeTab === "boards") {
      setPage(1);
      setBoards([]);
      fetchBoards(1, false);
    } else {
      fetchActivities();
    }
  }, [activeTab, visibilityFilter, selectedCategory, searchQuery]);

  const handleRefresh = async () => {
    if (activeTab === "boards") {
      await fetchBoards(1, true);
    } else {
      await fetchActivities();
    }
  };

  const handleLoadMore = () => {
    if (!loading && hasMore && activeTab === "boards") {
      fetchBoards(page + 1, false);
    }
  };

  const selectedBoard = boards.find((b) => b.id === selectedBoardId) || null;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      {/* Header / Profile Section */}
      <div className="bg-white dark:bg-gray-900 shadow-sm sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-4xl font-bold text-gray-900 dark:text-white">
                Dashboard
              </h1>
              <p className="mt-2 text-gray-600 dark:text-gray-400">
                Manage and track your boards
              </p>
            </div>
            <Link
              href="/dashboard/create"
              className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors font-medium"
            >
              ➕<span>Create New</span>
            </Link>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Stats Grid */}
        {analytics && (
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4 mb-8">
            <StatCard
              label="Boards"
              value={analytics.totalBoardsPublished}
              icon="📋"
            />
            <StatCard
              label="Total Views"
              value={analytics.totalViews.toLocaleString()}
              icon="👁️"
            />
            <StatCard
              label="Remixes"
              value={analytics.totalRemixes}
              icon="🔄"
            />
            <StatCard
              label="This Month"
              value={analytics.thisMonthViews.toLocaleString()}
              icon="📅"
            />
          </div>
        )}

        {/* Tab Navigation */}
        <div className="flex gap-2 mb-6 border-b border-gray-200 bg-white rounded-t-lg">
          {(["boards", "activity"] as TabType[]).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-6 py-3 font-medium transition-colors border-b-2 ${
                activeTab === tab
                  ? "text-indigo-600 border-indigo-600"
                  : "text-gray-600 border-transparent hover:text-gray-900"
              }`}
            >
              {tab === "boards" ? "All Boards" : "Activity"}
            </button>
          ))}
        </div>

        {/* Boards Tab */}
        {activeTab === "boards" && (
          <div className="space-y-6">
            {/* Filters */}
            <div className="bg-white p-4 rounded-lg shadow-sm space-y-4">
              {/* Search */}
              <div className="relative">
                <span className="absolute left-3 top-3 text-gray-400">🔍</span>
                <input
                  type="text"
                  placeholder="Search boards..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              {/* Visibility Filters */}
              <div className="flex gap-2 flex-wrap">
                {(["all", "public", "private"] as VisibilityFilter[]).map(
                  (vis) => (
                    <button
                      key={vis}
                      onClick={() => setVisibilityFilter(vis)}
                      className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                        visibilityFilter === vis
                          ? "bg-indigo-600 text-white"
                          : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                      }`}
                    >
                      {vis === "all"
                        ? "All"
                        : vis.charAt(0).toUpperCase() + vis.slice(1)}
                    </button>
                  ),
                )}
              </div>

              {/* Category Filters */}
              <div className="flex gap-2 flex-wrap overflow-x-auto pb-2">
                <button
                  onClick={() => setSelectedCategory(null)}
                  className={`px-4 py-2 rounded-full text-sm font-medium transition-colors whitespace-nowrap ${
                    selectedCategory === null
                      ? "bg-indigo-600 text-white"
                      : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                  }`}
                >
                  All Categories
                </button>
                {DEFAULT_CATEGORIES.map((cat) => (
                  <button
                    key={cat}
                    onClick={() => setSelectedCategory(cat)}
                    className={`px-4 py-2 rounded-full text-sm font-medium transition-colors whitespace-nowrap ${
                      selectedCategory === cat
                        ? "bg-indigo-600 text-white"
                        : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>

            {/* Boards Grid */}
            {loading && page === 1 ? (
              <div className="flex justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-2 border-gray-300 border-t-indigo-600" />
              </div>
            ) : boards.length === 0 ? (
              <div className="text-center py-12 bg-white rounded-lg">
                <div className="text-gray-500 mb-3">📋 No boards found</div>
                <p className="text-sm text-gray-400">
                  Create your first board to get started!
                </p>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {boards.map((board) => (
                    <BoardCard
                      key={board.id}
                      board={board}
                      onPress={setSelectedBoardId}
                      onFavorite={(id) => console.log("Favorite:", id)}
                      onDelete={(id) => console.log("Delete:", id)}
                    />
                  ))}
                </div>

                {/* Load More */}
                {hasMore && (
                  <div className="flex justify-center pt-6">
                    <button
                      onClick={handleLoadMore}
                      disabled={loading}
                      className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50 font-medium"
                    >
                      {loading ? "Loading..." : "Load More"}
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* Activity Tab */}
        {activeTab === "activity" && (
          <div className="bg-white rounded-lg p-6 shadow-sm">
            {activities.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                No activity yet
              </div>
            ) : (
              <div className="space-y-4">
                {activities.map((activity) => (
                  <div
                    key={activity.id}
                    className="flex gap-4 pb-4 border-b last:border-0"
                  >
                    <div className="text-2xl">
                      {activity.type === "created"
                        ? "➕"
                        : activity.type === "modified"
                          ? "✏️"
                          : activity.type === "remixed"
                            ? "🔄"
                            : "◉"}
                    </div>
                    <div>
                      <p className="font-medium text-gray-900">
                        {activity.type.charAt(0).toUpperCase() +
                          activity.type.slice(1)}
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
      </div>

      {/* Board Detail Modal */}
      {selectedBoard && (
        <DashboardBoardDetailModal
          board={selectedBoard}
          isOpen={!!selectedBoardId}
          onClose={() => setSelectedBoardId(null)}
        />
      )}
    </div>
  );
}
