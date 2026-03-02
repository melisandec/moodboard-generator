"use client";

import { useEffect, useState } from "react";

interface AnalyticsStat {
  label: string;
  value: number;
  icon: string;
  color: string;
  trend?: number;
}

interface AnalyticsPanelProps {
  isOpen: boolean;
}

export function AnalyticsPanel({ isOpen }: AnalyticsPanelProps) {
  const [stats, setStats] = useState<AnalyticsStat[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isOpen) return;

    const fetchAnalytics = async () => {
      try {
        const response = await fetch("/api/user/analytics");
        if (!response.ok) throw new Error("Failed to fetch analytics");

        const data = await response.json();
        const s = data.stats;

        setStats([
          {
            label: "Published",
            value: s.totalPublished,
            icon: "📊",
            color: "bg-blue-100",
          },
          {
            label: "Total Views",
            value: s.totalViews,
            icon: "👁️",
            color: "bg-purple-100",
          },
          {
            label: "Remixes",
            value: s.totalRemixes,
            icon: "🔄",
            color: "bg-green-100",
          },
          {
            label: "Likes",
            value: s.totalLikes,
            icon: "❤️",
            color: "bg-red-100",
          },
          {
            label: "This Month",
            value: s.thisMonthViews,
            icon: "📈",
            color: "bg-orange-100",
          },
        ]);
      } catch (error) {
        console.error("Analytics error:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchAnalytics();
  }, [isOpen]);

  if (!isOpen || loading) {
    return null;
  }

  return (
    <div className="bg-white rounded-lg shadow-md p-6 mb-6">
      <h2 className="text-lg font-semibold mb-4">📊 Your Analytics</h2>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        {stats.map((stat) => (
          <div
            key={stat.label}
            className={`${stat.color} rounded-lg p-4 text-center`}
          >
            <div className="text-2xl mb-2">{stat.icon}</div>
            <div className="text-2xl font-bold text-gray-800">
              {stat.value.toLocaleString()}
            </div>
            <div className="text-sm text-gray-600">{stat.label}</div>
            {stat.trend && (
              <div className="text-xs text-green-600 mt-1">
                ↑ {stat.trend}% from last month
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
