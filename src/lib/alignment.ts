import type { CanvasImage } from "./storage";

// ---------------------------------------------------------------------------
// Alignment guides & snap-to-grid for canvas drag operations
// ---------------------------------------------------------------------------

/** A visual guideline rendered as an overlay on the canvas. */
export interface GuideLine {
  orientation: "horizontal" | "vertical";
  /** Position along the perpendicular axis (px in canvas space) */
  position: number;
  /** Line start along the parallel axis */
  start: number;
  /** Line end along the parallel axis */
  end: number;
}

export interface SnapResult {
  /** Snapped x position of the dragged image */
  x: number;
  /** Snapped y position of the dragged image */
  y: number;
  /** Guide lines to render */
  guides: GuideLine[];
}

/** Snap threshold in canvas-space pixels */
const SNAP_PX = 10;

/**
 * Given a dragged image and the other images on canvas, compute
 * snapping adjustments and guide lines to display.
 *
 * Snaps to: canvas center, canvas edges, other image edges &
 * centres, and equal spacing between neighbours.
 */
export function snapToGuides(
  dragging: { x: number; y: number; width: number; height: number },
  others: CanvasImage[],
  canvasWidth: number,
  canvasHeight: number,
): SnapResult {
  let { x, y } = dragging;
  const guides: GuideLine[] = [];

  const dragCX = x + dragging.width / 2;
  const dragCY = y + dragging.height / 2;
  const dragRight = x + dragging.width;
  const dragBottom = y + dragging.height;

  // ---- Canvas centre ----
  const canvasCX = canvasWidth / 2;
  const canvasCY = canvasHeight / 2;

  if (Math.abs(dragCX - canvasCX) < SNAP_PX) {
    x = canvasCX - dragging.width / 2;
    guides.push({
      orientation: "vertical",
      position: canvasCX,
      start: 0,
      end: canvasHeight,
    });
  }
  if (Math.abs(dragCY - canvasCY) < SNAP_PX) {
    y = canvasCY - dragging.height / 2;
    guides.push({
      orientation: "horizontal",
      position: canvasCY,
      start: 0,
      end: canvasWidth,
    });
  }

  // ---- Canvas edges (top/left/right/bottom with padding 0) ----
  if (Math.abs(x) < SNAP_PX) {
    x = 0;
    guides.push({
      orientation: "vertical",
      position: 0,
      start: y,
      end: y + dragging.height,
    });
  }
  if (Math.abs(y) < SNAP_PX) {
    y = 0;
    guides.push({
      orientation: "horizontal",
      position: 0,
      start: x,
      end: x + dragging.width,
    });
  }
  if (Math.abs(dragRight - canvasWidth) < SNAP_PX) {
    x = canvasWidth - dragging.width;
    guides.push({
      orientation: "vertical",
      position: canvasWidth,
      start: y,
      end: y + dragging.height,
    });
  }
  if (Math.abs(dragBottom - canvasHeight) < SNAP_PX) {
    y = canvasHeight - dragging.height;
    guides.push({
      orientation: "horizontal",
      position: canvasHeight,
      start: x,
      end: x + dragging.width,
    });
  }

  // ---- Snap to other images ----
  for (const other of others) {
    const otherCX = other.x + other.width / 2;
    const otherCY = other.y + other.height / 2;
    const otherRight = other.x + other.width;
    const otherBottom = other.y + other.height;

    // Re-compute dragged edges with any prior snapping applied
    const curRight = x + dragging.width;
    const curBottom = y + dragging.height;
    const curCX = x + dragging.width / 2;
    const curCY = y + dragging.height / 2;

    // Left ↔ Left
    if (Math.abs(x - other.x) < SNAP_PX) {
      x = other.x;
      pushVGuide(guides, other.x, y, curBottom, other.y, otherBottom);
    }
    // Right ↔ Right
    if (Math.abs(curRight - otherRight) < SNAP_PX) {
      x = otherRight - dragging.width;
      pushVGuide(guides, otherRight, y, curBottom, other.y, otherBottom);
    }
    // Left ↔ Right (snap dragged left edge to other's right edge)
    if (Math.abs(x - otherRight) < SNAP_PX) {
      x = otherRight;
      pushVGuide(guides, otherRight, y, curBottom, other.y, otherBottom);
    }
    // Right ↔ Left
    if (Math.abs(curRight - other.x) < SNAP_PX) {
      x = other.x - dragging.width;
      pushVGuide(guides, other.x, y, curBottom, other.y, otherBottom);
    }

    // Top ↔ Top
    if (Math.abs(y - other.y) < SNAP_PX) {
      y = other.y;
      pushHGuide(guides, other.y, x, curRight, other.x, otherRight);
    }
    // Bottom ↔ Bottom
    if (Math.abs(curBottom - otherBottom) < SNAP_PX) {
      y = otherBottom - dragging.height;
      pushHGuide(guides, otherBottom, x, curRight, other.x, otherRight);
    }
    // Top ↔ Bottom
    if (Math.abs(y - otherBottom) < SNAP_PX) {
      y = otherBottom;
      pushHGuide(guides, otherBottom, x, curRight, other.x, otherRight);
    }
    // Bottom ↔ Top
    if (Math.abs(curBottom - other.y) < SNAP_PX) {
      y = other.y - dragging.height;
      pushHGuide(guides, other.y, x, curRight, other.x, otherRight);
    }

    // Centre ↔ Centre (horizontal alignment)
    if (Math.abs(curCX - otherCX) < SNAP_PX) {
      x = otherCX - dragging.width / 2;
      pushVGuide(
        guides,
        otherCX,
        Math.min(y, other.y),
        Math.max(y + dragging.height, otherBottom),
        other.y,
        otherBottom,
      );
    }
    // Centre ↔ Centre (vertical alignment)
    if (Math.abs(curCY - otherCY) < SNAP_PX) {
      y = otherCY - dragging.height / 2;
      pushHGuide(
        guides,
        otherCY,
        Math.min(x, other.x),
        Math.max(x + dragging.width, otherRight),
        other.x,
        otherRight,
      );
    }
  }

  return { x, y, guides: deduplicateGuides(guides) };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function pushVGuide(
  guides: GuideLine[],
  pos: number,
  y1: number,
  y2: number,
  oy1: number,
  oy2: number,
) {
  guides.push({
    orientation: "vertical",
    position: pos,
    start: Math.min(y1, oy1),
    end: Math.max(y2, oy2),
  });
}

function pushHGuide(
  guides: GuideLine[],
  pos: number,
  x1: number,
  x2: number,
  ox1: number,
  ox2: number,
) {
  guides.push({
    orientation: "horizontal",
    position: pos,
    start: Math.min(x1, ox1),
    end: Math.max(x2, ox2),
  });
}

/** Remove near-duplicate guides (same orientation within 1px). */
function deduplicateGuides(guides: GuideLine[]): GuideLine[] {
  const result: GuideLine[] = [];
  for (const g of guides) {
    const dup = result.find(
      (r) =>
        r.orientation === g.orientation &&
        Math.abs(r.position - g.position) < 1,
    );
    if (dup) {
      // Extend existing guide
      dup.start = Math.min(dup.start, g.start);
      dup.end = Math.max(dup.end, g.end);
    } else {
      result.push({ ...g });
    }
  }
  return result;
}
