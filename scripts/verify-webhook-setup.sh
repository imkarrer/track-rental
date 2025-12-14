#!/bin/bash

# Webhook Setup Verification Script
# This script checks if your webhook configuration is correct

set -e

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${GREEN}🔍 Verifying Stripe Webhook Setup${NC}"
echo ""

# 1. Check if .env.local exists
if [ ! -f .env.local ]; then
    echo -e "${RED}❌ .env.local file not found${NC}"
    echo -e "   Create .env.local with your configuration"
    exit 1
fi

echo -e "${GREEN}✅ .env.local file exists${NC}"

# 2. Check for STRIPE_API_KEY
if ! grep -q "STRIPE_API_KEY=sk_test_" .env.local; then
    echo -e "${YELLOW}⚠️  STRIPE_API_KEY not found or not a test key${NC}"
    echo -e "   Add to .env.local: STRIPE_API_KEY=sk_test_your_key_here"
    echo -e "   Get from: https://dashboard.stripe.com/test/apikeys"
    STRIPE_KEY_OK=false
else
    echo -e "${GREEN}✅ STRIPE_API_KEY is configured${NC}"
    STRIPE_KEY_OK=true
fi

# 3. Check if stripe-cli is running
if docker ps | grep -q stripe-cli; then
    echo -e "${GREEN}✅ stripe-cli container is running${NC}"
    
    # 4. Get webhook secret from logs
    WEBHOOK_SECRET=$(docker-compose logs stripe-cli 2>/dev/null | grep -o 'whsec_[a-zA-Z0-9]*' | head -1)
    
    if [ -z "$WEBHOOK_SECRET" ]; then
        echo -e "${YELLOW}⚠️  Could not find webhook secret in logs${NC}"
        echo -e "   Run: docker-compose logs stripe-cli | grep whsec_"
    else
        echo -e "${GREEN}✅ Webhook secret found: ${WEBHOOK_SECRET:0:20}...${NC}"
        
        # 5. Check if secret is in .env.local
        if grep -q "STRIPE_WEBHOOK_SECRET=$WEBHOOK_SECRET" .env.local; then
            echo -e "${GREEN}✅ Webhook secret matches .env.local${NC}"
        else
            echo -e "${YELLOW}⚠️  Webhook secret in .env.local doesn't match${NC}"
            echo -e "   Update .env.local with:"
            echo -e "   STRIPE_WEBHOOK_SECRET=$WEBHOOK_SECRET"
            echo ""
            echo -e "${YELLOW}   After updating, restart your Next.js app:${NC}"
            echo -e "   npm run dev"
        fi
    fi
else
    echo -e "${RED}❌ stripe-cli container is not running${NC}"
    echo -e "   Start it with: docker-compose up -d stripe-cli"
    echo ""
    
    if [ "$STRIPE_KEY_OK" = false ]; then
        echo -e "${YELLOW}💡 Tip: Add STRIPE_API_KEY first, then start stripe-cli${NC}"
    fi
fi

# 6. Check if Next.js app is running
if curl -s http://localhost:3000 > /dev/null 2>&1; then
    echo -e "${GREEN}✅ Next.js app is running${NC}"
else
    echo -e "${YELLOW}⚠️  Next.js app is not running${NC}"
    echo -e "   Start it with: npm run dev"
fi

# 7. Check database connection
if docker ps | grep -q postgres; then
    echo -e "${GREEN}✅ PostgreSQL is running${NC}"
else
    echo -e "${RED}❌ PostgreSQL is not running${NC}"
    echo -e "   Start it with: docker-compose up -d postgres"
fi

echo ""
echo -e "${GREEN}📋 Summary${NC}"
echo ""

if [ "$STRIPE_KEY_OK" = true ] && docker ps | grep -q stripe-cli; then
    echo -e "${GREEN}✅ Webhooks should be working!${NC}"
    echo ""
    echo -e "Test by:"
    echo -e "1. Creating a booking at http://localhost:3000/tracks"
    echo -e "2. Use test card: 4242 4242 4242 4242"
    echo -e "3. Watch your terminal for: POST /api/webhooks/stripe 200"
    echo -e "4. Check 'My Bookings' page for the new booking"
else
    echo -e "${YELLOW}⚠️  Webhook setup needs attention${NC}"
    echo ""
    echo -e "Follow these steps:"
    echo -e "1. Add STRIPE_API_KEY to .env.local (get from Stripe dashboard)"
    echo -e "2. Run: docker-compose up -d"
    echo -e "3. Run: docker-compose logs stripe-cli | grep whsec_"
    echo -e "4. Add STRIPE_WEBHOOK_SECRET to .env.local"
    echo -e "5. Restart Next.js: npm run dev"
    echo ""
    echo -e "Don't worry! The fallback mechanism will still create bookings"
    echo -e "even if webhooks aren't working."
fi

echo ""
