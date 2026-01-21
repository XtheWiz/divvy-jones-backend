/**
 * Analytics Service
 * Sprint 007 - TASK-007, TASK-008, TASK-009
 * Sprint 008 - TASK-013: Added caching support
 *
 * Service for generating spending analytics for groups.
 *
 * AC-2.1: GET /groups/:groupId/analytics/summary returns spending summary
 * AC-2.2: Summary includes total spent, average per expense, expense count
 * AC-2.3: Summary includes per-member spending breakdown
 * AC-2.4: Summary supports date range filtering (from, to)
 * AC-2.5: Summary supports period grouping (daily, weekly, monthly)
 * AC-2.6: GET /groups/:groupId/analytics/categories returns category breakdown
 * AC-2.7: Category breakdown shows amount and percentage per category
 * AC-2.8: Categories sorted by total amount descending
 * AC-2.9: GET /groups/:groupId/analytics/trends returns spending trends
 * AC-2.10: Trends show spending over time for the requested period
 *
 * AC-3.2: Group summary data can be cached with configurable TTL
 * AC-3.3: Cache invalidation occurs on relevant data changes
 */

import {
  db,
  expenses,
  expensePayers,
  expenseItems,
  expenseItemMembers,
  groupMembers,
  users,
  groups,
} from "../db";
import { eq, and, isNull, gte, lte, sql, desc, asc } from "drizzle-orm";
import { getCacheService, CACHE_KEYS, CACHE_TTL } from "./cache.service";

// ============================================================================
// Types
// ============================================================================

export type PeriodType = "daily" | "weekly" | "monthly";

export interface AnalyticsOptions {
  groupId: string;
  dateFrom?: Date;
  dateTo?: Date;
  period?: PeriodType;
}

export interface MemberSpending {
  memberId: string;
  userId: string;
  displayName: string;
  totalPaid: number;
  totalOwed: number;
  expenseCount: number;
}

export interface SpendingSummary {
  groupId: string;
  groupName: string;
  currency: string;
  dateRange: {
    from: Date | null;
    to: Date | null;
  };
  totals: {
    totalSpent: number;
    expenseCount: number;
    averagePerExpense: number;
  };
  memberBreakdown: MemberSpending[];
}

export interface CategoryBreakdown {
  category: string;
  totalAmount: number;
  expenseCount: number;
  percentage: number;
}

export interface CategoryAnalytics {
  groupId: string;
  currency: string;
  dateRange: {
    from: Date | null;
    to: Date | null;
  };
  totalSpent: number;
  categories: CategoryBreakdown[];
}

export interface TrendDataPoint {
  period: string;
  periodStart: Date;
  periodEnd: Date;
  totalAmount: number;
  expenseCount: number;
}

export interface SpendingTrends {
  groupId: string;
  currency: string;
  dateRange: {
    from: Date | null;
    to: Date | null;
  };
  periodType: PeriodType;
  trends: TrendDataPoint[];
}

// ============================================================================
// Cache Helpers
// ============================================================================

/**
 * Generate date range string for cache key
 */
function getDateRangeKey(dateFrom?: Date, dateTo?: Date): string | undefined {
  if (!dateFrom && !dateTo) return undefined;
  const from = dateFrom?.toISOString().split("T")[0] || "start";
  const to = dateTo?.toISOString().split("T")[0] || "end";
  return `${from}_${to}`;
}

/**
 * Invalidate all analytics cache for a group
 * AC-3.3: Cache invalidation occurs on relevant data changes
 */
export function invalidateAnalyticsCache(groupId: string): void {
  const cache = getCacheService();
  cache.invalidatePrefix(`summary:${groupId}`);
  cache.invalidatePrefix(`categories:${groupId}`);
  cache.invalidatePrefix(`trends:${groupId}`);
}

// ============================================================================
// Summary Analytics (AC-2.1 to AC-2.5)
// ============================================================================

/**
 * Get spending summary for a group (with caching)
 * AC-2.1: Returns spending summary
 * AC-2.2: Includes total, average, count
 * AC-2.3: Includes per-member breakdown
 * AC-2.4: Supports date range filtering
 * AC-3.2: Cached with configurable TTL
 */
export async function getSpendingSummary(
  options: AnalyticsOptions & { skipCache?: boolean }
): Promise<SpendingSummary> {
  const { groupId, dateFrom, dateTo, skipCache } = options;
  const cache = getCacheService();
  const dateRangeKey = getDateRangeKey(dateFrom, dateTo);
  const cacheKey = CACHE_KEYS.groupSummary(groupId, dateRangeKey);

  // Check cache first (unless skipCache is true)
  if (!skipCache) {
    const cached = cache.get<SpendingSummary>(cacheKey);
    if (cached) {
      return cached;
    }
  }

  // Calculate fresh summary
  const summary = await calculateSpendingSummary(options);

  // Cache the result
  cache.set(cacheKey, summary, CACHE_TTL.GROUP_SUMMARY);

  return summary;
}

