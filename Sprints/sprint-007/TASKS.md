# Sprint 007 Task Board

## Sprint Overview

| Metric | Count |
|--------|-------|
| **Total Tasks** | 16 |
| **Total ACs** | 34 |
| **Todo** | 16 |
| **In Progress** | 0 |
| **In Review** | 0 |
| **QA** | 0 |
| **Done** | 0 |

**Progress:** ░░░░░░░░░░ 0%

---

## Task Status Legend

| Status | Description |
|--------|-------------|
| 📋 Todo | Not started |
| 🔄 In Progress | Being worked on |
| 👀 In Review | Code review pending |
| 🧪 QA | Testing in progress |
| ✅ Done | Completed and verified |
| ⏸️ Blocked | Waiting on dependency |

---

## Phase 1: Sprint 006 Cleanup (Feature 0)

### TASK-001: Sprint 006 Retrospective
| Field | Value |
|-------|-------|
| **ID** | TASK-001 |
| **Feature** | 0 - Sprint Cleanup |
| **Status** | 📋 Todo |
| **Assigned** | Lead Developer |
| **ACs** | AC-0.1, AC-0.2 |
| **Complexity** | Low |
| **Dependencies** | None |

**Description:**
Create Sprint 006 retrospective and QA report documents.

**Acceptance Criteria:**
- [ ] AC-0.1: Sprint 006 RETROSPECTIVE.md created and complete
- [ ] AC-0.2: Sprint 006 QA_REPORT.md created with all ACs verified

**Files to Create:**
- `Sprints/sprint-006/RETROSPECTIVE.md`
- `Sprints/sprint-006/QA_REPORT.md`

---

### TASK-002: Update Backlog
| Field | Value |
|-------|-------|
| **ID** | TASK-002 |
| **Feature** | 0 - Sprint Cleanup |
| **Status** | 📋 Todo |
| **Assigned** | Project Owner |
| **ACs** | AC-0.3, AC-0.4 |
| **Complexity** | Low |
| **Dependencies** | TASK-001 |

**Description:**
Update backlog with Sprint 006 completion status and velocity metrics.

**Acceptance Criteria:**
- [ ] AC-0.3: BACKLOG.md updated with Sprint 006 completion
- [ ] AC-0.4: Sprint velocity metrics updated

**Files to Modify:**
- `Sprints/BACKLOG.md`

---

## Phase 2: PDF Export (Feature 1)

### TASK-003: Install PDF Dependencies
| Field | Value |
|-------|-------|
| **ID** | TASK-003 |
| **Feature** | 1 - PDF Export |
| **Status** | 📋 Todo |
| **Assigned** | Backend Developer |
| **ACs** | N/A (setup task) |
| **Complexity** | Low |
| **Dependencies** | None |

**Description:**
Install pdfkit and type definitions.

**Commands:**
```bash
bun add pdfkit
bun add -d @types/pdfkit
```

---

### TASK-004: PDF Service
| Field | Value |
|-------|-------|
| **ID** | TASK-004 |
| **Feature** | 1 - PDF Export |
| **Status** | 📋 Todo |
| **Assigned** | Backend Developer |
| **ACs** | AC-1.1, AC-1.2, AC-1.3, AC-1.4 |
| **Complexity** | High |
| **Dependencies** | TASK-003 |

**Description:**
Create PDF generation service for expense reports.

**Acceptance Criteria:**
- [ ] AC-1.1: PDF export service generates valid PDF documents
- [ ] AC-1.2: PDF includes group summary header (name, date range, members)
- [ ] AC-1.3: PDF includes expense table with all relevant columns
- [ ] AC-1.4: PDF includes balance summary section

**Technical Notes:**
- Use PDFKit for generation
- Stream-based generation for memory efficiency
- Include: group name, date range, member list, expense table, balances

**Files to Create:**
- `src/services/pdf.service.ts`

---

### TASK-005: PDF Export Endpoint
| Field | Value |
|-------|-------|
| **ID** | TASK-005 |
| **Feature** | 1 - PDF Export |
| **Status** | 📋 Todo |
| **Assigned** | Backend Developer |
| **ACs** | AC-1.5, AC-1.6, AC-1.7, AC-1.8 |
| **Complexity** | Medium |
| **Dependencies** | TASK-004 |

**Description:**
Add PDF export endpoint to export routes.

**Acceptance Criteria:**
- [ ] AC-1.5: GET /groups/:groupId/export/pdf endpoint exists
- [ ] AC-1.6: PDF export supports date range filtering (from, to query params)
- [ ] AC-1.7: PDF export respects group membership (only members can export)
- [ ] AC-1.8: PDF filename includes group name and date range

**Files to Modify:**
- `src/routes/export.ts`

---

