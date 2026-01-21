# Sprint 008 Task Board

## Legend
- **Status:** TODO | IN_PROGRESS | IN_REVIEW | DONE | BLOCKED
- **Priority:** P0 (Critical) | P1 (High) | P2 (Medium) | P3 (Low)

---

## Sprint 007 Cleanup

### TASK-001: Create Sprint 007 Retrospective
| Field | Value |
|-------|-------|
| **Status** | DONE |
| **Priority** | P0 |
| **Assignee** | Backend Dev |
| **ACs** | AC-0.1 |
| **Estimate** | 1h |

**Subtasks:**
- [x] Document what went well
- [x] Document what could be improved
- [x] Identify action items

---

### TASK-002: Create Sprint 007 QA Report
| Field | Value |
|-------|-------|
| **Status** | DONE |
| **Priority** | P0 |
| **Assignee** | QA |
| **ACs** | AC-0.2 |
| **Estimate** | 1h |
| **Dependencies** | TASK-001 |

**Subtasks:**
- [x] Verify all Sprint 007 ACs
- [x] Document test results
- [x] Sign off on features

---

### TASK-003: Update Backlog
| Field | Value |
|-------|-------|
| **Status** | DONE |
| **Priority** | P0 |
| **Assignee** | PO |
| **ACs** | AC-0.3, AC-0.4 |
| **Estimate** | 0.5h |
| **Dependencies** | TASK-002 |

**Subtasks:**
- [x] Mark Sprint 007 items complete
- [x] Update velocity metrics

---

## Comments Feature

### TASK-004: Create Comments Schema
| Field | Value |
|-------|-------|
| **Status** | DONE |
| **Priority** | P1 |
| **Assignee** | Backend Dev |
| **ACs** | AC-1.1, AC-1.2, AC-1.3 |
| **Estimate** | 1h |

**Subtasks:**
- [x] Define expense_comments table in Drizzle
- [x] Add indexes
- [x] Generate migration

---

### TASK-005: Create Comment Service
| Field | Value |
|-------|-------|
| **Status** | DONE |
| **Priority** | P1 |
| **Assignee** | Backend Dev |
| **ACs** | AC-1.4, AC-1.5, AC-1.6, AC-1.7, AC-1.8 |
| **Estimate** | 2h |
| **Dependencies** | TASK-004 |

**Subtasks:**
- [x] Create comment.service.ts
- [x] Implement createComment
- [x] Implement listComments (paginated)
- [x] Implement updateComment
- [x] Implement deleteComment (soft delete)
- [x] Add author ownership check

---

### TASK-006: Create Comment Routes
| Field | Value |
|-------|-------|
| **Status** | DONE |
| **Priority** | P1 |
| **Assignee** | Backend Dev |
| **ACs** | AC-1.4, AC-1.5, AC-1.6, AC-1.7 |
| **Estimate** | 2h |
| **Dependencies** | TASK-005 |

**Subtasks:**
- [x] Create comments.ts route file
- [x] POST /comments endpoint
- [x] GET /comments endpoint with pagination
- [x] PUT /comments/:commentId endpoint
- [x] DELETE /comments/:commentId endpoint
- [x] Add to routes index

---

### TASK-007: Add Comment Notifications
| Field | Value |
|-------|-------|
| **Status** | DONE |
| **Priority** | P1 |
| **Assignee** | Backend Dev |
| **ACs** | AC-1.9, AC-1.10 |
| **Estimate** | 1h |
| **Dependencies** | TASK-006 |

**Subtasks:**
- [x] Create COMMENT_ADDED notification type
- [x] Notify expense participants on new comment
- [x] Include comment preview in notification

---

### TASK-008: Write Comment Unit Tests
| Field | Value |
|-------|-------|
| **Status** | DONE |
| **Priority** | P1 |
| **Assignee** | Backend Dev |
| **ACs** | All Feature 1 ACs |
| **Estimate** | 1h |
| **Dependencies** | TASK-006 |

**Subtasks:**
- [x] Test comment CRUD operations
- [x] Test authorization (owner-only edit/delete)
- [x] Test pagination

---

## Reactions Feature

### TASK-009: Create Reactions Schema
| Field | Value |
|-------|-------|
| **Status** | DONE |
| **Priority** | P2 |
| **Assignee** | Backend Dev |
| **ACs** | AC-2.1, AC-2.2, AC-2.7, AC-2.8 |
| **Estimate** | 1h |

**Subtasks:**
- [x] Add reaction_type enum
- [x] Define reactions table
- [x] Add unique constraint
- [x] Generate migration

