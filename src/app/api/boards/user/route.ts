import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { moodboards } from "@/lib/schema";
import { eq, and, desc, like, type SQLWrapper } from "drizzle-orm";
import { verifyAuth } from "@/lib/auth";

export async function GET(request: NextRequest) {
  try {
    const user = await verifyAuth(request);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const db = getDb();
    const fid = String(user.fid);

    // Query parameters
    const url = new URL(request.url);
    const visibility = url.searchParams.get("visibility") || "all"; // all, public, private
    const category = url.searchParams.get("category") || null;
    const search = url.searchParams.get("search") || null;
    const page = Math.max(1, parseInt(url.searchParams.get("page") || "1", 10));
    const limit = Math.min(
      50,
      parseInt(url.searchParams.get("limit") || "12", 10),
    );
    const offset = (page - 1) * limit;

    // Build where clause
    const conditions: (SQLWrapper | undefined)[] = [eq(moodboards.fid, fid)];

    // Visibility filter
    if (visibility === "public") {
      conditions.push(eq(moodboards.isPublic, true));
    } else if (visibility === "private") {
      conditions.push(eq(moodboards.isPublic, false));
    }

    // Category filter
    if (category && category !== "All") {
      conditions.push(eq(moodboards.primaryCategory, category));
    }

    // Search filter
    if (search) {
      conditions.push(like(moodboards.title, `%${search}%`));
    }

    // Get total count
    const countResult = await db
      .select({ count: moodboards.id })
      .from(moodboards)
      .where(and(...conditions));
    const total = countResult.length;

    // Get paginated boards
    const boards = await db
      .select()
      .from(moodboards)
      .where(and(...conditions))
      .orderBy(desc(moodboards.updatedAt))
      .limit(limit)
      .offset(offset);

    return NextResponse.json({
      boards,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("Error fetching user boards:", error);
    return NextResponse.json(
      { error: "Failed to fetch boards" },
      { status: 500 },
    );
  }
}
