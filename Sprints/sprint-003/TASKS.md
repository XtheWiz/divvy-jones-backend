# Sprint 003 - Task Breakdown

## Overview
| Field | Value |
|-------|-------|
| **Sprint** | 003 |
| **Total Tasks** | 16 |
| **Created By** | Lead Developer |
| **Created Date** | 2026-01-20 |

---

## Task Summary

| Phase | Tasks | Status |
|-------|-------|--------|
| Phase 1: Technical Debt | TASK-001 to TASK-003 | ✅ Complete |
| Phase 2: Settlement Service | TASK-004 to TASK-006 | ✅ Complete |
| Phase 3: Notification Service | TASK-007 to TASK-010 | ✅ Complete |
| Phase 4: Test Infrastructure | TASK-011 to TASK-012 | ✅ Complete |
| Phase 4: Integration Tests | TASK-013 to TASK-014 | ✅ Complete |
| Phase 5: Unit Tests | TASK-015 to TASK-016 | ✅ Complete |

---

## Phase 1: Technical Debt

### TASK-001: Fix Raw SQL in Balance Service
| Field | Value |
|-------|-------|
| **ID** | TASK-001 |
| **Assigned To** | Backend Developer |
| **Priority** | High |
| **Complexity** | Low |
| **Status** | ✅ Complete |

**Description:**
Replace all raw SQL template literals in `balance.service.ts` with proper Drizzle ORM methods.

**Acceptance Criteria:**
- AC-0.1: Raw SQL in balance.service.ts replaced with Drizzle ORM methods
- AC-0.2: `inArray` operator imported and used for IN clauses
- AC-0.3: All `sql` template literals removed from balance.service.ts

**Technical Notes:**
```typescript
// Before (line 78-82)
const [group] = await db
  .select({ currency: sql<string>`default_currency_code` })
  .from(sql`groups`)
  .where(sql`id = ${groupId}`)

// After
import { groups } from "../db";
const [group] = await db
  .select({ currency: groups.defaultCurrencyCode })
  .from(groups)
  .where(eq(groups.id, groupId))

// Before (line 160)
.where(sql`${expensePayers.expenseId} IN ${expenseIds}`)

// After
import { inArray } from "drizzle-orm";
.where(inArray(expensePayers.expenseId, expenseIds))
```

**Files to Modify:**
- `src/services/balance.service.ts`

---

### TASK-002: Optimize listExpenses paidBy Filter
| Field | Value |
|-------|-------|
| **ID** | TASK-002 |
| **Assigned To** | Backend Developer |
| **Priority** | Medium |
| **Complexity** | Medium |
| **Status** | ✅ Complete |

**Description:**
Move the paidByUserId filter from post-fetch JavaScript filtering to database-level query.

**Acceptance Criteria:**
- AC-0.4: Optimize listExpenses to filter paidBy at database level

**Technical Notes:**
```typescript
// Use EXISTS subquery instead of post-fetch filter
import { exists } from "drizzle-orm";

// In the query conditions:
filters.paidByUserId ? exists(
  db.select({ one: sql`1` })
    .from(expensePayers)
    .innerJoin(groupMembers, eq(expensePayers.memberId, groupMembers.id))
    .where(and(
      eq(expensePayers.expenseId, expenses.id),
      eq(groupMembers.userId, filters.paidByUserId)
    ))
) : undefined
```

**Files to Modify:**
- `src/services/expense.service.ts`

---

### TASK-003: Run Settlement Schema Migrations
| Field | Value |
|-------|-------|
| **ID** | TASK-003 |
| **Assigned To** | Backend Developer |
| **Priority** | High |
| **Complexity** | Low |
| **Status** | ✅ Complete |

**Description:**
Add missing fields to settlements table and seed notification types.

**Acceptance Criteria:**
- Settlement `note` field exists
- Settlement `settledAt` field exists
- Notification types for settlements are seeded

