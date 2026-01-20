# Sprint 002 Planning Session

## Session Information
| Field | Value |
|-------|-------|
| **Sprint** | 002 |
| **Date** | 2026-01-20 |
| **Facilitator** | Lead Developer |
| **Attendees** | PO, Lead Dev, Backend Dev, QA |

---

## Sprint Goal Review

> **Address technical debt from Sprint 001, complete group management capabilities, and implement core expense tracking functionality**

### Scope Confirmation
- **Feature 0:** Technical Debt & Infrastructure (8 ACs) - P0
- **Feature 1:** Complete Group Management (19 ACs) - P0
- **Feature 2:** Core Expense Tracking (36 ACs) - P0
- **Feature 3:** Balance Calculation (9 ACs) - P0

**Total:** 53 Acceptance Criteria

---

## Technical Analysis

### Existing Schema Assessment

The database schema is **already well-designed** for expense tracking. Key findings:

#### Expenses Table
```
expenses: id, groupId, createdByMemberId, name, label, subtotal,
          serviceChargePct, vatPct, discountPct, discountIsPercent,
          currencyCode, expenseDate, isSettlement, deletedAt
```
- Supports soft delete via `deletedAt`
- `isSettlement` flag distinguishes settlements from regular expenses
- Service charge, VAT, and discount fields for complex calculations

#### Expense Items (Line Items)
```
expenseItems: id, expenseId, name, quantity, unitPrice, subtotal
```
- Supports itemized expenses
- Each item can have different splits

#### Expense Item Members (Splits)
```
expenseItemMembers: id, itemId, memberId, shareMode, weight, exactAmount
```
- **shareMode:** equal, weight, exact, percent
- `weight` for proportional splits
- `exactAmount` for fixed amounts

#### Expense Payers
```
expensePayers: id, expenseId, memberId, amount
```
- Multiple payers per expense supported
- Tracks exact amount each person paid

#### Settlements
```
settlements: id, groupId, fromMemberId, toMemberId, amount,
             currencyCode, settledAt, notes, isVerified, expenseId
```
- Links to expense via `expenseId` when created as settlement expense
- `isVerified` for confirmation workflow (future feature)

### Schema Mapping to ACs

| AC Requirement | Schema Support | Notes |
|----------------|----------------|-------|
| Title (AC-2.7) | `expenses.name` | ✅ Ready |
| Amount (AC-2.4) | `expenses.subtotal` | ✅ Ready (precision: 20,4) |
| Currency (AC-2.5) | `expenses.currencyCode` | ✅ FK to currencies |
| PaidBy (AC-2.6) | `expensePayers` | ✅ Multiple payers supported |
| Description | `expenses.label` | ✅ Optional field |
| Category (AC-2.8) | Need to add | ❌ Add `category` column |
| Date (AC-2.3) | `expenses.expenseDate` | ✅ Ready |
| Equal split (AC-2.10) | `shareMode = 'equal'` | ✅ Ready |
| Exact split (AC-2.11) | `shareMode = 'exact'` | ✅ Ready |
| Percent split (AC-2.12) | `shareMode = 'percent'` | ✅ Ready |
| Weight split (AC-2.13) | `shareMode = 'weight'` | ✅ Ready |
| Soft delete (AC-2.34) | `expenses.deletedAt` | ✅ Ready |

---

## Technical Decisions

### TD-1: Expense Category Implementation

**Decision:** Add `category` column to expenses table

```typescript
// Migration needed
category: text("category").default("other")
```

**Categories (from SPRINT.md):**
- food, transport, accommodation, entertainment, shopping
- utilities, health, travel, groceries, other

**Rationale:** Simple text field with application-level validation. No need for separate enum table.

---

### TD-2: Simplified Split API

**Decision:** Use simplified split structure for API, map to item-level splits internally

**API Request Format:**
```typescript
{
  title: string,
  amount: number,
  currency: string,
  paidBy: string, // userId (maps to memberId)
  splits: {
    type: "equal" | "exact" | "percent" | "weight",
    members?: string[], // for equal split exclusions
    values?: Record<string, number> // memberId -> value
  }
}
```

**Rationale:**
- Schema supports line-item splits, but most expenses are single items
- API abstracts complexity; internally creates single expense item
- Future: extend to support itemized expenses

---

### TD-3: Balance Calculation Algorithm

**Decision:** Calculate balances on-demand, not stored

**Algorithm:**
1. For each expense in group (not deleted, not settlement):
   - Calculate each member's share based on splits
   - Track who paid what
2. Net balance = (total paid) - (total owed)
3. Simplify debts using debt simplification algorithm

**Debt Simplification:**
```
1. Calculate net balance for each member
2. Separate into creditors (positive) and debtors (negative)
3. Match largest debtor to largest creditor
4. Repeat until all balanced
```

**Rationale:**
- Real-time calculation ensures accuracy
- No sync issues between expenses and cached balances
- Performance acceptable for typical group sizes (<50 members)

---

### TD-4: Rate Limiting Implementation

**Decision:** Use `elysia-rate-limit` plugin

