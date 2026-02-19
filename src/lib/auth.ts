import { createClient } from '@farcaster/quick-auth';
import { NextResponse } from 'next/server';

const quickAuth = createClient();

const APP_DOMAIN = process.env.APP_DOMAIN || 'moodboard-generator-phi.vercel.app';

export async function verifyAuth(req: Request): Promise<{ fid: number } | null> {
  const authorization = req.headers.get('Authorization');
  if (!authorization?.startsWith('Bearer ')) {
    console.warn('verifyAuth: no Bearer token in request');
    return null;
  }

  try {
    const token = authorization.split(' ')[1];
    const payload = await quickAuth.verifyJwt({ token, domain: APP_DOMAIN });
    return { fid: payload.sub };
  } catch (err) {
    console.error('verifyAuth: JWT verification failed:', err);
    return null;
  }
}

// ---------------------------------------------------------------------------
// Origin validation — rejects requests from unexpected origins
// ---------------------------------------------------------------------------

const ALLOWED_ORIGINS = new Set([
  `https://${APP_DOMAIN}`,
  'http://localhost:3000',
  'http://localhost:3001',
  'http://localhost:3002',
]);

export function checkOrigin(req: Request): boolean {
  const origin = req.headers.get('origin');
  if (!origin) return true; // server-to-server or same-origin navigation
  return ALLOWED_ORIGINS.has(origin);
}

export function originDenied() {
  return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
}

// ---------------------------------------------------------------------------
// Simple in-memory rate limiter (per-IP, sliding window)
// ---------------------------------------------------------------------------

const rateBuckets = new Map<string, { count: number; resetAt: number }>();

const RATE_WINDOW_MS = 60_000;
const RATE_MAX = 20;
const CLEANUP_INTERVAL_MS = 5 * 60_000; // 5 minutes
let lastCleanup = Date.now();

/** Evict expired buckets periodically instead of only at 10k entries. */
function cleanupExpiredBuckets(now: number) {
  if (now - lastCleanup < CLEANUP_INTERVAL_MS) return;
  lastCleanup = now;
  for (const [key, bucket] of rateBuckets) {
    if (now > bucket.resetAt) rateBuckets.delete(key);
  }
}

export function rateLimit(req: Request, max = RATE_MAX): NextResponse | null {
  const ip =
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    req.headers.get('x-real-ip') ||
    'unknown';

  const now = Date.now();

  // Periodic cleanup to prevent memory growth on long-lived instances
  cleanupExpiredBuckets(now);

  let bucket = rateBuckets.get(ip);

  if (!bucket || now > bucket.resetAt) {
    bucket = { count: 0, resetAt: now + RATE_WINDOW_MS };
    rateBuckets.set(ip, bucket);
  }

  bucket.count++;

  if (bucket.count > max) {
    return NextResponse.json(
      { error: 'Too many requests, try again later' },
      { status: 429, headers: { 'Retry-After': '60' } },
    );
  }

  return null;
}
