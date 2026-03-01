"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import StatCard from "@/components/StatCard";

interface AnalyticsData {
  totalBoardsPublished: number;
  totalViews: number;
  totalRemixes: number;
  thisMonthViews: number;
  mostViewedBoard: {
    id: string;
    title: string;
    previewUrl: string | null;
    viewCount: number;
  } | null;
  recentBoards: Array<{
    id: string;
    title: string;
    viewCount: number;
    editCount: number;
    publishedAt: number | null;
    previewUrl: string | null;
  }>;
}

export default function DashboardPage() {
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
        setError(err instanceof Error ? err.message : "Unknown error");
      } finally {
        setLoading(false);
      }
    };

    fetchAnalytics();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-gray-500 dark:text-gray-400">Loading...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-red-500 dark:text-red-400">{error}</div>
      </div>
    );
  }

  if (!analytics) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-gray-500 dark:text-gray-400">No data</div>
      </div>
    );
  }

  return (
    <div className="space-y-8 py-8">
      {/* Header */}
      <div>
        <h1 className="text-4xl font-bold text-gray-900 dark:text-white">
          Dashboard
        </h1>
        <p className="mt-2 text-gray-600 dark:text-gray-400">
          Track your board performance and engagement
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Total Boards"
          value={analytics.totalBoardsPublished}
          icon="📋"
        />
        <StatCard
          label="Total Views"
          value={analytics.totalViews.toLocaleString()}
          icon="👁️"
        />
        <StatCard
          label="This Month"
          value={analytics.thisMonthViews.toLocaleString()}
          icon="📅"
        />
        <StatCard label="Remixes" value={analytics.totalRemixes} icon="🔄" />
      </div>

      {/* Top Board */}
      {analytics.mostViewedBoard && (
        <div className="rounded-lg border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-gray-950">
          <h2 className="mb-4 text-xl font-bold text-gray-900 dark:text-white">
            🏆 Most Viewed Board
          </h2>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
            {analytics.mostViewedBoard.previewUrl && (
              <div className="relative h-32 w-44 rounded-lg overflow-hidden flex-shrink-0">
                <Image
                  src={analytics.mostViewedBoard.previewUrl}
                  alt={analytics.mostViewedBoard.title}
                  fill
                  className="object-cover"
                />
              </div>
            )}
            <div className="flex-1">
              <Link
                href={`/viewer/${analytics.mostViewedBoard.id}`}
                className="text-lg font-semibold text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
              >
                {analytics.mostViewedBoard.title}
              </Link>
              <p className="mt-2 text-gray-600 dark:text-gray-400">
                <span className="font-bold">
                  {analytics.mostViewedBoard.viewCount.toLocaleString()}
                </span>{" "}
                views
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Recent Boards Table */}
      <div className="rounded-lg border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-950">
        <div className="border-b border-gray-200 p-6 dark:border-gray-800">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">
            Recent Boards
          </h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="border-b border-gray-200 bg-gray-50 dark:border-gray-800 dark:bg-gray-900">
              <tr>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900 dark:text-white">
                  Board
                </th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900 dark:text-white">
                  Views
                </th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900 dark:text-white">
                  Edits
                </th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900 dark:text-white">
                  Published
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
              {analytics.recentBoards.map((board) => (
                <tr
                  key={board.id}
                  className="hover:bg-gray-50 dark:hover:bg-gray-900"
                >
                  <td className="px-6 py-4">
                    <Link
                      href={`/viewer/${board.id}`}
                      className="text-sm font-medium text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
                    >
                      {board.title}
                    </Link>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-900 dark:text-white">
                    {board.viewCount.toLocaleString()}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-900 dark:text-white">
                    {board.editCount}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400">
                    {board.publishedAt
                      ? new Date(board.publishedAt).toLocaleDateString()
                      : "Not published"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
