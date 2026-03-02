import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { moodboards, users, images, activities } from "@/lib/schema";
import { eq, and, sql } from "drizzle-orm";
import { verifyAuth, checkOrigin, originDenied } from "@/lib/auth";
import { revalidateTag } from "next/cache";
import type { CloudCanvasImage, EditHistoryEntry } from "@/lib/schema";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    if (!checkOrigin(req)) return originDenied();
    const auth = await verifyAuth(req);
    if (!auth)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id: boardId } = await params;
    const fid = String(auth.fid);
    const db = getDb();

    // Fetch the original public board
    const original = await db
      .select()
      .from(moodboards)
      .where(and(eq(moodboards.id, boardId), eq(moodboards.isPublic, true)))
      .get();

    if (!original) {
      return NextResponse.json(
        { error: "Board not found or not public" },
        { status: 404 },
      );
    }

    // Get current user info
    const currentUser = await db
      .select()
      .from(users)
      .where(eq(users.fid, fid))
      .get();

    if (!currentUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Build edit history: original history + new editor
    const existingHistory =
      (original.editHistory as EditHistoryEntry[] | null) ?? [];
    const newHistory: EditHistoryEntry[] = [
      ...existingHistory,
      {
        fid,
        username: currentUser.username ?? "",
        editedAt: new Date().toISOString(),
      },
    ].slice(0, 10); // Cap at 10 entries

    // Create new board ID
    const newBoardId = `remix-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const now = new Date();

    // Copy image references - the images already exist in the images table
    // so we just need to make sure the new user's images table has them
    const canvasState = original.canvasState as CloudCanvasImage[];
    const imageHashes = canvasState.map((ci) => ci.imageHash);

    // Get all source images
    const sourceImages = await db.select().from(images);
    const sourceImageMap = new Map(sourceImages.map((img) => [img.hash, img]));

    // Copy images to the remixer's account if not already there
    for (const hash of imageHashes) {
      const sourceImg = sourceImageMap.get(hash);
      if (sourceImg) {
        const existingForUser = await db
          .select()
          .from(images)
          .where(and(eq(images.hash, hash), eq(images.fid, fid)))
          .get();

        if (!existingForUser) {
          // For shared images, we use the same hash - the image is already on IPFS
          // We'll create a reference under the new user's fid
          // Since hash is the primary key, we'll use a composite approach
          // Actually, since hash is PK and images are on IPFS, they're shared.
          // The user just needs to have the image accessible - it already is via the URL.
        }
      }
    }

    // Create the remixed board
    await db.insert(moodboards).values({
      id: newBoardId,
      fid,
      title: `Remix of ${original.title}`,
      caption: original.caption ?? "",
      categories: original.categories as string[],
      canvasState: original.canvasState,
      canvasWidth: original.canvasWidth,
      canvasHeight: original.canvasHeight,
      background: original.background ?? "#f5f5f4",
      orientation: original.orientation ?? "portrait",
      margin: original.margin ?? false,
      pinned: false,
      isPublic: false,
      editHistory: newHistory,
      remixOfId: boardId,
      createdAt: now,
      updatedAt: now,
      syncVersion: 1,
    });

    // Record activity: new board created (remix)
    try {
      await db.insert(activities).values({
        id: `act-${Date.now()}-${Math.random().toString(36).slice(2,8)}`,
        type: "created",
        boardId: newBoardId,
        fid,
        details: { remixOfId: boardId },
        createdAt: now,
      });
    } catch (e) {
      console.warn("Failed to record activity for new remix", e);
    }

    // Increment edit count & update lastRemixAt on original board
    await db
      .update(moodboards)
      .set({
        editCount: sql`${moodboards.editCount} + 1`,
        lastRemixAt: now,
      })
      .where(eq(moodboards.id, boardId));

    // Record activity on original board: remixed by user
    try {
      await db.insert(activities).values({
        id: `act-${Date.now()}-${Math.random().toString(36).slice(2,8)}`,
        type: "remixed",
        boardId: boardId,
        fid,
        details: { newBoardId },
        createdAt: now,
      });
    } catch (e) {
      console.warn("Failed to record activity for original board remix", e);
    }

    revalidateTag("public-feed", "max");
    revalidateTag(`public-board:${boardId}`, "max");

    return NextResponse.json({ newBoardId });
  } catch (err) {
    console.error("Remix error:", err);
    return NextResponse.json({ error: "Remix failed" }, { status: 500 });
  }
}
