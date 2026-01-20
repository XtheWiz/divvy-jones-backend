# Sprint 001 Planning Session

## Session Information
| Field | Value |
|-------|-------|
| **Date** | 2026-01-20 |
| **Attendees** | PO, Lead Dev, Backend Dev, QA |
| **Facilitator** | Lead Developer |

---

## Sprint Goal Review

### Goal Statement
> Establish the authentication foundation and basic group management capabilities for Divvy-Jones

### Goal Alignment Check
- [x] Goal is achievable within sprint timeframe
- [x] Goal aligns with product roadmap
- [x] Team understands the goal
- [x] Success criteria are clear

---

## Schema Analysis

### Existing Schema Assets
The database schema is already defined in Drizzle ORM. Key tables relevant to this sprint:

| Table | Status | Notes |
|-------|--------|-------|
| `users` | ✅ Ready | Has email, displayName, passwordHash, deletedAt |
| `groups` | ✅ Ready | Has joinCode, ownerUserId, defaultCurrencyCode |
| `group_members` | ✅ Ready | Has role, status, joinedAt |
| `auth_provider_type` | ✅ Ready | Lookup table for auth providers |
| `membership_role` | ✅ Ready | owner, admin, member, viewer |
| `refresh_tokens` | ❌ Missing | **Needs to be created** |

### Schema Additions Required

**New Table: `refresh_tokens`**
```typescript
export const refreshTokens = pgTable("refresh_tokens", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  tokenHash: text("token_hash").notNull(),  // hashed token for lookup
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  revokedAt: timestamp("revoked_at", { withTimezone: true }),
});
```

---

## Feature Discussion

### Feature 1: User Authentication System

**Technical Approach:**
- Use `@elysiajs/jwt` plugin for JWT handling
- Use `bcrypt` (via `bcryptjs` for better Bun compatibility) for password hashing
- Store refresh tokens hashed in database (not plaintext)
- Implement token rotation on refresh (single-use tokens)

**Key Implementation Notes:**
- Access token: 15 minutes, contains `{ userId, email }`
- Refresh token: 30 days, stored hashed in DB
- Rate limiting: Use in-memory store initially (Redis in future sprint)

**Questions Raised:**
| Question | Answer | Action |
|----------|--------|--------|
| bcrypt vs argon2? | bcrypt per PO spec | None |
| Rate limit storage? | In-memory for MVP | Document for future |
| Token in cookie vs header? | Header (Bearer) | None |

**Estimated Effort:** Medium (M)

---

### Feature 2: Basic Group Management

**Technical Approach:**
- Use `nanoid` for join code generation (customizable alphabet)
- Join code: 8 chars, uppercase, exclude ambiguous (0O, 1IL)
- Use database transactions for group creation + member creation
- Group owner automatically gets "owner" role

**Key Implementation Notes:**
- Join code alphabet: `ABCDEFGHJKMNPQRSTUVWXYZ23456789` (22 letters + 8 digits)
- Default currency: USD (or from Accept-Language header if parseable)
- Non-members get 403 Forbidden on group access

**Questions Raised:**
| Question | Answer | Action |
|----------|--------|--------|
| Join code expiry? | No expiry for MVP | Out of scope |
| Case-sensitive codes? | No, normalize to uppercase | Implement |
| Max groups per user? | No limit for MVP | Document for future |

**Estimated Effort:** Medium (M)

---

## Technical Decisions

### Decision 1: Project Structure
**Context:** Need to establish consistent code organization
**Options Considered:**
1. Feature-based (routes/auth, routes/groups) - Simple, but can get messy
2. Layer-based (routes, services, middleware) - Clear separation

**Decision:** Layer-based structure
**Rationale:** Matches TECHNICAL_SPECS.md, clearer dependency flow, easier testing

```
src/
├── index.ts              # Entry point
├── app.ts                # Elysia app setup
├── routes/
│   ├── index.ts          # Route aggregator
│   ├── auth.ts           # Auth endpoints
│   ├── users.ts          # User endpoints
│   └── groups.ts         # Group endpoints
├── services/
│   ├── auth.service.ts   # Auth logic
│   └── group.service.ts  # Group logic
├── middleware/
│   └── auth.ts           # JWT validation
├── lib/
│   └── utils.ts          # Helpers
└── db/
    └── (existing schema)
```

### Decision 2: Password Hashing
**Context:** Need secure password storage
**Decision:** bcryptjs with cost factor 12
**Rationale:** PO specified bcrypt, cost 12 balances security and performance

### Decision 3: Token Strategy
**Context:** Secure session management
**Decision:**
- Access: JWT in Authorization header (Bearer)
- Refresh: Opaque token, stored hashed in DB, single-use

### Decision 4: Error Response Format
**Context:** Consistent API responses
**Decision:** Use format from TECHNICAL_SPECS.md
```typescript
// Success
{ success: true, data: { ... } }

// Error
{ success: false, error: { code: "ERROR_CODE", message: "..." } }
```

