#!/bin/bash

# Development Environment Startup Script
# This script starts all services needed for local development
#
# Usage:
#   ./dev-start.sh           - Start all services
#   ./dev-start.sh start     - Start all services
#   ./dev-start.sh stop      - Stop all services
#   ./dev-start.sh restart   - Restart all services
#   ./dev-start.sh status    - Check status of all services
#   ./dev-start.sh studio    - Open Prisma Studio only
#   ./dev-start.sh e2e-local - Run E2E tests using current dev environment
#   ./dev-start.sh e2e-ci    - Fresh environment setup + E2E tests (for CI)
#   ./dev-start.sh e2e-prod  - Run E2E tests against production (no local services)

set -e

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Get command (default to start)
COMMAND=${1:-start}

# Function to check if a port is listening
check_port() {
    local port=$1
    local service_name=$2
    if command -v nc &> /dev/null; then
        nc -z localhost $port 2>/dev/null
    elif command -v timeout &> /dev/null; then
        timeout 1 bash -c "echo > /dev/tcp/localhost/$port" 2>/dev/null
    else
        # Fallback: check if something is listening on the port
        netstat -tuln 2>/dev/null | grep -q ":$port " || ss -tuln 2>/dev/null | grep -q ":$port "
    fi
}

# Function to check service health
check_service_health() {
    local service=$1
    local port=$2
    local container=$3
    
    # Check if container is running
    if ! docker ps --format '{{.Names}}' | grep -q "^${container}$"; then
        echo -e "${RED}   ❌ ${service} (container not running)${NC}"
        return 1
    fi
    
    # Check if port is accessible
    if check_port $port "$service"; then
        echo -e "${GREEN}   ✅ ${service}${NC}"
        return 0
    else
        echo -e "${YELLOW}   ⚠️  ${service} (container running but port ${port} not accessible)${NC}"
        return 1
    fi
}

# Function to verify all services are healthy
verify_services() {
    echo ""
    echo -e "${BLUE}🔍 Verifying service health...${NC}"
    
    local all_healthy=true
    
    # Check Docker services
    check_service_health "Postgres" 5432 "track-rental-postgres-1" || all_healthy=false
    check_service_health "Adminer" 8081 "track-rental-adminer-1" || all_healthy=false
    check_service_health "MinIO" 9001 "track-rental-minio-1" || all_healthy=false
    check_service_health "MailHog" 8025 "track-rental-mailhog-1" || all_healthy=false
    check_service_health "WireMock" 8080 "track-rental-wiremock-1" || all_healthy=false
    
    # Check Stripe CLI - verify it's running AND connected
    if pgrep -f "stripe listen" > /dev/null; then
        # Check if Stripe CLI is actually connected by looking at logs
        if [ -f /tmp/stripe-webhook.log ]; then
            if grep -q "Ready!" /tmp/stripe-webhook.log 2>/dev/null || \
               grep -q "webhook signing secret" /tmp/stripe-webhook.log 2>/dev/null || \
               grep -q "Forwarding" /tmp/stripe-webhook.log 2>/dev/null; then
                # Check if Next.js is running (webhook endpoint needs to be accessible)
                if check_port 3000 "Next.js"; then
                    echo -e "${GREEN}   ✅ Stripe CLI (webhook forwarding - connected)${NC}"
                    echo -e "${GREEN}   ✅ Next.js (webhook endpoint accessible)${NC}"
                else
                    echo -e "${YELLOW}   ⚠️  Stripe CLI (connected but Next.js not running - webhooks will fail)${NC}"
                    echo -e "${YELLOW}   ⚠️  Next.js (not running - start with 'npm run dev')${NC}"
                    all_healthy=false
                fi
            else
                # Process exists but might not be connected yet
                if grep -qi "error\|failed\|unauthorized\|not logged" /tmp/stripe-webhook.log 2>/dev/null; then
                    echo -e "${RED}   ❌ Stripe CLI (running but has errors - check /tmp/stripe-webhook.log)${NC}"
                    all_healthy=false
                else
                    echo -e "${YELLOW}   ⚠️  Stripe CLI (running but connection status unclear)${NC}"
                    all_healthy=false
                fi
            fi
        else
            # Log file doesn't exist yet, process might have just started
            echo -e "${YELLOW}   ⚠️  Stripe CLI (running but log file not found)${NC}"
            all_healthy=false
        fi
    else
        echo -e "${RED}   ❌ Stripe CLI (not running)${NC}"
        all_healthy=false
    fi
    
    # Check Prisma Studio
    if pgrep -f "prisma studio" > /dev/null; then
        if check_port 5555 "Prisma Studio"; then
            echo -e "${GREEN}   ✅ Prisma Studio${NC}"
        else
            echo -e "${YELLOW}   ⚠️  Prisma Studio (process running but port 5555 not accessible)${NC}"
            all_healthy=false
        fi
    else
        echo -e "${RED}   ❌ Prisma Studio (not running)${NC}"
        all_healthy=false
    fi
    
    echo ""
    
    if [ "$all_healthy" = true ]; then
        echo -e "${GREEN}✅ All services are healthy!${NC}"
        return 0
    else
        echo -e "${YELLOW}⚠️  Some services are not healthy. Check the details above.${NC}"
        return 1
    fi
}

