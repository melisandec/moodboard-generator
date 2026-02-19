'use client';

import { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import { sdk } from '@farcaster/miniapp-sdk';
import {
  registerUser, pushToCloud, pullFromCloud,
  type CloudUser, type SyncStatus,
} from '@/lib/cloud';
import { loadArtworks, saveArtwork, type Artwork } from '@/lib/storage';
import { enqueueSync, clearSyncQueue, hasPendingSync, getPendingArtworkIds } from '@/lib/sync-queue';

interface CloudContextValue {
  user: CloudUser | null;
  syncStatus: SyncStatus;
  lastSyncAt: string | null;
  isMiniApp: boolean;
  signIn: () => Promise<void>;
  signOut: () => void;
  sync: (localOverride?: Artwork[]) => Promise<Artwork[]>;
}

const CloudContext = createContext<CloudContextValue>({
  user: null,
  syncStatus: 'idle',
  lastSyncAt: null,
  isMiniApp: false,
  signIn: async () => {},
  signOut: () => {},
  sync: async () => [],
});

export function useCloud() {
  return useContext(CloudContext);
}

const STORAGE_USER_KEY = 'moodboard-cloud-user';
const STORAGE_SYNC_KEY = 'moodboard-last-sync';

let _isMiniApp: boolean | null = null;

async function authFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  if (_isMiniApp === null) {
    try { _isMiniApp = await sdk.isInMiniApp(); } catch { _isMiniApp = false; }
  }

  if (_isMiniApp) {
    try {
      return await sdk.quickAuth.fetch(input, init);
    } catch (err) {
      console.error('quickAuth.fetch error:', err);
      throw new Error('Authentication failed — please reopen the app from Warpcast');
    }
  }

  const { token } = await sdk.quickAuth.getToken().catch(() => ({ token: null }));
  if (token) {
    const headers = new Headers(init?.headers);
    headers.set('Authorization', `Bearer ${token}`);
    return fetch(input, { ...init, headers });
  }

  throw new Error('Not authenticated — open the app from Warpcast to sign in');
}

