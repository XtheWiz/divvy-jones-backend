# Sprint 002 - Task Board

## Summary
| Metric | Count |
|--------|-------|
| Total Tasks | 21 |
| Todo | 21 |
| In Progress | 0 |
| In Review | 0 |
| QA | 0 |
| Done | 0 |

**Progress:** ░░░░░░░░░░ 0%

---

## Task Board

### 🔴 Todo

#### Feature 0: Technical Debt & Infrastructure

| ID | Task | ACs | Complexity | Assigned |
|----|------|-----|------------|----------|
| TASK-001 | Fix dynamic imports and raw SQL | AC-0.1, AC-0.2 | Low | Backend Dev |
| TASK-002 | JWT secret production check | AC-0.3 | Low | Backend Dev |
| TASK-003 | Rate limiting on auth endpoints | AC-0.4, AC-0.5 | Medium | Backend Dev |
| TASK-004 | Test database setup | AC-0.6, AC-0.7, AC-0.8 | Medium | Lead Dev |

#### Feature 1: Complete Group Management

| ID | Task | ACs | Complexity | Assigned |
|----|------|-----|------------|----------|
| TASK-005 | Edit group endpoint | AC-1.1 to AC-1.6 | Medium | Backend Dev |
| TASK-006 | Leave group endpoint | AC-1.7 to AC-1.12 | Medium | Backend Dev |
| TASK-007 | Regenerate join code endpoint | AC-1.13 to AC-1.15 | Low | Backend Dev |
| TASK-008 | Delete group endpoint | AC-1.16 to AC-1.19 | Medium | Backend Dev |

#### Feature 2: Core Expense Tracking

| ID | Task | ACs | Complexity | Assigned |
|----|------|-----|------------|----------|
| TASK-009 | Database migration: add category | - | Low | Backend Dev |
| TASK-010 | Expense service foundation | - | Medium | Backend Dev |
| TASK-011 | Create expense endpoint | AC-2.1 to AC-2.9 | High | Backend Dev |
| TASK-012 | Expense split calculation | AC-2.10 to AC-2.16 | High | Backend Dev |
| TASK-013 | List expenses with filters | AC-2.17 to AC-2.23 | Medium | Backend Dev |
| TASK-014 | View expense details | AC-2.24 to AC-2.27 | Low | Backend Dev |
| TASK-015 | Edit expense endpoint | AC-2.28 to AC-2.32 | Medium | Backend Dev |
| TASK-016 | Delete expense endpoint | AC-2.33 to AC-2.36 | Low | Backend Dev |

#### Feature 3: Balance Calculation

| ID | Task | ACs | Complexity | Assigned |
|----|------|-----|------------|----------|
| TASK-017 | Balance calculation service | AC-3.1 to AC-3.6 | High | Backend Dev |
| TASK-018 | Balance endpoints | AC-3.7 to AC-3.9 | Medium | Backend Dev |

#### Testing

| ID | Task | ACs | Complexity | Assigned |
|----|------|-----|------------|----------|
| TASK-019 | Unit tests: expense service | - | Medium | Backend Dev |
| TASK-020 | Unit tests: balance service | - | Medium | Backend Dev |
| TASK-021 | Integration tests setup | - | Medium | Lead Dev |

---

### 🟡 In Progress
_No tasks in progress_

---

### 🔵 In Review
_No tasks in review_

---

### 🟣 QA
_No tasks in QA_

---

### 🟢 Done
_No tasks completed_

---

## Task Details

---

### TASK-001: Fix dynamic imports and raw SQL
**Feature:** Technical Debt
**Acceptance Criteria:** AC-0.1, AC-0.2
**Complexity:** Low
**Assigned To:** Backend Developer
**Status:** Todo

#### Description
Fix code quality issues identified in Sprint 001 retrospective:
1. Replace dynamic imports in users.ts with static imports
2. Replace raw SQL template in group.service.ts with Drizzle's `inArray`

#### Technical Notes
```typescript
// Before (users.ts)
const { something } = await import('./module')

// After
import { something } from './module'  // At file top

// Before (group.service.ts)
sql`SELECT * FROM users WHERE id IN (${ids})`

// After
import { inArray } from 'drizzle-orm'
db.select().from(users).where(inArray(users.id, ids))
```

#### Acceptance Criteria
- [ ] AC-0.1: Dynamic imports in users.ts replaced with static imports at file top
- [ ] AC-0.2: Raw SQL template in group.service.ts replaced with Drizzle's `inArray` operator

