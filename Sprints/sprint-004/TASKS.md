# Sprint 004 Task Board

## Task Status Legend
| Status | Symbol | Description |
|--------|--------|-------------|
| Todo | ⬜ | Not started |
| In Progress | 🔄 | Currently being worked on |
| In Review | 👀 | Awaiting code review |
| QA | 🧪 | Ready for QA testing |
| Done | ✅ | Completed and verified |
| Blocked | 🚫 | Waiting on dependency |

---

## Phase Summary

| Phase | Tasks | Status |
|-------|-------|--------|
| Phase 1: Technical Debt | TASK-001 to TASK-004 | ✅ Done (4/4 done) |
| Phase 2: Evidence System | TASK-005 to TASK-010 | ✅ Done (6/6 done) |
| Phase 3: Activity Log | TASK-011 to TASK-014 | ✅ Done (4/4 done) |
| Phase 4: QA & Integration | TASK-015 to TASK-017 | ✅ Done (3/3 done) |

---

## Phase 1: Technical Debt & CI/CD Infrastructure

### TASK-001: Route Parameter Standardization
| Field | Value |
|-------|-------|
| **ID** | TASK-001 |
| **Title** | Standardize route parameters in groups.ts |
| **Assigned To** | Backend Developer |
| **Status** | ✅ Done |
| **Priority** | P0 |
| **ACs Covered** | AC-0.1, AC-0.4, AC-0.5 |

**Description:**
Refactor `src/routes/groups.ts` to use `:groupId` parameter instead of `:id` for all group routes.

**Technical Notes:**
- Update route definitions from `/:id` to `/:groupId`
- Update param schema from `id: t.String()` to `groupId: t.String()`
- Update destructuring in handlers from `{ id }` to `{ groupId }`
- Verify route registration order (no conflicts)

**Files to Modify:**
- `src/routes/groups.ts`

**Acceptance Criteria:**
- [ ] All group routes use `:groupId` parameter
- [ ] All param schemas updated
- [ ] All handler destructuring updated
- [ ] Application starts without route conflicts

---

### TASK-002: Update Unit Tests for Route Changes
| Field | Value |
|-------|-------|
| **ID** | TASK-002 |
| **Title** | Update unit tests after route refactoring |
| **Assigned To** | Backend Developer |
| **Status** | ✅ Done |
| **Priority** | P0 |
| **ACs Covered** | AC-0.5 |
| **Depends On** | TASK-001 |

**Description:**
Update any unit tests that reference the old route parameter naming.

**Technical Notes:**
- Search for `:id` references in test files
- Update test request URLs if needed
- Ensure all 250 existing tests still pass

**Files to Modify:**
- `src/__tests__/*.test.ts` (as needed)

**Acceptance Criteria:**
- [ ] All existing unit tests pass
- [ ] No references to old parameter names in tests

---

### TASK-003: GitHub Actions CI/CD Workflow
| Field | Value |
|-------|-------|
| **ID** | TASK-003 |
| **Title** | Create GitHub Actions test workflow |
| **Assigned To** | Lead Developer |
| **Status** | ✅ Done |
| **Priority** | P0 |
| **ACs Covered** | AC-0.6, AC-0.7, AC-0.8, AC-0.9 |

**Description:**
Create GitHub Actions workflow that runs tests on every push and PR.

**Technical Notes:**
- Use PostgreSQL 16 service container
- Set up Bun runtime
- Run migrations before tests
- Run both unit and integration tests
- Fail workflow if any test fails

**Files to Create:**
- `.github/workflows/test.yml`

**Acceptance Criteria:**
- [ ] Workflow runs on push and PR
- [ ] PostgreSQL service container configured
- [ ] Migrations run before tests
- [ ] All tests execute
- [ ] Workflow fails if any test fails

**Workflow Template:**
```yaml
name: Tests
on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main, develop]

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
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5

    steps:
      - uses: actions/checkout@v4
      
      - uses: oven-sh/setup-bun@v2
        with:
          bun-version: latest
      
      - name: Install dependencies
        run: bun install
      
      - name: Run migrations
        run: bun run db:push
        env:
          DATABASE_URL: postgresql://test:test@localhost:5432/divvy_test
      
      - name: Seed enum tables
        run: bun run db:seed
        env:
          DATABASE_URL: postgresql://test:test@localhost:5432/divvy_test
      
      - name: Run tests
        run: bun test
        env:
          DATABASE_URL: postgresql://test:test@localhost:5432/divvy_test
          DATABASE_URL_TEST: postgresql://test:test@localhost:5432/divvy_test
          JWT_SECRET: test-secret-for-ci
```

