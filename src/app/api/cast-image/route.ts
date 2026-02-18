import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    const { data, contentType } = await req.json();
    if (!data) {
      return NextResponse.json({ error: 'Missing image data' }, { status: 400 });
    }

    const pinataJwt = process.env.PINATA_JWT;
    if (!pinataJwt) {
      return NextResponse.json({ error: 'Image storage not configured' }, { status: 503 });
    }

    const binary = Buffer.from(data, 'base64');
    const blob = new Blob([binary], { type: contentType || 'image/png' });
    const formData = new FormData();
    formData.append('file', blob, 'moodboard.png');

    const pinataRes = await fetch('https://api.pinata.cloud/pinning/pinFileToIPFS', {
      method: 'POST',
      headers: { Authorization: `Bearer ${pinataJwt}` },
      body: formData,
    });

    if (!pinataRes.ok) {
      console.error('Pinata cast-image upload failed:', pinataRes.status);
      return NextResponse.json({ error: 'Upload failed' }, { status: 502 });
    }

    const { IpfsHash } = await pinataRes.json();
    const url = `https://gateway.pinata.cloud/ipfs/${IpfsHash}`;

    return NextResponse.json({ url });
  } catch (err) {
    console.error('Cast image upload error:', err);
    return NextResponse.json({ error: 'Upload failed' }, { status: 500 });
  }
}
