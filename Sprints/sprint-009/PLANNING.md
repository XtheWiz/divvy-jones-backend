# Sprint 009 Planning

## Planning Overview

| Field | Value |
|-------|-------|
| **Sprint** | 009 |
| **Lead Developer** | Claude |
| **Planning Date** | 2026-01-21 |

---

## Technical Approach

### Feature 1: Integration Test Infrastructure

**Problem Analysis:**
- Integration tests fail due to `DATABASE_URL_TEST` not being set
- Shared Elysia app instance causes state leakage between tests
- User cleanup in `beforeEach` invalidates tokens from previous tests

**Solution:**
1. Create `src/__tests__/integration/setup.ts` with proper test database configuration
2. Use transaction-based isolation OR fresh app instance per test file
3. Generate fresh users/tokens within each test instead of shared setup
4. Add `bun test:integration` script that requires DATABASE_URL_TEST

**Files to Create/Modify:**
- `src/__tests__/integration/setup.ts` (new)
- `src/__tests__/integration/helpers.ts` (new)
- `.env.example` (update)
- `package.json` (add script)

---

### Feature 2: Auth Middleware Extraction

**Problem Analysis:**
- Every route handler repeats the same authorization pattern:
  1. Check group exists
  2. Check user is member
  3. Get member ID
- This leads to ~20 lines of boilerplate per handler

**Solution:**
1. Create `src/middleware/group.ts` with reusable middleware
2. Use Elysia's `.derive()` pattern to add `groupId` and `memberId` to context
3. Middleware returns early with proper error if validation fails

**Design:**
```typescript
// Usage after implementation
.use(requireGroupMember)
.get("/", ({ memberId, groupId }) => {
  // memberId and groupId guaranteed to be valid
})
```

**Files to Create/Modify:**
- `src/middleware/group.ts` (new)
- `src/routes/comments.ts` (refactor)
- `src/routes/reactions.ts` (refactor)
- `src/routes/expenses.ts` (refactor)
- `src/__tests__/middleware.group.test.ts` (new)

---

### Feature 3: Rate Limiting

**Problem Analysis:**
- No rate limiting currently exposes API to abuse
- Auth endpoints are especially sensitive (brute force attacks)
- Social endpoints could be spammed

**Solution:**
1. Create `src/services/rate-limiter.service.ts` with sliding window algorithm
2. Use in-memory Map for storage (sufficient for single-instance deployment)
3. Create `src/middleware/rate-limit.ts` for easy route integration

**Design:**
```typescript
// Sliding window rate limiter
interface RateLimitConfig {
  windowMs: number;      // Time window in ms
  maxRequests: number;   // Max requests per window
  keyGenerator: (req) => string;  // IP or userId
}
```

**Rate Limit Configuration:**
| Endpoint Category | Limit | Window | Key |
|-------------------|-------|--------|-----|
| Auth (login, register) | 5 | 1 min | IP |
| Forgot password | 3 | 1 hour | Email |
| Social (comments, reactions) | 30 | 1 min | User ID |
| General API | 100 | 1 min | User ID |

**Files to Create/Modify:**
- `src/services/rate-limiter.service.ts` (new)
- `src/middleware/rate-limit.ts` (new)
- `src/routes/auth.ts` (add rate limiting)
- `src/routes/comments.ts` (add rate limiting)
- `src/routes/reactions.ts` (add rate limiting)
- `src/__tests__/rate-limiter.service.test.ts` (new)

---

### Feature 4: Password Reset

**Problem Analysis:**
- Users cannot recover accounts if they forget password
- BL-001 was marked as "deferred" since Sprint 001

**Solution:**
1. Add `password_reset_tokens` table
2. Store hashed token (not plaintext) for security
3. Use existing email service for delivery
4. Invalidate all refresh tokens on password reset

**Database Schema:**
```typescript
export const passwordResetTokens = pgTable("password_reset_tokens", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => users.id),
  tokenHash: text("token_hash").notNull(),  // bcrypt hash
  expiresAt: timestamp("expires_at").notNull(),
  usedAt: timestamp("used_at"),  // null until used
  createdAt: timestamp("created_at").notNull().defaultNow(),
});
```

**Flow:**
1. User submits email to `/auth/forgot-password`
2. Generate random token, hash it, store in DB
3. Send email with unhashed token in reset link
4. User clicks link, submits new password with token
5. Verify token hash matches, update password, invalidate token
6. Delete all refresh tokens for user (force re-login everywhere)

**Files to Create/Modify:**
- `src/db/schema/users.ts` (add password_reset_tokens table)
- `src/services/password-reset.service.ts` (new)
- `src/routes/auth.ts` (add endpoints)
- `src/services/email/templates/password-reset.ts` (new)
- `src/__tests__/password-reset.service.test.ts` (new)

---

## Task Dependencies

```
Feature 0 (Cleanup) ─────────────────────────────────> Done

Feature 1 (Integration Tests) ──────────────────────┐
                                                    │
Feature 2 (Auth Middleware) ────────────────────────┼──> Can run in parallel
                                                    │
Feature 3 (Rate Limiting) ──────────────────────────┘
                                                    │
                                                    v
Feature 4 (Password Reset) ─────────────────────────> Depends on Rate Limiting
```

---

## Estimated Effort

| Feature | Estimate | Complexity |
|---------|----------|------------|
| Integration Test Infrastructure | 3h | Medium |
| Auth Middleware Extraction | 2h | Low |
| Rate Limiting | 3h | Medium |
| Password Reset | 4h | Medium |
| **Total** | **12h** | |

---

## Risk Assessment

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| Integration tests reveal bugs | Medium | Medium | Budget fix time |
| Rate limiting too aggressive | Low | Medium | Start generous, tune later |
| Email delivery failures | Low | High | Use existing tested email service |

---

## Definition of Ready

- [x] Sprint defined with clear ACs
- [x] Technical approach documented
- [x] Dependencies identified
- [x] Risks assessed
- [x] Ready for task breakdown

---

## Sign-off

| Role | Name | Status | Date |
|------|------|--------|------|
| Lead Developer | Claude | Complete | 2026-01-21 |
