#!/bin/bash

# Quick Token Extract & API Test Script
# Usage: ./scripts/get-token-and-test.sh

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}🚀 Farcaster Mini App - Token & API Test${NC}\n"

# Instructions for getting token
cat << 'EOF'
STEP 1: Get Your Token
=======================
1. Open app in Warpcast (or DevTools Simulator)
2. Open DevTools Console (F12)
3. Run this command:
   const token = await sdk.quickAuth.getToken();
   console.log(token);
4. Copy the token output

STEP 2: Run API Tests with Token
================================
After getting your token, run one of these:

  # Local development
  FARCASTER_TOKEN="your_token_here" npm run test:api http://localhost:3000

  # Production
  FARCASTER_TOKEN="your_token_here" npm run test:api https://moodboard-generator-phi.vercel.app

  # Or pass token as argument
  npm run test:api http://localhost:3000 your_token_here

STEP 3: Check Results
====================
Look for:
  ✅ User registration successful
  ✅ Boards API working
  ✅ Images API working
  ✅ Token validation passed

EOF

# Optional: Auto-start local server
read -p "Start local dev server? (y/n) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
  npm run dev
fi
