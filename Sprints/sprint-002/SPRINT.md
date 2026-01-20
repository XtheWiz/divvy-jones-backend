# Sprint 002

## Sprint Information
| Field | Value |
|-------|-------|
| **Sprint Number** | 002 |
| **Start Date** | 2026-01-20 |
| **End Date** | 2026-02-03 |
| **Sprint Goal** | Address technical debt, complete group management, and implement core expense tracking |
| **Status** | Ready for Planning |

---

## Team Allocation

| Role | Agent | Availability |
|------|-------|--------------|
| Project Owner | Claude (PO mode) | 100% |
| Lead Developer | Claude (Lead Dev mode) | 100% |
| Backend Developer | Claude (Backend mode) | 100% |
| QA Engineer | Claude (QA mode) | 100% |

---

## Previous Retrospective Action Items

**From Sprint 001 - MUST ADDRESS:**

| Action Item | Priority | Owner |
|-------------|----------|-------|
| Fix dynamic imports in users.ts | High | Backend Dev |
| Add JWT secret production check | High | Backend Dev |
| Set up test database | High | Lead Dev |
| Add rate limiting to auth endpoints | High | Backend Dev |
| Replace raw SQL with inArray | Medium | Backend Dev |

---

## Sprint Goal

> **Address technical debt from Sprint 001, complete group management capabilities, and implement core expense tracking functionality**

By the end of this sprint, users should be able to:
1. (Tech Debt) Have a more secure, performant, and testable backend
2. Edit, leave, and manage their groups
3. Create and manage expenses within groups
4. See who owes whom within a group

This sprint builds on the authentication and basic group foundation from Sprint 001 to deliver the core expense-splitting functionality.

---

## Features to Deliver

### Feature 0: Technical Debt & Infrastructure
**Backlog ID:** N/A (Retro Action Items)
**Priority:** P0 - Critical

**Description:**
Address all high-priority action items from Sprint 001 retrospective to improve code quality, security, and testability.

**Acceptance Criteria:**

#### Code Quality Fixes
- [ ] **AC-0.1:** Dynamic imports in users.ts replaced with static imports at file top
- [ ] **AC-0.2:** Raw SQL template in group.service.ts replaced with Drizzle's `inArray` operator

#### Security Improvements
- [ ] **AC-0.3:** JWT_SECRET environment variable is required in production (throws error if missing)
- [ ] **AC-0.4:** Rate limiting implemented on auth endpoints (5 requests per minute per IP)
- [ ] **AC-0.5:** Rate limit exceeded returns 429 Too Many Requests

#### Test Infrastructure
- [ ] **AC-0.6:** Test database configuration documented in .env.example
- [ ] **AC-0.7:** Database integration tests can run against test database
- [ ] **AC-0.8:** Test setup/teardown handles database state properly

---

### Feature 1: Complete Group Management
**Backlog ID:** BL-002 (completion)
**Priority:** P0 - Critical

**Description:**
Complete the remaining group management features: edit group details, leave group, and view/regenerate join codes.

**Acceptance Criteria:**

#### Edit Group
- [ ] **AC-1.1:** Owner/admin can update group name (PUT /groups/:id)
- [ ] **AC-1.2:** Owner/admin can update group description
- [ ] **AC-1.3:** Owner/admin can change default currency
- [ ] **AC-1.4:** Regular members cannot edit group settings (403)
- [ ] **AC-1.5:** Group name validation same as create (1-100 chars)
- [ ] **AC-1.6:** Returns updated group details on success

#### Leave Group
- [ ] **AC-1.7:** Member can leave a group they belong to (POST /groups/:id/leave)
- [ ] **AC-1.8:** Owner cannot leave if they are the only owner
- [ ] **AC-1.9:** Owner can transfer ownership before leaving
- [ ] **AC-1.10:** Member with unsettled debts receives warning but can still leave
- [ ] **AC-1.11:** Left member no longer appears in member list
- [ ] **AC-1.12:** Left member can rejoin via join code

#### Join Code Management
- [ ] **AC-1.13:** Owner/admin can regenerate join code (POST /groups/:id/regenerate-code)
- [ ] **AC-1.14:** Old join code becomes invalid after regeneration
- [ ] **AC-1.15:** Returns new join code on success

#### Delete Group
- [ ] **AC-1.16:** Only owner can delete group (DELETE /groups/:id)
- [ ] **AC-1.17:** Deletion is soft delete (sets deletedAt)
- [ ] **AC-1.18:** Deleted group no longer appears in any member's group list
- [ ] **AC-1.19:** Members are notified of deletion (if notifications exist)

---

### Feature 2: Core Expense Tracking
**Backlog ID:** BL-003 (partial)
**Priority:** P0 - Critical

**Description:**
Implement the core expense creation and management functionality. Users can add expenses, split them among group members, and track who paid and who owes.

**Acceptance Criteria:**

#### Create Expense
- [ ] **AC-2.1:** Member can create expense in their group (POST /groups/:id/expenses)
- [ ] **AC-2.2:** Expense requires: title, amount, currency, paidBy (user ID)
- [ ] **AC-2.3:** Expense optional: description, category, date (defaults to now)
- [ ] **AC-2.4:** Amount must be positive number with max 2 decimal places
- [ ] **AC-2.5:** Currency must be valid ISO currency code
- [ ] **AC-2.6:** PaidBy must be a current member of the group
- [ ] **AC-2.7:** Title must be 1-200 characters
- [ ] **AC-2.8:** Category must be from predefined list or 'other'
- [ ] **AC-2.9:** Returns created expense with ID and timestamp

