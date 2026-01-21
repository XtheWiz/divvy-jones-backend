# Sprint 010 Task Board

## Legend
- **Status:** TODO | IN_PROGRESS | IN_REVIEW | DONE | BLOCKED
- **Priority:** P0 (Critical) | P1 (High) | P2 (Medium) | P3 (Low)

---

## Feature 4: Database Migrations (Do First)

### TASK-001: Setup Drizzle Migration Configuration
| Field | Value |
|-------|-------|
| **Status** | DONE |
| **Priority** | P2 |
| **Assignee** | Backend Dev |
| **ACs** | AC-4.1 |
| **Estimate** | 0.5h |

**Subtasks:**
- [ ] Create/update drizzle.config.ts with proper settings
- [ ] Add db:generate, db:migrate, db:push scripts to package.json
- [ ] Create drizzle/migrations folder structure
- [ ] Test configuration with dry run

---

### TASK-002: Generate Sprint 009 Migration
| Field | Value |
|-------|-------|
| **Status** | DONE |
| **Priority** | P2 |
| **Assignee** | Backend Dev |
| **ACs** | AC-4.2 |
| **Estimate** | 0.5h |
| **Dependencies** | TASK-001 |

**Subtasks:**
- [ ] Generate migration for password_reset_tokens table
- [ ] Verify migration SQL is correct
- [ ] Test migration apply/rollback locally

---

### TASK-003: Generate Email Verification Migration
| Field | Value |
|-------|-------|
| **Status** | DONE |
| **Priority** | P2 |
| **Assignee** | Backend Dev |
| **ACs** | AC-4.3 |
| **Estimate** | 0.5h |
| **Dependencies** | TASK-006 |

**Subtasks:**
- [ ] Add emailVerificationTokens to schema
- [ ] Generate migration
- [ ] Verify indexes are included

---

### TASK-004: Generate OAuth Migration
| Field | Value |
|-------|-------|
| **Status** | DONE |
| **Priority** | P2 |
| **Assignee** | Backend Dev |
| **ACs** | AC-4.4 |
| **Estimate** | 0.5h |
| **Dependencies** | TASK-001 |

**Subtasks:**
- [ ] Verify oauthAccounts table schema is complete
- [ ] Add any missing columns (refreshToken encryption)
- [ ] Generate migration if changes needed

---

### TASK-005: Generate Soft Delete Migration
| Field | Value |
|-------|-------|
| **Status** | DONE |
| **Priority** | P2 |
| **Assignee** | Backend Dev |
| **ACs** | AC-4.5 |
| **Estimate** | 0.5h |
| **Dependencies** | TASK-001 |

**Subtasks:**
- [ ] Add deletionRequestedAt column to users schema
- [ ] Generate migration
- [ ] Verify existing deletedAt column/index

---

### TASK-006: Document Migration Workflow
| Field | Value |
|-------|-------|
| **Status** | DONE |
| **Priority** | P2 |
| **Assignee** | Backend Dev |
| **ACs** | AC-4.6, AC-4.7 |
| **Estimate** | 0.5h |
| **Dependencies** | TASK-002 |

**Subtasks:**
- [ ] Add Database Migrations section to README.md
- [ ] Document db:migrate command usage
- [ ] Document rollback strategy (backup-based)
- [ ] Add migration safety checklist

---

## Feature 0: Sprint 009 Cleanup

### TASK-007: Verify Sprint 009 Artifacts
| Field | Value |
|-------|-------|
| **Status** | DONE |
| **Priority** | P0 |
| **Assignee** | Lead Dev |
| **ACs** | AC-0.1 |
| **Estimate** | 0.25h |

**Subtasks:**
- [ ] Verify RETROSPECTIVE.md is complete
- [ ] Verify QA_REPORT.md has all ACs checked
- [ ] Verify TASKS.md all marked DONE
- [ ] Confirm Sprint 009 merged to develop

**Note:** Should be quick verification - artifacts created last sprint

---

### TASK-008: Document Rate Limiting Configuration
| Field | Value |
|-------|-------|
| **Status** | DONE |
| **Priority** | P0 |
| **Assignee** | Backend Dev |
| **ACs** | AC-0.3 |
| **Estimate** | 0.5h |

**Subtasks:**
- [ ] Add Rate Limiting section to README.md
- [ ] Document default limits per endpoint type
- [ ] Document environment variables for customization
- [ ] Document test bypass configuration

---

### TASK-009: Audit and Consolidate Duplicate Helpers
| Field | Value |
|-------|-------|
| **Status** | TODO |
| **Priority** | P0 |
| **Assignee** | Backend Dev |
| **ACs** | AC-0.4 |
| **Estimate** | 1h |

