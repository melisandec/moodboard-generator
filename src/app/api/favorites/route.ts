import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { favorites, moodboards, users } from "@/lib/schema";
import { verifyAuth } from "@/lib/auth";
import { logCollectionActivity } from "@/lib/activity-logger";
import { eq, and } from "drizzle-orm";
import { v4 } from "uuid";

// Phase 6: Favorites management API
export async function GET(request: NextRequest) {
  try {
    const authResult = await verifyAuth(request);
    if (!authResult) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const fid = authResult.fid.toString();
    const db = getDb();
    const page = parseInt(request.nextUrl.searchParams.get("page") || "1");
    const limit = Math.min(
      parseInt(request.nextUrl.searchParams.get("limit") || "20"),
      100,
    );
    const offset = (page - 1) * limit;

    const favoritedBoards = await db
      .select({
        id: moodboards.id,
        title: moodboards.title,
        caption: moodboards.caption,
        previewUrl: moodboards.previewUrl,
        viewCount: moodboards.viewCount,
        remixCount: moodboards.remixCount,
        likeCount: moodboards.likeCount,
        primaryCategory: moodboards.primaryCategory,
        createdAt: moodboards.createdAt,
        updatedAt: moodboards.updatedAt,
        username: users.username,
        fid: moodboards.fid,
        favoritedAt: favorites.createdAt,
      })
      .from(favorites)
      .innerJoin(moodboards, eq(favorites.boardId, moodboards.id))
      .innerJoin(users, eq(moodboards.fid, users.fid))
      .where(eq(favorites.fid, fid))
      .orderBy(favorites.createdAt)
      .limit(limit)
      .offset(offset);

    // Get total count
    const totalResult = await db
      .select({ count: favorites.id })
      .from(favorites)
      .where(eq(favorites.fid, fid));

    const total = totalResult.length;

    return NextResponse.json({
      favorites: favoritedBoards,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("Get favorites error:", error);
    return NextResponse.json(
      { error: "Failed to fetch favorites" },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const authResult = await verifyAuth(request);
    if (!authResult) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const fid = authResult.fid.toString();
    const { boardId } = await request.json();

    if (!boardId) {
      return NextResponse.json(
        { error: "boardId is required" },
        { status: 400 },
      );
    }

    const db = getDb();

    // Check if already favorited
    const existing = await db
      .select()
      .from(favorites)
      .where(and(eq(favorites.fid, fid), eq(favorites.boardId, boardId)));

    if (existing.length > 0) {
      return NextResponse.json({ error: "Already favorited" }, { status: 400 });
    }

    // Add favorite
    await db.insert(favorites).values({
      id: v4(),
      fid,
      boardId,
      createdAt: new Date(),
    });

    // Log activity
    await logCollectionActivity({
      type: 'favorite_added',
      fid,
      boardId,
      details: {},
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Add favorite error:", error);
    return NextResponse.json(
      { error: "Failed to add favorite" },
      { status: 500 },
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const authResult = await verifyAuth(request);
    if (!authResult) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const fid = authResult.fid.toString();
    const boardId = request.nextUrl.searchParams.get("boardId");

    if (!boardId) {
      return NextResponse.json(
        { error: "boardId is required" },
        { status: 400 },
      );
    }

    const db = getDb();

    await db
      .delete(favorites)
      .where(and(eq(favorites.fid, fid), eq(favorites.boardId, boardId)));

    // Log activity
    await logCollectionActivity({
      type: 'favorite_removed',
      fid,
      boardId,
      details: {},
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Delete favorite error:", error);
    return NextResponse.json(
      { error: "Failed to remove favorite" },
      { status: 500 },
    );
  }
}