**Technical Notes:**
```sql
-- Migration: Add settlement fields
ALTER TABLE settlements ADD COLUMN IF NOT EXISTS note TEXT;
ALTER TABLE settlements ADD COLUMN IF NOT EXISTS settled_at TIMESTAMP WITH TIME ZONE;

-- Seed notification types
INSERT INTO notification_type (value) VALUES
  ('settlement_requested'),
  ('settlement_confirmed'),
  ('settlement_rejected'),
  ('group_deleted')
ON CONFLICT (value) DO NOTHING;
```

**Files to Modify:**
- `src/db/schema/settlements.ts` (add columns)
- Database migration script or direct SQL

---

## Phase 2: Settlement Service

### TASK-004: Create Settlement Service
| Field | Value |
|-------|-------|
| **ID** | TASK-004 |
| **Assigned To** | Backend Developer |
| **Priority** | High |
| **Complexity** | High |
| **Status** | ✅ Complete |

**Description:**
Create the settlement service with CRUD operations and state management.

**Acceptance Criteria:**
- AC-1.1 to AC-1.10: Create settlement functionality
- AC-1.11 to AC-1.15: Confirm settlement functionality
- AC-1.16 to AC-1.20: Cancel/reject settlement functionality
- AC-1.21 to AC-1.26: List settlements with filters
- AC-1.27 to AC-1.30: View settlement details
- AC-1.31 to AC-1.33: Suggested settlements

**Functions to Implement:**
```typescript
// settlement.service.ts
export async function createSettlement(input: CreateSettlementInput)
export async function confirmSettlement(settlementId: string, userId: string)
export async function cancelSettlement(settlementId: string, userId: string)
export async function rejectSettlement(settlementId: string, userId: string, reason?: string)
export async function listSettlements(groupId: string, filters: SettlementFilters)
export async function getSettlementDetails(settlementId: string, groupId: string)
export async function getSuggestedSettlements(groupId: string)
```

**Files to Create:**
- `src/services/settlement.service.ts`

---

### TASK-005: Create Settlement Routes
| Field | Value |
|-------|-------|
| **ID** | TASK-005 |
| **Assigned To** | Backend Developer |
| **Priority** | High |
| **Complexity** | Medium |
| **Status** | ✅ Complete |

**Description:**
Create the settlement API routes with authentication and validation.

**Endpoints:**
| Method | Endpoint | Handler |
|--------|----------|---------|
| POST | `/groups/:groupId/settlements` | createSettlement |
| GET | `/groups/:groupId/settlements` | listSettlements |
| GET | `/groups/:groupId/settlements/suggested` | getSuggestedSettlements |
| GET | `/groups/:groupId/settlements/:settlementId` | getSettlementDetails |
| PUT | `/groups/:groupId/settlements/:settlementId/confirm` | confirmSettlement |
| PUT | `/groups/:groupId/settlements/:settlementId/cancel` | cancelSettlement |
| PUT | `/groups/:groupId/settlements/:settlementId/reject` | rejectSettlement |

**Files to Create:**
- `src/routes/settlements.ts`

**Files to Modify:**
- `src/routes/index.ts` (register routes)

---

### TASK-006: Update Balance Calculation for Settlements
| Field | Value |
|-------|-------|
| **ID** | TASK-006 |
| **Assigned To** | Backend Developer |
| **Priority** | High |
| **Complexity** | Medium |
| **Status** | ✅ Complete |

**Description:**
Modify the balance calculation to include completed settlements.

**Acceptance Criteria:**
- AC-1.14: Group balances are recalculated after confirmation
- AC-1.15: Settlement affects totalPaid/totalOwed in balance calculation
- AC-1.18: Cancelled/rejected settlements don't affect balances

**Technical Notes:**
```typescript
// In calculateGroupBalances:
// After getting expenses, also get completed settlements

const completedSettlements = await db
  .select({
    payerMemberId: settlements.payerMemberId,
    payeeMemberId: settlements.payeeMemberId,
    amount: settlements.amount,
  })
  .from(settlements)
  .where(and(
    eq(settlements.groupId, groupId),
    eq(settlements.status, "confirmed")
  ));

// For each settlement:
// - Payer's totalPaid increases (they paid off debt)
// - Payee's totalOwed decreases (they received payment)
```

