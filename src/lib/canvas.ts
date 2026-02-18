import type { CanvasImage } from './storage';

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

function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
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
    ctx.font = `400 ${sz}px -apple-system, "Helvetica Neue", Arial, sans-serif`;
    ctx.fillStyle = darkBg ? `rgba(255,255,255,${alpha * 0.85})` : 'rgba(0,0,0,0.45)';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'bottom';
    for (const l of wrapText(ctx, title, maxW).reverse()) {
      ctx.fillText(l, pad, y);
      y -= sz + 4;
    }
  }
}

function isDark(hex: string) {
  const c = hex.replace('#', '');
  const r = parseInt(c.substring(0, 2), 16);
  const g = parseInt(c.substring(2, 4), 16);
  const b = parseInt(c.substring(4, 6), 16);
  return r * 0.299 + g * 0.587 + b * 0.114 < 128;
}

// ---------------------------------------------------------------------------
// Auto-generate collage
// ---------------------------------------------------------------------------

function generatePlacements(images: HTMLImageElement[], W: number, H: number, reserveBottom: number): Placement[] {
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
    if (h > cellH * sm * 1.4) { h = cellH * sm * 1.4; w = h * ia; }
    const cx = margin + col * cellW + cellW / 2;
    const cy = margin + row * cellH + cellH / 2;
    const ox = (Math.random() - 0.5) * cellW * 0.55;
    const oy = (Math.random() - 0.5) * cellH * 0.55;
    placements.push({
      img,
      x: clamp(cx + ox - w / 2, -w * 0.1, W - w * 0.9),
      y: clamp(cy + oy - h / 2, -h * 0.1, H - reserveBottom - h * 0.9),
      width: w, height: h,
      rotation: (Math.random() - 0.5) * 6,
    });
  }
  return shuffle(placements);
}

export async function loadImage(file: File, maxDim = 1200): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      if (img.width <= maxDim && img.height <= maxDim) { resolve(img); return; }
      const ratio = Math.min(maxDim / img.width, maxDim / img.height);
      const w = Math.round(img.width * ratio);
      const h = Math.round(img.height * ratio);
      const c = document.createElement('canvas');
      c.width = w; c.height = h;
      c.getContext('2d')!.drawImage(img, 0, 0, w, h);
      const resized = new Image();
      resized.onload = () => resolve(resized);
      resized.onerror = reject;
      resized.src = c.toDataURL('image/jpeg', 0.85);
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error(`Failed: ${file.name}`)); };
    img.src = url;
  });
}

export function renderMoodboard(images: HTMLImageElement[], title: string, caption: string, width = 1080, height = 1350): string {
  const canvas = document.createElement('canvas');
  canvas.width = width; canvas.height = height;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#f5f5f4';
  ctx.fillRect(0, 0, width, height);
  const hasText = !!(title || caption);
  const rb = hasText ? height * 0.075 : 0;
  for (const p of generatePlacements(images, width, height, rb)) {
    ctx.save();
    ctx.translate(p.x + p.width / 2, p.y + p.height / 2);
    ctx.rotate((p.rotation * Math.PI) / 180);
    ctx.shadowColor = 'rgba(0,0,0,0.07)'; ctx.shadowBlur = 14; ctx.shadowOffsetX = 1; ctx.shadowOffsetY = 3;
    const b = Math.max(3, width * 0.004);
    ctx.fillStyle = '#fff';
    ctx.fillRect(-p.width / 2 - b, -p.height / 2 - b, p.width + b * 2, p.height + b * 2);
    ctx.shadowColor = 'transparent'; ctx.shadowBlur = 0; ctx.shadowOffsetX = 0; ctx.shadowOffsetY = 0;
    ctx.drawImage(p.img, -p.width / 2, -p.height / 2, p.width, p.height);
    ctx.restore();
  }
  drawTitleCaption(ctx, title, caption, width, height, false);
  return canvas.toDataURL('image/png');
}

// ---------------------------------------------------------------------------
// Manual-mode helpers
// ---------------------------------------------------------------------------

export async function compressForStorage(
  file: File, maxDim = 1000,
): Promise<{ dataUrl: string; naturalWidth: number; naturalHeight: number }> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      const ratio = Math.min(maxDim / img.width, maxDim / img.height, 1);
      const w = Math.round(img.width * ratio);
      const h = Math.round(img.height * ratio);
      const c = document.createElement('canvas');
      c.width = w; c.height = h;
      c.getContext('2d')!.drawImage(img, 0, 0, w, h);
      resolve({ dataUrl: c.toDataURL('image/jpeg', 0.8), naturalWidth: w, naturalHeight: h });
    };
    img.onerror = reject;
    img.src = url;
  });
}

