# Vercel Deployment Fixes for 500 Errors

## Summary of Issues & Fixes

The 500 errors on `moodboard-generator-phi.vercel.app` were caused by:

1. ❌ **Missing/Incorrect Environment Variables** in Vercel dashboard
   - `TURSO_DATABASE_URL` (undefined or wrong value)
   - `TURSO_AUTH_TOKEN` (undefined or wrong value)
   - `APP_DOMAIN` (should be `moodboard-generator-phi.vercel.app`)

2. ❌ **Poor Error Logging** in API routes
   - `/api/user` and `/api/boards/create` returned generic 500 without context
   - Database connection errors hidden in console

3. ❌ **Uncaught Database Connection Errors**
   - `getDb()` throws immediately if env vars missing (no graceful handling)

## Fixed Files

### 1. [src/app/api/user/route.ts](src/app/api/user/route.ts)
- ✅ Added comprehensive console logging at each step
- ✅ Better error classification (DB config vs JWT vs runtime)
- ✅ Timing metrics for debugging

### 2. [src/app/api/boards/create/route.ts](src/app/api/boards/create/route.ts)
- ✅ Added comprehensive console logging at each step
- ✅ Better error classification and context
- ✅ Timing metrics for debugging

### 3. [src/lib/auth.ts](src/lib/auth.ts)
- ✅ Enhanced JWT verification logging
- ✅ Better error messages for debugging

---

## Vercel Environment Variables Checklist

### Required Variables (🔴 CRITICAL)

```ini
# Database (from Turso)
TURSO_DATABASE_URL=libsql://moodboard-db-melisandec.aws-eu-west-1.turso.io
TURSO_AUTH_TOKEN=eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9...

# Auth & Domain
APP_DOMAIN=moodboard-generator-phi.vercel.app
```

### Optional Variables (Image Storage - if using Pinata)

```ini
PINATA_JWT=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
PINATA_GATEWAY=gateway.pinata.cloud
```

---

## Step-by-Step Fix for Vercel Deployment

### 1️⃣ **Get Credentials from Local Repo**

```bash
# Check your local .env or .env.local
cat .env.local | grep TURSO
cat .env.local | grep APP_DOMAIN
cat .env.local | grep PINATA
```

Example output:
```
TURSO_DATABASE_URL=libsql://moodboard-db-melisandec.aws-eu-west-1.turso.io
TURSO_AUTH_TOKEN=eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9...
APP_DOMAIN=moodboard-generator-phi.vercel.app
PINATA_JWT=...
PINATA_GATEWAY=gateway.pinata.cloud
```

### 2️⃣ **Add Variables to Vercel Dashboard**

1. Go to: https://vercel.com/builders-apps/moodboard-generator/settings/environment-variables
2. Click **+ Add New** for each variable:
   - Name: `TURSO_DATABASE_URL`
   - Value: `libsql://moodboard-db-melisandec.aws-eu-west-1.turso.io`
   - Production ✓
   - Click **Save**

3. Repeat for:
   - `TURSO_AUTH_TOKEN` → (full token from .env.local)
   - `APP_DOMAIN` → `moodboard-generator-phi.vercel.app`
   - `PINATA_JWT` → (if applicable)
   - `PINATA_GATEWAY` → `gateway.pinata.cloud`

### 3️⃣ **Deploy Updated Code**

Deploy the updated routes with enhanced logging:

```bash
# From workspace root
git add -A
git commit -m "fix: add comprehensive error logging to API routes for debugging"
git push
```

Vercel will auto-deploy from `main` branch on push.

**Or manually trigger deployment:**

```bash
# If you have vercel CLI installed
vercel --prod
```

### 4️⃣ **Verify Deployment**

After deployment completes:

1. **Check Vercel Runtime Logs**:
   - https://vercel.com/builders-apps/moodboard-generator/logs
   - Filter by deployment time

2. **Test in Browser**:
   - Open DevTools → Console
   - Look for new detailed logging from routes

3. **Test API Endpoints** (requires auth token):

