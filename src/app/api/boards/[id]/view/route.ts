import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { moodboards, activities } from "@/lib/schema";
import { eq, sql, and } from "drizzle-orm";
import { checkOrigin, originDenied } from "@/lib/auth";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    if (!checkOrigin(req)) return originDenied();

    const { id } = await params;
    const db = getDb();

    // Only increment for public boards
    const board = await db
      .select({ id: moodboards.id, isPublic: moodboards.isPublic })
      .from(moodboards)
      .where(and(eq(moodboards.id, id), eq(moodboards.isPublic, true)))
      .get();

    if (!board) {
      return NextResponse.json({ error: "Board not found" }, { status: 404 });
    }

    await db
      .update(moodboards)
      .set({ viewCount: sql`${moodboards.viewCount} + 1` })
      .where(eq(moodboards.id, id));

    // Record view activity (anonymous)
    try {
      await db.insert(activities).values({
        id: `act-${Date.now()}-${Math.random().toString(36).slice(2,8)}`,
        type: "viewed",
        boardId: id,
        fid: null,
        details: {},
        createdAt: new Date(),
      });
    } catch (e) {
      console.warn("Failed to record view activity", e);
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("View count error:", err);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
