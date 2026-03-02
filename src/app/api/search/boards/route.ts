import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { moodboards, users } from "@/lib/schema";
import { eq, like, and, desc, sql, gte, or } from "drizzle-orm";

// Phase 4: Advanced search API with full-text search, sorting, and filtering
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const query = searchParams.get("q") || "";
    const sortBy = searchParams.get("sortBy") || "newest"; // newest, views, remixes, likes
    const timeRange = searchParams.get("timeRange") || "all"; // all, week, month, year
    const categoryFilter = searchParams.get("category");
    const page = parseInt(searchParams.get("page") || "1");
    const limit = Math.min(parseInt(searchParams.get("limit") || "20"), 100);

    const db = getDb();
    const offset = (page - 1) * limit;

    // Build conditions array
    const conditions: any[] = [eq(moodboards.isPublic, true)];

    // Text search
    if (query) {
      conditions.push(
        or(
          like(moodboards.title, `%${query}%`),
          like(moodboards.caption, `%${query}%`),
        ),
      );
    }

    // Category filter
    if (categoryFilter && categoryFilter !== "all") {
      conditions.push(eq(moodboards.primaryCategory, categoryFilter));
    }

    // Time range filter
    if (timeRange !== "all") {
      const now = Date.now();
      const ranges: Record<string, number> = {
        week: 7 * 24 * 60 * 60 * 1000,
        month: 30 * 24 * 60 * 60 * 1000,
        year: 365 * 24 * 60 * 60 * 1000,
      };
      const ms = ranges[timeRange] || 0;
      const cutoffDate = new Date(now - ms);
      conditions.push(gte(moodboards.createdAt, cutoffDate));
    }

    // Determine sort order
    let orderColumn = desc(moodboards.updatedAt);
    if (sortBy === "views") {
      orderColumn = desc(moodboards.viewCount);
    } else if (sortBy === "remixes") {
      orderColumn = desc(moodboards.remixCount);
    } else if (sortBy === "likes") {
      orderColumn = desc(moodboards.likeCount);
    }

    // Execute query
    const results = await db
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
      })
      .from(moodboards)
      .innerJoin(users, eq(moodboards.fid, users.fid))
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(orderColumn)
      .limit(limit)
      .offset(offset);

    // Get total count for pagination
    const totalResult = await db
      .select({ count: sql`count(*)` })
      .from(moodboards)
      .where(conditions.length > 0 ? and(...conditions) : undefined);

    const total = (totalResult[0]?.count as number) || 0;

    return NextResponse.json({
      boards: results,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("Search error:", error);
    return NextResponse.json({ error: "Search failed" }, { status: 500 });
  }
}
