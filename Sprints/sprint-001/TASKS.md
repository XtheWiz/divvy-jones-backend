# Sprint 001 - Task Board

## Overview
| Status | Count |
|--------|-------|
| Todo | 14 |
| In Progress | 0 |
| In Review | 0 |
| QA | 0 |
| Done | 0 |
| **Total** | **14** |

---

## Task Board

### 📋 Todo
_Tasks ready to be picked up_

#### TASK-001: Project Setup and Dependencies
| Field | Value |
|-------|-------|
| **Assignee** | Backend Dev |
| **Priority** | Critical |
| **Complexity** | S |
| **Feature** | Auth System |
| **Dependencies** | None |

**Acceptance Criteria:**
- [ ] Create package.json with Bun/Elysia dependencies
- [ ] Set up Elysia app with basic health endpoint
- [ ] Configure TypeScript (tsconfig.json)
- [ ] Create .env.example with required variables
- [ ] Verify `bun run dev` starts server

---

#### TASK-002: Add refresh_tokens Schema
| Field | Value |
|-------|-------|
| **Assignee** | Backend Dev |
| **Priority** | High |
| **Complexity** | S |
| **Feature** | Auth System |
| **Dependencies** | TASK-001 |

**Acceptance Criteria:**
- [ ] Create refresh_tokens table in Drizzle schema
- [ ] Add indexes for userId and tokenHash
- [ ] Generate and apply migration
- [ ] Export types (RefreshToken, NewRefreshToken)

---

#### TASK-003: Auth Service Implementation
| Field | Value |
|-------|-------|
| **Assignee** | Backend Dev |
| **Priority** | High |
| **Complexity** | M |
| **Feature** | Auth System |
| **Dependencies** | TASK-002 |

**Acceptance Criteria:**
- [ ] Implement `hashPassword(password)` using bcryptjs (cost 12)
- [ ] Implement `verifyPassword(password, hash)`
- [ ] Implement `generateAccessToken(user)` - JWT, 15min expiry
- [ ] Implement `generateRefreshToken(userId)` - opaque, store hashed
- [ ] Implement `verifyRefreshToken(token)` - lookup and validate
- [ ] Implement `revokeRefreshToken(tokenId)`
- [ ] Implement `validatePasswordStrength(password)` - min 8, mixed case, number

---

#### TASK-004: Registration Endpoint
| Field | Value |
|-------|-------|
| **Assignee** | Backend Dev |
| **Priority** | High |
| **Complexity** | M |
| **Feature** | Auth System |
| **Dependencies** | TASK-003 |

**Acceptance Criteria:**
- [ ] POST `/auth/register` accepts email, password, displayName
- [ ] Validates email format
- [ ] Validates password strength (AC-1.3)
- [ ] Checks email uniqueness, returns error if duplicate (AC-1.6)
- [ ] Hashes password before storage (AC-1.5)
- [ ] Creates user with primaryAuthProvider = 'email'
- [ ] Generates and returns access + refresh tokens (AC-1.4)
- [ ] Returns user profile in response

---

#### TASK-005: Login Endpoint
| Field | Value |
|-------|-------|
| **Assignee** | Backend Dev |
| **Priority** | High |
| **Complexity** | M |
| **Feature** | Auth System |
| **Dependencies** | TASK-003 |

**Acceptance Criteria:**
- [ ] POST `/auth/login` accepts email, password
- [ ] Finds user by email (case-insensitive)
- [ ] Verifies password against hash
- [ ] Returns 401 for invalid credentials with generic message (AC-1.9)
- [ ] Checks user not deleted (deletedAt is null) (AC-1.10)
- [ ] Returns access token (15min) and refresh token (30 days) (AC-1.8)
- [ ] Returns user profile in response

---

#### TASK-006: Token Refresh Endpoint
| Field | Value |
|-------|-------|
| **Assignee** | Backend Dev |
| **Priority** | High |
| **Complexity** | M |
| **Feature** | Auth System |
| **Dependencies** | TASK-003 |

**Acceptance Criteria:**
- [ ] POST `/auth/refresh` accepts refreshToken
- [ ] Validates refresh token exists and not expired
- [ ] Validates refresh token not revoked
- [ ] Revokes old refresh token (single-use) (AC-1.13)
- [ ] Generates new access + refresh tokens
- [ ] Returns 401 for invalid/expired tokens (AC-1.14)