# Function to stop all services
stop_services() {
    echo -e "${YELLOW}🛑 Stopping all services...${NC}"
    
    # Stop Stripe CLI
    if pgrep -f "stripe listen" > /dev/null; then
        echo -e "${YELLOW}   Stopping Stripe CLI...${NC}"
        pkill -f "stripe listen" || true
        echo -e "${GREEN}   ✅ Stripe CLI stopped${NC}"
    fi
    
    # Stop Prisma Studio
    if pgrep -f "prisma studio" > /dev/null; then
        echo -e "${YELLOW}   Stopping Prisma Studio...${NC}"
        pkill -f "prisma studio" || true
        echo -e "${GREEN}   ✅ Prisma Studio stopped${NC}"
    fi
    
    # Stop Docker services
    if docker ps | grep -q "track-rental\|postgres\|mailhog\|minio\|wiremock"; then
        echo -e "${YELLOW}   Stopping Docker services...${NC}"
        docker-compose down
        echo -e "${GREEN}   ✅ Docker services stopped${NC}"
    fi
    
    echo -e "${GREEN}✅ All services stopped${NC}"
}

# Function to open Prisma Studio
start_prisma_studio() {
    if pgrep -f "prisma studio" > /dev/null; then
        echo -e "${GREEN}✅ Prisma Studio is already running${NC}"
        echo -e "${BLUE}   Access at: http://localhost:5555${NC}"
    else
        echo -e "${GREEN}📊 Starting Prisma Studio...${NC}"
        npx prisma studio > /tmp/prisma-studio.log 2>&1 &
        PRISMA_PID=$!
        echo -e "${GREEN}✅ Prisma Studio started (PID: $PRISMA_PID)${NC}"
        echo -e "${BLUE}   Access at: http://localhost:5555${NC}"
    fi
}

# Handle commands
case "$COMMAND" in
    stop)
        stop_services
        exit 0
        ;;
    restart)
        stop_services
        echo ""
        echo -e "${GREEN}🔄 Restarting services...${NC}"
        sleep 2
        # Continue to start services
        ;;
    status)
        echo -e "${GREEN}🔍 Checking service status...${NC}"
        verify_services
        exit 0
        ;;
    studio)
        start_prisma_studio
        exit 0
        ;;
    e2e-local)
        echo -e "${BLUE}🧪 E2E Local Test Mode${NC}"
        echo -e "${BLUE}   Using your current development environment state${NC}"
        E2E_MODE=local
        # Continue to start services and run tests
        ;;
    e2e-ci)
        echo -e "${BLUE}🧪 E2E CI Test Mode${NC}"
        echo -e "${BLUE}   Setting up fresh environment from scratch${NC}"
        E2E_MODE=ci
        # Continue to start services and run tests with fresh data
        ;;
    e2e-prod)
        echo -e "${BLUE}🧪 E2E Production Test Mode${NC}"
        echo -e "${BLUE}   Running tests against production (no local services)${NC}"
        E2E_MODE=prod
        # Skip directly to e2e prod mode - don't start any services
        ;;
    start|*)
        # Continue to start services
        ;;
esac

# ============================================
# E2E PRODUCTION TEST MODE (skip all service startup)
# ============================================
if [ "$E2E_MODE" = "prod" ]; then
    echo ""
    echo -e "${BLUE}═══════════════════════════════════════════${NC}"
    echo -e "${BLUE}🧪 E2E PRODUCTION TEST MODE${NC}"
    echo -e "${BLUE}   Running against production - no local services${NC}"
    echo -e "${BLUE}═══════════════════════════════════════════${NC}"
    echo ""
    
    # Check for required environment file
    if [ -f .env.test.local ]; then
        ENV_FILE=".env.test.local"
    elif [ -f .env.production.local ]; then
        ENV_FILE=".env.production.local"
    else
        echo -e "${RED}❌ No production test environment file found!${NC}"
        echo ""
        echo -e "${YELLOW}Create .env.test.local with production test configuration:${NC}"
        echo ""
        cat << 'EOF'
