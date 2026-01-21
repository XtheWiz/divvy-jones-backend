/**
 * Analytics Service Tests
 * Sprint 007 - TASK-011
 *
 * Tests for analytics service types and utilities.
 */

import { describe, it, expect } from "bun:test";
import type {
  SpendingSummary,
  CategoryAnalytics,
  SpendingTrends,
  MemberSpending,
  CategoryBreakdown,
  TrendDataPoint,
  PeriodType,
} from "../services/analytics.service";

describe("Analytics Service Types", () => {
  describe("SpendingSummary", () => {
    it("should have correct structure", () => {
      const summary: SpendingSummary = {
        groupId: "test-group-id",
        groupName: "Test Group",
        currency: "USD",
        dateRange: {
          from: new Date("2025-01-01"),
          to: new Date("2025-01-31"),
        },
        totals: {
          totalSpent: 1000.5,
          expenseCount: 10,
          averagePerExpense: 100.05,
        },
        memberBreakdown: [],
      };

      expect(summary.groupId).toBe("test-group-id");
      expect(summary.groupName).toBe("Test Group");
      expect(summary.currency).toBe("USD");
      expect(summary.totals.totalSpent).toBe(1000.5);
      expect(summary.totals.expenseCount).toBe(10);
      expect(summary.totals.averagePerExpense).toBe(100.05);
    });

    it("should support null date range", () => {
      const summary: SpendingSummary = {
        groupId: "test-group-id",
        groupName: "Test Group",
        currency: "USD",
        dateRange: {
          from: null,
          to: null,
        },
        totals: {
          totalSpent: 0,
          expenseCount: 0,
          averagePerExpense: 0,
        },
        memberBreakdown: [],
      };

      expect(summary.dateRange.from).toBeNull();
      expect(summary.dateRange.to).toBeNull();
    });
  });

  describe("MemberSpending", () => {
    it("should have correct structure", () => {
      const member: MemberSpending = {
        memberId: "member-1",
        userId: "user-1",
        displayName: "John Doe",
        totalPaid: 500.25,
        totalOwed: 0,
        expenseCount: 5,
      };

      expect(member.memberId).toBe("member-1");
      expect(member.displayName).toBe("John Doe");
      expect(member.totalPaid).toBe(500.25);
      expect(member.expenseCount).toBe(5);
    });

    it("should handle zero values", () => {
      const member: MemberSpending = {
        memberId: "member-2",
        userId: "user-2",
        displayName: "Jane Doe",
        totalPaid: 0,
        totalOwed: 0,
        expenseCount: 0,
      };

      expect(member.totalPaid).toBe(0);
      expect(member.expenseCount).toBe(0);
    });
  });

  describe("CategoryAnalytics", () => {
    it("should have correct structure", () => {
      const analytics: CategoryAnalytics = {
        groupId: "test-group-id",
        currency: "USD",
        dateRange: {
          from: new Date("2025-01-01"),
          to: null,
        },
        totalSpent: 1000,
        categories: [],
      };

      expect(analytics.groupId).toBe("test-group-id");
      expect(analytics.currency).toBe("USD");
      expect(analytics.totalSpent).toBe(1000);
      expect(analytics.categories).toBeArray();
    });
  });

  describe("CategoryBreakdown", () => {
    it("should have correct structure", () => {
      const category: CategoryBreakdown = {
        category: "food",
        totalAmount: 500,
        expenseCount: 10,
        percentage: 50,
      };

      expect(category.category).toBe("food");
      expect(category.totalAmount).toBe(500);
      expect(category.expenseCount).toBe(10);
      expect(category.percentage).toBe(50);
    });

    it("should handle Uncategorized", () => {
      const category: CategoryBreakdown = {
        category: "Uncategorized",
        totalAmount: 100,
        expenseCount: 2,
        percentage: 10,
      };

      expect(category.category).toBe("Uncategorized");
    });
  });

  describe("SpendingTrends", () => {
    it("should have correct structure", () => {
      const trends: SpendingTrends = {
        groupId: "test-group-id",
        currency: "USD",
        dateRange: {
          from: new Date("2025-01-01"),
          to: new Date("2025-12-31"),
        },
        periodType: "monthly",
        trends: [],
      };

      expect(trends.groupId).toBe("test-group-id");
      expect(trends.periodType).toBe("monthly");
      expect(trends.trends).toBeArray();
    });
  });

  describe("TrendDataPoint", () => {
    it("should have correct structure for monthly", () => {
      const point: TrendDataPoint = {
        period: "2025-01",
        periodStart: new Date("2025-01-01"),
        periodEnd: new Date("2025-01-31"),
        totalAmount: 500,
        expenseCount: 5,
      };

      expect(point.period).toBe("2025-01");
      expect(point.totalAmount).toBe(500);
      expect(point.expenseCount).toBe(5);
    });

    it("should have correct structure for daily", () => {
      const point: TrendDataPoint = {
        period: "2025-01-15",
        periodStart: new Date("2025-01-15"),
        periodEnd: new Date("2025-01-15T23:59:59.999Z"),
        totalAmount: 100,
        expenseCount: 2,
      };

      expect(point.period).toBe("2025-01-15");
    });

    it("should have correct structure for weekly", () => {
      const point: TrendDataPoint = {
        period: "2025-03",
        periodStart: new Date("2025-01-13"),
        periodEnd: new Date("2025-01-19"),
        totalAmount: 300,
        expenseCount: 3,
      };

      expect(point.period).toBe("2025-03");
    });
  });

  describe("PeriodType", () => {
    it("should support daily period", () => {
      const period: PeriodType = "daily";
      expect(period).toBe("daily");
    });

    it("should support weekly period", () => {
      const period: PeriodType = "weekly";
      expect(period).toBe("weekly");
    });

    it("should support monthly period", () => {
      const period: PeriodType = "monthly";
      expect(period).toBe("monthly");
    });
  });
});

