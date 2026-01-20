# Sprint 003

## Sprint Information
| Field | Value |
|-------|-------|
| **Sprint Number** | 003 |
| **Sprint Goal** | Settlement System & Test Infrastructure |
| **Start Date** | 2026-01-20 |
| **End Date** | TBD |
| **Status** | Planning |

---

## Sprint Goal

> Enable users to record and track settlements between group members, completing the core expense-splitting workflow. Establish integration test infrastructure for ongoing quality assurance.

---

## Team Allocation

| Role | Assigned To | Availability |
|------|-------------|--------------|
| Project Owner | Claude (PO mode) | Full |
| Lead Developer | Claude (Lead Dev mode) | Full |
| Backend Developer | Claude (Backend mode) | Full |
| QA Engineer | Claude (QA mode) | Full |

---

## Previous Sprint Action Items

From Sprint 002 Retrospective:

| Action Item | Priority | Status |
|-------------|----------|--------|
| Fix raw SQL in balance.service.ts | High | 🔄 This Sprint |
| Add inArray import to balance.service.ts | High | 🔄 This Sprint |
| Set up test database config (TASK-004) | High | 🔄 This Sprint |
| Create integration test framework (TASK-021) | High | 🔄 This Sprint |
| Optimize listExpenses paidBy filter | Medium | 🔄 This Sprint |
| Complete stubbed ACs (notifications) | Low | ⏳ Future Sprint |

---

## Features

### Feature 0: Technical Debt & Test Infrastructure
**Priority:** High
**Source:** Sprint 002 Carry-over

Address technical debt from Sprint 002 and establish integration test infrastructure.

#### Acceptance Criteria

##### Code Quality Fixes
| AC | Description | Priority |
|----|-------------|----------|
| AC-0.1 | Raw SQL in balance.service.ts replaced with Drizzle ORM methods | High |
| AC-0.2 | `inArray` operator imported and used for IN clauses | High |
| AC-0.3 | All `sql` template literals removed from balance.service.ts | High |
| AC-0.4 | Optimize listExpenses to filter paidBy at database level | Medium |

##### Test Infrastructure
| AC | Description | Priority |
|----|-------------|----------|
| AC-0.5 | Test database configuration documented in .env.example | High |
| AC-0.6 | Test database uses separate schema or database | High |
| AC-0.7 | Integration test framework set up with database seeding | High |
| AC-0.8 | Test cleanup runs after each test suite | High |
| AC-0.9 | At least 5 integration tests for auth endpoints | High |
| AC-0.10 | At least 5 integration tests for expense endpoints | High |

---

### Feature 1: Settlement System
**Priority:** P0 - Critical (MVP)
**Source:** BL-004

Enable users to record settlements (payments) between group members to resolve debts.

#### User Stories

**US-1.1:** As a group member, I want to record when I pay another member so our balances are updated.

**US-1.2:** As a group member, I want to see my settlement history so I can track past payments.

**US-1.3:** As a group member, I want to see suggested settlements so I know who to pay and how much.

#### Acceptance Criteria

##### Create Settlement
| AC | Description | Priority |
|----|-------------|----------|
| AC-1.1 | Any group member can record a settlement | High |
| AC-1.2 | Settlement requires: payer (from), payee (to), amount, currency | High |
| AC-1.3 | Amount must be positive with max 2 decimal places | High |
| AC-1.4 | Payer and payee must be active members of the group | High |
| AC-1.5 | Payer and payee cannot be the same person | High |
| AC-1.6 | Settlement currency defaults to group's default currency | Medium |
| AC-1.7 | Optional: settlement date (defaults to now) | Low |
| AC-1.8 | Optional: note/description for the settlement | Low |
| AC-1.9 | Settlement is created with status "pending" | High |
| AC-1.10 | Return created settlement with ID and timestamp | High |

##### Confirm/Complete Settlement
| AC | Description | Priority |
|----|-------------|----------|
| AC-1.11 | Payee can confirm receipt of payment | High |
| AC-1.12 | Settlement status changes to "completed" on confirmation | High |
| AC-1.13 | Only pending settlements can be confirmed | High |
| AC-1.14 | Group balances are recalculated after confirmation | High |
| AC-1.15 | Settlement affects totalPaid/totalOwed in balance calculation | High |

##### Cancel/Reject Settlement
| AC | Description | Priority |
|----|-------------|----------|
| AC-1.16 | Payer can cancel a pending settlement | High |
| AC-1.17 | Payee can reject a pending settlement | High |
| AC-1.18 | Cancelled/rejected settlements don't affect balances | High |
| AC-1.19 | Settlement status changes to "cancelled" or "rejected" | High |
| AC-1.20 | Reason for rejection is optional but stored | Low |

##### List Settlements
| AC | Description | Priority |
|----|-------------|----------|
| AC-1.21 | Member can list all settlements in a group | High |
| AC-1.22 | Paginated response (default 20, max 100) | High |
| AC-1.23 | Filter by status (pending, completed, cancelled, rejected) | High |
| AC-1.24 | Filter by date range | Medium |
| AC-1.25 | Filter by involving user (as payer or payee) | Medium |
| AC-1.26 | Sorted by date (newest first) | High |

