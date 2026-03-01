import type { CanvasImage } from "./storage";

interface Placement {
  img: HTMLImageElement;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
}

function shuffle<T>(array: T[]): T[] {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
): string[] {
  const words = text.split(" ");
  const lines: string[] = [];
  let current = "";
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

function drawTitleCaption(
  ctx: CanvasRenderingContext2D,
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
    ctx.font = `300 ${sz}px -apple-system, "Helvetica Neue", Arial, sans-serif`;
    ctx.fillStyle = darkBg
      ? `rgba(255,255,255,${alpha * 0.6})`
      : "rgba(0,0,0,0.3)";
    ctx.textAlign = "left";
    ctx.textBaseline = "bottom";
    for (const l of wrapText(ctx, caption, maxW).reverse()) {
      ctx.fillText(l, pad, y);
      y -= sz + 4;
    }
    y -= 2;
  }

  if (title) {
    const sz = Math.round(width * 0.023);
    ctx.font = `400 ${sz}px -apple-system, "Helvetica Neue", Arial, sans-serif`;
    ctx.fillStyle = darkBg
      ? `rgba(255,255,255,${alpha * 0.85})`
      : "rgba(0,0,0,0.45)";
    ctx.textAlign = "left";
    ctx.textBaseline = "bottom";
    for (const l of wrapText(ctx, title, maxW).reverse()) {
      ctx.fillText(l, pad, y);
      y -= sz + 4;
    }
  }
}

function isDark(hex: string) {
  const c = hex.replace("#", "");
  const r = parseInt(c.substring(0, 2), 16);
  const g = parseInt(c.substring(2, 4), 16);
  const b = parseInt(c.substring(4, 6), 16);
  return r * 0.299 + g * 0.587 + b * 0.114 < 128;
}

// ---------------------------------------------------------------------------
// Auto-generate collage
// ---------------------------------------------------------------------------

function generatePlacements(
  images: HTMLImageElement[],
  W: number,
  H: number,
  reserveBottom: number,
): Placement[] {
  const n = images.length;
  const margin = W * 0.03;
  const usableW = W - margin * 2;
  const usableH = H - margin * 2 - reserveBottom;
  const aspect = usableW / usableH;
  let cols = Math.max(1, Math.round(Math.sqrt(n * aspect)));
  const rows = Math.max(1, Math.ceil(n / cols));
  while (cols * rows < n) cols++;
  const cellW = usableW / cols;
  const cellH = usableH / rows;
  const shuffled = shuffle(images);
  const placements: Placement[] = [];

  for (let i = 0; i < n; i++) {
    const img = shuffled[i];
    let ia = img.naturalWidth / img.naturalHeight;
    ia = clamp(ia, 0.4, 2.5);
    const col = i % cols;
    const row = Math.floor(i / cols);
    let sm = 0.82 + Math.random() * 0.56;
    if (Math.random() < 0.22) sm *= 1.35;
    let w = cellW * sm;
    let h = w / ia;
    if (h > cellH * sm * 1.4) {
      h = cellH * sm * 1.4;
      w = h * ia;
    }
    const cx = margin + col * cellW + cellW / 2;
    const cy = margin + row * cellH + cellH / 2;
    const ox = (Math.random() - 0.5) * cellW * 0.55;
    const oy = (Math.random() - 0.5) * cellH * 0.55;
    placements.push({
      img,
      x: clamp(cx + ox - w / 2, -w * 0.1, W - w * 0.9),
      y: clamp(cy + oy - h / 2, -h * 0.1, H - reserveBottom - h * 0.9),
      width: w,
      height: h,
      rotation: 0,
    });
  }
  return shuffle(placements);
}

export async function loadImage(
  file: File,
  maxDim = 1200,
): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      if (img.width <= maxDim && img.height <= maxDim) {
        resolve(img);
        return;
      }
      const ratio = Math.min(maxDim / img.width, maxDim / img.height);
      const w = Math.round(img.width * ratio);
      const h = Math.round(img.height * ratio);
      const c = document.createElement("canvas");
      c.width = w;
      c.height = h;
      c.getContext("2d")!.drawImage(img, 0, 0, w, h);
      const resized = new Image();
      resized.onload = () => resolve(resized);
      resized.onerror = reject;
      resized.src = c.toDataURL("image/jpeg", 0.85);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error(`Failed: ${file.name}`));
    };
    img.src = url;
  });
}

