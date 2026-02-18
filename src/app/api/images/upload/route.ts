import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { images } from '@/lib/schema';
import { eq } from 'drizzle-orm';

export async function POST(req: Request) {
  try {
    const { fid, hash, data, contentType, filename, naturalWidth, naturalHeight, tags } =
      await req.json();

    if (!fid || !hash || !data) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
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

    const binary = Buffer.from(data, 'base64');
    const blob = new Blob([binary], { type: contentType || 'image/png' });
    const formData = new FormData();
    formData.append('file', blob, filename || `moodboard-${hash}.png`);

    const pinataRes = await fetch('https://api.pinata.cloud/pinning/pinFileToIPFS', {
      method: 'POST',
      headers: { Authorization: `Bearer ${pinataJwt}` },
      body: formData,
    });

    if (!pinataRes.ok) {
      const errText = await pinataRes.text();
      console.error('Pinata upload failed:', pinataRes.status, errText);
      return NextResponse.json({ error: 'Image upload failed' }, { status: 502 });
    }

    const { IpfsHash } = await pinataRes.json();
    const url = `https://gateway.pinata.cloud/ipfs/${IpfsHash}`;

    await db.insert(images).values({
      hash,
      fid: String(fid),
      url,
      filename: filename || '',
      naturalWidth: naturalWidth ?? 0,
      naturalHeight: naturalHeight ?? 0,
      tags: tags ?? [],
      createdAt: new Date(),
    });

    return NextResponse.json({ url, hash });
  } catch (err) {
    console.error('Image upload error:', err);
    return NextResponse.json({ error: 'Upload failed' }, { status: 500 });
  }
}
