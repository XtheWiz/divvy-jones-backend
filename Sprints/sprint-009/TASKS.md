# Sprint 009 Task Board

## Legend
- **Status:** TODO | IN_PROGRESS | IN_REVIEW | DONE | BLOCKED
- **Priority:** P0 (Critical) | P1 (High) | P2 (Medium) | P3 (Low)

---

## Sprint 008 Cleanup

### TASK-001: Verify Sprint 008 Closure
| Field | Value |
|-------|-------|
| **Status** | DONE |
| **Priority** | P0 |
| **Assignee** | PO |
| **ACs** | AC-0.1, AC-0.2, AC-0.3, AC-0.4 |
| **Estimate** | 0h |

**Note:** Already completed during Sprint 008 closure

---

## Integration Test Infrastructure

### TASK-002: Create Integration Test Setup
| Field | Value |
|-------|-------|
| **Status** | DONE |
| **Priority** | P1 |
| **Assignee** | Backend Dev |
| **ACs** | AC-1.1, AC-1.2, AC-1.3 |
| **Estimate** | 1.5h |

**Subtasks:**
- [x] Update .env.example with DATABASE_URL_TEST
- [x] Create src/__tests__/integration/setup.ts
- [x] Implement test database connection handling
- [x] Add transaction-based isolation

---

### TASK-003: Fix Elysia App Instance Isolation
| Field | Value |
|-------|-------|
| **Status** | DONE |
| **Priority** | P1 |
| **Assignee** | Backend Dev |
| **ACs** | AC-1.4, AC-1.5 |
| **Estimate** | 1h |
| **Dependencies** | TASK-002 |

**Subtasks:**
- [x] Create app factory function for tests
- [x] Update test helpers to use fresh instances
- [x] Fix token invalidation issues

---

### TASK-004: Add Integration Test Scripts
| Field | Value |
|-------|-------|
| **Status** | DONE |
| **Priority** | P1 |
| **Assignee** | Backend Dev |
| **ACs** | AC-1.6, AC-1.7, AC-1.8 |
| **Estimate** | 0.5h |
| **Dependencies** | TASK-003 |

**Subtasks:**
- [x] Add bun test:integration script to package.json
- [x] Add bun test:unit script to package.json
- [x] Add bun test:all script to package.json

---

## Auth Middleware Extraction

### TASK-005: Create Group Membership Middleware
| Field | Value |
|-------|-------|
| **Status** | DONE |
| **Priority** | P1 |
| **Assignee** | Backend Dev |
| **ACs** | AC-2.1, AC-2.3, AC-2.4 |
| **Estimate** | 1h |

**Subtasks:**
- [x] Create src/middleware/group.ts
- [x] Implement requireGroupMember middleware
- [x] Add groupId and memberId to context
- [x] Return proper 403/404 errors

---

### TASK-006: Create Group Admin Middleware
| Field | Value |
|-------|-------|
| **Status** | DONE |
| **Priority** | P1 |
| **Assignee** | Backend Dev |
| **ACs** | AC-2.2 |
| **Estimate** | 0.5h |
| **Dependencies** | TASK-005 |

**Subtasks:**
- [x] Implement requireGroupAdmin middleware
- [x] Check group owner or admin role

---

### TASK-007: Refactor Routes to Use Middleware
| Field | Value |
|-------|-------|
| **Status** | DONE |
| **Priority** | P1 |
| **Assignee** | Backend Dev |
| **ACs** | AC-2.5, AC-2.7 |
| **Estimate** | 1h |
| **Dependencies** | TASK-005 |

**Subtasks:**
- [x] Refactor comments.ts routes
- [x] Refactor reactions.ts routes
- [x] Verify existing tests pass

---

### TASK-008: Write Middleware Unit Tests
| Field | Value |
|-------|-------|
| **Status** | DONE |
| **Priority** | P1 |
| **Assignee** | Backend Dev |
| **ACs** | AC-2.6 |
| **Estimate** | 0.5h |
| **Dependencies** | TASK-006 |

**Subtasks:**
- [x] Create src/__tests__/middleware.group.test.ts
- [x] Test requireGroupMember scenarios
- [x] Test requireGroupAdmin scenarios

---

## Rate Limiting

### TASK-009: Create Rate Limiter Service
| Field | Value |
|-------|-------|
| **Status** | DONE |
| **Priority** | P2 |
| **Assignee** | Backend Dev |
| **ACs** | AC-3.1, AC-3.2, AC-3.7 |
| **Estimate** | 1.5h |

**Subtasks:**
- [x] Create src/services/rate-limiter.service.ts
- [x] Implement sliding window algorithm
- [x] Add configurable limits
- [x] Add bypass option for testing

---

