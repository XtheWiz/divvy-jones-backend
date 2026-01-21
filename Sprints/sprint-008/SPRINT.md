# Sprint 008 Definition

## Sprint Overview

| Field | Value |
|-------|-------|
| **Sprint Number** | 008 |
| **Sprint Goal** | Add social features with comments and reactions, improve performance with caching |
| **Defined By** | Project Owner (Claude) |
| **Definition Date** | 2026-01-21 |
| **Status** | Defined |

---

## Sprint Goal

> Enhance user engagement with social features including expense comments and reactions, while improving system performance through strategic caching and query optimization.

---

## Features

| # | Feature | Backlog ID | Priority | Estimated ACs |
|---|---------|------------|----------|---------------|
| 0 | Sprint 007 Cleanup | Retro Items | P0 | 4 |
| 1 | Expense Comments | BL-009 | P1 | 10 |
| 2 | Reactions | BL-009 | P2 | 8 |
| 3 | Performance Improvements | Tech Debt | P2 | 8 |
| | **Total** | | | **30** |

---

## Feature 0: Sprint 007 Cleanup

**Priority:** P0 (Critical)
**Source:** Sprint 007 deferred items and cleanup

### Description
Close out remaining Sprint 007 items and ensure all documentation is complete.

### Acceptance Criteria

| AC ID | Description |
|-------|-------------|
| AC-0.1 | Sprint 007 RETROSPECTIVE.md created and complete |
| AC-0.2 | Sprint 007 QA_REPORT.md created with all ACs verified |
| AC-0.3 | BACKLOG.md updated with Sprint 007 completion |
| AC-0.4 | Sprint velocity metrics updated |

---

## Feature 1: Expense Comments

**Priority:** P1 (High)
**Source:** BL-009 (Social Features)

### Description
Allow group members to add comments on expenses for discussion, clarification, or additional context.

### Acceptance Criteria

#### Schema (3 ACs)
| AC ID | Description |
|-------|-------------|
| AC-1.1 | Comment table stores expense comments with author, text, and timestamps |
| AC-1.2 | Comments support soft delete (deletedAt column) |
| AC-1.3 | Comments are linked to expenses via expenseId foreign key |

#### Comment API (5 ACs)
| AC ID | Description |
|-------|-------------|
| AC-1.4 | POST /groups/:groupId/expenses/:expenseId/comments creates a new comment |
| AC-1.5 | GET /groups/:groupId/expenses/:expenseId/comments lists all comments (paginated) |
| AC-1.6 | PUT /groups/:groupId/expenses/:expenseId/comments/:commentId updates comment |
| AC-1.7 | DELETE /groups/:groupId/expenses/:expenseId/comments/:commentId soft-deletes comment |
| AC-1.8 | Only comment author can edit/delete their own comments |

#### Notifications (2 ACs)
| AC ID | Description |
|-------|-------------|
| AC-1.9 | Adding a comment creates a notification for expense participants |
| AC-1.10 | Comment notifications include comment preview text |

---

## Feature 2: Reactions

**Priority:** P2 (Medium)
**Source:** BL-009 (Social Features)

### Description
Allow users to react to expenses and settlements with emoji reactions (like, love, funny, sad, angry).

### Acceptance Criteria

#### Schema (2 ACs)
| AC ID | Description |
|-------|-------------|
| AC-2.1 | Reaction table stores entityType (expense/settlement), entityId, userId, reactionType |
| AC-2.2 | Unique constraint prevents duplicate reactions (same user, same entity, same type) |

#### Reaction API (4 ACs)
| AC ID | Description |
|-------|-------------|
| AC-2.3 | POST /groups/:groupId/expenses/:expenseId/reactions adds or toggles a reaction |
| AC-2.4 | DELETE /groups/:groupId/expenses/:expenseId/reactions/:type removes a reaction |
| AC-2.5 | GET /groups/:groupId/expenses/:expenseId includes reaction counts and current user's reactions |
| AC-2.6 | Settlement endpoints also support reactions via similar routes |

#### Reaction Types (2 ACs)
| AC ID | Description |
|-------|-------------|
| AC-2.7 | Support reaction types: thumbsUp, thumbsDown, heart, laugh, surprised, angry |
| AC-2.8 | Reaction type is validated against allowed enum values |

---

## Feature 3: Performance Improvements

**Priority:** P2 (Medium)
**Source:** Tech Debt

### Description
Improve system performance through caching frequently accessed data and optimizing slow queries.

### Acceptance Criteria

#### Caching (4 ACs)
| AC ID | Description |
|-------|-------------|
| AC-3.1 | Exchange rate cache reduces external API calls (already partially implemented) |
| AC-3.2 | Group summary data can be cached with configurable TTL |
| AC-3.3 | Cache invalidation occurs on relevant data changes |
| AC-3.4 | Cache stats endpoint for monitoring (admin only) |

#### Query Optimization (4 ACs)
| AC ID | Description |
|-------|-------------|
| AC-3.5 | Database indexes added for frequently filtered columns |
| AC-3.6 | Analytics queries use efficient aggregation patterns |
| AC-3.7 | Pagination uses cursor-based approach where beneficial |
| AC-3.8 | N+1 query issues identified and resolved in expense list endpoints |

---

## Technical Notes

### Comments Schema
```sql
CREATE TABLE expense_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  expense_id UUID NOT NULL REFERENCES expenses(id) ON DELETE CASCADE,
  group_id UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  author_member_id UUID NOT NULL REFERENCES group_members(id),
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

CREATE INDEX idx_comments_expense ON expense_comments(expense_id) WHERE deleted_at IS NULL;
```

### Reactions Schema
```sql
CREATE TABLE reactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type VARCHAR(20) NOT NULL, -- 'expense' or 'settlement'
  entity_id UUID NOT NULL,
  group_id UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  member_id UUID NOT NULL REFERENCES group_members(id),
  reaction_type VARCHAR(20) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(entity_type, entity_id, member_id, reaction_type)
);

CREATE INDEX idx_reactions_entity ON reactions(entity_type, entity_id);
```

### Caching Strategy
```typescript
// Use in-memory cache for development, Redis for production
// Cache TTL recommendations:
// - Exchange rates: 15 minutes (already implemented)
// - Group summaries: 5 minutes
// - User preferences: 10 minutes
```

---

## Dependencies

| Feature | External Dependency |
|---------|-------------------|
| Caching | Redis (optional, can use in-memory) |
| Performance | Database migration for new indexes |

---

## Risks and Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Comment spam | Medium | Rate limiting on comment creation |
| Cache invalidation complexity | Medium | Use simple TTL-based cache initially |
| Reaction abuse | Low | Rate limiting, can be toggled per group |

---

## Out of Scope

The following items are explicitly NOT included in Sprint 008:
- Push notifications (requires mobile/service worker infrastructure)
- Real-time comment updates (WebSocket - can be added later)
- Threaded replies to comments (flat comments only for MVP)
- Custom emoji reactions (predefined set only)
- Redis integration (in-memory cache sufficient for MVP)

---

## Definition of Done

- [ ] All acceptance criteria verified
- [ ] Unit tests written for new services
- [ ] Integration tests pass
- [ ] All existing tests pass
- [ ] Code reviewed by Lead Developer
- [ ] QA sign-off on all features
- [ ] Documentation updated
- [ ] No P0/P1 bugs open

---

## Approval

| Role | Status |
|------|--------|
| Project Owner | ✅ Defined |
| Lead Developer | ⏳ Pending Planning |
| Backend Developer | ⏳ Pending Task Assignment |
| QA Engineer | ⏳ Pending Test Cases |
