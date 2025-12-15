#!/bin/bash

# Development Data Seeding Helper Script
# 
# This script helps you seed your local development environment with test data.
# It provides various options for different scenarios.

set -e

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m'

# Function to display help
show_help() {
    echo -e "${GREEN}Development Data Seeding Helper${NC}"
    echo ""
    echo "Usage: ./seed.sh [command]"
    echo ""
    echo "Commands:"
    echo "  seed          Seed development data (default)"
    echo "  reset         Reset database and seed fresh data"
    echo "  init          Initialize MinIO bucket"
    echo "  full          Full setup: init MinIO + reset DB + seed data"
    echo "  status        Check database and MinIO status"
    echo "  clean         Clean all data (database + MinIO)"
    echo "  help          Show this help message"
    echo ""
    echo "Examples:"
    echo "  ./seed.sh              # Seed data (skip existing)"
    echo "  ./seed.sh reset        # Reset DB and seed fresh data"
    echo "  ./seed.sh full         # Full clean setup"
    echo ""
}

# Function to check if services are running
check_services() {
    echo -e "${BLUE}🔍 Checking services...${NC}"
    
    local all_ok=true
    
    # Check PostgreSQL
    if nc -z localhost 5432 2>/dev/null; then
        echo -e "${GREEN}   ✅ PostgreSQL is running${NC}"
    else
        echo -e "${RED}   ❌ PostgreSQL is not running${NC}"
        all_ok=false
    fi
    
    # Check MinIO
    if nc -z localhost 9000 2>/dev/null; then
        echo -e "${GREEN}   ✅ MinIO is running${NC}"
    else
        echo -e "${RED}   ❌ MinIO is not running${NC}"
        all_ok=false
    fi
    
    echo ""
    
    if [ "$all_ok" = false ]; then
        echo -e "${YELLOW}⚠️  Some services are not running${NC}"
        echo -e "${YELLOW}   Run: ./dev-start.sh${NC}"
        echo ""
        return 1
    fi
    
    return 0
}

# Function to check database connection
check_database() {
    echo -e "${BLUE}🗄️  Checking database connection...${NC}"
    
    if npx prisma db execute --stdin <<< "SELECT 1;" > /dev/null 2>&1; then
        echo -e "${GREEN}   ✅ Database connection OK${NC}"
        
        # Count records
        local user_count=$(psql "${DATABASE_URL}" -t -c "SELECT COUNT(*) FROM users;" 2>/dev/null || echo "0")
        local track_count=$(psql "${DATABASE_URL}" -t -c "SELECT COUNT(*) FROM tracks;" 2>/dev/null || echo "0")
        local car_count=$(psql "${DATABASE_URL}" -t -c "SELECT COUNT(*) FROM cars;" 2>/dev/null || echo "0")
        
        echo -e "${BLUE}   📊 Current data:${NC}"
        echo -e "      Users:  ${user_count}"
        echo -e "      Tracks: ${track_count}"
        echo -e "      Cars:   ${car_count}"
        echo ""
        return 0
    else
        echo -e "${RED}   ❌ Cannot connect to database${NC}"
        echo ""
        return 1
    fi
}

# Function to initialize MinIO
init_minio() {
    echo -e "${GREEN}🗄️  Initializing MinIO bucket...${NC}"
    npm run storage:init
    echo ""
}

# Function to seed data
seed_data() {
    echo -e "${GREEN}🌱 Seeding development data...${NC}"
    npm run seed:dev
    echo ""
}

# Function to reset database
reset_database() {
    echo -e "${YELLOW}⚠️  This will DELETE ALL DATA in the database!${NC}"
    read -p "Are you sure? (yes/no): " confirm
    
    if [ "$confirm" != "yes" ]; then
        echo -e "${BLUE}Cancelled.${NC}"
        exit 0
    fi
    
    echo ""
    echo -e "${YELLOW}🔄 Resetting database...${NC}"
    npx prisma db push --force-reset
    echo -e "${GREEN}   ✅ Database reset complete${NC}"
    echo ""
}

