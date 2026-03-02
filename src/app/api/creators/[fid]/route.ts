import { NextRequest, NextResponse } from "next/server";
import { getDb, getClient } from "@/lib/db";
import {
  users,
  moodboards,
  userStats,
  folders,
  activities,
} from "@/lib/schema";
import { eq, and, desc, or, inArray, sql } from "drizzle-orm";

interface CreatorProfile {
  fid: string;
  username: string | null;
  pfpUrl: string | null;
  bio: string;
  socialLinks: Record<string, string>;
  followerCount: number;
  stats: {
    totalBoardsPublished: number;
    totalViews: number;
    totalRemixes: number;
  };
  recentBoards: Array<{
    id: string;
    title: string;
    previewUrl: string | null;
    viewCount: number | null;
    publishedAt: Date | null;
  }>;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ fid: string }> },
) {
  try {
    const { fid } = await params;
    const db = getDb();

    // Get user data via raw query to avoid automatic JSON parsing failures
    const client = getClient();

    // Inspect the users table to see which columns exist (robust for older DBs)
    const pragma = await client.execute({ sql: "PRAGMA table_info('users')" });
    const pragmaRows = (pragma && (pragma as any).rows) || [];
    const existingCols: string[] = pragmaRows.map((r: any) => r[1]);

    const wanted = [
      { name: "fid" },
      { name: "username" },
      { name: "pfp_url" },
      { name: "bio" },
      { name: "social_links" },
      { name: "follower_count" },
    ];

    const selected = wanted
      .filter((w) => existingCols.includes(w.name))
      .map((w) => w.name)
      .join(", ");

    const sql = `SELECT ${selected} FROM users WHERE fid = ? LIMIT 1`;
    const res = await client.execute({ sql, args: [fid] });
    const rows = (res && (res as any).rows) || [];
    if (rows.length === 0) {
      return NextResponse.json({ error: "Creator not found" }, { status: 404 });
    }

    const raw = rows[0];
    // Map values to object by selected column names
    const parts = selected.split(/,\s*/);
    const userData: any = {};
    parts.forEach((col, idx) => {
      const prop =
        col === "pfp_url"
          ? "pfpUrl"
          : col === "follower_count"
            ? "followerCount"
            : col;
      userData[prop] = raw[idx];
    });

    // Ensure fid present
    userData.fid = userData.fid || fid;

    // Safely parse social_links if present
    let socialLinks: Record<string, string> = {};
    if (userData.social_links) {
      try {
        socialLinks = JSON.parse(userData.social_links as string);
      } catch (e) {
        console.warn("Failed to parse social_links for user", fid, e);
        socialLinks = {};
      }
    }
    userData.socialLinks = socialLinks;

    // Get user stats (wrap in try/catch for older DBs)
    let stats: any[] = [];
    try {
      stats = await db
        .select()
        .from(userStats)
        .where(eq(userStats.fid, fid))
        .limit(1);
    } catch (e) {
      console.warn("userStats query failed, returning defaults", e);
      stats = [];
    }

    // Get recent public boards
    const recentBoards = await db
      .select({
        id: moodboards.id,
        title: moodboards.title,
        previewUrl: moodboards.previewUrl,
        viewCount: moodboards.viewCount,
        publishedAt: moodboards.publishedAt,
        canvasWidth: moodboards.canvasWidth,
        canvasHeight: moodboards.canvasHeight,
        canvasState: moodboards.canvasState,
      })
      .from(moodboards)
      .where(
        and(
          eq(moodboards.fid, fid),
          eq(moodboards.isPublic, true),
          eq(moodboards.publishedAt, moodboards.publishedAt),
        ),
      )
      .orderBy(desc(moodboards.publishedAt))
      .limit(6);

    // Get all boards (public and private) for the creator
    const allBoards = await db
      .select({
        id: moodboards.id,
        title: moodboards.title,
        previewUrl: moodboards.previewUrl,
        viewCount: moodboards.viewCount,
        isPublic: moodboards.isPublic,
        publishedAt: moodboards.publishedAt,
        createdAt: moodboards.createdAt,
        updatedAt: moodboards.updatedAt,
        canvasWidth: moodboards.canvasWidth,
        canvasHeight: moodboards.canvasHeight,
        canvasState: moodboards.canvasState,
      })
      .from(moodboards)
      .where(eq(moodboards.fid, fid))
      .orderBy(desc(moodboards.updatedAt));

    // Get collections (folders) and counts
    let collections: Array<{
      id: string;
      title: string;
      description: string;
      boardCount: number;
    }> = [];
    try {
      const folderRows = await db
        .select({
          id: folders.id,
          title: folders.name,
          description: folders.description,
        })
        .from(folders)
        .where(eq(folders.fid, fid));

      for (const f of folderRows) {
        let count = 0;
        try {
          const rowsForFolder = await db
            .select()
            .from(moodboards)
            .where(eq(moodboards.folderId, f.id));
          count = rowsForFolder.length;
        } catch (e) {
          count = 0;
        }
        collections.push({
          id: f.id,
          title: f.title,
          description: f.description ?? "",
          boardCount: count,
        });
      }
    } catch (e) {
      collections = [];
    }

    // Get recent activity for the creator: activities where fid = creator OR boardId in creator boards
    let recentActivity: any[] = [];
    try {
      const boardIds = allBoards.map((b) => b.id);
      if (boardIds.length > 0) {
        recentActivity = await db
          .select()
          .from(activities)
          .where(
            or(eq(activities.fid, fid), inArray(activities.boardId, boardIds)),
          )
          .orderBy(desc(activities.createdAt))
          .limit(50);
      } else {
        recentActivity = await db
          .select()
          .from(activities)
          .where(eq(activities.fid, fid))
          .orderBy(desc(activities.createdAt))
          .limit(50);
      }
    } catch (e) {
      recentActivity = [];
    }

    const profile: CreatorProfile = {
      fid: userData.fid,
      username: userData.username,
      pfpUrl: userData.pfpUrl,
      bio: userData.bio || "",
      socialLinks: (userData.socialLinks as Record<string, string>) || {},
      followerCount: userData.followerCount || 0,
      stats: {
        totalBoardsPublished: stats[0]?.totalBoardsPublished || 0,
        totalViews: stats[0]?.totalViews || 0,
        totalRemixes: stats[0]?.totalRemixes || 0,
      },
      recentBoards: recentBoards.map((b: any) => {
        let previewImages: Array<{
          id: string;
          imageHash: string;
          x: number;
          y: number;
          width: number;
          height: number;
        }> = [];
        if (b.canvasState) {
          try {
            const stateArray =
              typeof b.canvasState === "string"
                ? JSON.parse(b.canvasState)
                : b.canvasState;
            if (Array.isArray(stateArray)) {
              previewImages = stateArray.map((item: any) => ({
                id: item.id,
                imageHash: item.imageHash,
                x: item.x,
                y: item.y,
                width: item.width,
                height: item.height,
              }));
            }
          } catch (e) {
            console.warn("Failed to parse canvasState for board", b.id, e);
          }
        }
        return {
          id: b.id,
          title: b.title,
          previewUrl: b.previewUrl,
          viewCount: b.viewCount,
          publishedAt: b.publishedAt,
          canvasWidth: b.canvasWidth,
          canvasHeight: b.canvasHeight,
          previewImages,
        };
      }),
    };

    // Attach collections, allBoards, and activity to response
    const extended = {
      ...profile,
      collections,
      boards: allBoards.map((b: any) => {
        let previewImages: Array<{
          id: string;
          imageHash: string;
          x: number;
          y: number;
          width: number;
          height: number;
        }> = [];
        if (b.canvasState) {
          try {
            const stateArray =
              typeof b.canvasState === "string"
                ? JSON.parse(b.canvasState)
                : b.canvasState;
            if (Array.isArray(stateArray)) {
              previewImages = stateArray.map((item: any) => ({
                id: item.id,
                imageHash: item.imageHash,
                x: item.x,
                y: item.y,
                width: item.width,
                height: item.height,
              }));
            }
          } catch (e) {
            console.warn("Failed to parse canvasState for board", b.id, e);
          }
        }
        return {
          ...b,
          canvasWidth: b.canvasWidth,
          canvasHeight: b.canvasHeight,
          previewImages,
        };
      }),
      recentActivity,
    };
    return NextResponse.json(extended);
  } catch (error) {
    console.error("Error fetching creator profile:", error);
    // Return error details during local debugging
    const message = (error && (error as any).message) || String(error);
    const stack = (error && (error as any).stack) || null;
    if (process.env.NODE_ENV === "development") {
      return NextResponse.json({ error: message, stack }, { status: 500 });
    }
    return NextResponse.json(
      { error: "Failed to fetch creator profile" },
      { status: 500 },
    );
  }
}
