#!/bin/bash
# Sprint 005 - TASK-003
# Test Database Setup Script
# AC-0.10: `bun run db:test:setup` creates and seeds test database

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${YELLOW}Setting up test database...${NC}"

# Check for DATABASE_URL_TEST environment variable
if [ -z "$DATABASE_URL_TEST" ]; then
    echo -e "${RED}Error: DATABASE_URL_TEST environment variable is not set${NC}"
    echo "Please set DATABASE_URL_TEST in your .env file or environment"
    echo "Example: DATABASE_URL_TEST=postgresql://postgres:postgres@localhost:5433/divvy_jones_test"
    exit 1
fi

# Parse database URL to extract components
# Format: postgresql://user:password@host:port/database
DB_URL="$DATABASE_URL_TEST"

# Extract database name (everything after the last /)
DB_NAME=$(echo "$DB_URL" | sed 's/.*\///')

# Extract connection string without database name
DB_BASE=$(echo "$DB_URL" | sed 's/\/[^\/]*$//')

# Connect to postgres database to create the test database
POSTGRES_URL="${DB_BASE}/postgres"

echo -e "${YELLOW}Checking if database '${DB_NAME}' exists...${NC}"

# Check if database exists, create if not
DB_EXISTS=$(psql "$POSTGRES_URL" -tAc "SELECT 1 FROM pg_database WHERE datname='$DB_NAME'" 2>/dev/null || echo "0")

if [ "$DB_EXISTS" = "1" ]; then
    echo -e "${GREEN}Database '${DB_NAME}' already exists${NC}"
else
    echo -e "${YELLOW}Creating database '${DB_NAME}'...${NC}"
    psql "$POSTGRES_URL" -c "CREATE DATABASE $DB_NAME" 2>/dev/null || {
        echo -e "${RED}Failed to create database. Make sure PostgreSQL is running and credentials are correct.${NC}"
        exit 1
    }
    echo -e "${GREEN}Database '${DB_NAME}' created successfully${NC}"
fi

# Run migrations using drizzle-kit
echo -e "${YELLOW}Running migrations...${NC}"
DATABASE_URL="$DATABASE_URL_TEST" bun run db:migrate || {
    echo -e "${RED}Migration failed${NC}"
    exit 1
}
echo -e "${GREEN}Migrations completed successfully${NC}"

# Optional: Run seed script if it exists
if [ -f "src/db/seed.ts" ]; then
    echo -e "${YELLOW}Do you want to seed the test database? (y/n)${NC}"
    read -r response
    if [ "$response" = "y" ] || [ "$response" = "Y" ]; then
        echo -e "${YELLOW}Seeding database...${NC}"
        DATABASE_URL="$DATABASE_URL_TEST" bun run src/db/seed.ts || {
            echo -e "${RED}Seeding failed${NC}"
            exit 1
        }
        echo -e "${GREEN}Database seeded successfully${NC}"
    fi
fi

echo -e "${GREEN}Test database setup complete!${NC}"
echo ""
echo "To run tests with this database:"
echo "  DATABASE_URL_TEST=$DATABASE_URL_TEST bun test"
echo ""
echo "Or set DATABASE_URL_TEST in your .env file"