# Production E2E Test Configuration
BASE_URL=https://your-production-url.com

# Test admin user (must exist in production)
TEST_USER_EMAIL=your-test-admin@example.com
TEST_USER_PASSWORD=your-secure-password

# Test-only track ID (hidden from public, with $1 price)
TEST_TRACK_ID=your-test-track-uuid

# Real Stripe test card (for production in test mode)
# Or use a live card with minimal amount if in live mode
TEST_STRIPE_CARD_NUMBER=4242424242424242
TEST_STRIPE_CARD_EXPIRY=12/34
TEST_STRIPE_CARD_CVC=123
TEST_STRIPE_CARD_ZIP=90001
EOF
        echo ""
        exit 1
    fi
    
    echo -e "${GREEN}📄 Using environment file: ${ENV_FILE}${NC}"
    
    # Load environment variables
    set -a
    source <(grep -v '^#' "$ENV_FILE" | grep -v '^$' | grep -v '^\s*$')
    set +a
    
    # Validate required production test variables
    MISSING_VARS=false
    
    if [ -z "$BASE_URL" ]; then
        echo -e "${RED}❌ BASE_URL is required for production tests${NC}"
        MISSING_VARS=true
    fi
    
    if [ -z "$TEST_USER_EMAIL" ]; then
        echo -e "${RED}❌ TEST_USER_EMAIL is required for production tests${NC}"
        MISSING_VARS=true
    fi
    
    if [ -z "$TEST_USER_PASSWORD" ]; then
        echo -e "${RED}❌ TEST_USER_PASSWORD is required for production tests${NC}"
        MISSING_VARS=true
    fi
    
    if [ -z "$TEST_TRACK_ID" ]; then
        echo -e "${YELLOW}⚠️  TEST_TRACK_ID not set - test will pick first available track${NC}"
        echo -e "${YELLOW}   For production, you should use a hidden test-only track${NC}"
    fi
    
    if [ "$MISSING_VARS" = true ]; then
        echo ""
        echo -e "${RED}❌ Missing required environment variables. Exiting.${NC}"
        exit 1
    fi
    
    # Display test configuration
    echo ""
    echo -e "${GREEN}⚙️  Production Test Configuration:${NC}"
    echo -e "   Base URL:           ${BASE_URL}"
    echo -e "   Test User Email:    ${TEST_USER_EMAIL}"
    echo -e "   Test Track ID:      ${TEST_TRACK_ID:-<not set - will use first track>}"
    echo -e "   Test Card:          ${TEST_STRIPE_CARD_NUMBER:-4242424242424242}"
    echo ""
    
    # Verify production is reachable
    echo -e "${GREEN}🔍 Checking production connectivity...${NC}"
    if curl -s --head --fail "${BASE_URL}" > /dev/null 2>&1; then
        echo -e "${GREEN}✅ Production URL is reachable${NC}"
    else
        echo -e "${RED}❌ Cannot reach ${BASE_URL}${NC}"
        echo -e "${YELLOW}   Verify the URL is correct and accessible${NC}"
        exit 1
    fi
    
    echo ""
    echo -e "${GREEN}🚀 Running E2E tests against production...${NC}"
    echo ""
    echo -e "${BLUE}═══════════════════════════════════════════${NC}"
    echo -e "${BLUE}Starting Playwright tests...${NC}"
    echo -e "${BLUE}═══════════════════════════════════════════${NC}"
    echo ""
    
    # Run Playwright tests
    if npx playwright test; then
        echo ""
        echo -e "${GREEN}═══════════════════════════════════════════${NC}"
        echo -e "${GREEN}✅ PRODUCTION E2E TESTS PASSED!${NC}"
        echo -e "${GREEN}═══════════════════════════════════════════${NC}"
        echo ""
        exit 0
    else
        echo ""
        echo -e "${RED}═══════════════════════════════════════════${NC}"
        echo -e "${RED}❌ PRODUCTION E2E TESTS FAILED${NC}"
        echo -e "${RED}═══════════════════════════════════════════${NC}"
        echo ""
        echo -e "${YELLOW}💡 View test report with: npx playwright show-report${NC}"
        exit 1
    fi
fi

echo -e "${GREEN}🚀 Starting Track Rental Development Environment${NC}"

