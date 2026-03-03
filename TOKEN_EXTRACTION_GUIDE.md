# 🔑 How to Get a Valid Farcaster Token for API Testing

## Problem
The token you're using contains a truncation ellipsis (`…`) which is an invalid character in HTTP headers.

**Invalid**: `eyJhbGciOiJSUzI1NiIsImtpZCI6IjM1NWQ0M2JmLWM0YjQtND…VN9RCrSme1A2BoRFOfz_WDPFOYSohMcmezW51acgdMX6m12Bw`

This should be a complete JWT token with three parts separated by dots.

---

## ✅ How to Get the Token Correctly

### Method 1: From Warpcast Console (Best for Testing)

1. **Open Warpcast Mini App**
   - Go to https://moodboard-generator-phi.vercel.app in Warpcast
   - Or scan QR code in Warpcast

2. **Open DevTools Console**
   - Press `F12` or right-click → Inspect → Console tab
   - Or in Warpcast DevTools Simulator

3. **Get the Token**
   ```javascript
   // In console, run:
   const response = await sdk.quickAuth.getToken();
   console.log(response.token);
   ```

4. **Copy the Complete Token**
   - Select the entire output (should look like: `eyJhbGc...` with NO ellipsis)
   - Copy with `Cmd+C` (Mac) or `Ctrl+C` (Windows/Linux)

5. **Verify Token Format**
   - Token should have **3 parts separated by dots**: `part1.part2.part3`
   - Example: `eyJhbGciOiJSUzI1NiIsImtpZCI6IjM1NWQ0M2JmLWM0YjQtNDQ2YS1iMzM5LWEwM2I1ZjQ1NjE4YiJ9.eyJpc3MiOiJodHRwczovL2F1dGguZmFyY2FzdGVyLnh5eiIsInN...`. 

### Method 2: From TokenDisplay Component UI

1. Look for green notification in top-right of app
2. It says "Auth Token Ready ✅"
3. Click the **Copy** button
4. Token is now in your clipboard

---

## ✅ How to Use the Token for Testing

### Option A: Direct Command Line

```bash
# Get your complete token first (see steps above)
TOKEN="your_complete_token_here"

# Run API tests with the token
npm run test:api https://moodboard-generator-phi.vercel.app $TOKEN
```

**Important**: Replace `your_complete_token_here` with the actual full token (no truncation!)

### Option B: Environment Variable

```bash
# Set token
export FARCASTER_TOKEN="your_complete_token_here"

# Run tests
npm run test:api https://moodboard-generator-phi.vercel.app $FARCASTER_TOKEN
```

### Option C: Copy-Paste Directly

```bash
# After copying token to clipboard:
npm run test:api https://moodboard-generator-phi.vercel.app
# Then paste: Cmd+V (Mac) or Ctrl+V

# Or one line:
npm run test:api https://moodboard-generator-phi.vercel.app eyJhbGciOiJSUzI1NiIsImtpZCI6IjM1NWQ0M2JmLWM0YjQtNDQ2YS1iMzM5LWEwM2I1ZjQ1NjE4YiJ9.eyJpc3MiOiJodHRwczovL2F1dGguZmFyY2FzdGVyLnh5eiIsImlhdCI6MTc3MjUyOTgyNiwiZXhwIjoxNzcyNTMzNDI2LCJzdWIiOjQyOTQ1MCwibmFtZSI6IkZhcmNhc3RlciBVc2VyIn0.VN9RCrSme1A2BoRFOfz_WDPFOYSohMcmezW51acgdMX6m12Bw
```

---

## ❌ Token Format - What NOT to Do

| Format | Valid? | Issue |
|--------|--------|-------|
| `eyJhbGc...…VN9R` | ❌ NO | Contains ellipsis (`…`) |
| `eyJhbGc...VN9R` (incomplete) | ❌ NO | Only shows beginning and end |
| `eyJhbGciOiJSUzI1...` (with real dots) | ✓ YES | Complete JWT in one line |
| `(pasted from clipboard)` | ✓ YES | Should be the full token |

---

## ✅ Token Format - What TO Do

```javascript
// In console - get the response object
const response = await sdk.quickAuth.getToken();
console.log(response.token);

// Output should look like:
// eyJhbGciOiJSUzI1NiIsImtpZCI6IjM1NWQ0M2JmLWM0YjQtNDQ2YS1iMzM5LWEwM2I1ZjQ1NjE4YiJ9.eyJpc3MiOiJodHRwczovL2F1dGguZmFyY2FzdGVyLnh5eiIsImlhdCI6MTc3MjUyOTgyNiwiZXhwIjoxNzcyNTMzNDI2LCJzdWIiOjQyOTQ1MCwibmFtZSI6IkZhcmNhc3RlciBVc2VyIn0.VN9RCrSme1A2BoRFOfz_WDPFOYSohMcmezW51acgdMX6m12Bw

// Copy this entire string (all 3 parts!)
```

---

## 🧪 Verify Token is Valid

Before running tests, verify the token:

```javascript
// In browser console:
console.log(sdk.quickAuth.token);  // Should show your token

// Or check token parts:
const token = "your_token_here";
const parts = token.split('.');
console.log('Token has', parts.length, 'parts (should be 3)');
// Output: Token has 3 parts (should be 3)
```

---

## 🚀 Test Command (Copy-Ready)

Once you have the full token, run this (replace YOUR_TOKEN):

```bash
npm run test:api https://moodboard-generator-phi.vercel.app YOUR_TOKEN
```

---

## 📋 Checklist

- [ ] Open Warpcast app
- [ ] Navigate to moodboard-generator app
- [ ] Open DevTools Console (F12)
- [ ] Run: `const response = await sdk.quickAuth.getToken(); console.log(response.token);`
- [ ] Copy the entire output (should be long string with dots)
- [ ] Verify NO ellipsis (`…`) in the token
- [ ] Run: `npm run test:api https://moodboard-generator-phi.vercel.app [PASTE_TOKEN]`
- [ ] Expected: ✅ All tests pass

---

## Common Issues

### ❌ "Invalid character in header content"
- **Cause**: Token contains ellipsis or was truncated
- **Fix**: Get the full token from console, copy all 3 parts

### ❌ "Unauthorized" (401)
- **Cause**: Token is expired or invalid
- **Fix**: Get a fresh token from console

### ❌ Token keeps disappearing
- **Cause**: Shell interpreting special characters
- **Fix**: Wrap token in quotes: `"your_token_here"`

---

## Example Working Command

```bash
npm run test:api https://moodboard-generator-phi.vercel.app "eyJhbGciOiJSUzI1NiIsImtpZCI6IjM1NWQ0M2JmLWM0YjQtNDQ2YS1iMzM5LWEwM2I1ZjQ1NjE4YiJ9.eyJpc3MiOiJodHRwczovL2F1dGguZmFyY2FzdGVyLnh5eiIsImlhdCI6MTc3MjUyOTgyNiwiZXhwIjoxNzcyNTMzNDI2LCJzdWIiOjQyOTQ1MCwibmFtZSI6IkZhcmNhc3RlciBVc2VyIn0.VN9RCrSme1A2BoRFOfz_WDPFOYSohMcmezW51acgdMX6m12Bw"
```

Note: Token wrapped in quotes to preserve special characters

---

## Still Not Working?

1. Check token length - should be 300+ characters
2. Verify it has exactly 3 dots (not 2, not 4)
3. Check no spaces or special characters
4. Try copying the token using the UI button instead of console
5. Check Vercel logs at: https://vercel.com/melisandec/moodboard-generator/logs

---

*Updated: March 3, 2026*
