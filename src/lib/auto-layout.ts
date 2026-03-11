import type { CanvasImage } from "./storage";

// ---------------------------------------------------------------------------
// Auto-layout engine – arranges canvas images in various styles
// ---------------------------------------------------------------------------

export type LayoutStyle =
  | "grid"
  | "masonry"
  | "golden"
  | "hero"
  | "scatter"
  | "rows";

export interface LayoutMeta {
  id: LayoutStyle;
  name: string;
  icon: string; // emoji
  description: string;
}

export const LAYOUT_STYLES: LayoutMeta[] = [
  { id: "grid", name: "Grid", icon: "⊞", description: "Even grid layout" },
  {
    id: "masonry",
    name: "Masonry",
    icon: "▦",
    description: "Pinterest-style columns",
  },
  {
    id: "golden",
    name: "Golden",
    icon: "φ",
    description: "Golden-ratio hero + sidebar",
  },
  {
    id: "hero",
    name: "Hero",
    icon: "▣",
    description: "Large hero image on top",
  },
  {
    id: "scatter",
    name: "Scatter",
    icon: "✦",
    description: "Organic scattered look",
  },
  {
    id: "rows",
    name: "Rows",
    icon: "☰",
    description: "Justified horizontal rows",
  },
];

/**
 * Re-arrange images on the canvas according to the chosen layout style.
 * Preserves image identity (id, dataUrl, etc.) — only repositions x/y/width/height.
 */
export function autoLayout(
  images: CanvasImage[],
  canvasWidth: number,
  canvasHeight: number,
  style: LayoutStyle,
  padding = 12,
): CanvasImage[] {
  if (images.length === 0) return [];

  switch (style) {
    case "masonry":
      return masonryLayout(images, canvasWidth, canvasHeight, padding);
    case "golden":
      return goldenRatioLayout(images, canvasWidth, canvasHeight, padding);
    case "hero":
      return heroLayout(images, canvasWidth, canvasHeight, padding);
    case "scatter":
      return scatterLayout(images, canvasWidth, canvasHeight, padding);
    case "rows":
      return rowsLayout(images, canvasWidth, canvasHeight, padding);
    case "grid":
    default:
      return gridLayout(images, canvasWidth, canvasHeight, padding);
  }
}

// ---------------------------------------------------------------------------
// Grid – equal-sized cells
// ---------------------------------------------------------------------------

function gridLayout(
  images: CanvasImage[],
  width: number,
  height: number,
  padding: number,
): CanvasImage[] {
  const n = images.length;
  const cols = Math.ceil(Math.sqrt(n));
  const rows = Math.ceil(n / cols);
  const cellW = (width - padding * (cols + 1)) / cols;
  const cellH = (height - padding * (rows + 1)) / rows;

  return images.map((img, i) => {
    const col = i % cols;
    const row = Math.floor(i / cols);
    const aspect = safeAspect(img);

    // fit within cell preserving aspect ratio
    let w = cellW;
    let h = w / aspect;
    if (h > cellH) {
      h = cellH;
      w = h * aspect;
    }

    const cx = padding + col * (cellW + padding) + cellW / 2;
    const cy = padding + row * (cellH + padding) + cellH / 2;

    return {
      ...img,
      x: cx - w / 2,
      y: cy - h / 2,
      width: w,
      height: h,
      rotation: 0,
      zIndex: i,
    };
  });
}

// ---------------------------------------------------------------------------
// Masonry – variable-height columns
// ---------------------------------------------------------------------------

function masonryLayout(
  images: CanvasImage[],
  width: number,
  height: number,
  padding: number,
): CanvasImage[] {
  const n = images.length;
  const cols = n <= 2 ? n : n <= 5 ? 2 : 3;
  const colWidth = (width - padding * (cols + 1)) / cols;
  const colHeights = new Array(cols).fill(padding);

  const placed = images.map((img, i) => {
    const shortestCol = colHeights.indexOf(Math.min(...colHeights));
    const aspect = safeAspect(img);
    const itemHeight = colWidth / aspect;

    const result: CanvasImage = {
      ...img,
      x: padding + shortestCol * (colWidth + padding),
      y: colHeights[shortestCol],
      width: colWidth,
      height: itemHeight,
      rotation: 0,
      zIndex: i,
    };

    colHeights[shortestCol] += itemHeight + padding;
    return result;
  });

  // Scale down if content exceeds canvas height
  const maxH = Math.max(...colHeights);
  if (maxH > height) {
    const scale = (height - padding) / maxH;
    return placed.map((img) => ({
      ...img,
      x: img.x * scale + (width * (1 - scale)) / 2,
      y: img.y * scale,
      width: img.width * scale,
      height: img.height * scale,
    }));
  }

  return placed;
}