---

### TASK-004: CONTRIBUTING.md Documentation
| Field | Value |
|-------|-------|
| **ID** | TASK-004 |
| **Title** | Create CONTRIBUTING.md with coding standards |
| **Assigned To** | Lead Developer |
| **Status** | ✅ Done |
| **Priority** | P1 |
| **ACs Covered** | AC-0.11 |

**Description:**
Document coding standards, naming conventions, and development workflow.

**Files to Create:**
- `CONTRIBUTING.md`

**Content Outline:**
1. Route parameter naming conventions (`:entityId` format)
2. Service layer patterns
3. Test file organization
4. Git workflow (branching, commits, PRs)
5. Code review checklist

**Acceptance Criteria:**
- [ ] Route naming conventions documented
- [ ] Service patterns documented
- [ ] Test organization documented

---

## Phase 2: Evidence/Attachment System

### TASK-005: Storage Provider Interface
| Field | Value |
|-------|-------|
| **ID** | TASK-005 |
| **Title** | Create abstracted storage provider |
| **Assigned To** | Backend Developer |
| **Status** | ✅ Done |
| **Priority** | P0 |
| **ACs Covered** | AC-1.2, AC-1.6 |

**Description:**
Create storage abstraction layer with local filesystem implementation.

**Technical Notes:**
- Create `StorageProvider` interface
- Implement `LocalStorageProvider`
- Generate unique, non-guessable file keys using nanoid
- Store files in `./uploads/` directory
- Add `uploads/` to `.gitignore`

**Files to Create:**
- `src/lib/storage.ts`

**Interface Design:**
```typescript
interface StorageProvider {
  upload(buffer: Buffer, key: string, mimeType: string): Promise<string>;
  download(key: string): Promise<Buffer>;
  delete(key: string): Promise<void>;
  exists(key: string): Promise<boolean>;
}
```

**Acceptance Criteria:**
- [ ] StorageProvider interface defined
- [ ] LocalStorageProvider implemented
- [ ] Files stored with unique keys
- [ ] Upload directory created on first use
- [ ] .gitignore updated

---

### TASK-006: Evidence Service
| Field | Value |
|-------|-------|
| **ID** | TASK-006 |
| **Title** | Create evidence service for CRUD operations |
| **Assigned To** | Backend Developer |
| **Status** | ✅ Done |
| **Priority** | P0 |
| **ACs Covered** | AC-1.3, AC-1.4, AC-1.5, AC-1.13, AC-1.20 |
| **Depends On** | TASK-005 |

**Description:**
Create service layer for managing file attachments (evidences).

**Technical Notes:**
- Validate file size (max 10MB)
- Validate MIME types (JPEG, PNG, PDF, HEIC)
- Enforce attachment limits (5 per expense, 3 per settlement)
- Use magic number detection for MIME validation
- Store metadata in `evidences` table

**Files to Create:**
- `src/services/evidence.service.ts`

**Functions:**
```typescript
uploadEvidence(params: {
  target: 'expense' | 'settlement';
  targetId: string;
  file: Buffer;
  mimeType: string;
  originalName: string;
  createdByUserId: string;
}): Promise<Evidence>

listEvidences(target: 'expense' | 'settlement', targetId: string): Promise<Evidence[]>

getEvidence(evidenceId: string): Promise<Evidence | null>

deleteEvidence(evidenceId: string): Promise<void>

countEvidences(target: 'expense' | 'settlement', targetId: string): Promise<number>
```

**Acceptance Criteria:**
- [ ] File size validation (10MB max)
- [ ] MIME type validation
- [ ] Attachment count limits enforced
- [ ] CRUD operations work correctly

---

### TASK-007: Expense Attachment Routes
| Field | Value |
|-------|-------|
| **ID** | TASK-007 |
| **Title** | Implement expense attachment endpoints |
| **Assigned To** | Backend Developer |
| **Status** | ✅ Done |
| **Priority** | P0 |
| **ACs Covered** | AC-1.1, AC-1.7, AC-1.8, AC-1.9, AC-1.10, AC-1.11, AC-1.12 |
| **Depends On** | TASK-006 |

**Description:**
Create REST endpoints for expense attachments.

**Endpoints:**
- `POST /groups/:groupId/expenses/:expenseId/attachments` - Upload
- `GET /groups/:groupId/expenses/:expenseId/attachments` - List
- `GET /groups/:groupId/expenses/:expenseId/attachments/:attachmentId` - Download
- `DELETE /groups/:groupId/expenses/:expenseId/attachments/:attachmentId` - Delete

