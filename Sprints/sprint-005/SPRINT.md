# Sprint 005 Definition

## Sprint Overview

| Field | Value |
|-------|-------|
| **Sprint Number** | 005 |
| **Sprint Goal** | Achieve production readiness with S3 storage, enhance security with file validation, and add multi-currency exchange rate support |
| **Defined By** | Project Owner (Claude) |
| **Definition Date** | 2026-01-21 |
| **Status** | Defined |

---

## Sprint Goal

> Make the application production-ready with cloud storage support, enhance developer experience with better tooling, and extend functionality with automatic currency exchange rates.

---

## Features

| # | Feature | Backlog ID | Priority | Estimated ACs |
|---|---------|------------|----------|---------------|
| 0 | Production Readiness & DX | Retro Items | P0 | 15 |
| 1 | Multi-Currency Exchange Rates | BL-005 | P1 | 12 |
| 2 | Export Functionality | BL-007 (partial) | P2 | 8 |
| | **Total** | | | **35** |

---

## Feature 0: Production Readiness & Developer Experience

**Priority:** P0 (Critical)
**Source:** Sprint 004 Retrospective Action Items

### Description
Address production deployment blockers and improve developer experience with better tooling and security enhancements.

### Acceptance Criteria

#### S3 Storage Provider (5 ACs)
| AC ID | Description |
|-------|-------------|
| AC-0.1 | S3StorageProvider implements StorageProvider interface |
| AC-0.2 | S3 uploads files with correct content type |
| AC-0.3 | S3 generates pre-signed URLs for downloads (configurable expiry) |
| AC-0.4 | S3 deletes files when evidence is deleted |
| AC-0.5 | Storage provider is selected via STORAGE_PROVIDER env variable |

#### File Security Enhancement (4 ACs)
| AC ID | Description |
|-------|-------------|
| AC-0.6 | Magic number validation verifies actual file content matches declared MIME type |
| AC-0.7 | PNG files validated by magic number (89 50 4E 47) |
| AC-0.8 | JPEG files validated by magic number (FF D8 FF) |
| AC-0.9 | PDF files validated by magic number (%PDF-) |

#### Developer Experience (4 ACs)
| AC ID | Description |
|-------|-------------|
| AC-0.10 | `bun run db:test:setup` creates and seeds test database |
| AC-0.11 | `bun run db:test:reset` drops and recreates test database |
| AC-0.12 | Pre-commit hook validates route parameter naming conventions |
| AC-0.13 | Pre-commit hook runs TypeScript type checking |

#### Environment Configuration (2 ACs)
| AC ID | Description |
|-------|-------------|
| AC-0.14 | .env.example updated with all S3 configuration variables |
| AC-0.15 | README.md updated with production deployment instructions |

---

## Feature 1: Multi-Currency Exchange Rates

**Priority:** P1 (High)
**Source:** BL-005 (Backlog)

### Description
Add automatic currency exchange rate conversion for expenses in different currencies. Users can view balances and settlements in their preferred currency.

### Acceptance Criteria

#### Exchange Rate Service (4 ACs)
| AC ID | Description |
|-------|-------------|
| AC-1.1 | Exchange rate service fetches rates from external API (e.g., exchangerate-api.com) |
| AC-1.2 | Exchange rates are cached for 1 hour to minimize API calls |
| AC-1.3 | Fallback to last known rates if API is unavailable |
| AC-1.4 | Service supports conversion between any two supported currencies |

#### Currency Conversion in Balances (4 ACs)
| AC ID | Description |
|-------|-------------|
| AC-1.5 | GET /groups/:groupId/balances accepts optional `currency` query parameter |
| AC-1.6 | When currency is specified, all balances converted to that currency |
| AC-1.7 | Conversion rate and timestamp included in response |
| AC-1.8 | Default behavior (no currency param) returns balances in original currencies |

#### Currency Conversion in Settlements (2 ACs)
| AC ID | Description |
|-------|-------------|
| AC-1.9 | Settlement suggestions can be displayed in a target currency |
| AC-1.10 | Original currency and converted amount both shown |

#### Supported Currencies (2 ACs)
| AC ID | Description |
|-------|-------------|
| AC-1.11 | Support major currencies: USD, EUR, GBP, JPY, CAD, AUD, CHF, CNY |
| AC-1.12 | Currency list endpoint: GET /currencies with current rates |

