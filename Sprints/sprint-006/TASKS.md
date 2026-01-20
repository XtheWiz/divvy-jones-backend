# Sprint 006 Task Board

## Sprint Overview

| Metric | Count |
|--------|-------|
| **Total Tasks** | 14 |
| **Total ACs** | 30 |
| **Todo** | 10 |
| **In Progress** | 0 |
| **In Review** | 0 |
| **QA** | 0 |
| **Done** | 4 |

**Progress:** ████░░░░░░ 28%

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

## Phase 1: Technical Debt (Feature 0)

### TASK-001: Fix Test File TypeScript Errors
| Field | Value |
|-------|-------|
| **ID** | TASK-001 |
| **Feature** | 0 - Technical Debt |
| **Status** | ✅ Done |
| **Assigned** | Backend Developer |
| **ACs** | AC-0.1, AC-0.2, AC-0.3, AC-0.4 |
| **Complexity** | High |
| **Dependencies** | None |

**Description:**
Fix all TypeScript errors in test files to enable full type checking.

**Acceptance Criteria:**
- [x] AC-0.1: Drizzle ORM schema files have no TypeScript errors
- [x] AC-0.2: All source files pass `bun run typecheck` (not just typecheck:src)
- [x] AC-0.3: Test files have proper type definitions
- [x] AC-0.4: No `any` types used except where explicitly necessary with justification comment

**Technical Notes:**
- Add type assertions for Elysia response bodies: `const body = response.body as { ... }`
- Create proper mock types for fetch in exchange-rate tests
- Fix integration test helper types in `src/__tests__/integration/setup.ts`
- Main error categories:
  - `body` is of type 'unknown' (~50 errors)
  - Mock function missing `preconnect` (~3 errors)
  - Elysia type mismatches (~200 errors)

**Files to Modify:**
- `src/__tests__/currencies.routes.test.ts`
- `src/__tests__/api.routes.test.ts`
- `src/__tests__/exchange-rate.service.test.ts`
- `src/__tests__/integration/setup.ts`
- `src/__tests__/integration/*.test.ts`

---

### TASK-002: Update CI Workflow
| Field | Value |
|-------|-------|
| **ID** | TASK-002 |
| **Feature** | 0 - Technical Debt |
| **Status** | 📋 Todo |
| **Assigned** | Lead Developer |
| **ACs** | AC-0.5, AC-0.6, AC-0.7, AC-0.8 |
| **Complexity** | Low |
| **Dependencies** | TASK-001 |

**Description:**
Update GitHub Actions workflow to enforce type checking and ensure integration tests run properly.

**Acceptance Criteria:**
- [ ] AC-0.5: DATABASE_URL_TEST configured in GitHub Actions workflow
- [ ] AC-0.6: Integration tests run automatically on PR and push
- [ ] AC-0.7: CI workflow fails if integration tests fail
- [ ] AC-0.8: Test database is created and migrated in CI before tests run

**Technical Notes:**
- Remove `continue-on-error: true` from type check step
- DATABASE_URL_TEST is already configured (verify)
- Integration tests already run (verify they pass)

**Files to Modify:**
- `.github/workflows/test.yml`

---

### TASK-003: Integration Tests for Sprint 005 Features
| Field | Value |
|-------|-------|
| **ID** | TASK-003 |
| **Feature** | 0 - Technical Debt |
| **Status** | 📋 Todo |
| **Assigned** | Backend Developer |
| **ACs** | AC-0.9, AC-0.10 |
| **Complexity** | Medium |
| **Dependencies** | TASK-001 |

**Description:**
Write integration tests for currencies and export endpoints added in Sprint 005.

**Acceptance Criteria:**
- [ ] AC-0.9: Integration tests exist for currencies endpoint
- [ ] AC-0.10: Integration tests exist for export endpoints (CSV/JSON)