# Function to clean all data
clean_all() {
    echo -e "${RED}⚠️  WARNING: This will DELETE ALL DATA!${NC}"
    echo -e "${RED}   - Database will be wiped${NC}"
    echo -e "${RED}   - MinIO volumes will be removed${NC}"
    echo ""
    read -p "Are you sure? Type 'DELETE' to confirm: " confirm
    
    if [ "$confirm" != "DELETE" ]; then
        echo -e "${BLUE}Cancelled.${NC}"
        exit 0
    fi
    
    echo ""
    echo -e "${YELLOW}🧹 Cleaning all data...${NC}"
    
    # Stop services
    echo -e "${YELLOW}   Stopping services...${NC}"
    docker-compose down -v
    
    echo -e "${GREEN}   ✅ All data cleaned${NC}"
    echo ""
    echo -e "${BLUE}💡 Restart services with: ./dev-start.sh${NC}"
    echo ""
}

# Function to show status
show_status() {
    check_services || true
    check_database || true
}

# Load environment variables
if [ -f .env.local ]; then
    set -a
    source <(grep -v '^#' .env.local | grep -v '^$')
    set +a
elif [ -f .env ]; then
    set -a
    source <(grep -v '^#' .env | grep -v '^$')
    set +a
fi

# Get command
COMMAND=${1:-seed}

case "$COMMAND" in
    seed)
        echo -e "${GREEN}═══════════════════════════════════════════${NC}"
        echo -e "${GREEN}🌱 Development Data Seeding${NC}"
        echo -e "${GREEN}═══════════════════════════════════════════${NC}"
        echo ""
        
        if ! check_services; then
            exit 1
        fi
        
        seed_data
        
        echo -e "${GREEN}═══════════════════════════════════════════${NC}"
        echo -e "${GREEN}✅ Seeding Complete!${NC}"
        echo -e "${GREEN}═══════════════════════════════════════════${NC}"
        echo ""
        echo -e "${BLUE}🔗 Quick Links:${NC}"
        echo -e "   App:           http://localhost:3000"
        echo -e "   Prisma Studio: http://localhost:5555 (or run: npm run db:studio)"
        echo -e "   MinIO Console: http://localhost:9001"
        echo ""
        ;;
        
    reset)
        echo -e "${GREEN}═══════════════════════════════════════════${NC}"
        echo -e "${GREEN}🔄 Reset Database & Seed Fresh Data${NC}"
        echo -e "${GREEN}═══════════════════════════════════════════${NC}"
        echo ""
        
        if ! check_services; then
            exit 1
        fi
        
        reset_database
        seed_data
        
        echo -e "${GREEN}═══════════════════════════════════════════${NC}"
        echo -e "${GREEN}✅ Reset & Seeding Complete!${NC}"
        echo -e "${GREEN}═══════════════════════════════════════════${NC}"
        echo ""
        ;;
        
    init)
        echo -e "${GREEN}═══════════════════════════════════════════${NC}"
        echo -e "${GREEN}🗄️  Initialize MinIO${NC}"
        echo -e "${GREEN}═══════════════════════════════════════════${NC}"
        echo ""
        
        if ! check_services; then
            exit 1
        fi
        
        init_minio
        
        echo -e "${GREEN}✅ MinIO initialized!${NC}"
        echo ""
        ;;
        
    full)
        echo -e "${GREEN}═══════════════════════════════════════════${NC}"
        echo -e "${GREEN}🚀 Full Setup (MinIO + DB + Seed)${NC}"
        echo -e "${GREEN}═══════════════════════════════════════════${NC}"
        echo ""
        
        if ! check_services; then
            exit 1
        fi
        
        init_minio
        reset_database
        seed_data
        
        echo -e "${GREEN}═══════════════════════════════════════════${NC}"
        echo -e "${GREEN}✅ Full Setup Complete!${NC}"
        echo -e "${GREEN}═══════════════════════════════════════════${NC}"
        echo ""
        echo -e "${BLUE}🔗 Quick Links:${NC}"
        echo -e "   App:           http://localhost:3000"
        echo -e "   Prisma Studio: http://localhost:5555"
        echo -e "   MinIO Console: http://localhost:9001"
        echo ""
        echo -e "${BLUE}🔐 Test Credentials:${NC}"
        echo -e "   Admin:  admin@example.com / admin123"
        echo -e "   User:   john.doe@example.com / password123"
        echo ""
        ;;
        
    status)
        show_status
        ;;
        
    clean)
        clean_all
        ;;
        
    help|--help|-h)
        show_help
        ;;
        
    *)
        echo -e "${RED}❌ Unknown command: $COMMAND${NC}"
        echo ""
        show_help
        exit 1
        ;;
esac
