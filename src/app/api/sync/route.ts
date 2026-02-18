import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { moodboards, images } from '@/lib/schema';
import { eq, and } from 'drizzle-orm';
import { verifyAuth, checkOrigin, originDenied } from '@/lib/auth';

export async function POST(req: Request) {
  try {
    if (!checkOrigin(req)) return originDenied();
    const auth = await verifyAuth(req);
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const fid = String(auth.fid);
    const { boards } = await req.json();

    if (!Array.isArray(boards) || boards.length > 100) {
      return NextResponse.json({ error: 'Invalid boards (must be array, max 100)' }, { status: 400 });
    }

    const db = getDb();

    for (const board of boards) {
      if (!board.id || !board.title || !board.canvasState) continue;

      const existing = await db.select().from(moodboards)
        .where(and(eq(moodboards.id, board.id), eq(moodboards.fid, fid)))
        .get();

      if (existing) {
        if ((board.syncVersion ?? 1) >= (existing.syncVersion ?? 1)) {
          await db.update(moodboards)
            .set({
              title: String(board.title).slice(0, 200),
              caption: String(board.caption ?? '').slice(0, 1000),
              categories: Array.isArray(board.categories) ? board.categories.slice(0, 20) : [],
              canvasState: board.canvasState,
              canvasWidth: Number(board.canvasWidth) || 1080,
              canvasHeight: Number(board.canvasHeight) || 1527,
              background: String(board.background ?? '#f5f5f4').slice(0, 20),
              orientation: String(board.orientation ?? 'portrait'),
              margin: !!board.margin,
              pinned: !!board.pinned,
              updatedAt: new Date(board.updatedAt || Date.now()),
              syncVersion: (existing.syncVersion ?? 1) + 1,
            })
            .where(eq(moodboards.id, board.id));
        }
      } else {
        await db.insert(moodboards).values({
          id: board.id,
          fid,
          title: String(board.title).slice(0, 200),
          caption: String(board.caption ?? '').slice(0, 1000),
          categories: Array.isArray(board.categories) ? board.categories.slice(0, 20) : [],
          canvasState: board.canvasState,
          canvasWidth: Number(board.canvasWidth) || 1080,
          canvasHeight: Number(board.canvasHeight) || 1527,
          background: String(board.background ?? '#f5f5f4').slice(0, 20),
          orientation: String(board.orientation ?? 'portrait'),
          margin: !!board.margin,
          pinned: !!board.pinned,
          createdAt: new Date(board.createdAt || Date.now()),
          updatedAt: new Date(board.updatedAt || Date.now()),
          syncVersion: 1,
        });
      }
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('Sync push error:', err);
    return NextResponse.json({ error: 'Sync failed' }, { status: 500 });
  }
}

export async function GET(req: Request) {
  try {
    if (!checkOrigin(req)) return originDenied();
    const auth = await verifyAuth(req);
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const fid = String(auth.fid);
    const db = getDb();

    const boards = await db.select().from(moodboards).where(eq(moodboards.fid, fid));

    const imgs = await db.select().from(images).where(eq(images.fid, fid));
    const imageMap: Record<string, { url: string; naturalWidth: number; naturalHeight: number }> = {};
    for (const img of imgs) {
      imageMap[img.hash] = {
        url: img.url,
        naturalWidth: img.naturalWidth,
        naturalHeight: img.naturalHeight,
      };
    }

    return NextResponse.json({ boards, imageMap });
  } catch (err) {
    console.error('Sync pull error:', err);
    return NextResponse.json({ error: 'Sync failed' }, { status: 500 });
  }
}