/**
 * Calculate spending summary (uncached)
 */
async function calculateSpendingSummary(
  options: AnalyticsOptions
): Promise<SpendingSummary> {
  const { groupId, dateFrom, dateTo } = options;

  // Get group info
  const [group] = await db
    .select({
      name: groups.name,
      currency: groups.defaultCurrencyCode,
    })
    .from(groups)
    .where(eq(groups.id, groupId))
    .limit(1);

  if (!group) {
    throw new Error("Group not found");
  }

  // Build query conditions
  const conditions = [eq(expenses.groupId, groupId), isNull(expenses.deletedAt)];

  if (dateFrom) {
    conditions.push(gte(expenses.expenseDate, dateFrom));
  }
  if (dateTo) {
    conditions.push(lte(expenses.expenseDate, dateTo));
  }

  // Get total spending stats
  const [totalsResult] = await db
    .select({
      totalSpent: sql<number>`COALESCE(SUM(${expenses.subtotal}), 0)`,
      expenseCount: sql<number>`COUNT(*)`,
    })
    .from(expenses)
    .where(and(...conditions));

  const totalSpent = Number(totalsResult?.totalSpent || 0);
  const expenseCount = Number(totalsResult?.expenseCount || 0);
  const averagePerExpense = expenseCount > 0 ? totalSpent / expenseCount : 0;

  // Get per-member spending breakdown (AC-2.3)
  const memberBreakdown = await getMemberSpendingBreakdown(
    groupId,
    dateFrom,
    dateTo
  );

  return {
    groupId,
    groupName: group.name,
    currency: group.currency || "USD",
    dateRange: {
      from: dateFrom || null,
      to: dateTo || null,
    },
    totals: {
      totalSpent: Math.round(totalSpent * 100) / 100,
      expenseCount,
      averagePerExpense: Math.round(averagePerExpense * 100) / 100,
    },
    memberBreakdown,
  };
}

/**
 * Get per-member spending breakdown
 * AC-2.3: Summary includes per-member spending breakdown
 *
 * Note: For analytics, we focus on payment data (who paid what).
 * For detailed balance calculations (who owes what), use balance.service.
 */
async function getMemberSpendingBreakdown(
  groupId: string,
  dateFrom?: Date,
  dateTo?: Date
): Promise<MemberSpending[]> {
  // Get all active group members
  const members = await db
    .select({
      memberId: groupMembers.id,
      userId: users.id,
      displayName: users.displayName,
    })
    .from(groupMembers)
    .innerJoin(users, eq(groupMembers.userId, users.id))
    .where(and(eq(groupMembers.groupId, groupId), isNull(groupMembers.leftAt)));

  // Build expense conditions
  const expenseConditions = [
    eq(expenses.groupId, groupId),
    isNull(expenses.deletedAt),
  ];

  if (dateFrom) {
    expenseConditions.push(gte(expenses.expenseDate, dateFrom));
  }
  if (dateTo) {
    expenseConditions.push(lte(expenses.expenseDate, dateTo));
  }

  // Get amount paid by each member
  const paidAmounts = await db
    .select({
      memberId: expensePayers.memberId,
      totalPaid: sql<number>`COALESCE(SUM(${expensePayers.amount}), 0)`,
      expenseCount: sql<number>`COUNT(DISTINCT ${expensePayers.expenseId})`,
    })
    .from(expensePayers)
    .innerJoin(expenses, eq(expensePayers.expenseId, expenses.id))
    .where(and(...expenseConditions))
    .groupBy(expensePayers.memberId);

  // Get share count by each member (how many expenses they participated in)
  const shareData = await db
    .select({
      memberId: expenseItemMembers.memberId,
      shareCount: sql<number>`COUNT(DISTINCT ${expenseItems.expenseId})`,
    })
    .from(expenseItemMembers)
    .innerJoin(expenseItems, eq(expenseItemMembers.itemId, expenseItems.id))
    .innerJoin(expenses, eq(expenseItems.expenseId, expenses.id))
    .where(and(...expenseConditions))
    .groupBy(expenseItemMembers.memberId);

  // Map amounts by member ID
  const paidByMember = new Map(paidAmounts.map((p) => [p.memberId, p]));
  const sharesByMember = new Map(shareData.map((s) => [s.memberId, s]));

  // Combine data for each member
  return members.map((member) => {
    const paid = paidByMember.get(member.memberId);
    const shares = sharesByMember.get(member.memberId);

    return {
      memberId: member.memberId,
      userId: member.userId,
      displayName: member.displayName,
      totalPaid: Math.round(Number(paid?.totalPaid || 0) * 100) / 100,
      totalOwed: 0, // Use balance.service for detailed debt calculations
      expenseCount: Number(paid?.expenseCount || shares?.shareCount || 0),
    };
  });
}

