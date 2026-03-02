"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useMemo } from "react";

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
          {/* followers removed - we don't support follow/unfollow in this app */}
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
          <div className="text-xs text-gray-500 dark:text-gray-400">
            Remixes
          </div>
        </div>
      </div>

      {/* Collections */}
      <CollectionsSection fid={fid} />

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

      {/* Recent Activity */}
      <div>
        <h2 className="mb-4 text-2xl font-bold text-gray-900 dark:text-white">Recent Activity</h2>
        <ActivityList activityEndpoint={`/api/creators/${fid}`} />
      </div>
    </div>
  );
}

function ActivityList({ activityEndpoint }: { activityEndpoint: string }) {
  const [items, setItems] = useState<any[] | null>(null);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      try {
        const res = await fetch(activityEndpoint);
        if (!res.ok) return setItems([]);
        const data = await res.json();
        // The creator endpoint returns `recentActivity` now when called as /api/creators/:fid
        const list = data.recentActivity || [];
        if (!mounted) return;
        setItems(list);
      } catch (e) {
        setItems([]);
      }
    };
    load();
    return () => { mounted = false; };
  }, [activityEndpoint]);

  if (!items) return <div className="text-gray-500">Loading activity...</div>;
  if (items.length === 0) return <div className="text-sm text-gray-500">No recent activity.</div>;

  return (
    <ul className="space-y-3">
      {items.map((a) => (
        <li key={a.id} className="rounded-md border border-gray-200 bg-white p-3 dark:border-gray-800 dark:bg-gray-950">
          <div className="text-sm text-gray-700 dark:text-gray-200">
            <strong className="capitalize">{a.type}</strong>
            {a.boardId ? (
              <span> on <Link href={`/viewer/${a.boardId}`} className="font-medium">{a.boardId}</Link></span>
            ) : null}
          </div>
          <div className="text-xs text-gray-500 dark:text-gray-400">{new Date(a.createdAt).toLocaleString()}</div>
        </li>
      ))}
    </ul>
  );
}

function CollectionsSection({ fid }: { fid: string }) {
  const [collections, setCollections] = useState<{
    id: string;
    title: string;
    boardCount: number;
  }[] | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let mounted = true;
    const fetchCollections = async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/folders?fid=${encodeURIComponent(fid)}`);
        if (!res.ok) {
          setCollections([]);
          return;
        }
        const data = await res.json();
        if (!mounted) return;
        // assume data.folders or data
        setCollections(data.folders || data || []);
      } catch (e) {
        setCollections([]);
      } finally {
        setLoading(false);
      }
    };

    fetchCollections();
    return () => {
      mounted = false;
    };
  }, [fid]);

  if (loading) {
    return (
      <div className="py-4">
        <div className="text-gray-500 dark:text-gray-400">Loading collections...</div>
      </div>
    );
  }

  return (
    <div>
      <h2 className="mb-4 text-2xl font-bold text-gray-900 dark:text-white">Collections</h2>
      {collections && collections.length > 0 ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3">
          {collections.map((c) => (
            <div key={c.id} className="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-950">
              <div className="font-semibold text-gray-900 dark:text-white">{c.title}</div>
              <div className="text-sm text-gray-500 dark:text-gray-400">{c.boardCount || 0} boards</div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-sm text-gray-500 dark:text-gray-400">No collections found.</div>
      )}
    </div>
  );
}

// Activity fetching helper - attempts to load activity for a creator or a board.
export async function fetchCreatorActivity(fid: string) {
  try {
    const res = await fetch(`/api/creators/${encodeURIComponent(fid)}/activity`);
    if (!res.ok) return null;
    return await res.json();
  } catch (e) {
    return null;
  }
}