**Technical Notes:**
- Test GET /currencies returns all 8 supported currencies
- Test GET /groups/:groupId/export/csv with date filtering
- Test GET /groups/:groupId/export/json with date filtering
- Test authorization (non-members can't export)

**Files to Create:**
- `src/__tests__/integration/currencies.integration.test.ts`
- `src/__tests__/integration/export.integration.test.ts`

---

## Phase 2: User Preferences (Feature 1, Part A)

### TASK-004: Extend User Preferences Schema
| Field | Value |
|-------|-------|
| **ID** | TASK-004 |
| **Feature** | 1 - User Preferences |
| **Status** | ✅ Done |
| **Assigned** | Backend Developer |
| **ACs** | AC-1.1, AC-1.2, AC-1.3, AC-1.4 |
| **Complexity** | Medium |
| **Dependencies** | None |

**Description:**
Extend the existing `userSettings` table to include granular notification preferences.

**Acceptance Criteria:**
- [x] AC-1.1: User preferences table stores notification settings
- [x] AC-1.2: Preferences include: emailNotifications (boolean), pushNotifications (boolean)
- [x] AC-1.3: Preferences include: notifyOnExpenseAdded, notifyOnSettlement, notifyOnGroupActivity (all boolean)
- [x] AC-1.4: Default preferences are created when user registers

**Technical Notes:**
- `emailNotifications` already exists in schema
- Add new columns: `notifyOnExpenseAdded`, `notifyOnSettlement`, `notifyOnGroupActivity`
- Update user registration to create default preferences
- Default all new preferences to `true`

**Files to Modify:**
- `src/db/schema/users.ts` - Add columns to userSettings
- `src/services/user.service.ts` - Create defaults on registration

---

### TASK-005: User Preferences API
| Field | Value |
|-------|-------|
| **ID** | TASK-005 |
| **Feature** | 1 - User Preferences |
| **Status** | ✅ Done |
| **Assigned** | Backend Developer |
| **ACs** | AC-1.5, AC-1.6, AC-1.7, AC-1.8 |
| **Complexity** | Medium |
| **Dependencies** | TASK-004 |

**Description:**
Create API endpoints for getting and updating user preferences.

**Acceptance Criteria:**
- [x] AC-1.5: GET /users/me/preferences returns current user preferences
- [x] AC-1.6: PUT /users/me/preferences updates user preferences
- [x] AC-1.7: Preferences validation ensures valid boolean values
- [x] AC-1.8: Only authenticated users can access their own preferences

**Technical Notes:**
- Add routes to users.ts or create new preferences.ts route file
- Use existing JWT authentication guard
- Validate request body with Elysia schema validation
- Return 404 if preferences don't exist (shouldn't happen with AC-1.4)

**Files to Create/Modify:**
- `src/routes/users.ts` - Add preference endpoints
- `src/services/user-preferences.service.ts` - New service

---

## Phase 3: Email Notifications (Feature 1, Part B)

### TASK-006: Email Service Abstraction
| Field | Value |
|-------|-------|
| **ID** | TASK-006 |
| **Feature** | 1 - Email Notifications |
| **Status** | ✅ Done |
| **Assigned** | Backend Developer |
| **ACs** | AC-1.9 |
| **Complexity** | High |
| **Dependencies** | None |

**Description:**
Create email service abstraction with provider pattern (similar to storage provider).

**Acceptance Criteria:**
- [x] AC-1.9: Email service abstraction supports multiple providers (SendGrid, SES, SMTP)

**Technical Notes:**
- Create `EmailProvider` interface with `send()` method
- Implement `SmtpEmailProvider` using nodemailer
- Implement `ConsoleEmailProvider` for development (logs to console)
- Factory function selects provider based on EMAIL_PROVIDER env var
- SendGrid provider is optional (stub for now)

**Files to Create:**
- `src/services/email/index.ts` - Exports and factory
- `src/services/email/email.types.ts` - Types and interface
- `src/services/email/smtp.provider.ts` - SMTP implementation
- `src/services/email/console.provider.ts` - Console/dev provider

**Dependencies to Install:**
- `nodemailer`
- `@types/nodemailer`

---

### TASK-007: Email Templates
| Field | Value |
|-------|-------|
| **ID** | TASK-007 |
| **Feature** | 1 - Email Notifications |
| **Status** | 📋 Todo |
| **Assigned** | Backend Developer |
| **ACs** | AC-1.10 |
| **Complexity** | Medium |
| **Dependencies** | TASK-006 |