**Subtasks:**
- [ ] Search for duplicate function definitions across services
- [ ] Identify functions to consolidate (formatDate, validateEmail, etc.)
- [ ] Move duplicates to src/utils/ or appropriate shared location
- [ ] Update imports in consuming files
- [ ] Verify tests still pass

---

## Feature 1: Email Verification

### TASK-010: Create Email Verification Token Schema
| Field | Value |
|-------|-------|
| **Status** | DONE |
| **Priority** | P1 |
| **Assignee** | Backend Dev |
| **ACs** | AC-1.1 |
| **Estimate** | 0.5h |

**Subtasks:**
- [ ] Add emailVerificationTokens table to src/db/schema/users.ts
- [ ] Include: id, userId, tokenHash, expiresAt, verifiedAt, createdAt
- [ ] Add index on userId
- [ ] Verify users.isEmailVerified and emailVerifiedAt columns exist

---

### TASK-011: Implement Email Verification Service
| Field | Value |
|-------|-------|
| **Status** | DONE |
| **Priority** | P1 |
| **Assignee** | Backend Dev |
| **ACs** | AC-1.2, AC-1.4, AC-1.5 |
| **Estimate** | 1.5h |
| **Dependencies** | TASK-010 |

**Subtasks:**
- [ ] Create src/services/email-verification.service.ts
- [ ] Implement generateVerificationToken(userId) - 24 hour expiry
- [ ] Implement verifyEmailToken(token) - bcrypt compare
- [ ] Implement invalidateOldTokens(userId) - single-use pattern
- [ ] Implement markEmailVerified(userId) - update user record

**Pattern:** Follow password-reset.service.ts implementation

---

### TASK-012: Create Verification Email Template
| Field | Value |
|-------|-------|
| **Status** | DONE |
| **Priority** | P1 |
| **Assignee** | Backend Dev |
| **ACs** | AC-1.8 |
| **Estimate** | 0.5h |

**Subtasks:**
- [ ] Create src/services/email/templates/email-verification.ts
- [ ] Include: verification URL, 24-hour expiry warning, clear CTA
- [ ] Generate both HTML and plain text versions
- [ ] Use wrapInHtmlTemplate for consistent styling

---

### TASK-013: Update Registration to Send Verification Email
| Field | Value |
|-------|-------|
| **Status** | DONE |
| **Priority** | P1 |
| **Assignee** | Backend Dev |
| **ACs** | AC-1.2 |
| **Estimate** | 0.5h |
| **Dependencies** | TASK-011, TASK-012 |

**Subtasks:**
- [ ] Modify POST /auth/register in src/routes/auth.ts
- [ ] After user creation, generate verification token
- [ ] Send verification email asynchronously (setImmediate)
- [ ] Don't block registration response on email send

---

### TASK-014: Create Verify Email Endpoint
| Field | Value |
|-------|-------|
| **Status** | DONE |
| **Priority** | P1 |
| **Assignee** | Backend Dev |
| **ACs** | AC-1.3, AC-1.5 |
| **Estimate** | 0.5h |
| **Dependencies** | TASK-011 |

**Subtasks:**
- [ ] Add GET /auth/verify-email route
- [ ] Accept token as query parameter
- [ ] Validate token, check expiry
- [ ] Mark email verified on success
- [ ] Return success/error response

---

### TASK-015: Create Resend Verification Endpoint
| Field | Value |
|-------|-------|
| **Status** | DONE |
| **Priority** | P1 |
| **Assignee** | Backend Dev |
| **ACs** | AC-1.6, AC-1.7 |
| **Estimate** | 0.5h |
| **Dependencies** | TASK-011 |

**Subtasks:**
- [ ] Add POST /auth/resend-verification route
- [ ] Accept email in request body
- [ ] Rate limit: 3 per hour per email
- [ ] Invalidate old tokens before generating new
- [ ] Send new verification email

---

### TASK-016: Update User Profile Response
| Field | Value |
|-------|-------|
| **Status** | DONE |
| **Priority** | P1 |
| **Assignee** | Backend Dev |
| **ACs** | AC-1.9 |
| **Estimate** | 0.25h |

**Subtasks:**
- [ ] Ensure GET /users/me returns emailVerified boolean
- [ ] Include emailVerifiedAt timestamp if verified

---

### TASK-017: Write Email Verification Tests
| Field | Value |
|-------|-------|
| **Status** | DONE |
| **Priority** | P1 |
| **Assignee** | Backend Dev |
| **ACs** | AC-1.10 |
| **Estimate** | 1h |
| **Dependencies** | TASK-011 |