---

#### TASK-007: Auth Middleware
| Field | Value |
|-------|-------|
| **Assignee** | Backend Dev |
| **Priority** | High |
| **Complexity** | M |
| **Feature** | Auth System |
| **Dependencies** | TASK-003 |

**Acceptance Criteria:**
- [ ] Create Elysia plugin/derive for JWT validation
- [ ] Extract Bearer token from Authorization header
- [ ] Verify JWT signature and expiry
- [ ] Attach user info to context (userId, email) (AC-1.11)
- [ ] Return 401 for missing/invalid token
- [ ] Make middleware composable (can apply to routes)

---

#### TASK-008: User Profile Endpoint
| Field | Value |
|-------|-------|
| **Assignee** | Backend Dev |
| **Priority** | Medium |
| **Complexity** | S |
| **Feature** | Auth System |
| **Dependencies** | TASK-007 |

**Acceptance Criteria:**
- [ ] GET `/users/me` requires authentication (AC-1.15)
- [ ] Returns user id, email, displayName, createdAt (AC-1.16)
- [ ] Does not return passwordHash or sensitive fields
- [ ] Returns 401 if not authenticated

---

#### TASK-009: Group Service Implementation
| Field | Value |
|-------|-------|
| **Assignee** | Backend Dev |
| **Priority** | High |
| **Complexity** | M |
| **Feature** | Group Management |
| **Dependencies** | TASK-001 |

**Acceptance Criteria:**
- [ ] Implement `generateJoinCode()` - 8 chars, uppercase, no ambiguous chars
- [ ] Implement `createGroup(userId, data)` - transactional with member creation
- [ ] Implement `findGroupByJoinCode(code)` - case-insensitive lookup
- [ ] Implement `addMemberToGroup(groupId, userId, role)`
- [ ] Implement `isUserMember(groupId, userId)` - membership check
- [ ] Implement `getUserGroups(userId)` - with member count
- [ ] Implement `getGroupMembers(groupId)` - with user details

---

#### TASK-010: Create Group Endpoint
| Field | Value |
|-------|-------|
| **Assignee** | Backend Dev |
| **Priority** | High |
| **Complexity** | M |
| **Feature** | Group Management |
| **Dependencies** | TASK-007, TASK-009 |

**Acceptance Criteria:**
- [ ] POST `/groups` requires authentication (AC-2.1)
- [ ] Accepts name (required), description (optional) (AC-2.2)
- [ ] Validates name 1-100 characters (AC-2.3)
- [ ] Creates group with owner as current user (AC-2.4)
- [ ] Generates unique join code (AC-2.5)
- [ ] Sets default currency to USD (AC-2.6)
- [ ] Adds creator as member with role 'owner'
- [ ] Returns group details including joinCode (AC-2.7)

---

#### TASK-011: Join Group Endpoint
| Field | Value |
|-------|-------|
| **Assignee** | Backend Dev |
| **Priority** | High |
| **Complexity** | M |
| **Feature** | Group Management |
| **Dependencies** | TASK-007, TASK-009 |

**Acceptance Criteria:**
- [ ] POST `/groups/join` requires authentication
- [ ] Accepts joinCode in body
- [ ] Normalizes code to uppercase for lookup
- [ ] Returns 404 for invalid code (AC-2.9)
- [ ] Returns 409 if already a member (AC-2.10)
- [ ] Adds user as member with role 'member' (AC-2.12)
- [ ] Returns group details (AC-2.11)

---

#### TASK-012: List User's Groups Endpoint
| Field | Value |
|-------|-------|
| **Assignee** | Backend Dev |
| **Priority** | Medium |
| **Complexity** | S |
| **Feature** | Group Management |
| **Dependencies** | TASK-007 |

**Acceptance Criteria:**
- [ ] GET `/groups` requires authentication (AC-2.13)
- [ ] Returns array of groups user belongs to
- [ ] Each group includes: id, name, description, role, memberCount, createdAt (AC-2.14)
- [ ] Groups sorted by most recent activity (createdAt desc for MVP) (AC-2.15)