# Check for environment files
ENV_FILE=""
if [ "$E2E_MODE" = true ]; then
    # E2E mode: prefer .env.test.local, fallback to .env.local
    if [ -f .env.test.local ]; then
        ENV_FILE=".env.test.local"
        echo -e "${BLUE}🧪 E2E Mode: Using .env.test.local${NC}"
    elif [ -f .env.local ]; then
        ENV_FILE=".env.local"
        echo -e "${YELLOW}⚠️  E2E Mode: .env.test.local not found, using .env.local${NC}"
    elif [ -f .env ]; then
        ENV_FILE=".env"
        echo -e "${YELLOW}⚠️  E2E Mode: Using .env${NC}"
    else
        echo -e "${YELLOW}⚠️  No test environment file found!${NC}"
        echo ""
        echo -e "${YELLOW}Please create a .env.test.local file for E2E tests:${NC}"
        echo ""
        cat << 'EOF'
TEST_USER_EMAIL=test@example.com
TEST_USER_PASSWORD=testpassword123
TEST_STRIPE_CARD_NUMBER=4242424242424242
TEST_STRIPE_CARD_EXPIRY=12/34
TEST_STRIPE_CARD_CVC=123
TEST_STRIPE_CARD_ZIP=90001
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/rc_track_rental
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=your-secret-key-here
STRIPE_API_KEY=sk_test_your_stripe_secret_key_here
EOF
        echo ""
        echo -e "${YELLOW}📝 See env.test.example for a full template${NC}"
        exit 1
    fi
elif [ -f .env.local ]; then
    ENV_FILE=".env.local"
elif [ -f .env ]; then
    ENV_FILE=".env"
else
    echo -e "${YELLOW}⚠️  No .env or .env.local file found!${NC}"
    echo ""
    echo -e "${YELLOW}Please create a .env.local file with your configuration:${NC}"
    echo ""
    cat << 'EOF'
STRIPE_API_KEY=sk_test_your_stripe_secret_key_here
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/rc_track_rental
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=your-secret-key-here
EOF
    echo ""
    echo -e "${YELLOW}📝 Get your Stripe API key from: https://dashboard.stripe.com/test/apikeys${NC}"
    echo -e "${YELLOW}📝 Generate NEXTAUTH_SECRET with: openssl rand -base64 32${NC}"
    echo ""
    read -p "Press enter once you've created .env.local with your STRIPE_API_KEY..."
    
    # Check again
    if [ -f .env.local ]; then
        ENV_FILE=".env.local"
    elif [ -f .env ]; then
        ENV_FILE=".env"
    else
        echo -e "${RED}❌ Still no environment file found. Exiting.${NC}"
        exit 1
    fi
fi

echo -e "${GREEN}📄 Using environment file: ${ENV_FILE}${NC}"

# Load environment variables (safely, ignoring comments and empty lines, handling spaces)
if [ -f "$ENV_FILE" ]; then
    # Use set -a to automatically export all variables
    set -a
    # Source the file, ignoring comments and empty lines
    source <(grep -v '^#' "$ENV_FILE" | grep -v '^$' | grep -v '^\s*$')
    set +a
fi

# Check if Stripe API key is set
if [ -z "$STRIPE_API_KEY" ] || [ "$STRIPE_API_KEY" = "sk_test_your_stripe_secret_key_here" ]; then
    echo -e "${YELLOW}⚠️  STRIPE_API_KEY is not set or is using the example value${NC}"
    echo -e "${YELLOW}   Please edit ${ENV_FILE} and add your Stripe test API key${NC}"
    echo -e "${YELLOW}   Get it from: https://dashboard.stripe.com/test/apikeys${NC}"
    echo ""
    echo -e "${RED}   Cannot start Stripe CLI without API key. Exiting.${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Environment variables loaded${NC}"

# Check if Docker services are already running
if docker ps | grep -q "track-rental"; then
    echo -e "${GREEN}✅ Docker services are already running${NC}"
else
    # Start Docker services
    echo -e "${GREEN}🐳 Starting Docker services...${NC}"
    docker-compose up -d
    
    # Wait for services to be healthy
    echo -e "${GREEN}⏳ Waiting for services to be ready...${NC}"
    
    # Wait up to 30 seconds for critical services
    max_wait=30
    elapsed=0
    all_ready=false
    
    while [ $elapsed -lt $max_wait ]; do
        if check_port 5432 "Postgres" && \
           check_port 8081 "Adminer" && \
           check_port 8025 "MailHog"; then
            all_ready=true
            break
        fi
        sleep 2
        elapsed=$((elapsed + 2))
        echo -e "${YELLOW}   Still waiting... (${elapsed}s / ${max_wait}s)${NC}"
    done
    
    if [ "$all_ready" = true ]; then
        echo -e "${GREEN}✅ Core services are ready${NC}"
    else
        echo -e "${YELLOW}⚠️  Some services may still be starting up${NC}"
        echo -e "${YELLOW}   Run './dev-start.sh status' to check${NC}"
    fi
fi

