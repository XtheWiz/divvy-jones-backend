# Sprint 007 Definition

## Sprint Overview

| Field | Value |
|-------|-------|
| **Sprint Number** | 007 |
| **Sprint Goal** | Complete reporting features with PDF export and analytics, add recurring expenses support |
| **Defined By** | Project Owner (Claude) |
| **Definition Date** | 2026-01-21 |
| **Status** | Defined |

---

## Sprint Goal

> Enhance the reporting capabilities with PDF export and spending analytics, while adding recurring expense automation to reduce manual data entry for regular expenses.

---

## Features

| # | Feature | Backlog ID | Priority | Estimated ACs |
|---|---------|------------|----------|---------------|
| 0 | Sprint 006 Cleanup | Retro Items | P0 | 4 |
| 1 | PDF Export | BL-007 | P1 | 8 |
| 2 | Spending Analytics | BL-007 | P1 | 10 |
| 3 | Recurring Expenses | BL-008 | P2 | 12 |
| | **Total** | | | **34** |

---

## Feature 0: Sprint 006 Cleanup

**Priority:** P0 (Critical)
**Source:** Sprint 006 deferred items and cleanup

### Description
Close out remaining Sprint 006 items and ensure integration tests work in CI.

### Acceptance Criteria

| AC ID | Description |
|-------|-------------|
| AC-0.1 | Sprint 006 RETROSPECTIVE.md created and complete |
| AC-0.2 | Sprint 006 QA_REPORT.md created with all ACs verified |
| AC-0.3 | BACKLOG.md updated with Sprint 006 completion |
| AC-0.4 | Sprint velocity metrics updated |

---

## Feature 1: PDF Export

**Priority:** P1 (High)
**Source:** BL-007 (Reports & Analytics - completion)

### Description
Add PDF export capability for group expense reports, building on existing CSV/JSON export functionality.

### Acceptance Criteria

#### PDF Generation (4 ACs)
| AC ID | Description |
|-------|-------------|
| AC-1.1 | PDF export service generates valid PDF documents |
| AC-1.2 | PDF includes group summary header (name, date range, members) |
| AC-1.3 | PDF includes expense table with all relevant columns |
| AC-1.4 | PDF includes balance summary section |

#### PDF Export API (4 ACs)
| AC ID | Description |
|-------|-------------|
| AC-1.5 | GET /groups/:groupId/export/pdf endpoint exists |
| AC-1.6 | PDF export supports date range filtering (from, to query params) |
| AC-1.7 | PDF export respects group membership (only members can export) |
| AC-1.8 | PDF filename includes group name and date range |

---

## Feature 2: Spending Analytics

**Priority:** P1 (High)
**Source:** BL-007 (Reports & Analytics - completion)

### Description
Provide spending summaries and category breakdowns for groups.

### Acceptance Criteria

#### Summary Endpoint (5 ACs)
| AC ID | Description |
|-------|-------------|
| AC-2.1 | GET /groups/:groupId/analytics/summary returns spending summary |
| AC-2.2 | Summary includes total spent, average per expense, expense count |
| AC-2.3 | Summary includes per-member spending breakdown |
| AC-2.4 | Summary supports date range filtering (from, to) |
| AC-2.5 | Summary supports period grouping (daily, weekly, monthly) |

#### Category Analytics (3 ACs)
| AC ID | Description |
|-------|-------------|
| AC-2.6 | GET /groups/:groupId/analytics/categories returns category breakdown |
| AC-2.7 | Category breakdown shows amount and percentage per category |
| AC-2.8 | Categories sorted by total amount descending |

#### Trends (2 ACs)
| AC ID | Description |
|-------|-------------|
| AC-2.9 | GET /groups/:groupId/analytics/trends returns spending trends |
| AC-2.10 | Trends show spending over time for the requested period |

---

## Feature 3: Recurring Expenses

**Priority:** P2 (Medium)
**Source:** BL-008 (Recurring Expenses)

### Description
Allow users to set up recurring expenses that automatically create new expense entries on a schedule.

### Acceptance Criteria

#### Schema (3 ACs)
| AC ID | Description |
|-------|-------------|
| AC-3.1 | Recurring expense table stores rule configuration |
| AC-3.2 | Supports frequency types: daily, weekly, biweekly, monthly, yearly |
| AC-3.3 | Tracks next occurrence date and last generated date |

#### CRUD API (5 ACs)
| AC ID | Description |
|-------|-------------|
| AC-3.4 | POST /groups/:groupId/recurring-expenses creates recurring rule |
| AC-3.5 | GET /groups/:groupId/recurring-expenses lists all recurring rules |
| AC-3.6 | GET /groups/:groupId/recurring-expenses/:id returns single rule |
| AC-3.7 | PUT /groups/:groupId/recurring-expenses/:id updates rule |
| AC-3.8 | DELETE /groups/:groupId/recurring-expenses/:id deactivates rule |

#### Generation (4 ACs)
| AC ID | Description |
|-------|-------------|
| AC-3.9 | Recurring expense job generates expenses when due |
| AC-3.10 | Generated expenses use the recurring rule's split configuration |
| AC-3.11 | Job can be triggered manually via admin endpoint |
| AC-3.12 | Job can run on a schedule (cron-compatible) |

---

## Technical Notes

### PDF Generation
```typescript
// Options for PDF generation library:
// 1. PDFKit - Low-level, full control
// 2. pdf-lib - Modify existing PDFs
// 3. puppeteer/playwright - HTML to PDF (heavier)
// Recommend: PDFKit for server-side generation
```

### Analytics Queries
```sql
-- Category breakdown example
SELECT
  category,
  SUM(amount) as total,
  COUNT(*) as count,
  ROUND(SUM(amount) * 100.0 / SUM(SUM(amount)) OVER (), 2) as percentage
FROM expenses
WHERE group_id = $1 AND deleted_at IS NULL
GROUP BY category
ORDER BY total DESC;
```

### Recurring Expenses
- Use `node-cron` for scheduling (already available from Sprint 006)
- Store timezone with recurring rule for accurate timing
- Handle edge cases: Feb 29, month end dates
- Skip generation if group is deleted/inactive

---

## Dependencies

| Feature | External Dependency |
|---------|-------------------|
| PDF Export | pdfkit or similar PDF generation library |
| Recurring Jobs | node-cron (already installed) |

---

## Risks and Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| PDF library adds bundle size | Low | PDFKit is relatively lightweight |
| Recurring job timing issues | Medium | Use timezone-aware scheduling, idempotent generation |
| Analytics queries slow on large datasets | Medium | Add database indexes, consider materialized views |

---

## Out of Scope

The following items are explicitly NOT included in Sprint 007:
- Push notifications (requires mobile/service worker infrastructure)
- Charts/graphs in PDF (text-based reports only)
- Email delivery of PDF reports (can be added later)
- Real-time analytics updates (batch/request-based only)

---

## Definition of Done

- [ ] All acceptance criteria verified
- [ ] Unit tests written for new services
- [ ] Integration tests pass
- [ ] All existing tests pass
- [ ] Code reviewed by Lead Developer
- [ ] QA sign-off on all features
- [ ] Documentation updated
- [ ] No P0/P1 bugs open

---

## Approval

| Role | Status |
|------|--------|
| Project Owner | ✅ Defined |
| Lead Developer | ⏳ Pending Planning |
| Backend Developer | ⏳ Pending Task Assignment |
| QA Engineer | ⏳ Pending Test Cases |
