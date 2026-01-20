# Sprint 005 Planning

## Planning Session

| Field | Value |
|-------|-------|
| **Sprint** | 005 |
| **Planning Date** | 2026-01-21 |
| **Led By** | Lead Developer (Claude) |
| **Participants** | PO, Lead Dev, Backend Dev, QA |

---

## Sprint Goal Review

> Make the application production-ready with cloud storage support, enhance developer experience with better tooling, and extend functionality with automatic currency exchange rates.

**Goal Alignment:** This sprint addresses critical production blockers (S3 storage, file security) while adding high-value user features (currency conversion, data export).

---

## Feature Analysis

### Feature 0: Production Readiness & Developer Experience

**Technical Decisions:**

#### S3 Storage Provider
- **Package:** `@aws-sdk/client-s3` (official AWS SDK v3)
- **Architecture:** Implement `S3StorageProvider` class following existing `StorageProvider` interface
- **Pre-signed URLs:** Use `@aws-sdk/s3-request-presigner` for secure download URLs
- **Configuration:** Environment-based provider selection (`STORAGE_PROVIDER=local|s3`)

```typescript
// Storage provider selection pattern
function createStorageProvider(): StorageProvider {
  const provider = process.env.STORAGE_PROVIDER || 'local';
  switch (provider) {
    case 's3':
      return new S3StorageProvider({
        bucket: process.env.AWS_S3_BUCKET!,
        region: process.env.AWS_S3_REGION!,
      });
    default:
      return new LocalStorageProvider(process.env.UPLOAD_DIR || './uploads');
  }
}
```

#### Magic Number Validation
- **Package:** `file-type` (lightweight, well-maintained)
- **Integration Point:** Add validation step in `uploadEvidence` before storage
- **Supported Types:** PNG, JPEG, PDF (extensible for future types)
- **Fallback:** Allow text-based files (CSV, JSON) that don't have magic numbers

```typescript
// Magic number validation pattern
import { fileTypeFromBuffer } from 'file-type';

async function validateFileContent(buffer: Buffer, declaredMime: string): Promise<boolean> {
  const detected = await fileTypeFromBuffer(buffer);

  // Text files don't have magic numbers
  if (!detected && isTextMimeType(declaredMime)) {
    return true;
  }

  return detected?.mime === declaredMime;
}
```

#### Developer Experience
- **Package:** `husky` for git hooks
- **Test DB Script:** Shell script using `psql` or Bun's database utilities
- **Pre-commit Checks:**
  1. TypeScript type checking (`bun run typecheck`)
  2. Route parameter naming convention (custom regex script)

---

### Feature 1: Multi-Currency Exchange Rates

**Technical Decisions:**

#### Exchange Rate Service
- **API:** exchangerate-api.com (free tier: 1500 requests/month)
- **Alternative:** Open Exchange Rates (for higher volume)
- **Caching:** In-memory Map with 1-hour TTL (3600000ms)
- **Fallback:** Store last successful rates in memory, use on API failure

```typescript
// Exchange rate service architecture
interface ExchangeRateService {
  getRate(from: string, to: string): Promise<number>;
  convert(amount: number, from: string, to: string): Promise<ConvertedAmount>;
  getSupportedCurrencies(): string[];
  getLastUpdated(): Date | null;
}

interface CachedRates {
  rates: Record<string, number>; // Base currency: USD
  timestamp: number;
  expiresAt: number;
}
```

#### Balance Conversion
- **Approach:** Convert all balances to target currency at time of request
- **Response Enhancement:** Include `conversionRate` and `rateTimestamp` fields
- **Default Behavior:** No conversion when `currency` param omitted

#### Supported Currencies
- Major currencies: USD, EUR, GBP, JPY, CAD, AUD, CHF, CNY
- Store as enum/constant for validation
- Extensible via configuration

---

### Feature 2: Export Functionality

**Technical Decisions:**

#### CSV Export
- **No External Package:** Use native string building (CSV is simple format)
- **Columns:** date, description, amount, currency, payer_name, payer_email, splits (JSON)
- **Filtering:** Query parameters `startDate`, `endDate`
- **Response Headers:** `Content-Type: text/csv`, `Content-Disposition: attachment`

```typescript
// CSV generation pattern
function generateCSV(expenses: ExpenseWithDetails[]): string {
  const headers = ['Date', 'Description', 'Amount', 'Currency', 'Payer', 'Payer Email', 'Splits'];
  const rows = expenses.map(e => [
    e.createdAt.toISOString().split('T')[0],
    escapeCSV(e.description),
    e.amount.toString(),
    e.currency,
    e.payer.name,
    e.payer.email,
    JSON.stringify(e.splits)
  ]);
  return [headers, ...rows].map(row => row.join(',')).join('\n');
}
```

