import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { moodboards, users, images } from "@/lib/schema";
import { eq, and } from "drizzle-orm";
import { checkOrigin, originDenied } from "@/lib/auth";
import type { CloudCanvasImage } from "@/lib/schema";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    if (!checkOrigin(req)) return originDenied();

    const { id } = await params;
    const db = getDb();

    const board = await db
      .select({
        id: moodboards.id,
        fid: moodboards.fid,
        title: moodboards.title,
        caption: moodboards.caption,
        categories: moodboards.categories,
        canvasState: moodboards.canvasState,
        canvasWidth: moodboards.canvasWidth,
        canvasHeight: moodboards.canvasHeight,
        background: moodboards.background,
        orientation: moodboards.orientation,
        margin: moodboards.margin,
        isPublic: moodboards.isPublic,
        editHistory: moodboards.editHistory,
        viewCount: moodboards.viewCount,
        editCount: moodboards.editCount,
        remixOfId: moodboards.remixOfId,
        publishedAt: moodboards.publishedAt,
        createdAt: moodboards.createdAt,
        updatedAt: moodboards.updatedAt,
        username: users.username,
        pfpUrl: users.pfpUrl,
      })
      .from(moodboards)
      .leftJoin(users, eq(moodboards.fid, users.fid))
      .where(and(eq(moodboards.id, id), eq(moodboards.isPublic, true)))
      .get();

    if (!board) {
      return NextResponse.json({ error: "Board not found" }, { status: 404 });
    }

    // Fetch image URLs for all images in the canvas
    const cs = board.canvasState as CloudCanvasImage[];
    const hashes = new Set<string>();
    for (const ci of cs) {
      hashes.add(ci.imageHash);
    }

    const imageMap: Record<
      string,
      { url: string; naturalWidth: number; naturalHeight: number }
    > = {};
    if (hashes.size > 0) {
      const allImgs = await db.select().from(images);
      for (const img of allImgs) {
        if (hashes.has(img.hash)) {
          imageMap[img.hash] = {
            url: img.url,
            naturalWidth: img.naturalWidth,
            naturalHeight: img.naturalHeight,
          };
        }
      }
    }

    return NextResponse.json({
      id: board.id,
      title: board.title,
      caption: board.caption ?? "",
      categories: board.categories ?? [],
      thumbnailUrl: null,
      creatorFid: board.fid,
      creatorUsername: board.username ?? "",
      creatorPfpUrl: board.pfpUrl ?? "",
      editHistory: board.editHistory ?? [],
      viewCount: board.viewCount ?? 0,
      editCount: board.editCount ?? 0,
      publishedAt:
        board.publishedAt instanceof Date
          ? board.publishedAt.toISOString()
          : board.publishedAt
            ? String(board.publishedAt)
            : null,
      createdAt:
        board.createdAt instanceof Date
          ? board.createdAt.toISOString()
          : String(board.createdAt),
      updatedAt:
        board.updatedAt instanceof Date
          ? board.updatedAt.toISOString()
          : String(board.updatedAt),
      canvasState: board.canvasState,
      canvasWidth: board.canvasWidth,
      canvasHeight: board.canvasHeight,
      background: board.background ?? "#f5f5f4",
      orientation: board.orientation ?? "portrait",
      margin: board.margin ?? false,
      imageMap,
      remixOfId: board.remixOfId,
    });
  } catch (err) {
    console.error("Board detail error:", err);
    return NextResponse.json(
      { error: "Failed to fetch board" },
      { status: 500 },
    );
  }
}
