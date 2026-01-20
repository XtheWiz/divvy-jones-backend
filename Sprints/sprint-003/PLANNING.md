# Sprint 003 - Planning Session

## Session Information
| Field | Value |
|-------|-------|
| **Sprint** | 003 |
| **Date** | 2026-01-20 |
| **Lead Developer** | Claude (Lead Dev mode) |
| **Status** | Planning Complete |

---

## Sprint Goal Review

> Enable users to record and track settlements between group members, completing the core expense-splitting workflow. Establish integration test infrastructure.

**Assessment:** Goal is achievable. Database schemas already exist for settlements and notifications. Main work is service layer, routes, and tests.

---

## Codebase Analysis

### Existing Infrastructure (Already Available)

| Component | Status | Notes |
|-----------|--------|-------|
| `settlements` table | ✅ Exists | Has all required fields except note/description |
| `notifications` table | ✅ Exists | Has userId, type, title, body, data, isRead |
| `settlement_status` enum | ✅ Exists | ["pending", "confirmed", "rejected", "cancelled"] |
| `notification_type` enum | ✅ Exists | Includes settlement_requested, settlement_confirmed, settlement_rejected |
| `activityLog` table | ✅ Exists | For audit trail |
| Balance service | ✅ Exists | simplifiedDebts provides suggested settlements |

### Technical Debt Identified

| Issue | Location | Fix Required |
|-------|----------|--------------|
| Raw SQL for groups query | balance.service.ts:78-82 | Use Drizzle ORM `groups` table |
| Raw SQL for IN clauses | balance.service.ts:160,174,189,199 | Use `inArray` operator |
| Missing `inArray` import | balance.service.ts:1 | Add to imports |
| Post-fetch paidBy filter | expense.service.ts:526-533 | Move to DB query level |

---

## Technical Decisions

### TD-1: Settlement Schema Enhancement
**Decision:** Add `note` and `settledAt` fields to settlements table

**Rationale:**
- AC-1.8 requires optional note/description
- AC-1.29 requires confirmed date (settledAt)
- Current schema has `updatedAt` but explicit `settledAt` is clearer

**Implementation:**
```sql
ALTER TABLE settlements ADD COLUMN note TEXT;
ALTER TABLE settlements ADD COLUMN settled_at TIMESTAMP WITH TIME ZONE;
```

---

### TD-2: Settlement State Machine
**Decision:** Implement strict state transitions

**Valid Transitions:**
```
pending → confirmed (by payee)
pending → rejected (by payee)
pending → cancelled (by payer)
```

**Invalid Transitions:**
- Any status → pending (no reversal)
- confirmed/rejected/cancelled → any (terminal states)

**Rationale:** Prevents invalid state changes and simplifies balance logic

---

### TD-3: Balance Recalculation Strategy
**Decision:** Include completed settlements in balance calculation

**Current Balance Formula:**
```
netBalance = totalPaid (from expenses) - totalOwed (from expense splits)
```

**Updated Balance Formula:**
```
netBalance = totalPaid (expenses) + totalReceived (settlements)
           - totalOwed (expense splits) - totalPaid (settlements)
```

**Implementation:** Modify `calculateGroupBalances()` to include settlement amounts

---

### TD-4: Notification Creation Pattern
**Decision:** Create notifications synchronously within settlement transactions

**Rationale:**
- Ensures notification is created only if settlement succeeds
- Simpler than message queue for MVP
- Can be refactored to async later if needed

**Pattern:**
```typescript
await db.transaction(async (tx) => {
  // Create/update settlement
  const settlement = await tx.insert(settlements)...

  // Create notification
  await tx.insert(notifications).values({
    userId: payee.userId,
    type: "settlement_requested",
    title: `${payer.name} requested a settlement`,
    referenceId: settlement.id,
    referenceType: "settlement",
  });
});
```

---

### TD-5: Integration Test Strategy
**Decision:** Use separate test database with transaction rollback

**Approach:**
1. Create `DATABASE_URL_TEST` environment variable
2. Use separate database (not just schema) for isolation
3. Run each test in transaction, rollback after
4. Seed data using factory functions

**Test Structure:**
```
src/__tests__/
├── unit/                    # Existing unit tests
├── integration/
│   ├── setup.ts            # DB connection, cleanup
│   ├── factories.ts        # Test data factories
│   ├── auth.integration.test.ts
│   ├── expenses.integration.test.ts
│   └── settlements.integration.test.ts
```

---

### TD-6: Suggested Settlements Endpoint
**Decision:** Reuse existing `simplifiedDebts` from balance service

**Implementation:**
```typescript
GET /groups/:id/settlements/suggested

// Returns same structure as simplifiedDebts
{
  suggestions: [
    { from: { userId, displayName }, to: { userId, displayName }, amount }
  ]
}
```

**Rationale:** No new calculation needed - debt simplification already optimal

---

### TD-7: Notification List with Unread Count
**Decision:** Return unread count as separate field in paginated response

**Response Structure:**
```typescript
{
  success: true,
  data: {
    notifications: [...],
    pagination: { page, limit, total, totalPages },
    unreadCount: number  // Total unread, not just current page
  }
}
```

**Rationale:** Allows UI to show badge count without extra API call

---

### TD-8: paidBy Filter Optimization
**Decision:** Use subquery to filter at database level

**Current (Post-fetch):**
```typescript
// Fetch all expenses, then filter in JS
const filtered = expenses.filter(e => payers[e.id].userId === paidByUserId);
```