**Technical Notes:**
- Accept multipart/form-data for uploads
- Only group members can access
- Only expense creator and admins can delete
- Return file buffer for download (or signed URL)

**Files to Create:**
- `src/routes/attachments.ts` (or extend `expenses.ts`)

**Acceptance Criteria:**
- [ ] Upload endpoint accepts multipart/form-data
- [ ] List endpoint returns attachment metadata
- [ ] Download endpoint returns file
- [ ] Delete endpoint removes file and record
- [ ] Authorization rules enforced

---

### TASK-008: Settlement Attachment Routes
| Field | Value |
|-------|-------|
| **ID** | TASK-008 |
| **Title** | Implement settlement attachment endpoints |
| **Assigned To** | Backend Developer |
| **Status** | ✅ Done |
| **Priority** | P0 |
| **ACs Covered** | AC-1.14, AC-1.15, AC-1.16, AC-1.17, AC-1.18, AC-1.19 |
| **Depends On** | TASK-006 |

**Description:**
Create REST endpoints for settlement attachments (proof of payment).

**Endpoints:**
- `POST /groups/:groupId/settlements/:settlementId/attachments` - Upload
- `GET /groups/:groupId/settlements/:settlementId/attachments` - List
- `GET /groups/:groupId/settlements/:settlementId/attachments/:attachmentId` - Download
- `DELETE /groups/:groupId/settlements/:settlementId/attachments/:attachmentId` - Delete

**Technical Notes:**
- Only payer can upload attachments
- Group members can view
- Only payer can delete

**Files to Modify:**
- `src/routes/attachments.ts`

**Acceptance Criteria:**
- [ ] Upload endpoint accepts multipart/form-data
- [ ] Only payer can upload
- [ ] List endpoint returns attachment metadata
- [ ] Download endpoint returns file
- [ ] Delete endpoint works for payer only

---

### TASK-009: Evidence Service Unit Tests
| Field | Value |
|-------|-------|
| **ID** | TASK-009 |
| **Title** | Write unit tests for evidence service |
| **Assigned To** | Backend Developer |
| **Status** | ✅ Done |
| **Priority** | P0 |
| **ACs Covered** | - |
| **Depends On** | TASK-006 |

**Description:**
Comprehensive unit tests for evidence service.

**Test Cases:**
1. File size validation (reject > 10MB)
2. MIME type validation (accept only allowed types)
3. Attachment count limits (5 for expense, 3 for settlement)
4. Unique key generation
5. CRUD operations
6. Error handling

**Files to Create:**
- `src/__tests__/evidence.service.test.ts`

**Acceptance Criteria:**
- [ ] Size validation tests
- [ ] MIME validation tests
- [ ] Limit enforcement tests
- [ ] CRUD operation tests
- [ ] All tests pass

---

### TASK-010: Update Expense/Settlement Responses
| Field | Value |
|-------|-------|
| **ID** | TASK-010 |
| **Title** | Include attachments in expense/settlement detail responses |
| **Assigned To** | Backend Developer |
| **Status** | ✅ Done |
| **Priority** | P1 |
| **ACs Covered** | AC-1.19 (settlement), implicit for expense |
| **Depends On** | TASK-006 |

**Description:**
Modify GET expense and GET settlement detail endpoints to include attachments.

**Technical Notes:**
- Query evidences table when fetching details
- Include attachment array in response
- Don't include full file content, just metadata

**Files to Modify:**
- `src/routes/expenses.ts` (GET /:expenseId)
- `src/routes/settlements.ts` (GET /:settlementId)

**Acceptance Criteria:**
- [ ] Expense details include attachments array
- [ ] Settlement details include attachments array
- [ ] Attachment metadata includes id, mimeType, sizeBytes, createdAt

---

## Phase 3: Activity Log

### TASK-011: Activity Service
| Field | Value |
|-------|-------|
| **ID** | TASK-011 |
| **Title** | Create activity logging service |
| **Assigned To** | Backend Developer |
| **Status** | ✅ Done |
| **Priority** | P0 |
| **ACs Covered** | AC-2.1 through AC-2.9 (tracking) |

**Description:**
Create service for logging activity to activity_log table.

**Technical Notes:**
- Use existing `activity_log` schema
- Non-blocking (fire-and-forget where possible)
- Include old/new values for auditing

**Files to Create:**
- `src/services/activity.service.ts`

