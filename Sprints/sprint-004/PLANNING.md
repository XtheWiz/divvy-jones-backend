# Sprint 004 Planning Document

## Planning Session Information
| Field | Value |
|-------|-------|
| **Sprint** | 004 |
| **Date** | 2026-01-20 |
| **Lead Developer** | Claude (Lead Dev) |
| **Attendees** | Lead Dev |

---

## Sprint Goal Review

> Complete the expense tracking workflow with file attachments, establish production-ready CI/CD infrastructure, and provide visibility into group activity through an activity log.

**Assessment:** Goal is achievable with existing schema support and clear technical requirements.

---

## Feature Analysis

### Feature 0: Technical Debt & CI/CD Infrastructure

#### 0.1 Route Parameter Standardization

**Current State Analysis:**

| Route File | Current Pattern | Required Pattern | Status |
|------------|-----------------|------------------|--------|
| `groups.ts` | `:id` | `:groupId` | ❌ Needs change |
| `expenses.ts` | `:groupId` | `:groupId` | ✅ Correct |
| `settlements.ts` | `:groupId` | `:groupId` | ✅ Correct |
| `notifications.ts` | `:id` (for notification) | `:notificationId` | ⚠️ Different entity, optional |

**Affected Routes in groups.ts:**
- `GET /groups/:id` → `GET /groups/:groupId`
- `GET /groups/:id/members` → `GET /groups/:groupId/members`
- `PUT /groups/:id` → `PUT /groups/:groupId`
- `POST /groups/:id/leave` → `POST /groups/:groupId/leave`
- `POST /groups/:id/regenerate-code` → `POST /groups/:groupId/regenerate-code`
- `DELETE /groups/:id` → `DELETE /groups/:groupId`
- `GET /groups/:id/balances` → `GET /groups/:groupId/balances`

**Technical Decision:** 
- Change all group routes to use `:groupId` for consistency
- Update param schema validations accordingly
- Keep notifications using `:id` as it's a different entity context

#### 0.2 CI/CD Test Database Configuration

**Current State:**
- Test setup exists in `src/__tests__/integration/setup.ts`
- Uses `DATABASE_URL_TEST` environment variable
- No GitHub Actions workflow exists

**Technical Decision:**
- Create `.github/workflows/test.yml` workflow
- Use PostgreSQL service container in GitHub Actions
- Run both unit tests and integration tests
- Fail workflow if any test fails

**Workflow Structure:**
```yaml
name: Tests
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:16
        env:
          POSTGRES_DB: divvy_test
          POSTGRES_USER: test
          POSTGRES_PASSWORD: test
        ports:
          - 5432:5432
    steps:
      - checkout
      - setup bun
      - install dependencies
      - run migrations
      - run tests
```

#### 0.3 Developer Experience Improvements

**Technical Decision:**
- Create `CONTRIBUTING.md` documenting:
  - Route parameter naming conventions (`:entityId` format)
  - Service layer patterns
  - Test file organization
- Pre-commit hook: Consider using simple bash script or lefthook
- ESLint rules: Defer to future sprint (P2)

---

### Feature 1: Evidence/Attachment System

#### Database Schema Assessment

**Existing `evidences` table (settlements.ts:69-99):**
```typescript
{
  id: uuid,
  target: text ('expense' | 'settlement'),
  expenseId: uuid (nullable, FK to expenses),
  settlementId: uuid (nullable, FK to settlements),
  fileKey: text,  // S3/storage key
  mimeType: text,
  sizeBytes: integer,
  createdByUserId: uuid,
  createdAt: timestamp
}
```

**Assessment:** Schema is complete and ready to use. No migrations needed.

**Existing Enums:**
- `evidenceTarget`: ['expense', 'settlement'] ✅

#### Storage Architecture

**Technical Decision:** Abstracted storage interface

```typescript
// src/lib/storage.ts
interface StorageProvider {
  upload(file: Buffer, key: string, mimeType: string): Promise<string>;
  download(key: string): Promise<Buffer>;
  delete(key: string): Promise<void>;
  getSignedUrl(key: string, expiresIn?: number): Promise<string>;
}

class LocalStorageProvider implements StorageProvider { ... }
class S3StorageProvider implements StorageProvider { ... }
```

**Environment Configuration:**
- `STORAGE_PROVIDER`: 'local' | 's3' (default: 'local')
- `STORAGE_LOCAL_PATH`: './uploads' (for local)
- `STORAGE_S3_BUCKET`: bucket name (for S3)
- `STORAGE_S3_REGION`: region (for S3)

#### File Validation

**Technical Decision:**
- Validate MIME type server-side (not just extension)
- Use `file-type` package for magic number detection
- Accepted types: `image/jpeg`, `image/png`, `application/pdf`, `image/heic`
- Max size: 10MB (10 * 1024 * 1024 bytes)

#### API Design

**Expense Attachments:**
```
POST   /groups/:groupId/expenses/:expenseId/attachments
GET    /groups/:groupId/expenses/:expenseId/attachments
GET    /groups/:groupId/expenses/:expenseId/attachments/:attachmentId
DELETE /groups/:groupId/expenses/:expenseId/attachments/:attachmentId
```

