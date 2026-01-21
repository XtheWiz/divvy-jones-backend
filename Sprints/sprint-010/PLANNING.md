# Sprint 010 Planning

**Date:** 2026-01-21
**Lead Developer:** Claude (Lead Dev)
**Sprint Goal:** User security, OAuth, and GDPR compliance

---

## Executive Summary

Sprint 010 builds on the strong foundation established in Sprint 009 (password reset, rate limiting, middleware). This sprint focuses on:

1. **Email Verification** - Using the same token pattern as password reset
2. **Google OAuth** - Leveraging existing `oauthAccounts` schema
3. **Account Management** - GDPR compliance using existing `deletedAt` soft delete
4. **Database Migrations** - Formalizing schema change workflow with Drizzle

The codebase is well-prepared for these features - key schema elements already exist.

---

## Technical Analysis

### Current State Assessment

| Component | Status | Notes |
|-----------|--------|-------|
| `users.isEmailVerified` | Schema exists | Column exists but not used in auth flow |
| `oauthAccounts` table | Schema exists | Full OAuth linking schema ready |
| `authProviderType` enum | Defined | Includes 'google', 'apple', 'facebook', 'line' |
| `users.deletedAt` | Schema exists | Soft delete column ready |
| Password reset tokens | Implemented | Pattern to follow for email verification |
| Email service | Implemented | Ready for verification emails |
| Rate limiting | Implemented | Can reuse for new endpoints |

### Schema Changes Required

```sql
-- New table for email verification tokens (follows password_reset_tokens pattern)
CREATE TABLE email_verification_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  verified_at TIMESTAMP,  -- NULL = unused, timestamp = verified
  created_at TIMESTAMP DEFAULT NOW()
);
CREATE INDEX idx_email_verification_user ON email_verification_tokens(user_id);

-- New column for deletion grace period
ALTER TABLE users ADD COLUMN deletion_requested_at TIMESTAMP;
```

---

## Feature 0: Sprint 009 Cleanup

### Technical Approach

1. **Database Migrations (AC-0.2)**
   - Generate Drizzle migration for `password_reset_tokens` table
   - Command: `bunx drizzle-kit generate:pg`

2. **Rate Limiting Documentation (AC-0.3)**
   - Add configuration section to README.md
   - Document environment variables and defaults

3. **Duplicate Helpers Consolidation (AC-0.4)**
   - Audit services for duplicate functions
   - Consolidate into shared utilities

### Files to Modify
- `README.md` - Add rate limiting section
- `src/services/` - Audit for duplicates
- `drizzle/` - Generate migration files

---

## Feature 1: Email Verification

### Technical Approach

Follow the password reset token pattern established in Sprint 009:

```
Registration → Generate Token → Hash & Store → Send Email
                                                    ↓
User clicks link → Verify Token → Mark Email Verified
```

### Implementation Details

#### 1.1 Email Verification Token Schema

**File:** `src/db/schema/users.ts`

```typescript
export const emailVerificationTokens = pgTable("email_verification_tokens", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  tokenHash: text("token_hash").notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  verifiedAt: timestamp("verified_at"),  // Single-use tracking
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
```

**Design Decisions:**
- Token expiry: **24 hours** (longer than password reset since less security-sensitive)
- Token length: **32 characters** (same as password reset)
- Hash algorithm: **bcrypt with 10 rounds** (same as password reset)
- Single-use: Track via `verifiedAt` timestamp

#### 1.2 Email Verification Service

**File:** `src/services/email-verification.service.ts`

```typescript
// Core functions
generateVerificationToken(userId: string) → { token: string, expiresAt: Date }
verifyEmailToken(rawToken: string) → { success: boolean, userId?: string }
resendVerificationEmail(email: string) → { success: boolean }
isEmailVerified(userId: string) → boolean
```

**Security Considerations:**
- Invalidate old tokens when generating new one
- Rate limit resend endpoint (3 per hour per email - same as password reset)
- Use generic responses to prevent email enumeration

#### 1.3 Registration Flow Update

**File:** `src/routes/auth.ts` (modify existing)

```typescript
// POST /auth/register
// After creating user, before returning success:
1. Generate verification token
2. Queue verification email (async, non-blocking)
3. Return success with user data (don't wait for email)
```

#### 1.4 New Endpoints

```typescript
// GET /auth/verify-email?token=xxx
// Validates token, marks email verified

// POST /auth/resend-verification
// Body: { email: string }
// Rate limited: 3 per hour
```

#### 1.5 Email Template

**File:** `src/services/email/templates/email-verification.ts`