```bash
# Get token from app:
# 1. Open moodboard-generator-phi.vercel.app in Warpcast embedded browser
# 2. Open DevTools → Console
# 3. Run: await sdk.quickAuth.getToken()
# 4. Copy token value

# Test /api/user
curl -X POST https://moodboard-generator-phi.vercel.app/api/user \
  -H "Authorization: Bearer <TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"username": "test", "pfpUrl": ""}'

# Test /api/boards/create
curl -X POST https://moodboard-generator-phi.vercel.app/api/boards/create \
  -H "Authorization: Bearer <TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Test Board",
    "caption": "Test",
    "canvasState": [{"id": "img1", "x": 0, "y": 0, "width": 100, "height": 100, "rotation": 0, "pinned": false, "zIndex": 1, "naturalWidth": 100, "naturalHeight": 100, "imageHash": "hash1"}],
    "canvasWidth": 400,
    "canvasHeight": 400,
    "background": "#FFFFFF",
    "orientation": "square",
    "margin": false,
    "categories": [],
    "isPublic": false
  }'
```

---

## Debugging Workflow

### If Still Getting 500 Errors:

1. **Check Vercel Runtime Logs**:
   - Go to https://vercel.com/builders-apps/moodboard-generator/logs
   - Look for lines starting with `[/api/user]` or `[/api/boards/create]`
   - Each line now includes:
     - Timestamp
     - Step being executed
     - Error type and message
     - Error stack trace

2. **Common Error Patterns**:

   | Error Message | Cause | Fix |
   |---|---|---|
   | `Database URL not configured` | `TURSO_DATABASE_URL` missing | Add to Vercel env vars |
   | `Database auth token not configured` | `TURSO_AUTH_TOKEN` missing | Add to Vercel env vars |
   | `Database connection failed` | Wrong URL or blocked IP | Verify Turso whitelist |
   | `Authentication token verification failed` | JWT expired or invalid | Get fresh token from app |
   | `Unauthorized: Farcaster user required` | No Bearer token in request | Ensure `authFetch()` sends token |

3. **Enable Production Logs in Vercel**:
   - Go to Project Settings → Deployments
   - Toggle "Enable Production Logs" (if available)
   - Re-deploy and test

### Local Testing Before Deployment

```bash
# Set env vars locally
export TURSO_DATABASE_URL="libsql://..."
export TURSO_AUTH_TOKEN="eyJ..."
export APP_DOMAIN="localhost:3000"

# Run dev server
npm run dev

# Test locally (with auth token):
curl -X POST http://localhost:3000/api/user \
  -H "Authorization: Bearer <TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"username": "test", "pfpUrl": ""}'
```

---

## Environment Variable Security Notes

⚠️ **NEVER commit `.env.local` to git**

- Add to `.gitignore`: `✓ Already done`
- Vercel dashboard automatically encrypts environment variables
- Use `NEXT_PUBLIC_` prefix ONLY for client-side vars (not `TURSO_AUTH_TOKEN`!)

---

## Expected Behavior After Fix

### Before (with 500 errors):
```
❌ /api/user:1 Failed to load resource: server responded with 500
❌ registerUser failed: 500 User registration failed
❌ Board creation failed: Error: Failed to create board
```

### After (success):
```
✅ [/api/user] ✓ Auth verified for FID: 12345
✅ [/api/user] ✓ New user created successfully
✅ [/api/user] ✅ SUCCESS (245ms)
```

---

## Rollback Plan (if needed)

If deployment breaks the app:

1. Revert the commit:
   ```bash
   git revert HEAD
   git push  # Auto-deploys to Vercel
   ```

2. Or manually redeploy previous version:
   - Vercel Dashboard → Deployments → Click "...More" → Deploy

3. The enhanced logging is non-breaking (just adds console output)

---

## Next Steps

1. ✅ Add all env vars to Vercel Dashboard
2. ✅ Push code changes to GitHub
3. ✅ Wait for Vercel auto-deployment (2-3 min)
4. ✅ Test in browser (open app from Warpcast)
5. ✅ Monitor Vercel logs for detailed error messages
6. ✅ If still 500: Check database status in Turso dashboard

---

## Support

For issues, check:

- **Vercel Logs**: https://vercel.com/builders-apps/moodboard-generator/logs
- **Turso Status**: https://console.turso.io (check database is "Active")
- **Local Env**: Ensure `.env.local` has correct values before pushing
