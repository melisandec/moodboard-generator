import type { CanvasImage, Orientation, Template, TemplateSlot } from './storage';

export const CANVAS_DIMS: Record<Orientation, { w: number; h: number }> = {
  portrait: { w: 1080, h: 1527 },
  landscape: { w: 1527, h: 1080 },
  square: { w: 1080, h: 1080 },
};

export const BUILT_IN_TEMPLATES: Template[] = [
  { id: 'blank', name: 'Blank', slots: [], isBuiltIn: true },
  {
    id: 'centered',
    name: 'Centered',
    slots: [{ cx: 0.5, cy: 0.42, scale: 0.55, rotation: 0, zIndex: 0 }],
    isBuiltIn: true,
  },
  {
    id: 'diagonal',
    name: 'Diagonal',
    slots: [
      { cx: 0.28, cy: 0.18, scale: 0.34, rotation: -3, zIndex: 0 },
      { cx: 0.55, cy: 0.38, scale: 0.36, rotation: 1.5, zIndex: 1 },
      { cx: 0.72, cy: 0.62, scale: 0.32, rotation: -2, zIndex: 2 },
      { cx: 0.35, cy: 0.82, scale: 0.34, rotation: 2, zIndex: 3 },
    ],
    isBuiltIn: true,
  },
  {
    id: 'scattered',
    name: 'Scattered',
    slots: [
      { cx: 0.22, cy: 0.12, scale: 0.28, rotation: -4, zIndex: 0 },
      { cx: 0.72, cy: 0.1, scale: 0.24, rotation: 3, zIndex: 1 },
      { cx: 0.38, cy: 0.36, scale: 0.34, rotation: 1, zIndex: 2 },
      { cx: 0.78, cy: 0.34, scale: 0.28, rotation: -2, zIndex: 3 },
      { cx: 0.18, cy: 0.6, scale: 0.26, rotation: 2, zIndex: 4 },
      { cx: 0.6, cy: 0.56, scale: 0.3, rotation: -3, zIndex: 5 },
      { cx: 0.42, cy: 0.8, scale: 0.28, rotation: 1, zIndex: 6 },
    ],
    isBuiltIn: true,
  },
  {
    id: 'corners',
    name: 'Corners',
    slots: [
      { cx: 0.28, cy: 0.18, scale: 0.42, rotation: -2, zIndex: 0 },
      { cx: 0.72, cy: 0.22, scale: 0.38, rotation: 3, zIndex: 1 },
      { cx: 0.5, cy: 0.48, scale: 0.46, rotation: -1, zIndex: 2 },
      { cx: 0.28, cy: 0.78, scale: 0.38, rotation: 2, zIndex: 3 },
      { cx: 0.72, cy: 0.82, scale: 0.42, rotation: -3, zIndex: 4 },
    ],
    isBuiltIn: true,
  },
];

function uid() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function clamp(v: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, v));
}

export function applyTemplate(
  template: Template,
  imageData: Array<{ dataUrl: string; naturalWidth: number; naturalHeight: number }>,
  cw: number,
  ch: number,
): CanvasImage[] {
  return imageData.map((img, i) => {
    const aspect = clamp(img.naturalWidth / img.naturalHeight, 0.4, 2.5);

    if (template.slots.length === 0) {
      const w = cw * (0.25 + Math.random() * 0.15);
      return mk(img, w, w / aspect, Math.random() * (cw - w), Math.random() * (ch - w / aspect), (Math.random() - 0.5) * 6, i);
    }

    const s = template.slots[i % template.slots.length];
    const w = cw * s.scale;
    const h = w / aspect;
    const layer = Math.floor(i / template.slots.length) * template.slots.length;
    return mk(img, w, h, cw * s.cx - w / 2, ch * s.cy - h / 2, 0, s.zIndex + layer);
  });

  function mk(
    img: { dataUrl: string; naturalWidth: number; naturalHeight: number },
    w: number, h: number, x: number, y: number, rot: number, z: number,
  ): CanvasImage {
    return {
      id: `img-${uid()}`,
      dataUrl: img.dataUrl,
      x, y, width: w, height: h,
      rotation: rot, pinned: false, zIndex: z,
      naturalWidth: img.naturalWidth,
      naturalHeight: img.naturalHeight,
    };
  }
}

export function artworkToTemplate(
  images: CanvasImage[],
  cw: number,
  ch: number,
  name: string,
): Template {
  return {
    id: `tpl-${uid()}`,
    name,
    slots: images.map((img) => ({
      cx: (img.x + img.width / 2) / cw,
      cy: (img.y + img.height / 2) / ch,
      scale: img.width / cw,
      rotation: img.rotation,
      zIndex: img.zIndex,
    })),
    isBuiltIn: false,
  };
}

export function rescaleImages(
  images: CanvasImage[],
  oldW: number, oldH: number,
  newW: number, newH: number,
): CanvasImage[] {
  const sx = newW / oldW;
  const sy = newH / oldH;
  const ss = Math.min(sx, sy);
  return images.map((img) => ({
    ...img,
    x: img.x * sx,
    y: img.y * sy,
    width: img.width * ss,
    height: img.height * ss,
  }));
}

export function templatePreviewSvg(slots: TemplateSlot[]): string {
  const vw = 80;
  const vh = 113;
  if (slots.length === 0) {
    return `<svg viewBox="0 0 ${vw} ${vh}" xmlns="http://www.w3.org/2000/svg"><rect width="${vw}" height="${vh}" fill="#f5f5f4" rx="2"/><line x1="20" y1="56" x2="60" y2="56" stroke="#d4d4d4" stroke-width="0.5"/></svg>`;
  }
  const rects = slots.map((s) => {
    const w = s.scale * vw;
    const h = w * 0.72;
    const x = s.cx * vw;
    const y = s.cy * vh;
    return `<rect x="${x - w / 2}" y="${y - h / 2}" width="${w}" height="${h}" rx="1" fill="#d4d4d4" stroke="#bbb" stroke-width="0.3" transform="rotate(${s.rotation} ${x} ${y})"/>`;
  }).join('');
  return `<svg viewBox="0 0 ${vw} ${vh}" xmlns="http://www.w3.org/2000/svg"><rect width="${vw}" height="${vh}" fill="#f5f5f4" rx="2"/>${rects}</svg>`;
}
