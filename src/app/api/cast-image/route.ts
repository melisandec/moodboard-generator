import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    const pinataJwt = process.env.PINATA_JWT;
    if (!pinataJwt) {
      return NextResponse.json({ error: 'Image storage not configured' }, { status: 503 });
    }

    const incoming = await req.formData();
    const file = incoming.get('file') as Blob | null;
    if (!file) {
      return NextResponse.json({ error: 'Missing file' }, { status: 400 });
    }

    const pinataForm = new FormData();
    pinataForm.append('file', file, 'moodboard.jpg');

    const pinataRes = await fetch('https://api.pinata.cloud/pinning/pinFileToIPFS', {
      method: 'POST',
      headers: { Authorization: `Bearer ${pinataJwt}` },
      body: pinataForm,
    });

    if (!pinataRes.ok) {
      const errText = await pinataRes.text();
      console.error('Pinata cast-image upload failed:', pinataRes.status, errText);
      return NextResponse.json({ error: 'Upload failed' }, { status: 502 });
    }

    const { IpfsHash } = await pinataRes.json();

    const gateway = process.env.PINATA_GATEWAY || 'gateway.pinata.cloud';
    const url = `https://${gateway}/ipfs/${IpfsHash}`;

    return NextResponse.json({ url });
  } catch (err) {
    console.error('Cast image upload error:', err);
    return NextResponse.json({ error: 'Upload failed' }, { status: 500 });
  }
}