Template content:
- Clear CTA button: "Verify Your Email"
- Expiry warning: "This link expires in 24 hours"
- Fallback link for email clients that block buttons

### Soft Enforcement Strategy (AC-1.9)

Unverified users can still use the app but:
- GET /users/me response includes `emailVerified: false`
- Frontend can display reminder banner
- No backend enforcement for MVP (can add later)

---

## Feature 2: OAuth/Social Login (Google)

### Technical Approach

Use OAuth 2.0 Authorization Code flow:

```
1. User clicks "Sign in with Google"
        ↓
2. GET /auth/google → Redirect to Google consent
        ↓
3. User grants permission → Google redirects back
        ↓
4. GET /auth/google/callback?code=xxx
        ↓
5. Exchange code for tokens → Get user info
        ↓
6. Create/link account → Return JWT
```

### Implementation Details

#### 2.1 OAuth Service

**File:** `src/services/oauth.service.ts`

```typescript
interface GoogleUserInfo {
  id: string;
  email: string;
  name: string;
  picture?: string;
  verified_email: boolean;
}

// Core functions
getGoogleAuthUrl(state: string) → string
exchangeGoogleCode(code: string) → { accessToken, refreshToken, idToken }
getGoogleUserInfo(accessToken: string) → GoogleUserInfo
linkGoogleAccount(userId: string, googleUser: GoogleUserInfo) → void
findOrCreateGoogleUser(googleUser: GoogleUserInfo) → { user, isNew }
```

#### 2.2 OAuth Configuration

**Environment Variables:**
```
GOOGLE_CLIENT_ID=xxx
GOOGLE_CLIENT_SECRET=xxx
GOOGLE_CALLBACK_URL=http://localhost:3000/auth/google/callback
```

**Google OAuth Scopes:**
- `openid` - Required for ID token
- `email` - Get user's email
- `profile` - Get user's name and picture

#### 2.3 Account Linking Logic

```
Case 1: New user via Google
  → Create user with emailVerified=true, primaryAuthProvider='google'
  → Create oauthAccounts record
  → Generate JWT tokens

Case 2: Existing user (same email) not yet linked
  → Link Google to existing account (add oauthAccounts record)
  → Set emailVerified=true (Google verifies emails)
  → Generate JWT tokens

Case 3: Existing user already linked
  → Just login, generate JWT tokens
```

#### 2.4 OAuth State Security

Use signed state parameter to prevent CSRF:
```typescript
const state = jwt.sign({
  nonce: crypto.randomUUID(),
  timestamp: Date.now()
}, JWT_SECRET, { expiresIn: '10m' });
```

#### 2.5 Token Storage

OAuth refresh tokens stored in `oauthAccounts.refreshToken`:
- **Encryption:** AES-256-GCM using `OAUTH_ENCRYPTION_KEY` env var
- **Purpose:** Allows token refresh without re-auth (future feature)

### Dependencies

**External:**
- Google Cloud Console project
- OAuth 2.0 Client ID and Secret
- Authorized redirect URI configuration

**Libraries (already available via Bun):**
- Fetch API for HTTP requests to Google
- crypto for encryption

---

## Feature 3: Account Management (GDPR)

### Technical Approach

Implement GDPR-compliant account management:
- **Right to Erasure:** Account deletion with grace period
- **Right to Access:** Data export in machine-readable format

### Implementation Details

#### 3.1 Account Deletion Flow

```
DELETE /users/me
    ↓
Set deletionRequestedAt = NOW()
    ↓
Send confirmation email
    ↓
User has 7 days to cancel via GET /users/me/cancel-deletion
    ↓
After 7 days: Background job sets deletedAt = NOW()
    ↓
User data anonymized, account inaccessible
```

#### 3.2 Soft Delete Implementation

**Schema Update:**
```typescript
// Add to users table
deletionRequestedAt: timestamp("deletion_requested_at"),
```

