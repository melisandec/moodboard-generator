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
  createdAt: string;
  updatedAt: string;
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

const DB_NAME = 'moodboard-artworks';
const DB_VERSION = 2;

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains('artworks')) {
        db.createObjectStore('artworks', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('templates')) {
        db.createObjectStore('templates', { keyPath: 'id' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function idbPut(store: string, value: unknown): Promise<void> {
  return openDB().then(
    (db) =>
      new Promise((resolve, reject) => {
        const tx = db.transaction(store, 'readwrite');
        tx.objectStore(store).put(value);
        tx.oncomplete = () => { db.close(); resolve(); };
        tx.onerror = () => { db.close(); reject(tx.error); };
      }),
  );
}

function idbGetAll<T>(store: string): Promise<T[]> {
  return openDB().then(
    (db) =>
      new Promise((resolve, reject) => {
        const tx = db.transaction(store, 'readonly');
        const r = tx.objectStore(store).getAll();
        r.onsuccess = () => { db.close(); resolve(r.result); };
        r.onerror = () => { db.close(); reject(r.error); };
      }),
  );
}

function idbDelete(store: string, id: string): Promise<void> {
  return openDB().then(
    (db) =>
      new Promise((resolve, reject) => {
        const tx = db.transaction(store, 'readwrite');
        tx.objectStore(store).delete(id);
        tx.oncomplete = () => { db.close(); resolve(); };
        tx.onerror = () => { db.close(); reject(tx.error); };
      }),
  );
}

export const saveArtwork = (a: Artwork) => idbPut('artworks', a);
export const loadArtworks = () => idbGetAll<Artwork>('artworks');
export const deleteArtwork = (id: string) => idbDelete('artworks', id);

export const saveTemplate = (t: Template) => idbPut('templates', t);
export const loadTemplates = () => idbGetAll<Template>('templates');
export const deleteTemplate = (id: string) => idbDelete('templates', id);
