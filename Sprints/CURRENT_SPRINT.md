# Current Sprint

## Active Sprint
**Sprint:** 002
**Status:** Ready for Planning
**Location:** `./sprint-002/`

---

## Sprint Goal
> Address technical debt from Sprint 001, complete group management, and implement core expense tracking

---

## Quick Links
- [Sprint Document](./sprint-002/SPRINT.md) ✅ Defined by PO
- [Planning Notes](./sprint-002/PLANNING.md) ⏳ Pending Lead Dev
- [Task Board](./sprint-002/TASKS.md)
- [Review Log](./sprint-002/REVIEW_LOG.md)
- [QA Report](./sprint-002/QA_REPORT.md)
- [Retrospective](./sprint-002/RETROSPECTIVE.md)

---

## Features for Sprint 002

| # | Feature | Backlog ID | ACs | Priority |
|---|---------|------------|-----|----------|
| 0 | Technical Debt & Infrastructure | Retro Items | 8 | P0 |
| 1 | Complete Group Management | BL-002 | 19 | P0 |
| 2 | Core Expense Tracking | BL-003 | 36 | P0 |
| 3 | Balance Calculation | BL-004 | 9 | P0 |
| | **Total** | | **53** | |

---

## Sprint 001 Retro Action Items (Must Address)

| Action Item | Status |
|-------------|--------|
| Fix dynamic imports in users.ts | ⏳ Pending |
| Add JWT secret production check | ⏳ Pending |
| Set up test database | ⏳ Pending |
| Add rate limiting to auth endpoints | ⏳ Pending |
| Replace raw SQL with inArray | ⏳ Pending |

---

## Sprint Progress

| Metric | Count |
|--------|-------|
| Total ACs | 53 |
| Todo | 53 |
| In Progress | 0 |
| In Review | 0 |
| QA | 0 |
| Done | 0 |

**Progress:** ░░░░░░░░░░ 0%

---

## Team Status

| Role | Agent | Current Task | Status |
|------|-------|--------------|--------|
| Project Owner | Claude (PO) | Sprint 002 Definition | ✅ Complete |
| Lead Developer | Claude (Lead Dev) | Planning Session | ⏳ Next |
| Backend Developer | Claude (Backend) | - | ⏳ Awaiting Tasks |
| QA Engineer | Claude (QA) | - | ⏳ Awaiting Features |

---

## Next Actions

1. **Lead Developer:** Planning session → Create PLANNING.md, TASKS.md
2. **Lead Developer:** Break down features into tasks
3. **Backend Developer:** Start with technical debt tasks
4. **QA Engineer:** Prepare test cases for expense functionality

---

## New API Endpoints (Planned)

| Method | Endpoint | Feature |
|--------|----------|---------|
| PUT | `/groups/:id` | Group Management |
| POST | `/groups/:id/leave` | Group Management |
| POST | `/groups/:id/regenerate-code` | Group Management |
| DELETE | `/groups/:id` | Group Management |
| POST | `/groups/:id/expenses` | Expense Tracking |
| GET | `/groups/:id/expenses` | Expense Tracking |
| GET | `/groups/:id/expenses/:expenseId` | Expense Tracking |
| PUT | `/groups/:id/expenses/:expenseId` | Expense Tracking |
| DELETE | `/groups/:id/expenses/:expenseId` | Expense Tracking |
| GET | `/groups/:id/balances` | Balance Calculation |

---

## Previous Sprint Summary

**Sprint 001:** ✅ CLOSED
- 2 features delivered
- 36/36 ACs met
- 100% test pass rate
- [View Sprint 001 Artifacts](./sprint-001/)
