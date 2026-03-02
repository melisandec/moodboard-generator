"use client";

import { useState, useCallback } from "react";

interface SearchBarProps {
  onSearch: (query: string, sortBy: string, timeRange: string) => void;
  isLoading?: boolean;
}

export function SearchBar({ onSearch, isLoading = false }: SearchBarProps) {
  const [query, setQuery] = useState("");
  const [sortBy, setSortBy] = useState("newest");
  const [timeRange, setTimeRange] = useState("all");

  const handleSearch = useCallback(() => {
    onSearch(query, sortBy, timeRange);
  }, [query, sortBy, timeRange, onSearch]);

  return (
    <div className="w-full bg-white rounded-lg shadow-sm p-4 mb-6">
      <div className="space-y-4">
        {/* Search Input */}
        <div className="relative">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSearch()}
            placeholder="🔍 Search boards, artists, styles..."
            className="w-full px-4 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* Filters Row */}
        <div className="flex gap-4 flex-wrap">
          {/* Sort */}
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="px-3 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
            aria-label="Sort by"
          >
            <option value="newest">📅 Newest</option>
            <option value="views">👁️ Most Viewed</option>
            <option value="remixes">🔄 Most Remixed</option>
            <option value="likes">❤️ Most Liked</option>
          </select>

          {/* Time Range */}
          <select
            value={timeRange}
            onChange={(e) => setTimeRange(e.target.value)}
            className="px-3 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
            aria-label="Time range"
          >
            <option value="all">All Time</option>
            <option value="week">This Week</option>
            <option value="month">This Month</option>
            <option value="year">This Year</option>
          </select>

          {/* Search Button */}
          <button
            onClick={handleSearch}
            disabled={isLoading}
            className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:bg-gray-400 transition"
          >
            {isLoading ? "⏳ Searching..." : "Search"}
          </button>
        </div>
      </div>
    </div>
  );
}
