import { describe, test, expect } from "bun:test";

// ============================================================================
// Expense Service Unit Tests - Sprint 002
// Feature 2: Core Expense Tracking (AC-2.1 to AC-2.36)
// ============================================================================

describe("Expense Service - Amount Validation", () => {
  // AC-2.4: Amount must be positive with max 2 decimal places

  function validateAmount(amount: number): { valid: boolean; error?: string } {
    if (typeof amount !== "number" || isNaN(amount)) {
      return { valid: false, error: "Amount must be a number" };
    }
    if (amount <= 0) {
      return { valid: false, error: "Amount must be positive" };
    }
    const decimalPlaces = (amount.toString().split(".")[1] || "").length;
    if (decimalPlaces > 2) {
      return { valid: false, error: "Amount cannot have more than 2 decimal places" };
    }
    return { valid: true };
  }

  test("rejects zero amount", () => {
    const result = validateAmount(0);
    expect(result.valid).toBe(false);
    expect(result.error).toBe("Amount must be positive");
  });

  test("rejects negative amount", () => {
    const result = validateAmount(-10);
    expect(result.valid).toBe(false);
    expect(result.error).toBe("Amount must be positive");
  });

  test("accepts positive integer amount", () => {
    const result = validateAmount(100);
    expect(result.valid).toBe(true);
  });

  test("accepts amount with 2 decimal places", () => {
    const result = validateAmount(10.99);
    expect(result.valid).toBe(true);
  });

  test("rejects amount with more than 2 decimal places", () => {
    const result = validateAmount(10.999);
    expect(result.valid).toBe(false);
    expect(result.error).toBe("Amount cannot have more than 2 decimal places");
  });

  test("accepts amount with 1 decimal place", () => {
    const result = validateAmount(10.5);
    expect(result.valid).toBe(true);
  });

  test("rejects NaN", () => {
    const result = validateAmount(NaN);
    expect(result.valid).toBe(false);
    expect(result.error).toBe("Amount must be a number");
  });
});

describe("Expense Service - Title Validation", () => {
  // AC-2.7: Title must be 1-200 characters

  function validateTitle(title: string): { valid: boolean; error?: string } {
    const trimmed = title.trim();
    if (trimmed.length === 0) {
      return { valid: false, error: "Title cannot be empty" };
    }
    if (trimmed.length > 200) {
      return { valid: false, error: "Title cannot exceed 200 characters" };
    }
    return { valid: true };
  }

  test("rejects empty title", () => {
    const result = validateTitle("");
    expect(result.valid).toBe(false);
    expect(result.error).toBe("Title cannot be empty");
  });

  test("rejects whitespace-only title", () => {
    const result = validateTitle("   ");
    expect(result.valid).toBe(false);
    expect(result.error).toBe("Title cannot be empty");
  });

  test("accepts valid title", () => {
    const result = validateTitle("Dinner at restaurant");
    expect(result.valid).toBe(true);
  });

  test("accepts title at max length (200)", () => {
    const result = validateTitle("A".repeat(200));
    expect(result.valid).toBe(true);
  });

  test("rejects title exceeding 200 characters", () => {
    const result = validateTitle("A".repeat(201));
    expect(result.valid).toBe(false);
    expect(result.error).toBe("Title cannot exceed 200 characters");
  });

  test("trims whitespace for validation", () => {
    const result = validateTitle("  Valid Title  ");
    expect(result.valid).toBe(true);
  });
});

describe("Expense Service - Category Validation", () => {
  // AC-2.8: Category must be from predefined list

  const EXPENSE_CATEGORIES = [
    "food",
    "transport",
    "accommodation",
    "entertainment",
    "shopping",
    "utilities",
    "health",
    "travel",
    "groceries",
    "other",
  ] as const;

  function validateCategory(category: string): boolean {
    return EXPENSE_CATEGORIES.includes(category as any);
  }

  test("accepts valid category - food", () => {
    expect(validateCategory("food")).toBe(true);
  });

  test("accepts valid category - transport", () => {
    expect(validateCategory("transport")).toBe(true);
  });

  test("accepts valid category - other", () => {
    expect(validateCategory("other")).toBe(true);
  });

  test("rejects invalid category", () => {
    expect(validateCategory("invalid")).toBe(false);
  });

  test("rejects empty string", () => {
    expect(validateCategory("")).toBe(false);
  });

  test("category is case-sensitive", () => {
    expect(validateCategory("FOOD")).toBe(false);
    expect(validateCategory("Food")).toBe(false);
  });

  test("all defined categories are valid", () => {
    for (const category of EXPENSE_CATEGORIES) {
      expect(validateCategory(category)).toBe(true);
    }
  });
});

