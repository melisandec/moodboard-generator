import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { collections, collectionItems } from "@/lib/schema";
import { verifyAuth } from "@/lib/auth";
import { logCollectionActivity } from "@/lib/activity-logger";
import { eq } from "drizzle-orm";
import { v4 } from "uuid";

// Phase 6: Collections management API

// GET: Fetch user's collections
export async function GET(request: NextRequest) {
  try {
    const authResult = await verifyAuth(request);
    if (!authResult) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const fid = authResult.fid.toString();
    const db = getDb();

    const userCollections = await db
      .select({
        id: collections.id,
        name: collections.name,
        description: collections.description,
        isPublic: collections.isPublic,
        createdAt: collections.createdAt,
        updatedAt: collections.updatedAt,
      })
      .from(collections)
      .where(eq(collections.fid, fid));

    return NextResponse.json({
      collections: userCollections,
    });
  } catch (error) {
    console.error("Get collections error:", error);
    return NextResponse.json(
      { error: "Failed to fetch collections" },
      { status: 500 },
    );
  }
}

// POST: Create new collection
export async function POST(request: NextRequest) {
  try {
    const authResult = await verifyAuth(request);
    if (!authResult) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const fid = authResult.fid.toString();
    const { name, description, isPublic } = await request.json();

    if (!name || name.trim().length === 0) {
      return NextResponse.json(
        { error: "Collection name is required" },
        { status: 400 },
      );
    }

    const db = getDb();
    const collectionId = v4();

    await db.insert(collections).values({
      id: collectionId,
      fid,
      name: name.trim(),
      description: description || "",
      isPublic: isPublic ?? false,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    // Log activity
    await logCollectionActivity({
      type: "collection_created",
      fid,
      collectionId,
      details: { name: name.trim(), isPublic: isPublic ?? false },
    });

    return NextResponse.json({
      success: true,
      collectionId,
    });
  } catch (error) {
    console.error("Create collection error:", error);
    return NextResponse.json(
      { error: "Failed to create collection" },
      { status: 500 },
    );
  }
}

// PUT: Update collection
export async function PUT(request: NextRequest) {
  try {
    const authResult = await verifyAuth(request);
    if (!authResult) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const fid = authResult.fid.toString();
    const { collectionId, name, description, isPublic } = await request.json();

    if (!collectionId) {
      return NextResponse.json(
        { error: "collectionId is required" },
        { status: 400 },
      );
    }

    const db = getDb();

    // Verify ownership by fetching collection
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

    // Update collection
    await db
      .update(collections)
      .set({
        name: name || collection.name,
        description: description ?? collection.description,
        isPublic: isPublic ?? collection.isPublic,
        updatedAt: new Date(),
      })
      .where(eq(collections.id, collectionId));

    // Log activity
    await logCollectionActivity({
      type: "collection_updated",
      fid,
      collectionId,
      details: { updatedFields: { name, description, isPublic } },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Update collection error:", error);
    return NextResponse.json(
      { error: "Failed to update collection" },
      { status: 500 },
    );
  }
}

// DELETE: Remove collection
export async function DELETE(request: NextRequest) {
  try {
    const authResult = await verifyAuth(request);
    if (!authResult) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const fid = authResult.fid.toString();
    const collectionId = request.nextUrl.searchParams.get("collectionId");

    if (!collectionId) {
      return NextResponse.json(
        { error: "collectionId is required" },
        { status: 400 },
      );
    }

    const db = getDb();

    // Verify ownership
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

    // Delete items first, then collection
    await db
      .delete(collectionItems)
      .where(eq(collectionItems.collectionId, collectionId));
    await db.delete(collections).where(eq(collections.id, collectionId));

    // Log activity
    await logCollectionActivity({
      type: "collection_deleted",
      fid,
      collectionId,
      details: { deletedCollectionName: collection.name },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Delete collection error:", error);
    return NextResponse.json(
      { error: "Failed to delete collection" },
      { status: 500 },
    );
  }
}
