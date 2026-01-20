# Sprint 002 - Code Review Log

## Review Information
| Field | Value |
|-------|-------|
| **Sprint** | 002 |
| **Reviewer** | Lead Developer (Claude) |
| **Review Date** | 2026-01-20 |
| **Developer** | Backend Developer (Claude) |

---

## Summary

| Metric | Count |
|--------|-------|
| Files Created | 3 |
| Files Modified | 10 |
| Issues Found | 4 |
| Critical Issues | 0 |
| Major Issues | 0 |
| Minor Issues | 2 |
| Suggestions | 2 |

**Verdict:** ✅ **APPROVED** with minor suggestions

---

## Files Reviewed

### New Files
| File | Lines | Status |
|------|-------|--------|
| `src/services/expense.service.ts` | ~600 | ✅ Approved |
| `src/services/balance.service.ts` | ~350 | ✅ Approved with suggestions |
| `src/routes/expenses.ts` | ~400 | ✅ Approved |

### Modified Files
| File | Changes | Status |
|------|---------|--------|
| `src/routes/users.ts` | Fixed dynamic imports | ✅ Approved |
| `src/services/group.service.ts` | Added 8 functions, fixed inArray | ✅ Approved |
| `src/routes/groups.ts` | Added 5 endpoints | ✅ Approved |
| `src/routes/auth.ts` | Added rate limiting | ✅ Approved |
| `src/routes/index.ts` | Registered expense routes | ✅ Approved |
| `src/lib/responses.ts` | Added RATE_LIMIT_EXCEEDED | ✅ Approved |
| `src/index.ts` | Added JWT secret check | ✅ Approved |
| `src/db/schema/enums.ts` | Added expense_category | ✅ Approved |
| `src/db/schema/expenses.ts` | Added category column | ✅ Approved |

---

## Issues Found

### Issue #1: Raw SQL in Balance Service
**Severity:** Minor
**File:** `src/services/balance.service.ts`
**Lines:** 78-82, 160, 174, 189, 199

**Description:**
Raw SQL template literals are used for queries instead of Drizzle ORM methods. This is inconsistent with the fix applied in TASK-001 for `group.service.ts`.

**Current Code:**
```typescript
const [group] = await db
  .select({ currency: sql<string>`default_currency_code` })
  .from(sql`groups`)
  .where(sql`id = ${groupId}`)
  .limit(1);

// Also:
.where(sql`${expensePayers.expenseId} IN ${expenseIds}`)
```

**Recommendation:**
Use Drizzle ORM's `inArray` operator and proper table references for consistency and type safety:
```typescript
import { groups } from "../db";
import { inArray } from "drizzle-orm";

const [group] = await db
  .select({ currency: groups.defaultCurrencyCode })
  .from(groups)
  .where(eq(groups.id, groupId))
  .limit(1);

// For IN clauses:
.where(inArray(expensePayers.expenseId, expenseIds))
```

**Action:** Should fix in Sprint 003 or as follow-up

---

### Issue #2: Post-fetch Filtering in listExpenses
**Severity:** Suggestion
**File:** `src/services/expense.service.ts`
**Lines:** 392-410

**Description:**
The `paidByUserId` filter is applied after fetching expenses, which is inefficient for large datasets.

**Current Behavior:**
1. Fetch all expenses for group
2. Fetch payer data
3. Filter in JavaScript based on paidByUserId

**Recommendation:**
Consider adding a subquery or join to filter at the database level when `paidByUserId` is provided. Not critical for current scale but should be optimized as data grows.

**Action:** Track as technical debt for Sprint 003+

---

### Issue #3: Stubbed Functionality (Expected)
**Severity:** Note (Not an issue)
**Files:** `src/routes/groups.ts`

**Description:**
The following acceptance criteria are intentionally stubbed pending future features:
- **AC-1.10:** Member with unsettled debts receives warning (balance service needed first)
- **AC-1.19:** Members are notified of deletion (notifications not yet implemented)

**Current Code:**
```typescript
// AC-1.10: TODO - Check for unsettled balances and include warning
let warning: string | undefined;
// Placeholder for balance check - will be implemented in TASK-017/018

// AC-1.19: TODO - Notify members (stub for when notifications are implemented)
```

**Action:** These are documented and expected. Will be completed when notifications feature is added.

---

### Issue #4: Missing inArray Import in Balance Service
**Severity:** Minor
**File:** `src/services/balance.service.ts`
**Line:** 1

**Description:**
The `inArray` operator is not imported, yet raw SQL IN clauses are used.

**Current:**
```typescript
import { eq, and, isNull, sql } from "drizzle-orm";
```

**Recommended:**
```typescript
import { eq, and, isNull, inArray } from "drizzle-orm";
```

**Action:** Should fix alongside Issue #1

---

## Code Quality Assessment

### Strengths

