# Sprint 007 Planning

## Planning Overview

| Field | Value |
|-------|-------|
| **Sprint** | 007 |
| **Planning Date** | 2026-01-21 |
| **Lead Developer** | Claude (Lead Dev) |
| **Status** | Planning Complete |

---

## Architecture Decisions

### AD-001: PDF Generation Library Selection

**Decision:** Use `pdfkit` for PDF generation

**Rationale:**
1. **Lightweight** - No browser/headless Chrome dependency
2. **Server-side** - Runs natively in Node.js/Bun
3. **Flexible** - Full control over document layout
4. **Well-documented** - Extensive documentation and examples

**Alternatives Considered:**
- `puppeteer` - Too heavy, requires Chrome
- `pdf-lib` - Better for modifying existing PDFs
- `jspdf` - Browser-focused, less suitable for server

**Implementation:**
```typescript
import PDFDocument from 'pdfkit';

function generateExpenseReport(data: ReportData): Buffer {
  const doc = new PDFDocument();
  const chunks: Buffer[] = [];

  doc.on('data', (chunk) => chunks.push(chunk));

  // Add content...
  doc.fontSize(20).text('Expense Report', { align: 'center' });

  doc.end();
  return Buffer.concat(chunks);
}
```

---

### AD-002: Analytics Query Strategy

**Decision:** Use raw SQL queries with Drizzle for complex analytics

**Rationale:**
1. **Performance** - Window functions and aggregations are more efficient in SQL
2. **Flexibility** - Can optimize queries with EXPLAIN ANALYZE
3. **Maintainability** - SQL is readable and well-understood

**Implementation Pattern:**
```typescript
// src/services/analytics.service.ts
import { sql } from 'drizzle-orm';

async function getCategoryBreakdown(groupId: string, from?: Date, to?: Date) {
  return db.execute(sql`
    SELECT
      category,
      SUM(amount) as total,
      COUNT(*) as count
    FROM expenses
    WHERE group_id = ${groupId}
      AND deleted_at IS NULL
      ${from ? sql`AND created_at >= ${from}` : sql``}
      ${to ? sql`AND created_at <= ${to}` : sql``}
    GROUP BY category
    ORDER BY total DESC
  `);
}
```

---

### AD-003: Recurring Expense Scheduling

**Decision:** Use database-driven scheduling with `node-cron` trigger

**Rationale:**
1. **Reliability** - Rules stored in database survive restarts
2. **Scalability** - Can distribute generation across workers
3. **Flexibility** - Easy to modify rules without redeploying

**Schema Design:**
```typescript
// recurring_expenses table
{
  id: uuid,
  groupId: uuid,
  createdByMemberId: uuid,
  name: string,
  amount: decimal,
  currencyCode: string,
  category: string,
  splitType: enum,
  splits: jsonb,           // Pre-configured split percentages/amounts
  frequency: enum,         // daily, weekly, biweekly, monthly, yearly
  dayOfWeek: int,          // 0-6 for weekly
  dayOfMonth: int,         // 1-31 for monthly
  startDate: timestamp,
  endDate: timestamp,      // Optional end date
  nextOccurrence: timestamp,
  lastGenerated: timestamp,
  isActive: boolean,
  createdAt: timestamp,
  updatedAt: timestamp,
}
```

**Generation Logic:**
```typescript
// Runs via cron every hour (or on-demand)
async function generateDueRecurringExpenses() {
  const now = new Date();

  // Find all rules where nextOccurrence <= now and isActive
  const dueRules = await db
    .select()
    .from(recurringExpenses)
    .where(
      and(
        eq(recurringExpenses.isActive, true),
        lte(recurringExpenses.nextOccurrence, now)
      )
    );

  for (const rule of dueRules) {
    await generateExpenseFromRule(rule);
    await updateNextOccurrence(rule);
  }
}
```

---

## File Structure

### New Files to Create

```
src/
├── db/schema/
│   └── recurring.ts              # Recurring expenses schema
├── services/
│   ├── pdf.service.ts            # PDF generation
│   ├── analytics.service.ts      # Analytics queries
│   └── recurring.service.ts      # Recurring expense logic
├── routes/
│   ├── analytics.ts              # Analytics endpoints
│   └── recurring.ts              # Recurring expense endpoints
└── __tests__/
    ├── pdf.service.test.ts
    ├── analytics.service.test.ts
    └── recurring.service.test.ts
```

### Files to Modify

