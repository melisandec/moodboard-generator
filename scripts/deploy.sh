#!/bin/bash

# 🚀 Farcaster Mini App - One-Click Deployment Script
# Usage: bash scripts/deploy.sh

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}"
echo "╔════════════════════════════════════════════════════════════════╗"
echo "║   Farcaster Mini App - SDK Fix Deployment Script              ║"
echo "║   moodboard-generator-phi.vercel.app                          ║"
echo "╚════════════════════════════════════════════════════════════════╝"
echo -e "${NC}\n"

# Step 1: Check dependencies
echo -e "${YELLOW}📦 Step 1: Checking dependencies...${NC}"
if ! command -v node &> /dev/null; then
  echo -e "${RED}❌ Node.js not found. Please install Node.js first.${NC}"
  exit 1
fi
echo -e "${GREEN}✅ Node.js found: $(node --version)${NC}\n"

# Step 2: Install npm packages
echo -e "${YELLOW}📦 Step 2: Installing npm packages...${NC}"
npm install
echo -e "${GREEN}✅ Dependencies installed${NC}\n"

# Step 3: Environment setup
echo -e "${YELLOW}⚙️  Step 3: Setting up environment variables...${NC}"
if [ ! -f .env.local ]; then
  echo -e "${BLUE}📝 Creating .env.local from template...${NC}"
  cp .env.example .env.local
  echo -e "${YELLOW}⚠️  IMPORTANT: Edit .env.local with your NEYNAR_API_KEY${NC}"
  echo -e "${YELLOW}   Get key from: https://developer.neynar.com/${NC}\n"
  read -p "Press Enter after updating .env.local... "
else
  echo -e "${GREEN}✅ .env.local already exists${NC}\n"
fi

# Step 4: Local testing
echo -e "${YELLOW}🧪 Step 4: Running local tests...${NC}"
echo -e "${BLUE}Starting dev server...${NC}"
timeout 30 npm run dev 2>&1 | grep -q "compiled client and server successfully" && echo -e "${GREEN}✅ Dev server started${NC}" || echo -e "${YELLOW}⚠️  Dev server starting...${NC}"

echo -e "${YELLOW}Please test manually:${NC}"
echo -e "  1. Open: ${BLUE}http://localhost:3000${NC}"
echo -e "  2. Open DevTools (F12)"
echo -e "  3. Run: ${BLUE}await sdk.quickAuth.getToken()${NC}"
echo -e "  4. Verify green notification appears\n"
read -p "Did local testing pass? (y/n) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
  echo -e "${RED}❌ Local testing failed. Check SDK initialization.${NC}"
  exit 1
fi
echo -e "${GREEN}✅ Local testing passed${NC}\n"

# Step 5: Git commit
echo -e "${YELLOW}📝 Step 5: Committing changes...${NC}"
git add -A
git commit -m "fix: expose Farcaster SDK globally for console access

- Initialize SDK in SDKInitializer component
- Expose sdk to window for console access
- Add TokenDisplay UI component
- Update layout and page with new components
- Add environment variable template
- Provide comprehensive deployment guide"
echo -e "${GREEN}✅ Changes committed${NC}\n"

# Step 6: Deploy
echo -e "${YELLOW}🚀 Step 6: Deploying to Vercel...${NC}"
if command -v vercel &> /dev/null; then
  vercel --prod
  echo -e "${GREEN}✅ Deployed to production${NC}\n"
else
  echo -e "${YELLOW}⚠️  Vercel CLI not installed${NC}"
  echo -e "${BLUE}Git push will trigger auto-deployment:${NC}"
  git push origin main
  echo -e "${GREEN}✅ Changes pushed to GitHub (Vercel will auto-deploy)${NC}\n"
fi

# Step 7: Final instructions
echo -e "${GREEN}═════════════════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}✅ Deployment Complete!${NC}\n"
echo -e "${BLUE}Next Steps:${NC}"
echo -e "  1. Wait for Vercel deployment: ${BLUE}https://vercel.com/melisandec/moodboard-generator${NC}"
echo -e "  2. Open app in Warpcast"
echo -e "  3. Open DevTools Console (F12)"
echo -e "  4. Run: ${BLUE}const token = await sdk.quickAuth.getToken(); console.log(token);${NC}"
echo -e "  5. Copy token and run: ${BLUE}npm run test:api https://moodboard-generator-phi.vercel.app TOKEN${NC}"
echo -e "\n${BLUE}Deployment Docs:${NC}"
echo -e "  📖 Full Guide: ${BLUE}./SDK_FIX_SUMMARY.md${NC}"
echo -e "  📖 Detailed: ${BLUE}./FARCASTER_SDK_FIX.md${NC}"
echo -e "${GREEN}═════════════════════════════════════════════════════════════════${NC}\n"