// ---------------------------------------------------------------------------
// Golden ratio – first image gets φ/(1+φ) of the width
// ---------------------------------------------------------------------------

function goldenRatioLayout(
  images: CanvasImage[],
  width: number,
  height: number,
  padding: number,
): CanvasImage[] {
  if (images.length === 1) {
    return gridLayout(images, width, height, padding);
  }

  const PHI = 1.618;
  const heroWidth = (width - padding * 3) * (PHI / (1 + PHI));
  const sideWidth = width - heroWidth - padding * 3;
  const heroAspect = safeAspect(images[0]);

  // Hero image (left side)
  const heroH = Math.min(height - padding * 2, heroWidth / heroAspect);
  const hero: CanvasImage = {
    ...images[0],
    x: padding,
    y: padding + (height - padding * 2 - heroH) / 2,
    width: heroWidth,
    height: heroH,
    rotation: 0,
    zIndex: 0,
  };

  const sideImages = images.slice(1);
  if (sideImages.length === 0) return [hero];

  const sideCount = sideImages.length;
  const totalSideH = height - padding * (sideCount + 1);
  const itemH = totalSideH / sideCount;

  const sides: CanvasImage[] = sideImages.map((img, i) => {
    const aspect = safeAspect(img);
    let w = sideWidth;
    let h = w / aspect;
    if (h > itemH) {
      h = itemH;
      w = h * aspect;
    }

    const cx = heroWidth + padding * 2 + sideWidth / 2;
    const cy = padding + i * (itemH + padding) + itemH / 2;

    return {
      ...img,
      x: cx - w / 2,
      y: cy - h / 2,
      width: w,
      height: h,
      rotation: 0,
      zIndex: i + 1,
    };
  });

  return [hero, ...sides];
}

// ---------------------------------------------------------------------------
// Hero – large top section + thumbnails below
// ---------------------------------------------------------------------------

function heroLayout(
  images: CanvasImage[],
  width: number,
  height: number,
  padding: number,
): CanvasImage[] {
  if (images.length === 1) {
    return gridLayout(images, width, height, padding);
  }

  const heroFraction = 0.6;
  const heroH = (height - padding * 3) * heroFraction;
  const bottomH = height - heroH - padding * 3;
  const heroAspect = safeAspect(images[0]);

  let hW = width - padding * 2;
  let hH = hW / heroAspect;
  if (hH > heroH) {
    hH = heroH;
    hW = hH * heroAspect;
  }

  const hero: CanvasImage = {
    ...images[0],
    x: (width - hW) / 2,
    y: padding + (heroH - hH) / 2,
    width: hW,
    height: hH,
    rotation: 0,
    zIndex: 0,
  };

  const bottomImages = images.slice(1);
  const cols = bottomImages.length;
  const colW = (width - padding * (cols + 1)) / cols;

  const bottom: CanvasImage[] = bottomImages.map((img, i) => {
    const aspect = safeAspect(img);
    let w = colW;
    let h = w / aspect;
    if (h > bottomH) {
      h = bottomH;
      w = h * aspect;
    }

    const cx = padding + i * (colW + padding) + colW / 2;
    const cy = heroH + padding * 2 + bottomH / 2;

    return {
      ...img,
      x: cx - w / 2,
      y: cy - h / 2,
      width: w,
      height: h,
      rotation: 0,
      zIndex: i + 1,
    };
  });

  return [hero, ...bottom];
}

// ---------------------------------------------------------------------------
// Scatter – organic placement around center
// ---------------------------------------------------------------------------

