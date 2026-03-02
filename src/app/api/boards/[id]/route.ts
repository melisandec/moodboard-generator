import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { moodboards } from "@/lib/schema";
import { eq } from "drizzle-orm";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const db = getDb();

    const board = await db
      .select({
        id: moodboards.id,
        title: moodboards.title,
        description: moodboards.caption,
        canvasWidth: moodboards.canvasWidth,
        canvasHeight: moodboards.canvasHeight,
        canvasState: moodboards.canvasState,
        viewCount: moodboards.viewCount,
        createdAt: moodboards.createdAt,
        publishedAt: moodboards.publishedAt,
        isPublic: moodboards.isPublic,
      })
      .from(moodboards)
      .where(eq(moodboards.id, id))
      .get();

    if (!board) {
      return NextResponse.json({ error: "Board not found" }, { status: 404 });
    }

    // Parse canvasState to extract preview images
    let previewImages: any[] = [];
    if (board.canvasState) {
      try {
        const stateArray =
          typeof board.canvasState === "string"
            ? JSON.parse(board.canvasState)
            : board.canvasState;
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
        console.warn("Failed to parse canvasState for board", id, e);
      }
    }

    return NextResponse.json({
      id: board.id,
      title: board.title,
      description: board.description,
      canvasWidth: board.canvasWidth,
      canvasHeight: board.canvasHeight,
      viewCount: board.viewCount,
      createdAt: board.createdAt,
      publishedAt: board.publishedAt,
      isPublic: board.isPublic,
      previewImages,
    });
  } catch (error) {
    console.error("Error fetching board:", error);
    return NextResponse.json(
      { error: "Failed to fetch board" },
      { status: 500 },
    );
  }
}