---

### TASK-010: Create Reaction Service
| Field | Value |
|-------|-------|
| **Status** | DONE |
| **Priority** | P2 |
| **Assignee** | Backend Dev |
| **ACs** | AC-2.3, AC-2.4, AC-2.5, AC-2.6 |
| **Estimate** | 2h |
| **Dependencies** | TASK-009 |

**Subtasks:**
- [x] Create reaction.service.ts
- [x] Implement toggleReaction (add/remove)
- [x] Implement removeReaction
- [x] Implement getReactionCounts
- [x] Support both expenses and settlements

---

### TASK-011: Create Reaction Routes
| Field | Value |
|-------|-------|
| **Status** | DONE |
| **Priority** | P2 |
| **Assignee** | Backend Dev |
| **ACs** | AC-2.3, AC-2.4, AC-2.5, AC-2.6 |
| **Estimate** | 2h |
| **Dependencies** | TASK-010 |

**Subtasks:**
- [x] Create reactions.ts route file
- [x] POST /expenses/:id/reactions endpoint
- [x] DELETE /expenses/:id/reactions/:type endpoint
- [x] Add similar routes for settlements
- [x] Include reactions in expense/settlement responses

---

### TASK-012: Write Reaction Unit Tests
| Field | Value |
|-------|-------|
| **Status** | DONE |
| **Priority** | P2 |
| **Assignee** | Backend Dev |
| **ACs** | All Feature 2 ACs |
| **Estimate** | 1h |
| **Dependencies** | TASK-011 |

**Subtasks:**
- [x] Test toggle behavior
- [x] Test unique constraint
- [x] Test reaction counts

---

## Performance Improvements

### TASK-013: Implement Simple Cache Service
| Field | Value |
|-------|-------|
| **Status** | DONE |
| **Priority** | P2 |
| **Assignee** | Backend Dev |
| **ACs** | AC-3.1, AC-3.2, AC-3.3 |
| **Estimate** | 2h |

**Subtasks:**
- [x] Create cache.service.ts with TTL support
- [x] Add set, get, invalidate methods
- [x] Integrate with exchange rate service
- [x] Add group summary caching

---

### TASK-014: Add Database Indexes
| Field | Value |
|-------|-------|
| **Status** | DONE |
| **Priority** | P2 |
| **Assignee** | Backend Dev |
| **ACs** | AC-3.5 |
| **Estimate** | 1h |

**Subtasks:**
- [x] Analyze slow queries
- [x] Add indexes for expenses, settlements, activity
- [x] Test query performance

---

### TASK-015: Optimize Analytics Queries
| Field | Value |
|-------|-------|
| **Status** | DONE |
| **Priority** | P2 |
| **Assignee** | Backend Dev |
| **ACs** | AC-3.6, AC-3.7, AC-3.8 |
| **Estimate** | 1.5h |
| **Dependencies** | TASK-014 |

**Subtasks:**
- [x] Review analytics service queries
- [x] Implement efficient aggregations
- [x] Consider cursor-based pagination
- [x] Fix any N+1 issues

---

### TASK-016: Add Cache Stats Endpoint
| Field | Value |
|-------|-------|
| **Status** | DONE |
| **Priority** | P2 |
| **Assignee** | Backend Dev |
| **ACs** | AC-3.4 |
| **Estimate** | 1h |
| **Dependencies** | TASK-013 |

**Subtasks:**
- [x] GET /admin/cache/stats endpoint
- [x] Return hit/miss counts, memory usage
- [x] Admin-only authorization

---

### TASK-017: Write Performance Tests
| Field | Value |
|-------|-------|
| **Status** | DONE |
| **Priority** | P2 |
| **Assignee** | Backend Dev |
| **ACs** | All Feature 3 ACs |
| **Estimate** | 1h |
| **Dependencies** | TASK-015, TASK-016 |

**Subtasks:**
- [x] Test cache service operations
- [x] Verify index improvements
- [x] Test cache invalidation

---

## Summary

| Category | Tasks | Total Estimate |
|----------|-------|----------------|
| Sprint Cleanup | 3 | 2.5h |
| Comments | 5 | 7h |
| Reactions | 4 | 6h |
| Performance | 5 | 6.5h |
| **Total** | **17** | **22h** |

---

## Sprint Burndown

| Day | Tasks Remaining | Points Remaining |
|-----|-----------------|------------------|
| Start | 17 | 22 |
| Day 1 | - | - |
| Day 2 | - | - |
| Day 3 | - | - |
| Day 4 | - | - |
| Day 5 | - | - |