export function renderMoodboard(
  images: HTMLImageElement[],
  title: string,
  caption: string,
  width = 1080,
  height = 1350,
): string {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#f5f5f4";
  ctx.fillRect(0, 0, width, height);
  const hasText = !!(title || caption);
  const rb = hasText ? height * 0.075 : 0;
  for (const p of generatePlacements(images, width, height, rb)) {
    ctx.save();
    ctx.translate(p.x + p.width / 2, p.y + p.height / 2);
    ctx.rotate((p.rotation * Math.PI) / 180);
    ctx.shadowColor = "rgba(0,0,0,0.07)";
    ctx.shadowBlur = 14;
    ctx.shadowOffsetX = 1;
    ctx.shadowOffsetY = 3;
    const b = Math.max(3, width * 0.004);
    ctx.fillStyle = "#fff";
    ctx.fillRect(
      -p.width / 2 - b,
      -p.height / 2 - b,
      p.width + b * 2,
      p.height + b * 2,
    );
    ctx.shadowColor = "transparent";
    ctx.shadowBlur = 0;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 0;
    ctx.drawImage(p.img, -p.width / 2, -p.height / 2, p.width, p.height);
    ctx.restore();
  }
  drawTitleCaption(ctx, title, caption, width, height, false);
  return canvas.toDataURL("image/png");
}

// ---------------------------------------------------------------------------
// Manual-mode helpers
// ---------------------------------------------------------------------------

export async function compressForStorage(
  file: File,
  maxDim = 1000,
): Promise<{ dataUrl: string; naturalWidth: number; naturalHeight: number }> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      const ratio = Math.min(maxDim / img.width, maxDim / img.height, 1);
      const w = Math.round(img.width * ratio);
      const h = Math.round(img.height * ratio);
      const c = document.createElement("canvas");
      c.width = w;
      c.height = h;
      c.getContext("2d")!.drawImage(img, 0, 0, w, h);
      resolve({
        dataUrl: c.toDataURL("image/jpeg", 0.8),
        naturalWidth: w,
        naturalHeight: h,
      });
    };
    img.onerror = reject;
    img.src = url;
  });
}