### TASK-010: Create Rate Limit Middleware
| Field | Value |
|-------|-------|
| **Status** | DONE |
| **Priority** | P2 |
| **Assignee** | Backend Dev |
| **ACs** | AC-3.5, AC-3.6 |
| **Estimate** | 0.5h |
| **Dependencies** | TASK-009 |

**Subtasks:**
- [x] Create src/middleware/rate-limit.ts
- [x] Add X-RateLimit headers
- [x] Return 429 when exceeded

---

### TASK-011: Apply Rate Limiting to Routes
| Field | Value |
|-------|-------|
| **Status** | DONE |
| **Priority** | P2 |
| **Assignee** | Backend Dev |
| **ACs** | AC-3.3, AC-3.4 |
| **Estimate** | 0.5h |
| **Dependencies** | TASK-010 |

**Subtasks:**
- [x] Verify rate limiting on auth routes (5/min)
- [x] Create rate limit presets for social routes (30/min)

---

### TASK-012: Write Rate Limiter Tests
| Field | Value |
|-------|-------|
| **Status** | DONE |
| **Priority** | P2 |
| **Assignee** | Backend Dev |
| **ACs** | AC-3.8 |
| **Estimate** | 0.5h |
| **Dependencies** | TASK-009 |

**Subtasks:**
- [x] Create src/__tests__/rate-limiter.service.test.ts
- [x] Test sliding window behavior
- [x] Test limit exceeded scenarios
- [x] Test bypass option

---

## Password Reset

### TASK-013: Create Password Reset Schema
| Field | Value |
|-------|-------|
| **Status** | DONE |
| **Priority** | P2 |
| **Assignee** | Backend Dev |
| **ACs** | AC-4.2, AC-4.3 |
| **Estimate** | 0.5h |

**Subtasks:**
- [x] Add password_reset_tokens table to users.ts
- [x] Include tokenHash, expiresAt, usedAt columns
- [x] Add index on userId

---

### TASK-014: Create Password Reset Service
| Field | Value |
|-------|-------|
| **Status** | DONE |
| **Priority** | P2 |
| **Assignee** | Backend Dev |
| **ACs** | AC-4.2, AC-4.3, AC-4.5, AC-4.6 |
| **Estimate** | 1.5h |
| **Dependencies** | TASK-013 |

**Subtasks:**
- [x] Create src/services/password-reset.service.ts
- [x] Implement generateResetToken (hash before storing)
- [x] Implement verifyResetToken
- [x] Implement resetPassword (invalidate sessions)

---

### TASK-015: Create Password Reset Routes
| Field | Value |
|-------|-------|
| **Status** | DONE |
| **Priority** | P2 |
| **Assignee** | Backend Dev |
| **ACs** | AC-4.1, AC-4.4, AC-4.8 |
| **Estimate** | 1h |
| **Dependencies** | TASK-014, TASK-011 |

**Subtasks:**
- [x] Add POST /auth/forgot-password
- [x] Add POST /auth/reset-password
- [x] Apply rate limiting (3/hour per email)

---

### TASK-016: Create Password Reset Email Template
| Field | Value |
|-------|-------|
| **Status** | DONE |
| **Priority** | P2 |
| **Assignee** | Backend Dev |
| **ACs** | AC-4.7 |
| **Estimate** | 0.5h |
| **Dependencies** | TASK-014 |

**Subtasks:**
- [x] Create src/services/email/templates/password-reset.ts
- [x] Include reset link with token
- [x] Add expiry warning (1 hour)

---

### TASK-017: Write Password Reset Tests
| Field | Value |
|-------|-------|
| **Status** | DONE |
| **Priority** | P2 |
| **Assignee** | Backend Dev |
| **ACs** | AC-4.9 |
| **Estimate** | 0.5h |
| **Dependencies** | TASK-014 |

**Subtasks:**
- [x] Create src/__tests__/password-reset.service.test.ts
- [x] Test token generation and hashing
- [x] Test token verification
- [x] Test session invalidation

---

## Summary

| Category | Tasks | Completed | Total Estimate |
|----------|-------|-----------|----------------|
| Sprint Cleanup | 1 | 1 | 0h |
| Integration Tests | 3 | 3 | 3h |
| Auth Middleware | 4 | 4 | 3h |
| Rate Limiting | 4 | 4 | 3h |
| Password Reset | 5 | 5 | 4h |
| **Total** | **17** | **17** | **13h** |

---

## Sprint Burndown

| Day | Tasks Remaining | Status |
|-----|-----------------|--------|
| Start | 16 | In Progress |
| End | 0 | COMPLETED |

---

## Sprint Status: COMPLETED

All 17 tasks completed successfully.
- 859 unit tests passing
- Source files type check clean
- Code reviewed and QA verified
