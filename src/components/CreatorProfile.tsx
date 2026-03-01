"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";

interface CreatorStats {
  totalBoardsPublished: number;
  totalViews: number;
  totalRemixes: number;
}

interface RecentBoard {
  id: string;
  title: string;
  previewUrl: string | null;
  viewCount: number;
  publishedAt: number | null;
}

interface CreatorProfileData {
  fid: string;
  username: string | null;
  pfpUrl: string | null;
  bio: string;
  socialLinks: Record<string, string>;
  followerCount: number;
  stats: CreatorStats;
  recentBoards: RecentBoard[];
}

export default function CreatorProfile({ fid }: { fid: string }) {
  const [profile, setProfile] = useState<CreatorProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const response = await fetch(`/api/creators/${fid}`);
        if (!response.ok) {
          throw new Error("Failed to fetch profile");
        }
        const data = await response.json();
        setProfile(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unknown error");
      } finally {
        setLoading(false);
      }
    };

    fetchProfile();
  }, [fid]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-gray-500 dark:text-gray-400">Loading...</div>
      </div>
    );
  }

  if (error || !profile) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-red-500 dark:text-red-400">
          {error || "Profile not found"}
        </div>
      </div>
    );
  }

  const getSocialIcon = (platform: string) => {
    const icons: Record<string, string> = {
      twitter: "𝕏",
      warpcast: "◈",
      instagram: "📷",
      website: "🔗",
    };
    return icons[platform] || "🔗";
  };

  return (
    <div className="space-y-8">
      {/* Creator Card */}
      <div className="rounded-lg border border-gray-200 bg-white p-8 dark:border-gray-800 dark:bg-gray-950">
        <div className="flex flex-col items-center space-y-4 sm:flex-row sm:space-y-0 sm:space-x-6">
          {profile.pfpUrl && (
            <div className="relative h-24 w-24 flex-shrink-0 rounded-full overflow-hidden">
              <Image
                src={profile.pfpUrl}
                alt={profile.username || "Creator"}
                fill
                className="object-cover"
              />
            </div>
          )}
          <div className="flex-1 text-center sm:text-left">
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
              {profile.username}
            </h1>
            {profile.bio && (
              <p className="mt-2 text-gray-600 dark:text-gray-400">
                {profile.bio}
              </p>
            )}
            <div className="mt-4 flex flex-wrap justify-center gap-3 sm:justify-start">
              {Object.entries(profile.socialLinks).map(([platform, url]) => (
                <a
                  key={platform}
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 rounded-md bg-gray-100 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
                >
                  <span>{getSocialIcon(platform)}</span>
                  <span className="capitalize">{platform}</span>
                </a>
              ))}
            </div>
          </div>
          <div className="text-center">
            <div className="text-3xl font-bold text-gray-900 dark:text-white">
              {profile.followerCount.toLocaleString()}
            </div>
            <div className="text-sm text-gray-500 dark:text-gray-400">
              Followers
            </div>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="rounded-lg border border-gray-200 bg-white p-4 text-center dark:border-gray-800 dark:bg-gray-950">
          <div className="text-2xl font-bold text-gray-900 dark:text-white">
            {profile.stats.totalBoardsPublished}
          </div>
          <div className="text-xs text-gray-500 dark:text-gray-400">Boards</div>
        </div>
        <div className="rounded-lg border border-gray-200 bg-white p-4 text-center dark:border-gray-800 dark:bg-gray-950">
          <div className="text-2xl font-bold text-gray-900 dark:text-white">
            {profile.stats.totalViews.toLocaleString()}
          </div>
          <div className="text-xs text-gray-500 dark:text-gray-400">Views</div>
        </div>
        <div className="rounded-lg border border-gray-200 bg-white p-4 text-center dark:border-gray-800 dark:bg-gray-950">
          <div className="text-2xl font-bold text-gray-900 dark:text-white">
            {profile.stats.totalRemixes}
          </div>
          <div className="text-xs text-gray-500 dark:text-gray-400">Remixes</div>
        </div>
      </div>

      {/* Recent Boards */}
      {profile.recentBoards.length > 0 && (
        <div>
          <h2 className="mb-4 text-2xl font-bold text-gray-900 dark:text-white">
            Recent Boards
          </h2>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
            {profile.recentBoards.map((board) => (
              <Link
                key={board.id}
                href={`/viewer/${board.id}`}
                className="group relative aspect-square overflow-hidden rounded-lg border border-gray-200 bg-gray-100 dark:border-gray-800 dark:bg-gray-900"
              >
                {board.previewUrl && (
                  <Image
                    src={board.previewUrl}
                    alt={board.title}
                    fill
                    className="object-cover transition-transform group-hover:scale-105"
                  />
                )}
                <div className="absolute inset-0 bg-black/0 transition-colors group-hover:bg-black/20">
                  <div className="absolute inset-0 flex flex-col items-center justify-center opacity-0 transition-opacity group-hover:opacity-100">
                    <div className="text-center">
                      <p className="text-sm font-bold text-white">
                        {board.title}
                      </p>
                      <p className="text-xs text-gray-200">
                        {board.viewCount} views
                      </p>
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
