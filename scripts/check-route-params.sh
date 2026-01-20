#!/bin/bash
# Sprint 005 - TASK-004
# Route Parameter Naming Convention Checker
# AC-0.12: Pre-commit hook validates route parameter naming conventions
#
# Convention: All route parameters should use :entityId format
# Examples:
#   Good: :groupId, :userId, :expenseId, :settlementId
#   Bad:  :group_id, :id, :groupid, :group-id

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

ROUTES_DIR="src/routes"
ERRORS=0

echo "Checking route parameter naming conventions in $ROUTES_DIR..."

# Find all .ts files in routes directory
ROUTE_FILES=$(find "$ROUTES_DIR" -name "*.ts" 2>/dev/null || true)

if [ -z "$ROUTE_FILES" ]; then
  echo -e "${YELLOW}Warning: No route files found in $ROUTES_DIR${NC}"
  exit 0
fi

# Regex patterns for route parameters
# Good pattern: :camelCaseId (e.g., :groupId, :userId, :expenseId)
GOOD_PATTERN=':[a-z]+[A-Z][a-z]*Id'

# Bad patterns to detect
# :snake_case_id
SNAKE_CASE_PATTERN=':[a-z]+_[a-z]+(_[a-z]+)*'
# :kebab-case-id
KEBAB_CASE_PATTERN=':[a-z]+-[a-z]+(-[a-z]+)*'
# :id (too generic)
GENERIC_ID_PATTERN='"\/:id"'
# :lowercase without proper Id suffix
LOWERCASE_NO_SUFFIX=':[a-z]+id[^A-Z]'

for file in $ROUTE_FILES; do
  # Skip test files
  if [[ "$file" == *".test.ts" ]] || [[ "$file" == *".spec.ts" ]]; then
    continue
  fi

  # Check for snake_case parameters
  SNAKE_MATCHES=$(grep -nE "$SNAKE_CASE_PATTERN" "$file" 2>/dev/null || true)
  if [ -n "$SNAKE_MATCHES" ]; then
    echo -e "${RED}Error in $file:${NC}"
    echo "$SNAKE_MATCHES" | while read -r line; do
      echo -e "  ${YELLOW}Found snake_case parameter:${NC} $line"
    done
    echo -e "  ${GREEN}Convention: Use camelCase (e.g., :groupId, :userId)${NC}"
    ERRORS=$((ERRORS + 1))
  fi

  # Check for kebab-case parameters
  KEBAB_MATCHES=$(grep -nE "$KEBAB_CASE_PATTERN" "$file" 2>/dev/null || true)
  if [ -n "$KEBAB_MATCHES" ]; then
    echo -e "${RED}Error in $file:${NC}"
    echo "$KEBAB_MATCHES" | while read -r line; do
      echo -e "  ${YELLOW}Found kebab-case parameter:${NC} $line"
    done
    echo -e "  ${GREEN}Convention: Use camelCase (e.g., :groupId, :userId)${NC}"
    ERRORS=$((ERRORS + 1))
  fi

  # Check for generic :id parameter (but allow /:id in context)
  GENERIC_MATCHES=$(grep -nE '"\/:id"' "$file" 2>/dev/null || true)
  if [ -n "$GENERIC_MATCHES" ]; then
    echo -e "${YELLOW}Warning in $file:${NC}"
    echo "$GENERIC_MATCHES" | while read -r line; do
      echo -e "  ${YELLOW}Found generic :id parameter:${NC} $line"
    done
    echo -e "  ${GREEN}Consider: Use specific names (e.g., :expenseId, :settlementId)${NC}"
    # This is a warning, not an error
  fi
done

if [ $ERRORS -gt 0 ]; then
  echo -e "\n${RED}Found $ERRORS route parameter naming violation(s).${NC}"
  echo -e "${GREEN}Please use camelCase with 'Id' suffix (e.g., :groupId, :userId, :expenseId)${NC}"
  exit 1
fi

echo -e "${GREEN}All route parameters follow naming conventions.${NC}"
exit 0
