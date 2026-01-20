#!/bin/bash
# Sprint 005 - TASK-003
# Test Database Reset Script
# AC-0.11: `bun run db:test:reset` drops and recreates test database

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${YELLOW}Resetting test database...${NC}"

# Check for DATABASE_URL_TEST environment variable
if [ -z "$DATABASE_URL_TEST" ]; then
    echo -e "${RED}Error: DATABASE_URL_TEST environment variable is not set${NC}"
    echo "Please set DATABASE_URL_TEST in your .env file or environment"
    echo "Example: DATABASE_URL_TEST=postgresql://postgres:postgres@localhost:5433/divvy_jones_test"
    exit 1
fi

# Parse database URL to extract components
DB_URL="$DATABASE_URL_TEST"

# Extract database name (everything after the last /)
DB_NAME=$(echo "$DB_URL" | sed 's/.*\///')

# Extract connection string without database name
DB_BASE=$(echo "$DB_URL" | sed 's/\/[^\/]*$//')

# Connect to postgres database for admin operations
POSTGRES_URL="${DB_BASE}/postgres"

# Safety check - don't allow resetting production databases
if [[ "$DB_NAME" != *"test"* ]] && [[ "$DB_NAME" != *"_test"* ]]; then
    echo -e "${RED}Error: Database name '$DB_NAME' does not contain 'test'${NC}"
    echo "This script is only for test databases. Aborting for safety."
    exit 1
fi

echo -e "${YELLOW}Dropping database '${DB_NAME}' if it exists...${NC}"

# Terminate all connections to the database
psql "$POSTGRES_URL" -c "
    SELECT pg_terminate_backend(pg_stat_activity.pid)
    FROM pg_stat_activity
    WHERE pg_stat_activity.datname = '$DB_NAME'
    AND pid <> pg_backend_pid();
" 2>/dev/null || true

# Drop the database
psql "$POSTGRES_URL" -c "DROP DATABASE IF EXISTS $DB_NAME" 2>/dev/null || {
    echo -e "${RED}Failed to drop database. Make sure no connections are active.${NC}"
    exit 1
}
echo -e "${GREEN}Database dropped${NC}"

# Create fresh database
echo -e "${YELLOW}Creating fresh database '${DB_NAME}'...${NC}"
psql "$POSTGRES_URL" -c "CREATE DATABASE $DB_NAME" 2>/dev/null || {
    echo -e "${RED}Failed to create database${NC}"
    exit 1
}
echo -e "${GREEN}Database created${NC}"

# Run migrations
echo -e "${YELLOW}Running migrations...${NC}"
DATABASE_URL="$DATABASE_URL_TEST" bun run db:migrate || {
    echo -e "${RED}Migration failed${NC}"
    exit 1
}
echo -e "${GREEN}Migrations completed${NC}"

echo -e "${GREEN}Test database reset complete!${NC}"
echo ""
echo "Database '${DB_NAME}' has been recreated with fresh schema."