# Display service URLs
echo ""
echo -e "${GREEN}📍 Service URLs:${NC}"
echo -e "   Postgres:           localhost:5432"
echo -e "   Adminer (DB UI):    http://localhost:8081"
echo -e "   MinIO Console:      http://localhost:9001"
echo -e "   MailHog UI:         http://localhost:8025"
echo -e "   WireMock:           http://localhost:8080"
echo ""

# Check if stripe CLI is installed
if ! command -v stripe &> /dev/null; then
    echo -e "${YELLOW}⚠️  Stripe CLI not found!${NC}"
    echo ""
    echo -e "${YELLOW}Install Stripe CLI:${NC}"
    echo -e "   macOS:   brew install stripe/stripe-cli/stripe"
    echo -e "   Windows: scoop bucket add stripe https://github.com/stripe/scoop-stripe-cli.git"
    echo -e "            scoop install stripe"
    echo -e "   Linux:   See https://stripe.com/docs/stripe-cli"
    echo ""
    echo -e "${RED}Cannot start Stripe webhook forwarding without CLI. Exiting.${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Stripe CLI found${NC}"

# Check if user is logged in to Stripe CLI
if ! stripe config --list &> /dev/null; then
    echo -e "${YELLOW}⚠️  Not logged in to Stripe CLI${NC}"
    echo -e "${YELLOW}   Run: stripe login${NC}"
    echo ""
    read -p "Press enter once you've run 'stripe login'..."
fi

# Start Stripe CLI webhook forwarding in background
echo ""
echo -e "${GREEN}🔗 Starting Stripe webhook forwarding...${NC}"
echo -e "${BLUE}   Forwarding: https://stripe.com → http://localhost:3000/api/webhooks/stripe${NC}"
echo ""

# Kill any existing stripe listen processes
pkill -f "stripe listen" 2>/dev/null || true
sleep 1

# Start stripe listen and capture the webhook secret
echo -e "${YELLOW}Starting Stripe CLI (this will run in the background)...${NC}"

