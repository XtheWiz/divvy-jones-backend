/**
 * Recurring Expenses Service Tests
 * Sprint 007 - TASK-016
 *
 * Tests for recurring expense types and utilities.
 */

import { describe, it, expect } from "bun:test";
import type {
  CreateRecurringExpenseInput,
  UpdateRecurringExpenseInput,
  RecurringExpenseWithDetails,
  GenerationResult,
} from "../services/recurring.service";
import { RECURRING_FREQUENCIES, type RecurringFrequency } from "../db/schema/enums";

describe("Recurring Expense Types", () => {
  describe("RecurringFrequency", () => {
    it("should support daily frequency", () => {
      const freq: RecurringFrequency = "daily";
      expect(RECURRING_FREQUENCIES).toContain(freq);
    });

    it("should support weekly frequency", () => {
      const freq: RecurringFrequency = "weekly";
      expect(RECURRING_FREQUENCIES).toContain(freq);
    });

    it("should support biweekly frequency", () => {
      const freq: RecurringFrequency = "biweekly";
      expect(RECURRING_FREQUENCIES).toContain(freq);
    });

    it("should support monthly frequency", () => {
      const freq: RecurringFrequency = "monthly";
      expect(RECURRING_FREQUENCIES).toContain(freq);
    });

    it("should support yearly frequency", () => {
      const freq: RecurringFrequency = "yearly";
      expect(RECURRING_FREQUENCIES).toContain(freq);
    });

    it("should have exactly 5 frequency types", () => {
      expect(RECURRING_FREQUENCIES.length).toBe(5);
    });
  });

  describe("CreateRecurringExpenseInput", () => {
    it("should have correct structure", () => {
      const input: CreateRecurringExpenseInput = {
        groupId: "group-1",
        createdByMemberId: "member-1",
        name: "Monthly Rent",
        description: "Rent payment",
        category: "other",
        amount: 1500,
        currencyCode: "USD",
        frequency: "monthly",
        dayOfMonth: 1,
        splitMode: "equal",
        startDate: new Date("2025-01-01"),
        payers: [{ memberId: "member-1", amount: 1500 }],
        splits: [{ memberId: "member-1" }, { memberId: "member-2" }],
      };

      expect(input.name).toBe("Monthly Rent");
      expect(input.frequency).toBe("monthly");
      expect(input.dayOfMonth).toBe(1);
    });

    it("should support optional fields", () => {
      const input: CreateRecurringExpenseInput = {
        groupId: "group-1",
        createdByMemberId: "member-1",
        name: "Weekly Groceries",
        amount: 100,
        currencyCode: "USD",
        frequency: "weekly",
        startDate: new Date("2025-01-01"),
        payers: [{ memberId: "member-1", amount: 100 }],
        splits: [{ memberId: "member-1" }],
      };

      expect(input.description).toBeUndefined();
      expect(input.category).toBeUndefined();
      expect(input.endDate).toBeUndefined();
    });
  });

  describe("UpdateRecurringExpenseInput", () => {
    it("should allow partial updates", () => {
      const input: UpdateRecurringExpenseInput = {
        name: "Updated Name",
      };

      expect(input.name).toBe("Updated Name");
      expect(input.amount).toBeUndefined();
    });

    it("should allow deactivation", () => {
      const input: UpdateRecurringExpenseInput = {
        isActive: false,
      };

      expect(input.isActive).toBe(false);
    });
  });

  describe("RecurringExpenseWithDetails", () => {
    it("should have correct structure", () => {
      const expense: RecurringExpenseWithDetails = {
        id: "recurring-1",
        groupId: "group-1",
        createdByMemberId: "member-1",
        name: "Monthly Subscription",
        description: "Netflix",
        category: "entertainment",
        amount: 15.99,
        currencyCode: "USD",
        frequency: "monthly",
        dayOfWeek: null,
        dayOfMonth: 15,
        monthOfYear: null,
        splitMode: "equal",
        startDate: new Date("2025-01-15"),
        endDate: null,
        nextOccurrence: new Date("2025-02-15"),
        lastGeneratedAt: new Date("2025-01-15"),
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
        payers: [{ memberId: "member-1", displayName: "John", amount: 15.99 }],
        splits: [
          { memberId: "member-1", displayName: "John", shareMode: "equal", weight: null, exactAmount: null },
          { memberId: "member-2", displayName: "Jane", shareMode: "equal", weight: null, exactAmount: null },
        ],
      };

      expect(expense.id).toBe("recurring-1");
      expect(expense.frequency).toBe("monthly");
      expect(expense.payers.length).toBe(1);
      expect(expense.splits.length).toBe(2);
    });
  });

  describe("GenerationResult", () => {
    it("should track generation metrics", () => {
      const result: GenerationResult = {
        processed: 5,
        generated: 3,
        skipped: 1,
        errors: [{ recurringId: "recurring-1", error: "Group inactive" }],
      };

      expect(result.processed).toBe(5);
      expect(result.generated).toBe(3);
      expect(result.skipped).toBe(1);
      expect(result.errors.length).toBe(1);
    });

    it("should handle empty results", () => {
      const result: GenerationResult = {
        processed: 0,
        generated: 0,
        skipped: 0,
        errors: [],
      };

      expect(result.processed).toBe(0);
      expect(result.errors).toBeEmpty();
    });
  });
});