// ============================================================================
// Category Analytics (AC-2.6 to AC-2.8)
// ============================================================================

/**
 * Get category breakdown for a group (with caching)
 * AC-2.6: Returns category breakdown
 * AC-2.7: Shows amount and percentage per category
 * AC-2.8: Sorted by total amount descending
 * AC-3.2: Cached with configurable TTL
 */
export async function getCategoryAnalytics(
  options: AnalyticsOptions & { skipCache?: boolean }
): Promise<CategoryAnalytics> {
  const { groupId, dateFrom, dateTo, skipCache } = options;
  const cache = getCacheService();
  const dateRangeKey = getDateRangeKey(dateFrom, dateTo);
  const cacheKey = CACHE_KEYS.categoryAnalytics(groupId, dateRangeKey);

  // Check cache first
  if (!skipCache) {
    const cached = cache.get<CategoryAnalytics>(cacheKey);
    if (cached) {
      return cached;
    }
  }

  // Calculate fresh data
  const analytics = await calculateCategoryAnalytics(options);

  // Cache the result
  cache.set(cacheKey, analytics, CACHE_TTL.CATEGORY_ANALYTICS);

  return analytics;
}

/**
 * Calculate category analytics (uncached)
 */
async function calculateCategoryAnalytics(
  options: AnalyticsOptions
): Promise<CategoryAnalytics> {
  const { groupId, dateFrom, dateTo } = options;

  // Get group info
  const [group] = await db
    .select({
      currency: groups.defaultCurrencyCode,
    })
    .from(groups)
    .where(eq(groups.id, groupId))
    .limit(1);

  if (!group) {
    throw new Error("Group not found");
  }

  // Build query conditions
  const conditions = [eq(expenses.groupId, groupId), isNull(expenses.deletedAt)];

  if (dateFrom) {
    conditions.push(gte(expenses.expenseDate, dateFrom));
  }
  if (dateTo) {
    conditions.push(lte(expenses.expenseDate, dateTo));
  }

  // Get category breakdown (AC-2.6, AC-2.7, AC-2.8)
  const categoryData = await db
    .select({
      category: sql<string>`COALESCE(${expenses.category}, 'Uncategorized')`,
      totalAmount: sql<number>`COALESCE(SUM(${expenses.subtotal}), 0)`,
      expenseCount: sql<number>`COUNT(*)`,
    })
    .from(expenses)
    .where(and(...conditions))
    .groupBy(expenses.category)
    .orderBy(desc(sql`SUM(${expenses.subtotal})`)); // AC-2.8: Sort by amount desc

  // Calculate total for percentages
  const totalSpent = categoryData.reduce(
    (sum, c) => sum + Number(c.totalAmount),
    0
  );

  // Calculate percentages (AC-2.7)
  const categories: CategoryBreakdown[] = categoryData.map((c) => ({
    category: c.category,
    totalAmount: Math.round(Number(c.totalAmount) * 100) / 100,
    expenseCount: Number(c.expenseCount),
    percentage:
      totalSpent > 0
        ? Math.round((Number(c.totalAmount) / totalSpent) * 10000) / 100
        : 0,
  }));

  return {
    groupId,
    currency: group.currency || "USD",
    dateRange: {
      from: dateFrom || null,
      to: dateTo || null,
    },
    totalSpent: Math.round(totalSpent * 100) / 100,
    categories,
  };
}

// ============================================================================
// Trends Analytics (AC-2.9, AC-2.10)
// ============================================================================

/**
 * Get spending trends over time (with caching)
 * AC-2.9: Returns spending trends
 * AC-2.10: Shows spending over time for requested period
 * AC-3.2: Cached with configurable TTL
 */
export async function getSpendingTrends(
  options: AnalyticsOptions & { skipCache?: boolean }
): Promise<SpendingTrends> {
  const { groupId, dateFrom, dateTo, period = "monthly", skipCache } = options;
  const cache = getCacheService();
  const dateRangeKey = getDateRangeKey(dateFrom, dateTo);
  const cacheKey = CACHE_KEYS.spendingTrends(groupId, period, dateRangeKey);

  // Check cache first
  if (!skipCache) {
    const cached = cache.get<SpendingTrends>(cacheKey);
    if (cached) {
      return cached;
    }
  }

  // Calculate fresh data
  const trends = await calculateSpendingTrends(options);

  // Cache the result
  cache.set(cacheKey, trends, CACHE_TTL.GROUP_SUMMARY);

  return trends;
}

/**
 * Calculate spending trends (uncached)
 */