describe("Expense Service - Equal Split Calculation", () => {
  // AC-2.10, AC-2.15: Equal split among members

  function calculateEqualSplit(totalAmount: number, memberCount: number): number[] {
    if (memberCount === 0) return [];

    const shareAmount = totalAmount / memberCount;
    const roundedShare = Math.round(shareAmount * 100) / 100;
    const remainder = Math.round((totalAmount - roundedShare * memberCount) * 100) / 100;

    const shares: number[] = [];
    for (let i = 0; i < memberCount; i++) {
      shares.push(i === 0 ? roundedShare + remainder : roundedShare);
    }
    return shares;
  }

  test("splits evenly among 2 members", () => {
    const shares = calculateEqualSplit(100, 2);
    expect(shares).toEqual([50, 50]);
  });

  test("splits evenly among 3 members", () => {
    const shares = calculateEqualSplit(99, 3);
    expect(shares).toEqual([33, 33, 33]);
  });

  test("handles rounding - 100 / 3", () => {
    const shares = calculateEqualSplit(100, 3);
    // 100 / 3 = 33.333... rounds to 33.33
    // Remainder = 100 - (33.33 * 3) = 100 - 99.99 = 0.01
    // First person gets 33.33 + 0.01 = 33.34
    expect(shares[0]).toBeCloseTo(33.34, 2);
    expect(shares[1]).toBeCloseTo(33.33, 2);
    expect(shares[2]).toBeCloseTo(33.33, 2);
    // Verify sum equals total
    expect(shares.reduce((a, b) => a + b, 0)).toBeCloseTo(100, 2);
  });

  test("handles single member", () => {
    const shares = calculateEqualSplit(100, 1);
    expect(shares).toEqual([100]);
  });

  test("returns empty array for zero members", () => {
    const shares = calculateEqualSplit(100, 0);
    expect(shares).toEqual([]);
  });

  test("sum of shares equals total", () => {
    const testCases = [
      { amount: 100, members: 3 },
      { amount: 50.50, members: 4 },
      { amount: 33.33, members: 7 },
      { amount: 1000, members: 6 },
    ];

    for (const { amount, members } of testCases) {
      const shares = calculateEqualSplit(amount, members);
      const sum = shares.reduce((a, b) => a + b, 0);
      expect(sum).toBeCloseTo(amount, 2);
    }
  });
});

describe("Expense Service - Exact Split Calculation", () => {
  // AC-2.11: Exact amounts per member
  // AC-2.14: Verify sum equals total

  function validateExactSplit(
    totalAmount: number,
    splits: Record<string, number>
  ): { valid: boolean; error?: string } {
    const sum = Object.values(splits).reduce((a, b) => a + b, 0);
    if (Math.abs(sum - totalAmount) > 0.01) {
      return {
        valid: false,
        error: `Split amounts (${sum}) must equal total (${totalAmount})`,
      };
    }
    return { valid: true };
  }

  test("accepts splits that sum to total", () => {
    const result = validateExactSplit(100, {
      user1: 60,
      user2: 40,
    });
    expect(result.valid).toBe(true);
  });

  test("rejects splits that don't sum to total", () => {
    const result = validateExactSplit(100, {
      user1: 50,
      user2: 40,
    });
    expect(result.valid).toBe(false);
    expect(result.error).toContain("must equal total");
  });

  test("accepts splits with small rounding tolerance", () => {
    const result = validateExactSplit(100, {
      user1: 33.33,
      user2: 33.33,
      user3: 33.34,
    });
    expect(result.valid).toBe(true);
  });

  test("handles decimal amounts", () => {
    const result = validateExactSplit(50.75, {
      user1: 25.25,
      user2: 25.50,
    });
    expect(result.valid).toBe(true);
  });
});

describe("Expense Service - Percent Split Calculation", () => {
  // AC-2.12: Percentage split

  function calculatePercentSplit(
    totalAmount: number,
    percentages: Record<string, number>
  ): { splits: Record<string, number>; error?: string } {
    const totalPercent = Object.values(percentages).reduce((a, b) => a + b, 0);
    if (Math.abs(totalPercent - 100) > 0.01) {
      return {
        splits: {},
        error: `Percentages (${totalPercent}%) must sum to 100%`,
      };
    }

    const splits: Record<string, number> = {};
    let runningTotal = 0;
    const entries = Object.entries(percentages);

    entries.forEach(([userId, percent], index) => {
      if (index === entries.length - 1) {
        // Last person gets remainder
        splits[userId] = Math.round((totalAmount - runningTotal) * 100) / 100;
      } else {
        const amount = Math.round((totalAmount * percent / 100) * 100) / 100;
        splits[userId] = amount;
        runningTotal += amount;
      }
    });

    return { splits };
  }

  test("calculates correct amounts for 50/50 split", () => {
    const result = calculatePercentSplit(100, {
      user1: 50,
      user2: 50,
    });
    expect(result.error).toBeUndefined();
    expect(result.splits.user1).toBe(50);
    expect(result.splits.user2).toBe(50);
  });

  test("calculates correct amounts for 60/40 split", () => {
    const result = calculatePercentSplit(100, {
      user1: 60,
      user2: 40,
    });
    expect(result.error).toBeUndefined();
    expect(result.splits.user1).toBe(60);
    expect(result.splits.user2).toBe(40);
  });

  test("rejects percentages that don't sum to 100", () => {
    const result = calculatePercentSplit(100, {
      user1: 50,
      user2: 30,
    });
    expect(result.error).toContain("must sum to 100%");
  });

  test("handles rounding for odd percentages", () => {
    const result = calculatePercentSplit(100, {
      user1: 33.33,
      user2: 33.33,
      user3: 33.34,
    });
    expect(result.error).toBeUndefined();
    const sum = Object.values(result.splits).reduce((a, b) => a + b, 0);
    expect(sum).toBeCloseTo(100, 2);
  });

  test("sum equals total amount", () => {
    const result = calculatePercentSplit(150, {
      user1: 25,
      user2: 25,
      user3: 50,
    });
    expect(result.error).toBeUndefined();
    const sum = Object.values(result.splits).reduce((a, b) => a + b, 0);
    expect(sum).toBeCloseTo(150, 2);
  });
});

