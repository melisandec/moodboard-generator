import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { moodboards, images } from "@/lib/schema";
import { eq } from "drizzle-orm";

interface CloudCanvasImage {
  id: string;
  imageHash: string;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  pinned: boolean;
  zIndex: number;
  naturalWidth: number;
  naturalHeight: number;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id: boardId } = await params;
    const db = getDb();
    const page = Math.max(
      1,
      parseInt(new URL(request.url).searchParams.get("page") || "1", 10),
    );
    const limit = Math.min(
      50,
      parseInt(new URL(request.url).searchParams.get("limit") || "20", 10),
    );
    const offset = (page - 1) * limit;

    // Get board
    const board = await db
      .select()
      .from(moodboards)
      .where(eq(moodboards.id, boardId))
      .limit(1);

    if (board.length === 0) {
      return NextResponse.json({ error: "Board not found" }, { status: 404 });
    }

    const canvasState = board[0].canvasState as CloudCanvasImage[];

    // Get image details for the images referenced in the board
    const boardImages = await db.select().from(images);

    // Map canvas items with image details
    const mappedImages = canvasState.map((canvasItem) => {
      const imageData = boardImages.find(
        (img) => img.hash === canvasItem.imageHash,
      );
      return {
        ...canvasItem,
        url: imageData?.url || "",
        filename: imageData?.filename || "",
      };
    });

    const paginatedImages = mappedImages.slice(offset, offset + limit);

    return NextResponse.json({
      images: paginatedImages,
      pagination: {
        page,
        limit,
        total: mappedImages.length,
        pages: Math.ceil(mappedImages.length / limit),
      },
    });
  } catch (error) {
    console.error("Error fetching board images:", error);
    return NextResponse.json(
      { error: "Failed to fetch images" },
      { status: 500 },
    );
  }
}
