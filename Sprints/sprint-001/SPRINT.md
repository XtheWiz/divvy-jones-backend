# Sprint 001

## Sprint Information
| Field | Value |
|-------|-------|
| **Sprint Number** | 001 |
| **Start Date** | 2026-01-20 |
| **End Date** | 2026-02-03 |
| **Sprint Goal** | Establish authentication foundation and basic group management |
| **Status** | Planning |

---

## Team Allocation

| Role | Agent | Availability |
|------|-------|--------------|
| Project Owner | Claude (PO mode) | 100% |
| Lead Developer | Claude (Lead Dev mode) | 100% |
| Backend Developer | Claude (Backend mode) | 100% |
| QA Engineer | Claude (QA mode) | 100% |

---

## Previous Retrospective Action Items
_First sprint - no previous retrospective_

N/A

---

## Sprint Goal

> **Establish the authentication foundation and basic group management capabilities for Divvy-Jones**

By the end of this sprint, users should be able to:
1. Register a new account with email/password
2. Log in and receive authentication tokens
3. Create a new expense group
4. Join an existing group via invite code

This sprint establishes the foundational user and group infrastructure that all subsequent features will build upon.

---

## Features to Deliver

### Feature 1: User Authentication System
**Backlog ID:** BL-001
**Priority:** P0 - Critical

**Description:**
Implement the core authentication system including user registration, login, and JWT-based session management. This is the foundational feature that enables all user-specific functionality.

**Acceptance Criteria:**

#### Registration
- [ ] **AC-1.1:** User can register with email, password, and display name
- [ ] **AC-1.2:** Email must be unique and validated (format check)
- [ ] **AC-1.3:** Password must meet security requirements (min 8 chars, mixed case, number)
- [ ] **AC-1.4:** Registration returns JWT access token and refresh token
- [ ] **AC-1.5:** Password is hashed using bcrypt before storage
- [ ] **AC-1.6:** Duplicate email returns appropriate error message

#### Login
- [ ] **AC-1.7:** User can log in with email and password
- [ ] **AC-1.8:** Successful login returns JWT access token (15min expiry) and refresh token (30 days)
- [ ] **AC-1.9:** Invalid credentials return 401 with generic error message
- [ ] **AC-1.10:** Locked/deleted accounts cannot log in

#### Token Management
- [ ] **AC-1.11:** Access token contains user ID and email in payload
- [ ] **AC-1.12:** Refresh token can be used to obtain new access token
- [ ] **AC-1.13:** Refresh tokens are single-use (rotated on refresh)
- [ ] **AC-1.14:** Invalid/expired refresh tokens return 401

#### User Profile
- [ ] **AC-1.15:** Authenticated user can retrieve their profile (`GET /users/me`)
- [ ] **AC-1.16:** Profile includes: id, email, displayName, createdAt

**Technical Notes:**
- Use JWT with HS256 algorithm
- Store refresh tokens in database with expiry
- Implement rate limiting on auth endpoints (5 req/min)
- All passwords hashed with bcrypt (cost factor 12)

**Out of Scope for Sprint 001:**
- Password reset flow
- OAuth providers (Google, Apple)
- Email verification
- Account deletion

---

### Feature 2: Basic Group Management
**Backlog ID:** BL-002 (partial)
**Priority:** P0 - Critical

**Description:**
Implement basic group creation and joining functionality. Users can create expense groups and invite others via a shareable code.

**Acceptance Criteria:**

#### Create Group
- [ ] **AC-2.1:** Authenticated user can create a new group
- [ ] **AC-2.2:** Group requires: name (required), description (optional)
- [ ] **AC-2.3:** Group name must be 1-100 characters
- [ ] **AC-2.4:** Creator automatically becomes group owner/member
- [ ] **AC-2.5:** Group receives a unique 8-character join code (alphanumeric)
- [ ] **AC-2.6:** Group receives a default currency based on user's locale (or USD)
- [ ] **AC-2.7:** Creation returns group details including join code

#### Join Group
- [ ] **AC-2.8:** Authenticated user can join group using join code
- [ ] **AC-2.9:** Invalid join code returns 404
- [ ] **AC-2.10:** User cannot join a group they're already a member of
- [ ] **AC-2.11:** Joining returns group details
- [ ] **AC-2.12:** New member has "member" role (not owner/admin)

#### View Groups
- [ ] **AC-2.13:** User can list all groups they belong to (`GET /groups`)
- [ ] **AC-2.14:** Group list includes: id, name, description, role, memberCount, createdAt
- [ ] **AC-2.15:** Groups sorted by most recent activity
- [ ] **AC-2.16:** User can view single group details (`GET /groups/:id`)
- [ ] **AC-2.17:** Non-members cannot view group details (403)

#### View Group Members
- [ ] **AC-2.18:** Member can list all members of their group
- [ ] **AC-2.19:** Member list includes: userId, displayName, role, joinedAt

**Technical Notes:**
- Join codes: 8 characters, uppercase alphanumeric, no ambiguous chars (0/O, 1/I/L)
- Member roles: owner, admin, member
- Use transactions for group creation + membership creation

**Out of Scope for Sprint 001:**
- Group settings/editing
- Member removal
- Leave group
- Delete group
- QR code generation
- Guest/non-member users

---

## Sprint Metrics

| Metric | Planned | Actual |
|--------|---------|--------|
| Features | 2 | - |
| Acceptance Criteria | 36 | - |
| Estimated Complexity | Medium | - |
| Bugs Found | - | - |
| Bugs Fixed | - | - |

---

## Dependencies & Risks

### Dependencies
- PostgreSQL database running and accessible
- Drizzle schema migrations applied
- Bun runtime environment set up

### Risks
| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| JWT implementation complexity | Low | Medium | Use well-tested @elysiajs/jwt plugin |
| Database schema changes needed | Medium | Low | Schema already designed, minor adjustments OK |
| Auth security vulnerabilities | Medium | High | Follow OWASP guidelines, thorough code review |

---

## Definition of Done

A feature is considered DONE when:
1. All acceptance criteria are met
2. Code passes Lead Dev review
3. Unit tests written and passing
4. API endpoints documented (Swagger)
5. QA sign-off received
6. Code merged to develop branch

---

## API Endpoints (Expected)

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/auth/register` | User registration |
| POST | `/auth/login` | User login |
| POST | `/auth/refresh` | Refresh access token |
| GET | `/users/me` | Get current user profile |
| POST | `/groups` | Create new group |
| GET | `/groups` | List user's groups |
| GET | `/groups/:id` | Get group details |
| POST | `/groups/join` | Join group via code |
| GET | `/groups/:id/members` | List group members |

---

## Sign-off

| Role | Name | Date | Signature |
|------|------|------|-----------|
| Project Owner | Claude (PO) | 2026-01-20 | [x] Approved |
| Lead Developer | | | [ ] Approved |
