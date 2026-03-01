import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { moodboards, userStats } from "@/lib/schema";
import { eq, and, desc, gte } from "drizzle-orm";
import { verifyAuth } from "@/lib/auth";

export async function GET(request: NextRequest) {
  try {
    const user = await verifyAuth(request);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const db = getDb();
    const fid = String(user.fid);
    // Get user stats
    const stats = await db
      .select()
      .from(userStats)
      .where(eq(userStats.fid, fid))
      .limit(1);

    // Get this month's views
    const now = new Date();
    const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const thisMonthViews = await db
      .select()
      .from(moodboards)
      .where(
        and(
          eq(moodboards.fid, fid),
          eq(moodboards.isPublic, true),
          gte(moodboards.updatedAt, firstDayOfMonth)
        )
      );

    const monthlyViewCount = thisMonthViews.reduce(
      (sum, board) => sum + (board.viewCount || 0),
      0
    );

    // Get most viewed board
    const mostViewed = await db
      .select()
      .from(moodboards)
      .where(and(eq(moodboards.fid, fid), eq(moodboards.isPublic, true)))
      .orderBy(desc(moodboards.viewCount))
      .limit(1);

    // Get recent boards
    const recentBoards = await db
      .select({
        id: moodboards.id,
        title: moodboards.title,
        viewCount: moodboards.viewCount,
        editCount: moodboards.editCount,
        publishedAt: moodboards.publishedAt,
        previewUrl: moodboards.previewUrl,
      })
      .from(moodboards)
      .where(and(eq(moodboards.fid, fid), eq(moodboards.isPublic, true)))
      .orderBy(desc(moodboards.publishedAt))
      .limit(12);

    return NextResponse.json({
      totalBoardsPublished: stats[0]?.totalBoardsPublished || 0,
      totalViews: stats[0]?.totalViews || 0,
      totalRemixes: stats[0]?.totalRemixes || 0,
      thisMonthViews: monthlyViewCount,
      mostViewedBoard: mostViewed[0] || null,
      recentBoards,
    });
  } catch (error) {
    console.error("Error fetching analytics:", error);
    return NextResponse.json(
      { error: "Failed to fetch analytics" },
      { status: 500 }
    );
  }
}