---

### TASK-002: JWT secret production check
**Feature:** Technical Debt
**Acceptance Criteria:** AC-0.3
**Complexity:** Low
**Assigned To:** Backend Developer
**Status:** Todo

#### Description
Add startup check that throws error if JWT_SECRET is not set in production environment.

#### Technical Notes
```typescript
// src/config/index.ts or src/app.ts
if (process.env.NODE_ENV === 'production' && !process.env.JWT_SECRET) {
  throw new Error('JWT_SECRET environment variable is required in production')
}
```

#### Acceptance Criteria
- [ ] AC-0.3: JWT_SECRET environment variable is required in production (throws error if missing)

---

### TASK-003: Rate limiting on auth endpoints
**Feature:** Technical Debt
**Acceptance Criteria:** AC-0.4, AC-0.5
**Complexity:** Medium
**Assigned To:** Backend Developer
**Status:** Todo

#### Description
Implement rate limiting on authentication endpoints to prevent brute force attacks.

#### Technical Notes
```typescript
import { rateLimit } from 'elysia-rate-limit'

// Apply to auth routes only
authRoutes.use(rateLimit({
  duration: 60000, // 1 minute window
  max: 5,          // 5 requests per window
  generator: (request) => {
    return request.headers.get('x-forwarded-for')
      || request.headers.get('x-real-ip')
      || 'unknown'
  }
}))
```

#### Acceptance Criteria
- [ ] AC-0.4: Rate limiting implemented on auth endpoints (5 requests per minute per IP)
- [ ] AC-0.5: Rate limit exceeded returns 429 Too Many Requests

---

### TASK-004: Test database setup
**Feature:** Technical Debt
**Acceptance Criteria:** AC-0.6, AC-0.7, AC-0.8
**Complexity:** Medium
**Assigned To:** Lead Developer
**Status:** Todo

#### Description
Set up test database configuration and test infrastructure for integration tests.

#### Technical Notes
```
# .env.example additions
DATABASE_URL_TEST=postgres://user:pass@localhost:5432/divvy_jones_test

# test/setup.ts
import { drizzle } from 'drizzle-orm/postgres-js'
import { migrate } from 'drizzle-orm/postgres-js/migrator'

export async function setupTestDB() {
  const db = drizzle(process.env.DATABASE_URL_TEST)
  await migrate(db, { migrationsFolder: './drizzle' })
  return db
}

export async function teardownTestDB(db) {
  // Truncate all tables
  await db.execute(sql`TRUNCATE users, groups, group_members CASCADE`)
}
```

#### Acceptance Criteria
- [ ] AC-0.6: Test database configuration documented in .env.example
- [ ] AC-0.7: Database integration tests can run against test database
- [ ] AC-0.8: Test setup/teardown handles database state properly

---

### TASK-005: Edit group endpoint
**Feature:** Complete Group Management
**Acceptance Criteria:** AC-1.1 to AC-1.6
**Complexity:** Medium
**Assigned To:** Backend Developer
**Status:** Todo

#### Description
Implement PUT /groups/:id endpoint for updating group details.

#### Technical Notes
```typescript
// PUT /groups/:id
{
  name?: string,        // 1-100 chars
  description?: string,
  defaultCurrency?: string  // ISO currency code
}

// Check requester is owner or admin
// Return updated group details
```

#### Acceptance Criteria
- [ ] AC-1.1: Owner/admin can update group name (PUT /groups/:id)
- [ ] AC-1.2: Owner/admin can update group description
- [ ] AC-1.3: Owner/admin can change default currency
- [ ] AC-1.4: Regular members cannot edit group settings (403)
- [ ] AC-1.5: Group name validation same as create (1-100 chars)
- [ ] AC-1.6: Returns updated group details on success

---

### TASK-006: Leave group endpoint
**Feature:** Complete Group Management
**Acceptance Criteria:** AC-1.7 to AC-1.12
**Complexity:** Medium
**Assigned To:** Backend Developer
**Status:** Todo

#### Description
Implement POST /groups/:id/leave endpoint for members to leave a group.

#### Technical Notes
```typescript
// POST /groups/:id/leave
{
  transferOwnershipTo?: string  // userId, required if sole owner leaving
}

// Response includes warning if unsettled balance exists
// Soft delete membership (set leftAt timestamp)
```