**Files to Modify:**
- `src/services/balance.service.ts`

---

## Phase 3: Notification Service

### TASK-007: Create Notification Service
| Field | Value |
|-------|-------|
| **ID** | TASK-007 |
| **Assigned To** | Backend Developer |
| **Priority** | High |
| **Complexity** | Medium |
| **Status** | ✅ Complete |

**Description:**
Create the notification service for CRUD operations.

**Acceptance Criteria:**
- AC-2.1: Notification schema (already exists)
- AC-2.2: Notification types (already defined)
- AC-2.3: Soft-deletable notifications

**Functions to Implement:**
```typescript
// notification.service.ts
export async function createNotification(input: CreateNotificationInput)
export async function listNotifications(userId: string, filters: NotificationFilters)
export async function getUnreadCount(userId: string): Promise<number>
export async function markAsRead(notificationId: string, userId: string)
export async function markAllAsRead(userId: string)
```

**Files to Create:**
- `src/services/notification.service.ts`

---

### TASK-008: Create Notification Routes
| Field | Value |
|-------|-------|
| **ID** | TASK-008 |
| **Assigned To** | Backend Developer |
| **Priority** | High |
| **Complexity** | Low |
| **Status** | ✅ Complete |

**Description:**
Create the notification API routes.

**Acceptance Criteria:**
- AC-2.7: GET /notifications - list user's notifications
- AC-2.8: Paginated response with unread count
- AC-2.9: PUT /notifications/:id/read - mark as read
- AC-2.10: PUT /notifications/read-all - mark all as read

**Endpoints:**
| Method | Endpoint | Handler |
|--------|----------|---------|
| GET | `/notifications` | listNotifications |
| PUT | `/notifications/:id/read` | markAsRead |
| PUT | `/notifications/read-all` | markAllAsRead |

**Files to Create:**
- `src/routes/notifications.ts`

**Files to Modify:**
- `src/routes/index.ts` (register routes)

---

### TASK-009: Add Settlement Notifications
| Field | Value |
|-------|-------|
| **ID** | TASK-009 |
| **Assigned To** | Backend Developer |
| **Priority** | High |
| **Complexity** | Low |
| **Status** | ✅ Complete |

**Description:**
Create notifications when settlement events occur.

**Acceptance Criteria:**
- AC-2.4: Payee notified when settlement is requested
- AC-2.5: Payer notified when settlement is confirmed
- AC-2.6: Payer notified when settlement is rejected

**Technical Notes:**
Integrate notification creation into settlement service transactions:
```typescript
// In createSettlement:
await createNotification({
  userId: payee.userId,
  type: "settlement_requested",
  title: `${payer.displayName} requested a payment`,
  body: `${amount} ${currency}`,
  referenceId: settlement.id,
  referenceType: "settlement",
});
```

**Files to Modify:**
- `src/services/settlement.service.ts`

---

### TASK-010: Complete Stubbed ACs from Sprint 002
| Field | Value |
|-------|-------|
| **ID** | TASK-010 |
| **Assigned To** | Backend Developer |
| **Priority** | Medium |
| **Complexity** | Medium |
| **Status** | ✅ Complete |

**Description:**
Complete the stubbed acceptance criteria from Sprint 002.

**Acceptance Criteria:**
- AC-2.11: Member leaving with debt sees warning (Sprint 002 AC-1.10)
- AC-2.12: Members notified when group deleted (Sprint 002 AC-1.19)

**Technical Notes:**
```typescript
// In leaveGroup (groups.ts):
// Check for unsettled balance
const balance = await getIndividualBalance(groupId, userId);
if (balance && (balance.owesTo.length > 0 || balance.owedBy.length > 0)) {
  // Include warning in response
  warning = "You have unsettled balances in this group";
}

// In deleteGroup:
// Notify all members
const members = await getGroupMembers(groupId);
for (const member of members) {
  await createNotification({
    userId: member.userId,
    type: "group_deleted",
    title: `Group "${group.name}" was deleted`,
  });
}
```

