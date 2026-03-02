import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { moodboards, activities, users } from "@/lib/schema";
import { verifyAuth } from "@/lib/auth";
import { eq, sum } from "drizzle-orm";

// Phase 5: User analytics endpoint - aggregated stats for dashboard
export async function GET(request: NextRequest) {
  try {
    const authResult = await verifyAuth(request);
    if (!authResult) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const fid = authResult.fid.toString();
    const db = getDb();
    const now = Date.now();
    const monthAgo = new Date(now - 30 * 24 * 60 * 60 * 1000).getTime();

    // Get user's boards stats
    const boardsStats = await db
      .select({
        totalPublished: sum(moodboards.isPublic).mapWith((v) =>
          v === null ? 0 : Number(v),
        ),
        totalViews: sum(moodboards.viewCount).mapWith((v) =>
          v === null ? 0 : Number(v),
        ),
        totalRemixes: sum(moodboards.remixCount).mapWith((v) =>
          v === null ? 0 : Number(v),
        ),
        totalLikes: sum(moodboards.likeCount).mapWith((v) =>
          v === null ? 0 : Number(v),
        ),
      })
      .from(moodboards)
      .where(eq(moodboards.fid, fid));

    // Get this month views
    const thisMonthStats = await db
      .select({
        viewsThisMonth: sum(moodboards.viewCount).mapWith((v) =>
          v === null ? 0 : Number(v),
        ),
      })
      .from(moodboards)
      .where(eq(moodboards.fid, fid));

    // Get top board
    const topBoard = await db
      .select({
        id: moodboards.id,
        title: moodboards.title,
        viewCount: moodboards.viewCount,
        remixCount: moodboards.remixCount,
        likeCount: moodboards.likeCount,
      })
      .from(moodboards)
      .where(eq(moodboards.fid, fid))
      .orderBy(moodboards.viewCount)
      .limit(1);

    // Get activity timeline (last 10 activities)
    const recentActivities = await db
      .select({
        id: activities.id,
        type: activities.type,
        boardId: activities.boardId,
        createdAt: activities.createdAt,
      })
      .from(activities)
      .where(eq(activities.fid, fid))
      .orderBy(activities.createdAt)
      .limit(10);

    const stats = boardsStats[0] || {
      totalPublished: 0,
      totalViews: 0,
      totalRemixes: 0,
      totalLikes: 0,
    };

    return NextResponse.json({
      stats: {
        totalPublished: stats.totalPublished || 0,
        totalViews: stats.totalViews || 0,
        totalRemixes: stats.totalRemixes || 0,
        totalLikes: stats.totalLikes || 0,
        thisMonthViews: thisMonthStats[0]?.viewsThisMonth || 0,
        mostViewedBoard: topBoard[0] || null,
      },
      recentActivities,
    });
  } catch (error) {
    console.error("Analytics error:", error);
    return NextResponse.json(
      { error: "Failed to fetch analytics" },
      { status: 500 },
    );
  }
}
