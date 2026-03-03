# Farcaster Mini App SDK Fix - Deployment Guide

## Overview
This document provides step-by-step instructions to deploy the SDK fix that exposes `sdk.quickAuth` globally for Warpcast DevTools console access.

## What Was Changed

### New Files Created:
1. **`src/lib/farcaster-sdk-init.ts`** - SDK initialization logic
2. **`src/components/SDKInitializer.tsx`** - Client component that runs SDK init
3. **`src/components/TokenDisplay.tsx`** - Shows token status in UI
4. **`.env.example`** - Environment variable template

### Modified Files:
1. **`src/app/layout.tsx`** - Added SDKInitializer component
2. **`src/app/page.tsx`** - Added TokenDisplay component

## Deployment Steps

### Step 1: Local Setup
```bash
# Install dependencies (if not already installed)
npm install @farcaster/miniapp-sdk @neynar/nodejs-sdk

# Create .env.local from template
cp .env.example .env.local
```

### Step 2: Configure Environment Variables
Edit `.env.local` and add your Neynar API key:
```env
NEXT_PUBLIC_NEYNAR_API_KEY=your_actual_key_here
NEYNAR_API_KEY=your_actual_key_here
```

**Get your Neynar API Key:**
1. Visit: https://developer.neynar.com/
2. Sign up / Login
3. Create an API key
4. Copy it to `.env.local`

### Step 3: Test Locally
```bash
# Start development server
npm run dev

# Open http://localhost:3000
# You should see the SDK status indicator in the top-right
# Console will show initialization messages
```

### Step 4: Verify SDK is Accessible
Open browser console (DevTools) and run:
```javascript
// Check if SDK is initialized
console.log(window.sdk);

// Get token (only works in Warpcast)
const token = await sdk.quickAuth.getToken();
console.log('Token:', token);
```

### Step 5: Deploy to Vercel

#### Option A: Via GitHub (Recommended)
```bash
# Commit changes
git add .
git commit -m "fix: expose Farcaster SDK globally for console access"
git push origin main

# Vercel will auto-deploy from your main branch
```

#### Option B: Direct Vercel Deployment
```bash
# Install Vercel CLI if not already installed
npm i -g vercel

# Deploy
vercel
```

### Step 6: Configure Vercel Environment Variables
In Vercel Dashboard:
1. Go to your project: `moodboard-generator`
2. Settings → Environment Variables
3. Add:
   - `NEXT_PUBLIC_NEYNAR_API_KEY` = your_key
   - `NEYNAR_API_KEY` = your_key
4. Redeploy

### Step 7: Test in Warpcast

#### Using Warpcast Simulator (Desktop):
1. Open DevTools (F12)
2. Go to DevTools Simulator tab
3. Navigate to your app URL
4. Open browser console
5. Run:
   ```javascript
   const token = await sdk.quickAuth.getToken();
   console.log(token);
   ```

#### Using Physical Device:
1. Open Warpcast app
2. Scan QR code or visit: `https://moodboard-generator-phi.vercel.app`
3. Open browser DevTools
4. Run the above command

## How to Use the Token

### For API Testing:
```bash
# Set token in environment
export FARCASTER_TOKEN="your_token_here"

# Run API tests
npm run test:api
```

### For User Registration:
The token is automatically used in your API routes:
- `/api/user` - Register/authenticate user
- `/api/boards/create` - Create new board with auth

## Troubleshooting

### "sdk is not defined"
- ✅ **Fixed**: SDK is now initialized in SDKInitializer component
- Ensure page fully loads before accessing console
- Check that you're running in Warpcast context (not just browser)

### "No token available"
- Not running inside Warpcast
- Running in browser without Warpcast DevTools
- NEYNAR_API_KEY not configured
- Check browser console for error messages

### Token Display Not Showing
- App not fully loaded (wait for green notification)
- Running outside Warpcast context (expected)
- Check console for error messages

### Deployment Issues
- Clear Vercel deployment cache and redeploy
- Verify environment variables are set in Vercel
- Check build logs in Vercel Dashboard

## Console Commands Reference

```javascript
// Check SDK status
window.sdk

// Get auth token
const token = await sdk.quickAuth.getToken();

// Log token details
console.log('Token:', token);

// Copy token to clipboard (in TokenDisplay component)
// Use the "Copy" button in top-right notification
```

## Files Summary

| File | Purpose |
|------|---------|
| `src/lib/farcaster-sdk-init.ts` | SDK initialization & global exposure |
| `src/components/SDKInitializer.tsx` | Client-side SDK setup hook |
| `src/components/TokenDisplay.tsx` | Token status UI component |
| `src/app/layout.tsx` | Root layout with SDK initializer |
| `src/app/page.tsx` | Home page with token display |
| `.env.example` | Environment variable template |

## Testing Checklist

- [ ] App loads without errors
- [ ] SDK initialization message appears in console
- [ ] Token display shows (green notification in top-right)
- [ ] `window.sdk` is accessible in console
- [ ] `await sdk.quickAuth.getToken()` returns a token
- [ ] Token can be copied to clipboard
- [ ] API routes work with the token
- [ ] `npm run test:api` completes successfully

## Next Steps

1. Deploy changes
2. Test in Warpcast
3. Copy token from console or UI notification
4. Use token for API testing with `npm run test:api`
5. Verify user registration and board creation work

## Support

For SDK documentation:
- Farcaster Mini App SDK: https://miniapps.farcaster.xyz/docs/sdk/quick-auth
- Neynar Docs: https://docs.neynar.com/miniapps/sdk/quick-auth

---
**Last Updated**: March 3, 2026