**Files to Modify:**
- `src/routes/groups.ts`

---

## Phase 4: Test Infrastructure

### TASK-011: Set Up Test Database Configuration
| Field | Value |
|-------|-------|
| **ID** | TASK-011 |
| **Assigned To** | Lead Developer |
| **Priority** | High |
| **Complexity** | Medium |
| **Status** | ✅ Complete |

**Description:**
Configure separate test database for integration tests.

**Acceptance Criteria:**
- AC-0.5: Test database configuration documented in .env.example
- AC-0.6: Test database uses separate database

**Files to Create/Modify:**
- `.env.example` (add DATABASE_URL_TEST)
- `src/__tests__/integration/setup.ts`

**Technical Notes:**
```typescript
// setup.ts
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

const testPool = new Pool({
  connectionString: process.env.DATABASE_URL_TEST,
});

export const testDb = drizzle(testPool, { schema });

export async function cleanupTestData() {
  // Truncate tables in reverse dependency order
}
```

---

### TASK-012: Create Integration Test Framework
| Field | Value |
|-------|-------|
| **ID** | TASK-012 |
| **Assigned To** | Lead Developer |
| **Priority** | High |
| **Complexity** | Medium |
| **Status** | ✅ Complete |

**Description:**
Create test utilities, factories, and base test setup.

**Acceptance Criteria:**
- AC-0.7: Integration test framework set up with database seeding
- AC-0.8: Test cleanup runs after each test suite

**Files to Create:**
- `src/__tests__/integration/factories.ts`
- `src/__tests__/integration/helpers.ts`

**Technical Notes:**
```typescript
// factories.ts
export async function createTestUser(overrides = {}) {
  return await testDb.insert(users).values({
    email: `test-${nanoid()}@example.com`,
    displayName: "Test User",
    ...overrides,
  }).returning();
}

export async function createTestGroup(ownerId: string, overrides = {}) { ... }
export async function createTestExpense(groupId: string, payerId: string, overrides = {}) { ... }
```

---

### TASK-013: Write Auth Integration Tests
| Field | Value |
|-------|-------|
| **ID** | TASK-013 |
| **Assigned To** | QA Engineer |
| **Priority** | High |
| **Complexity** | Medium |
| **Status** | ✅ Complete |

**Description:**
Write at least 5 integration tests for auth endpoints.

**Acceptance Criteria:**
- AC-0.9: At least 5 integration tests for auth endpoints

**Test Cases:**
1. POST /auth/register - successful registration
2. POST /auth/register - duplicate email error
3. POST /auth/login - successful login
4. POST /auth/login - invalid credentials
5. POST /auth/refresh - successful token refresh
6. GET /users/me - returns authenticated user

**Files to Create:**
- `src/__tests__/integration/auth.integration.test.ts`

---

### TASK-014: Write Settlement Integration Tests
| Field | Value |
|-------|-------|
| **ID** | TASK-014 |
| **Assigned To** | QA Engineer |
| **Priority** | High |
| **Complexity** | Medium |
| **Status** | ✅ Complete |

**Description:**
Write at least 5 integration tests for expense/settlement endpoints.

**Acceptance Criteria:**
- AC-0.10: At least 5 integration tests for expense endpoints

**Test Cases:**
1. POST /groups/:id/settlements - create settlement
2. GET /groups/:id/settlements - list settlements
3. PUT /groups/:id/settlements/:id/confirm - confirm settlement
4. PUT /groups/:id/settlements/:id/reject - reject settlement
5. GET /groups/:id/balances - balances reflect settlements

**Files to Create:**
- `src/__tests__/integration/settlements.integration.test.ts`

---

## Phase 5: Unit Tests

