import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { moodboards, images } from '@/lib/schema';
import { eq } from 'drizzle-orm';

export async function POST(req: Request) {
  try {
    const { fid, boards } = await req.json();
    if (!fid || !Array.isArray(boards)) {
      return NextResponse.json({ error: 'Missing fid or boards' }, { status: 400 });
    }

    const db = getDb();

    for (const board of boards) {
      const existing = await db.select().from(moodboards).where(eq(moodboards.id, board.id)).get();

      if (existing) {
        if ((board.syncVersion ?? 1) >= (existing.syncVersion ?? 1)) {
          await db.update(moodboards)
            .set({
              title: board.title,
              caption: board.caption ?? '',
              categories: board.categories ?? [],
              canvasState: board.canvasState,
              canvasWidth: board.canvasWidth,
              canvasHeight: board.canvasHeight,
              background: board.background ?? '#f5f5f4',
              orientation: board.orientation ?? 'portrait',
              margin: board.margin ?? false,
              pinned: board.pinned ?? false,
              updatedAt: new Date(board.updatedAt),
              syncVersion: (existing.syncVersion ?? 1) + 1,
            })
            .where(eq(moodboards.id, board.id));
        }
      } else {
        await db.insert(moodboards).values({
          id: board.id,
          fid: String(fid),
          title: board.title,
          caption: board.caption ?? '',
          categories: board.categories ?? [],
          canvasState: board.canvasState,
          canvasWidth: board.canvasWidth ?? 1080,
          canvasHeight: board.canvasHeight ?? 1527,
          background: board.background ?? '#f5f5f4',
          orientation: board.orientation ?? 'portrait',
          margin: board.margin ?? false,
          pinned: board.pinned ?? false,
          createdAt: new Date(board.createdAt),
          updatedAt: new Date(board.updatedAt),
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
    const { searchParams } = new URL(req.url);
    const fid = searchParams.get('fid');
    if (!fid) {
      return NextResponse.json({ error: 'Missing fid' }, { status: 400 });
    }

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
