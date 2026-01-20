# Sprint 006 Definition

## Sprint Overview

| Field | Value |
|-------|-------|
| **Sprint Number** | 006 |
| **Sprint Goal** | Resolve technical debt, complete notification system with user preferences, and implement activity log archival |
| **Defined By** | Project Owner (Claude) |
| **Definition Date** | 2026-01-21 |
| **Status** | Defined |

---

## Sprint Goal

> Strengthen the codebase foundation by resolving TypeScript errors and improving CI infrastructure, while completing the notification system with user preferences and email support.

---

## Features

| # | Feature | Backlog ID | Priority | Estimated ACs |
|---|---------|------------|----------|---------------|
| 0 | Technical Debt & CI Improvements | Retro Items | P0 | 10 |
| 1 | User Preferences & Notifications | BL-006 | P1 | 14 |
| 2 | Activity Log Archival | Retro Item | P2 | 6 |
| | **Total** | | | **30** |

---

## Feature 0: Technical Debt & CI Improvements

**Priority:** P0 (Critical)
**Source:** Sprint 005 Retrospective Action Items

### Description
Address technical debt items that were identified during Sprint 005, including TypeScript errors and CI infrastructure gaps.

### Acceptance Criteria

#### TypeScript Fixes (4 ACs)
| AC ID | Description |
|-------|-------------|
| AC-0.1 | Drizzle ORM schema files have no TypeScript errors |
| AC-0.2 | All source files pass `bun run typecheck` (not just typecheck:src) |
| AC-0.3 | Test files have proper type definitions |
| AC-0.4 | No `any` types used except where explicitly necessary with justification comment |

#### CI Infrastructure (4 ACs)
| AC ID | Description |
|-------|-------------|
| AC-0.5 | DATABASE_URL_TEST configured in GitHub Actions workflow |
| AC-0.6 | Integration tests run automatically on PR and push |
| AC-0.7 | CI workflow fails if integration tests fail |
| AC-0.8 | Test database is created and migrated in CI before tests run |

#### Integration Tests (2 ACs)
| AC ID | Description |
|-------|-------------|
| AC-0.9 | Integration tests exist for currencies endpoint |
| AC-0.10 | Integration tests exist for export endpoints (CSV/JSON) |

---

## Feature 1: User Preferences & Notifications

**Priority:** P1 (High)
**Source:** BL-006 (Backlog - completion)

### Description
Complete the notification system with user preferences for notification settings and email notification support.

### Acceptance Criteria

#### User Preferences Schema (4 ACs)
| AC ID | Description |
|-------|-------------|
| AC-1.1 | User preferences table stores notification settings |
| AC-1.2 | Preferences include: emailNotifications (boolean), pushNotifications (boolean) |
| AC-1.3 | Preferences include: notifyOnExpenseAdded, notifyOnSettlement, notifyOnGroupActivity (all boolean) |
| AC-1.4 | Default preferences are created when user registers |

#### Preferences API (4 ACs)
| AC ID | Description |
|-------|-------------|
| AC-1.5 | GET /users/me/preferences returns current user preferences |
| AC-1.6 | PUT /users/me/preferences updates user preferences |
| AC-1.7 | Preferences validation ensures valid boolean values |
| AC-1.8 | Only authenticated users can access their own preferences |

#### Email Notification Service (4 ACs)
| AC ID | Description |
|-------|-------------|
| AC-1.9 | Email service abstraction supports multiple providers (SendGrid, SES, SMTP) |
| AC-1.10 | Email templates exist for: expense_added, settlement_requested, settlement_confirmed |
| AC-1.11 | Emails respect user preferences (only sent if emailNotifications enabled) |
| AC-1.12 | Email sending is non-blocking (queued/async) |

#### Notification Filtering (2 ACs)
| AC ID | Description |
|-------|-------------|
| AC-1.13 | In-app notifications respect user preference settings |
| AC-1.14 | Users can disable specific notification types without disabling all |

---

## Feature 2: Activity Log Archival

**Priority:** P2 (Medium)
**Source:** Sprint 004 & 005 Retrospective Action Items

### Description
Implement archival strategy for activity logs to maintain database performance as logs grow.

### Acceptance Criteria

#### Archival Schema (2 ACs)
| AC ID | Description |
|-------|-------------|
| AC-2.1 | Archive table mirrors activity_logs structure |
| AC-2.2 | Archived records include original timestamps and metadata |

#### Archival Process (3 ACs)
| AC ID | Description |
|-------|-------------|
| AC-2.3 | Archival job moves logs older than 90 days to archive table |
| AC-2.4 | Archival can be triggered manually via admin endpoint |
| AC-2.5 | Archival job can run on a schedule (cron-compatible) |

#### Archive Access (1 AC)
| AC ID | Description |
|-------|-------------|
| AC-2.6 | GET /groups/:groupId/activity supports `includeArchived` query param |

---

## Technical Notes

### TypeScript Fixes
```typescript
// Drizzle ORM schema needs proper type inference
// Review: src/db/schema/*.ts files
// Common issues: relation definitions, enum types
```

### CI Workflow Updates
```yaml
# .github/workflows/test.yml additions needed:
services:
  postgres:
    image: postgres:14
    env:
      POSTGRES_DB: divvy_jones_test
      POSTGRES_USER: test
      POSTGRES_PASSWORD: test
    ports:
      - 5432:5432
```

### Email Service
- Start with SMTP for development (Mailtrap/Ethereal)
- Production: SendGrid or AWS SES
- Use environment variables for provider selection
- Templates stored in `src/templates/email/`

### Activity Archival
- Archive table: `activity_logs_archive`
- Consider partitioning for large datasets
- Archival should be idempotent (safe to run multiple times)

---

## Dependencies

| Feature | External Dependency |
|---------|-------------------|
| Email Service | nodemailer (SMTP), @sendgrid/mail (SendGrid), @aws-sdk/client-ses (SES) |
| Archival Scheduler | node-cron or similar |
| CI | GitHub Actions PostgreSQL service |

---

## Risks and Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| TypeScript fixes may break existing code | High | Run full test suite after each fix, incremental changes |
| Email delivery issues | Medium | Implement retry logic, logging, fallback provider |
| Archival affecting active queries | Low | Run during low-traffic periods, use transactions |

---

## Out of Scope

The following items are explicitly NOT included in Sprint 006:
- Push notifications (requires mobile app/service worker - deferred)
- PDF export (requires PDF generation library - deferred to Sprint 007)
- Analytics dashboard (charts/graphs - deferred to Sprint 007)
- HEIC/HEIF magic number validation (low priority - P3)

---

## Sprint 005 Retro Items Status

| Action Item | Sprint 006 Status |
|-------------|-------------------|
| Fix pre-existing TypeScript errors | ✅ Included (Feature 0) |
| Set up DATABASE_URL_TEST in CI | ✅ Included (Feature 0) |
| Add integration tests for Sprint 005 features | ✅ Included (Feature 0) |
| S3 integration testing with staging | ❌ Deferred (requires AWS staging) |
| Add activity log archival | ✅ Included (Feature 2) |
| Add HEIC/HEIF magic number validation | ❌ Deferred (P3) |

---

## Definition of Done

- [ ] All acceptance criteria verified
- [ ] Unit tests written for new services
- [ ] Integration tests pass in CI
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
| Lead Developer | ✅ Planning Complete |
| Backend Developer | ⏳ Ready to Start |
| QA Engineer | ⏳ Pending Test Cases |
