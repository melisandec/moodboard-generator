import type { Artwork, CanvasImage } from './storage';
import { imageHash } from './storage';
import { compressForUpload } from './canvas';

export interface CloudUser {
  fid: string;
  username: string;
  pfpUrl: string;
}

export type SyncStatus = 'idle' | 'syncing' | 'synced' | 'offline' | 'error';

type FetchFn = typeof fetch;

interface CloudCanvasImage {
  id: string;
  imageHash: string;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  pinned: boolean;
  zIndex: number;
  naturalWidth: number;
  naturalHeight: number;
}

export async function registerUser(user: CloudUser, fetchFn: FetchFn): Promise<void> {
  const res = await fetchFn('/api/user', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: user.username, pfpUrl: user.pfpUrl }),
  });
  if (!res.ok) {
    console.error('registerUser failed:', res.status, await res.text().catch(() => ''));
    throw new Error('Failed to register user');
  }
}

async function uploadImage(
  dataUrl: string,
  hash: string,
  filename: string,
  naturalWidth: number,
  naturalHeight: number,
  fetchFn: FetchFn,
): Promise<string> {
  const blob = await compressForUpload(dataUrl);

  const formData = new FormData();
  formData.append('file', blob, filename || `image-${hash}.jpg`);
  formData.append('hash', hash);
  formData.append('naturalWidth', String(naturalWidth));
  formData.append('naturalHeight', String(naturalHeight));

  const res = await fetchFn('/api/images/upload', {
    method: 'POST',
    body: formData,
  });
  if (!res.ok) {
    console.error('uploadImage failed:', res.status, await res.text().catch(() => ''));
    throw new Error('Image upload failed');
  }
  const { url } = await res.json();
  return url;
}

function toCloudCanvas(imgs: CanvasImage[]): CloudCanvasImage[] {
  return imgs.map((img) => ({
    id: img.id,
    imageHash: imageHash(img.dataUrl),
    x: img.x,
    y: img.y,
    width: img.width,
    height: img.height,
    rotation: img.rotation,
    pinned: img.pinned,
    zIndex: img.zIndex,
    naturalWidth: img.naturalWidth,
    naturalHeight: img.naturalHeight,
  }));
}

export async function pushToCloud(artworks: Artwork[], fetchFn: FetchFn): Promise<void> {
  const uploadedHashes = new Set<string>();

  for (const aw of artworks) {
    for (const img of aw.images) {
      const hash = imageHash(img.dataUrl);
      if (!uploadedHashes.has(hash)) {
        await uploadImage(img.dataUrl, hash, `image-${hash}`, img.naturalWidth, img.naturalHeight, fetchFn);
        uploadedHashes.add(hash);
      }
    }
  }

  const boards = artworks.map((aw) => ({
    id: aw.id,
    title: aw.title,
    caption: aw.caption,
    categories: aw.categories ?? [],
    canvasState: toCloudCanvas(aw.images),
    canvasWidth: aw.canvasWidth,
    canvasHeight: aw.canvasHeight,
    background: aw.bgColor,
    orientation: aw.orientation,
    margin: aw.imageMargin,
    pinned: aw.pinned,
    createdAt: aw.createdAt,
    updatedAt: aw.updatedAt,
    syncVersion: 1,
  }));

  const res = await fetchFn('/api/sync', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ boards }),
  });
  if (!res.ok) {
    console.error('pushToCloud failed:', res.status, await res.text().catch(() => ''));
    throw new Error('Sync push failed');
  }
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

export async function pullFromCloud(fetchFn: FetchFn): Promise<Artwork[]> {
  const res = await fetchFn('/api/sync');
  if (!res.ok) {
    console.error('pullFromCloud failed:', res.status, await res.text().catch(() => ''));
    throw new Error('Sync pull failed');
  }

  const { boards, imageMap } = await res.json() as {
    boards: Array<{
      id: string; title: string; caption: string;
      categories: string[]; canvasState: CloudCanvasImage[];
      canvasWidth: number; canvasHeight: number;
      background: string; orientation: string; margin: boolean;
      pinned: boolean; createdAt: string | number; updatedAt: string | number;
    }>;
    imageMap: Record<string, { url: string; naturalWidth: number; naturalHeight: number }>;
  };

  const artworks: Artwork[] = [];

  for (const board of boards) {
    const canvasImages: CanvasImage[] = [];

    for (const ci of board.canvasState) {
      const info = imageMap[ci.imageHash];
      if (!info) continue;

      try {
        const imgRes = await fetch(info.url);
        const blob = await imgRes.blob();
        const dataUrl = await blobToDataUrl(blob);
        canvasImages.push({
          id: ci.id, dataUrl,
          x: ci.x, y: ci.y, width: ci.width, height: ci.height,
          rotation: ci.rotation, pinned: ci.pinned, zIndex: ci.zIndex,
          naturalWidth: ci.naturalWidth, naturalHeight: ci.naturalHeight,
        });
      } catch (err) {
        console.error('Failed to fetch IPFS image:', info.url, err);
      }
    }

    const toIso = (v: string | number) =>
      typeof v === 'string' ? v : new Date(v).toISOString();

    artworks.push({
      id: board.id,
      title: board.title,
      caption: board.caption ?? '',
      images: canvasImages,
      canvasWidth: board.canvasWidth,
      canvasHeight: board.canvasHeight,
      orientation: (board.orientation as Artwork['orientation']) ?? 'portrait',
      bgColor: board.background ?? '#f5f5f4',
      imageMargin: board.margin ?? false,
      categories: board.categories ?? [],
      pinned: board.pinned ?? false,
      createdAt: toIso(board.createdAt),
      updatedAt: toIso(board.updatedAt),
    });
  }

  return artworks;
}