describe("Expense Service - Weight Split Calculation", () => {
  // AC-2.13: Weight/shares split

  function calculateWeightSplit(
    totalAmount: number,
    weights: Record<string, number>
  ): { splits: Record<string, number>; error?: string } {
    const totalWeight = Object.values(weights).reduce((a, b) => a + b, 0);
    if (totalWeight === 0) {
      return { splits: {}, error: "Total weight cannot be zero" };
    }

    const hasNegative = Object.values(weights).some((w) => w < 0);
    if (hasNegative) {
      return { splits: {}, error: "Weights cannot be negative" };
    }

    const splits: Record<string, number> = {};
    let runningTotal = 0;
    const entries = Object.entries(weights);

    entries.forEach(([userId, weight], index) => {
      if (index === entries.length - 1) {
        splits[userId] = Math.round((totalAmount - runningTotal) * 100) / 100;
      } else {
        const amount = Math.round((totalAmount * weight / totalWeight) * 100) / 100;
        splits[userId] = amount;
        runningTotal += amount;
      }
    });

    return { splits };
  }

  test("calculates equal split with same weights", () => {
    const result = calculateWeightSplit(100, {
      user1: 1,
      user2: 1,
    });
    expect(result.error).toBeUndefined();
    expect(result.splits.user1).toBe(50);
    expect(result.splits.user2).toBe(50);
  });

  test("calculates proportional split with different weights", () => {
    const result = calculateWeightSplit(100, {
      user1: 2,
      user2: 1,
    });
    expect(result.error).toBeUndefined();
    expect(result.splits.user1).toBeCloseTo(66.67, 2);
    expect(result.splits.user2).toBeCloseTo(33.33, 2);
  });

  test("handles weight of 2:1:1 ratio", () => {
    const result = calculateWeightSplit(100, {
      user1: 2,
      user2: 1,
      user3: 1,
    });
    expect(result.error).toBeUndefined();
    expect(result.splits.user1).toBe(50);
    expect(result.splits.user2).toBe(25);
    expect(result.splits.user3).toBe(25);
  });

  test("rejects zero total weight", () => {
    const result = calculateWeightSplit(100, {
      user1: 0,
      user2: 0,
    });
    expect(result.error).toBe("Total weight cannot be zero");
  });

  test("rejects negative weights", () => {
    const result = calculateWeightSplit(100, {
      user1: 2,
      user2: -1,
    });
    expect(result.error).toBe("Weights cannot be negative");
  });

  test("sum equals total amount", () => {
    const result = calculateWeightSplit(150.75, {
      user1: 3,
      user2: 2,
      user3: 1,
    });
    expect(result.error).toBeUndefined();
    const sum = Object.values(result.splits).reduce((a, b) => a + b, 0);
    expect(sum).toBeCloseTo(150.75, 2);
  });
});

describe("Expense Service - Split Type Constants", () => {
  const VALID_SPLIT_TYPES = ["equal", "exact", "percent", "weight"];

  test("equal is a valid split type", () => {
    expect(VALID_SPLIT_TYPES.includes("equal")).toBe(true);
  });

  test("exact is a valid split type", () => {
    expect(VALID_SPLIT_TYPES.includes("exact")).toBe(true);
  });

  test("percent is a valid split type", () => {
    expect(VALID_SPLIT_TYPES.includes("percent")).toBe(true);
  });

  test("weight is a valid split type", () => {
    expect(VALID_SPLIT_TYPES.includes("weight")).toBe(true);
  });

  test("invalid type is rejected", () => {
    expect(VALID_SPLIT_TYPES.includes("custom")).toBe(false);
  });
});
