import { NextRequest, NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { moodboards, activities } from "@/lib/schema";
import { eq } from "drizzle-orm";

interface PublishBoardRequest {
  isPublic: boolean;
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await verifyAuth(req);

    if (!user) {
      return NextResponse.json(
        { error: "Unauthorized: Farcaster user required" },
        { status: 401 },
      );
    }

    const fid = String(user.fid);
    const { id: boardId } = await params;
    const body = (await req.json()) as PublishBoardRequest;
    const db = getDb();

    // ====== Fetch Board ======
    const [board] = await db
      .select()
      .from(moodboards)
      .where(eq(moodboards.id, boardId))
      .all();

    if (!board) {
      return NextResponse.json({ error: "Board not found" }, { status: 404 });
    }

    // ====== Verify Ownership ======
    if (board.fid !== fid) {
      return NextResponse.json(
        { error: "Unauthorized: You can only modify your own boards" },
        { status: 403 },
      );
    }

    // ====== Update Board ======
    const now = new Date();
    const updatedBoard = {
      isPublic: body.isPublic || false,
      publishedAt: body.isPublic ? now : null,
      updatedAt: now,
    };

    await db
      .update(moodboards)
      .set(updatedBoard)
      .where(eq(moodboards.id, boardId))
      .run();

    // ====== Log Activity ======
    try {
      await db
        .insert(activities)
        .values({
          id: `activity_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          fid,
          type: body.isPublic ? "board_published" : "board_unpublished",
          boardId,
          details: {
            isPublic: body.isPublic,
          },
          createdAt: now,
        })
        .run();
    } catch (_activityError) {
      // Activity logging is non-critical
    }

    return NextResponse.json(
      {
        success: true,
        message: body.isPublic
          ? "Board published successfully"
          : "Board made private",
      },
      { status: 200 },
    );
  } catch (error) {
    console.error("Error publishing board:", error);
    return NextResponse.json(
      {
        error: "Failed to publish board",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
