export interface CanvasImage {
  id: string;
  dataUrl: string;
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

/** Same shape as CanvasImage but without the heavy dataUrl blob. */
export type LightCanvasImage = Omit<CanvasImage, 'dataUrl'>;

export function stripDataUrls(imgs: CanvasImage[]): LightCanvasImage[] {
  return imgs.map(({ dataUrl: _, ...rest }) => rest);
}

export function rehydrateImages(
  light: LightCanvasImage[],
  store: Map<string, string>,
): CanvasImage[] {
  return light
    .filter((l) => store.has(l.id))
    .map((l) => ({ ...l, dataUrl: store.get(l.id)! }));
}

export type Orientation = 'portrait' | 'landscape' | 'square';

export interface Artwork {
  id: string;
  title: string;
  caption: string;
  images: CanvasImage[];
  canvasWidth: number;
  canvasHeight: number;
  orientation: Orientation;
  bgColor: string;
  imageMargin: boolean;
  categories: string[];
  pinned: boolean;
  createdAt: string;
  updatedAt: string;
  /** Small JPEG data URL for collection grid preview */
  thumbnail?: string;
}

export interface TemplateSlot {
  cx: number;
  cy: number;
  scale: number;
  rotation: number;
  zIndex: number;
}

export interface Template {
  id: string;
  name: string;
  slots: TemplateSlot[];
  isBuiltIn: boolean;
}

export interface Draft {
  id: 'current';
  title: string;
  caption: string;
  images: CanvasImage[];
  orientation: Orientation;
  bgColor: string;
  imageMargin: boolean;
  categories: string[];
  savedAt: string;
}

export interface LibraryImage {
  id: string;
  dataUrl: string;
  filename: string;
  naturalWidth: number;
  naturalHeight: number;
  tags: string[];
  uploadedAt: string;
}

export const DEFAULT_CATEGORIES = [
  'Inspiration', 'Project', 'Client', 'Personal', 'Color Study',
  'Texture & Material', 'Typography', 'Brand Identity', 'Travel', 'Seasonal',
];

const DB_NAME = 'moodboard-artworks';
const DB_VERSION = 3;

// ---------------------------------------------------------------------------
// IndexedDB availability detection + in-memory fallback
// ---------------------------------------------------------------------------

let _idbAvailable: boolean | null = null;

/** Returns true if IndexedDB is usable, caches the result. */
export async function isIndexedDBAvailable(): Promise<boolean> {
  if (_idbAvailable !== null) return _idbAvailable;

  try {
    if (typeof indexedDB === 'undefined') {
      _idbAvailable = false;
      return false;
    }

    // Probe with a real open/delete cycle to catch private-browsing blocks
    const testName = '__idb_availability_test__';
    await new Promise<void>((resolve, reject) => {
      const req = indexedDB.open(testName);
      req.onsuccess = () => {
        req.result.close();
        indexedDB.deleteDatabase(testName);
        resolve();
      };
      req.onerror = () => reject(req.error);
    });
    _idbAvailable = true;
  } catch {
    _idbAvailable = false;
  }

  return _idbAvailable;
}

/**
 * Simple in-memory store used as fallback when IndexedDB is unavailable.
 * Data lives only for the current session — the user is warned via
 * `isIndexedDBAvailable()` that their work won't persist.
 */
const memoryStores = new Map<string, Map<string, unknown>>();

function getMemStore(store: string): Map<string, unknown> {
  let m = memoryStores.get(store);
  if (!m) {
    m = new Map();
    memoryStores.set(store, m);
  }
  return m;
}

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains('artworks'))
        db.createObjectStore('artworks', { keyPath: 'id' });
      if (!db.objectStoreNames.contains('templates'))
        db.createObjectStore('templates', { keyPath: 'id' });
      if (!db.objectStoreNames.contains('draft'))
        db.createObjectStore('draft', { keyPath: 'id' });
      if (!db.objectStoreNames.contains('library'))
        db.createObjectStore('library', { keyPath: 'id' });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function idbPut(store: string, value: unknown): Promise<void> {
  if (!(await isIndexedDBAvailable())) {
    const record = value as { id: string };
    getMemStore(store).set(record.id, value);
    return;
  }

  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, 'readwrite');
    tx.objectStore(store).put(value);
    tx.oncomplete = () => { db.close(); resolve(); };
    tx.onerror = () => { db.close(); reject(tx.error); };
  });
}