### TASK-006: PDF Service Tests
| Field | Value |
|-------|-------|
| **ID** | TASK-006 |
| **Feature** | 1 - PDF Export |
| **Status** | 📋 Todo |
| **Assigned** | Backend Developer |
| **ACs** | N/A (quality task) |
| **Complexity** | Medium |
| **Dependencies** | TASK-004 |

**Description:**
Write unit tests for PDF service.

**Files to Create:**
- `src/__tests__/pdf.service.test.ts`

---

## Phase 3: Analytics (Feature 2)

### TASK-007: Analytics Service
| Field | Value |
|-------|-------|
| **ID** | TASK-007 |
| **Feature** | 2 - Analytics |
| **Status** | 📋 Todo |
| **Assigned** | Backend Developer |
| **ACs** | AC-2.1, AC-2.2, AC-2.3, AC-2.4, AC-2.5 |
| **Complexity** | High |
| **Dependencies** | None |

**Description:**
Create analytics service with summary calculations.

**Acceptance Criteria:**
- [ ] AC-2.1: GET /groups/:groupId/analytics/summary returns spending summary
- [ ] AC-2.2: Summary includes total spent, average per expense, expense count
- [ ] AC-2.3: Summary includes per-member spending breakdown
- [ ] AC-2.4: Summary supports date range filtering (from, to)
- [ ] AC-2.5: Summary supports period grouping (daily, weekly, monthly)

**Technical Notes:**
- Use raw SQL with window functions for efficiency
- Cache results for frequently accessed summaries (optional)

**Files to Create:**
- `src/services/analytics.service.ts`

---

### TASK-008: Category Analytics
| Field | Value |
|-------|-------|
| **ID** | TASK-008 |
| **Feature** | 2 - Analytics |
| **Status** | 📋 Todo |
| **Assigned** | Backend Developer |
| **ACs** | AC-2.6, AC-2.7, AC-2.8 |
| **Complexity** | Medium |
| **Dependencies** | TASK-007 |

**Description:**
Add category breakdown analytics.

**Acceptance Criteria:**
- [ ] AC-2.6: GET /groups/:groupId/analytics/categories returns category breakdown
- [ ] AC-2.7: Category breakdown shows amount and percentage per category
- [ ] AC-2.8: Categories sorted by total amount descending

**Files to Modify:**
- `src/services/analytics.service.ts`

---

### TASK-009: Trends Analytics
| Field | Value |
|-------|-------|
| **ID** | TASK-009 |
| **Feature** | 2 - Analytics |
| **Status** | 📋 Todo |
| **Assigned** | Backend Developer |
| **ACs** | AC-2.9, AC-2.10 |
| **Complexity** | Medium |
| **Dependencies** | TASK-007 |

**Description:**
Add spending trends over time.

**Acceptance Criteria:**
- [ ] AC-2.9: GET /groups/:groupId/analytics/trends returns spending trends
- [ ] AC-2.10: Trends show spending over time for the requested period

**Files to Modify:**
- `src/services/analytics.service.ts`

---

### TASK-010: Analytics Routes
| Field | Value |
|-------|-------|
| **ID** | TASK-010 |
| **Feature** | 2 - Analytics |
| **Status** | 📋 Todo |
| **Assigned** | Backend Developer |
| **ACs** | AC-2.1, AC-2.6, AC-2.9 (endpoint creation) |
| **Complexity** | Medium |
| **Dependencies** | TASK-007, TASK-008, TASK-009 |

**Description:**
Create analytics routes with authentication.

**Files to Create:**
- `src/routes/analytics.ts`

**Files to Modify:**
- `src/routes/index.ts`

---

### TASK-011: Analytics Tests
| Field | Value |
|-------|-------|
| **ID** | TASK-011 |
| **Feature** | 2 - Analytics |
| **Status** | 📋 Todo |
| **Assigned** | Backend Developer |
| **ACs** | N/A (quality task) |
| **Complexity** | Medium |
| **Dependencies** | TASK-007, TASK-008, TASK-009 |

**Description:**
Write unit tests for analytics service.

**Files to Create:**
- `src/__tests__/analytics.service.test.ts`

---

## Phase 4: Recurring Expenses (Feature 3)

### TASK-012: Recurring Expenses Schema
| Field | Value |
|-------|-------|
| **ID** | TASK-012 |
| **Feature** | 3 - Recurring Expenses |
| **Status** | 📋 Todo |
| **Assigned** | Backend Developer |
| **ACs** | AC-3.1, AC-3.2, AC-3.3 |
| **Complexity** | Medium |
| **Dependencies** | None |

**Description:**
Create recurring expenses database schema.

