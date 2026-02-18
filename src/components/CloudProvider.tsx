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
  signIn: () => Promise<void>;
  signOut: () => void;
  sync: (localOverride?: Artwork[]) => Promise<void>;
}

const CloudContext = createContext<CloudContextValue>({
  user: null,
  syncStatus: 'idle',
  lastSyncAt: null,
  signIn: async () => {},
  signOut: () => {},
  sync: async () => {},
});

export function useCloud() {
  return useContext(CloudContext);
}

const STORAGE_USER_KEY = 'moodboard-cloud-user';
const STORAGE_SYNC_KEY = 'moodboard-last-sync';

export function CloudProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<CloudUser | null>(null);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('idle');
  const [lastSyncAt, setLastSyncAt] = useState<string | null>(null);
  const syncLock = useRef(false);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_USER_KEY);
      if (stored) setUser(JSON.parse(stored));
    } catch { /* ignore */ }

    try {
      const ts = localStorage.getItem(STORAGE_SYNC_KEY);
      if (ts) setLastSyncAt(ts);
    } catch { /* ignore */ }

    const timer = setTimeout(() => {
      try {
        const ctx = sdk.context as { user?: { fid?: number; username?: string; pfpUrl?: string } } | undefined;
        if (ctx?.user?.fid) {
          const cloudUser: CloudUser = {
            fid: String(ctx.user.fid),
            username: ctx.user.username ?? '',
            pfpUrl: ctx.user.pfpUrl ?? '',
          };
          setUser(cloudUser);
          localStorage.setItem(STORAGE_USER_KEY, JSON.stringify(cloudUser));
          registerUser(cloudUser).catch(() => {});
        }
      } catch { /* not in Farcaster context */ }
    }, 600);

    return () => clearTimeout(timer);
  }, []);

  const signIn = useCallback(async () => {
    try {
      const ctx = sdk.context as { user?: { fid?: number; username?: string; pfpUrl?: string } } | undefined;
      if (ctx?.user?.fid) {
        const cloudUser: CloudUser = {
          fid: String(ctx.user.fid),
          username: ctx.user.username ?? '',
          pfpUrl: ctx.user.pfpUrl ?? '',
        };
        await registerUser(cloudUser);
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

  const sync = useCallback(async (localOverride?: Artwork[]) => {
    if (!user || syncLock.current) return;
    syncLock.current = true;
    setSyncStatus('syncing');

    try {
      const localArtworks = localOverride ?? await loadArtworks();
      if (localArtworks.length > 0) {
        await pushToCloud(user.fid, localArtworks);
      }

      const cloudArtworks = await pullFromCloud(user.fid);
      for (const aw of cloudArtworks) {
        await saveArtwork(aw);
      }

      const now = new Date().toISOString();
      setLastSyncAt(now);
      localStorage.setItem(STORAGE_SYNC_KEY, now);
      setSyncStatus('synced');
    } catch (err) {
      console.error('Sync error:', err);
      setSyncStatus('error');
    } finally {
      syncLock.current = false;
    }
  }, [user]);

  return (
    <CloudContext.Provider value={{ user, syncStatus, lastSyncAt, signIn, signOut, sync }}>
      {children}
    </CloudContext.Provider>
  );
}