#### Acceptance Criteria
- [ ] AC-1.7: Member can leave a group they belong to (POST /groups/:id/leave)
- [ ] AC-1.8: Owner cannot leave if they are the only owner
- [ ] AC-1.9: Owner can transfer ownership before leaving
- [ ] AC-1.10: Member with unsettled debts receives warning but can still leave
- [ ] AC-1.11: Left member no longer appears in member list
- [ ] AC-1.12: Left member can rejoin via join code

---

### TASK-007: Regenerate join code endpoint
**Feature:** Complete Group Management
**Acceptance Criteria:** AC-1.13 to AC-1.15
**Complexity:** Low
**Assigned To:** Backend Developer
**Status:** Todo

#### Description
Implement POST /groups/:id/regenerate-code endpoint for generating a new join code.

#### Technical Notes
```typescript
// POST /groups/:id/regenerate-code
// Requires owner or admin role
// Generate new code using existing nanoid logic
// Update group record
// Return new join code
```

#### Acceptance Criteria
- [ ] AC-1.13: Owner/admin can regenerate join code (POST /groups/:id/regenerate-code)
- [ ] AC-1.14: Old join code becomes invalid after regeneration
- [ ] AC-1.15: Returns new join code on success

---

### TASK-008: Delete group endpoint
**Feature:** Complete Group Management
**Acceptance Criteria:** AC-1.16 to AC-1.19
**Complexity:** Medium
**Assigned To:** Backend Developer
**Status:** Todo

#### Description
Implement DELETE /groups/:id endpoint for soft-deleting a group.

#### Technical Notes
```typescript
// DELETE /groups/:id
// Requires owner role only
// Set deletedAt timestamp (soft delete)
// Group no longer appears in any member's list
// AC-1.19 (notifications) - stub for now, implement when notifications exist
```

#### Acceptance Criteria
- [ ] AC-1.16: Only owner can delete group (DELETE /groups/:id)
- [ ] AC-1.17: Deletion is soft delete (sets deletedAt)
- [ ] AC-1.18: Deleted group no longer appears in any member's group list
- [ ] AC-1.19: Members are notified of deletion (stub - if notifications exist)

---

### TASK-009: Database migration - add category
**Feature:** Core Expense Tracking
**Complexity:** Low
**Assigned To:** Backend Developer
**Status:** Todo

#### Description
Add category column to expenses table via Drizzle migration.

#### Technical Notes
```typescript
// src/db/schema/expenses.ts
category: text("category").default("other")

// Valid categories:
// food, transport, accommodation, entertainment, shopping,
// utilities, health, travel, groceries, other
```

Run: `bun drizzle-kit generate` then `bun drizzle-kit migrate`

#### Acceptance Criteria
- [ ] Category column added to expenses table
- [ ] Default value is 'other'
- [ ] Migration runs successfully

---

### TASK-010: Expense service foundation
**Feature:** Core Expense Tracking
**Complexity:** Medium
**Assigned To:** Backend Developer
**Status:** Todo

#### Description
Create expense service with validation functions and helper utilities.

#### Technical Notes
```typescript
// src/services/expense.service.ts
export const expenseService = {
  validateAmount(amount: number): boolean
  validateCategory(category: string): boolean
  validateCurrency(code: string): Promise<boolean>
  validateMemberInGroup(memberId: string, groupId: string): Promise<boolean>
}

// Constants
export const EXPENSE_CATEGORIES = [
  'food', 'transport', 'accommodation', 'entertainment',
  'shopping', 'utilities', 'health', 'travel', 'groceries', 'other'
] as const
```

#### Acceptance Criteria
- [ ] Expense service file created
- [ ] Validation functions implemented
- [ ] Category constants exported

---

### TASK-011: Create expense endpoint
**Feature:** Core Expense Tracking
**Acceptance Criteria:** AC-2.1 to AC-2.9
**Complexity:** High
**Assigned To:** Backend Developer
**Status:** Todo

#### Description
Implement POST /groups/:id/expenses endpoint for creating expenses.

#### Technical Notes
```typescript
// POST /groups/:id/expenses
{
  title: string,         // 1-200 chars (AC-2.7)
  amount: number,        // positive, max 2 decimals (AC-2.4)
  currency: string,      // ISO code (AC-2.5)
  paidBy: string,        // userId -> memberId (AC-2.6)
  description?: string,  // optional (AC-2.3)
  category?: string,     // from predefined list (AC-2.8)
  date?: string,         // ISO date, defaults to now (AC-2.3)
  splits: SplitConfig    // See TASK-012
}

// Response: created expense with ID and timestamp (AC-2.9)
```

