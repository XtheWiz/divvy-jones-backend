# Contributing to Divvy-Jones

This document outlines the coding standards, naming conventions, and development workflow for the Divvy-Jones project.

## Table of Contents

1. [Development Setup](#development-setup)
2. [Code Style Guidelines](#code-style-guidelines)
3. [Naming Conventions](#naming-conventions)
4. [Project Structure](#project-structure)
5. [Git Workflow](#git-workflow)
6. [Testing Guidelines](#testing-guidelines)
7. [Code Review Checklist](#code-review-checklist)

---

## Development Setup

### Prerequisites

- [Bun](https://bun.sh/) v1.0 or later
- PostgreSQL 16 or later
- Node.js 20+ (for some tooling)

### Installation

```bash
# Clone the repository
git clone <repository-url>
cd divvy-jones

# Install dependencies
bun install

# Set up environment variables
cp .env.example .env
# Edit .env with your database credentials

# Run database migrations
bun run db:push

# Seed enum tables
bun run db:seed

# Start development server
bun run dev
```

### Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `DATABASE_URL` | PostgreSQL connection string | Yes |
| `DATABASE_URL_TEST` | Test database connection string | For tests |
| `JWT_SECRET` | Secret key for JWT signing | Yes |
| `PORT` | Server port (default: 3000) | No |

---

## Code Style Guidelines

### TypeScript

- Use TypeScript for all source files
- Enable strict mode in `tsconfig.json`
- Prefer `const` over `let` where possible
- Use explicit return types for functions
- Avoid `any` type; use `unknown` if type is truly unknown

### Formatting

- Use 2 spaces for indentation
- Maximum line length: 100 characters
- Use trailing commas in multi-line arrays/objects
- Use semicolons at end of statements

### Imports

Order imports in the following groups, separated by blank lines:

1. External packages (e.g., `drizzle-orm`, `elysia`)
2. Internal modules from `../` paths
3. Internal modules from `./` paths
4. Type imports

```typescript
// Good
import { eq, and } from "drizzle-orm";
import { Elysia, t } from "elysia";

import { db, users } from "../db";
import { success, error } from "../lib/responses";

import { validateAmount } from "./validation";

import type { User } from "../db";
```

---

## Naming Conventions

### Route Parameters

**IMPORTANT**: All route parameters must use the `:{entity}Id` format.

| Correct | Incorrect |
|---------|-----------|
| `:groupId` | `:id`, `:group_id`, `:gid` |
| `:expenseId` | `:id`, `:expense_id`, `:eid` |
| `:settlementId` | `:id`, `:settlement_id`, `:sid` |
| `:attachmentId` | `:id`, `:attachment_id`, `:aid` |
| `:userId` | `:id`, `:user_id`, `:uid` |

```typescript
// Good
.get("/:groupId/expenses/:expenseId", handler)

// Bad
.get("/:id/expenses/:expenseId", handler)  // Ambiguous
.get("/:group_id/expenses/:expense_id", handler)  // Snake case
```

### Files and Directories

| Type | Convention | Example |
|------|------------|---------|
| Service files | `{entity}.service.ts` | `expense.service.ts` |
| Route files | `{entity}.ts` or `{entity}s.ts` | `expenses.ts` |
| Test files | `{name}.test.ts` | `expense.service.test.ts` |
| Integration tests | `{name}.integration.test.ts` | `settlements.integration.test.ts` |
| Library files | `{name}.ts` | `responses.ts`, `storage.ts` |

### Functions

| Type | Convention | Example |
|------|------------|---------|
| Service functions | camelCase, verb-first | `createExpense`, `listSettlements` |
| Validation | `validate{Field}` | `validateAmount`, `validateCurrency` |
| Check/query | `is{Condition}`, `has{Thing}`, `can{Action}` | `isMember`, `hasSettlements`, `canModify` |
| Getters | `get{Thing}`, `find{Thing}` | `getExpenseDetails`, `findGroupById` |

### Database

| Type | Convention | Example |
|------|------------|---------|
| Table names | snake_case, plural | `expenses`, `group_members`, `activity_log` |
| Column names | snake_case | `created_at`, `user_id`, `currency_code` |
| Enum types | SCREAMING_SNAKE_CASE | `EXPENSE_CATEGORIES`, `SETTLEMENT_STATUSES` |

---

## Project Structure

```
src/
├── db/                  # Database schema and connection
│   ├── index.ts         # Main exports
│   ├── schema.ts        # Drizzle schema definitions
│   └── seed.ts          # Database seeding script
├── lib/                 # Shared utilities
│   ├── responses.ts     # API response helpers
│   └── storage.ts       # File storage abstraction
├── middleware/          # Elysia middleware
│   └── auth.ts          # Authentication middleware
├── routes/              # API route handlers
│   ├── index.ts         # Route registration
│   ├── auth.ts          # Authentication routes
│   ├── groups.ts        # Group routes
│   ├── expenses.ts      # Expense routes
│   ├── settlements.ts   # Settlement routes
│   └── attachments.ts   # Attachment routes
├── services/            # Business logic layer
│   ├── index.ts         # Service exports
│   ├── expense.service.ts
│   ├── settlement.service.ts
│   ├── group.service.ts
│   └── activity.service.ts
├── __tests__/           # Test files
│   ├── *.test.ts        # Unit tests
│   └── integration/     # Integration tests
└── index.ts             # Application entry point
```

### Layer Responsibilities

| Layer | Responsibility |
|-------|----------------|
| **Routes** | HTTP handling, request validation, response formatting |
| **Services** | Business logic, database queries, authorization checks |
| **Lib** | Shared utilities, helpers, abstractions |
| **Middleware** | Cross-cutting concerns (auth, logging, rate limiting) |

---

## Git Workflow

### Branch Naming

| Branch Type | Format | Example |
|-------------|--------|---------|
| Feature | `sprint-{N}/TASK-{N}-{description}` | `sprint-004/TASK-007-expense-attachments` |
| Bug fix | `fix/{description}` | `fix/settlement-amount-validation` |
| Hotfix | `hotfix/{description}` | `hotfix/auth-token-expiry` |

### Commit Messages

Use conventional commit format:

```
<type>(<scope>): <description>

[optional body]

[optional footer]
```

**Types:**
- `feat`: New feature
- `fix`: Bug fix
- `refactor`: Code refactoring
- `test`: Adding or updating tests
- `docs`: Documentation changes
- `chore`: Maintenance tasks

**Examples:**

```
feat(expenses): add attachment upload endpoint

- Implement POST /groups/:groupId/expenses/:expenseId/attachments
- Add file size and MIME type validation
- Enforce 5 attachment limit per expense

Closes TASK-007
```

```
fix(settlements): correct amount validation for decimals

Amounts with exactly 2 decimal places were being rejected.
Updated regex pattern to allow up to 2 decimal places.
```

### Pull Request Process

1. Create feature branch from `develop`
2. Implement changes with tests
3. Ensure all tests pass locally
4. Push branch and create PR
5. Request code review
6. Address review feedback
7. Squash and merge when approved

---

## Testing Guidelines

### Test Organization

```
src/__tests__/
├── expense.service.test.ts      # Unit tests for expense service
├── settlement.service.test.ts   # Unit tests for settlement service
├── evidence.service.test.ts     # Unit tests for evidence service
├── activity.service.test.ts     # Unit tests for activity service
└── integration/
    ├── setup.ts                 # Test database setup
    ├── settlements.integration.test.ts
    └── attachments.integration.test.ts
```

### Unit Test Structure

```typescript
describe("Service Name - Function Category", () => {
  test("should do expected behavior", () => {
    // Arrange
    const input = { ... };

    // Act
    const result = functionUnderTest(input);

    // Assert
    expect(result).toBe(expected);
  });

  test("should handle error case", () => {
    // Test error scenarios
  });
});
```

### Running Tests

```bash
# Run all tests
bun test

# Run unit tests only
bun test src/__tests__/*.test.ts

# Run integration tests only
bun test src/__tests__/integration/*.test.ts

# Run specific test file
bun test src/__tests__/expense.service.test.ts

# Run tests in watch mode
bun test --watch
```

### Integration Test Requirements

Integration tests require a test database:

```bash
# Set test database URL
export DATABASE_URL_TEST=postgresql://user:pass@localhost:5432/divvy_test

# Run integration tests
bun test src/__tests__/integration/*.test.ts
```

---

## Code Review Checklist

### Before Requesting Review

- [ ] All tests pass locally
- [ ] No TypeScript errors (`bun run typecheck`)
- [ ] Code follows naming conventions
- [ ] Route parameters use `:{entity}Id` format
- [ ] New endpoints have corresponding tests
- [ ] Database changes have migrations

### Reviewer Checklist

- [ ] Code is readable and well-organized
- [ ] Business logic is in service layer, not routes
- [ ] Error handling is appropriate
- [ ] Authorization checks are in place
- [ ] No sensitive data in logs or responses
- [ ] Tests cover happy path and error cases
- [ ] API response format is consistent

### Security Considerations

- [ ] Input validation on all user inputs
- [ ] SQL injection prevention (use parameterized queries)
- [ ] Authentication required for protected routes
- [ ] Authorization checks for resource access
- [ ] No secrets in code or logs
- [ ] File upload validation (type, size)

---

## API Response Format

### Success Response

```json
{
  "success": true,
  "data": { ... }
}
```

### Error Response

```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable message"
  }
}
```

### Paginated Response

```json
{
  "success": true,
  "data": [...],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 100,
    "totalPages": 5
  }
}
```

---

## Questions?

If you have questions about contributing, please reach out to the team lead or open a discussion issue.
