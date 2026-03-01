import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { moodboards, images } from "@/lib/schema";
import { eq, and } from "drizzle-orm";
import { verifyAuth, checkOrigin, originDenied } from "@/lib/auth";
import { revalidateTag } from "next/cache";

function toDate(value: unknown, fallback = new Date()): Date {
  if (!value) return fallback;
  const d = new Date(String(value));
  return Number.isNaN(d.getTime()) ? fallback : d;
}

export async function POST(req: Request) {
  try {
    if (!checkOrigin(req)) return originDenied();
    const auth = await verifyAuth(req);
    if (!auth)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const fid = String(auth.fid);
    const { boards } = await req.json();

    if (!Array.isArray(boards) || boards.length > 100) {
      return NextResponse.json(
        { error: "Invalid boards (must be array, max 100)" },
        { status: 400 },
      );
    }

    const db = getDb();
    let saved = 0;
    let shouldRevalidatePublicFeed = false;
    const publicBoardTagIds = new Set<string>();

    for (const board of boards) {
      if (!board.id || !board.title || !board.canvasState) continue;

      const incomingUpdatedAt = toDate(board.updatedAt, new Date());
      const incomingCreatedAt = toDate(board.createdAt, incomingUpdatedAt);

      const payload = {
        title: String(board.title).slice(0, 200),
        caption: String(board.caption ?? "").slice(0, 1000),
        categories: Array.isArray(board.categories)
          ? board.categories.slice(0, 20)
          : [],
        canvasState: board.canvasState,
        canvasWidth: Number(board.canvasWidth) || 1080,
        canvasHeight: Number(board.canvasHeight) || 1527,
        background: String(board.background ?? "#f5f5f4").slice(0, 20),
        orientation: String(board.orientation ?? "portrait"),
        margin: !!board.margin,
        pinned: !!board.pinned,
        isPublic: !!board.isPublic,
        editHistory: Array.isArray(board.editHistory)
          ? board.editHistory.slice(0, 10)
          : [],
        remixOfId: board.remixOfId ?? null,
        updatedAt: incomingUpdatedAt,
      };

      const existing = await db
        .select()
        .from(moodboards)
        .where(and(eq(moodboards.id, board.id), eq(moodboards.fid, fid)))
        .get();

      if (payload.isPublic || existing?.isPublic) {
        publicBoardTagIds.add(board.id);
      }

      if (existing) {
        const existingUpdatedAt =
          existing.updatedAt instanceof Date
            ? existing.updatedAt
            : toDate(existing.updatedAt, new Date(0));

        // Idempotent semantics: ignore stale or duplicate updates.
        if (incomingUpdatedAt.getTime() < existingUpdatedAt.getTime()) {
          continue;
        }

        const publishedAt =
          existing.publishedAt ??
          (payload.isPublic
            ? board.publishedAt
              ? toDate(board.publishedAt, incomingUpdatedAt)
              : incomingUpdatedAt
            : null);

        await db
          .update(moodboards)
          .set({
            ...payload,
            previewUrl: board.previewUrl ?? existing.previewUrl ?? null,
            publishedAt,
            syncVersion:
              Math.max(existing.syncVersion ?? 1, board.syncVersion ?? 1) + 1,
          })
          .where(eq(moodboards.id, board.id));
        saved += 1;

        if (payload.isPublic || existing.isPublic) {
          shouldRevalidatePublicFeed = true;
        }
      } else {
        // On insert: set publishedAt if provided or if board is public (set to now)
        const publishedAt = board.publishedAt
          ? toDate(board.publishedAt, incomingUpdatedAt)
          : payload.isPublic
            ? incomingUpdatedAt
            : null;

        try {
          await db.insert(moodboards).values({
            id: board.id,
            fid,
            ...payload,
            previewUrl: board.previewUrl ?? null,
            publishedAt,
            createdAt: incomingCreatedAt,
            syncVersion: Math.max(1, board.syncVersion ?? 1),
          });
          saved += 1;

          if (payload.isPublic) {
            shouldRevalidatePublicFeed = true;
          }
        } catch {
          // Concurrent duplicate insert: treat as update path.
          const existingAfterConflict = await db
            .select()
            .from(moodboards)
            .where(and(eq(moodboards.id, board.id), eq(moodboards.fid, fid)))
            .get();
          if (!existingAfterConflict)
            throw new Error("Insert conflict without existing row");

          const existingUpdatedAt =
            existingAfterConflict.updatedAt instanceof Date
              ? existingAfterConflict.updatedAt
              : toDate(existingAfterConflict.updatedAt, new Date(0));
          if (incomingUpdatedAt.getTime() < existingUpdatedAt.getTime()) {
            continue;
          }

          const conflictPublishedAt =
            existingAfterConflict.publishedAt ??
            (payload.isPublic ? incomingUpdatedAt : null);

          await db
            .update(moodboards)
            .set({
              ...payload,
              previewUrl:
                board.previewUrl ?? existingAfterConflict.previewUrl ?? null,
              publishedAt: conflictPublishedAt,
              syncVersion:
                Math.max(
                  existingAfterConflict.syncVersion ?? 1,
                  board.syncVersion ?? 1,
                ) + 1,
            })
            .where(eq(moodboards.id, board.id));
          saved += 1;

          if (payload.isPublic || existingAfterConflict.isPublic) {
            shouldRevalidatePublicFeed = true;
          }
        }
      }
    }

    if (shouldRevalidatePublicFeed) {
      revalidateTag("public-feed", "max");
      for (const boardId of publicBoardTagIds) {
        revalidateTag(`public-board:${boardId}`, "max");
      }
    }

    return NextResponse.json({ saved, status: "ok" });
  } catch (err) {
    console.error("Sync push error:", err);
    return NextResponse.json({ error: "Sync failed" }, { status: 500 });
  }
}

export async function GET(req: Request) {
  try {
    if (!checkOrigin(req)) return originDenied();
    const auth = await verifyAuth(req);
    if (!auth)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const fid = String(auth.fid);
    const db = getDb();

    const boards = await db
      .select()
      .from(moodboards)
      .where(eq(moodboards.fid, fid));

    const imgs = await db.select().from(images).where(eq(images.fid, fid));
    const imageMap: Record<
      string,
      { url: string; naturalWidth: number; naturalHeight: number }
    > = {};
    for (const img of imgs) {
      imageMap[img.hash] = {
        url: img.url,
        naturalWidth: img.naturalWidth,
        naturalHeight: img.naturalHeight,
      };
    }

    return NextResponse.json({ boards, imageMap });
  } catch (err) {
    console.error("Sync pull error:", err);
    return NextResponse.json({ error: "Sync failed" }, { status: 500 });
  }
}
