import { createClient } from '@farcaster/quick-auth';

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
