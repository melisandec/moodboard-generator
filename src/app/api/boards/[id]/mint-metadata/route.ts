import { NextResponse } from "next/server";
import { verifyAuth, checkOrigin, originDenied } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { moodboards } from "@/lib/schema";
import { eq, and } from "drizzle-orm";

// POST  → creates NFT metadata JSON and pins it to IPFS
// PATCH → stores the on-chain tx hash after minting

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!checkOrigin(req)) return originDenied();
  const auth = await verifyAuth(req);
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: boardId } = await params;
  const fid = String(auth.fid);
  const db = getDb();

  const board = await db
    .select()
    .from(moodboards)
    .where(and(eq(moodboards.id, boardId), eq(moodboards.fid, fid)))
    .get();

  if (!board) {
    return NextResponse.json({ error: "Board not found or not yours" }, { status: 404 });
  }

  if (!board.previewUrl) {
    return NextResponse.json(
      { error: "Board has no preview image — publish it first to generate one." },
      { status: 400 },
    );
  }

  const pinataJwt = process.env.PINATA_JWT;
  if (!pinataJwt) {
    return NextResponse.json({ error: "Storage not configured" }, { status: 503 });
  }

  const appDomain =
    process.env.APP_DOMAIN ||
    process.env.NEXT_PUBLIC_APP_DOMAIN ||
    "moodboard-generator-phi.vercel.app";
  const appUrl = appDomain.startsWith("http") ? appDomain : `https://${appDomain}`;

  // Build NFT metadata (OpenSea/ERC-1155 standard)
  const metadata = {
    name: board.title,
    description: board.caption || `A moodboard created on Moodboard Generator`,
    image: board.previewUrl,
    external_url: `${appUrl}/viewer/${boardId}`,
    attributes: [
      { trait_type: "Category", value: board.primaryCategory ?? "Uncategorized" },
      { trait_type: "Orientation", value: board.orientation ?? "portrait" },
      { trait_type: "Image Count", value: (board.canvasState as unknown[]).length },
      { trait_type: "Creator FID", value: fid },
    ],
    properties: {
      files: [{ uri: board.previewUrl, type: "image/jpeg" }],
    },
  };

  // Pin metadata JSON to IPFS
  const metadataBlob = new Blob([JSON.stringify(metadata)], { type: "application/json" });
  const form = new FormData();
  form.append("file", metadataBlob, `moodboard-${boardId}-metadata.json`);
  form.append("pinataMetadata", JSON.stringify({ name: `moodboard-${boardId}-metadata` }));

  const pinataRes = await fetch("https://api.pinata.cloud/pinning/pinFileToIPFS", {
    method: "POST",
    headers: { Authorization: `Bearer ${pinataJwt}` },
    body: form,
    signal: AbortSignal.timeout(30000),
  });

  if (!pinataRes.ok) {
    const errText = await pinataRes.text();
    console.error("Pinata metadata upload failed:", errText);
    return NextResponse.json({ error: "Failed to upload metadata to IPFS" }, { status: 502 });
  }

  const { IpfsHash } = await pinataRes.json();
  const metadataUri = `ipfs://${IpfsHash}`;

  return NextResponse.json({
    metadataUri,
    board: { title: board.title, previewUrl: board.previewUrl },
  });
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!checkOrigin(req)) return originDenied();
  const auth = await verifyAuth(req);
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: boardId } = await params;
  const fid = String(auth.fid);
  const { txHash, contractAddress } = await req.json();
  const db = getDb();

  await db
    .update(moodboards)
    .set({ mintTxHash: txHash ?? null, mintContractAddress: contractAddress ?? null })
    .where(and(eq(moodboards.id, boardId), eq(moodboards.fid, fid)));

  return NextResponse.json({ success: true });
}