**Acceptance Criteria:**
- [ ] AC-3.1: Recurring expense table stores rule configuration
- [ ] AC-3.2: Supports frequency types: daily, weekly, biweekly, monthly, yearly
- [ ] AC-3.3: Tracks next occurrence date and last generated date

**Files to Create:**
- `src/db/schema/recurring.ts`

**Files to Modify:**
- `src/db/index.ts`

---

### TASK-013: Recurring Expenses Service
| Field | Value |
|-------|-------|
| **ID** | TASK-013 |
| **Feature** | 3 - Recurring Expenses |
| **Status** | 📋 Todo |
| **Assigned** | Backend Developer |
| **ACs** | AC-3.9, AC-3.10 |
| **Complexity** | High |
| **Dependencies** | TASK-012 |

**Description:**
Create recurring expenses service with generation logic.

**Acceptance Criteria:**
- [ ] AC-3.9: Recurring expense job generates expenses when due
- [ ] AC-3.10: Generated expenses use the recurring rule's split configuration

**Technical Notes:**
- Calculate next occurrence based on frequency
- Handle edge cases: Feb 29, month end
- Transaction for atomic generation

**Files to Create:**
- `src/services/recurring.service.ts`

---

### TASK-014: Recurring Expenses API
| Field | Value |
|-------|-------|
| **ID** | TASK-014 |
| **Feature** | 3 - Recurring Expenses |
| **Status** | 📋 Todo |
| **Assigned** | Backend Developer |
| **ACs** | AC-3.4, AC-3.5, AC-3.6, AC-3.7, AC-3.8 |
| **Complexity** | Medium |
| **Dependencies** | TASK-013 |

**Description:**
Create recurring expenses CRUD endpoints.

**Acceptance Criteria:**
- [ ] AC-3.4: POST /groups/:groupId/recurring-expenses creates recurring rule
- [ ] AC-3.5: GET /groups/:groupId/recurring-expenses lists all recurring rules
- [ ] AC-3.6: GET /groups/:groupId/recurring-expenses/:id returns single rule
- [ ] AC-3.7: PUT /groups/:groupId/recurring-expenses/:id updates rule
- [ ] AC-3.8: DELETE /groups/:groupId/recurring-expenses/:id deactivates rule

**Files to Create:**
- `src/routes/recurring.ts`

**Files to Modify:**
- `src/routes/index.ts`

---

### TASK-015: Recurring Generation Job
| Field | Value |
|-------|-------|
| **ID** | TASK-015 |
| **Feature** | 3 - Recurring Expenses |
| **Status** | 📋 Todo |
| **Assigned** | Backend Developer |
| **ACs** | AC-3.11, AC-3.12 |
| **Complexity** | Medium |
| **Dependencies** | TASK-013 |

**Description:**
Add scheduled job and admin trigger for recurring expense generation.

**Acceptance Criteria:**
- [ ] AC-3.11: Job can be triggered manually via admin endpoint
- [ ] AC-3.12: Job can run on a schedule (cron-compatible)

**Files to Modify:**
- `src/routes/admin.ts`
- `src/services/recurring.service.ts`

---

### TASK-016: Recurring Expenses Tests
| Field | Value |
|-------|-------|
| **ID** | TASK-016 |
| **Feature** | 3 - Recurring Expenses |
| **Status** | 📋 Todo |
| **Assigned** | Backend Developer |
| **ACs** | N/A (quality task) |
| **Complexity** | High |
| **Dependencies** | TASK-012, TASK-013, TASK-014 |

**Description:**
Write unit tests for recurring expenses service.

**Test Coverage:**
- Next occurrence calculation for all frequencies
- Edge cases: Feb 29, month end, year end
- Generation logic
- Deactivation logic

**Files to Create:**
- `src/__tests__/recurring.service.test.ts`

---

## Task Assignment Summary

| Assignee | Tasks | Total ACs |
|----------|-------|-----------|
| Lead Developer | TASK-001 | 2 |
| Project Owner | TASK-002 | 2 |
| Backend Developer | TASK-003 to TASK-016 | 30 |

---

## Sprint Timeline (Suggested)

| Day | Focus | Tasks |
|-----|-------|-------|
| 1 | Cleanup + PDF Setup | TASK-001, TASK-002, TASK-003, TASK-004 |
| 2 | PDF + Analytics Start | TASK-005, TASK-006, TASK-007 |
| 3 | Analytics | TASK-008, TASK-009, TASK-010, TASK-011 |
| 4 | Recurring Expenses | TASK-012, TASK-013, TASK-014 |
| 5 | Recurring + QA | TASK-015, TASK-016, Final QA |

---

## Notes

- PDF generation should use streaming to handle large reports
- Analytics queries should be optimized with proper indexes
- Recurring expense generation should be idempotent
- Install pdfkit early to unblock PDF tasks