**Data Handling:**
- User record: Keep but anonymize (email=null, displayName="Deleted User")
- Expenses: Keep for group integrity, show "Deleted User" as creator
- Settlements: Keep records for audit trail
- Group memberships: Remove (can't be in groups after deletion)
- OAuth accounts: Hard delete (no need to keep)
- Tokens (refresh, reset, verification): Hard delete

#### 3.3 Data Export

**File:** `src/services/account-management.service.ts`

**Export Format:** JSON with sections:
```json
{
  "exportedAt": "2026-01-21T12:00:00Z",
  "user": {
    "email": "user@example.com",
    "displayName": "John Doe",
    "createdAt": "...",
    "emailVerified": true
  },
  "groups": [...],
  "expenses": [...],
  "settlements": [...],
  "activityLog": [...]
}
```

**Rate Limiting:** 1 export per 24 hours (expensive operation)

#### 3.4 New Routes

**File:** `src/routes/users.ts` (extend existing)

```typescript
// DELETE /users/me - Request account deletion
// GET /users/me/cancel-deletion - Cancel deletion request
// GET /users/me/data-export - Download all user data
```

---

## Feature 4: Database Migrations

### Technical Approach

Establish Drizzle migration workflow:

```
Schema Change → Generate Migration → Review → Apply
                                        ↓
                               Version controlled
```

### Implementation Details

#### 4.1 Migration Setup

**drizzle.config.ts:**
```typescript
export default {
  schema: "./src/db/schema/*",
  out: "./drizzle/migrations",
  driver: "pg",
  dbCredentials: {
    connectionString: process.env.DATABASE_URL
  }
};
```

**Scripts (package.json):**
```json
{
  "db:generate": "drizzle-kit generate:pg",
  "db:migrate": "drizzle-kit migrate",
  "db:push": "drizzle-kit push:pg",
  "db:studio": "drizzle-kit studio"
}
```

#### 4.2 Migrations to Generate

1. `password_reset_tokens` - From Sprint 009
2. `email_verification_tokens` - New table
3. `users.deletion_requested_at` - New column
4. Any missing indexes

#### 4.3 Rollback Strategy

Document in README:
- Keep backup before migration
- Test migrations on staging first
- For emergency rollback: restore from backup (no automated rollback for MVP)

---

## Implementation Order

```
Week 1:
├── Feature 4: Database Migrations (foundation)
│   ├── TASK-001: Setup Drizzle migration config
│   ├── TASK-002: Generate Sprint 009 migrations
│   └── TASK-003: Document migration workflow
│
├── Feature 0: Sprint 009 Cleanup
│   ├── TASK-004: Rate limiting documentation
│   └── TASK-005: Duplicate helper audit
│
└── Feature 1: Email Verification
    ├── TASK-006: Schema + service
    ├── TASK-007: Routes + templates
    └── TASK-008: Tests

Week 2:
├── Feature 2: OAuth/Social Login
│   ├── TASK-009: OAuth service
│   ├── TASK-010: Routes + state handling
│   └── TASK-011: Tests
│
└── Feature 3: Account Management
    ├── TASK-012: Deletion service + routes
    ├── TASK-013: Data export service
    └── TASK-014: Tests
```

---

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Google OAuth setup complexity | Medium | Medium | Use minimal scopes, follow Google docs closely |
| GDPR edge cases | Medium | High | Start conservatively, consult guidelines |
| Email deliverability | Low | Medium | Reuse working email service from Sprint 006 |
| Migration failures | Low | High | Test on staging, have rollback plan |

---

## Testing Strategy

### Unit Tests (per feature)
- Email verification: Token generation, verification, expiry
- OAuth: State generation, token exchange, user creation/linking
- Account management: Deletion flow, data export format
- Migrations: Schema validation

### Integration Tests
- Full email verification flow
- OAuth callback handling
- Account deletion with grace period

### Manual Testing
- Google OAuth end-to-end (requires real credentials)
- Email verification with actual email delivery
- Data export download and validation

---

## Environment Variables (New)

```bash
# OAuth
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_CALLBACK_URL=http://localhost:3000/auth/google/callback
OAUTH_ENCRYPTION_KEY=  # For encrypting OAuth refresh tokens

# Email Verification
EMAIL_VERIFICATION_EXPIRY_HOURS=24

# Account Deletion
DELETION_GRACE_PERIOD_DAYS=7
```

---

## Dependencies & Blockers

### External Dependencies
| Dependency | Required For | Owner | Status |
|------------|--------------|-------|--------|
| Google Cloud project | OAuth | DevOps | Pending |
| OAuth credentials | OAuth | DevOps | Pending |

### Internal Dependencies
- Feature 4 (Migrations) should complete first
- Feature 1 (Email Verification) before Feature 2 (OAuth links to verification)
- Feature 0 (Cleanup) can run in parallel

---

## Definition of Done

- [ ] All acceptance criteria met
- [ ] Unit tests for each service
- [ ] Drizzle migrations generated and tested
- [ ] Environment variables documented
- [ ] Code reviewed
- [ ] QA verified

---

## Sign-off

| Role | Name | Status | Date |
|------|------|--------|------|
| Lead Developer | Claude | Planned | 2026-01-21 |