**Subtasks:**
- [ ] Create src/__tests__/email-verification.service.test.ts
- [ ] Test token generation (length, format)
- [ ] Test token hashing (not stored raw)
- [ ] Test token verification (valid, expired, already used)
- [ ] Test email marked verified after verification
- [ ] Test old tokens invalidated on resend

---

## Feature 2: OAuth/Social Login

### TASK-018: Implement OAuth Service
| Field | Value |
|-------|-------|
| **Status** | DONE |
| **Priority** | P1 |
| **Assignee** | Backend Dev |
| **ACs** | AC-2.1, AC-2.8 |
| **Estimate** | 2h |

**Subtasks:**
- [ ] Create src/services/oauth.service.ts
- [ ] Implement getGoogleAuthUrl(state) - construct OAuth URL
- [ ] Implement exchangeGoogleCode(code) - token exchange
- [ ] Implement getGoogleUserInfo(accessToken) - fetch profile
- [ ] Implement encryptRefreshToken/decryptRefreshToken (AES-256-GCM)
- [ ] Add GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET to .env.example

---

### TASK-019: Implement OAuth User Management
| Field | Value |
|-------|-------|
| **Status** | DONE |
| **Priority** | P1 |
| **Assignee** | Backend Dev |
| **ACs** | AC-2.4, AC-2.5 |
| **Estimate** | 1h |
| **Dependencies** | TASK-018 |

**Subtasks:**
- [ ] Implement findOrCreateGoogleUser(googleUserInfo)
- [ ] Handle new user creation (emailVerified=true)
- [ ] Handle existing user linking
- [ ] Create oauthAccounts record
- [ ] Update user.primaryAuthProvider if first OAuth link

---

### TASK-020: Create Google OAuth Routes
| Field | Value |
|-------|-------|
| **Status** | DONE |
| **Priority** | P1 |
| **Assignee** | Backend Dev |
| **ACs** | AC-2.2, AC-2.3 |
| **Estimate** | 1h |
| **Dependencies** | TASK-019 |

**Subtasks:**
- [ ] Add GET /auth/google route - redirect to Google
- [ ] Generate signed state parameter (CSRF protection)
- [ ] Add GET /auth/google/callback route
- [ ] Validate state parameter
- [ ] Exchange code, create/link user, return JWT

---

### TASK-021: Add Set Password for OAuth Users
| Field | Value |
|-------|-------|
| **Status** | DONE |
| **Priority** | P1 |
| **Assignee** | Backend Dev |
| **ACs** | AC-2.6 |
| **Estimate** | 0.5h |

**Subtasks:**
- [ ] Add POST /users/me/password route (or extend existing)
- [ ] Allow OAuth-only users to set password
- [ ] Validate password strength
- [ ] Update user.passwordHash

---

### TASK-022: Update Profile to Show OAuth Providers
| Field | Value |
|-------|-------|
| **Status** | DONE |
| **Priority** | P1 |
| **Assignee** | Backend Dev |
| **ACs** | AC-2.7 |
| **Estimate** | 0.5h |

**Subtasks:**
- [ ] Update GET /users/me to include linked OAuth providers
- [ ] Query oauthAccounts for user
- [ ] Return array of { provider, linkedAt }

---

### TASK-023: Write OAuth Service Tests
| Field | Value |
|-------|-------|
| **Status** | DONE |
| **Priority** | P1 |
| **Assignee** | Backend Dev |
| **ACs** | AC-2.9 |
| **Estimate** | 1h |
| **Dependencies** | TASK-019 |

**Subtasks:**
- [ ] Create src/__tests__/oauth.service.test.ts
- [ ] Test state generation and validation
- [ ] Test user creation for new OAuth users
- [ ] Test account linking for existing users
- [ ] Test refresh token encryption/decryption
- [ ] Mock Google API calls in tests

---

## Feature 3: Account Management (GDPR)

### TASK-024: Create Account Management Service
| Field | Value |
|-------|-------|
| **Status** | DONE |
| **Priority** | P2 |
| **Assignee** | Backend Dev |
| **ACs** | AC-3.2, AC-3.5, AC-3.6 |
| **Estimate** | 1.5h |

**Subtasks:**
- [ ] Create src/services/account-management.service.ts
- [ ] Implement requestAccountDeletion(userId) - sets deletionRequestedAt
- [ ] Implement cancelAccountDeletion(userId) - clears deletionRequestedAt
- [ ] Implement processScheduledDeletions() - for background job
- [ ] Implement anonymizeUser(userId) - actual data cleanup

