/**
 * Object URL cache — converts data URLs to Blob URLs for efficient image
 * rendering. Blob URLs keep image data in the browser's native memory instead
 * of the JavaScript string heap, significantly reducing GC pressure.
 *
 * The original data URLs are still stored on CanvasImage for persistence
 * (IndexedDB / cloud sync). This cache is purely for display.
 */

const cache = new Map<string, string>();

/**
 * Convert a base64 data URL to a Blob, then create an Object URL.
 * Cached by `id` — subsequent calls for the same id return the cached URL.
 */
export function getObjectUrl(id: string, dataUrl: string): string {
  const existing = cache.get(id);
  if (existing) return existing;

  try {
    const commaIdx = dataUrl.indexOf(',');
    if (commaIdx === -1) return dataUrl; // not a data URL, return as-is

    const header = dataUrl.substring(0, commaIdx);
    const base64 = dataUrl.substring(commaIdx + 1);
    const mime = header.match(/:(.*?);/)?.[1] ?? 'image/jpeg';

    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }

    const blob = new Blob([bytes], { type: mime });
    const objectUrl = URL.createObjectURL(blob);
    cache.set(id, objectUrl);
    return objectUrl;
  } catch {
    // Fallback to original data URL if conversion fails
    return dataUrl;
  }
}

/** Revoke and remove a single Object URL from the cache. */
export function releaseObjectUrl(id: string): void {
  const url = cache.get(id);
  if (url) {
    URL.revokeObjectURL(url);
    cache.delete(id);
  }
}

/**
 * Reconcile the cache with the current set of active image IDs.
 * Revokes Object URLs for images no longer in use.
 */
export function reconcileObjectUrls(activeIds: Set<string>): void {
  for (const [id, url] of cache) {
    if (!activeIds.has(id)) {
      URL.revokeObjectURL(url);
      cache.delete(id);
    }
  }
}

/** Revoke all cached Object URLs (cleanup on unmount). */
export function releaseAllObjectUrls(): void {
  for (const url of cache.values()) {
    URL.revokeObjectURL(url);
  }
  cache.clear();
}

/** Check if an Object URL is already cached for the given id. */
export function hasObjectUrl(id: string): boolean {
  return cache.has(id);
}