#### Acceptance Criteria
- [ ] AC-2.1: Member can create expense in their group (POST /groups/:id/expenses)
- [ ] AC-2.2: Expense requires: title, amount, currency, paidBy (user ID)
- [ ] AC-2.3: Expense optional: description, category, date (defaults to now)
- [ ] AC-2.4: Amount must be positive number with max 2 decimal places
- [ ] AC-2.5: Currency must be valid ISO currency code
- [ ] AC-2.6: PaidBy must be a current member of the group
- [ ] AC-2.7: Title must be 1-200 characters
- [ ] AC-2.8: Category must be from predefined list or 'other'
- [ ] AC-2.9: Returns created expense with ID and timestamp

---

### TASK-012: Expense split calculation
**Feature:** Core Expense Tracking
**Acceptance Criteria:** AC-2.10 to AC-2.16
**Complexity:** High
**Assigned To:** Backend Developer
**Status:** Todo

#### Description
Implement split calculation logic for all split modes.

#### Technical Notes
```typescript
// Split types
type SplitConfig =
  | { type: 'equal', excludeMembers?: string[] }
  | { type: 'exact', amounts: Record<string, number> }
  | { type: 'percent', percentages: Record<string, number> }
  | { type: 'weight', weights: Record<string, number> }

// src/services/split.service.ts
export function calculateSplits(
  totalAmount: number,
  splitConfig: SplitConfig,
  memberIds: string[]
): Map<string, number>

// Validation: splits must sum to total (AC-2.14)
// Store in expenseItemMembers table (AC-2.16)
```

#### Acceptance Criteria
- [ ] AC-2.10: Default split: equal among all group members
- [ ] AC-2.11: Custom split: specify exact amount per member
- [ ] AC-2.12: Custom split: specify percentage per member
- [ ] AC-2.13: Custom split: specify weight/shares per member
- [ ] AC-2.14: Split amounts must sum to total expense amount
- [ ] AC-2.15: Can exclude members from split
- [ ] AC-2.16: Split stored with expense for audit trail

---

### TASK-013: List expenses with filters
**Feature:** Core Expense Tracking
**Acceptance Criteria:** AC-2.17 to AC-2.23
**Complexity:** Medium
**Assigned To:** Backend Developer
**Status:** Todo

#### Description
Implement GET /groups/:id/expenses endpoint with filtering and pagination.

#### Technical Notes
```typescript
// GET /groups/:id/expenses
// Query params:
// - page: number (default 1)
// - limit: number (default 20, max 100)
// - dateFrom: ISO date
// - dateTo: ISO date
// - category: string
// - paidBy: userId

// Response includes pagination metadata
{
  data: Expense[],
  pagination: {
    total: number,
    page: number,
    limit: number,
    totalPages: number
  }
}
```

#### Acceptance Criteria
- [ ] AC-2.17: Member can list expenses in their group (GET /groups/:id/expenses)
- [ ] AC-2.18: List supports pagination (page, limit params)
- [ ] AC-2.19: List supports filtering by date range
- [ ] AC-2.20: List supports filtering by category
- [ ] AC-2.21: List supports filtering by paidBy user
- [ ] AC-2.22: Returns total count for pagination
- [ ] AC-2.23: Expenses sorted by date descending (newest first)

---

### TASK-014: View expense details
**Feature:** Core Expense Tracking
**Acceptance Criteria:** AC-2.24 to AC-2.27
**Complexity:** Low
**Assigned To:** Backend Developer
**Status:** Todo

#### Description
Implement GET /groups/:id/expenses/:expenseId endpoint.

#### Technical Notes
```typescript
// GET /groups/:id/expenses/:expenseId
// Returns full expense with splits

{
  id: string,
  title: string,
  amount: number,
  currency: string,
  category: string,
  date: string,
  description: string,
  paidBy: { userId, name, amount }[],
  splits: { userId, name, amount, shareMode }[],
  createdBy: { userId, name },
  createdAt: string,
  updatedAt: string
}
```

#### Acceptance Criteria
- [ ] AC-2.24: Member can view expense details (GET /groups/:id/expenses/:expenseId)
- [ ] AC-2.25: Details include full split breakdown per member
- [ ] AC-2.26: Details include who created and when
- [ ] AC-2.27: Non-members cannot view expense (403)

