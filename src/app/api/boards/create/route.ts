import { NextRequest, NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { moodboards, activities, users } from "@/lib/schema";
import { eq } from "drizzle-orm";
import type { CanvasImage } from "@/lib/storage";

interface CreateBoardRequest {
  title: string;
  caption: string;
  canvasState: CanvasImage[];
  canvasWidth: number;
  canvasHeight: number;
  background: string;
  orientation: "portrait" | "landscape" | "square";
  margin: boolean;
  categories: string[];
  isPublic: boolean;
  previewUrl?: string | null;
  remixOfId?: string;
}

export async function POST(req: NextRequest) {
  try {
    const user = await verifyAuth(req);

    if (!user) {
      return NextResponse.json(
        { error: "Unauthorized: Farcaster user required" },
        { status: 401 },
      );
    }

    const fid = String(user.fid);
    const body = (await req.json()) as CreateBoardRequest;
    const db = getDb();

    // Ensure user exists (create if not)
    try {
      const existingUser = await db
        .select()
        .from(users)
        .where(eq(users.fid, fid))
        .get();

      if (!existingUser) {
        const now = new Date();
        await db.insert(users).values({
          fid,
          username: "",
          pfpUrl: "",
          bio: "",
          followerCount: 0,
          createdAt: now,
          updatedAt: now,
        });
        console.debug("✓ Created placeholder user for board creation");
      }
    } catch (err) {
      console.warn("⚠ Could not ensure user exists:", err);
      // Continue anyway - the insert will fail if needed
    }

    // ====== Validation ======
    const errors: string[] = [];

    if (!body.title || body.title.trim().length === 0) {
      errors.push("Title is required");
    }
    if (body.title && body.title.length > 80) {
      errors.push("Title must be 80 characters or less");
    }

    if (body.caption && body.caption.length > 280) {
      errors.push("Caption must be 280 characters or less");
    }

    if (!Array.isArray(body.canvasState) || body.canvasState.length === 0) {
      errors.push("Board must contain at least one image");
    }

    if (
      !body.canvasWidth ||
      body.canvasWidth < 400 ||
      body.canvasWidth > 4000
    ) {
      errors.push("Canvas width must be between 400 and 4000");
    }

    if (
      !body.canvasHeight ||
      body.canvasHeight < 400 ||
      body.canvasHeight > 4000
    ) {
      errors.push("Canvas height must be between 400 and 4000");
    }

    if (!["portrait", "landscape", "square"].includes(body.orientation)) {
      errors.push("Invalid orientation");
    }

    if (!body.background || !/^#[0-9A-F]{6}$/i.test(body.background)) {
      errors.push("Invalid background color");
    }

    if (!Array.isArray(body.categories)) {
      errors.push("Categories must be an array");
    }

    if (errors.length > 0) {
      return NextResponse.json({ error: errors.join(", ") }, { status: 400 });
    }

    // ====== Create Board ======
    const now = new Date();
    const boardId = `board_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Convert CanvasImage[] (with dataUrl) to storage format (imageHash placeholder)
    const canvasStateForStorage = body.canvasState.map((img) => ({
      id: img.id,
      imageHash: img.id, // Use id as placeholder for imageHash
      x: img.x,
      y: img.y,
      width: img.width,
      height: img.height,
      rotation: img.rotation,
      pinned: img.pinned,
      zIndex: img.zIndex,
      naturalWidth: img.naturalWidth,
      naturalHeight: img.naturalHeight,
    }));

    await db
      .insert(moodboards)
      .values({
        id: boardId,
        fid,
        title: body.title.trim(),
        caption: body.caption || "",
        canvasState: canvasStateForStorage as any,
        canvasWidth: body.canvasWidth,
        canvasHeight: body.canvasHeight,
        background: body.background,
        orientation: body.orientation,
        margin: body.margin,
        categories: body.categories,
        isPublic: body.isPublic || false,
        previewUrl: body.previewUrl || null,
        remixOfId: body.remixOfId || null,
        createdAt: now,
        updatedAt: now,
        publishedAt: body.isPublic ? now : null,
        viewCount: 0,
        editCount: 0,
        remixCount: 0,
        likeCount: 0,
      })
      .run();

    // ====== Log Activity ======
    try {
      await db
        .insert(activities)
        .values({
          id: `activity_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          fid,
          type: "board_created",
          boardId,
          details: {
            title: body.title.trim(),
            isPublic: body.isPublic || false,
            imageCount: body.canvasState.length,
          },
          createdAt: now,
        })
        .run();
    } catch (_activityError) {
      // Activity logging is non-critical
    }

    return NextResponse.json(
      {
        success: true,
        boardId,
        message: body.isPublic
          ? "Board created and published"
          : "Board created as draft",
      },
      { status: 201 },
    );
  } catch (error) {
    console.error("Error creating board:", error);
    return NextResponse.json(
      {
        error: "Failed to create board",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
