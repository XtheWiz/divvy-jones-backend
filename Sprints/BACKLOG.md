# Product Backlog

## Overview
This document contains all features and user stories prioritized for future sprints.

## Priority Legend
- **P0**: Critical - Must have for MVP
- **P1**: High - Important for core functionality
- **P2**: Medium - Nice to have
- **P3**: Low - Future consideration

---

## Backlog Items

### P0 - Critical (MVP)

#### ~~BL-001: User Authentication System~~ ✅ COMPLETE (Sprint 001)
**Description:** Implement user registration, login, and session management
**Acceptance Criteria:**
- [x] Users can register with email and password
- [x] Users can log in and receive JWT token
- [ ] Password reset functionality *(deferred)*
- [x] Session management with token refresh

#### ~~BL-002: Group Management~~ ✅ COMPLETE (Sprint 001 + 002)
**Description:** Create, join, and manage expense groups
**Acceptance Criteria:**
- [x] Create new groups with name and description
- [x] Invite members via join code
- [x] Manage group settings and permissions
- [x] Leave or delete groups

#### ~~BL-003: Expense Tracking~~ ✅ COMPLETE (Sprint 002 + 004)
**Description:** Add, edit, and categorize expenses within groups
**Acceptance Criteria:**
- [x] Add expenses with amount, description, category
- [x] Split expenses equally or custom amounts
- [x] Attach receipts/images to expenses *(Sprint 004)*
- [x] Edit and delete expenses

#### ~~BL-004: Settlement System~~ ✅ COMPLETE (Sprint 003)
**Description:** Calculate and track debt settlements between members
**Acceptance Criteria:**
- [x] Automatic debt calculation *(Sprint 002 - balance.service)*
- [x] Suggest optimal settlement paths *(Sprint 002 - simplifiedDebts)*
- [x] Mark settlements as paid *(Sprint 003)*
- [x] Settlement history *(Sprint 003)*

### P1 - High Priority

#### ~~BL-005: Multi-Currency Support~~ ✅ COMPLETE (Sprint 005)
**Description:** Handle expenses in multiple currencies
**Acceptance Criteria:**
- [x] Select currency per expense *(implemented)*
- [x] Automatic exchange rate conversion *(Sprint 005)*
- [x] Set default currency per group *(implemented)*
- [x] Currency list endpoint with live rates *(Sprint 005)*
- [x] Balance/settlement conversion to target currency *(Sprint 005)*

#### BL-006: Notifications 🔄 IN PROGRESS (Sprint 006)
**Description:** Real-time and push notifications for activities
**Acceptance Criteria:**
- [x] Expense added notifications *(Sprint 003)*
- [x] Settlement reminders *(Sprint 003)*
- [x] Group activity updates *(Sprint 003)*
- [ ] Configurable notification preferences *(Sprint 006)*
- [ ] Email notifications *(Sprint 006)*
- [ ] Push notifications *(deferred - requires mobile)*

### P2 - Medium Priority

#### BL-007: Reports & Analytics ✅ PARTIAL (Sprint 005)
**Description:** Generate spending reports and insights
**Acceptance Criteria:**
- [ ] Monthly/yearly spending summaries
- [ ] Category breakdown charts
- [x] Export reports (CSV) *(Sprint 005)*
- [x] Export reports (JSON) *(Sprint 005)*
- [ ] Export reports (PDF) *(deferred)*

#### BL-008: Recurring Expenses ⏳ BACKLOG
**Description:** Automate recurring expense entries
**Acceptance Criteria:**
- [ ] Set up recurring expenses (weekly/monthly)
- [ ] Automatic expense creation
- [ ] Manage recurring expense rules

### P3 - Low Priority

#### BL-009: Social Features ⏳ BACKLOG
**Description:** Comments, reactions on expenses
**Acceptance Criteria:**
- [ ] Comment on expenses
- [ ] React to settlements
- [ ] Activity feed

---

## Recently Completed

### Sprint 005 (2026-01-21)
| Item | Features Delivered |
|------|-------------------|
| BL-005 | Multi-Currency (exchange rate service, balance/settlement conversion, currencies endpoint) |
| BL-007 | Export Functionality (CSV export, JSON export with attachments) |
| Production | S3 Storage Provider, magic number validation, pre-commit hooks, README.md |

### Sprint 004 (2026-01-21)
| Item | Features Delivered |
|------|-------------------|
| BL-003 | Attachment System (expense & settlement attachments, file validation) |
| New | Activity Log (audit trail, filtering, pagination) |
| Tech Debt | Route parameter standardization, CI/CD workflow, CONTRIBUTING.md |

### Sprint 003 (2026-01-20)
| Item | Features Delivered |
|------|-------------------|
| BL-004 | Settlement System (create, confirm, reject, cancel, suggested) |
| BL-006 | Notification Foundation (in-app notifications, mark read) |
| Tech Debt | Test infrastructure, Drizzle ORM patterns, balance service fixes |

### Sprint 002 (2026-01-20)
| Item | Features Delivered |
|------|-------------------|
| BL-002 | Complete Group Management (edit, leave, delete, regenerate code) |
| BL-003 | Core Expense Tracking (CRUD, 4 split types, filtering) |
| BL-004 | Balance Calculation (debt simplification algorithm) |
| Tech Debt | Rate limiting, JWT prod check, dynamic imports fix |

### Sprint 001 (2026-01-20)
| Item | Features Delivered |
|------|-------------------|
| BL-001 | User Authentication (register, login, refresh, profile) |
| BL-002 | Basic Group Management (create, join, view, members) |

---

## Sprint Velocity

| Sprint | ACs Planned | ACs Delivered | Velocity |
|--------|-------------|---------------|----------|
| 001 | 36 | 36 | 100% |
| 002 | 72 | 67 | 93% |
| 003 | 55 | 55 | 100% |
| 004 | 47 | 47 | 100% |
| 005 | 35 | 35 | 100% |

**Average Velocity:** 98.6%

---

## Upcoming Sprint Candidates

### Sprint 006 (Active)
**Focus:** Technical Debt & Notifications
**Status:** Defined - Ready for Planning

1. **Technical Debt (P0)** - 10 ACs
   - Fix pre-existing TypeScript errors in Drizzle schema
   - Set up DATABASE_URL_TEST in CI
   - Add integration tests for Sprint 005 features

2. **BL-006 Completion (P1)** - 14 ACs
   - User preferences schema and API
   - Email notification service
   - Notification filtering by preferences

3. **Activity Log Archival (P2)** - 6 ACs
   - Archive table and archival process
   - Scheduled archival job

### Sprint 007 (Tentative)
1. **BL-007 Completion** - PDF export, analytics dashboard
2. **BL-008** - Recurring expenses
3. **Performance** - Caching, query optimization

### Sprint 008 (Future)
1. **BL-009** - Social features (comments, reactions)
2. **Push Notifications** - Mobile/web push (requires service worker)
3. **Mobile API** - Optimizations for mobile clients

---

## Notes
- Backlog is prioritized by Product Owner
- Items are refined during sprint planning
- Acceptance criteria must be clear before sprint start
- Password reset (BL-001) deferred indefinitely - low priority for MVP