---

#### TASK-013: Get Group Details Endpoint
| Field | Value |
|-------|-------|
| **Assignee** | Backend Dev |
| **Priority** | Medium |
| **Complexity** | S |
| **Feature** | Group Management |
| **Dependencies** | TASK-007 |

**Acceptance Criteria:**
- [ ] GET `/groups/:id` requires authentication (AC-2.16)
- [ ] Returns 403 if user is not a member (AC-2.17)
- [ ] Returns full group details including joinCode (for members)
- [ ] Includes user's role in the group
- [ ] Includes member count

---

#### TASK-014: List Group Members Endpoint
| Field | Value |
|-------|-------|
| **Assignee** | Backend Dev |
| **Priority** | Medium |
| **Complexity** | S |
| **Feature** | Group Management |
| **Dependencies** | TASK-007 |

**Acceptance Criteria:**
- [ ] GET `/groups/:id/members` requires authentication (AC-2.18)
- [ ] Returns 403 if user is not a member
- [ ] Returns array of members
- [ ] Each member includes: userId, displayName, role, joinedAt (AC-2.19)
- [ ] Sorted by joinedAt (owner first, then by join date)

---

### 🔄 In Progress
_Tasks currently being worked on_

<!-- Active tasks will be moved here -->

---

### 👀 In Review
_Tasks submitted for code review_

<!-- Tasks pending review will be moved here -->

---

### 🧪 QA
_Tasks being tested_

<!-- Tasks in QA will be moved here -->

---

### ✅ Done
_Completed tasks_

<!-- Completed tasks will be moved here -->

---

## Task Index

| Task ID | Title | Assignee | Status | Priority | Complexity | Feature |
|---------|-------|----------|--------|----------|------------|---------|
| TASK-001 | Project setup and dependencies | Backend Dev | Todo | Critical | S | Auth |
| TASK-002 | Add refresh_tokens schema | Backend Dev | Todo | High | S | Auth |
| TASK-003 | Auth service implementation | Backend Dev | Todo | High | M | Auth |
| TASK-004 | Registration endpoint | Backend Dev | Todo | High | M | Auth |
| TASK-005 | Login endpoint | Backend Dev | Todo | High | M | Auth |
| TASK-006 | Token refresh endpoint | Backend Dev | Todo | High | M | Auth |
| TASK-007 | Auth middleware | Backend Dev | Todo | High | M | Auth |
| TASK-008 | User profile endpoint | Backend Dev | Todo | Medium | S | Auth |
| TASK-009 | Group service implementation | Backend Dev | Todo | High | M | Groups |
| TASK-010 | Create group endpoint | Backend Dev | Todo | High | M | Groups |
| TASK-011 | Join group endpoint | Backend Dev | Todo | High | M | Groups |
| TASK-012 | List user's groups endpoint | Backend Dev | Todo | Medium | S | Groups |
| TASK-013 | Get group details endpoint | Backend Dev | Todo | Medium | S | Groups |
| TASK-014 | List group members endpoint | Backend Dev | Todo | Medium | S | Groups |

---

## Implementation Order

```
TASK-001 ─────┬──────> TASK-002 ──────> TASK-003 ──┬──> TASK-004
              │                                     │
              │                                     ├──> TASK-005
              │                                     │
              │                                     ├──> TASK-006
              │                                     │
              │                                     └──> TASK-007 ──┬──> TASK-008
              │                                                     │
              │                                                     ├──> TASK-010
              │                                                     │
              │                                                     ├──> TASK-011
              │                                                     │
              │                                                     ├──> TASK-012
              │                                                     │
              │                                                     ├──> TASK-013
              │                                                     │
              └──────> TASK-009 ────────────────────────────────────┴──> TASK-014
```

---

## Quick Links
- [Sprint Document](./SPRINT.md)
- [Planning Notes](./PLANNING.md)
- [Review Log](./REVIEW_LOG.md)
- [QA Report](./QA_REPORT.md)

---

## Notes
- All tasks assigned to Backend Dev
- Start with TASK-001, then follow dependency chain
- Auth tasks (001-008) can be completed before group tasks
- Tasks 009-014 can begin once TASK-007 (middleware) is done
- Update this board as tasks progress
