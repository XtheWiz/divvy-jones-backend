# Sprint 010 Definition

## Sprint Overview

| Field | Value |
|-------|-------|
| **Sprint Number** | 010 |
| **Sprint Goal** | Enhance user security and compliance with email verification, OAuth login, and account management |
| **Start Date** | 2026-01-21 |
| **Duration** | Standard sprint |
| **Defined By** | Claude (Project Owner) |

---

## Sprint Goal

> Strengthen user account security with email verification, simplify onboarding with OAuth/social login options, and ensure GDPR compliance with account deletion and data export capabilities.

---

## Features

### Feature 0: Sprint 009 Cleanup (P0)
**Description:** Complete Sprint 009 documentation and carry forward tech debt items

| AC ID | Acceptance Criteria |
|-------|---------------------|
| AC-0.1 | Sprint 009 artifacts complete and merged |
| AC-0.2 | Database migration created for password_reset_tokens table |
| AC-0.3 | Rate limiting configuration documented in README |
| AC-0.4 | Duplicate service helper functions consolidated |

---

### Feature 1: Email Verification (P1)
**Description:** Require email verification for new accounts to prevent spam and ensure valid contact
**Business Value:** Reduces fake accounts, ensures users can receive important notifications

| AC ID | Acceptance Criteria |
|-------|---------------------|
| AC-1.1 | Users table has `emailVerified` boolean and `emailVerifiedAt` timestamp columns |
| AC-1.2 | Registration sends verification email with unique token |
| AC-1.3 | GET /auth/verify-email?token=xxx verifies email and updates user record |
| AC-1.4 | Verification token expires after 24 hours |
| AC-1.5 | Verification token is single-use (invalidated after verification) |
| AC-1.6 | POST /auth/resend-verification sends new verification email |
| AC-1.7 | Resend endpoint rate limited to 3 per hour per email |
| AC-1.8 | Email verification template created with clear CTA |
| AC-1.9 | Unverified users can still log in but see reminder banner (soft enforcement) |
| AC-1.10 | Unit tests for email verification flow |

---

### Feature 2: OAuth/Social Login (P1)
**Description:** Allow users to sign in with Google for faster onboarding
**Business Value:** Reduces friction in signup, increases conversion, leverages trusted identity providers

| AC ID | Acceptance Criteria |
|-------|---------------------|
| AC-2.1 | Google OAuth 2.0 integration configured |
| AC-2.2 | GET /auth/google redirects to Google OAuth consent screen |
| AC-2.3 | GET /auth/google/callback handles OAuth callback and creates/links account |
| AC-2.4 | New users created via OAuth have emailVerified=true automatically |
| AC-2.5 | Existing email users can link Google account |
| AC-2.6 | OAuth users can optionally set a password for email login |
| AC-2.7 | User profile shows linked OAuth providers |
| AC-2.8 | OAuth tokens stored securely (refresh tokens encrypted) |
| AC-2.9 | Unit tests for OAuth flow |

---

### Feature 3: Account Management (P2)
**Description:** GDPR-compliant account deletion and data export
**Business Value:** Legal compliance, user trust, data privacy

| AC ID | Acceptance Criteria |
|-------|---------------------|
| AC-3.1 | DELETE /users/me initiates account deletion request |
| AC-3.2 | Account deletion has 7-day grace period (soft delete first) |
| AC-3.3 | User receives confirmation email when deletion requested |
| AC-3.4 | User can cancel deletion within grace period via GET /users/me/cancel-deletion |
| AC-3.5 | After grace period, account and all personal data permanently deleted |
| AC-3.6 | Expenses created by deleted user remain but show "Deleted User" |
| AC-3.7 | GET /users/me/data-export returns all user data as JSON (GDPR right to access) |
| AC-3.8 | Data export includes: profile, groups, expenses, settlements, activity |
| AC-3.9 | Data export rate limited to 1 per day |
| AC-3.10 | Unit tests for account deletion and data export |

---

### Feature 4: Database Migrations (P2)
**Description:** Implement proper database migration workflow
**Business Value:** Enables safe schema changes in production

| AC ID | Acceptance Criteria |
|-------|---------------------|
| AC-4.1 | Drizzle migration files generated for all schema changes |
| AC-4.2 | Migration for password_reset_tokens table created |
| AC-4.3 | Migration for email verification columns created |
| AC-4.4 | Migration for OAuth provider linking created |
| AC-4.5 | Migration for soft delete columns (deletedAt, deletionRequestedAt) created |
| AC-4.6 | npm run db:migrate applies pending migrations |
| AC-4.7 | Migration rollback strategy documented |

---

## Summary

| Feature | ACs | Priority |
|---------|-----|----------|
| Sprint 009 Cleanup | 4 | P0 |
| Email Verification | 10 | P1 |
| OAuth/Social Login | 9 | P1 |
| Account Management | 10 | P2 |
| Database Migrations | 7 | P2 |
| **Total** | **40** | |

---

## Dependencies

- Feature 1 (Email Verification) should be done early as OAuth depends on verification status
- Feature 2 (OAuth) requires Google Cloud Console project setup
- Feature 3 (Account Management) can be done in parallel with Features 1 & 2
- Feature 4 (Migrations) should be done first to establish pattern

---

## External Dependencies

| Dependency | Required For | Status |
|------------|--------------|--------|
| Google Cloud Console | OAuth | Needs setup |
| Google OAuth Client ID/Secret | OAuth | Needs provisioning |

---

## Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| Google OAuth setup complexity | Use well-documented passport-google-oauth20 or similar |
| GDPR compliance edge cases | Consult GDPR guidelines, implement conservatively |
| Email deliverability issues | Use existing email service from Sprint 006 |
| Migration safety in production | Test migrations in staging first |

---

## Out of Scope

- Apple Sign In (can be added in future sprint)
- Facebook/GitHub OAuth (Google sufficient for MVP)
- Two-factor authentication (future security enhancement)
- Push notifications (requires mobile app)

---

## Definition of Done

- [ ] All acceptance criteria met
- [ ] Unit tests written and passing
- [ ] Database migrations tested
- [ ] OAuth flow tested end-to-end
- [ ] Code reviewed by Lead Developer
- [ ] QA sign-off on all features
- [ ] Documentation updated

---

## Sign-off

| Role | Name | Status | Date |
|------|------|--------|------|
| Project Owner | Claude | Defined | 2026-01-21 |
