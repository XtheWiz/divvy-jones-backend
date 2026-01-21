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

#### ~~BL-001: User Authentication System~~ ✅ COMPLETE (Sprint 001 + 009)
**Description:** Implement user registration, login, and session management
**Acceptance Criteria:**
- [x] Users can register with email and password
- [x] Users can log in and receive JWT token
- [x] Password reset functionality *(Sprint 009)*
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

#### ~~BL-006: Notifications~~ ✅ COMPLETE (Sprint 003 + 006)
**Description:** Real-time and push notifications for activities
**Acceptance Criteria:**
- [x] Expense added notifications *(Sprint 003)*
- [x] Settlement reminders *(Sprint 003)*
- [x] Group activity updates *(Sprint 003)*
- [x] Configurable notification preferences *(Sprint 006)*
- [x] Email notifications *(Sprint 006)*
- [ ] Push notifications *(deferred - requires mobile)*

### P2 - Medium Priority

#### ~~BL-007: Reports & Analytics~~ ✅ COMPLETE (Sprint 005 + 007)
**Description:** Generate spending reports and insights
**Acceptance Criteria:**
- [x] Monthly/yearly spending summaries *(Sprint 007)*
- [x] Category breakdown charts *(Sprint 007)*
- [x] Export reports (CSV) *(Sprint 005)*
- [x] Export reports (JSON) *(Sprint 005)*
- [x] Export reports (PDF) *(Sprint 007)*

#### ~~BL-008: Recurring Expenses~~ ✅ COMPLETE (Sprint 007)
**Description:** Automate recurring expense entries
**Acceptance Criteria:**
- [x] Set up recurring expenses (weekly/monthly) *(Sprint 007)*
- [x] Automatic expense creation *(Sprint 007)*
- [x] Manage recurring expense rules *(Sprint 007)*

### P3 - Low Priority

#### ~~BL-009: Social Features~~ ✅ COMPLETE (Sprint 008)
**Description:** Comments, reactions on expenses
**Acceptance Criteria:**
- [x] Comment on expenses *(Sprint 008)*
- [x] React to expenses/settlements *(Sprint 008)*
- [x] Activity feed *(existing - enhanced)*

---

## Recently Completed

### Sprint 009 (2026-01-21) ✅ COMPLETE
| Item | Features Delivered |
|------|-------------------|
| BL-001 | Password Reset (forgot password, reset with token, session invalidation) |
| Feature | Integration Test Infrastructure (transaction isolation, app factory) |
| Feature | Authorization Middleware (requireGroupMember, requireGroupAdmin) |
| Feature | Rate Limiting (sliding window algorithm, configurable limits) |
| Tests | 50 new unit tests (859 total) |

### Sprint 008 (2026-01-21) ✅ COMPLETE
| Item | Features Delivered |
|------|-------------------|
| BL-009 | Social Features (comments on expenses, reactions on expenses/settlements) |
| Feature | Performance Improvements (caching service, optimized indexes, cache admin endpoints) |
| Tech Debt | Sprint 007 cleanup documentation |
| Tests | 145 new unit tests (809 total) |

### Sprint 007 (2026-01-21)
| Item | Features Delivered |
|------|-------------------|
| BL-007 | PDF Export (PDF generation service, export endpoint with date filtering) |
| BL-007 | Spending Analytics (summary endpoint, category breakdown, spending trends) |
| BL-008 | Recurring Expenses (schema, CRUD API, automated generation job) |
| Tech Debt | Sprint 006 cleanup documentation |

### Sprint 006 (2026-01-21)
| Item | Features Delivered |
|------|-------------------|
| BL-006 | User Preferences (notification settings, email notifications, filtering) |
| Feature | Email Service (SMTP provider, templates for expense/settlement notifications) |
| Feature | Activity Log Archival (archive schema, archival service, admin endpoints) |
| Tech Debt | CI improvements, integration tests for currencies/export |

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
| 006 | 30 | 30 | 100% |
| 007 | 34 | 34 | 100% |
| 008 | 30 | 30 | 100% |
| 009 | 36 | 36 | 100% |

**Average Velocity:** 99.2%
**Total ACs Delivered:** 370

---

## Upcoming Sprint Candidates

### Sprint 010 (Current)
**Focus:** User Security & Compliance

1. **Email Verification** - Verify new user email addresses
2. **OAuth/Social Login** - Google login integration
3. **Account Management** - GDPR compliance (deletion, data export)
4. **Database Migrations** - Proper migration workflow

### Sprint 011 (Future)
1. **Real-time Updates** - WebSocket for live notifications
2. **Push Notifications** - Mobile/web push (requires service worker)
3. **Group Roles** - Admin, member, viewer granular permissions
4. **Expense Templates** - Quick entry from saved templates
5. **Apple Sign In** - Additional OAuth provider

---

## Notes
- Backlog is prioritized by Product Owner
- Items are refined during sprint planning
- Acceptance criteria must be clear before sprint start
- All P0-P3 backlog items complete - now focusing on security and compliance features