**Functions:**
```typescript
logActivity(params: {
  groupId: string;
  actorMemberId: string | null;
  action: ActivityAction;
  entityType: string;
  entityId: string;
  oldValues?: Record<string, unknown>;
  newValues?: Record<string, unknown>;
}): Promise<void>

listActivity(params: {
  groupId: string;
  limit?: number;
  offset?: number;
  entityType?: string;
  from?: Date;
  to?: Date;
}): Promise<{ activities: ActivityLog[]; total: number }>

formatActivitySummary(activity: ActivityLog): string
```

**Acceptance Criteria:**
- [ ] Activity can be logged to database
- [ ] Activity can be queried with pagination
- [ ] Activity can be filtered by type and date
- [ ] Human-readable summaries generated

---

### TASK-012: Activity Routes
| Field | Value |
|-------|-------|
| **ID** | TASK-012 |
| **Title** | Implement activity log API endpoint |
| **Assigned To** | Backend Developer |
| **Status** | ✅ Done |
| **Priority** | P0 |
| **ACs Covered** | AC-2.10, AC-2.11, AC-2.12, AC-2.13, AC-2.14, AC-2.15 |
| **Depends On** | TASK-011 |

**Description:**
Create REST endpoint for retrieving group activity.

**Endpoint:**
- `GET /groups/:groupId/activity`

**Query Parameters:**
- `limit`: number (default 20, max 100)
- `offset`: number (default 0)
- `type`: 'expense' | 'settlement' | 'member' (optional)
- `from`: ISO date (optional)
- `to`: ISO date (optional)

**Files to Create:**
- `src/routes/activity.ts`

**Acceptance Criteria:**
- [ ] Endpoint returns paginated activity
- [ ] Default limit is 20, max 100
- [ ] Results sorted by timestamp descending
- [ ] Filter by type works
- [ ] Filter by date range works

---

### TASK-013: Integrate Activity Logging
| Field | Value |
|-------|-------|
| **ID** | TASK-013 |
| **Title** | Add activity logging to existing services |
| **Assigned To** | Backend Developer |
| **Status** | ✅ Done |
| **Priority** | P0 |
| **ACs Covered** | AC-2.1 through AC-2.9 |
| **Depends On** | TASK-011 |

**Description:**
Call activity logging from existing service functions.

**Integration Points:**
1. `expense.service.ts`:
   - createExpense → log 'create' action
   - updateExpense → log 'update' action
   - deleteExpense → log 'delete' action

2. `settlement.service.ts`:
   - createSettlement → log 'create' action
   - confirmSettlement → log 'confirm' action
   - rejectSettlement → log 'reject' action
   - cancelSettlement → log 'cancel' action

3. `group.service.ts`:
   - joinGroup → log 'join' action
   - leaveGroup → log 'leave' action

4. `evidence.service.ts`:
   - uploadEvidence → log 'create' action

**Files to Modify:**
- `src/services/expense.service.ts`
- `src/services/settlement.service.ts`
- `src/services/group.service.ts`
- `src/services/evidence.service.ts`

**Acceptance Criteria:**
- [ ] Expense actions logged
- [ ] Settlement actions logged
- [ ] Member join/leave logged
- [ ] Attachment creation logged

---

### TASK-014: Activity Service Unit Tests
| Field | Value |
|-------|-------|
| **ID** | TASK-014 |
| **Title** | Write unit tests for activity service |
| **Assigned To** | Backend Developer |
| **Status** | ✅ Done |
| **Priority** | P0 |
| **ACs Covered** | - |
| **Depends On** | TASK-011 |

**Description:**
Comprehensive unit tests for activity service.

**Test Cases:**
1. Activity logging creates record
2. Pagination works correctly
3. Filtering by type works
4. Filtering by date range works
5. Summary formatting
6. Sorting (newest first)

**Files to Create:**
- `src/__tests__/activity.service.test.ts`

**Acceptance Criteria:**
- [ ] Logging tests
- [ ] Pagination tests
- [ ] Filter tests
- [ ] Sorting tests
- [ ] All tests pass

---

## Phase 4: QA & Integration Testing

### TASK-015: Attachment Integration Tests
| Field | Value |
|-------|-------|
| **ID** | TASK-015 |
| **Title** | Write integration tests for attachments |
| **Assigned To** | QA Engineer |
| **Status** | ✅ Done |
| **Priority** | P0 |
| **ACs Covered** | All AC-1.x |
| **Depends On** | TASK-007, TASK-008 |

**Description:**
End-to-end integration tests for attachment system.

