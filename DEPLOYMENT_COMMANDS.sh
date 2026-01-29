#!/bin/bash
# 🚀 Calendar Integration - Deployment Commands
# Run from your computer (requires Google Cloud & Firebase CLI access)

set -e  # Exit on error

echo "=================================="
echo "📅 Calendar Integration Deployment"
echo "=================================="
echo ""

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Step 1: Check prerequisites
echo -e "${BLUE}Step 1: Checking prerequisites...${NC}"

if ! command -v firebase &> /dev/null; then
    echo -e "${RED}✗ Firebase CLI not installed${NC}"
    echo "Install: npm install -g firebase-tools"
    exit 1
fi

if ! command -v git &> /dev/null; then
    echo -e "${RED}✗ Git not installed${NC}"
    exit 1
fi

echo -e "${GREEN}✓ Prerequisites OK${NC}"
echo ""

# Step 2: Pull latest code
echo -e "${BLUE}Step 2: Pulling latest code from GitHub...${NC}"
git pull origin main
echo -e "${GREEN}✓ Code updated${NC}"
echo ""

# Step 3: Install dependencies
echo -e "${BLUE}Step 3: Installing dependencies...${NC}"
cd functions
npm install
cd ..
echo -e "${GREEN}✓ Dependencies installed${NC}"
echo ""

# Step 4: Firebase configuration
echo -e "${BLUE}Step 4: Firebase Configuration${NC}"
echo ""
echo -e "${YELLOW}⚠️  MANUAL STEP REQUIRED${NC}"
echo ""
echo "You need to configure Firebase secrets with your Google OAuth credentials."
echo ""
echo "Run these commands (replace with YOUR values):"
echo ""
echo -e "${GREEN}firebase functions:config:set \\"
echo "  google.client_id=\"<YOUR_CLIENT_ID>.apps.googleusercontent.com\" \\"
echo "  google.client_secret=\"<YOUR_CLIENT_SECRET>\" \\"
echo "  google.redirect_uri=\"https://app-pi-one-84.vercel.app/auth/google/callback\"${NC}"
echo ""
echo "To verify:"
echo -e "${GREEN}firebase functions:config:get${NC}"
echo ""
read -p "Press Enter after you've set the secrets..."
echo ""

# Step 5: Build functions
echo -e "${BLUE}Step 5: Building Cloud Functions...${NC}"
cd functions
npm run build
if [ $? -ne 0 ]; then
    echo -e "${RED}✗ Build failed${NC}"
    exit 1
fi
cd ..
echo -e "${GREEN}✓ Build successful${NC}"
echo ""

# Step 6: Deploy functions
echo -e "${BLUE}Step 6: Deploying Cloud Functions...${NC}"
echo ""
echo "Functions to deploy:"
echo "  - connectGoogleCalendar"
echo "  - syncCalendar"
echo "  - scheduledCalendarSync"
echo "  - disconnectGoogleCalendar"
echo "  - correlateRecordingsWithEvents"
echo ""
read -p "Deploy now? (y/N): " -n 1 -r
echo ""
if [[ $REPLY =~ ^[Yy]$ ]]; then
    firebase deploy --only functions:connectGoogleCalendar,functions:syncCalendar,functions:scheduledCalendarSync,functions:disconnectGoogleCalendar,functions:correlateRecordingsWithEvents
    if [ $? -ne 0 ]; then
        echo -e "${RED}✗ Deployment failed${NC}"
        exit 1
    fi
    echo -e "${GREEN}✓ Functions deployed${NC}"
else
    echo -e "${YELLOW}⊘ Deployment skipped${NC}"
fi
echo ""

# Step 7: Vercel environment variables
echo -e "${BLUE}Step 7: Vercel Environment Variables${NC}"
echo ""
echo -e "${YELLOW}⚠️  MANUAL STEP REQUIRED${NC}"
echo ""
echo "Go to Vercel Dashboard:"
echo "  1. https://vercel.com/dashboard"
echo "  2. Select project: always-app"
echo "  3. Settings → Environment Variables"
echo "  4. Add: NEXT_PUBLIC_GOOGLE_CLIENT_ID"
echo "  5. Value: <YOUR_CLIENT_ID>"
echo "  6. Save"
echo ""
read -p "Press Enter after you've set the env var..."
echo ""

# Step 8: Frontend deployment
echo -e "${BLUE}Step 8: Frontend Deployment${NC}"
echo ""
echo "Vercel auto-deploys on git push, but you can force re-deploy:"
echo ""
echo -e "${GREEN}vercel --prod${NC}"
echo ""
read -p "Force re-deploy now? (y/N): " -n 1 -r
echo ""
if [[ $REPLY =~ ^[Yy]$ ]]; then
    if command -v vercel &> /dev/null; then
        vercel --prod
        echo -e "${GREEN}✓ Frontend deployed${NC}"
    else
        echo -e "${YELLOW}⊘ Vercel CLI not installed. Deploy will happen automatically on next git push.${NC}"
    fi
else
    echo -e "${YELLOW}⊘ Deployment skipped${NC}"
fi
echo ""

# Step 9: Verification
echo -e "${BLUE}Step 9: Verification${NC}"
echo ""
echo "Test the integration:"
echo "  1. Open: https://app-pi-one-84.vercel.app/settings"
echo "  2. Click 'Connect Google Calendar'"
echo "  3. Authorize with your Google account"
echo "  4. Verify 'Connected' status appears"
echo "  5. Click 'Sync Now'"
echo "  6. Create a recording during a calendar event"
echo "  7. Check that event info appears in recording"
echo ""

# Step 10: Monitoring
echo -e "${BLUE}Step 10: Monitoring${NC}"
echo ""
echo "Check logs for errors:"
echo -e "${GREEN}firebase functions:log --only connectGoogleCalendar${NC}"
echo -e "${GREEN}firebase functions:log --only scheduledCalendarSync${NC}"
echo ""
echo "View all logs:"
echo -e "${GREEN}firebase functions:log${NC}"
echo ""

# Done
echo "=================================="
echo -e "${GREEN}✅ Deployment Complete!${NC}"
echo "=================================="
echo ""
echo "Next steps:"
echo "  1. Test the OAuth flow"
echo "  2. Monitor logs for errors"
echo "  3. Use the calendar integration!"
echo ""
echo "Documentation:"
echo "  - Architecture: docs/CALENDAR_INTEGRATION_ARCHITECTURE.md"
echo "  - Setup Guide: docs/CALENDAR_SETUP_CHECKLIST.md"
echo "  - User Flow: docs/CALENDAR_USER_FLOW.md"
echo "  - QA Checklist: QA_CALENDAR_INTEGRATION.md"
echo "  - Status Report: CALENDAR_INTEGRATION_STATUS.md"
echo ""
echo "Need help? Check the docs or run smoke tests:"
echo -e "${GREEN}node tests/smoke-test-calendar.js${NC}"
echo ""