#### Expense Splits
- [ ] **AC-2.10:** Default split: equal among all group members
- [ ] **AC-2.11:** Custom split: specify exact amount per member
- [ ] **AC-2.12:** Custom split: specify percentage per member
- [ ] **AC-2.13:** Custom split: specify weight/shares per member
- [ ] **AC-2.14:** Split amounts must sum to total expense amount
- [ ] **AC-2.15:** Can exclude members from split
- [ ] **AC-2.16:** Split stored with expense for audit trail

#### View Expenses
- [ ] **AC-2.17:** Member can list expenses in their group (GET /groups/:id/expenses)
- [ ] **AC-2.18:** List supports pagination (page, limit params)
- [ ] **AC-2.19:** List supports filtering by date range
- [ ] **AC-2.20:** List supports filtering by category
- [ ] **AC-2.21:** List supports filtering by paidBy user
- [ ] **AC-2.22:** Returns total count for pagination
- [ ] **AC-2.23:** Expenses sorted by date descending (newest first)

#### View Single Expense
- [ ] **AC-2.24:** Member can view expense details (GET /groups/:id/expenses/:expenseId)
- [ ] **AC-2.25:** Details include full split breakdown per member
- [ ] **AC-2.26:** Details include who created and when
- [ ] **AC-2.27:** Non-members cannot view expense (403)

#### Edit Expense
- [ ] **AC-2.28:** Expense creator or admin can edit expense (PUT /groups/:id/expenses/:expenseId)
- [ ] **AC-2.29:** Can edit title, description, amount, category, date
- [ ] **AC-2.30:** Can edit splits (recalculates balances)
- [ ] **AC-2.31:** Cannot edit if expense has related settlements (settled)
- [ ] **AC-2.32:** Tracks updatedAt and updatedBy

#### Delete Expense
- [ ] **AC-2.33:** Expense creator or admin can delete expense (DELETE /groups/:id/expenses/:expenseId)
- [ ] **AC-2.34:** Deletion is soft delete (sets deletedAt)
- [ ] **AC-2.35:** Cannot delete if expense has related settlements
- [ ] **AC-2.36:** Deleted expenses don't appear in list or affect balances

---

### Feature 3: Balance Calculation
**Backlog ID:** BL-004 (partial - calculation only)
**Priority:** P0 - Critical

**Description:**
Calculate and display who owes whom within a group based on expenses and splits.

**Acceptance Criteria:**

#### Group Balances
- [ ] **AC-3.1:** Calculate net balance for each member (GET /groups/:id/balances)
- [ ] **AC-3.2:** Positive balance = member is owed money
- [ ] **AC-3.3:** Negative balance = member owes money
- [ ] **AC-3.4:** Sum of all balances equals zero
- [ ] **AC-3.5:** Returns simplified debts (who pays whom)
- [ ] **AC-3.6:** Simplified debts minimize number of transactions

#### Individual Balance View
- [ ] **AC-3.7:** Member can see their balance in group
- [ ] **AC-3.8:** Shows breakdown: total paid, total owed, net balance
- [ ] **AC-3.9:** Shows list of who they owe and who owes them

---

## Sprint Metrics

| Metric | Planned | Actual |
|--------|---------|--------|
| Features | 4 (0-3) | - |
| Acceptance Criteria | 53 | - |
| Estimated Complexity | Medium-High | - |
| Bugs Found | - | - |
| Bugs Fixed | - | - |

---

## Dependencies & Risks

### Dependencies
- Sprint 001 code merged to develop ✅
- Existing database schema for expenses and splits
- PostgreSQL test database for integration tests

### Risks
| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Balance calculation complexity | Medium | Medium | Start with simple algorithm, optimize later |
| Split validation edge cases | Medium | Low | Thorough test coverage |
| Rate limiting integration | Low | Low | Use well-tested Elysia plugin |

---

## Definition of Done

A feature is considered DONE when:
1. All acceptance criteria are met
2. Code passes Lead Dev review
3. Unit tests written and passing
4. Integration tests passing (new requirement)
5. API endpoints documented (Swagger)
6. QA sign-off received
7. Code merged to develop branch

---

## API Endpoints (Expected)

### Technical Debt
| Method | Endpoint | Description |
|--------|----------|-------------|
| - | - | Internal fixes, no new endpoints |

### Group Management
| Method | Endpoint | Description |
|--------|----------|-------------|
| PUT | `/groups/:id` | Update group details |
| POST | `/groups/:id/leave` | Leave a group |
| POST | `/groups/:id/regenerate-code` | Regenerate join code |
| DELETE | `/groups/:id` | Delete group (soft) |

### Expense Tracking
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/groups/:id/expenses` | Create expense |
| GET | `/groups/:id/expenses` | List expenses |
| GET | `/groups/:id/expenses/:expenseId` | Get expense details |
| PUT | `/groups/:id/expenses/:expenseId` | Update expense |
| DELETE | `/groups/:id/expenses/:expenseId` | Delete expense (soft) |
| GET | `/groups/:id/balances` | Get group balances |

---

## Expense Categories

Predefined expense categories for AC-2.8:
- `food` - Food & Dining
- `transport` - Transportation
- `accommodation` - Accommodation
- `entertainment` - Entertainment
- `shopping` - Shopping
- `utilities` - Utilities & Bills
- `health` - Health & Medical
- `travel` - Travel
- `groceries` - Groceries
- `other` - Other

---

## Sign-off

| Role | Name | Date | Signature |
|------|------|------|-----------|
| Project Owner | Claude (PO) | 2026-01-20 | [x] Approved |
| Lead Developer | | | [ ] Approved |