async function calculateSpendingTrends(
  options: AnalyticsOptions
): Promise<SpendingTrends> {
  const { groupId, dateFrom, dateTo, period = "monthly" } = options;

  // Get group info
  const [group] = await db
    .select({
      currency: groups.defaultCurrencyCode,
    })
    .from(groups)
    .where(eq(groups.id, groupId))
    .limit(1);

  if (!group) {
    throw new Error("Group not found");
  }

  // Determine date range - default to last 12 periods if not specified
  const effectiveDateTo = dateTo || new Date();
  let effectiveDateFrom = dateFrom;

  if (!effectiveDateFrom) {
    effectiveDateFrom = new Date(effectiveDateTo);
    switch (period) {
      case "daily":
        effectiveDateFrom.setDate(effectiveDateFrom.getDate() - 30);
        break;
      case "weekly":
        effectiveDateFrom.setDate(effectiveDateFrom.getDate() - 84); // 12 weeks
        break;
      case "monthly":
        effectiveDateFrom.setMonth(effectiveDateFrom.getMonth() - 12);
        break;
    }
  }

  // Build query conditions
  const conditions = [
    eq(expenses.groupId, groupId),
    isNull(expenses.deletedAt),
    gte(expenses.expenseDate, effectiveDateFrom),
    lte(expenses.expenseDate, effectiveDateTo),
  ];

  // Get period format for SQL
  let periodFormat: string;
  switch (period) {
    case "daily":
      periodFormat = "YYYY-MM-DD";
      break;
    case "weekly":
      periodFormat = "IYYY-IW"; // ISO week
      break;
    case "monthly":
    default:
      periodFormat = "YYYY-MM";
      break;
  }

  // Get spending by period
  // Note: periodFormat must be a literal string in SQL, not a bound parameter
  // Since periodFormat is derived from a fixed enum, this is safe from SQL injection
  const trendData = await db
    .select({
      period: sql<string>`TO_CHAR(${expenses.expenseDate}, ${sql.raw(`'${periodFormat}'`)})`,
      totalAmount: sql<number>`COALESCE(SUM(${expenses.subtotal}), 0)`,
      expenseCount: sql<number>`COUNT(*)`,
    })
    .from(expenses)
    .where(and(...conditions))
    .groupBy(sql`TO_CHAR(${expenses.expenseDate}, ${sql.raw(`'${periodFormat}'`)})`)
    .orderBy(asc(sql`TO_CHAR(${expenses.expenseDate}, ${sql.raw(`'${periodFormat}'`)})`));

  // Convert to trend data points with proper dates
  const trends: TrendDataPoint[] = trendData.map((t) => {
    const { periodStart, periodEnd } = getPeriodDates(t.period, period);

    return {
      period: t.period,
      periodStart,
      periodEnd,
      totalAmount: Math.round(Number(t.totalAmount) * 100) / 100,
      expenseCount: Number(t.expenseCount),
    };
  });

  return {
    groupId,
    currency: group.currency || "USD",
    dateRange: {
      from: effectiveDateFrom,
      to: effectiveDateTo,
    },
    periodType: period,
    trends,
  };
}

/**
 * Get start and end dates for a period string
 */
function getPeriodDates(
  periodStr: string,
  periodType: PeriodType
): { periodStart: Date; periodEnd: Date } {
  let periodStart: Date;
  let periodEnd: Date;

  switch (periodType) {
    case "daily": {
      // Format: YYYY-MM-DD
      periodStart = new Date(periodStr);
      periodEnd = new Date(periodStr);
      periodEnd.setHours(23, 59, 59, 999);
      break;
    }
    case "weekly": {
      // Format: YYYY-WW (ISO week)
      const [year, week] = periodStr.split("-").map(Number);
      periodStart = getDateOfISOWeek(week, year);
      periodEnd = new Date(periodStart);
      periodEnd.setDate(periodEnd.getDate() + 6);
      periodEnd.setHours(23, 59, 59, 999);
      break;
    }
    case "monthly":
    default: {
      // Format: YYYY-MM
      const [year, month] = periodStr.split("-").map(Number);
      periodStart = new Date(year, month - 1, 1);
      periodEnd = new Date(year, month, 0); // Last day of month
      periodEnd.setHours(23, 59, 59, 999);
      break;
    }
  }

  return { periodStart, periodEnd };
}

/**
 * Get the first day of an ISO week
 */
function getDateOfISOWeek(week: number, year: number): Date {
  const simple = new Date(year, 0, 1 + (week - 1) * 7);
  const dow = simple.getDay();
  const isoWeekStart = simple;

  if (dow <= 4) {
    isoWeekStart.setDate(simple.getDate() - simple.getDay() + 1);
  } else {
    isoWeekStart.setDate(simple.getDate() + 8 - simple.getDay());
  }

  return isoWeekStart;
}
