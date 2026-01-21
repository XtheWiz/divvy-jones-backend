# Sprint 008 Planning

## Planning Overview

| Field | Value |
|-------|-------|
| **Sprint Number** | 008 |
| **Planning Date** | TBD |
| **Lead Developer** | Claude |
| **Status** | Pending |

---

## Technical Analysis

### Feature 1: Expense Comments

#### Architecture
- New `expense_comments` table in schema
- Comment service for CRUD operations
- Integration with notification service for mentions/participants
- Comments included in expense detail endpoint response

#### File Changes
| File | Change Type | Description |
|------|-------------|-------------|
| `src/db/schema/comments.ts` | New | Comment table definition |
| `src/db/schema/index.ts` | Modify | Export comments schema |
| `src/routes/comments.ts` | New | Comment CRUD endpoints |
| `src/routes/index.ts` | Modify | Add comment routes |
| `src/services/comment.service.ts` | New | Comment business logic |
| `src/services/expense.service.ts` | Modify | Include comments in expense details |

#### Database Migration
```sql
-- Create comments table
CREATE TABLE expense_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  expense_id UUID NOT NULL REFERENCES expenses(id) ON DELETE CASCADE,
  group_id UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  author_member_id UUID NOT NULL REFERENCES group_members(id),
  content TEXT NOT NULL CHECK (char_length(content) <= 2000),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

CREATE INDEX idx_comments_expense ON expense_comments(expense_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_comments_author ON expense_comments(author_member_id);
CREATE INDEX idx_comments_group ON expense_comments(group_id) WHERE deleted_at IS NULL;
```

---

### Feature 2: Reactions

#### Architecture
- Polymorphic `reactions` table supporting both expenses and settlements
- Toggle behavior (add if not exists, remove if exists)
- Aggregate counts returned with expense/settlement data

#### File Changes
| File | Change Type | Description |
|------|-------------|-------------|
| `src/db/schema/reactions.ts` | New | Reaction table definition |
| `src/db/schema/enums.ts` | Modify | Add reaction types enum |
| `src/routes/reactions.ts` | New | Reaction endpoints |
| `src/services/reaction.service.ts` | New | Reaction business logic |

#### Reaction Types Enum
```typescript
export const reactionTypes = pgEnum('reaction_type', [
  'thumbsUp',
  'thumbsDown',
  'heart',
  'laugh',
  'surprised',
  'angry'
]);
```

---

### Feature 3: Performance Improvements

#### Caching Strategy

**In-Memory Cache (MVP)**
```typescript
// Simple Map-based cache with TTL
class SimpleCache<T> {
  private cache = new Map<string, { value: T; expiresAt: number }>();

  set(key: string, value: T, ttlMs: number): void;
  get(key: string): T | undefined;
  invalidate(pattern: string): void;
}
```

**Cache Keys**
- `exchange-rates:{base}` - TTL: 15 min
- `group-summary:{groupId}` - TTL: 5 min
- `user-prefs:{userId}` - TTL: 10 min

#### Database Indexes
```sql
-- Priority indexes for common queries
CREATE INDEX IF NOT EXISTS idx_expenses_group_date ON expenses(group_id, expense_date DESC) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_settlements_group_status ON settlements(group_id, status);
CREATE INDEX IF NOT EXISTS idx_activity_group_timestamp ON activity_log(group_id, timestamp DESC);
```

---

## Task Breakdown

### Sprint 007 Cleanup (4 ACs)
| Task ID | Description | Estimate | Dependencies |
|---------|-------------|----------|--------------|
| TASK-001 | Create Sprint 007 retrospective | 1 | None |
| TASK-002 | Create Sprint 007 QA report | 1 | TASK-001 |
| TASK-003 | Update backlog with Sprint 007 | 0.5 | TASK-002 |

### Comments Feature (10 ACs)
| Task ID | Description | Estimate | Dependencies |
|---------|-------------|----------|--------------|
| TASK-004 | Create comments schema | 1 | None |
| TASK-005 | Create comment service | 2 | TASK-004 |
| TASK-006 | Create comment routes | 2 | TASK-005 |
| TASK-007 | Add comment notifications | 1 | TASK-006 |
| TASK-008 | Write comment unit tests | 1 | TASK-006 |

### Reactions Feature (8 ACs)
| Task ID | Description | Estimate | Dependencies |
|---------|-------------|----------|--------------|
| TASK-009 | Create reactions schema | 1 | None |
| TASK-010 | Create reaction service | 2 | TASK-009 |
| TASK-011 | Create reaction routes | 2 | TASK-010 |
| TASK-012 | Write reaction unit tests | 1 | TASK-011 |

### Performance Improvements (8 ACs)
| Task ID | Description | Estimate | Dependencies |
|---------|-------------|----------|--------------|
| TASK-013 | Implement simple cache service | 2 | None |
| TASK-014 | Add database indexes | 1 | None |
| TASK-015 | Optimize analytics queries | 1.5 | TASK-014 |
| TASK-016 | Add cache stats endpoint | 1 | TASK-013 |
| TASK-017 | Write performance tests | 1 | TASK-015 |

---

## Sprint Capacity

| Resource | Available Hours | Assigned Hours | Buffer |
|----------|-----------------|----------------|--------|
| Backend Dev | 40 | 21.5 | 18.5 |

**Notes:**
- Story points estimated at 1-2 hours each
- Buffer for code review and bug fixes
- Integration tests included in estimates

---

## Risk Assessment

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| Comment spam/abuse | Medium | Low | Rate limiting, content length limits |
| Cache bugs | Low | Medium | Thorough testing, simple TTL cache |
| Performance regression | Low | High | Baseline metrics before changes |

---

## Open Questions

1. Should comments support @mentions? (Deferred for now)
2. Maximum comment length? (Proposed: 2000 chars)
3. Should reactions be visible to all or just counts? (Proposed: show who reacted)

---

## Decisions Made

| Decision | Rationale | Alternatives Considered |
|----------|-----------|------------------------|
| Flat comments only | Simpler implementation, threaded can be added later | Threaded comments |
| In-memory cache | Sufficient for MVP, no Redis dependency | Redis |
| 6 reaction types | Common subset, expandable later | Emoji picker |

---

## Definition of Ready

- [x] All features have clear acceptance criteria
- [x] Technical approach documented
- [x] Dependencies identified
- [ ] Tasks estimated
- [ ] Risks assessed

---

## Approval

| Role | Status | Notes |
|------|--------|-------|
| Lead Developer | ⏳ Pending | Awaiting planning session |