**Anonymization Rules:**
- Set email = null, displayName = "Deleted User"
- Keep expenses with "Deleted User" reference
- Remove from groups
- Hard delete: oauth accounts, tokens

---

### TASK-025: Create Account Deletion Routes
| Field | Value |
|-------|-------|
| **Status** | DONE |
| **Priority** | P2 |
| **Assignee** | Backend Dev |
| **ACs** | AC-3.1, AC-3.4 |
| **Estimate** | 0.5h |
| **Dependencies** | TASK-024 |

**Subtasks:**
- [ ] Add DELETE /users/me route
- [ ] Set deletionRequestedAt = NOW()
- [ ] Add GET /users/me/cancel-deletion route
- [ ] Clear deletionRequestedAt if within grace period

---

### TASK-026: Create Deletion Confirmation Email
| Field | Value |
|-------|-------|
| **Status** | DONE |
| **Priority** | P2 |
| **Assignee** | Backend Dev |
| **ACs** | AC-3.3 |
| **Estimate** | 0.5h |

**Subtasks:**
- [ ] Create src/services/email/templates/account-deletion.ts
- [ ] Include: deletion date, cancellation link, grace period info
- [ ] Send on deletion request

---

### TASK-027: Implement Data Export Service
| Field | Value |
|-------|-------|
| **Status** | DONE |
| **Priority** | P2 |
| **Assignee** | Backend Dev |
| **ACs** | AC-3.7, AC-3.8 |
| **Estimate** | 1.5h |

**Subtasks:**
- [ ] Implement exportUserData(userId) in account-management.service.ts
- [ ] Gather: user profile, groups, expenses, settlements, activity
- [ ] Format as JSON with clear structure
- [ ] Include exportedAt timestamp

---

### TASK-028: Create Data Export Route
| Field | Value |
|-------|-------|
| **Status** | DONE |
| **Priority** | P2 |
| **Assignee** | Backend Dev |
| **ACs** | AC-3.9 |
| **Estimate** | 0.5h |
| **Dependencies** | TASK-027 |

**Subtasks:**
- [ ] Add GET /users/me/data-export route
- [ ] Rate limit: 1 per 24 hours
- [ ] Return JSON download with Content-Disposition header

---

### TASK-029: Write Account Management Tests
| Field | Value |
|-------|-------|
| **Status** | DONE |
| **Priority** | P2 |
| **Assignee** | Backend Dev |
| **ACs** | AC-3.10 |
| **Estimate** | 1h |
| **Dependencies** | TASK-024 |

**Subtasks:**
- [ ] Create src/__tests__/account-management.service.test.ts
- [ ] Test deletion request sets correct timestamp
- [ ] Test cancellation within grace period
- [ ] Test data export includes all required fields
- [ ] Test anonymization removes PII correctly

---

## Summary

| Category | Tasks | Estimated Hours |
|----------|-------|-----------------|
| Database Migrations | 6 | 3h |
| Sprint 009 Cleanup | 3 | 1.75h |
| Email Verification | 8 | 5.25h |
| OAuth/Social Login | 6 | 6h |
| Account Management | 6 | 5.5h |
| **Total** | **29** | **21.5h** |

---

## Task Dependencies Graph

```
TASK-001 (Migration Config)
    ├── TASK-002 (Sprint 009 Migration)
    │   └── TASK-006 (Doc Migration Workflow)
    ├── TASK-004 (OAuth Migration)
    └── TASK-005 (Soft Delete Migration)

TASK-010 (Verification Schema)
    ├── TASK-003 (Verification Migration)
    └── TASK-011 (Verification Service)
        ├── TASK-013 (Update Registration)
        ├── TASK-014 (Verify Endpoint)
        ├── TASK-015 (Resend Endpoint)
        └── TASK-017 (Verification Tests)

TASK-012 (Email Template) → TASK-013 (Update Registration)

TASK-018 (OAuth Service)
    └── TASK-019 (OAuth User Mgmt)
        ├── TASK-020 (OAuth Routes)
        └── TASK-023 (OAuth Tests)

TASK-024 (Account Mgmt Service)
    ├── TASK-025 (Deletion Routes)
    ├── TASK-027 (Export Service)
    │   └── TASK-028 (Export Route)
    └── TASK-029 (Account Tests)
```

---

## Sprint Burndown

| Day | Tasks Remaining | Notes |
|-----|-----------------|-------|
| Start | 29 | Sprint begins |
| Day 1 | 1 | 28/29 tasks complete, TASK-009 deferred |

---

## Sign-off

| Role | Name | Status | Date |
|------|------|--------|------|
| Lead Developer | Claude | Planned | 2026-01-21 |