### Decision 5: Validation
**Context:** Input validation approach
**Decision:** Use Elysia's built-in TypeBox validation
**Rationale:** Native to Elysia, type-safe, good error messages

---

## Architecture Notes

### Authentication Flow
```
┌─────────┐      ┌─────────────┐      ┌──────────┐
│ Client  │──────│ Elysia API  │──────│ Postgres │
└─────────┘      └─────────────┘      └──────────┘
     │                  │                   │
     │ POST /auth/register                  │
     │ {email,password,displayName}         │
     │──────────────────>                   │
     │                  │ hash password     │
     │                  │ INSERT user       │
     │                  │──────────────────>│
     │                  │ generate tokens   │
     │                  │ INSERT refresh    │
     │                  │──────────────────>│
     │ {accessToken, refreshToken}          │
     │<──────────────────                   │
     │                                      │
     │ GET /users/me                        │
     │ Authorization: Bearer <accessToken>  │
     │──────────────────>                   │
     │                  │ verify JWT        │
     │                  │ SELECT user       │
     │                  │──────────────────>│
     │ {user data}                          │
     │<──────────────────                   │
```

### Group Creation Flow
```
┌─────────┐      ┌─────────────┐      ┌──────────┐
│ Client  │──────│ Elysia API  │──────│ Postgres │
└─────────┘      └─────────────┘      └──────────┘
     │                  │                   │
     │ POST /groups                         │
     │ {name, description}                  │
     │──────────────────>                   │
     │                  │ BEGIN TRANSACTION │
     │                  │ generate joinCode │
     │                  │ INSERT group      │
     │                  │──────────────────>│
     │                  │ INSERT member     │
     │                  │ (role: owner)     │
     │                  │──────────────────>│
     │                  │ COMMIT            │
     │ {group with joinCode}                │
     │<──────────────────                   │
```

---

## Risks Identified

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| bcryptjs performance in Bun | Low | Medium | Benchmark, fallback to native if needed |
| Race condition on join codes | Very Low | Low | Unique constraint handles collision |
| JWT secret management | Medium | High | Use env var, document rotation procedure |
| Schema migration issues | Low | Medium | Test migrations in dev first |

---

## Task Breakdown

### Feature 1: User Authentication System

| Task ID | Title | Complexity | Dependencies |
|---------|-------|------------|--------------|
| TASK-001 | Project setup and dependencies | S | None |
| TASK-002 | Add refresh_tokens schema | S | TASK-001 |
| TASK-003 | Auth service implementation | M | TASK-002 |
| TASK-004 | Registration endpoint | M | TASK-003 |
| TASK-005 | Login endpoint | M | TASK-003 |
| TASK-006 | Token refresh endpoint | M | TASK-003 |
| TASK-007 | Auth middleware | M | TASK-003 |
| TASK-008 | User profile endpoint | S | TASK-007 |

### Feature 2: Basic Group Management

| Task ID | Title | Complexity | Dependencies |
|---------|-------|------------|--------------|
| TASK-009 | Group service implementation | M | TASK-001 |
| TASK-010 | Create group endpoint | M | TASK-007, TASK-009 |
| TASK-011 | Join group endpoint | M | TASK-007, TASK-009 |
| TASK-012 | List user's groups endpoint | S | TASK-007 |
| TASK-013 | Get group details endpoint | S | TASK-007 |
| TASK-014 | List group members endpoint | S | TASK-007 |

### Total: 14 Tasks
- Small (S): 5 tasks
- Medium (M): 9 tasks

---

## Sprint Capacity

| Role | Tasks | Complexity Load |
|------|-------|-----------------|
| Backend Dev | 14 | 5S + 9M = 23 points |

**Assessment:** Achievable within 2-week sprint with focused effort.

---

## Implementation Order

**Recommended sequence:**
1. TASK-001: Project setup (foundation)
2. TASK-002: Schema update (before any DB ops)
3. TASK-003: Auth service (core logic)
4. TASK-007: Auth middleware (enables protected routes)
5. TASK-004: Registration (first user flow)
6. TASK-005: Login (completes auth flow)
7. TASK-006: Token refresh (completes token lifecycle)
8. TASK-008: User profile (simple protected route)
9. TASK-009: Group service (group logic)
10. TASK-010: Create group (core group feature)
11. TASK-011: Join group (core group feature)
12. TASK-012: List groups (read operation)
13. TASK-013: Get group details (read operation)
14. TASK-014: List members (read operation)

---

## Action Items

| Action | Owner | Due |
|--------|-------|-----|
| Create detailed task specs in tasks/ | Lead Dev | Today |
| Begin TASK-001 implementation | Backend Dev | After planning |
| Prepare test cases for auth | QA | During development |

---

## Planning Sign-off

| Role | Confirmed |
|------|-----------|
| Project Owner | [x] |
| Lead Developer | [x] |
| Backend Developer | [ ] Awaiting |
| QA Engineer | [ ] Awaiting |

**Planning Completed:** 2026-01-20
