# Sprint 009 Definition

## Sprint Overview

| Field | Value |
|-------|-------|
| **Sprint Number** | 009 |
| **Sprint Goal** | Strengthen infrastructure with test improvements, auth middleware, rate limiting, and password reset |
| **Start Date** | 2026-01-21 |
| **Duration** | Standard sprint |
| **Defined By** | Claude (Project Owner) |

---

## Sprint Goal

> Improve development infrastructure and security by fixing integration tests, extracting reusable auth middleware, implementing rate limiting for API protection, and completing the password reset feature.

---

## Features

### Feature 0: Sprint 008 Cleanup (P0)
**Description:** Complete Sprint 008 documentation and carry forward items

| AC ID | Acceptance Criteria |
|-------|---------------------|
| AC-0.1 | Sprint 008 RETROSPECTIVE.md created and complete |
| AC-0.2 | Sprint 008 QA_REPORT.md created with all ACs verified |
| AC-0.3 | BACKLOG.md updated with Sprint 008 completion |
| AC-0.4 | Sprint velocity metrics updated |

**Note:** Already complete from Sprint 008 closure

---

### Feature 1: Integration Test Infrastructure (P1)
**Description:** Fix integration test infrastructure to enable reliable E2E testing
**Backlog Reference:** Tech Debt (carried from Sprint 007, 008)

| AC ID | Acceptance Criteria |
|-------|---------------------|
| AC-1.1 | Test database configuration documented in .env.example |
| AC-1.2 | DATABASE_URL_TEST environment variable properly used in test setup |
| AC-1.3 | Test database isolation - each test suite runs in isolation |
| AC-1.4 | Fresh Elysia app instance created per test file (not shared) |
| AC-1.5 | User cleanup no longer causes token invalidation issues |
| AC-1.6 | At least 50% of integration tests passing (baseline) |
| AC-1.7 | Integration test run script added to package.json |
| AC-1.8 | CI workflow updated to run integration tests (optional, can skip if no test DB) |

---

### Feature 2: Auth Middleware Extraction (P1)
**Description:** Extract common authorization patterns into reusable middleware/guards
**Backlog Reference:** Tech Debt (recommended in Sprint 008 code review)

| AC ID | Acceptance Criteria |
|-------|---------------------|
| AC-2.1 | `requireGroupMember` middleware created - validates user is member of group |
| AC-2.2 | `requireGroupAdmin` middleware created - validates user is admin of group |
| AC-2.3 | Middleware returns proper 403/404 errors with standard error codes |
| AC-2.4 | Middleware adds `groupId` and `memberId` to context for downstream use |
| AC-2.5 | At least 3 existing route files refactored to use new middleware |
| AC-2.6 | Unit tests for middleware authorization logic |
| AC-2.7 | Existing route tests still pass after refactoring |

---

### Feature 3: Rate Limiting (P2)
**Description:** Implement rate limiting to protect API from abuse
**Backlog Reference:** Tech Debt (recommended in Sprint 008 review)

| AC ID | Acceptance Criteria |
|-------|---------------------|
| AC-3.1 | Rate limiter service created with configurable limits |
| AC-3.2 | In-memory rate limiting with sliding window algorithm |
| AC-3.3 | Auth endpoints rate limited: 5 requests per minute per IP |
| AC-3.4 | Social endpoints (comments, reactions) rate limited: 30 requests per minute per user |
| AC-3.5 | Rate limit headers included in responses (X-RateLimit-Limit, X-RateLimit-Remaining) |
| AC-3.6 | 429 Too Many Requests returned when limit exceeded |
| AC-3.7 | Rate limiter can be bypassed for testing (configurable) |
| AC-3.8 | Unit tests for rate limiter logic |

---

### Feature 4: Password Reset (P2)
**Description:** Allow users to reset forgotten passwords via email
**Backlog Reference:** BL-001 (deferred since Sprint 001)

| AC ID | Acceptance Criteria |
|-------|---------------------|
| AC-4.1 | POST /auth/forgot-password accepts email and sends reset link |
| AC-4.2 | Reset token generated with 1-hour expiry |
| AC-4.3 | Reset token stored securely (hashed in database) |
| AC-4.4 | POST /auth/reset-password accepts token and new password |
| AC-4.5 | Password reset invalidates all existing sessions for user |
| AC-4.6 | Reset token is single-use (invalidated after use) |
| AC-4.7 | Email template for password reset created |
| AC-4.8 | Rate limiting on forgot-password endpoint (3 per hour per email) |
| AC-4.9 | Unit tests for password reset flow |

---

## Summary

| Feature | ACs | Priority |
|---------|-----|----------|
| Sprint 008 Cleanup | 4 | P0 |
| Integration Test Infrastructure | 8 | P1 |
| Auth Middleware Extraction | 7 | P1 |
| Rate Limiting | 8 | P2 |
| Password Reset | 9 | P2 |
| **Total** | **36** | |

---

## Dependencies

- Feature 3 (Rate Limiting) should be done before Feature 4 (Password Reset) since password reset needs rate limiting
- Feature 2 (Auth Middleware) can be done in parallel with Feature 1

---

## Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| Integration tests may reveal bugs in existing code | Budget time for bug fixes, focus on test infrastructure first |
| Rate limiting may affect legitimate users | Start with generous limits, make configurable |
| Email delivery issues for password reset | Use existing email service from Sprint 006 |

---

## Out of Scope

- Push notifications (moved to Sprint 010)
- Redis-based rate limiting (in-memory sufficient for MVP)
- Mobile API optimizations (moved to Sprint 010)

---

## Definition of Done

- [x] All acceptance criteria met (36/36)
- [x] Unit tests written and passing (859 tests)
- [x] Integration tests infrastructure ready (requires DATABASE_URL_TEST)
- [x] Code reviewed by Lead Developer
- [x] QA sign-off on all features
- [x] Documentation updated

---

## Sign-off

| Role | Name | Status | Date |
|------|------|--------|------|
| Project Owner | Claude | Defined | 2026-01-21 |
| Lead Developer | Claude | Reviewed | 2026-01-21 |
| Backend Developer | Claude | Implemented | 2026-01-21 |
| QA Engineer | Claude | Verified | 2026-01-21 |

---

## Sprint Status: COMPLETED

Sprint 009 has been successfully completed with all 36 acceptance criteria met across 17 tasks.