```typescript
import { rateLimit } from 'elysia-rate-limit'

app.use(rateLimit({
  duration: 60000, // 1 minute
  max: 5, // 5 requests
  generator: (request) => request.headers.get('x-forwarded-for') || 'unknown'
}))
```

**Scope:** Auth endpoints only (`/auth/register`, `/auth/login`, `/auth/refresh`)

---

### TD-5: Test Database Setup

**Decision:** Use environment-based database URL

```
# .env.example
DATABASE_URL=postgres://user:pass@localhost:5432/divvy_jones
DATABASE_URL_TEST=postgres://user:pass@localhost:5432/divvy_jones_test
```

**Test Setup:**
```typescript
// test/setup.ts
const db = process.env.NODE_ENV === 'test'
  ? connectToTestDB()
  : connectToDB()
```

---

### TD-6: JWT Secret Production Check

**Decision:** Throw on startup if JWT_SECRET missing in production

```typescript
if (process.env.NODE_ENV === 'production' && !process.env.JWT_SECRET) {
  throw new Error('JWT_SECRET is required in production')
}
```

---

### TD-7: Member Can Leave with Unsettled Balance

**Decision:** Allow leaving with warning, preserve expense history

**Behavior:**
1. Check for unsettled balances
2. If balance exists, return warning in response but proceed
3. Remove member from group (soft delete membership)
4. Historical expenses remain intact (references preserved)
5. Balance shows as "former member" debt

---

### TD-8: Expense Edit Restrictions

**Decision:** Cannot edit if linked to settlement

**Check:**
```typescript
// Before allowing edit
const linkedSettlement = await db.query.settlements.findFirst({
  where: eq(settlements.expenseId, expenseId)
})
if (linkedSettlement) {
  throw new ForbiddenError('Cannot edit expense with settlements')
}
```

---

## Architecture Notes

### New Service Files
```
src/services/
├── expense.service.ts    # Expense CRUD operations
├── balance.service.ts    # Balance calculation logic
└── group.service.ts      # (existing - add edit/leave/delete)
```

### New Route Files
```
src/routes/
├── expenses.ts           # Expense endpoints under /groups/:id/expenses
└── groups.ts             # (existing - add PUT, DELETE, /leave, /regenerate-code)
```

### Updated Files
```
src/db/schema/expenses.ts # Add category column
src/middleware/auth.ts    # Add JWT secret check
src/app.ts                # Add rate limiting
.env.example              # Add test database config
```

---

## Database Migration Required

### Migration: Add category to expenses
```sql
ALTER TABLE expenses ADD COLUMN category TEXT DEFAULT 'other';
```

**Note:** Run migration before implementing expense features.

---

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Balance calculation bugs | Medium | High | Comprehensive unit tests with edge cases |
| Split validation complexity | Medium | Medium | Test all 4 split modes thoroughly |
| Rate limit blocking legitimate users | Low | Low | Generous limits, clear 429 responses |
| Migration affects existing data | Low | Low | No existing expenses; migration is additive |

---

## Task Breakdown Strategy

### Feature 0: Technical Debt (8 ACs → 5 Tasks)
- Group related ACs into single tasks
- Quick wins, can be done first

### Feature 1: Group Management (19 ACs → 5 Tasks)
- One task per endpoint group (edit, leave, regenerate-code, delete)
- Plus one for notification stub

### Feature 2: Expense Tracking (36 ACs → 8 Tasks)
- Create expense + splits (10 ACs)
- List expenses with filters (7 ACs)
- View expense details (4 ACs)
- Edit expense (5 ACs)
- Delete expense (4 ACs)
- Expense service foundation
- Split calculation service
- Expense tests

### Feature 3: Balance Calculation (9 ACs → 3 Tasks)
- Balance calculation service
- Balance endpoints
- Balance tests

**Total Estimated Tasks: ~21**

---

## Dependencies

```
Feature 0 (Tech Debt) → No dependencies, start immediately
Feature 1 (Group Mgmt) → No dependencies, can parallel with F0
Feature 2 (Expenses) → Depends on category migration
Feature 3 (Balances) → Depends on F2 (expenses)
```

### Recommended Order
1. **Parallel Track A:** Technical Debt (Tasks 1-5)
2. **Parallel Track B:** Group Management (Tasks 6-10)
3. **Sequential:** Expense Tracking (Tasks 11-18)
4. **Sequential:** Balance Calculation (Tasks 19-21)

---

## Definition of Ready

Before starting a task:
- [ ] Acceptance criteria understood
- [ ] Technical approach decided
- [ ] Dependencies resolved
- [ ] Test cases identified

---

## Sign-off

| Role | Name | Date | Signature |
|------|------|------|-----------|
| Lead Developer | Claude (Lead Dev) | 2026-01-20 | [x] Approved |
| Project Owner | Claude (PO) | | [ ] Acknowledged |

---

## Next Steps

1. Create TASKS.md with full task breakdown
2. Assign tasks to Backend Developer
3. Backend Developer starts with Technical Debt (Track A)
4. QA Engineer prepares test cases for expense functionality
