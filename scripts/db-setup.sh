#!/bin/bash

set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${YELLOW}Setting up development database...${NC}"

if [ -f ".env" ]; then
  set -a
  # shellcheck disable=SC1091
  source ".env"
  set +a
fi

if [ -z "${DATABASE_URL:-}" ]; then
  echo -e "${RED}Error: DATABASE_URL is not set${NC}"
  echo "Set DATABASE_URL in .env before running this command."
  exit 1
fi

DB_NAME=$(printf '%s' "$DATABASE_URL" | sed 's/[?#].*$//' | sed 's/.*\///')

if [ -z "$DB_NAME" ]; then
  echo -e "${RED}Error: Could not parse database name from DATABASE_URL${NC}"
  exit 1
fi

if [[ ! "$DB_NAME" =~ ^[A-Za-z0-9_]+$ ]]; then
  echo -e "${RED}Error: Database name '${DB_NAME}' is not supported by this setup script${NC}"
  echo "Use letters, numbers, and underscores, or create the database manually before running db:setup."
  exit 1
fi

if [ -n "${POSTGRES_CONTAINER:-}" ]; then
  echo -e "${YELLOW}Ensuring database '${DB_NAME}' exists in Docker container '${POSTGRES_CONTAINER}'...${NC}"
  docker exec "$POSTGRES_CONTAINER" psql -U "${POSTGRES_USER:-postgres}" -d postgres -tAc "SELECT 1 FROM pg_database WHERE datname='${DB_NAME}'" | grep -q 1 ||
    docker exec "$POSTGRES_CONTAINER" createdb -U "${POSTGRES_USER:-postgres}" "$DB_NAME"
elif command -v psql >/dev/null 2>&1; then
  DB_BASE=$(printf '%s' "$DATABASE_URL" | sed 's/[?#].*$//' | sed 's/\/[^\/]*$//')
  POSTGRES_URL="${DB_BASE}/postgres"

  echo -e "${YELLOW}Ensuring database '${DB_NAME}' exists...${NC}"
  psql "$POSTGRES_URL" -tAc "SELECT 1 FROM pg_database WHERE datname='${DB_NAME}'" | grep -q 1 ||
    psql "$POSTGRES_URL" -c "CREATE DATABASE ${DB_NAME}"
else
  echo -e "${YELLOW}Skipping database creation check because psql is not installed.${NC}"
  echo "Create '${DB_NAME}' first, or set POSTGRES_CONTAINER to use Docker for database creation."
fi

echo -e "${YELLOW}Applying database schema...${NC}"
bun run db:push

echo -e "${YELLOW}Seeding database...${NC}"
bun run db:seed

echo -e "${GREEN}Development database setup complete.${NC}"
