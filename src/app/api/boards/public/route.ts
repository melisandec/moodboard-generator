import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { moodboards, users, images } from "@/lib/schema";
import { eq, desc, like, or, sql, inArray } from "drizzle-orm";
import { unstable_cache } from "next/cache";
import { checkOrigin, originDenied } from "@/lib/auth";
import type { CloudCanvasImage } from "@/lib/schema";

type FeedSortBy = "newest" | "most_viewed" | "trending";

async function queryPublicBoards(options: {
  limit: number;
  offset: number;
  sortBy: FeedSortBy;
  search: string;
}) {
  const { limit, offset, sortBy, search } = options;
  const db = getDb();

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

  const whereClause = eq(moodboards.isPublic, true);

  const countResult = await db
    .select({ count: sql<number>`count(*)` })
    .from(moodboards)
    .where(whereClause)
    .get();

  let total = countResult?.count ?? 0;

  const rows = await db
    .select({
      id: moodboards.id,
      title: moodboards.title,
      caption: moodboards.caption,
      categories: moodboards.categories,
      canvasState: moodboards.canvasState,
      canvasWidth: moodboards.canvasWidth,
      canvasHeight: moodboards.canvasHeight,
      background: moodboards.background,
      previewUrl: moodboards.previewUrl,
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

  let filteredRows = rows;
  if (search) {
    const q = search.toLowerCase();
    filteredRows = rows.filter(
      (r) =>
        r.title?.toLowerCase().includes(q) ||
        r.caption?.toLowerCase().includes(q) ||
        r.username?.toLowerCase().includes(q) ||
        ((r.categories as string[]) ?? []).some((c: string) =>
          c.toLowerCase().includes(q),
        ),
    );
    total = filteredRows.length;
  }

  const allHashes = new Set<string>();
  for (const row of filteredRows) {
    const cs = row.canvasState as CloudCanvasImage[];
    if (cs && cs.length > 0) {
      for (const ci of cs) allHashes.add(ci.imageHash);
    }
  }

  const imageUrlMap: Record<string, string> = {};
  if (allHashes.size > 0) {
    const matchedImages = await db
      .select({ hash: images.hash, url: images.url })
      .from(images)
      .where(inArray(images.hash, [...allHashes]));
    for (const img of matchedImages) imageUrlMap[img.hash] = img.url;
  }

  const boards = filteredRows.map((row) => {
    const cs = row.canvasState as CloudCanvasImage[];
    const previewImages = (cs ?? [])
      .map((ci) => ({
        url: imageUrlMap[ci.imageHash],
        x: ci.x,
        y: ci.y,
        width: ci.width,
        height: ci.height,
        rotation: ci.rotation,
        zIndex: ci.zIndex,
      }))
      .filter((ci) => !!ci.url)
      .sort((a, b) => a.zIndex - b.zIndex);
    const previewMissingCount = Math.max(
      0,
      (cs?.length ?? 0) - previewImages.length,
    );

    return {
      id: row.id,
      title: row.title,
      caption: row.caption ?? "",
      categories: row.categories ?? [],
      thumbnailUrl: row.previewUrl ?? previewImages[0]?.url ?? null,
      previewMissingCount,
      previewImages,
      canvasWidth: row.canvasWidth,
      canvasHeight: row.canvasHeight,
      background: row.background ?? "#f5f5f4",
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

  return { boards, total };
}

async function getCachedPublicBoards(options: {
  limit: number;
  offset: number;
  sortBy: FeedSortBy;
  search: string;
}) {
  return unstable_cache(
    async () => queryPublicBoards(options),
    [
      `public-feed:${options.sortBy}:${options.limit}:${options.offset}:${options.search}`,
    ],
    { tags: ["public-feed"], revalidate: 30 },
  )();
}

export async function GET(req: Request) {
  try {
    if (!checkOrigin(req)) return originDenied();

    const { searchParams } = new URL(req.url);
    const limit = Math.min(Number(searchParams.get("limit")) || 12, 50);
    const offset = Number(searchParams.get("offset")) || 0;
    const sortBy = (searchParams.get("sortBy") || "newest") as FeedSortBy;
    const search = searchParams.get("search")?.trim() || "";

    const shouldCache =
      !search && (sortBy === "newest" || sortBy === "most_viewed");

    const payload = shouldCache
      ? await getCachedPublicBoards({ limit, offset, sortBy, search })
      : await queryPublicBoards({ limit, offset, sortBy, search });

    return NextResponse.json(
      payload,
      shouldCache
        ? {
            headers: {
              "Cache-Control":
                "public, s-maxage=30, stale-while-revalidate=120",
            },
          }
        : undefined,
    );
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