##### View Settlement Details
| AC | Description | Priority |
|----|-------------|----------|
| AC-1.27 | Member can view settlement details | High |
| AC-1.28 | Shows payer, payee, amount, currency, status | High |
| AC-1.29 | Shows created date, confirmed date (if applicable) | High |
| AC-1.30 | Shows note/description if provided | Low |

##### Suggested Settlements
| AC | Description | Priority |
|----|-------------|----------|
| AC-1.31 | Endpoint returns suggested settlements from simplifiedDebts | High |
| AC-1.32 | Suggestions show who should pay whom and how much | High |
| AC-1.33 | Suggestions are based on current (real-time) balances | High |

---

### Feature 2: Settlement Notifications (Foundation)
**Priority:** P1 - High
**Source:** BL-006 (partial), Sprint 002 stubbed ACs

Establish notification foundation to support settlement workflow and complete stubbed ACs.

#### Acceptance Criteria

##### Notification Model
| AC | Description | Priority |
|----|-------------|----------|
| AC-2.1 | Notification schema created (userId, type, message, read, data) | High |
| AC-2.2 | Notification types defined (settlement_requested, settlement_confirmed, etc.) | High |
| AC-2.3 | Notifications are soft-deletable | Medium |

##### Settlement Notifications
| AC | Description | Priority |
|----|-------------|----------|
| AC-2.4 | Payee notified when settlement is requested | High |
| AC-2.5 | Payer notified when settlement is confirmed | High |
| AC-2.6 | Payer notified when settlement is rejected | High |

##### Notification Endpoints
| AC | Description | Priority |
|----|-------------|----------|
| AC-2.7 | GET /notifications - list user's notifications | High |
| AC-2.8 | Paginated response with unread count | High |
| AC-2.9 | PUT /notifications/:id/read - mark as read | High |
| AC-2.10 | PUT /notifications/read-all - mark all as read | Medium |

##### Complete Stubbed ACs
| AC | Description | Priority |
|----|-------------|----------|
| AC-2.11 | AC-1.10 from Sprint 002: Member leaving with debt sees warning | Medium |
| AC-2.12 | AC-1.19 from Sprint 002: Members notified when group deleted | Medium |

---

## Acceptance Criteria Summary

| Feature | AC Count | Priority Breakdown |
|---------|----------|-------------------|
| Feature 0: Technical Debt | 10 | 8 High, 2 Medium |
| Feature 1: Settlement System | 33 | 27 High, 3 Medium, 3 Low |
| Feature 2: Notifications | 12 | 9 High, 3 Medium |
| **Total** | **55** | **44 High, 8 Medium, 3 Low** |

---

## Out of Scope

The following items are explicitly NOT part of this sprint:

1. **Expense Receipts/Attachments** - Deferred to Sprint 004
2. **Push Notifications** - Only in-app notifications this sprint
3. **Email Notifications** - Future sprint
4. **Multi-currency settlements** - Use group default currency
5. **Partial settlements** - Full amount only for simplicity
6. **Settlement disputes** - Use reject with reason instead

---

## Dependencies

| Dependency | Type | Impact |
|------------|------|--------|
| Balance calculation service | Internal | Settlement uses debt simplification |
| Group membership | Internal | Both parties must be members |
| Database schema | Internal | New settlements and notifications tables |

---

## Risks

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| Complex settlement state machine | Medium | Medium | Clear status transitions documented |
| Balance recalculation performance | Low | Medium | Optimize queries, consider caching |
| Integration test flakiness | Medium | Low | Proper cleanup, isolated test DB |

---

## Definition of Done

- [ ] All acceptance criteria implemented and tested
- [ ] Code reviewed by Lead Developer
- [ ] Unit tests written (>80% coverage for new code)
- [ ] Integration tests pass
- [ ] No critical or major bugs
- [ ] Documentation updated
- [ ] QA sign-off received

---

## Sign-off

### Product Owner Approval
| Field | Value |
|-------|-------|
| **Product Owner** | Claude (PO mode) |
| **Date** | 2026-01-20 |
| **Approval** | ✅ APPROVED |
| **Notes** | Sprint focuses on completing core MVP workflow with settlements. Notification foundation will unblock stubbed ACs from Sprint 002. |

### Lead Developer Acknowledgment
| Field | Value |
|-------|-------|
| **Lead Developer** | Claude (Lead Dev mode) |
| **Date** | 2026-01-20 |
| **Acknowledgment** | [x] Reviewed and ready for planning |
| **Notes** | 16 tasks created across 5 phases. Database schemas already exist - main work is services, routes, and tests. 8 technical decisions documented. |

---

## Changelog

| Date | Author | Change |
|------|--------|--------|
| 2026-01-20 | PO | Initial sprint creation |
| 2026-01-20 | Lead Dev | Planning complete, 16 tasks created |