export function CloudProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<CloudUser | null>(null);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('idle');
  const [lastSyncAt, setLastSyncAt] = useState<string | null>(null);
  const [isMiniApp, setIsMiniApp] = useState(false);
  const syncLock = useRef(false);
  const initDone = useRef(false);
  const pendingAutoSync = useRef(false);
  const queuedSync = useRef<{ localOverride?: Artwork[]; resolve: (v: Artwork[]) => void; reject: (e: unknown) => void } | null>(null);

  useEffect(() => {
    if (initDone.current) return;
    initDone.current = true;

    try {
      const stored = localStorage.getItem(STORAGE_USER_KEY);
      if (stored) setUser(JSON.parse(stored));
      const ts = localStorage.getItem(STORAGE_SYNC_KEY);
      if (ts) setLastSyncAt(ts);
    } catch { /* ignore */ }

    (async () => {
      try {
        const inMiniApp = await sdk.isInMiniApp();
        setIsMiniApp(inMiniApp);
        if (!inMiniApp) return;

        const context = await sdk.context;
        if (context?.user?.fid) {
          const cloudUser: CloudUser = {
            fid: String(context.user.fid),
            username: context.user.username ?? '',
            pfpUrl: context.user.pfpUrl ?? '',
          };
          setUser(cloudUser);
          localStorage.setItem(STORAGE_USER_KEY, JSON.stringify(cloudUser));
          registerUser(cloudUser, authFetch).catch(() => {});
          pendingAutoSync.current = true;
        }
      } catch {
        /* not in Farcaster context */
      }
    })();
  }, []);

  const signIn = useCallback(async () => {
    try {
      const inMiniApp = await sdk.isInMiniApp();
      if (!inMiniApp) return;

      const context = await sdk.context;
      if (context?.user?.fid) {
        const cloudUser: CloudUser = {
          fid: String(context.user.fid),
          username: context.user.username ?? '',
          pfpUrl: context.user.pfpUrl ?? '',
        };
        await registerUser(cloudUser, authFetch);
        setUser(cloudUser);
        localStorage.setItem(STORAGE_USER_KEY, JSON.stringify(cloudUser));
      }
    } catch (err) {
      console.error('Sign-in failed:', err);
    }
  }, []);

  const signOut = useCallback(() => {
    setUser(null);
    setSyncStatus('idle');
    setLastSyncAt(null);
    localStorage.removeItem(STORAGE_USER_KEY);
    localStorage.removeItem(STORAGE_SYNC_KEY);
  }, []);

  const sync = useCallback(async (localOverride?: Artwork[]): Promise<Artwork[]> => {
    if (!user) return [];

    // If offline, queue the sync for later and update status
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      const localArtworks = localOverride ?? await loadArtworks();
      enqueueSync(localArtworks.map((a) => a.id));
      setSyncStatus('offline');
      return [];
    }

    // If already syncing, queue this request to run after the current one finishes
    if (syncLock.current) {
      return new Promise<Artwork[]>((resolve, reject) => {
        queuedSync.current = { localOverride, resolve, reject };
      });
    }

    syncLock.current = true;
    setSyncStatus('syncing');

    try {
      // Include any previously queued offline artwork IDs
      const pendingIds = getPendingArtworkIds();
      const localArtworks = localOverride ?? await loadArtworks();

      // If there are pending offline IDs, ensure we push those artworks too
      let artworksToPush = localArtworks;
      if (pendingIds.length > 0 && !localOverride) {
        const localIds = new Set(localArtworks.map((a) => a.id));
        const missingIds = pendingIds.filter((id) => !localIds.has(id));
        if (missingIds.length > 0) {
          // All artworks are already loaded above, but the pending ones
          // ensure we push even if incremental sync would skip them
          artworksToPush = localArtworks;
        }
      }

      if (artworksToPush.length > 0) {
        // When draining the offline queue, push everything (no incremental `since`)
        const since = pendingIds.length > 0 ? null : lastSyncAt;
        await pushToCloud(artworksToPush, authFetch, since);
      }

      const cloudArtworks = await pullFromCloud(authFetch);
      for (const aw of cloudArtworks) {
        await saveArtwork(aw);
      }

      // Sync succeeded — clear any offline queue
      clearSyncQueue();

      const now = new Date().toISOString();
      setLastSyncAt(now);
      localStorage.setItem(STORAGE_SYNC_KEY, now);
      setSyncStatus('synced');
      return cloudArtworks;
    } catch (err) {
      console.error('Sync error:', err);

      // If the error is due to going offline mid-sync, queue for later
      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        const localArtworks = localOverride ?? await loadArtworks().catch(() => []);
        enqueueSync(localArtworks.map((a) => a.id));
        setSyncStatus('offline');
      } else {
        setSyncStatus('error');
      }

      return [];
    } finally {
      syncLock.current = false;

      // Process queued sync request if one was waiting
      const queued = queuedSync.current;
      if (queued) {
        queuedSync.current = null;
        sync(queued.localOverride).then(queued.resolve, queued.reject);
      }
    }
  }, [user, lastSyncAt]);

  useEffect(() => {
    if (user && pendingAutoSync.current) {
      pendingAutoSync.current = false;
      sync().catch(() => {});
    }
  }, [user, sync]);

  // ---------------------------------------------------------------------------
  // Online/offline detection — drain queue when connectivity returns
  // ---------------------------------------------------------------------------

  useEffect(() => {
    if (!user) return;

    const handleOnline = () => {
      // Connectivity restored — drain offline queue if there are pending ops
      if (hasPendingSync()) {
        sync().catch(() => {});
      } else if (syncStatus === 'offline') {
        setSyncStatus('idle');
      }
    };

    const handleOffline = () => {
      setSyncStatus('offline');
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Check on mount if we're offline or have a pending queue
    if (!navigator.onLine) {
      setSyncStatus('offline');
    } else if (hasPendingSync()) {
      // Came back online with pending items (e.g. page reload while online)
      sync().catch(() => {});
    }

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [user, sync, syncStatus]);

  return (
    <CloudContext.Provider value={{ user, syncStatus, lastSyncAt, isMiniApp, signIn, signOut, sync }}>
      {children}
    </CloudContext.Provider>
  );
}