---

## Feature 2: Export Functionality

**Priority:** P2 (Medium)
**Source:** BL-007 (Backlog - partial)

### Description
Allow users to export group expense data for record-keeping and accounting purposes.

### Acceptance Criteria

#### CSV Export (4 ACs)
| AC ID | Description |
|-------|-------------|
| AC-2.1 | GET /groups/:groupId/export/csv exports expenses as CSV |
| AC-2.2 | CSV includes: date, description, amount, currency, payer, splits |
| AC-2.3 | CSV export can be filtered by date range |
| AC-2.4 | Filename includes group name and date range |

#### JSON Export (2 ACs)
| AC ID | Description |
|-------|-------------|
| AC-2.5 | GET /groups/:groupId/export/json exports full expense data |
| AC-2.6 | JSON includes all expense details including attachments metadata |

#### Export Authorization (2 ACs)
| AC ID | Description |
|-------|-------------|
| AC-2.7 | Only group members can export group data |
| AC-2.8 | Export includes only active (non-deleted) expenses |

---

## Technical Notes

### S3 Configuration
```
STORAGE_PROVIDER=s3
AWS_S3_BUCKET=divvy-jones-uploads
AWS_S3_REGION=us-east-1
AWS_ACCESS_KEY_ID=<key>
AWS_SECRET_ACCESS_KEY=<secret>
```

### Exchange Rate API
- Free tier: exchangerate-api.com (1500 requests/month)
- Alternative: Open Exchange Rates
- Cache rates in memory with 1-hour TTL

### Magic Number Reference
| Format | Magic Number (hex) |
|--------|-------------------|
| PNG | 89 50 4E 47 0D 0A 1A 0A |
| JPEG | FF D8 FF |
| PDF | 25 50 44 46 (%PDF) |
| HEIC | 66 74 79 70 68 65 69 63 (ftyp heic) |

### Pre-commit Hook
- Use Husky for git hooks
- Check: `bun run typecheck`
- Check: Custom script for `:entityId` parameter format in routes

---

## Dependencies

| Feature | External Dependency |
|---------|-------------------|
| S3 Storage | AWS SDK (@aws-sdk/client-s3) |
| Exchange Rates | exchangerate-api.com API |
| Magic Numbers | file-type npm package |
| Pre-commit | husky npm package |

---

## Risks and Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Exchange rate API rate limits | Medium | Cache aggressively, fallback to last known rates |
| S3 costs | Low | Use lifecycle policies, set upload size limits |
| Magic number false positives | Low | Allow override flag for edge cases |

---

## Out of Scope

The following items are explicitly NOT included in Sprint 005:
- Push notifications (deferred to Sprint 006)
- PDF export (deferred - requires PDF generation library)
- Activity log archival (deferred - not critical yet)
- Email notifications (deferred to Sprint 006)

---

## Sprint 004 Retro Items Status

| Action Item | Sprint 005 Status |
|-------------|-------------------|
| Implement S3StorageProvider | ✅ Included (Feature 0) |
| Add local test database setup script | ✅ Included (Feature 0) |
| Add magic number validation | ✅ Included (Feature 0) |
| Add pre-commit hook | ✅ Included (Feature 0) |
| Add activity log archival | ❌ Deferred |

---

## Definition of Done

- [x] All acceptance criteria verified (35/35 ACs validated)
- [x] Unit tests written for new services (182 new tests, 517 total)
- [ ] Integration tests for new endpoints (deferred - requires DATABASE_URL_TEST)
- [x] All existing tests pass (517 pass, 0 fail)
- [x] Code reviewed by Lead Developer (see REVIEW_LOG.md)
- [x] QA sign-off on all features (see QA_REPORT.md)
- [x] Documentation updated (README.md, .env.example)
- [x] No P0/P1 bugs open

**Status:** ✅ COMPLETE (7/8 criteria met, 1 deferred with justification)

---

## Approval

| Role | Status | Date |
|------|--------|------|
| Project Owner | ✅ Defined | 2026-01-21 |
| Lead Developer | ✅ Approved | 2026-01-21 |
| Backend Developer | ✅ Complete | 2026-01-21 |
| QA Engineer | ✅ Approved | 2026-01-21 |

**Sprint Status:** ✅ **COMPLETE - APPROVED FOR RELEASE**
