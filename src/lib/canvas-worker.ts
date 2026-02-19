/**
 * Canvas rendering Web Worker — performs heavy image compositing off the main
 * thread using OffscreenCanvas + createImageBitmap.
 *
 * Receives image blobs + layout data, renders the moodboard, and returns
 * the result as a JPEG Blob.
 */

export interface RenderRequest {
  type: 'renderToBlob' | 'renderThumbnail';
  images: Array<{
    blob: Blob;
    x: number;
    y: number;
    width: number;
    height: number;
    rotation: number;
    zIndex: number;
  }>;
  canvasWidth: number;
  canvasHeight: number;
  bgColor: string;
  margin: boolean;
  title?: string;
  caption?: string;
  quality?: number;
  /** For renderToBlob: optional scale-down (e.g. Math.min(1, 1200/cw)) */
  scale?: number;
}

export interface RenderResponse {
  type: 'result';
  blob: Blob;
}

export interface RenderError {
  type: 'error';
  message: string;
}

// ---------------------------------------------------------------------------
// Text drawing (mirrored from canvas.ts for worker isolation)
// ---------------------------------------------------------------------------

function wrapText(ctx: OffscreenCanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const words = text.split(' ');
  const lines: string[] = [];
  let current = '';
  for (const word of words) {
    const test = current ? `${current} ${word}` : word;
    if (ctx.measureText(test).width > maxWidth && current) {
      lines.push(current);
      current = word;
    } else {
      current = test;
    }
  }
  if (current) lines.push(current);
  return lines;
}

function isDark(hex: string) {
  const c = hex.replace('#', '');
  const r = parseInt(c.substring(0, 2), 16);
  const g = parseInt(c.substring(2, 4), 16);
  const b = parseInt(c.substring(4, 6), 16);
  return r * 0.299 + g * 0.587 + b * 0.114 < 128;
}

function drawTitleCaption(
  ctx: OffscreenCanvasRenderingContext2D,
  title: string,
  caption: string,
  width: number,
  height: number,
  darkBg: boolean,
) {
  const pad = width * 0.045;
  const maxW = width - pad * 2;
  let y = height - pad * 0.5;
  const alpha = darkBg ? 0.7 : 1;

  if (caption) {
    const sz = Math.round(width * 0.017);
    ctx.font = `300 ${sz}px sans-serif`;
    ctx.fillStyle = darkBg ? `rgba(255,255,255,${alpha * 0.6})` : 'rgba(0,0,0,0.3)';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'bottom';
    for (const l of wrapText(ctx, caption, maxW).reverse()) {
      ctx.fillText(l, pad, y);
      y -= sz + 4;
    }
    y -= 2;
  }

  if (title) {
    const sz = Math.round(width * 0.023);
    ctx.font = `400 ${sz}px sans-serif`;
    ctx.fillStyle = darkBg ? `rgba(255,255,255,${alpha * 0.85})` : 'rgba(0,0,0,0.45)';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'bottom';
    for (const l of wrapText(ctx, title, maxW).reverse()) {
      ctx.fillText(l, pad, y);
      y -= sz + 4;
    }
  }
}

// ---------------------------------------------------------------------------
// Worker message handler
// ---------------------------------------------------------------------------

self.onmessage = async (e: MessageEvent<RenderRequest>) => {
  try {
    const req = e.data;
    const scale = req.scale ?? 1;
    const w = Math.round(req.canvasWidth * scale);
    const h = Math.round(req.canvasHeight * scale);

    // Create OffscreenCanvas
    const canvas = new OffscreenCanvas(w, h);
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Failed to get 2d context');

    // Fill background
    ctx.fillStyle = req.bgColor;
    ctx.fillRect(0, 0, w, h);

    // Load all images as ImageBitmap (concurrently)
    const bitmaps = await Promise.all(
      req.images.map((img) => createImageBitmap(img.blob)),
    );

    // Sort by zIndex and draw
    const sorted = req.images
      .map((img, i) => ({ ...img, bitmap: bitmaps[i] }))
      .sort((a, b) => a.zIndex - b.zIndex);

    const borderPx = req.margin ? Math.max(req.type === 'renderThumbnail' ? 1 : 2, w * 0.003) : 0;

    for (const im of sorted) {
      ctx.save();
      const sx = im.x * scale;
      const sy = im.y * scale;
      const sw = im.width * scale;
      const sh = im.height * scale;
      ctx.translate(sx + sw / 2, sy + sh / 2);
      ctx.rotate((im.rotation * Math.PI) / 180);
      if (borderPx > 0) {
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(-sw / 2 - borderPx, -sh / 2 - borderPx, sw + borderPx * 2, sh + borderPx * 2);
      }
      ctx.drawImage(im.bitmap, -sw / 2, -sh / 2, sw, sh);
      ctx.restore();
    }

    // Draw title/caption for full renders (not thumbnails)
    if (req.type === 'renderToBlob' && (req.title || req.caption)) {
      drawTitleCaption(ctx, req.title ?? '', req.caption ?? '', w, h, isDark(req.bgColor));
    }

    // Close bitmaps
    for (const bm of bitmaps) bm.close();

    // Convert to blob
    const quality = req.quality ?? (req.type === 'renderThumbnail' ? 0.6 : 0.85);
    const blob = await canvas.convertToBlob({ type: 'image/jpeg', quality });

    const response: RenderResponse = { type: 'result', blob };
    (self as unknown as Worker).postMessage(response);
  } catch (err) {
    const response: RenderError = {
      type: 'error',
      message: err instanceof Error ? err.message : 'Unknown worker error',
    };
    (self as unknown as Worker).postMessage(response);
  }
};