#### JSON Export
- **Structure:** Full expense objects with nested payer and splits
- **Metadata:** Include export timestamp, group info, date range
- **Response:** Standard JSON with `Content-Disposition: attachment`

---

## Architecture Notes

### Directory Structure Changes

```
src/
├── services/
│   ├── storage/
│   │   ├── storage.provider.ts      # Interface (existing)
│   │   ├── local.storage.ts         # LocalStorageProvider (existing)
│   │   ├── s3.storage.ts            # NEW: S3StorageProvider
│   │   └── index.ts                 # NEW: Provider factory
│   ├── currency/
│   │   ├── exchange-rate.service.ts # NEW: Exchange rate fetching & caching
│   │   └── currency.constants.ts    # NEW: Supported currencies
│   └── export/
│       ├── csv.service.ts           # NEW: CSV generation
│       └── json.service.ts          # NEW: JSON export formatting
├── routes/
│   ├── currencies.routes.ts         # NEW: Currency list endpoint
│   └── export.routes.ts             # NEW: Export endpoints
└── utils/
    └── file-validation.ts           # NEW: Magic number validation
```

### New Dependencies

| Package | Version | Purpose |
|---------|---------|---------|
| `@aws-sdk/client-s3` | ^3.x | S3 operations |
| `@aws-sdk/s3-request-presigner` | ^3.x | Pre-signed URLs |
| `file-type` | ^19.x | Magic number detection |
| `husky` | ^9.x | Git hooks |

### Environment Variables

```env
# Storage Configuration
STORAGE_PROVIDER=local|s3
UPLOAD_DIR=./uploads

# S3 Configuration (when STORAGE_PROVIDER=s3)
AWS_S3_BUCKET=divvy-jones-uploads
AWS_S3_REGION=us-east-1
AWS_ACCESS_KEY_ID=<key>
AWS_SECRET_ACCESS_KEY=<secret>
AWS_S3_URL_EXPIRY=3600

# Exchange Rate API
EXCHANGE_RATE_API_KEY=<key>
EXCHANGE_RATE_CACHE_TTL=3600000

# Test Database
DATABASE_URL_TEST=postgresql://test:test@localhost:5433/divvy_jones_test
```

---

## Task Breakdown Strategy

### Phase 1: Foundation (Feature 0 - Production Readiness)
1. S3 storage provider implementation
2. Magic number validation
3. Test database scripts
4. Pre-commit hooks
5. Documentation updates

### Phase 2: Currency Feature (Feature 1)
6. Exchange rate service with caching
7. Currency conversion utilities
8. Balance endpoint enhancement
9. Settlement conversion
10. Currencies endpoint

### Phase 3: Export Feature (Feature 2)
11. CSV export service
12. JSON export service
13. Export routes with authorization
14. Date range filtering

### Phase 4: Testing & QA
15. Unit tests for new services
16. Integration tests for new endpoints
17. Final review and QA sign-off

---

## Risk Assessment

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| Exchange rate API downtime | Medium | Low | Cache + fallback to last known rates |
| S3 permission issues | Low | High | Thorough IAM policy documentation |
| Magic number false negatives | Low | Medium | Whitelist text-based MIME types |
| Pre-commit hook slowness | Medium | Low | Only run typecheck on changed files |

---

## Dependencies Between Tasks

```
TASK-001 (S3 Provider) ─────┐
TASK-002 (Magic Numbers) ───┼─→ TASK-005 (Docs)
TASK-003 (Test DB) ─────────┤
TASK-004 (Pre-commit) ──────┘

TASK-006 (Exchange Service) ─┬─→ TASK-008 (Balance Conversion)
TASK-007 (Currency Utils) ───┼─→ TASK-009 (Settlement Conversion)
                             └─→ TASK-010 (Currencies Endpoint)

TASK-011 (CSV Service) ─┬─→ TASK-013 (Export Routes)
TASK-012 (JSON Service) ┘

All Features ─→ TASK-014 (Unit Tests) ─→ TASK-015 (Integration Tests) ─→ TASK-016 (Final Review)
```

---

## Questions Resolved

| Question | Decision | Rationale |
|----------|----------|-----------|
| Which exchange rate API? | exchangerate-api.com | Free tier sufficient, simple API |
| S3 SDK version? | v3 | Modern, modular, tree-shakeable |
| CSV library? | None (native) | Simple format, no dependencies needed |
| Pre-commit tool? | Husky | Industry standard, good Bun support |

---

## Notes

- S3 provider should be backward compatible with existing evidence system
- Exchange rates cached at application level (not database) for simplicity
- Export endpoints follow existing authorization patterns (group membership)
- Pre-commit hooks optional for local dev (can be bypassed with `--no-verify`)

---

## Sign-Off

| Role | Status |
|------|--------|
| Lead Developer | ✅ Planning Complete |
| Project Owner | ⏳ Pending Review |
