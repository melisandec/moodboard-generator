import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { images } from '@/lib/schema';
import { eq } from 'drizzle-orm';
import { verifyAuth } from '@/lib/auth';

const MAX_FILE_SIZE = 15 * 1024 * 1024; // 15 MB

export async function POST(req: Request) {
  try {
    const auth = await verifyAuth(req);
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const fid = String(auth.fid);
    const formData = await req.formData();

    const file = formData.get('file') as Blob | null;
    const hash = formData.get('hash') as string | null;
    const naturalWidth = Math.max(0, Number(formData.get('naturalWidth') || 0));
    const naturalHeight = Math.max(0, Number(formData.get('naturalHeight') || 0));
    const filename = String(formData.get('filename') || '').slice(0, 200);

    let tags: string[] = [];
    try {
      const tagsRaw = formData.get('tags') as string | null;
      if (tagsRaw) tags = JSON.parse(tagsRaw);
      if (!Array.isArray(tags)) tags = [];
    } catch { tags = []; }

    if (!hash || !file) {
      return NextResponse.json({ error: 'Missing required fields (hash, file)' }, { status: 400 });
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json({ error: 'File too large (max 15 MB)' }, { status: 413 });
    }

    const db = getDb();

    const existing = await db.select().from(images).where(eq(images.hash, hash)).get();
    if (existing) {
      return NextResponse.json({ url: existing.url, hash: existing.hash });
    }

    const pinataJwt = process.env.PINATA_JWT;
    if (!pinataJwt) {
      return NextResponse.json({ error: 'Image storage not configured' }, { status: 503 });
    }

    const pinataForm = new FormData();
    pinataForm.append('file', file, filename || `moodboard-${hash}.png`);

    const pinataRes = await fetch('https://api.pinata.cloud/pinning/pinFileToIPFS', {
      method: 'POST',
      headers: { Authorization: `Bearer ${pinataJwt}` },
      body: pinataForm,
    });

    if (!pinataRes.ok) {
      const errText = await pinataRes.text();
      console.error('Pinata upload failed:', pinataRes.status, errText);
      return NextResponse.json({ error: 'Image upload failed' }, { status: 502 });
    }

    const { IpfsHash } = await pinataRes.json();
    const gateway = process.env.PINATA_GATEWAY || 'gateway.pinata.cloud';
    const url = `https://${gateway}/ipfs/${IpfsHash}`;

    await db.insert(images).values({
      hash,
      fid,
      url,
      filename,
      naturalWidth,
      naturalHeight,
      tags: tags.slice(0, 50),
      createdAt: new Date(),
    });

    return NextResponse.json({ url, hash });
  } catch (err) {
    console.error('Image upload error:', err);
    return NextResponse.json({ error: 'Upload failed' }, { status: 500 });
  }
}
