# Sprint 004 - Sprint Document

## Sprint Information
| Field | Value |
|-------|-------|
| **Sprint** | 004 |
| **Status** | Ready for Planning |
| **Created By** | Project Owner |
| **Created Date** | 2026-01-20 |

---

## Sprint Goal
> Complete the expense tracking workflow with file attachments, establish production-ready CI/CD infrastructure, and provide visibility into group activity through an activity log.

---

## Features Overview

| # | Feature | Backlog ID | Priority | Estimated ACs |
|---|---------|------------|----------|---------------|
| 0 | Technical Debt & CI/CD | Retro Items | P0 | 12 |
| 1 | Evidence/Attachment System | BL-003 | P0 | 20 |
| 2 | Activity Log | New | P1 | 15 |
| | **Total** | | | **47** |

---

## Feature 0: Technical Debt & CI/CD Infrastructure

**Source:** Sprint 003 Retrospective Action Items

### 0.1 Route Parameter Standardization
> Standardize all route parameters to use `:groupId` instead of mixed `:id`/`:groupId`

| AC | Acceptance Criteria | Priority |
|----|---------------------|----------|
| AC-0.1 | All group routes use `:groupId` parameter consistently | P0 |
| AC-0.2 | All expense routes use `:groupId` and `:expenseId` parameters | P0 |
| AC-0.3 | All settlement routes use `:groupId` and `:settlementId` parameters | P0 |
| AC-0.4 | Integration tests can run against the app without route conflicts | P0 |
| AC-0.5 | All existing unit tests pass after refactoring | P0 |

### 0.2 CI/CD Test Database Configuration
> Enable integration tests to run automatically in CI pipeline

| AC | Acceptance Criteria | Priority |
|----|---------------------|----------|
| AC-0.6 | GitHub Actions workflow configured for test database | P0 |
| AC-0.7 | Integration tests run on every PR | P0 |
| AC-0.8 | Test database is isolated and cleaned between test runs | P0 |
| AC-0.9 | CI workflow fails if any test fails | P0 |

### 0.3 Developer Experience Improvements
> Add tooling to prevent future inconsistencies

| AC | Acceptance Criteria | Priority |
|----|---------------------|----------|
| AC-0.10 | Pre-commit hook validates route parameter naming conventions | P1 |
| AC-0.11 | CONTRIBUTING.md documents naming conventions | P1 |
| AC-0.12 | Lint rules added for common patterns | P2 |

---

## Feature 1: Evidence/Attachment System

**Backlog Item:** BL-003 (Expense Tracking - Completion)
**Description:** Allow users to attach receipts, photos, and documents to expenses and settlements as proof of payment.

### 1.1 File Upload Infrastructure
> Set up secure file storage and upload handling

| AC | Acceptance Criteria | Priority |
|----|---------------------|----------|
| AC-1.1 | File upload endpoint accepts multipart/form-data | P0 |
| AC-1.2 | Files stored in local storage (development) with S3-compatible interface | P0 |
| AC-1.3 | Maximum file size is 10MB | P0 |
| AC-1.4 | Accepted file types: JPEG, PNG, PDF, HEIC | P0 |
| AC-1.5 | Files are validated for type and size before storage | P0 |
| AC-1.6 | Uploaded files receive unique, non-guessable keys | P0 |

### 1.2 Expense Attachments
> Attach receipts and photos to expenses

| AC | Acceptance Criteria | Priority |
|----|---------------------|----------|
| AC-1.7 | POST `/groups/:groupId/expenses/:expenseId/attachments` - Upload attachment | P0 |
| AC-1.8 | GET `/groups/:groupId/expenses/:expenseId/attachments` - List attachments | P0 |
| AC-1.9 | GET `/groups/:groupId/expenses/:expenseId/attachments/:attachmentId` - Download | P0 |
| AC-1.10 | DELETE `/groups/:groupId/expenses/:expenseId/attachments/:attachmentId` - Delete | P0 |
| AC-1.11 | Only expense creator and group admins can delete attachments | P0 |
| AC-1.12 | Only group members can view/download attachments | P0 |
| AC-1.13 | Maximum 5 attachments per expense | P1 |

### 1.3 Settlement Attachments
> Attach proof of payment to settlements

| AC | Acceptance Criteria | Priority |
|----|---------------------|----------|
| AC-1.14 | POST `/groups/:groupId/settlements/:settlementId/attachments` - Upload | P0 |
| AC-1.15 | GET `/groups/:groupId/settlements/:settlementId/attachments` - List | P0 |
| AC-1.16 | GET `/groups/:groupId/settlements/:settlementId/attachments/:attachmentId` - Download | P0 |
| AC-1.17 | DELETE `/groups/:groupId/settlements/:settlementId/attachments/:attachmentId` - Delete | P0 |
| AC-1.18 | Only payer can upload attachments to their settlements | P0 |
| AC-1.19 | Attachments included in settlement details response | P0 |
| AC-1.20 | Maximum 3 attachments per settlement | P1 |

---

## Feature 2: Activity Log

