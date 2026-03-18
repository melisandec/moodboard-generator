import { NextRequest, NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { moodboards, activities, users } from "@/lib/schema";
import { eq } from "drizzle-orm";
import type { CanvasImage } from "@/lib/storage";
import type { CloudCanvasImage } from "@/lib/schema";

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
  const startTime = Date.now();
  try {
    console.log(`[/api/boards/create] POST request started`, {
      timestamp: new Date().toISOString(),
      authorization: req.headers.get("authorization")?.substring(0, 20) + "...",
    });

    const user = await verifyAuth(req);
    if (!user) {
      console.warn("[/api/boards/create] ❌ Auth verification failed");
      return NextResponse.json(
        { error: "Unauthorized: Farcaster user required" },
        { status: 401 },
      );
    }

    console.log("[/api/boards/create] ✓ Auth verified for FID:", user.fid);

    const fid = String(user.fid);
    console.log("[/api/boards/create] Parsing request body...");
    const body = (await req.json()) as CreateBoardRequest;
    console.log("[/api/boards/create] Request body parsed:", {
      title: body.title?.substring(0, 30),
      imageCount: body.canvasState?.length,
      orientation: body.orientation,
      isPublic: body.isPublic,
    });

    console.log("[/api/boards/create] Initializing database connection...");
    const db = getDb();
    console.log("[/api/boards/create] ✓ Database connection established");

    // Ensure user exists (create if not)
    try {
      console.log(
        "[/api/boards/create] Checking for existing user with FID:",
        fid,
      );
      const existingUser = await db
        .select()
        .from(users)
        .where(eq(users.fid, fid))
        .get();

      if (!existingUser) {
        console.log("[/api/boards/create] Creating placeholder user...");
        const now = new Date();
        await db.insert(users).values({
          fid,
          username: "",
          pfpUrl: "",
          bio: "",
          socialLinks: {},
          followerCount: 0,
          createdAt: now,
          updatedAt: now,
        });
        console.log(
          "[/api/boards/create] ✓ Created placeholder user for board creation",
        );
      } else {
        console.log("[/api/boards/create] ✓ User already exists");
      }
    } catch (err) {
      const userError = err instanceof Error ? err.message : String(err);
      console.warn(
        "[/api/boards/create] ⚠ Could not ensure user exists:",
        userError,
      );
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
      console.warn("[/api/boards/create] ⚠ Validation errors:", errors);
      return NextResponse.json({ error: errors.join(", ") }, { status: 400 });
    }

    console.log("[/api/boards/create] ✓ All validations passed");

    // ====== Create Board ======
    const now = new Date();
    const boardId = `board_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
    console.log("[/api/boards/create] Generated board ID:", boardId);

    // Convert CanvasImage[] (with dataUrl) to storage format (imageHash placeholder)
    const canvasStateForStorage: CloudCanvasImage[] = body.canvasState.map((img) => ({
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

    console.log("[/api/boards/create] Inserting board into database...");
    await db
      .insert(moodboards)
      .values({
        id: boardId,
        fid,
        title: body.title.trim(),
        caption: body.caption || "",
        canvasState: canvasStateForStorage,
        canvasWidth: body.canvasWidth,
        canvasHeight: body.canvasHeight,
        background: body.background,
        orientation: body.orientation,
        margin: body.margin,
        categories: body.categories,
        primaryCategory: body.categories?.[0] || "Uncategorized",
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
        syncVersion: 1,
      })
      .run();
    console.log("[/api/boards/create] ✓ Board inserted successfully");

    // ====== Log Activity ======
    try {
      console.log("[/api/boards/create] Logging activity...");
      await db
        .insert(activities)
        .values({
          id: `activity_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`,
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
      console.log("[/api/boards/create] ✓ Activity logged");
    } catch (_activityError) {
      // Activity logging is non-critical
      console.debug(
        "[/api/boards/create] ⚠ Activity logging skipped (non-critical)",
      );
    }

    const duration = Date.now() - startTime;
    console.log(`[/api/boards/create] ✅ SUCCESS (${duration}ms)`, {
      boardId,
      fid,
    });

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
    const duration = Date.now() - startTime;
    const errorMsg = error instanceof Error ? error.message : String(error);
    const errorStack = error instanceof Error ? error.stack : "";
    const errorType =
      error instanceof Error ? error.constructor.name : typeof error;

    console.error(`[/api/boards/create] ❌ ERROR (${duration}ms)`, {
      type: errorType,
      message: errorMsg,
      stack: errorStack,
      timestamp: new Date().toISOString(),
    });

    // Provide specific error context
    let details = errorMsg;
    if (errorMsg.includes("TURSO_DATABASE_URL")) {
      details = "Database URL not configured - check Vercel env vars";
    } else if (errorMsg.includes("TURSO_AUTH_TOKEN")) {
      details = "Database auth token not configured - check Vercel env vars";
    } else if (errorMsg.includes("SERVER_ERROR") || errorMsg.includes("404")) {
      details = "Database connection failed - verify Turso database status";
    } else if (errorMsg.includes("JWT") || errorMsg.includes("token")) {
      details = "Authentication token verification failed";
    }

    return NextResponse.json(
      {
        error: "Failed to create board",
        details,
        type: errorType,
      },
      { status: 500 },
    );
  }
}
