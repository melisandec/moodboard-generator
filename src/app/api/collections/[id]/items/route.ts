import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { collectionItems, collections, moodboards, users } from "@/lib/schema";
import { verifyAuth } from "@/lib/auth";
import { logCollectionActivity } from "@/lib/activity-logger";
import { eq, and } from "drizzle-orm";
import { v4 } from "uuid";

// Phase 6: Collection items management API

// GET: Fetch items in a collection
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id: collectionId } = await params;
    const db = getDb();

    const items = await db
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
        itemOrder: collectionItems.order,
      })
      .from(collectionItems)
      .innerJoin(moodboards, eq(collectionItems.boardId, moodboards.id))
      .innerJoin(users, eq(moodboards.fid, users.fid))
      .where(eq(collectionItems.collectionId, collectionId))
      .orderBy(collectionItems.order);

    return NextResponse.json({
      items,
      count: items.length,
    });
  } catch (error) {
    console.error("Get collection items error:", error);
    return NextResponse.json(
      { error: "Failed to fetch collection items" },
      { status: 500 },
    );
  }
}

// POST: Add board to collection
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const authResult = await verifyAuth(request);
    if (!authResult) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const fid = authResult.fid.toString();
    const { id: collectionId } = await params;
    const { boardId } = await request.json();

    if (!boardId) {
      return NextResponse.json(
        { error: "boardId is required" },
        { status: 400 },
      );
    }

    const db = getDb();

    // Verify collection ownership
    const collectionList = await db
      .select()
      .from(collections)
      .where(eq(collections.id, collectionId))
      .limit(1);

    const collection = collectionList[0];
    if (!collection || collection.fid !== fid) {
      return NextResponse.json(
        { error: "Collection not found" },
        { status: 404 },
      );
    }

    // Get max order
    const maxOrderResult = await db
      .select()
      .from(collectionItems)
      .where(eq(collectionItems.collectionId, collectionId));

    const maxOrder = Math.max(...maxOrderResult.map((item) => item.order), 0);

    // Add item
    await db.insert(collectionItems).values({
      id: v4(),
      collectionId,
      boardId,
      order: maxOrder + 1,
      createdAt: new Date(),
    });

    // Log activity
    await logCollectionActivity({
      type: 'item_added',
      fid,
      collectionId,
      details: { boardId },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Add to collection error:", error);
    return NextResponse.json(
      { error: "Failed to add to collection" },
      { status: 500 },
    );
  }
}

// DELETE: Remove board from collection
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const authResult = await verifyAuth(request);
    if (!authResult) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const fid = authResult.fid.toString();
    const { id: collectionId } = await params;
    const boardId = request.nextUrl.searchParams.get("boardId");

    if (!boardId) {
      return NextResponse.json(
        { error: "boardId is required" },
        { status: 400 },
      );
    }

    const db = getDb();

    // Verify collection ownership
    const collectionList = await db
      .select()
      .from(collections)
      .where(eq(collections.id, collectionId))
      .limit(1);

    const collection = collectionList[0];
    if (!collection || collection.fid !== fid) {
      return NextResponse.json(
        { error: "Collection not found" },
        { status: 404 },
      );
    }

    // Remove item
    await db
      .delete(collectionItems)
      .where(
        and(
          eq(collectionItems.collectionId, collectionId),
          eq(collectionItems.boardId, boardId),
        ),
      );

    // Log activity
    await logCollectionActivity({
      type: 'item_removed',
      fid,
      collectionId,
      details: { boardId },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Remove from collection error:", error);
    return NextResponse.json(
      { error: "Failed to remove from collection" },
      { status: 500 },
    );
  }
}
