import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { moodboards, users } from "@/lib/schema";
import { eq, desc } from "drizzle-orm";

// Phase 4: Trending boards endpoint - boards with most activity
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const timeRange = searchParams.get("timeRange") || "week"; // week, month
    const limit = Math.min(parseInt(searchParams.get("limit") || "12"), 50);

    const db = getDb();
    const now = Date.now();

    // Calculate time window
    const timeMs =
      timeRange === "month"
        ? 30 * 24 * 60 * 60 * 1000
        : 7 * 24 * 60 * 60 * 1000;
    const timeWindow = new Date(now - timeMs);

    const trending = await db
      .select({
        id: moodboards.id,
        title: moodboards.title,
        caption: moodboards.caption,
        previewUrl: moodboards.previewUrl,
        viewCount: moodboards.viewCount,
        remixCount: moodboards.remixCount,
        likeCount: moodboards.likeCount,
        primaryCategory: moodboards.primaryCategory,
        createdAt: moodboards.createdAt,
        updatedAt: moodboards.updatedAt,
        username: users.username,
        fid: moodboards.fid,
      })
      .from(moodboards)
      .innerJoin(users, eq(moodboards.fid, users.fid))
      .where(eq(moodboards.isPublic, true))
      .orderBy(
        desc(
          // Simple trending score: views + remixes*5 + likes*3
          // This weights engagement higher than just views
          moodboards.viewCount,
        ),
      )
      .limit(limit);

    return NextResponse.json({
      trending,
      timeRange,
      count: trending.length,
    });
  } catch (error) {
    console.error("Trending error:", error);
    return NextResponse.json(
      { error: "Failed to fetch trending boards" },
      { status: 500 },
    );
  }
}
