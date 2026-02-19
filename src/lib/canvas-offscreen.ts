/**
 * Off-main-thread canvas rendering — wraps the Web Worker for heavy rendering
 * operations (export to blob, thumbnail generation). Falls back to the main
 * thread when OffscreenCanvas or Web Workers are unavailable.
 */

import type { CanvasImage } from "./storage";
import type {
  RenderRequest,
  RenderResponse,
  RenderError,
} from "./canvas-worker";

// ---------------------------------------------------------------------------
// Worker lifecycle
// ---------------------------------------------------------------------------

let worker: Worker | null = null;
let workerFailed = false;

function getWorker(): Worker | null {
  if (workerFailed) return null;

  // Check for OffscreenCanvas support (required in the worker)
  if (typeof OffscreenCanvas === "undefined") {
    workerFailed = true;
    return null;
  }

  if (!worker) {
    try {
      worker = new Worker(new URL("./canvas-worker.ts", import.meta.url));
      worker.onerror = () => {
        workerFailed = true;
        worker = null;
      };
    } catch {
      workerFailed = true;
      return null;
    }
  }

  return worker;
}

// ---------------------------------------------------------------------------
// Data URL → Blob conversion (for transferring to worker)
// ---------------------------------------------------------------------------

function dataUrlToBlob(dataUrl: string): Blob {
  const commaIdx = dataUrl.indexOf(",");
  const header = dataUrl.substring(0, commaIdx);
  const base64 = dataUrl.substring(commaIdx + 1);
  const mime = header.match(/:(.*?);/)?.[1] ?? "image/jpeg";
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new Blob([bytes], { type: mime });
}

// ---------------------------------------------------------------------------
// Worker-based rendering
// ---------------------------------------------------------------------------

function renderInWorker(request: RenderRequest): Promise<Blob> {
  const w = getWorker();
  if (!w) return Promise.reject(new Error("Worker unavailable"));

  return new Promise<Blob>((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error("Worker render timeout"));
    }, 30_000);

    const handler = (e: MessageEvent<RenderResponse | RenderError>) => {
      clearTimeout(timeout);
      w.removeEventListener("message", handler);

      if (e.data.type === "error") {
        reject(new Error(e.data.message));
      } else {
        resolve(e.data.blob);
      }
    };

    w.addEventListener("message", handler);
    w.postMessage(request);
  });
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Render a moodboard to a JPEG Blob, offloading to a Web Worker when
 * OffscreenCanvas is available. Falls back to the provided main-thread
 * fallback function transparently.
 */
export async function renderMoodboardToBlobOffscreen(
  images: CanvasImage[],
  title: string,
  caption: string,
  cw: number,
  ch: number,
  bgColor: string,
  margin: boolean,
  quality: number,
  /** Called when the worker is unavailable */
  mainThreadFallback: () => Promise<Blob>,
): Promise<Blob> {
  // Try the worker path first
  if (!workerFailed && typeof OffscreenCanvas !== "undefined") {
    try {
      const scale = Math.min(1, 1200 / cw);
      const request: RenderRequest = {
        type: "renderToBlob",
        images: images.map((img) => ({
          blob: dataUrlToBlob(img.dataUrl),
          x: img.x,
          y: img.y,
          width: img.width,
          height: img.height,
          rotation: img.rotation,
          zIndex: img.zIndex,
        })),
        canvasWidth: cw,
        canvasHeight: ch,
        bgColor,
        margin,
        title,
        caption,
        quality,
        scale,
      };
      return await renderInWorker(request);
    } catch {
      // Fall through to main thread
    }
  }

  return mainThreadFallback();
}

/**
 * Render a thumbnail JPEG data URL, offloading to a Web Worker when
 * available. Falls back to the provided main-thread function.
 */
export async function renderThumbnailOffscreen(
  images: CanvasImage[],
  cw: number,
  ch: number,
  bgColor: string,
  margin: boolean,
  /** Called when the worker is unavailable */
  mainThreadFallback: () => Promise<string>,
): Promise<string> {
  if (!workerFailed && typeof OffscreenCanvas !== "undefined") {
    try {
      const scale = Math.min(1, 200 / cw);
      const request: RenderRequest = {
        type: "renderThumbnail",
        images: images.map((img) => ({
          blob: dataUrlToBlob(img.dataUrl),
          x: img.x,
          y: img.y,
          width: img.width,
          height: img.height,
          rotation: img.rotation,
          zIndex: img.zIndex,
        })),
        canvasWidth: cw,
        canvasHeight: ch,
        bgColor,
        margin,
        scale,
      };
      const blob = await renderInWorker(request);

      // Convert blob to data URL for storage in IndexedDB
      return new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
    } catch {
      // Fall through to main thread
    }
  }

  return mainThreadFallback();
}