# First, get the webhook secret using --print-secret (this starts and stops a listener)
# The --print-secret flag causes the command to print the secret and exit immediately
WEBHOOK_SECRET=$(timeout 10 stripe listen --forward-to http://localhost:3000/api/webhooks/stripe --print-secret 2>&1 | grep -o 'whsec_[a-zA-Z0-9]*' | head -1)

# Ensure any temporary process from --print-secret has exited
sleep 1

if [ -z "$WEBHOOK_SECRET" ]; then
    echo -e "${RED}❌ Could not get webhook secret from Stripe CLI${NC}"
    echo -e "${YELLOW}   Make sure you're logged in: stripe login${NC}"
    exit 1
fi

# Now start the actual listener in the background with the secret captured
nohup stripe listen --forward-to http://localhost:3000/api/webhooks/stripe > /tmp/stripe-webhook.log 2>&1 &
STRIPE_PID=$!
disown

# Wait for Stripe CLI to start and verify it's actually connected
echo -e "${YELLOW}⏳ Waiting for Stripe CLI to connect...${NC}"
max_wait=15
elapsed=0
stripe_ready=false

while [ $elapsed -lt $max_wait ]; do
    # Check if process is still running
    if ! ps -p $STRIPE_PID > /dev/null 2>&1; then
        echo -e "${RED}❌ Stripe CLI process died${NC}"
        echo -e "${YELLOW}   Check /tmp/stripe-webhook.log for errors:${NC}"
        echo ""
        cat /tmp/stripe-webhook.log
        echo ""
        exit 1
    fi
    
    # Check log for successful connection indicators
    # Stripe CLI logs "Ready!" when connected, or "Ready! Your webhook signing secret is" 
    if [ -f /tmp/stripe-webhook.log ]; then
        if grep -q "Ready!" /tmp/stripe-webhook.log 2>/dev/null || \
           grep -q "webhook signing secret" /tmp/stripe-webhook.log 2>/dev/null || \
           grep -q "Forwarding" /tmp/stripe-webhook.log 2>/dev/null; then
            stripe_ready=true
            break
        fi
        
        # Check for error indicators
        if grep -qi "error\|failed\|unauthorized\|not logged" /tmp/stripe-webhook.log 2>/dev/null; then
            echo -e "${RED}❌ Stripe CLI encountered an error${NC}"
            echo -e "${YELLOW}   Check /tmp/stripe-webhook.log:${NC}"
            echo ""
            cat /tmp/stripe-webhook.log
            echo ""
            exit 1
        fi
    fi
    
    sleep 1
    elapsed=$((elapsed + 1))
    if [ $((elapsed % 3)) -eq 0 ]; then
        echo -e "${YELLOW}   Still connecting... (${elapsed}s / ${max_wait}s)${NC}"
    fi
done

# Verify the process is actually running
if ps -p $STRIPE_PID > /dev/null 2>&1; then
    if [ "$stripe_ready" = true ]; then
        echo -e "${GREEN}✅ Stripe CLI connected and ready (PID: $STRIPE_PID)${NC}"
    else
        echo -e "${YELLOW}⚠️  Stripe CLI process running but connection status unclear${NC}"
        echo -e "${YELLOW}   Check /tmp/stripe-webhook.log to verify connection${NC}"
    fi
    echo ""
    echo -e "${GREEN}📋 Webhook Secret:${NC}"
    echo -e "${YELLOW}   $WEBHOOK_SECRET${NC}"
    echo ""
    
    # Check if webhook secret in env file matches
    if grep -q "STRIPE_WEBHOOK_SECRET=" "$ENV_FILE"; then
        ENV_SECRET=$(grep "STRIPE_WEBHOOK_SECRET=" "$ENV_FILE" | cut -d '=' -f2 | tr -d '"' | tr -d "'")
        if [ "$ENV_SECRET" = "$WEBHOOK_SECRET" ]; then
            echo -e "${GREEN}✅ Webhook secret matches environment file${NC}"
        else
            echo -e "${YELLOW}⚠️  Webhook secret mismatch!${NC}"
            echo -e "${YELLOW}   Env file has: ${ENV_SECRET:0:20}...${NC}"
            echo -e "${YELLOW}   Stripe CLI has: ${WEBHOOK_SECRET:0:20}...${NC}"
            echo -e "${YELLOW}   Updating env file...${NC}"
            sed -i.bak "s/STRIPE_WEBHOOK_SECRET=.*/STRIPE_WEBHOOK_SECRET=$WEBHOOK_SECRET/" "$ENV_FILE"
            echo -e "${GREEN}✅ Updated webhook secret in $ENV_FILE${NC}"
            echo -e "${YELLOW}   ⚠️  Restart Next.js app for changes to take effect${NC}"
        fi
    else
        echo -e "${YELLOW}💡 Adding webhook secret to $ENV_FILE...${NC}"
        echo "" >> "$ENV_FILE"
        echo "# Stripe webhook secret (from stripe CLI)" >> "$ENV_FILE"
        echo "STRIPE_WEBHOOK_SECRET=$WEBHOOK_SECRET" >> "$ENV_FILE"
        echo -e "${GREEN}✅ Added webhook secret to $ENV_FILE${NC}"
        echo -e "${YELLOW}   ⚠️  Restart Next.js app for changes to take effect${NC}"
    fi
    
    # Check if Next.js is running (webhook endpoint needs to be accessible)
    echo ""
    if check_port 3000 "Next.js"; then
        echo -e "${GREEN}✅ Next.js app is running (webhook endpoint accessible)${NC}"
    else
        echo -e "${YELLOW}⚠️  Next.js app is NOT running${NC}"
        echo -e "${YELLOW}   Webhooks will fail until you start it with 'npm run dev'${NC}"
        echo -e "${YELLOW}   Stripe CLI is ready, but webhooks can't be delivered${NC}"
    fi
else
    echo -e "${RED}❌ Stripe CLI process died immediately after starting${NC}"
    echo -e "${YELLOW}   Check /tmp/stripe-webhook.log for errors:${NC}"
    echo ""
    cat /tmp/stripe-webhook.log
    echo ""
    exit 1
fi

# Start Prisma Studio
echo ""
start_prisma_studio

echo ""
echo -e "${GREEN}🔧 Next steps:${NC}"
echo -e "   1. Run 'npm run db:push' to sync database schema (if you added confirmationSource field)"
echo -e "   2. Run 'npm run dev' to start the Next.js app"
echo -e "   3. Test a booking - webhooks will work automatically!"
echo ""
echo -e "${GREEN}📍 All Services Running:${NC}"
echo -e "   Next.js:            http://localhost:3000 (not started yet)"
echo -e "   Prisma Studio:      http://localhost:5555"
echo -e "   Adminer (DB UI):    http://localhost:8081"
echo -e "   MailHog (Email):    http://localhost:8025"
echo -e "   MinIO Console:      http://localhost:9001"
echo ""
echo -e "${YELLOW}💡 Useful commands:${NC}"
echo -e "   View Stripe events:     tail -f /tmp/stripe-webhook.log"
echo -e "   View Prisma Studio:     tail -f /tmp/prisma-studio.log"
echo -e "   Check service status:   ./dev-start.sh status"
echo -e "   Check Docker status:    docker ps --format 'table {{.Names}}\t{{.Status}}'"
echo -e "   Stop all services:      ./dev-start.sh stop"
echo -e "   Restart all services:   ./dev-start.sh restart"

# Verify all services are healthy
verify_services

# Additional webhook health check
echo ""
echo -e "${BLUE}🔍 Webhook Health Check:${NC}"
WEBHOOK_HEALTHY=true

if pgrep -f "stripe listen" > /dev/null && [ -f /tmp/stripe-webhook.log ]; then
    # Check if Next.js is running (critical for webhook delivery)
    if ! check_port 3000 "Next.js"; then
        echo -e "${RED}   ❌ CRITICAL: Next.js not running - webhooks cannot be delivered!${NC}"
        echo -e "${YELLOW}   Start Next.js with: npm run dev${NC}"
        WEBHOOK_HEALTHY=false
    else
        echo -e "${GREEN}   ✅ Next.js is running (webhook endpoint accessible)${NC}"
    fi
    
    # Check for recent webhook forwarding activity
    if grep -q "\[200\]\|\[201\]\|\[202\]" /tmp/stripe-webhook.log 2>/dev/null; then
        RECENT_EVENTS=$(grep -c "\[200\]\|\[201\]\|\[202\]" /tmp/stripe-webhook.log 2>/dev/null || echo "0")
        if [ "$RECENT_EVENTS" -gt 0 ]; then
            echo -e "${GREEN}   ✅ Recent webhook activity detected (${RECENT_EVENTS} successful deliveries)${NC}"
        fi
    fi
    
    # Check for webhook delivery failures
    if grep -qi "\[4[0-9][0-9\]\|\[5[0-9][0-9\]" /tmp/stripe-webhook.log 2>/dev/null; then
        FAILED_EVENTS=$(grep -c "\[4[0-9][0-9\]\|\[5[0-9][0-9\]" /tmp/stripe-webhook.log 2>/dev/null || echo "0")
        if [ "$FAILED_EVENTS" -gt 0 ]; then
            echo -e "${YELLOW}   ⚠️  ${FAILED_EVENTS} failed webhook delivery(ies) detected${NC}"
            echo -e "${YELLOW}   Check /tmp/stripe-webhook.log for details${NC}"
            WEBHOOK_HEALTHY=false
        fi
    fi
    
    # Check for connection refused errors (Next.js not running when webhook tried to deliver)
    if grep -qi "connection refused\|ECONNREFUSED\|Failed to forward" /tmp/stripe-webhook.log 2>/dev/null; then
        echo -e "${YELLOW}   ⚠️  Connection errors detected - Next.js may not have been running when webhooks fired${NC}"
        WEBHOOK_HEALTHY=false
    fi
else
    echo -e "${RED}   ❌ Cannot check webhook health - Stripe CLI not running or log file missing${NC}"
    WEBHOOK_HEALTHY=false
fi

if [ "$WEBHOOK_HEALTHY" = false ]; then
    echo ""
    echo -e "${RED}═══════════════════════════════════════════${NC}"
    echo -e "${RED}⚠️  WEBHOOK HEALTH CHECK FAILED${NC}"
    echo -e "${RED}═══════════════════════════════════════════${NC}"
    echo ""
    echo -e "${YELLOW}Bookings may use fallback mechanism until this is fixed:${NC}"
    echo ""
    echo -e "${YELLOW}1. Ensure Next.js is running:${NC}"
    echo -e "   ${GREEN}npm run dev${NC}"
    echo ""
    echo -e "${YELLOW}2. Verify webhook secret matches:${NC}"
    echo -e "   ${GREEN}cat $ENV_FILE | grep STRIPE_WEBHOOK_SECRET${NC}"
    echo -e "   ${GREEN}tail -5 /tmp/stripe-webhook.log | grep whsec_${NC}"
    echo ""
    echo -e "${YELLOW}3. Check webhook logs for errors:${NC}"
    echo -e "   ${GREEN}tail -20 /tmp/stripe-webhook.log${NC}"
    echo ""
    echo -e "${RED}═══════════════════════════════════════════${NC}"
fi

echo ""
echo -e "${BLUE}💡 To recheck service status at any time, run:${NC}"
echo -e "   ${GREEN}./dev-start.sh status${NC}"
echo ""

# ============================================
# E2E TEST MODE
# ============================================
if [ "$E2E_MODE" = "local" ]; then
    echo ""
    echo -e "${BLUE}═══════════════════════════════════════════${NC}"
    echo -e "${BLUE}🧪 E2E LOCAL TEST MODE${NC}"
    echo -e "${BLUE}   Using current development environment state${NC}"
    echo -e "${BLUE}═══════════════════════════════════════════${NC}"
    echo ""
    
    # Display test configuration
    echo -e "${GREEN}⚙️  Test Configuration:${NC}"
    echo -e "   Test User Email:    ${TEST_USER_EMAIL:-test@example.com}"
    echo -e "   Test Card Number:   ${TEST_STRIPE_CARD_NUMBER:-4242424242424242}"
    echo -e "   Base URL:           ${BASE_URL:-http://localhost:3000}"
    echo ""
    
    # Run Playwright tests with existing environment
    echo -e "${GREEN}🚀 Running E2E tests...${NC}"
    echo ""
    
    if npx playwright test; then
        echo ""
        echo -e "${GREEN}═══════════════════════════════════════════${NC}"
        echo -e "${GREEN}✅ E2E TESTS PASSED!${NC}"
        echo -e "${GREEN}═══════════════════════════════════════════${NC}"
        echo ""
        exit 0
    else
        echo ""
        echo -e "${RED}═══════════════════════════════════════════${NC}"
        echo -e "${RED}❌ E2E TESTS FAILED${NC}"
        echo -e "${RED}═══════════════════════════════════════════${NC}"
        echo ""
        echo -e "${YELLOW}💡 View test report with: npx playwright show-report${NC}"
        exit 1
    fi
fi

# ============================================
# E2E CI TEST MODE
# ============================================
if [ "$E2E_MODE" = "ci" ]; then
    echo ""
    echo -e "${BLUE}═══════════════════════════════════════════${NC}"
    echo -e "${BLUE}🧪 E2E CI TEST MODE${NC}"
    echo -e "${BLUE}   Setting up fresh environment from scratch${NC}"
    echo -e "${BLUE}═══════════════════════════════════════════${NC}"
    echo ""
    
    # Step 1: Ensure database schema is up to date
    echo -e "${GREEN}📊 Step 1: Resetting database...${NC}"
    if npx prisma db push --force-reset --accept-data-loss > /dev/null 2>&1; then
        echo -e "${GREEN}✅ Database reset complete${NC}"
    else
        echo -e "${RED}❌ Failed to reset database${NC}"
        exit 1
    fi
    
    echo ""
    
    # Step 2: Initialize MinIO (if available)
    if nc -z localhost 9000 2>/dev/null; then
        echo -e "${GREEN}🗄️  Step 2: Initializing MinIO bucket...${NC}"
        if npm run storage:init > /dev/null 2>&1; then
            echo -e "${GREEN}✅ MinIO bucket initialized${NC}"
        else
            echo -e "${YELLOW}⚠️  MinIO initialization failed (continuing without images)${NC}"
        fi
        echo ""
    fi
    
    # Step 3: Seed database with test data
    echo -e "${GREEN}🌱 Step 3: Seeding database with test data...${NC}"
    if npm run seed:dev; then
        echo -e "${GREEN}✅ Database seeded successfully${NC}"
    else
        echo -e "${RED}❌ Failed to seed database${NC}"
        exit 1
    fi
    
    echo ""
    
    # Step 4: Display test configuration
    echo -e "${GREEN}⚙️  Step 4: Test Configuration${NC}"
    echo -e "   Test User Email:    ${TEST_USER_EMAIL:-admin@example.com}"
    echo -e "   Test Card Number:   ${TEST_STRIPE_CARD_NUMBER:-4242424242424242}"
    echo -e "   Base URL:           ${BASE_URL:-http://localhost:3000}"
    echo -e "   Database:           ${DATABASE_URL}"
    echo ""
    
    # Step 5: Run E2E tests
    echo -e "${GREEN}🚀 Step 5: Running E2E tests...${NC}"
    echo ""
    echo -e "${BLUE}═══════════════════════════════════════════${NC}"
    echo -e "${BLUE}Starting Playwright tests...${NC}"
    echo -e "${BLUE}═══════════════════════════════════════════${NC}"
    echo ""
    
    # Run Playwright tests
    if npx playwright test; then
        echo ""
        echo -e "${GREEN}═══════════════════════════════════════════${NC}"
        echo -e "${GREEN}✅ E2E TESTS PASSED!${NC}"
        echo -e "${GREEN}═══════════════════════════════════════════${NC}"
        echo ""
        exit 0
    else
        echo ""
        echo -e "${RED}═══════════════════════════════════════════${NC}"
        echo -e "${RED}❌ E2E TESTS FAILED${NC}"
        echo -e "${RED}═══════════════════════════════════════════${NC}"
        echo ""
        echo -e "${YELLOW}💡 View test report with: npx playwright show-report${NC}"
        exit 1
    fi
fi

