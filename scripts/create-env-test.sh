#!/bin/bash

# Script to create .env.test.local from template
# This creates a test environment file for E2E testing

echo "Creating .env.test.local for E2E testing..."

cat > .env.test.local << 'EOF'
# E2E Test Environment Variables
# This file is used for local E2E testing

# Test User Credentials
TEST_USER_EMAIL=test@example.com
TEST_USER_PASSWORD=testpassword123
TEST_USER_FIRST_NAME=Test
TEST_USER_LAST_NAME=Admin

# Stripe Test Card (official Stripe test cards)
TEST_STRIPE_CARD_NUMBER=4242424242424242
TEST_STRIPE_CARD_EXPIRY=12/34
TEST_STRIPE_CARD_CVC=123
TEST_STRIPE_CARD_ZIP=90001

# Base URL
BASE_URL=http://localhost:3000

# Database (for E2E tests)
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/rc_track_rental

# NextAuth Configuration (CRITICAL: must be http:// for localhost!)
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=test-secret-key-for-e2e-only-not-for-production

# Next.js Public App URL
NEXT_PUBLIC_APP_URL=http://localhost:3000

# Stripe Configuration
# Copy your Stripe test API key from .env.local or get from https://dashboard.stripe.com/test/apikeys
STRIPE_API_KEY=sk_test_REPLACE_WITH_YOUR_ACTUAL_STRIPE_KEY
STRIPE_WEBHOOK_SECRET=whsec_will_be_auto_populated

# Use Mock Services for Testing
USE_STRIPE_MOCK=true
USE_GOOGLE_MAPS_MOCK=true
USE_EMAIL_MOCK=true
EOF

echo ""
echo "✅ Created .env.test.local"
echo ""
echo "⚠️  IMPORTANT: You need to update the following values:"
echo "   1. STRIPE_API_KEY - Copy from your .env.local file"
echo "   2. NEXTAUTH_SECRET - Generate with: openssl rand -base64 32"
echo ""
echo "If using mocks (recommended for E2E), the mocks are already enabled."
echo "If you want to test with real Stripe, set USE_STRIPE_MOCK=false and add your real key."
echo ""
