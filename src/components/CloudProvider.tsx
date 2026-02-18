'use client';

import { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import { sdk } from '@farcaster/miniapp-sdk';
import {
  registerUser, pushToCloud, pullFromCloud,
  type CloudUser, type SyncStatus,
} from '@/lib/cloud';
import { loadArtworks, saveArtwork, type Artwork } from '@/lib/storage';

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

async function authFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  try {
    const res = await sdk.quickAuth.fetch(input, init);
    return res;
  } catch (err) {
    console.warn('quickAuth.fetch failed, falling back to plain fetch:', err);
    return fetch(input, init);
  }
}

export function CloudProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<CloudUser | null>(null);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('idle');
  const [lastSyncAt, setLastSyncAt] = useState<string | null>(null);
  const [isMiniApp, setIsMiniApp] = useState(false);
  const syncLock = useRef(false);
  const initDone = useRef(false);
  const pendingAutoSync = useRef(false);

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
    if (!user || syncLock.current) return [];
    syncLock.current = true;
    setSyncStatus('syncing');

    try {
      const localArtworks = localOverride ?? await loadArtworks();
      if (localArtworks.length > 0) {
        await pushToCloud(localArtworks, authFetch);
      }

      const cloudArtworks = await pullFromCloud(authFetch);
      for (const aw of cloudArtworks) {
        await saveArtwork(aw);
      }

      const now = new Date().toISOString();
      setLastSyncAt(now);
      localStorage.setItem(STORAGE_SYNC_KEY, now);
      setSyncStatus('synced');
      return cloudArtworks;
    } catch (err) {
      console.error('Sync error:', err);
      setSyncStatus('error');
      return [];
    } finally {
      syncLock.current = false;
    }
  }, [user]);

  useEffect(() => {
    if (user && pendingAutoSync.current) {
      pendingAutoSync.current = false;
      sync().catch(() => {});
    }
  }, [user, sync]);

  return (
    <CloudContext.Provider value={{ user, syncStatus, lastSyncAt, isMiniApp, signIn, signOut, sync }}>
      {children}
    </CloudContext.Provider>
  );
}