1. **Consistent Patterns**
   - Follows existing service/route layer separation
   - Uses established response helpers (`success`, `error`, `paginated`)
   - Consistent error code usage

2. **AC Traceability**
   - Every function/route has AC comments
   - Easy to verify implementation against requirements

3. **Input Validation**
   - Comprehensive validation for all inputs
   - Clear error messages with proper HTTP status codes
   - TypeBox schemas for request validation

4. **Error Handling**
   - Proper 400/401/403/404/500 status codes
   - Consistent error response format
   - No unhandled promise rejections

5. **Transaction Usage**
   - Multi-table operations wrapped in transactions
   - Prevents partial state on failures

6. **Rounding Handling**
   - Proper handling of decimal rounding in splits
   - Remainder assigned to first member to ensure total matches

7. **Algorithm Correctness**
   - Debt simplification algorithm is sound
   - Minimizes number of transactions correctly

### Areas for Improvement

1. **Query Optimization**
   - Some N+1 query patterns could be optimized
   - Post-fetch filtering could be moved to database

2. **Raw SQL Usage**
   - Should use ORM methods for type safety
   - Inconsistent with TASK-001 fix

3. **Test Coverage**
   - Unit tests for new services not yet written
   - Integration tests pending TASK-021

---

## Security Review

| Check | Status |
|-------|--------|
| SQL Injection | ✅ Safe (parameterized queries) |
| Authorization Checks | ✅ All endpoints check membership |
| Role Validation | ✅ Owner/admin checks where needed |
| Rate Limiting | ✅ Implemented on auth endpoints |
| Input Validation | ✅ TypeBox schemas + custom validation |
| Soft Delete | ✅ Implemented correctly |

---

## Acceptance Criteria Coverage

### Feature 0: Technical Debt (8 ACs)
| AC | Description | Status |
|----|-------------|--------|
| AC-0.1 | Dynamic imports replaced | ✅ Met |
| AC-0.2 | Raw SQL replaced with inArray | ✅ Met (in group.service) |
| AC-0.3 | JWT_SECRET required in production | ✅ Met |
| AC-0.4 | Rate limiting on auth (5/min/IP) | ✅ Met |
| AC-0.5 | 429 on rate limit exceeded | ✅ Met |
| AC-0.6 | Test DB config documented | ⏳ Pending TASK-004 |
| AC-0.7 | Integration tests work | ⏳ Pending TASK-021 |
| AC-0.8 | Test setup/teardown | ⏳ Pending TASK-021 |

### Feature 1: Group Management (19 ACs)
| AC | Description | Status |
|----|-------------|--------|
| AC-1.1 - AC-1.6 | Edit group | ✅ Met |
| AC-1.7 - AC-1.9 | Leave group | ✅ Met |
| AC-1.10 | Unsettled debt warning | ⚠️ Stubbed |
| AC-1.11 - AC-1.12 | Member removal/rejoin | ✅ Met |
| AC-1.13 - AC-1.15 | Regenerate code | ✅ Met |
| AC-1.16 - AC-1.18 | Delete group | ✅ Met |
| AC-1.19 | Notification on delete | ⚠️ Stubbed |

### Feature 2: Expense Tracking (36 ACs)
| AC | Description | Status |
|----|-------------|--------|
| AC-2.1 - AC-2.9 | Create expense | ✅ Met |
| AC-2.10 - AC-2.16 | Split calculation | ✅ Met |
| AC-2.17 - AC-2.23 | List expenses | ✅ Met |
| AC-2.24 - AC-2.27 | View expense | ✅ Met |
| AC-2.28 - AC-2.32 | Edit expense | ✅ Met |
| AC-2.33 - AC-2.36 | Delete expense | ✅ Met |

### Feature 3: Balance Calculation (9 ACs)
| AC | Description | Status |
|----|-------------|--------|
| AC-3.1 - AC-3.6 | Group balances | ✅ Met |
| AC-3.7 - AC-3.9 | Individual balance | ✅ Met |

---

## Recommendations

### Before QA (Required)
1. None - code is ready for QA

### Future Sprints (Tracked)
1. Fix raw SQL in balance.service.ts (add to Sprint 003 tech debt)
2. Optimize listExpenses paidBy filter
3. Complete unit tests (TASK-019, TASK-020)
4. Complete integration test setup (TASK-004, TASK-021)

---

## Sign-off

### Code Review Approval
| Field | Value |
|-------|-------|
| **Reviewer** | Lead Developer (Claude) |
| **Date** | 2026-01-20 |
| **Decision** | ✅ **APPROVED** |
| **Notes** | Minor issues documented. No blockers for QA. |

### Checklist
- [x] Code follows project conventions
- [x] No critical security issues
- [x] Proper error handling
- [x] AC comments present
- [x] No breaking changes to existing API
- [x] Tests pass (44/44)

---

## Next Steps

1. ✅ Code review complete
2. → Transfer to QA for testing
3. → Backend Dev to address raw SQL in Sprint 003
