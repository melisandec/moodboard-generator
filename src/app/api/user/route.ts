import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { users } from '@/lib/schema';
import { eq } from 'drizzle-orm';
import { verifyAuth, checkOrigin, originDenied } from '@/lib/auth';

export async function POST(req: Request) {
  try {
    if (!checkOrigin(req)) return originDenied();
    const auth = await verifyAuth(req);
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { username, pfpUrl } = await req.json();
    const fid = String(auth.fid);

    const db = getDb();
    const existing = await db.select().from(users).where(eq(users.fid, fid)).get();

    if (existing) {
      await db.update(users)
        .set({ username: username ?? existing.username, pfpUrl: pfpUrl ?? existing.pfpUrl })
        .where(eq(users.fid, fid));
    } else {
      await db.insert(users).values({
        fid,
        username: username ?? '',
        pfpUrl: pfpUrl ?? '',
        createdAt: new Date(),
      });
    }

    return NextResponse.json({ ok: true, fid });
  } catch (err) {
    console.error('User upsert error:', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
