# 🔧 Troubleshooting 401 Unauthorized Error

## ✅ Good News
Your token format is valid! ✓ The 401 error means JWT verification is failing, which we can fix.

---

## 🚨 Problem: 401 Unauthorized 

The API endpoints are receiving your request but rejecting it because JWT verification failed.

**Your test output**:
```
ERROR POST /api/user returned 401 {
  "error": "Unauthorized"
}
```

---

## 🔍 Root Cause

The 401 error is occurring because:
1. **Environment variables not set in Vercel** - The APP_DOMAIN is missing
2. **Domain mismatch** - Token issued for different domain than verification
3. **Missing Neynar API key** - Required for Farcaster integration

---

## ✅ Step 1: Verify Vercel Environment Variables

Your **Vercel environment variables** MUST be set. Go to:

**Vercel Dashboard** → **moodboard-generator** → **Settings** → **Environment Variables**

### Required Variables:

Set these **exactly**:

```
# Authentication & API
APP_DOMAIN = moodboard-generator-phi.vercel.app
NEXT_PUBLIC_APP_DOMAIN = moodboard-generator-phi.vercel.app
NEYNAR_API_KEY = your_key_from_developer.neynar.com  
NEXT_PUBLIC_NEYNAR_API_KEY = same_key

# Database (Turso)
TURSO_DATABASE_URL = your_turso_connection_url
TURSO_AUTH_TOKEN = your_turso_auth_token
```

⚠️ **Important**: 
- `APP_DOMAIN` should be **just the domain** (no `https://`)
- Copy from https://developer.neynar.com/ for API keys
- Use the **same** API key for both NEYNAR_API_KEY variables
- Get Turso credentials from https://turso.tech/

### To Get Turso Credentials:

1. Go to https://turso.tech/
2. Sign up (free tier available)
3. Create a database named "moodboard" (or similar)
4. In Dashboard → Database → Connection String
5. Copy the connection URL and auth token
6. Add to Vercel env vars above

### Step-by-Step:

1. Go to https://vercel.com/melisandec/moodboard-generator
2. Click **Settings** tab
3. Click **Environment Variables** (left sidebar)
4. Add each variable above
5. Click **Save**
6. Click **Deployments** and **Redeploy** latest deployment
7. Wait ~2-3 minutes for deployment to complete

---

## ✅ Step 2: Check Vercel Logs

After updating env vars and redeploying, check the Vercel logs:

1. Go to https://vercel.com/melisandec/moodboard-generator
2. Click **Deployments** tab
3. Click the latest deployment
4. Click **View Logs**
5. Look for lines starting with `[verifyAuth]`
6. This will show what domain was used and what happened

**Expected success log**:
```
[verifyAuth] ✓ JWT verified successfully for FID: 429450
```

**If failing, you'll see**:
```
[verifyAuth] ❌ JWT verification failed
  domain: moodboard-generator-phi.vercel.app
  message: [specific error]
```

---

## ✅ Step 3: Redeploy

Once env vars are set, trigger a redeploy:

**Option A**: In Vercel Dashboard
1. Go to **Deployments**
2. Find the latest deployment
3. Click ⋮ (three dots) → **Redeploy**
4. Wait for build to finish (~3 min)

**Option B**: Via Git
```bash
git add .
git commit -m "trigger redeploy"
git push origin main
# Vercel auto-deploys when main is pushed
```

---

## ✅ Step 4: Test After Redeploy

Once Vercel redeploy is complete, test:

```bash
npm run test:api https://moodboard-generator-phi.vercel.app YOUR_TOKEN
```

**Expected result**:
```
✅ Status: 200 OK
✅ POST /api/user - Success
✅ POST /api/boards/create - Success
```

---

## 📋 Vercel Environment Variables Checklist

- [ ] Go to Vercel Dashboard
- [ ] Select moodboard-generator project  
- [ ] Go to Settings → Environment Variables
- [ ] Set APP_DOMAIN = `moodboard-generator-phi.vercel.app`
- [ ] Set NEXT_PUBLIC_APP_DOMAIN = `moodboard-generator-phi.vercel.app`
- [ ] Set NEYNAR_API_KEY = `[your_key_from_developer.neynar.com]`
- [ ] Set NEXT_PUBLIC_NEYNAR_API_KEY = `[same_key]`
- [ ] **NEW**: Set TURSO_DATABASE_URL = `[your_turso_connection_url]`
- [ ] **NEW**: Set TURSO_AUTH_TOKEN = `[your_turso_auth_token]`
- [ ] Click Save
- [ ] Click Redeploy
- [ ] Wait 2-3 minutes
- [ ] Run test again: `npm run test:api https://moodboard-generator-phi.vercel.app YOUR_TOKEN`

---

## 🆘 Still Getting 401?

### 1. Check Environment Variables
```bash
# Verify env vars are being used
# Check Vercel Logs → look for lines with "domain:"
# Should show: domain: moodboard-generator-phi.vercel.app
```

### 2. Verify Token Generation
The token in your test has these claims (decoded):
- `iss`: https://auth.farcaster.xyz ✓ (correct issuer)
- `aud`: moodboard-generator-phi.vercel.app ✓ (matches domain)
- `sub`: 429450 ✓ (your FID)
- `exp`: 1772533741 ✓ (not expired yet)

### 3. Check Token Expiry
Your token expires ~1 hour after generation. If you got it > 1 hour ago:
1. Get a fresh token from console
2. Run test again

### 4. Local Testing
Test locally to debug faster:
```bash
npm run dev
# In another terminal:
npm run test:api http://localhost:3000 YOUR_TOKEN
```

Local tests will show console logs in `npm run dev` output, helping identify the issue.

---

## 💡 How JWT Verification Works

1. Token sent: `Authorization: Bearer eyJhbGc...`
2. Server receives token
3. Server extracts payload and checks:
   - Token signature is valid (signed by Farcaster)
   - Token not expired (`exp` > now)
   - Token audience matches domain (`aud` == domain)
   - Token issuer is correct (`iss` == Farcaster auth server)
4. If all checks pass → Return FID (429450)
5. If any check fails → Return 401 Unauthorized

**Your case**: All 4 checks should pass if env vars are set correctly.

---

## 📞 Need More Help?

Check these resources:
- Vercel Logs: https://vercel.com/melisandec/moodboard-generator/logs
- Farcaster Quick Auth: https://miniapps.farcaster.xyz/docs/sdk/quick-auth
- Neynar Docs: https://docs.neynar.com/

---

## 🎯 Summary

**Current Status**:
- ✅ Token format is valid
- ✅ Token claims look correct
- ❌ JWT verification failing on Vercel

**Fix**:
1. Set Vercel env vars (APP_DOMAIN, NEYNAR_API_KEY, etc.)
2. Redeploy
3. Wait 2-3 minutes
4. Test again

**Expected Time**: 5-10 minutes total

---

*Updated: March 3, 2026*
