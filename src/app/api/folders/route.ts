import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { folders, moodboards } from "@/lib/schema";
import { eq, and, count } from "drizzle-orm";
import { verifyAuth } from "@/lib/auth";
import { v4 as uuidv4 } from "uuid";

export async function POST(request: NextRequest) {
  try {
    const user = await verifyAuth(request);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const db = getDb();
    const { name, description = "", isPublic = false } = await request.json();

    if (!name) {
      return NextResponse.json(
        { error: "Folder name is required" },
        { status: 400 },
      );
    }

    const folderId = uuidv4();
    const now = new Date();

    await db.insert(folders).values({
      id: folderId,
      fid: String(user.fid),
      name,
      description,
      isPublic,
      createdAt: now,
      updatedAt: now,
    });

    return NextResponse.json({ id: folderId, name, description, isPublic });
  } catch (error) {
    console.error("Error creating folder:", error);
    return NextResponse.json(
      { error: "Failed to create folder" },
      { status: 500 },
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const authUser = await verifyAuth(request);
    if (!authUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const db = getDb();
    const userFolders = await db
      .select({
        id: folders.id,
        name: folders.name,
        description: folders.description,
        isPublic: folders.isPublic,
        createdAt: folders.createdAt,
        updatedAt: folders.updatedAt,
        boardCount: count(moodboards.id),
      })
      .from(folders)
      .leftJoin(moodboards, eq(folders.id, moodboards.folderId))
      .where(eq(folders.fid, String(authUser.fid)))
      .groupBy(folders.id)
      .orderBy(folders.createdAt);

    return NextResponse.json({ folders: userFolders });
  } catch (error) {
    console.error("Error fetching folders:", error);
    return NextResponse.json(
      { error: "Failed to fetch folders" },
      { status: 500 },
    );
  }
}