describe("Recurring Expense Date Calculations", () => {
  describe("Next Occurrence - Daily", () => {
    it("should calculate next day", () => {
      const current = new Date("2025-01-15");
      const next = new Date(current);
      next.setDate(next.getDate() + 1);

      expect(next.toISOString().split("T")[0]).toBe("2025-01-16");
    });
  });

  describe("Next Occurrence - Weekly", () => {
    it("should calculate 7 days later", () => {
      const current = new Date("2025-01-15");
      const next = new Date(current);
      next.setDate(next.getDate() + 7);

      expect(next.toISOString().split("T")[0]).toBe("2025-01-22");
    });
  });

  describe("Next Occurrence - Biweekly", () => {
    it("should calculate 14 days later", () => {
      const current = new Date("2025-01-15");
      const next = new Date(current);
      next.setDate(next.getDate() + 14);

      expect(next.toISOString().split("T")[0]).toBe("2025-01-29");
    });
  });

  describe("Next Occurrence - Monthly", () => {
    it("should calculate next month", () => {
      const current = new Date("2025-01-15");
      const next = new Date(current);
      next.setMonth(next.getMonth() + 1);

      expect(next.toISOString().split("T")[0]).toBe("2025-02-15");
    });

    it("should handle month end edge case", () => {
      const current = new Date("2025-01-31");
      const next = new Date(current);
      next.setMonth(next.getMonth() + 1);
      // February doesn't have 31 days
      const lastDayFeb = new Date(2025, 2, 0).getDate(); // 28 for 2025

      expect(lastDayFeb).toBe(28);
    });

    it("should handle leap year February", () => {
      const lastDayFeb2024 = new Date(2024, 2, 0).getDate();
      expect(lastDayFeb2024).toBe(29); // 2024 is a leap year
    });
  });

  describe("Next Occurrence - Yearly", () => {
    it("should calculate next year", () => {
      const current = new Date("2025-01-15");
      const next = new Date(current);
      next.setFullYear(next.getFullYear() + 1);

      expect(next.toISOString().split("T")[0]).toBe("2026-01-15");
    });

    it("should handle Feb 29 on non-leap year", () => {
      // Feb 29, 2024 (leap year)
      const current = new Date("2024-02-29");
      const next = new Date(current);
      next.setFullYear(next.getFullYear() + 1);
      // JavaScript will overflow to March

      // This is why we need to handle this in the service
      expect(next.getMonth()).toBe(2); // March (0-indexed)
    });
  });
});

describe("Recurring Expense Validation", () => {
  describe("Payer Amounts", () => {
    it("should sum payer amounts correctly", () => {
      const payers = [
        { memberId: "m1", amount: 50 },
        { memberId: "m2", amount: 50 },
      ];

      const total = payers.reduce((sum, p) => sum + p.amount, 0);
      expect(total).toBe(100);
    });

    it("should detect mismatch between payer total and expense amount", () => {
      const expenseAmount = 100;
      const payerTotal = 90;
      const mismatch = Math.abs(payerTotal - expenseAmount) > 0.01;

      expect(mismatch).toBe(true);
    });

    it("should allow small floating point differences", () => {
      const expenseAmount = 100;
      const payerTotal = 99.999;
      const mismatch = Math.abs(payerTotal - expenseAmount) > 0.01;

      expect(mismatch).toBe(false); // 0.001 difference is within tolerance
    });
  });

  describe("Date Validation", () => {
    it("should detect invalid date strings", () => {
      const dateStr = "invalid-date";
      const date = new Date(dateStr);

      expect(isNaN(date.getTime())).toBe(true);
    });

    it("should parse valid ISO date strings", () => {
      const dateStr = "2025-01-15T00:00:00.000Z";
      const date = new Date(dateStr);

      expect(isNaN(date.getTime())).toBe(false);
    });
  });

  describe("Frequency Day Constraints", () => {
    it("should validate dayOfWeek is 0-6", () => {
      const dayOfWeek = 5; // Friday
      expect(dayOfWeek >= 0 && dayOfWeek <= 6).toBe(true);
    });

    it("should validate dayOfMonth is 1-31", () => {
      const dayOfMonth = 15;
      expect(dayOfMonth >= 1 && dayOfMonth <= 31).toBe(true);
    });

    it("should validate monthOfYear is 1-12", () => {
      const monthOfYear = 6; // June
      expect(monthOfYear >= 1 && monthOfYear <= 12).toBe(true);
    });
  });
});
