import { NextResponse } from 'next/server';

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

export async function POST(req: Request) {
  try {
    const pinataJwt = process.env.PINATA_JWT;
    if (!pinataJwt) {
      console.error('cast-image: PINATA_JWT not set');
      return NextResponse.json({ error: 'Image storage not configured' }, { status: 503 });
    }

    const incoming = await req.formData();
    const file = incoming.get('file') as Blob | null;
    if (!file) {
      return NextResponse.json({ error: 'Missing file' }, { status: 400 });
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json({ error: 'File too large (max 10 MB)' }, { status: 413 });
    }

    if (file.type && !ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json({ error: 'Invalid file type' }, { status: 415 });
    }

    // Materialize the blob to ensure it survives Node.js FormData forwarding
    const buffer = await file.arrayBuffer();
    const freshBlob = new Blob([buffer], { type: file.type || 'image/jpeg' });

    const pinataForm = new FormData();
    pinataForm.append('file', freshBlob, 'moodboard.jpg');
    pinataForm.append('pinataMetadata', JSON.stringify({ name: `moodboard-${Date.now()}` }));

    const pinataRes = await fetch('https://api.pinata.cloud/pinning/pinFileToIPFS', {
      method: 'POST',
      headers: { Authorization: `Bearer ${pinataJwt}` },
      body: pinataForm,
    });

    if (!pinataRes.ok) {
      const errText = await pinataRes.text();
      console.error('Pinata upload failed:', pinataRes.status, errText);
      return NextResponse.json({ error: 'Upload failed', detail: errText }, { status: 502 });
    }

    const result = await pinataRes.json();
    const ipfsHash = result.IpfsHash;

    if (!ipfsHash) {
      console.error('Pinata response missing IpfsHash:', result);
      return NextResponse.json({ error: 'Upload failed: no hash returned' }, { status: 502 });
    }

    const gateway = (process.env.PINATA_GATEWAY || 'gateway.pinata.cloud').trim();
    const url = `https://${gateway}/ipfs/${ipfsHash}`;

    return NextResponse.json({ url, ipfsHash });
  } catch (err) {
    console.error('Cast image error:', err);
    return NextResponse.json({ error: 'Upload failed' }, { status: 500 });
  }
}