**Optimized (DB level):**
```typescript
// Use EXISTS subquery
.where(
  and(
    ...baseConditions,
    filters.paidByUserId ?
      exists(
        db.select().from(expensePayers)
          .innerJoin(groupMembers, eq(expensePayers.memberId, groupMembers.id))
          .where(and(
            eq(expensePayers.expenseId, expenses.id),
            eq(groupMembers.userId, filters.paidByUserId)
          ))
      ) : undefined
  )
)
```

---

## API Design

### Settlement Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/groups/:groupId/settlements` | Create settlement request |
| GET | `/groups/:groupId/settlements` | List settlements (with filters) |
| GET | `/groups/:groupId/settlements/suggested` | Get suggested settlements |
| GET | `/groups/:groupId/settlements/:settlementId` | Get settlement details |
| PUT | `/groups/:groupId/settlements/:settlementId/confirm` | Confirm settlement (payee) |
| PUT | `/groups/:groupId/settlements/:settlementId/cancel` | Cancel settlement (payer) |
| PUT | `/groups/:groupId/settlements/:settlementId/reject` | Reject settlement (payee) |

### Notification Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/notifications` | List user's notifications |
| PUT | `/notifications/:id/read` | Mark single as read |
| PUT | `/notifications/read-all` | Mark all as read |

---

## Database Migrations Required

### Migration 1: Add settlement fields
```sql
-- Add note field for settlement description
ALTER TABLE settlements ADD COLUMN IF NOT EXISTS note TEXT;

-- Add settled_at for confirmation timestamp
ALTER TABLE settlements ADD COLUMN IF NOT EXISTS settled_at TIMESTAMP WITH TIME ZONE;
```

### Migration 2: Seed notification types (if not present)
```sql
INSERT INTO notification_type (value) VALUES
  ('settlement_requested'),
  ('settlement_confirmed'),
  ('settlement_rejected'),
  ('group_deleted')
ON CONFLICT (value) DO NOTHING;
```

---

## File Structure (New/Modified)

### New Files
| File | Purpose |
|------|---------|
| `src/services/settlement.service.ts` | Settlement CRUD and state management |
| `src/services/notification.service.ts` | Notification CRUD |
| `src/routes/settlements.ts` | Settlement API endpoints |
| `src/routes/notifications.ts` | Notification API endpoints |
| `src/__tests__/integration/setup.ts` | Integration test setup |
| `src/__tests__/integration/factories.ts` | Test data factories |
| `src/__tests__/integration/auth.integration.test.ts` | Auth integration tests |
| `src/__tests__/integration/settlements.integration.test.ts` | Settlement integration tests |
| `src/__tests__/unit/settlement.service.test.ts` | Settlement unit tests |
| `src/__tests__/unit/notification.service.test.ts` | Notification unit tests |

### Modified Files
| File | Changes |
|------|---------|
| `src/services/balance.service.ts` | Fix raw SQL, include settlements |
| `src/services/expense.service.ts` | Optimize paidBy filter |
| `src/routes/index.ts` | Register new routes |
| `src/routes/groups.ts` | Complete stubbed AC-1.10 (debt warning) |
| `.env.example` | Add DATABASE_URL_TEST |

---

## Risk Mitigation

| Risk | Mitigation |
|------|------------|
| Complex state machine | Strict validation + comprehensive tests |
| Balance calculation bugs | Unit tests for all scenarios |
| Integration test flakiness | Transaction rollback + proper cleanup |
| Performance with large groups | Indexed queries, pagination |

---

## Task Phases

### Phase 1: Technical Debt (Priority: High)
1. Fix raw SQL in balance.service.ts
2. Optimize listExpenses paidBy filter
3. Run migrations for settlement fields

### Phase 2: Settlement Service (Priority: High)
4. Create settlement.service.ts
5. Create settlements.ts routes
6. Update balance calculation for settlements

### Phase 3: Notification Service (Priority: High)
7. Create notification.service.ts
8. Create notifications.ts routes
9. Add settlement notifications
10. Complete stubbed ACs (debt warning, group deletion)

### Phase 4: Test Infrastructure (Priority: High)
11. Set up test database configuration
12. Create integration test framework
13. Write auth integration tests
14. Write settlement integration tests

### Phase 5: Unit Tests (Priority: Medium)
15. Settlement service unit tests
16. Notification service unit tests

---

## Estimation

| Phase | Complexity | Tasks |
|-------|------------|-------|
| Phase 1: Tech Debt | Low | 3 |
| Phase 2: Settlement Service | High | 3 |
| Phase 3: Notification Service | Medium | 4 |
| Phase 4: Test Infrastructure | Medium | 4 |
| Phase 5: Unit Tests | Low | 2 |
| **Total** | | **16** |

---

## Dependencies

```
Phase 1 ──┬──> Phase 2 ──> Phase 3
          │
          └──> Phase 4 ──> Phase 5
```

- Phase 2 depends on Phase 1 (balance service fix)
- Phase 3 depends on Phase 2 (settlement notifications)
- Phase 4 can run in parallel with Phases 2-3
- Phase 5 depends on Phase 4 (test framework)

---

## Sign-off

| Field | Value |
|-------|-------|
| **Lead Developer** | Claude (Lead Dev mode) |
| **Date** | 2026-01-20 |
| **Status** | ✅ Planning Complete |
| **Notes** | Schemas exist, main work is services and tests. 16 tasks identified. |
