import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { activities, users } from "@/lib/schema";
import { eq, desc } from "drizzle-orm";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id: boardId } = await params;
    const db = getDb();
    const limit = Math.min(
      50,
      parseInt(new URL(request.url).searchParams.get("limit") || "20", 10),
    );

    // Get activities for this board
    const boardActivities = await db
      .select({
        id: activities.id,
        type: activities.type,
        fid: activities.fid,
        details: activities.details,
        createdAt: activities.createdAt,
        username: users.username,
      })
      .from(activities)
      .leftJoin(users, eq(activities.fid, users.fid))
      .where(eq(activities.boardId, boardId))
      .orderBy(desc(activities.createdAt))
      .limit(limit);

    return NextResponse.json({
      activities: boardActivities,
    });
  } catch (error) {
    console.error("Error fetching board activity:", error);
    return NextResponse.json(
      { error: "Failed to fetch activity" },
      { status: 500 },
    );
  }
}