**Backlog Item:** New (supports BL-006 Notifications and BL-009 Social Features)
**Description:** Track and display all activity within a group, providing transparency and audit trail.

### 2.1 Activity Tracking
> Record all significant actions in groups

| AC | Acceptance Criteria | Priority |
|----|---------------------|----------|
| AC-2.1 | Activity recorded when expense is created | P0 |
| AC-2.2 | Activity recorded when expense is updated | P0 |
| AC-2.3 | Activity recorded when expense is deleted | P0 |
| AC-2.4 | Activity recorded when settlement is created | P0 |
| AC-2.5 | Activity recorded when settlement is confirmed | P0 |
| AC-2.6 | Activity recorded when settlement is rejected/cancelled | P0 |
| AC-2.7 | Activity recorded when member joins group | P0 |
| AC-2.8 | Activity recorded when member leaves group | P0 |
| AC-2.9 | Activity recorded when attachment is added | P1 |

### 2.2 Activity API
> API endpoints for retrieving activity

| AC | Acceptance Criteria | Priority |
|----|---------------------|----------|
| AC-2.10 | GET `/groups/:groupId/activity` - List group activity | P0 |
| AC-2.11 | Activity list is paginated (default 20, max 100) | P0 |
| AC-2.12 | Activity sorted by timestamp descending (newest first) | P0 |
| AC-2.13 | Each activity shows: actor, action type, target, timestamp | P0 |
| AC-2.14 | Activity can be filtered by type (expense, settlement, member) | P1 |
| AC-2.15 | Activity can be filtered by date range | P1 |

---

## API Endpoints Summary

### New Endpoints

| Method | Endpoint | Feature |
|--------|----------|---------|
| POST | `/groups/:groupId/expenses/:expenseId/attachments` | Attachments |
| GET | `/groups/:groupId/expenses/:expenseId/attachments` | Attachments |
| GET | `/groups/:groupId/expenses/:expenseId/attachments/:attachmentId` | Attachments |
| DELETE | `/groups/:groupId/expenses/:expenseId/attachments/:attachmentId` | Attachments |
| POST | `/groups/:groupId/settlements/:settlementId/attachments` | Attachments |
| GET | `/groups/:groupId/settlements/:settlementId/attachments` | Attachments |
| GET | `/groups/:groupId/settlements/:settlementId/attachments/:attachmentId` | Attachments |
| DELETE | `/groups/:groupId/settlements/:settlementId/attachments/:attachmentId` | Attachments |
| GET | `/groups/:groupId/activity` | Activity Log |

### Modified Endpoints

| Method | Endpoint | Change |
|--------|----------|--------|
| GET | `/groups/:groupId/expenses/:expenseId` | Include attachments in response |
| GET | `/groups/:groupId/settlements/:settlementId` | Include attachments in response |

---

## Database Changes

### Existing Tables (Already in Schema)
1. **evidences** - File attachment records ✅ (already defined)
2. **activity_log** - Activity tracking ✅ (already defined)

### Schema Changes Required
- None - tables already exist in schema

### Storage Configuration
1. **Development:** Local file storage in `./uploads/`
2. **Production:** S3-compatible object storage (environment variable configured)

---

## Technical Considerations

### File Storage
- Use abstracted storage interface for local/S3 switching
- Generate secure, non-sequential file keys
- Store original filename in evidence record
- Implement signed URLs for secure downloads (optional for MVP)

### Activity Log Performance
- Index on `group_id` and `created_at` for efficient queries
- Consider archiving old activity after 90 days (future enhancement)

### Security
- Validate file MIME types server-side (not just extension)
- Scan for malware if budget allows (future enhancement)
- Rate limit uploads to prevent abuse

---

## Dependencies

### Sprint 003 Retro Items (Must Complete First)
- [x] Route parameter standardization - blocking integration tests
- [x] CI/CD test database - needed for automated testing

### External Dependencies
- None for MVP (local storage)
- S3-compatible storage for production deployment

---

## Risks and Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Large file uploads slow down API | Performance degradation | Implement file size limits, async processing |
| Storage costs in production | Budget impact | Limit attachments per entity, compress images |
| Route refactoring breaks existing clients | API compatibility | Version API if needed, document changes |

---

## Out of Scope

The following are explicitly NOT included in Sprint 004:
- Image thumbnail generation
- OCR for receipts
- Multi-currency exchange rates (deferred to Sprint 005)
- Reports and analytics (deferred to Sprint 005)
- Push notifications (deferred to Sprint 005)
- Email notifications

---

## Success Criteria

Sprint 004 is successful when:
1. All integration tests run in CI without route conflicts
2. Users can upload and view attachments on expenses
3. Users can upload proof of payment on settlements
4. Group activity is tracked and viewable
5. All 47 acceptance criteria are met
6. Test coverage maintained at 100% pass rate

---

## Sign-off

| Role | Approved | Date |
|------|----------|------|
| Project Owner | [x] | 2026-01-20 |
| Lead Developer | [ ] | - |

---

## Changelog

| Date | Author | Change |
|------|--------|--------|
| 2026-01-20 | PO | Initial sprint definition |
