import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { moodboards } from "@/lib/schema";
import { eq, and } from "drizzle-orm";
import { verifyAuth, checkOrigin, originDenied } from "@/lib/auth";

export async function PATCH(
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
    const { isPublic } = await req.json();

    if (typeof isPublic !== "boolean") {
      return NextResponse.json(
        { error: "isPublic must be boolean" },
        { status: 400 },
      );
    }

    const db = getDb();

    // Only the owner can toggle visibility
    const board = await db
      .select({ id: moodboards.id, publishedAt: moodboards.publishedAt })
      .from(moodboards)
      .where(and(eq(moodboards.id, boardId), eq(moodboards.fid, fid)))
      .get();

    if (!board) {
      return NextResponse.json(
        { error: "Board not found or not owned by you" },
        { status: 404 },
      );
    }

    const now = new Date();
    // Set publishedAt on first publish (private→public, no prior publishedAt)
    const publishedAt =
      isPublic && !board.publishedAt ? now : board.publishedAt;

    await db
      .update(moodboards)
      .set({ isPublic, publishedAt, updatedAt: now })
      .where(eq(moodboards.id, boardId));

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Visibility toggle error:", err);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
