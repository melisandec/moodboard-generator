import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { moodboards, users, images } from "@/lib/schema";
import { eq, desc, like, or, sql } from "drizzle-orm";
import { checkOrigin, originDenied } from "@/lib/auth";
import type { CloudCanvasImage } from "@/lib/schema";

export async function GET(req: Request) {
  try {
    if (!checkOrigin(req)) return originDenied();

    const { searchParams } = new URL(req.url);
    const limit = Math.min(Number(searchParams.get("limit")) || 12, 50);
    const offset = Number(searchParams.get("offset")) || 0;
    const sortBy = searchParams.get("sortBy") || "newest";
    const search = searchParams.get("search")?.trim() || "";

    const db = getDb();

    // Build ordering based on sort
    let orderClause;
    switch (sortBy) {
      case "most_viewed":
        orderClause = desc(moodboards.viewCount);
        break;
      case "trending":
        orderClause = desc(moodboards.lastRemixAt);
        break;
      case "newest":
      default:
        orderClause = desc(moodboards.createdAt);
        break;
    }

    // Build base query for public boards
    let whereClause = eq(moodboards.isPublic, true);

    // Get total count
    const countResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(moodboards)
      .where(whereClause)
      .get();

    let total = countResult?.count ?? 0;

    // Fetch boards with user info
    let query = db
      .select({
        id: moodboards.id,
        title: moodboards.title,
        caption: moodboards.caption,
        categories: moodboards.categories,
        canvasState: moodboards.canvasState,
        canvasWidth: moodboards.canvasWidth,
        canvasHeight: moodboards.canvasHeight,
        creatorFid: moodboards.fid,
        editHistory: moodboards.editHistory,
        viewCount: moodboards.viewCount,
        editCount: moodboards.editCount,
        publishedAt: moodboards.publishedAt,
        createdAt: moodboards.createdAt,
        updatedAt: moodboards.updatedAt,
        username: users.username,
        pfpUrl: users.pfpUrl,
      })
      .from(moodboards)
      .leftJoin(users, eq(moodboards.fid, users.fid))
      .where(whereClause)
      .orderBy(orderClause)
      .limit(limit)
      .offset(offset);

    let rows = await query;

    // Client-side search filter (for simplicity; could use FTS for scale)
    if (search) {
      const q = search.toLowerCase();
      rows = rows.filter(
        (r) =>
          r.title?.toLowerCase().includes(q) ||
          r.caption?.toLowerCase().includes(q) ||
          r.username?.toLowerCase().includes(q) ||
          ((r.categories as string[]) ?? []).some((c: string) =>
            c.toLowerCase().includes(q),
          ),
      );
      total = rows.length;
    }

    // Get first image hash from each board for thumbnail
    const allHashes = new Set<string>();
    for (const row of rows) {
      const cs = row.canvasState as CloudCanvasImage[];
      if (cs && cs.length > 0) {
        allHashes.add(cs[0].imageHash);
      }
    }

    // Fetch image URLs for thumbnails
    const imageUrlMap: Record<string, string> = {};
    if (allHashes.size > 0) {
      const allImages = await db.select().from(images);
      for (const img of allImages) {
        if (allHashes.has(img.hash)) {
          imageUrlMap[img.hash] = img.url;
        }
      }
    }

    const boards = rows.map((row) => {
      const cs = row.canvasState as CloudCanvasImage[];
      const firstHash = cs?.[0]?.imageHash;
      return {
        id: row.id,
        title: row.title,
        caption: row.caption ?? "",
        categories: row.categories ?? [],
        thumbnailUrl: firstHash ? (imageUrlMap[firstHash] ?? null) : null,
        creatorFid: row.creatorFid,
        creatorUsername: row.username ?? "",
        creatorPfpUrl: row.pfpUrl ?? "",
        editHistory: row.editHistory ?? [],
        viewCount: row.viewCount ?? 0,
        editCount: row.editCount ?? 0,
        publishedAt:
          row.publishedAt instanceof Date
            ? row.publishedAt.toISOString()
            : row.publishedAt
              ? String(row.publishedAt)
              : null,
        createdAt:
          row.createdAt instanceof Date
            ? row.createdAt.toISOString()
            : String(row.createdAt),
        updatedAt:
          row.updatedAt instanceof Date
            ? row.updatedAt.toISOString()
            : String(row.updatedAt),
      };
    });

    return NextResponse.json({ boards, total });
  } catch (err) {
    console.error("Public boards error:", err);

    const msg = err instanceof Error ? err.message : String(err);
    const causeMsg =
      err && typeof err === "object" && "cause" in err
        ? String((err as { cause?: unknown }).cause)
        : "";
    const nestedCauseMsg =
      err &&
      typeof err === "object" &&
      "cause" in err &&
      (err as { cause?: unknown }).cause &&
      typeof (err as { cause?: unknown }).cause === "object" &&
      "cause" in ((err as { cause?: { cause?: unknown } }).cause ?? {})
        ? String(
            (
              (err as { cause?: { cause?: unknown } }).cause as {
                cause?: unknown;
              }
            ).cause,
          )
        : "";

    if (
      /no such column/i.test(msg) ||
      /no such column/i.test(causeMsg) ||
      /no such column/i.test(nestedCauseMsg)
    ) {
      return NextResponse.json({ boards: [], total: 0, needsMigration: true });
    }

    return NextResponse.json(
      { error: "Failed to fetch public boards" },
      { status: 500 },
    );
  }
}