### TASK-015: Settlement Service Unit Tests
| Field | Value |
|-------|-------|
| **ID** | TASK-015 |
| **Assigned To** | Backend Developer |
| **Priority** | Medium |
| **Complexity** | Low |
| **Status** | ✅ Complete |

**Description:**
Write unit tests for settlement service validation and state transitions.

**Test Areas:**
- Amount validation (positive, 2 decimals)
- Same person validation (payer ≠ payee)
- State transition validation
- Permission checks (who can confirm/cancel/reject)

**Files to Create:**
- `src/__tests__/unit/settlement.service.test.ts`

---

### TASK-016: Notification Service Unit Tests
| Field | Value |
|-------|-------|
| **ID** | TASK-016 |
| **Assigned To** | Backend Developer |
| **Priority** | Medium |
| **Complexity** | Low |
| **Status** | ✅ Complete |

**Description:**
Write unit tests for notification service.

**Test Areas:**
- Notification type validation
- Mark as read logic
- Unread count calculation
- Pagination

**Files to Create:**
- `src/__tests__/unit/notification.service.test.ts`

---

## Task Dependencies

```
TASK-001 ─┬──> TASK-004 ──> TASK-005 ──> TASK-006
          │                     │
TASK-002 ─┤                     └──> TASK-009
          │                              │
TASK-003 ─┘                              v
                               TASK-007 ──> TASK-008 ──> TASK-010

TASK-011 ──> TASK-012 ──> TASK-013
                    └──> TASK-014

TASK-004 ──> TASK-015
TASK-007 ──> TASK-016
```

---

## Assignment Summary

| Task | Assigned To |
|------|-------------|
| TASK-001 | Backend Developer |
| TASK-002 | Backend Developer |
| TASK-003 | Backend Developer |
| TASK-004 | Backend Developer |
| TASK-005 | Backend Developer |
| TASK-006 | Backend Developer |
| TASK-007 | Backend Developer |
| TASK-008 | Backend Developer |
| TASK-009 | Backend Developer |
| TASK-010 | Backend Developer |
| TASK-011 | Lead Developer |
| TASK-012 | Lead Developer |
| TASK-013 | QA Engineer |
| TASK-014 | QA Engineer |
| TASK-015 | Backend Developer |
| TASK-016 | Backend Developer |

---

## Progress Tracking

| Task | Status | Started | Completed | Notes |
|------|--------|---------|-----------|-------|
| TASK-001 | ✅ | 2026-01-20 | 2026-01-20 | Fixed raw SQL with inArray |
| TASK-002 | ✅ | 2026-01-20 | 2026-01-20 | paidBy filter uses EXISTS |
| TASK-003 | ✅ | 2026-01-20 | 2026-01-20 | Schema updated, migration created |
| TASK-004 | ✅ | 2026-01-20 | 2026-01-20 | settlement.service.ts created |
| TASK-005 | ✅ | 2026-01-20 | 2026-01-20 | settlements.ts routes created |
| TASK-006 | ✅ | 2026-01-20 | 2026-01-20 | Balance includes settlements |
| TASK-007 | ✅ | 2026-01-20 | 2026-01-20 | notification.service.ts created |
| TASK-008 | ✅ | 2026-01-20 | 2026-01-20 | notifications.ts routes created |
| TASK-009 | ✅ | 2026-01-20 | 2026-01-20 | Settlement notifications integrated |
| TASK-010 | ✅ | 2026-01-20 | 2026-01-20 | Debt warning + group delete notify |
| TASK-011 | ✅ | 2026-01-20 | 2026-01-20 | Test DB config complete |
| TASK-012 | ✅ | 2026-01-20 | 2026-01-20 | Test framework + factories |
| TASK-013 | ✅ | 2026-01-20 | 2026-01-20 | 13 auth integration tests |
| TASK-014 | ✅ | 2026-01-20 | 2026-01-20 | 14 settlement integration tests |
| TASK-015 | ✅ | 2026-01-20 | 2026-01-20 | 38 settlement unit tests |
| TASK-016 | ✅ | 2026-01-20 | 2026-01-20 | 40 notification unit tests |