async function idbGetAll<T>(store: string): Promise<T[]> {
  if (!(await isIndexedDBAvailable())) {
    return [...getMemStore(store).values()] as T[];
  }

  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, 'readonly');
    const r = tx.objectStore(store).getAll();
    r.onsuccess = () => { db.close(); resolve(r.result); };
    r.onerror = () => { db.close(); reject(r.error); };
  });
}

async function idbGet<T>(store: string, key: string): Promise<T | undefined> {
  if (!(await isIndexedDBAvailable())) {
    return getMemStore(store).get(key) as T | undefined;
  }

  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, 'readonly');
    const r = tx.objectStore(store).get(key);
    r.onsuccess = () => { db.close(); resolve(r.result); };
    r.onerror = () => { db.close(); reject(r.error); };
  });
}

async function idbDelete(store: string, id: string): Promise<void> {
  if (!(await isIndexedDBAvailable())) {
    getMemStore(store).delete(id);
    return;
  }

  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, 'readwrite');
    tx.objectStore(store).delete(id);
    tx.oncomplete = () => { db.close(); resolve(); };
    tx.onerror = () => { db.close(); reject(tx.error); };
  });
}

// Artworks
export const saveArtwork = (a: Artwork) => idbPut('artworks', a);
export const loadArtworks = () => idbGetAll<Artwork>('artworks');
export const deleteArtwork = (id: string) => idbDelete('artworks', id);

// Templates
export const saveTemplate = (t: Template) => idbPut('templates', t);
export const loadTemplates = () => idbGetAll<Template>('templates');
export const deleteTemplate = (id: string) => idbDelete('templates', id);

// Draft (single entry, id = 'current')
export const saveDraft = (d: Draft) => idbPut('draft', d);
export const loadDraft = () => idbGet<Draft>('draft', 'current').then((d) => d ?? null);
export const clearDraft = () => idbDelete('draft', 'current');

// Library
export const saveLibraryImage = (img: LibraryImage) => idbPut('library', img);
export const loadLibrary = () => idbGetAll<LibraryImage>('library');
export const getLibraryImage = (id: string) => idbGet<LibraryImage>('library', id);
export const deleteLibraryImage = (id: string) => idbDelete('library', id);

export function imageHash(dataUrl: string): string {
  const comma = dataUrl.indexOf(',');
  const payload = dataUrl.substring(comma + 1);
  const len = payload.length;
  const step = Math.max(1, Math.floor(len / 8000));
  let h1 = 0x811c9dc5;
  let h2 = 0;
  for (let i = 0; i < len; i += step) {
    h1 = (h1 ^ payload.charCodeAt(i)) * 0x01000193;
    h2 = ((h2 << 5) - h2 + payload.charCodeAt(i)) | 0;
  }
  h1 = ((h1 ^ payload.charCodeAt(len - 1)) * 0x01000193) >>> 0;
  h2 = h2 >>> 0;
  return `lib-${h1.toString(36)}-${h2.toString(36)}-${len.toString(36)}`;
}

export async function ensureInLibrary(
  dataUrl: string,
  filename: string,
  naturalWidth: number,
  naturalHeight: number,
): Promise<void> {
  const id = imageHash(dataUrl);
  const existing = await getLibraryImage(id);
  if (!existing) {
    await saveLibraryImage({
      id, dataUrl, filename, naturalWidth, naturalHeight,
      tags: [], uploadedAt: new Date().toISOString(),
    });
  }
}
