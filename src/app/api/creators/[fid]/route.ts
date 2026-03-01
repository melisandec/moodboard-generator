import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { users, moodboards, userStats } from "@/lib/schema";
import { eq, and, desc } from "drizzle-orm";

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

    // Get user data
    const user = await db
      .select()
      .from(users)
      .where(eq(users.fid, fid))
      .limit(1);

    if (user.length === 0) {
      return NextResponse.json({ error: "Creator not found" }, { status: 404 });
    }

    const userData = user[0];

    // Get user stats
    const stats = await db
      .select()
      .from(userStats)
      .where(eq(userStats.fid, fid))
      .limit(1);

    // Get recent public boards
    const recentBoards = await db
      .select({
        id: moodboards.id,
        title: moodboards.title,
        previewUrl: moodboards.previewUrl,
        viewCount: moodboards.viewCount,
        publishedAt: moodboards.publishedAt,
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
      recentBoards: recentBoards,
    };

    return NextResponse.json(profile);
  } catch (error) {
    console.error("Error fetching creator profile:", error);
    return NextResponse.json(
      { error: "Failed to fetch creator profile" },
      { status: 500 },
    );
  }
}
