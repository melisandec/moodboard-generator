import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { reactions, users } from "@/lib/schema";
import { eq, and } from "drizzle-orm";
import { verifyAuth } from "@/lib/auth";
import { v4 as uuidv4 } from "uuid";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await verifyAuth(request);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const db = getDb();
    const { id: boardId } = await params;
    const { emoji } = await request.json();

    if (!emoji) {
      return NextResponse.json({ error: "Emoji is required" }, { status: 400 });
    }

    const fid = String(user.fid);
    // Check if user already reacted with this emoji
    const existing = await db
      .select()
      .from(reactions)
      .where(
        and(
          eq(reactions.boardId, boardId),
          eq(reactions.fid, fid),
          eq(reactions.emoji, emoji),
        ),
      )
      .limit(1);

    if (existing.length > 0) {
      // Remove reaction
      await db.delete(reactions).where(eq(reactions.id, existing[0].id));

      return NextResponse.json({ action: "removed", emoji });
    } else {
      // Add reaction
      await db.insert(reactions).values({
        id: uuidv4(),
        boardId,
        fid: fid,
        emoji,
        createdAt: new Date(),
      });

      return NextResponse.json({ action: "added", emoji });
    }
  } catch (error) {
    console.error("Error toggling reaction:", error);
    return NextResponse.json(
      { error: "Failed to toggle reaction" },
      { status: 500 },
    );
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const db = getDb();
    const { id: boardId } = await params;

    const allReactions = await db
      .select({
        emoji: reactions.emoji,
        fid: reactions.fid,
        username: users.username,
        pfpUrl: users.pfpUrl,
      })
      .from(reactions)
      .innerJoin(users, eq(reactions.fid, users.fid))
      .where(eq(reactions.boardId, boardId));

    // Aggregate reactions by emoji
    const aggregated: Record<
      string,
      {
        count: number;
        reactors: Array<{
          fid: string;
          username: string | null;
          pfpUrl: string | null;
        }>;
      }
    > = {};

    allReactions.forEach(({ emoji, fid, username, pfpUrl }) => {
      if (!aggregated[emoji]) {
        aggregated[emoji] = { count: 0, reactors: [] };
      }
      aggregated[emoji].count++;
      aggregated[emoji].reactors.push({ fid, username, pfpUrl });
    });

    return NextResponse.json({ reactions: aggregated });
  } catch (error) {
    console.error("Error fetching reactions:", error);
    return NextResponse.json(
      { error: "Failed to fetch reactions" },
      { status: 500 },
    );
  }
}