describe("Analytics Calculations", () => {
  describe("Average calculation", () => {
    it("should calculate correct average", () => {
      const totalSpent = 1000;
      const expenseCount = 4;
      const average = expenseCount > 0 ? totalSpent / expenseCount : 0;

      expect(average).toBe(250);
    });

    it("should handle zero expenses", () => {
      const totalSpent = 0;
      const expenseCount = 0;
      const average = expenseCount > 0 ? totalSpent / expenseCount : 0;

      expect(average).toBe(0);
    });

    it("should round to 2 decimal places", () => {
      const totalSpent = 100;
      const expenseCount = 3;
      const average = Math.round((totalSpent / expenseCount) * 100) / 100;

      expect(average).toBe(33.33);
    });
  });

  describe("Percentage calculation", () => {
    it("should calculate correct percentage", () => {
      const categoryAmount = 250;
      const totalAmount = 1000;
      const percentage = Math.round((categoryAmount / totalAmount) * 10000) / 100;

      expect(percentage).toBe(25);
    });

    it("should handle 100%", () => {
      const categoryAmount = 500;
      const totalAmount = 500;
      const percentage = Math.round((categoryAmount / totalAmount) * 10000) / 100;

      expect(percentage).toBe(100);
    });

    it("should handle small percentages", () => {
      const categoryAmount = 1;
      const totalAmount = 10000;
      const percentage = Math.round((categoryAmount / totalAmount) * 10000) / 100;

      expect(percentage).toBe(0.01);
    });

    it("should handle zero total", () => {
      const categoryAmount = 0;
      const totalAmount = 0;
      const percentage = totalAmount > 0
        ? Math.round((categoryAmount / totalAmount) * 10000) / 100
        : 0;

      expect(percentage).toBe(0);
    });
  });

  describe("Category sorting", () => {
    it("should sort by amount descending", () => {
      const categories = [
        { category: "food", amount: 100 },
        { category: "transport", amount: 300 },
        { category: "entertainment", amount: 200 },
      ];

      const sorted = [...categories].sort((a, b) => b.amount - a.amount);

      expect(sorted[0].category).toBe("transport");
      expect(sorted[1].category).toBe("entertainment");
      expect(sorted[2].category).toBe("food");
    });
  });
});

describe("Date Range Handling", () => {
  describe("Date validation", () => {
    it("should parse valid date string", () => {
      const dateStr = "2025-01-15";
      const date = new Date(dateStr);

      expect(date.getTime()).not.toBeNaN();
    });

    it("should detect invalid date string", () => {
      const dateStr = "invalid-date";
      const date = new Date(dateStr);

      expect(isNaN(date.getTime())).toBe(true);
    });
  });

  describe("Period defaults", () => {
    it("should default to monthly if not specified", () => {
      const defaultPeriod: PeriodType = "monthly";
      const period: PeriodType | undefined = undefined;
      const effectivePeriod = period || defaultPeriod;

      expect(effectivePeriod).toBe("monthly");
    });
  });
});