---

### TASK-015: Edit expense endpoint
**Feature:** Core Expense Tracking
**Acceptance Criteria:** AC-2.28 to AC-2.32
**Complexity:** Medium
**Assigned To:** Backend Developer
**Status:** Todo

#### Description
Implement PUT /groups/:id/expenses/:expenseId endpoint.

#### Technical Notes
```typescript
// PUT /groups/:id/expenses/:expenseId
// Only creator or admin can edit
// Cannot edit if linked settlement exists

// Check for settlements:
const settlement = await db.query.settlements.findFirst({
  where: eq(settlements.expenseId, expenseId)
})
if (settlement) throw new ForbiddenError('Cannot edit settled expense')
```

#### Acceptance Criteria
- [ ] AC-2.28: Expense creator or admin can edit expense (PUT /groups/:id/expenses/:expenseId)
- [ ] AC-2.29: Can edit title, description, amount, category, date
- [ ] AC-2.30: Can edit splits (recalculates balances)
- [ ] AC-2.31: Cannot edit if expense has related settlements (settled)
- [ ] AC-2.32: Tracks updatedAt and updatedBy

---

### TASK-016: Delete expense endpoint
**Feature:** Core Expense Tracking
**Acceptance Criteria:** AC-2.33 to AC-2.36
**Complexity:** Low
**Assigned To:** Backend Developer
**Status:** Todo

#### Description
Implement DELETE /groups/:id/expenses/:expenseId endpoint.

#### Technical Notes
```typescript
// DELETE /groups/:id/expenses/:expenseId
// Only creator or admin can delete
// Soft delete: set deletedAt timestamp
// Cannot delete if linked settlement exists
```

#### Acceptance Criteria
- [ ] AC-2.33: Expense creator or admin can delete expense (DELETE /groups/:id/expenses/:expenseId)
- [ ] AC-2.34: Deletion is soft delete (sets deletedAt)
- [ ] AC-2.35: Cannot delete if expense has related settlements
- [ ] AC-2.36: Deleted expenses don't appear in list or affect balances

---

### TASK-017: Balance calculation service
**Feature:** Balance Calculation
**Acceptance Criteria:** AC-3.1 to AC-3.6
**Complexity:** High
**Assigned To:** Backend Developer
**Status:** Todo

#### Description
Implement balance calculation and debt simplification algorithm.

#### Technical Notes
```typescript
// src/services/balance.service.ts

export interface MemberBalance {
  memberId: string
  totalPaid: number
  totalOwed: number
  netBalance: number  // positive = owed money, negative = owes money
}

export interface SimplifiedDebt {
  from: string   // memberId who owes
  to: string     // memberId who is owed
  amount: number
}

export async function calculateGroupBalances(groupId: string): Promise<{
  memberBalances: MemberBalance[]
  simplifiedDebts: SimplifiedDebt[]
}>

// Algorithm for debt simplification:
// 1. Calculate net balance for each member
// 2. Separate into creditors (positive) and debtors (negative)
// 3. Sort both by absolute value (descending)
// 4. Match largest debtor to largest creditor
// 5. Create debt record for min(debtor.abs, creditor.abs)
// 6. Reduce both balances by that amount
// 7. Repeat until all balanced
```

#### Acceptance Criteria
- [ ] AC-3.1: Calculate net balance for each member (GET /groups/:id/balances)
- [ ] AC-3.2: Positive balance = member is owed money
- [ ] AC-3.3: Negative balance = member owes money
- [ ] AC-3.4: Sum of all balances equals zero
- [ ] AC-3.5: Returns simplified debts (who pays whom)
- [ ] AC-3.6: Simplified debts minimize number of transactions

---

### TASK-018: Balance endpoints
**Feature:** Balance Calculation
**Acceptance Criteria:** AC-3.7 to AC-3.9
**Complexity:** Medium
**Assigned To:** Backend Developer
**Status:** Todo

#### Description
Implement balance API endpoints.

#### Technical Notes
```typescript
// GET /groups/:id/balances
{
  groupId: string,
  currency: string,
  memberBalances: MemberBalance[],
  simplifiedDebts: SimplifiedDebt[],
  calculatedAt: string
}

// Individual balance (part of same endpoint or user-specific)
{
  memberId: string,
  totalPaid: number,
  totalOwed: number,
  netBalance: number,
  owesTo: { memberId, name, amount }[],
  owedBy: { memberId, name, amount }[]
}
```