export function createInitialPlacements(
  images: Array<{
    dataUrl: string;
    naturalWidth: number;
    naturalHeight: number;
  }>,
  cw: number,
  ch: number,
): CanvasImage[] {
  const n = images.length;
  const m = cw * 0.06;
  const uw = cw - m * 2,
    uh = ch - m * 2;
  const cols = Math.max(1, Math.round(Math.sqrt(n * (uw / uh))));
  const rows = Math.max(1, Math.ceil(n / cols));
  const cellW = uw / cols,
    cellH = uh / rows;

  return images.map((img, i) => {
    const col = i % cols,
      row = Math.floor(i / cols);
    const ar = clamp(img.naturalWidth / img.naturalHeight, 0.4, 2.5);
    let w = cellW * 0.78,
      h = w / ar;
    if (h > cellH * 0.78) {
      h = cellH * 0.78;
      w = h * ar;
    }
    const cx = m + col * cellW + cellW / 2;
    const cy = m + row * cellH + cellH / 2;
    return {
      id: `img-${i}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      dataUrl: img.dataUrl,
      x: cx - w / 2 + (Math.random() - 0.5) * cellW * 0.12,
      y: cy - h / 2 + (Math.random() - 0.5) * cellH * 0.12,
      width: w,
      height: h,
      rotation: 0,
      pinned: false,
      zIndex: i,
      naturalWidth: img.naturalWidth,
      naturalHeight: img.naturalHeight,
    };
  });
}

/**
 * Render a tiny thumbnail (~200px wide) of the moodboard for collection previews.
 */
export async function renderThumbnail(
  images: CanvasImage[],
  cw: number,
  ch: number,
  bgColor = "#f5f5f4",
  margin = false,
): Promise<string> {
  console.log(`[renderThumbnail] Starting with ${images.length} images`);
  const scale = Math.min(1, 200 / cw);
  const w = Math.round(cw * scale);
  const h = Math.round(ch * scale);

  // Use allSettled so one broken image doesn't kill the whole thumbnail
  const results = await Promise.allSettled(
    images.map((im) =>
      im.dataUrl ? loadImageFromUrl(im.dataUrl) : Promise.reject("no dataUrl"),
    ),
  );

  console.log(
    `[renderThumbnail] Load results: ${results.filter((r) => r.status === "fulfilled").length} succeeded`,
  );

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = bgColor;
  ctx.fillRect(0, 0, w, h);

  const sorted = images
    .map((im, i) => ({
      ...im,
      el: results[i].status === "fulfilled" ? results[i].value : null,
    }))
    .filter((im): im is typeof im & { el: HTMLImageElement } => im.el !== null)
    .sort((a, b) => a.zIndex - b.zIndex);

  console.log(`[renderThumbnail] Sorted images to render: ${sorted.length}`);

  const borderPx = margin ? Math.max(1, w * 0.003) : 0;

  // Draw images if we have any
  for (const im of sorted) {
    try {
      ctx.save();
      const sx = im.x * scale;
      const sy = im.y * scale;
      const sw = im.width * scale;
      const sh = im.height * scale;
      ctx.translate(sx + sw / 2, sy + sh / 2);
      ctx.rotate((im.rotation * Math.PI) / 180);
      if (borderPx > 0) {
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(
          -sw / 2 - borderPx,
          -sh / 2 - borderPx,
          sw + borderPx * 2,
          sh + borderPx * 2,
        );
      }
      ctx.drawImage(im.el, -sw / 2, -sh / 2, sw, sh);
      ctx.restore();
    } catch (err) {
      console.error(`[renderThumbnail] Error drawing image ${im.id}:`, err);
    }
  }

  const dataUrl = canvas.toDataURL("image/jpeg", 0.6);
  console.log(`[renderThumbnail] Generated dataUrl length: ${dataUrl.length}`);
  return dataUrl || "";
}

export function compressForUpload(
  dataUrl: string,
  maxDim = 2048,
  quality = 0.82,
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const ratio = Math.min(maxDim / img.width, maxDim / img.height, 1);
      const w = Math.round(img.width * ratio);
      const h = Math.round(img.height * ratio);
      const c = document.createElement("canvas");
      c.width = w;
      c.height = h;
      c.getContext("2d")!.drawImage(img, 0, 0, w, h);
      c.toBlob(
        (blob) =>
          blob ? resolve(blob) : reject(new Error("compression failed")),
        "image/jpeg",
        quality,
      );
    };
    img.onerror = reject;
    img.src = dataUrl;
  });
}

function loadImageFromUrl(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const el = new Image();
    el.onload = () => resolve(el);
    el.onerror = reject;
    el.src = src;
  });
}

export async function renderManualMoodboard(
  images: CanvasImage[],
  title: string,
  caption: string,
  cw: number,
  ch: number,
  bgColor = "#f5f5f4",
  margin = false,
): Promise<string> {
  const loaded = await Promise.all(
    images.map((im) => loadImageFromUrl(im.dataUrl)),
  );
  const canvas = document.createElement("canvas");
  canvas.width = cw;
  canvas.height = ch;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = bgColor;
  ctx.fillRect(0, 0, cw, ch);

  const sorted = images
    .map((im, i) => ({ ...im, el: loaded[i] }))
    .sort((a, b) => a.zIndex - b.zIndex);

  const borderPx = margin ? Math.max(2, cw * 0.003) : 0;

  for (const im of sorted) {
    ctx.save();
    ctx.translate(im.x + im.width / 2, im.y + im.height / 2);
    ctx.rotate((im.rotation * Math.PI) / 180);
    if (borderPx > 0) {
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(
        -im.width / 2 - borderPx,
        -im.height / 2 - borderPx,
        im.width + borderPx * 2,
        im.height + borderPx * 2,
      );
    }
    ctx.drawImage(im.el, -im.width / 2, -im.height / 2, im.width, im.height);
    ctx.restore();
  }

  drawTitleCaption(ctx, title, caption, cw, ch, isDark(bgColor));
  return canvas.toDataURL("image/png");
}

export async function renderMoodboardToBlob(
  images: CanvasImage[],
  title: string,
  caption: string,
  cw: number,
  ch: number,
  bgColor = "#f5f5f4",
  margin = false,
  quality = 0.85,
): Promise<Blob> {
  const scale = Math.min(1, 1200 / cw);
  const w = Math.round(cw * scale);
  const h = Math.round(ch * scale);

  const loaded = await Promise.all(
    images.map((im) => loadImageFromUrl(im.dataUrl)),
  );
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = bgColor;
  ctx.fillRect(0, 0, w, h);

  const sorted = images
    .map((im, i) => ({ ...im, el: loaded[i] }))
    .sort((a, b) => a.zIndex - b.zIndex);

  const borderPx = margin ? Math.max(2, w * 0.003) : 0;

  for (const im of sorted) {
    ctx.save();
    const sx = im.x * scale;
    const sy = im.y * scale;
    const sw = im.width * scale;
    const sh = im.height * scale;
    ctx.translate(sx + sw / 2, sy + sh / 2);
    ctx.rotate((im.rotation * Math.PI) / 180);
    if (borderPx > 0) {
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(
        -sw / 2 - borderPx,
        -sh / 2 - borderPx,
        sw + borderPx * 2,
        sh + borderPx * 2,
      );
    }
    ctx.drawImage(im.el, -sw / 2, -sh / 2, sw, sh);
    ctx.restore();
  }

  drawTitleCaption(ctx, title, caption, w, h, isDark(bgColor));

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("toBlob failed"))),
      "image/jpeg",
      quality,
    );
  });
}

// ---------------------------------------------------------------------------
// Color extraction
// ---------------------------------------------------------------------------

function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
  r /= 255;
  g /= 255;
  b /= 255;
  const max = Math.max(r, g, b),
    min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h = 0;
  if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
  else if (max === g) h = ((b - r) / d + 2) / 6;
  else h = ((r - g) / d + 4) / 6;
  return [h, s, l];
}

function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  if (s === 0) {
    const v = Math.round(l * 255);
    return [v, v, v];
  }
  const hue2rgb = (p: number, q: number, t: number) => {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 0.5) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  return [
    Math.round(hue2rgb(p, q, h + 1 / 3) * 255),
    Math.round(hue2rgb(p, q, h) * 255),
    Math.round(hue2rgb(p, q, h - 1 / 3) * 255),
  ];
}

function toHex(r: number, g: number, b: number) {
  return "#" + [r, g, b].map((v) => v.toString(16).padStart(2, "0")).join("");
}

/**
 * Extract dominant colors from canvas images using k-means-like clustering.
 * Returns up to 6 distinct, visually appealing hex colors.
 */
export async function extractColors(
  images: { dataUrl: string }[],
): Promise<string[]> {
  if (images.length === 0) return [];

  // Sample pixels from all images
  const pixels: [number, number, number][] = [];

  const sampleImage = (src: string): Promise<void> =>
    new Promise((resolve) => {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => {
        const canvas = document.createElement("canvas");
        // Downsample to 50x50 for speed
        const size = 50;
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          resolve();
          return;
        }
        ctx.drawImage(img, 0, 0, size, size);
        const data = ctx.getImageData(0, 0, size, size).data;
        // Sample every 4th pixel
        for (let i = 0; i < data.length; i += 16) {
          const r = data[i];
          const g = data[i + 1];
          const b = data[i + 2];
          const a = data[i + 3];
          if (a < 128) continue; // skip transparent
          // Skip near-white and near-black (boring colors)
          const brightness = r * 0.299 + g * 0.587 + b * 0.114;
          if (brightness > 240 || brightness < 15) continue;
          // Skip very low saturation (grays)
          const max = Math.max(r, g, b);
          const min = Math.min(r, g, b);
          const saturation = max === 0 ? 0 : (max - min) / max;
          // Keep if it has some saturation OR is a distinct mid-tone
          if (saturation > 0.08 || (brightness > 40 && brightness < 200)) {
            pixels.push([r, g, b]);
          }
        }
        resolve();
      };
      img.onerror = () => resolve();
      img.src = src;
    });

  // Sample from up to 10 images
  const subset = images.slice(0, 10);
  await Promise.all(subset.map((img) => sampleImage(img.dataUrl)));

  if (pixels.length < 5) return [];

  // Simple k-means clustering for 8 clusters
  const k = 8;
  // Initialize centroids by picking spread-out pixels
  const centroids: [number, number, number][] = [];
  const step = Math.max(1, Math.floor(pixels.length / k));
  for (let i = 0; i < k; i++) {
    centroids.push([...pixels[Math.min(i * step, pixels.length - 1)]]);
  }

  // Run 10 iterations of k-means
  const assignments = new Uint8Array(pixels.length);
  for (let iter = 0; iter < 10; iter++) {
    // Assign pixels to nearest centroid
    for (let p = 0; p < pixels.length; p++) {
      let bestDist = Infinity;
      let bestC = 0;
      for (let c = 0; c < k; c++) {
        const dr = pixels[p][0] - centroids[c][0];
        const dg = pixels[p][1] - centroids[c][1];
        const db = pixels[p][2] - centroids[c][2];
        const dist = dr * dr + dg * dg + db * db;
        if (dist < bestDist) {
          bestDist = dist;
          bestC = c;
        }
      }
      assignments[p] = bestC;
    }

    // Recompute centroids
    const sums = Array.from({ length: k }, () => [0, 0, 0, 0]); // r,g,b,count
    for (let p = 0; p < pixels.length; p++) {
      const c = assignments[p];
      sums[c][0] += pixels[p][0];
      sums[c][1] += pixels[p][1];
      sums[c][2] += pixels[p][2];
      sums[c][3] += 1;
    }
    for (let c = 0; c < k; c++) {
      if (sums[c][3] > 0) {
        centroids[c][0] = sums[c][0] / sums[c][3];
        centroids[c][1] = sums[c][1] / sums[c][3];
        centroids[c][2] = sums[c][2] / sums[c][3];
      }
    }
  }

  // Count cluster sizes & build results
  const counts = new Array(k).fill(0);
  for (let p = 0; p < pixels.length; p++) {
    counts[assignments[p]]++;
  }

  type ClusterInfo = {
    r: number;
    g: number;
    b: number;
    count: number;
  };

  const clusters: ClusterInfo[] = centroids.map((c, i) => ({
    r: Math.round(c[0]),
    g: Math.round(c[1]),
    b: Math.round(c[2]),
    count: counts[i],
  }));

  // Sort by frequency (most common first)
  clusters.sort((a, b) => b.count - a.count);

  // Filter out clusters that are too similar to each other
  const results: string[] = [];
  const minDistance = 50; // Minimum color distance between results

  for (const cl of clusters) {
    if (cl.count < 3) continue; // skip tiny clusters
    const hex =
      "#" +
      [cl.r, cl.g, cl.b].map((v) => v.toString(16).padStart(2, "0")).join("");

    // Check distance from already-picked colors
    let tooClose = false;
    for (const existing of results) {
      const er = parseInt(existing.slice(1, 3), 16);
      const eg = parseInt(existing.slice(3, 5), 16);
      const eb = parseInt(existing.slice(5, 7), 16);
      const dr = cl.r - er;
      const dg = cl.g - eg;
      const db = cl.b - eb;
      if (Math.sqrt(dr * dr + dg * dg + db * db) < minDistance) {
        tooClose = true;
        break;
      }
    }
    if (!tooClose) {
      results.push(hex.toUpperCase());
    }
    if (results.length >= 6) break;
  }

  return results;
}