```
src/
├── db/
│   └── index.ts                  # Export new schema
├── routes/
│   ├── index.ts                  # Register new routes
│   └── export.ts                 # Add PDF export endpoint
└── services/
    └── index.ts                  # Export new services
```

---

## Implementation Phases

### Phase 1: Sprint 006 Cleanup (Day 1)
1. Create Sprint 006 RETROSPECTIVE.md
2. Create Sprint 006 QA_REPORT.md
3. Update BACKLOG.md

### Phase 2: PDF Export (Day 1-2)
1. Install pdfkit dependency
2. Create pdf.service.ts with report generation
3. Add PDF export endpoint to export.ts
4. Write unit tests

### Phase 3: Analytics (Day 2-3)
1. Create analytics.service.ts
2. Add analytics routes
3. Implement summary, categories, trends endpoints
4. Write unit tests

### Phase 4: Recurring Expenses (Day 3-4)
1. Create recurring expenses schema
2. Create recurring.service.ts
3. Add recurring expense routes
4. Implement generation job
5. Write unit tests

### Phase 5: Testing & QA (Day 5)
1. Integration tests
2. QA verification
3. Documentation updates

---

## Dependencies to Install

```bash
bun add pdfkit
bun add -d @types/pdfkit
```

---

## Database Changes

### New Table: recurring_expenses

```sql
CREATE TABLE recurring_expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  created_by_member_id UUID REFERENCES group_members(id),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  amount DECIMAL(12, 2) NOT NULL,
  currency_code VARCHAR(3) NOT NULL REFERENCES currencies(code),
  category VARCHAR(100),
  split_type VARCHAR(50) NOT NULL,
  splits JSONB,
  frequency VARCHAR(20) NOT NULL,
  day_of_week INTEGER,
  day_of_month INTEGER,
  month_of_year INTEGER,
  start_date TIMESTAMP WITH TIME ZONE NOT NULL,
  end_date TIMESTAMP WITH TIME ZONE,
  next_occurrence TIMESTAMP WITH TIME ZONE NOT NULL,
  last_generated TIMESTAMP WITH TIME ZONE,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_recurring_expenses_group_id ON recurring_expenses(group_id);
CREATE INDEX idx_recurring_expenses_next_occurrence ON recurring_expenses(next_occurrence)
  WHERE is_active = true;
```

---

## API Design

### PDF Export
```
GET /v1/groups/:groupId/export/pdf
Query: from, to (date range)
Response: application/pdf (binary)
```

### Analytics
```
GET /v1/groups/:groupId/analytics/summary
Query: from, to, period (daily|weekly|monthly)
Response: { totalSpent, avgPerExpense, expenseCount, memberBreakdown }

GET /v1/groups/:groupId/analytics/categories
Query: from, to
Response: { categories: [{ name, total, count, percentage }] }

GET /v1/groups/:groupId/analytics/trends
Query: from, to, period (daily|weekly|monthly)
Response: { periods: [{ date, total, count }] }
```

### Recurring Expenses
```
POST   /v1/groups/:groupId/recurring-expenses
GET    /v1/groups/:groupId/recurring-expenses
GET    /v1/groups/:groupId/recurring-expenses/:id
PUT    /v1/groups/:groupId/recurring-expenses/:id
DELETE /v1/groups/:groupId/recurring-expenses/:id

POST   /v1/admin/generate-recurring (manual trigger)
```

---

## Testing Strategy

### Unit Tests
- PDF generation with mock data
- Analytics calculations
- Recurring rule next occurrence calculation
- Date edge cases (Feb 29, month end)

### Integration Tests
- PDF export endpoint authorization
- Analytics endpoint with real data
- Recurring expense CRUD operations
- Generation job idempotency

---

## Risk Assessment

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| PDF generation memory issues with large reports | Low | Medium | Stream PDF generation, limit page count |
| Analytics queries slow | Medium | Medium | Add indexes, consider caching |
| Timezone issues in recurring | Medium | High | Store and use explicit timezone |
| Missed recurring generation | Low | Medium | Catch-up logic, manual trigger |

---

## Definition of Done Checklist

- [ ] All 34 acceptance criteria implemented
- [ ] Unit tests for all new services (>80% coverage)
- [ ] Integration tests pass
- [ ] TypeScript check passes
- [ ] Code reviewed
- [ ] Documentation updated
- [ ] No P0/P1 bugs

---

## Sign-Off

| Role | Name | Status |
|------|------|--------|
| Lead Developer | Claude (Lead Dev) | ✅ Planning Complete |
| Backend Developer | - | ⏳ Ready |
| QA Engineer | - | ⏳ Ready |