export function createInitialPlacements(
  images: Array<{ dataUrl: string; naturalWidth: number; naturalHeight: number }>,
  cw: number, ch: number,
): CanvasImage[] {
  const n = images.length;
  const m = cw * 0.06;
  const uw = cw - m * 2, uh = ch - m * 2;
  const cols = Math.max(1, Math.round(Math.sqrt(n * (uw / uh))));
  const rows = Math.max(1, Math.ceil(n / cols));
  const cellW = uw / cols, cellH = uh / rows;

  return images.map((img, i) => {
    const col = i % cols, row = Math.floor(i / cols);
    const ar = clamp(img.naturalWidth / img.naturalHeight, 0.4, 2.5);
    let w = cellW * 0.78, h = w / ar;
    if (h > cellH * 0.78) { h = cellH * 0.78; w = h * ar; }
    const cx = m + col * cellW + cellW / 2;
    const cy = m + row * cellH + cellH / 2;
    return {
      id: `img-${i}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      dataUrl: img.dataUrl,
      x: cx - w / 2 + (Math.random() - 0.5) * cellW * 0.12,
      y: cy - h / 2 + (Math.random() - 0.5) * cellH * 0.12,
      width: w, height: h,
      rotation: (Math.random() - 0.5) * 4,
      pinned: false, zIndex: i,
      naturalWidth: img.naturalWidth, naturalHeight: img.naturalHeight,
    };
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
  cw: number, ch: number,
  bgColor = '#f5f5f4',
  margin = false,
): Promise<string> {
  const loaded = await Promise.all(images.map((im) => loadImageFromUrl(im.dataUrl)));
  const canvas = document.createElement('canvas');
  canvas.width = cw; canvas.height = ch;
  const ctx = canvas.getContext('2d')!;
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
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(
        -im.width / 2 - borderPx, -im.height / 2 - borderPx,
        im.width + borderPx * 2, im.height + borderPx * 2,
      );
    }
    ctx.drawImage(im.el, -im.width / 2, -im.height / 2, im.width, im.height);
    ctx.restore();
  }

  drawTitleCaption(ctx, title, caption, cw, ch, isDark(bgColor));
  return canvas.toDataURL('image/png');
}

// ---------------------------------------------------------------------------
// Color extraction
// ---------------------------------------------------------------------------

function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
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
  if (s === 0) { const v = Math.round(l * 255); return [v, v, v]; }
  const hue2rgb = (p: number, q: number, t: number) => {
    if (t < 0) t += 1; if (t > 1) t -= 1;
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
  return '#' + [r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('');
}

export async function extractColors(images: CanvasImage[]): Promise<string[]> {
  const sample = images.slice(0, 8);
  if (sample.length === 0) return [];
  const c = document.createElement('canvas');
  c.width = 6; c.height = 6;
  const ctx = c.getContext('2d')!;
  const buckets = new Map<string, { n: number; r: number; g: number; b: number }>();

  for (const im of sample) {
    const el = await loadImageFromUrl(im.dataUrl);
    ctx.clearRect(0, 0, 6, 6);
    ctx.drawImage(el, 0, 0, 6, 6);
    const d = ctx.getImageData(0, 0, 6, 6).data;
    for (let i = 0; i < d.length; i += 4) {
      const br = (d[i] + d[i + 1] + d[i + 2]) / 3;
      if (br < 30 || br > 225) continue;
      const qr = Math.round(d[i] / 48) * 48;
      const qg = Math.round(d[i + 1] / 48) * 48;
      const qb = Math.round(d[i + 2] / 48) * 48;
      const k = `${qr}-${qg}-${qb}`;
      const e = buckets.get(k) ?? { n: 0, r: 0, g: 0, b: 0 };
      e.n++; e.r += d[i]; e.g += d[i + 1]; e.b += d[i + 2];
      buckets.set(k, e);
    }
  }

  const sorted = [...buckets.values()].sort((a, b) => b.n - a.n);
  const results: string[] = [];

  for (const v of sorted) {
    if (results.length >= 3) break;
    const ar = Math.round(v.r / v.n);
    const ag = Math.round(v.g / v.n);
    const ab = Math.round(v.b / v.n);
    const [h, s, l] = rgbToHsl(ar, ag, ab);
    const [mr, mg, mb] = hslToRgb(h, s * 0.15, 0.92 + (1 - l) * 0.05);
    const hex = toHex(mr, mg, mb);
    const dominated = results.some((ex) => {
      const er = parseInt(ex.slice(1, 3), 16);
      const eg = parseInt(ex.slice(3, 5), 16);
      const eb = parseInt(ex.slice(5, 7), 16);
      return Math.abs(mr - er) + Math.abs(mg - eg) + Math.abs(mb - eb) < 30;
    });
    if (!dominated) results.push(hex);
  }
  return results;
}