**Test Scenarios:**
1. Upload attachment to expense
2. List expense attachments
3. Download expense attachment
4. Delete expense attachment
5. Attachment limit enforcement
6. File type rejection
7. Authorization (non-member can't access)
8. Settlement attachment upload (payer only)

**Files to Create:**
- `src/__tests__/integration/attachments.integration.test.ts`

**Acceptance Criteria:**
- [ ] All attachment scenarios tested
- [ ] Authorization tested
- [ ] Error cases tested

---

### TASK-016: Activity Log Integration Tests
| Field | Value |
|-------|-------|
| **ID** | TASK-016 |
| **Title** | Write integration tests for activity log |
| **Assigned To** | QA Engineer |
| **Status** | ✅ Done |
| **Priority** | P0 |
| **ACs Covered** | All AC-2.x |
| **Depends On** | TASK-012, TASK-013 |

**Description:**
Integration tests for activity logging and retrieval.

**Test Scenarios:**
1. Activity recorded on expense creation
2. Activity recorded on settlement confirmation
3. Activity recorded on member join
4. Activity list returns correct data
5. Pagination works
6. Filtering works
7. Authorization (non-member can't view)

**Files to Create:**
- `src/__tests__/integration/activity.integration.test.ts`

**Acceptance Criteria:**
- [ ] Activity recording verified
- [ ] API response format verified
- [ ] Pagination verified
- [ ] Filtering verified

---

### TASK-017: Final Review and Documentation
| Field | Value |
|-------|-------|
| **ID** | TASK-017 |
| **Title** | Final code review and documentation update |
| **Assigned To** | Lead Developer |
| **Status** | ✅ Done |
| **Priority** | P1 |
| **Depends On** | TASK-015, TASK-016 |

**Description:**
Final review of all Sprint 004 code and update documentation.

**Checklist:**
- [ ] All code reviewed
- [ ] All tests passing
- [ ] API documentation updated (if any)
- [ ] REVIEW_LOG.md created
- [ ] QA_REPORT.md reviewed

**Acceptance Criteria:**
- [ ] All tasks complete
- [ ] All tests pass
- [ ] Documentation current

---

## Sprint Progress Tracker

| Task | Assigned | Status | Started | Completed |
|------|----------|--------|---------|-----------|
| TASK-001 | Backend Dev | ✅ Done | 2026-01-20 | 2026-01-20 |
| TASK-002 | Backend Dev | ✅ Done | 2026-01-20 | 2026-01-20 |
| TASK-003 | Lead Dev | ✅ Done | 2026-01-21 | 2026-01-21 |
| TASK-004 | Lead Dev | ✅ Done | 2026-01-21 | 2026-01-21 |
| TASK-005 | Backend Dev | ✅ Done | 2026-01-20 | 2026-01-20 |
| TASK-006 | Backend Dev | ✅ Done | 2026-01-20 | 2026-01-20 |
| TASK-007 | Backend Dev | ✅ Done | 2026-01-20 | 2026-01-20 |
| TASK-008 | Backend Dev | ✅ Done | 2026-01-20 | 2026-01-20 |
| TASK-009 | Backend Dev | ✅ Done | 2026-01-21 | 2026-01-21 |
| TASK-010 | Backend Dev | ✅ Done | 2026-01-21 | 2026-01-21 |
| TASK-011 | Backend Dev | ✅ Done | 2026-01-20 | 2026-01-20 |
| TASK-012 | Backend Dev | ✅ Done | 2026-01-20 | 2026-01-20 |
| TASK-013 | Backend Dev | ✅ Done | 2026-01-21 | 2026-01-21 |
| TASK-014 | Backend Dev | ✅ Done | 2026-01-21 | 2026-01-21 |
| TASK-015 | QA Engineer | ✅ Done | 2026-01-21 | 2026-01-21 |
| TASK-016 | QA Engineer | ✅ Done | 2026-01-21 | 2026-01-21 |
| TASK-017 | Lead Dev | ✅ Done | 2026-01-21 | 2026-01-21 |

**Total Tasks:** 17
**Completed:** 17/17 (100%)

---

## Assignment Summary

| Role | Tasks Assigned |
|------|----------------|
| Lead Developer | TASK-003, TASK-004, TASK-017 |
| Backend Developer | TASK-001, TASK-002, TASK-005-014 |
| QA Engineer | TASK-015, TASK-016 |

---

## Next Actions

1. **All:** Sprint 004 retrospective
2. **Project Owner:** Define Sprint 005