function scatterLayout(
  images: CanvasImage[],
  width: number,
  height: number,
  padding: number,
): CanvasImage[] {
  const n = images.length;
  const baseSize =
    Math.min(width, height) * (n <= 3 ? 0.38 : n <= 6 ? 0.3 : 0.24);

  return images.map((img, i) => {
    const aspect = safeAspect(img);
    // Vary sizes slightly
    const sizeFactor = 0.8 + hashIndex(i, n) * 0.4;
    const w = baseSize * sizeFactor;
    const h = w / aspect;

    // Distribute around centre using a golden-angle spiral
    const goldenAngle = Math.PI * (3 - Math.sqrt(5)); // ~137.5°
    const angle = i * goldenAngle;
    const radius = Math.min(width, height) * 0.28 * Math.sqrt((i + 0.5) / n);

    const cx = width / 2 + Math.cos(angle) * radius;
    const cy = height / 2 + Math.sin(angle) * radius;

    // Slight random-looking rotation based on index
    const rotation = (hashIndex(i, 7) - 0.5) * 8;

    return {
      ...img,
      x: clamp(cx - w / 2, padding, width - w - padding),
      y: clamp(cy - h / 2, padding, height - h - padding),
      width: w,
      height: h,
      rotation,
      zIndex: i,
    };
  });
}

// ---------------------------------------------------------------------------
// Rows – justified horizontal rows (like Flickr)
// ---------------------------------------------------------------------------

function rowsLayout(
  images: CanvasImage[],
  width: number,
  height: number,
  padding: number,
): CanvasImage[] {
  const targetRowH = height / (Math.ceil(images.length / 3) || 1) - padding;
  const maxRowH = Math.min(targetRowH, height * 0.45);

  // Build rows greedily
  const rows: CanvasImage[][] = [];
  let currentRow: CanvasImage[] = [];
  let currentRowWidth = 0;
  const usableWidth = width - padding * 2;

  for (const img of images) {
    const aspect = safeAspect(img);
    const itemW = maxRowH * aspect;
    if (
      currentRow.length > 0 &&
      currentRowWidth + itemW + padding > usableWidth
    ) {
      rows.push(currentRow);
      currentRow = [];
      currentRowWidth = 0;
    }
    currentRow.push(img);
    currentRowWidth += itemW + (currentRow.length > 1 ? padding : 0);
  }
  if (currentRow.length > 0) rows.push(currentRow);

  // Lay out rows
  const result: CanvasImage[] = [];
  let y = padding;
  let globalZ = 0;

  for (const row of rows) {
    // Calculate total natural width at uniform height
    const aspects = row.map((img) => safeAspect(img));
    const totalNatW = aspects.reduce((sum, a) => sum + maxRowH * a, 0);
    const totalGaps = (row.length - 1) * padding;
    const scale = (usableWidth - totalGaps) / totalNatW;
    const rowH = maxRowH * scale;

    let x = padding;
    for (let i = 0; i < row.length; i++) {
      const w = rowH * aspects[i];
      result.push({
        ...row[i],
        x,
        y,
        width: w,
        height: rowH,
        rotation: 0,
        zIndex: globalZ++,
      });
      x += w + padding;
    }
    y += rowH + padding;
  }

  // Scale down if exceeds canvas height
  const totalH = y;
  if (totalH > height) {
    const s = height / totalH;
    return result.map((img) => ({
      ...img,
      x: img.x * s + (width * (1 - s)) / 2,
      y: img.y * s,
      width: img.width * s,
      height: img.height * s,
    }));
  }

  // Centre vertically
  const offsetY = (height - y) / 2;
  if (offsetY > 0) {
    return result.map((img) => ({ ...img, y: img.y + offsetY }));
  }
  return result;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function safeAspect(img: CanvasImage): number {
  return clamp(
    (img.naturalWidth || img.width) / (img.naturalHeight || img.height || 1),
    0.3,
    3.5,
  );
}

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

/** Deterministic pseudo-random 0-1 value based on index (avoids Math.random). */
function hashIndex(i: number, seed: number): number {
  const x = Math.sin(i * 9301 + seed * 49297) * 49297;
  return x - Math.floor(x);
}
