/**
 * Offline sync queue — persists pending sync operations in localStorage so
 * they survive page reloads. When connectivity returns, the queue is drained
 * automatically by CloudProvider.
 *
 * Each entry stores the artwork IDs that were modified while offline. On
 * reconnect, the latest local artworks for those IDs are pushed to the cloud.
 */

const QUEUE_KEY = "moodboard-sync-queue";

export interface SyncQueueEntry {
  /** IDs of artworks that need to be synced */
  artworkIds: string[];
  /** ISO timestamp when the operation was queued */
  queuedAt: string;
}

/** Read the current queue from localStorage. */
export function getSyncQueue(): SyncQueueEntry[] {
  try {
    const raw = localStorage.getItem(QUEUE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as SyncQueueEntry[];
  } catch {
    return [];
  }
}

/** Persist the queue to localStorage. */
function saveQueue(queue: SyncQueueEntry[]): void {
  try {
    localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
  } catch {
    /* storage full — best-effort */
  }
}

/**
 * Enqueue artwork IDs for sync when connectivity is restored.
 * Merges IDs with any existing pending entry to avoid duplicates.
 */
export function enqueueSync(artworkIds: string[]): void {
  if (artworkIds.length === 0) return;
  const queue = getSyncQueue();

  // Merge into the latest pending entry or create a new one
  const existingIds = new Set(queue.flatMap((e) => e.artworkIds));
  const newIds = artworkIds.filter((id) => !existingIds.has(id));

  if (newIds.length === 0 && queue.length > 0) return; // already queued

  if (queue.length > 0) {
    // Merge into the last entry
    const last = queue[queue.length - 1];
    last.artworkIds = [...new Set([...last.artworkIds, ...artworkIds])];
    last.queuedAt = new Date().toISOString();
  } else {
    queue.push({
      artworkIds: [...new Set(artworkIds)],
      queuedAt: new Date().toISOString(),
    });
  }

  saveQueue(queue);
}

/** Clear the queue after a successful sync. */
export function clearSyncQueue(): void {
  try {
    localStorage.removeItem(QUEUE_KEY);
  } catch {
    /* ignore */
  }
}

/** Get all unique artwork IDs that are pending sync. */
export function getPendingArtworkIds(): string[] {
  const queue = getSyncQueue();
  return [...new Set(queue.flatMap((e) => e.artworkIds))];
}

/** Returns true if there are pending offline operations. */
export function hasPendingSync(): boolean {
  return getSyncQueue().length > 0;
}