**Settlement Attachments:**
```
POST   /groups/:groupId/settlements/:settlementId/attachments
GET    /groups/:groupId/settlements/:settlementId/attachments
GET    /groups/:groupId/settlements/:settlementId/attachments/:attachmentId
DELETE /groups/:groupId/settlements/:settlementId/attachments/:attachmentId
```

**Response Format:**
```typescript
interface Attachment {
  id: string;
  fileKey: string;
  mimeType: string;
  sizeBytes: number;
  downloadUrl: string;  // Signed URL or direct path
  createdBy: { id: string; displayName: string };
  createdAt: string;
}
```

---

### Feature 2: Activity Log

#### Database Schema Assessment

**Existing `activity_log` table (notifications.ts:50-77):**
```typescript
{
  id: uuid,
  groupId: uuid,
  actorMemberId: uuid (nullable for system),
  action: text,
  entityType: text,
  entityId: uuid,
  oldValues: jsonb,
  newValues: jsonb,
  ipAddress: text,
  userAgent: text,
  createdAt: timestamp
}
```

**Assessment:** Schema is complete. No migrations needed.

**Existing Actions Enum:**
- `activityAction`: ['create', 'update', 'delete', 'restore', 'join', 'leave', 'invite', 'remove', 'approve', 'reject', 'settle', 'confirm', 'cancel']

#### Activity Recording Strategy

**Technical Decision:** Create activity logging helper to be called from existing services.

```typescript
// src/services/activity.service.ts
async function logActivity(params: {
  groupId: string;
  actorMemberId: string | null;
  action: ActivityAction;
  entityType: 'expense' | 'settlement' | 'member' | 'group' | 'attachment';
  entityId: string;
  oldValues?: Record<string, unknown>;
  newValues?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
}): Promise<void>
```

**Integration Points:**
1. `expense.service.ts` - createExpense, updateExpense, deleteExpense
2. `settlement.service.ts` - createSettlement, confirmSettlement, rejectSettlement, cancelSettlement
3. `group.service.ts` - joinGroup, leaveGroup
4. `evidence.service.ts` - uploadAttachment (new)

#### API Design

```
GET /groups/:groupId/activity
  Query params:
    - limit: number (default 20, max 100)
    - offset: number (default 0)
    - type: 'expense' | 'settlement' | 'member' (optional filter)
    - from: ISO date string (optional)
    - to: ISO date string (optional)
```

**Response Format:**
```typescript
interface ActivityItem {
  id: string;
  actor: { id: string; displayName: string } | null;
  action: string;
  entityType: string;
  entityId: string;
  summary: string;  // Human-readable description
  timestamp: string;
}
```

---

## Technical Decisions Summary

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Route params | Use `:groupId` format | Consistency, clarity, avoids Elysia conflicts |
| Storage | Abstracted interface | Easy local/S3 switching |
| File validation | Magic number detection | Security (MIME spoofing prevention) |
| Activity logging | Service helper | Reusable, consistent logging |
| CI/CD | GitHub Actions + PostgreSQL | Standard, reliable |

---

## Dependencies

### NPM Packages (New)
| Package | Purpose | Version |
|---------|---------|---------|
| `file-type` | MIME type detection | ^19.0.0 |

### External Services
- PostgreSQL 16+ (CI)
- S3-compatible storage (production - optional)

---

## File Structure (New Files)

```
src/
├── lib/
│   └── storage.ts           # Storage provider interface
├── services/
│   ├── evidence.service.ts  # Attachment CRUD
│   └── activity.service.ts  # Activity logging
├── routes/
│   ├── attachments.ts       # Attachment endpoints (nested under expenses/settlements)
│   └── activity.ts          # Activity log endpoints
└── __tests__/
    ├── evidence.service.test.ts
    ├── activity.service.test.ts
    └── integration/
        └── attachments.integration.test.ts

.github/
└── workflows/
    └── test.yml

uploads/                      # Local storage directory (gitignored)

CONTRIBUTING.md
```

---

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Route change breaks clients | Medium | High | Document changes, no existing clients in production |
| Large file uploads slow API | Medium | Medium | Size limits, async processing if needed |
| Activity logging adds latency | Low | Low | Fire-and-forget, non-blocking |

---

## Task Breakdown Preview

### Phase 1: Technical Debt (Priority)
- TASK-001: Route parameter standardization (groups.ts)
- TASK-002: Update unit tests for route changes
- TASK-003: GitHub Actions workflow
- TASK-004: CONTRIBUTING.md documentation

### Phase 2: Evidence/Attachment System
- TASK-005: Storage provider interface
- TASK-006: Evidence service (CRUD operations)
- TASK-007: Expense attachment routes
- TASK-008: Settlement attachment routes
- TASK-009: Evidence service unit tests
- TASK-010: Update expense/settlement responses to include attachments

### Phase 3: Activity Log
- TASK-011: Activity service
- TASK-012: Activity routes
- TASK-013: Integrate activity logging into existing services
- TASK-014: Activity service unit tests

### Phase 4: QA & Integration Testing
- TASK-015: Integration tests for attachments
- TASK-016: Integration tests for activity log
- TASK-017: Final review and documentation

---

## Sign-off

| Role | Approved | Date |
|------|----------|------|
| Lead Developer | [x] | 2026-01-20 |

---

## Changelog

| Date | Author | Change |
|------|--------|--------|
| 2026-01-20 | Lead Dev | Initial planning document |
