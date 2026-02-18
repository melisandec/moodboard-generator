import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { users } from '@/lib/schema';
import { eq } from 'drizzle-orm';

export async function POST(req: Request) {
  try {
    const { fid, username, pfpUrl } = await req.json();
    if (!fid) return NextResponse.json({ error: 'Missing fid' }, { status: 400 });

    const db = getDb();
    const existing = await db.select().from(users).where(eq(users.fid, String(fid))).get();

    if (existing) {
      await db.update(users)
        .set({ username: username ?? existing.username, pfpUrl: pfpUrl ?? existing.pfpUrl })
        .where(eq(users.fid, String(fid)));
    } else {
      await db.insert(users).values({
        fid: String(fid),
        username: username ?? '',
        pfpUrl: pfpUrl ?? '',
        createdAt: new Date(),
      });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('User upsert error:', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