#### Acceptance Criteria
- [ ] AC-3.7: Member can see their balance in group
- [ ] AC-3.8: Shows breakdown: total paid, total owed, net balance
- [ ] AC-3.9: Shows list of who they owe and who owes them

---

### TASK-019: Unit tests - expense service
**Feature:** Testing
**Complexity:** Medium
**Assigned To:** Backend Developer
**Status:** Todo

#### Description
Write comprehensive unit tests for expense service and split calculations.

#### Technical Notes
```typescript
// src/__tests__/expense.service.test.ts
describe('Expense Service', () => {
  describe('validation', () => { ... })
  describe('split calculation - equal', () => { ... })
  describe('split calculation - exact', () => { ... })
  describe('split calculation - percent', () => { ... })
  describe('split calculation - weight', () => { ... })
})
```

#### Test Cases
- Amount validation (positive, 2 decimals)
- Category validation
- Equal split with all members
- Equal split with exclusions
- Exact split summing to total
- Percentage split summing to 100%
- Weight-based proportional split
- Edge cases: single member, rounding

---

### TASK-020: Unit tests - balance service
**Feature:** Testing
**Complexity:** Medium
**Assigned To:** Backend Developer
**Status:** Todo

#### Description
Write comprehensive unit tests for balance calculation service.

#### Technical Notes
```typescript
// src/__tests__/balance.service.test.ts
describe('Balance Service', () => {
  describe('net balance calculation', () => { ... })
  describe('debt simplification', () => { ... })
})
```

#### Test Cases
- Simple 2-person balance
- 3+ person balance
- All equal (zero balances)
- Debt simplification reduces transactions
- Sum of balances is zero
- Handles decimal precision

---

### TASK-021: Integration tests setup
**Feature:** Testing
**Complexity:** Medium
**Assigned To:** Lead Developer
**Status:** Todo

#### Description
Set up integration test infrastructure with test database.

#### Technical Notes
```typescript
// test/integration/setup.ts
// test/integration/expenses.test.ts
// test/integration/balances.test.ts

// Use beforeAll/afterAll for DB setup/teardown
// Test full request/response cycle
```

#### Acceptance Criteria
- [ ] Integration test framework set up
- [ ] Test database connection working
- [ ] Sample integration tests for expenses
- [ ] CI can run integration tests

---

## Task Dependencies

```
TASK-001 ──┐
TASK-002 ──┼── Can run in parallel (Tech Debt)
TASK-003 ──┤
TASK-004 ──┘

TASK-005 ──┐
TASK-006 ──┼── Can run in parallel (Group Mgmt)
TASK-007 ──┤
TASK-008 ──┘

TASK-009 ─── Must complete before TASK-011

TASK-010 ─┬─ TASK-011 ─┬─ TASK-013 ──┐
          └─ TASK-012 ─┘             │
                                     ├── Sequential
TASK-014 ──────────────────────────┘
TASK-015 ───────────────────────────┐
TASK-016 ───────────────────────────┤
                                     │
TASK-017 ─── TASK-018 ──────────────┴── Depends on expense tasks

TASK-019 ─── Depends on TASK-010, TASK-012
TASK-020 ─── Depends on TASK-017
TASK-021 ─── Depends on TASK-004
```

---

## Recommended Execution Order

### Phase 1: Foundation (Parallel)
1. **Track A - Tech Debt:** TASK-001, TASK-002, TASK-003
2. **Track B - Group Mgmt:** TASK-005, TASK-006, TASK-007, TASK-008
3. **Track C - Test Infra:** TASK-004, TASK-021

### Phase 2: Expense Core (Sequential)
4. TASK-009 (migration)
5. TASK-010 (expense service)
6. TASK-011 + TASK-012 (create + splits)
7. TASK-019 (expense tests)

### Phase 3: Expense CRUD (Can Parallel)
8. TASK-013 (list)
9. TASK-014 (view)
10. TASK-015 (edit)
11. TASK-016 (delete)

### Phase 4: Balances
12. TASK-017 (balance service)
13. TASK-018 (balance endpoints)
14. TASK-020 (balance tests)

---

## Legend

| Symbol | Meaning |
|--------|---------|
| 🔴 | Todo |
| 🟡 | In Progress |
| 🔵 | In Review |
| 🟣 | QA |
| 🟢 | Done |
| Low | < 2 hours |
| Medium | 2-4 hours |
| High | 4+ hours |