**Description:**
Create email templates for notification types.

**Acceptance Criteria:**
- [ ] AC-1.10: Email templates exist for: expense_added, settlement_requested, settlement_confirmed

**Technical Notes:**
- Templates should be simple HTML with variable interpolation
- Include both HTML and plain text versions
- Variables: recipientName, actorName, groupName, amount, currency, etc.
- Keep templates simple and mobile-friendly

**Files to Create:**
- `src/services/email/templates/expense-added.ts`
- `src/services/email/templates/settlement-requested.ts`
- `src/services/email/templates/settlement-confirmed.ts`
- `src/services/email/templates/index.ts`

---

### TASK-008: Email Integration with Notifications
| Field | Value |
|-------|-------|
| **ID** | TASK-008 |
| **Feature** | 1 - Email Notifications |
| **Status** | 📋 Todo |
| **Assigned** | Backend Developer |
| **ACs** | AC-1.11, AC-1.12 |
| **Complexity** | Medium |
| **Dependencies** | TASK-006, TASK-007, TASK-004 |

**Description:**
Integrate email service with notification system, respecting user preferences.

**Acceptance Criteria:**
- [ ] AC-1.11: Emails respect user preferences (only sent if emailNotifications enabled)
- [ ] AC-1.12: Email sending is non-blocking (queued/async)

**Technical Notes:**
- Check user preferences before sending email
- Use `setImmediate` or `queueMicrotask` for non-blocking
- Add email sending to notification service
- Log email send attempts (success/failure)

**Files to Modify:**
- `src/services/notification.service.ts` - Add email integration

---

### TASK-009: Notification Filtering
| Field | Value |
|-------|-------|
| **ID** | TASK-009 |
| **Feature** | 1 - Email Notifications |
| **Status** | 📋 Todo |
| **Assigned** | Backend Developer |
| **ACs** | AC-1.13, AC-1.14 |
| **Complexity** | Low |
| **Dependencies** | TASK-004, TASK-008 |

**Description:**
Filter notifications based on user preferences for notification types.

**Acceptance Criteria:**
- [ ] AC-1.13: In-app notifications respect user preference settings
- [ ] AC-1.14: Users can disable specific notification types without disabling all

**Technical Notes:**
- Map notification types to preference fields
- Check preferences before creating in-app notification
- Allow partial disabling (e.g., only expenses, not settlements)

**Files to Modify:**
- `src/services/notification.service.ts` - Add filtering logic

---

## Phase 4: Activity Log Archival (Feature 2)

### TASK-010: Archive Schema and Migration
| Field | Value |
|-------|-------|
| **ID** | TASK-010 |
| **Feature** | 2 - Activity Archival |
| **Status** | 📋 Todo |
| **Assigned** | Backend Developer |
| **ACs** | AC-2.1, AC-2.2 |
| **Complexity** | Low |
| **Dependencies** | None |

**Description:**
Create archive table for activity logs.

**Acceptance Criteria:**
- [ ] AC-2.1: Archive table mirrors activity_logs structure
- [ ] AC-2.2: Archived records include original timestamps and metadata

**Technical Notes:**
- Table name: `activity_log_archive`
- Same columns as `activity_log` plus `archivedAt` timestamp
- No foreign key constraints (archived data should be independent)
- Index on `archivedAt` for cleanup queries

**Files to Create/Modify:**
- `src/db/schema/notifications.ts` - Add archive table

---

### TASK-011: Archival Service
| Field | Value |
|-------|-------|
| **ID** | TASK-011 |
| **Feature** | 2 - Activity Archival |
| **Status** | 📋 Todo |
| **Assigned** | Backend Developer |
| **ACs** | AC-2.3, AC-2.4, AC-2.5 |
| **Complexity** | Medium |
| **Dependencies** | TASK-010 |

**Description:**
Create service to archive old activity logs.

**Acceptance Criteria:**
- [ ] AC-2.3: Archival job moves logs older than 90 days to archive table
- [ ] AC-2.4: Archival can be triggered manually via admin endpoint
- [ ] AC-2.5: Archival job can run on a schedule (cron-compatible)

