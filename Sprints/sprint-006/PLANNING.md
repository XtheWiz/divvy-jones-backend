# Sprint 006 Planning

## Planning Session

| Field | Value |
|-------|-------|
| **Sprint** | 006 |
| **Lead Developer** | Claude (Lead Dev Mode) |
| **Planning Date** | 2026-01-21 |
| **Status** | Complete |

---

## Current State Analysis

### TypeScript Errors Assessment

After running `bun run typecheck`, the errors are primarily in **test files**, not source files:

| Category | Count | Files Affected |
|----------|-------|----------------|
| `body` is of type 'unknown' | ~50 | currencies.routes.test.ts, api.routes.test.ts |
| Mock function missing `preconnect` | 3 | exchange-rate.service.test.ts |
| Elysia type mismatches | ~200 | integration/*.test.ts |
| Other | ~20 | Various test files |

**Key Finding:** Source files pass type checking (`bun run typecheck:src`). The issues are test-specific type definitions.

### CI Workflow Status

Current `.github/workflows/test.yml`:
- ✅ PostgreSQL service configured
- ✅ DATABASE_URL_TEST environment variable set
- ✅ Runs unit tests and integration tests separately
- ⚠️ Type check has `continue-on-error: true` (doesn't fail build)

### Existing Schema Review

**User Settings (`src/db/schema/users.ts`):**
```typescript
userSettings = pgTable("user_settings", {
  pushEnabled: boolean("push_enabled").default(true),
  emailNotifications: boolean("email_notifications").default(true),
  // Missing: granular notification type preferences
});
```

**Activity Log (`src/db/schema/notifications.ts`):**
- Schema is complete and well-indexed
- No archive table exists yet

---

## Technical Decisions

### Decision 1: TypeScript Error Resolution Strategy

**Approach:** Fix test file types incrementally

1. **Add type assertions for Elysia response bodies**
   ```typescript
   const body = response.body as { currencies: Currency[] };
   ```

2. **Create proper mock types for fetch**
   ```typescript
   const mockFetch = mock(() => Promise.resolve(...)) as unknown as typeof fetch;
   ```

3. **Fix integration test helper types**
   - Update `src/__tests__/integration/setup.ts` to export properly typed helpers

**Rationale:** This approach fixes the errors without changing production code.

---

### Decision 2: User Preferences Schema Extension

**Approach:** Extend existing `userSettings` table

```typescript
// Add to userSettings table:
notifyOnExpenseAdded: boolean("notify_on_expense_added").default(true),
notifyOnSettlement: boolean("notify_on_settlement").default(true),
notifyOnGroupActivity: boolean("notify_on_group_activity").default(true),
```

**Rationale:**
- Table already exists with `pushEnabled` and `emailNotifications`
- Adding columns is simpler than creating a new table
- Keeps all preferences in one place

**Migration Strategy:**
- Use Drizzle's `db:push` for development
- Generate proper migration for production

---

### Decision 3: Email Service Architecture

**Approach:** Provider abstraction with factory pattern

```
src/services/email/
├── index.ts              # Factory and exports
├── email.service.ts      # Abstract interface
├── smtp.provider.ts      # SMTP via nodemailer
├── sendgrid.provider.ts  # SendGrid provider
└── templates/
    ├── expense-added.ts
    ├── settlement-requested.ts
    └── settlement-confirmed.ts
```

**Provider Selection:**
```typescript
// Environment variable: EMAIL_PROVIDER=smtp|sendgrid|console
const provider = getEmailProvider();
```

**Rationale:**
- Same pattern as storage provider (proven in Sprint 005)
- Easy to add new providers (SES, Mailgun, etc.)
- Console provider for development (no external deps)

---

### Decision 4: Activity Log Archival

**Approach:** Separate archive table with manual + scheduled archival

**Archive Schema:**
```typescript
activityLogArchive = pgTable("activity_log_archive", {
  // Same columns as activityLog
  archivedAt: timestamp("archived_at").defaultNow(), // Additional column
});
```

**Archival Process:**
1. Move records older than 90 days (configurable)
2. Use transaction for atomicity
3. Delete from source after successful insert

**Scheduler:** Use `node-cron` for scheduled execution (can be disabled)

**Rationale:**
- Keeps active table small for performance
- Archive table can be backed up separately
- Query param allows accessing archived data when needed

---

### Decision 5: CI Workflow Enhancement

**Changes to `.github/workflows/test.yml`:**

1. Remove `continue-on-error: true` from type check
2. Add test failure handling (already exists)
3. Keep integration tests separate from unit tests

**Rationale:** Type errors should block CI to enforce code quality.

---

## Task Breakdown

### Phase 1: Technical Debt (Feature 0)
| Task | ACs | Complexity | Assignee |
|------|-----|------------|----------|
| TASK-001: Fix test file TypeScript errors | AC-0.1 to AC-0.4 | High | Backend Dev |
| TASK-002: Update CI workflow | AC-0.5 to AC-0.8 | Low | Lead Dev |
| TASK-003: Integration tests for Sprint 005 | AC-0.9, AC-0.10 | Medium | Backend Dev |

### Phase 2: User Preferences (Feature 1, Part A)
| Task | ACs | Complexity | Assignee |
|------|-----|------------|----------|
| TASK-004: Extend user preferences schema | AC-1.1 to AC-1.4 | Medium | Backend Dev |
| TASK-005: User preferences API | AC-1.5 to AC-1.8 | Medium | Backend Dev |

### Phase 3: Email Notifications (Feature 1, Part B)
| Task | ACs | Complexity | Assignee |
|------|-----|------------|----------|
| TASK-006: Email service abstraction | AC-1.9 | High | Backend Dev |
| TASK-007: Email templates | AC-1.10 | Medium | Backend Dev |
| TASK-008: Email integration with notifications | AC-1.11, AC-1.12 | Medium | Backend Dev |
| TASK-009: Notification filtering | AC-1.13, AC-1.14 | Low | Backend Dev |

### Phase 4: Activity Archival (Feature 2)
| Task | ACs | Complexity | Assignee |
|------|-----|------------|----------|
| TASK-010: Archive schema and migration | AC-2.1, AC-2.2 | Low | Backend Dev |
| TASK-011: Archival service | AC-2.3 to AC-2.5 | Medium | Backend Dev |
| TASK-012: Archive query support | AC-2.6 | Low | Backend Dev |

### Phase 5: Testing & QA
| Task | ACs | Complexity | Assignee |
|------|-----|------------|----------|
| TASK-013: Unit tests for new services | N/A | High | Backend Dev |
| TASK-014: Final review and QA sign-off | All | Medium | Lead Dev + QA |

---

## Dependencies

### External Packages (to install)

| Package | Version | Purpose |
|---------|---------|---------|
| `nodemailer` | ^6.9.0 | SMTP email sending |
| `@types/nodemailer` | ^6.4.0 | TypeScript types |
| `node-cron` | ^3.0.0 | Scheduled jobs |
| `@types/node-cron` | ^3.0.0 | TypeScript types |

**Note:** `@sendgrid/mail` is optional and can be added when needed.

### Database Changes

1. Add columns to `user_settings` table
2. Create `activity_log_archive` table
3. Run migration before deployment

---

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| TypeScript fixes cause test failures | Medium | Medium | Run tests after each fix batch |
| Email provider credentials missing | Low | Low | Console provider fallback |
| Archival locks active table | Low | Medium | Use row-level operations, not table lock |

---

## Environment Variables (New)

```env
# Email Service
EMAIL_PROVIDER=console|smtp|sendgrid
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_USER=user
SMTP_PASS=password
SMTP_FROM=noreply@divvyjones.com
SENDGRID_API_KEY=SG.xxx

# Archival
ARCHIVAL_RETENTION_DAYS=90
ARCHIVAL_CRON_SCHEDULE=0 3 * * *  # 3 AM daily
```

---

## Timeline (Suggested)

| Day | Phase | Tasks |
|-----|-------|-------|
| 1 | Technical Debt | TASK-001, TASK-002, TASK-003 |
| 2 | User Preferences | TASK-004, TASK-005, TASK-006 |
| 3 | Email Service | TASK-007, TASK-008, TASK-009 |
| 4 | Activity Archival | TASK-010, TASK-011, TASK-012 |
| 5 | Testing & QA | TASK-013, TASK-014 |

---

## Planning Sign-Off

| Role | Name | Status |
|------|------|--------|
| Lead Developer | Claude (Lead Dev) | ✅ Complete |

---

**Planning complete. Ready for task assignment.**
