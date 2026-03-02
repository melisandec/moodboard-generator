import { NextRequest, NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { moodboards, activities } from "@/lib/schema";
import { eq } from "drizzle-orm";

interface UpdateBoardRequest {
  title?: string;
  caption?: string;
  categories?: string[];
  background?: string;
  orientation?: "portrait" | "landscape" | "square";
  margin?: boolean;
  previewUrl?: string | null;
}

export async function PATCH(
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
    const body = (await req.json()) as UpdateBoardRequest;
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

    // ====== Validation ======
    const errors: string[] = [];

    if (body.title !== undefined) {
      if (body.title.trim().length === 0) {
        errors.push("Title cannot be empty");
      }
      if (body.title.length > 80) {
        errors.push("Title must be 80 characters or less");
      }
    }

    if (body.caption !== undefined && body.caption.length > 280) {
      errors.push("Caption must be 280 characters or less");
    }

    if (body.background !== undefined) {
      if (!/^#[0-9A-F]{6}$/i.test(body.background)) {
        errors.push("Invalid background color format");
      }
    }

    if (body.orientation !== undefined) {
      if (!["portrait", "landscape", "square"].includes(body.orientation)) {
        errors.push("Invalid orientation");
      }
    }

    if (body.categories !== undefined && !Array.isArray(body.categories)) {
      errors.push("Categories must be an array");
    }

    if (errors.length > 0) {
      return NextResponse.json({ error: errors.join(", ") }, { status: 400 });
    }

    // ====== Prepare Update ======
    const updates: Record<string, unknown> = {
      updatedAt: new Date(),
    };

    if (body.title !== undefined) {
      updates.title = body.title.trim();
    }
    if (body.caption !== undefined) {
      updates.caption = body.caption;
    }
    if (body.categories !== undefined) {
      updates.categories = body.categories;
    }
    if (body.background !== undefined) {
      updates.background = body.background;
    }
    if (body.orientation !== undefined) {
      updates.orientation = body.orientation;
    }
    if (body.margin !== undefined) {
      updates.margin = body.margin;
    }
    if (body.previewUrl !== undefined) {
      updates.previewUrl = body.previewUrl;
    }

    // ====== Update Board ======
    await db
      .update(moodboards)
      .set(updates)
      .where(eq(moodboards.id, boardId))
      .run();

    // ====== Log Activity ======
    try {
      const changedFields = Object.keys(updates).filter(
        (key) => key !== "updatedAt",
      );
      await db
        .insert(activities)
        .values({
          id: `activity_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          fid,
          type: "board_updated",
          boardId,
          details: {
            changedFields,
            updateCount: changedFields.length,
          },
          createdAt: new Date(),
        })
        .run();
    } catch (_activityError) {
      // Activity logging is non-critical
    }

    return NextResponse.json(
      {
        success: true,
        message: "Board updated successfully",
      },
      { status: 200 },
    );
  } catch (error) {
    console.error("Error updating board:", error);
    return NextResponse.json(
      {
        error: "Failed to update board",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