**Technical Notes:**
- Configurable retention period via env var (default 90 days)
- Use transaction: INSERT INTO archive, DELETE FROM source
- Batch processing to avoid long locks (1000 records at a time)
- Admin endpoint: POST /admin/archive-activity (requires admin role or API key)
- Cron setup using node-cron (optional, can be disabled)

**Files to Create:**
- `src/services/archival.service.ts`
- `src/routes/admin.ts` - Admin endpoints

**Dependencies to Install:**
- `node-cron`
- `@types/node-cron`

---

### TASK-012: Archive Query Support
| Field | Value |
|-------|-------|
| **ID** | TASK-012 |
| **Feature** | 2 - Activity Archival |
| **Status** | 📋 Todo |
| **Assigned** | Backend Developer |
| **ACs** | AC-2.6 |
| **Complexity** | Low |
| **Dependencies** | TASK-010, TASK-011 |

**Description:**
Add query parameter to include archived activity logs in results.

**Acceptance Criteria:**
- [ ] AC-2.6: GET /groups/:groupId/activity supports `includeArchived` query param

**Technical Notes:**
- Default: `includeArchived=false` (current behavior)
- When true: UNION query with archive table
- Consider performance implications (large datasets)
- Add pagination if not already present

**Files to Modify:**
- `src/routes/groups.ts` - Update activity endpoint
- `src/services/activity.service.ts` - Add archive query support

---

## Phase 5: Testing & QA

### TASK-013: Unit Tests for New Services
| Field | Value |
|-------|-------|
| **ID** | TASK-013 |
| **Feature** | All |
| **Status** | 📋 Todo |
| **Assigned** | Backend Developer |
| **ACs** | N/A (quality task) |
| **Complexity** | High |
| **Dependencies** | TASK-004 through TASK-012 |

**Description:**
Write unit tests for all new services.

**Test Coverage Required:**
- User preferences service (CRUD operations)
- Email service (provider abstraction, template rendering)
- Archival service (archive, cleanup, batch processing)

**Files to Create:**
- `src/__tests__/user-preferences.service.test.ts`
- `src/__tests__/email.service.test.ts`
- `src/__tests__/archival.service.test.ts`

---

### TASK-014: Final Review and QA Sign-Off
| Field | Value |
|-------|-------|
| **ID** | TASK-014 |
| **Feature** | All |
| **Status** | 📋 Todo |
| **Assigned** | Lead Developer + QA |
| **ACs** | All (30 ACs) |
| **Complexity** | Medium |
| **Dependencies** | All previous tasks |

**Description:**
Final code review, AC verification, and QA sign-off for sprint completion.

**Checklist:**
- [ ] All 30 acceptance criteria verified
- [ ] All unit tests pass
- [ ] All integration tests pass (including in CI)
- [ ] Code reviewed by Lead Developer
- [ ] Documentation updated
- [ ] No P0/P1 bugs open
- [ ] QA sign-off obtained

**Files to Create:**
- `Sprints/sprint-006/REVIEW_LOG.md`
- `Sprints/sprint-006/QA_REPORT.md`

---

## Task Assignment Summary

| Assignee | Tasks | Total ACs |
|----------|-------|-----------|
| Backend Developer | TASK-001, 003, 004, 005, 006, 007, 008, 009, 010, 011, 012, 013 | 26 |
| Lead Developer | TASK-002, 014 | 4 |
| QA Engineer | TASK-014 | N/A |

---

## Sprint Timeline (Suggested)

| Day | Focus | Tasks |
|-----|-------|-------|
| 1 | Technical Debt | TASK-001, TASK-002, TASK-003 |
| 2 | User Preferences | TASK-004, TASK-005, TASK-006 |
| 3 | Email Service | TASK-007, TASK-008, TASK-009 |
| 4 | Activity Archival | TASK-010, TASK-011, TASK-012 |
| 5 | Testing & QA | TASK-013, TASK-014 |

---

## Notes

- TypeScript fixes (TASK-001) should be done first to unblock CI improvements
- Email service can be developed in parallel with user preferences
- Install dependencies early: `bun add nodemailer node-cron && bun add -d @types/nodemailer @types/node-cron`
- Activity archival is lower priority; can be deferred if needed
