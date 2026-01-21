/**
 * Analytics Integration Tests
 * Phase 3 - E2E Testing
 *
 * Tests for spending analytics endpoints.
 *
 * AC-2.1: GET /groups/:groupId/analytics/summary returns spending summary
 * AC-2.2: Summary includes total spent, average per expense, expense count
 * AC-2.3: Summary includes per-member spending breakdown
 * AC-2.4: Summary supports date range filtering
 * AC-2.5: Trends supports period grouping (daily, weekly, monthly)
 * AC-2.6: GET /groups/:groupId/analytics/categories returns category breakdown
 * AC-2.7: Category breakdown shows amount and percentage per category
 * AC-2.8: Categories sorted by total amount descending
 * AC-2.9: GET /groups/:groupId/analytics/trends returns spending trends
 * AC-2.10: Trends show spending over time for the requested period
 */

import { describe, it, expect, beforeAll, afterAll } from "bun:test";
import {
  beforeAllTests,
  afterAllTests,
  testEmail,
  testId,
  getTestDb,
  schema,
} from "./setup";
import {
  createTestApp,
  get,
  authHeader,
  loginUser,
  ApiResponse,
} from "./helpers";
import {
  createTestUser,
  createTestGroup,
  addTestMember,
  createTestExpense,
  addTestSplits,
} from "./factories";
import { eq } from "drizzle-orm";

// ============================================================================
// Test Setup
// ============================================================================

let app: ReturnType<typeof createTestApp>;

beforeAll(async () => {
  await beforeAllTests();
  app = createTestApp();
});

afterAll(async () => {
  await afterAllTests();
});

// ============================================================================
// Types
// ============================================================================

interface SpendingSummaryResponse {
  groupId: string;
  groupName: string;
  currency: string;
  dateRange: {
    from: string | null;
    to: string | null;
  };
  totals: {
    totalSpent: number;
    expenseCount: number;
    averagePerExpense: number;
  };
  memberBreakdown: Array<{
    memberId: string;
    userId: string;
    displayName: string;
    totalPaid: number;
    totalOwed: number;
    expenseCount: number;
  }>;
}

interface CategoryAnalyticsResponse {
  groupId: string;
  currency: string;
  dateRange: {
    from: string | null;
    to: string | null;
  };
  totalSpent: number;
  categories: Array<{
    category: string;
    totalAmount: number;
    expenseCount: number;
    percentage: number;
  }>;
}

interface SpendingTrendsResponse {
  groupId: string;
  currency: string;
  dateRange: {
    from: string | null;
    to: string | null;
  };
  periodType: string;
  trends: Array<{
    period: string;
    periodStart: string;
    periodEnd: string;
    totalAmount: number;
    expenseCount: number;
  }>;
}

// ============================================================================
// Spending Summary Tests (AC-2.1 to AC-2.4)
// ============================================================================

describe("GET /groups/:groupId/analytics/summary - Spending Summary", () => {
  it("should return spending summary for group (AC-2.1)", async () => {
    // Arrange
    const owner = await createTestUser();
    const group = await createTestGroup(owner.id);
    const auth = await loginUser(app, owner.email, owner.plainPassword);
    expect(auth).not.toBeNull();

    // Act
    const response = await get<ApiResponse<SpendingSummaryResponse>>(
      app,
      `/v1/groups/${group.id}/analytics/summary`,
      { headers: authHeader(auth!.accessToken) }
    );

    // Assert
    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data?.groupId).toBe(group.id);
    expect(response.body.data?.groupName).toBeDefined();
    expect(response.body.data?.currency).toBeDefined();
    expect(response.body.data?.totals).toBeDefined();
  });

  it("should include total spent, expense count, average (AC-2.2)", async () => {
    // Arrange
    const owner = await createTestUser();
    const group = await createTestGroup(owner.id);
    const auth = await loginUser(app, owner.email, owner.plainPassword);
    expect(auth).not.toBeNull();

    // Create some expenses
    await createTestExpense(group.id, group.ownerMemberId, group.ownerMemberId, {
      amount: 100,
    });
    await createTestExpense(group.id, group.ownerMemberId, group.ownerMemberId, {
      amount: 200,
    });

    // Act
    const response = await get<ApiResponse<SpendingSummaryResponse>>(
      app,
      `/v1/groups/${group.id}/analytics/summary`,
      { headers: authHeader(auth!.accessToken) }
    );

    // Assert
    expect(response.status).toBe(200);
    expect(response.body.data?.totals.totalSpent).toBeGreaterThanOrEqual(300);
    expect(response.body.data?.totals.expenseCount).toBeGreaterThanOrEqual(2);
    expect(response.body.data?.totals.averagePerExpense).toBeDefined();
  });

  it("should include per-member spending breakdown (AC-2.3)", async () => {
    // Arrange
    const owner = await createTestUser();
    const group = await createTestGroup(owner.id);
    const member = await createTestUser();
    await addTestMember(group.id, member.id);

    const auth = await loginUser(app, owner.email, owner.plainPassword);
    expect(auth).not.toBeNull();

    // Create expense paid by owner
    await createTestExpense(group.id, group.ownerMemberId, group.ownerMemberId, {
      amount: 150,
    });

    // Act
    const response = await get<ApiResponse<SpendingSummaryResponse>>(
      app,
      `/v1/groups/${group.id}/analytics/summary`,
      { headers: authHeader(auth!.accessToken) }
    );

    // Assert
    expect(response.status).toBe(200);
    expect(response.body.data?.memberBreakdown).toBeDefined();
    expect(response.body.data?.memberBreakdown.length).toBeGreaterThanOrEqual(1);

    const ownerBreakdown = response.body.data?.memberBreakdown.find(
      (m) => m.memberId === group.ownerMemberId
    );
    expect(ownerBreakdown).toBeDefined();
    expect(ownerBreakdown?.totalPaid).toBeGreaterThanOrEqual(150);
  });

  it("should support date range filtering (AC-2.4)", async () => {
    // Arrange
    const owner = await createTestUser();
    const group = await createTestGroup(owner.id);
    const auth = await loginUser(app, owner.email, owner.plainPassword);
    expect(auth).not.toBeNull();

    // Create an expense
    await createTestExpense(group.id, group.ownerMemberId, group.ownerMemberId, {
      amount: 100,
    });

    const today = new Date();
    const startDate = new Date(today);
    startDate.setDate(startDate.getDate() - 7);
    const endDate = new Date(today);
    endDate.setDate(endDate.getDate() + 1);

    // Act
    const response = await get<ApiResponse<SpendingSummaryResponse>>(
      app,
      `/v1/groups/${group.id}/analytics/summary`,
      {
        headers: authHeader(auth!.accessToken),
        query: {
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString(),
        },
      }
    );

    // Assert
    expect(response.status).toBe(200);
    expect(response.body.data?.dateRange.from).toBeDefined();
    expect(response.body.data?.dateRange.to).toBeDefined();
  });

  it("should reject non-member access (403)", async () => {
    // Arrange
    const owner = await createTestUser();
    const group = await createTestGroup(owner.id);
    const nonMember = await createTestUser();
    const auth = await loginUser(app, nonMember.email, nonMember.plainPassword);
    expect(auth).not.toBeNull();

    // Act
    const response = await get(
      app,
      `/v1/groups/${group.id}/analytics/summary`,
      { headers: authHeader(auth!.accessToken) }
    );

    // Assert
    expect(response.status).toBe(403);
  });

  it("should reject missing authentication (401)", async () => {
    // Arrange
    const owner = await createTestUser();
    const group = await createTestGroup(owner.id);

    // Act
    const response = await get(
      app,
      `/v1/groups/${group.id}/analytics/summary`
    );

    // Assert
    expect(response.status).toBe(401);
  });

  it("should reject invalid group (404)", async () => {
    // Arrange
    const owner = await createTestUser();
    const auth = await loginUser(app, owner.email, owner.plainPassword);
    expect(auth).not.toBeNull();

    // Use a valid UUID format that doesn't exist
    const nonExistentGroupId = "00000000-0000-0000-0000-000000000000";

    // Act
    const response = await get(
      app,
      `/v1/groups/${nonExistentGroupId}/analytics/summary`,
      { headers: authHeader(auth!.accessToken) }
    );

    // Assert
    expect(response.status).toBe(404);
  });

  it("should reject invalid date format", async () => {
    // Arrange
    const owner = await createTestUser();
    const group = await createTestGroup(owner.id);
    const auth = await loginUser(app, owner.email, owner.plainPassword);
    expect(auth).not.toBeNull();

    // Act
    const response = await get(
      app,
      `/v1/groups/${group.id}/analytics/summary`,
      {
        headers: authHeader(auth!.accessToken),
        query: { startDate: "not-a-date" },
      }
    );

    // Assert
    expect(response.status).toBe(400);
  });

  it("should return zero totals for group with no expenses", async () => {
    // Arrange
    const owner = await createTestUser();
    const group = await createTestGroup(owner.id);
    const auth = await loginUser(app, owner.email, owner.plainPassword);
    expect(auth).not.toBeNull();

    // Act
    const response = await get<ApiResponse<SpendingSummaryResponse>>(
      app,
      `/v1/groups/${group.id}/analytics/summary`,
      { headers: authHeader(auth!.accessToken) }
    );

    // Assert
    expect(response.status).toBe(200);
    expect(response.body.data?.totals.totalSpent).toBe(0);
    expect(response.body.data?.totals.expenseCount).toBe(0);
  });
});

// ============================================================================
// Category Analytics Tests (AC-2.6 to AC-2.8)
// ============================================================================

describe("GET /groups/:groupId/analytics/categories - Category Breakdown", () => {
  it("should return category breakdown (AC-2.6)", async () => {
    // Arrange
    const owner = await createTestUser();
    const group = await createTestGroup(owner.id);
    const auth = await loginUser(app, owner.email, owner.plainPassword);
    expect(auth).not.toBeNull();

    // Create expenses with different categories
    await createTestExpense(group.id, group.ownerMemberId, group.ownerMemberId, {
      amount: 100,
      category: "food",
    });
    await createTestExpense(group.id, group.ownerMemberId, group.ownerMemberId, {
      amount: 50,
      category: "transport",
    });

    // Act
    const response = await get<ApiResponse<CategoryAnalyticsResponse>>(
      app,
      `/v1/groups/${group.id}/analytics/categories`,
      { headers: authHeader(auth!.accessToken) }
    );

    // Assert
    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data?.categories).toBeDefined();
    expect(response.body.data?.categories.length).toBeGreaterThanOrEqual(2);
  });

  it("should show amount and percentage per category (AC-2.7)", async () => {
    // Arrange
    const owner = await createTestUser();
    const group = await createTestGroup(owner.id);
    const auth = await loginUser(app, owner.email, owner.plainPassword);
    expect(auth).not.toBeNull();

    // Create expenses: 75% food, 25% transport
    await createTestExpense(group.id, group.ownerMemberId, group.ownerMemberId, {
      amount: 75,
      category: "food",
    });
    await createTestExpense(group.id, group.ownerMemberId, group.ownerMemberId, {
      amount: 25,
      category: "transport",
    });

    // Act
    const response = await get<ApiResponse<CategoryAnalyticsResponse>>(
      app,
      `/v1/groups/${group.id}/analytics/categories`,
      { headers: authHeader(auth!.accessToken) }
    );

    // Assert
    expect(response.status).toBe(200);
    const categories = response.body.data?.categories || [];
    const foodCategory = categories.find((c) => c.category === "food");
    const transportCategory = categories.find((c) => c.category === "transport");

    expect(foodCategory).toBeDefined();
    expect(foodCategory?.totalAmount).toBe(75);
    expect(foodCategory?.percentage).toBe(75);

    expect(transportCategory).toBeDefined();
    expect(transportCategory?.totalAmount).toBe(25);
    expect(transportCategory?.percentage).toBe(25);
  });

  it("should sort categories by total amount descending (AC-2.8)", async () => {
    // Arrange
    const owner = await createTestUser();
    const group = await createTestGroup(owner.id);
    const auth = await loginUser(app, owner.email, owner.plainPassword);
    expect(auth).not.toBeNull();

    // Create expenses with different amounts
    await createTestExpense(group.id, group.ownerMemberId, group.ownerMemberId, {
      amount: 50,
      category: "entertainment",
    });
    await createTestExpense(group.id, group.ownerMemberId, group.ownerMemberId, {
      amount: 100,
      category: "food",
    });
    await createTestExpense(group.id, group.ownerMemberId, group.ownerMemberId, {
      amount: 25,
      category: "utilities",
    });

    // Act
    const response = await get<ApiResponse<CategoryAnalyticsResponse>>(
      app,
      `/v1/groups/${group.id}/analytics/categories`,
      { headers: authHeader(auth!.accessToken) }
    );

    // Assert
    expect(response.status).toBe(200);
    const categories = response.body.data?.categories || [];
    expect(categories.length).toBeGreaterThanOrEqual(3);

    // Should be sorted by total amount descending
    for (let i = 0; i < categories.length - 1; i++) {
      expect(categories[i].totalAmount).toBeGreaterThanOrEqual(
        categories[i + 1].totalAmount
      );
    }
  });

  it("should support date range filtering for categories", async () => {
    // Arrange
    const owner = await createTestUser();
    const group = await createTestGroup(owner.id);
    const auth = await loginUser(app, owner.email, owner.plainPassword);
    expect(auth).not.toBeNull();

    const today = new Date();
    const startDate = new Date(today);
    startDate.setDate(startDate.getDate() - 30);

    // Act
    const response = await get<ApiResponse<CategoryAnalyticsResponse>>(
      app,
      `/v1/groups/${group.id}/analytics/categories`,
      {
        headers: authHeader(auth!.accessToken),
        query: {
          startDate: startDate.toISOString(),
          endDate: today.toISOString(),
        },
      }
    );

    // Assert
    expect(response.status).toBe(200);
    expect(response.body.data?.dateRange.from).toBeDefined();
    expect(response.body.data?.dateRange.to).toBeDefined();
  });

  it("should reject non-member access for categories (403)", async () => {
    // Arrange
    const owner = await createTestUser();
    const group = await createTestGroup(owner.id);
    const nonMember = await createTestUser();
    const auth = await loginUser(app, nonMember.email, nonMember.plainPassword);
    expect(auth).not.toBeNull();

    // Act
    const response = await get(
      app,
      `/v1/groups/${group.id}/analytics/categories`,
      { headers: authHeader(auth!.accessToken) }
    );

    // Assert
    expect(response.status).toBe(403);
  });

  it("should return total spent for categories", async () => {
    // Arrange
    const owner = await createTestUser();
    const group = await createTestGroup(owner.id);
    const auth = await loginUser(app, owner.email, owner.plainPassword);
    expect(auth).not.toBeNull();

    await createTestExpense(group.id, group.ownerMemberId, group.ownerMemberId, {
      amount: 100,
      category: "food",
    });
    await createTestExpense(group.id, group.ownerMemberId, group.ownerMemberId, {
      amount: 50,
      category: "food",
    });

    // Act
    const response = await get<ApiResponse<CategoryAnalyticsResponse>>(
      app,
      `/v1/groups/${group.id}/analytics/categories`,
      { headers: authHeader(auth!.accessToken) }
    );

    // Assert
    expect(response.status).toBe(200);
    expect(response.body.data?.totalSpent).toBeGreaterThanOrEqual(150);
  });

  it("should return expense count per category", async () => {
    // Arrange
    const owner = await createTestUser();
    const group = await createTestGroup(owner.id);
    const auth = await loginUser(app, owner.email, owner.plainPassword);
    expect(auth).not.toBeNull();

    // Create 3 food expenses
    await createTestExpense(group.id, group.ownerMemberId, group.ownerMemberId, {
      amount: 30,
      category: "food",
    });
    await createTestExpense(group.id, group.ownerMemberId, group.ownerMemberId, {
      amount: 40,
      category: "food",
    });
    await createTestExpense(group.id, group.ownerMemberId, group.ownerMemberId, {
      amount: 50,
      category: "food",
    });

    // Act
    const response = await get<ApiResponse<CategoryAnalyticsResponse>>(
      app,
      `/v1/groups/${group.id}/analytics/categories`,
      { headers: authHeader(auth!.accessToken) }
    );

    // Assert
    expect(response.status).toBe(200);
    const foodCategory = response.body.data?.categories.find(
      (c) => c.category === "food"
    );
    expect(foodCategory?.expenseCount).toBeGreaterThanOrEqual(3);
  });
});

// ============================================================================
// Spending Trends Tests (AC-2.9, AC-2.10)
// ============================================================================

describe("GET /groups/:groupId/analytics/trends - Spending Trends", () => {
  it("should return spending trends (AC-2.9)", async () => {
    // Arrange
    const owner = await createTestUser();
    const group = await createTestGroup(owner.id);
    const auth = await loginUser(app, owner.email, owner.plainPassword);
    expect(auth).not.toBeNull();

    // Create some expenses
    await createTestExpense(group.id, group.ownerMemberId, group.ownerMemberId, {
      amount: 100,
    });

    // Act
    const response = await get<ApiResponse<SpendingTrendsResponse>>(
      app,
      `/v1/groups/${group.id}/analytics/trends`,
      { headers: authHeader(auth!.accessToken) }
    );

    // Assert
    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data?.trends).toBeDefined();
    expect(response.body.data?.periodType).toBeDefined();
  });

  it("should support monthly period grouping (AC-2.5, AC-2.10)", async () => {
    // Arrange
    const owner = await createTestUser();
    const group = await createTestGroup(owner.id);
    const auth = await loginUser(app, owner.email, owner.plainPassword);
    expect(auth).not.toBeNull();

    await createTestExpense(group.id, group.ownerMemberId, group.ownerMemberId, {
      amount: 100,
    });

    // Act
    const response = await get<ApiResponse<SpendingTrendsResponse>>(
      app,
      `/v1/groups/${group.id}/analytics/trends`,
      {
        headers: authHeader(auth!.accessToken),
        query: { period: "monthly" },
      }
    );

    // Assert
    expect(response.status).toBe(200);
    expect(response.body.data?.periodType).toBe("monthly");
  });

  it("should support weekly period grouping", async () => {
    // Arrange
    const owner = await createTestUser();
    const group = await createTestGroup(owner.id);
    const auth = await loginUser(app, owner.email, owner.plainPassword);
    expect(auth).not.toBeNull();

    await createTestExpense(group.id, group.ownerMemberId, group.ownerMemberId, {
      amount: 100,
    });

    // Act
    const response = await get<ApiResponse<SpendingTrendsResponse>>(
      app,
      `/v1/groups/${group.id}/analytics/trends`,
      {
        headers: authHeader(auth!.accessToken),
        query: { period: "weekly" },
      }
    );

    // Assert
    expect(response.status).toBe(200);
    expect(response.body.data?.periodType).toBe("weekly");
  });

  it("should support daily period grouping", async () => {
    // Arrange
    const owner = await createTestUser();
    const group = await createTestGroup(owner.id);
    const auth = await loginUser(app, owner.email, owner.plainPassword);
    expect(auth).not.toBeNull();

    await createTestExpense(group.id, group.ownerMemberId, group.ownerMemberId, {
      amount: 100,
    });

    // Act
    const response = await get<ApiResponse<SpendingTrendsResponse>>(
      app,
      `/v1/groups/${group.id}/analytics/trends`,
      {
        headers: authHeader(auth!.accessToken),
        query: { period: "daily" },
      }
    );

    // Assert
    expect(response.status).toBe(200);
    expect(response.body.data?.periodType).toBe("daily");
  });

  it("should support date range filtering for trends", async () => {
    // Arrange
    const owner = await createTestUser();
    const group = await createTestGroup(owner.id);
    const auth = await loginUser(app, owner.email, owner.plainPassword);
    expect(auth).not.toBeNull();

    const today = new Date();
    const startDate = new Date(today);
    startDate.setMonth(startDate.getMonth() - 3);

    // Act
    const response = await get<ApiResponse<SpendingTrendsResponse>>(
      app,
      `/v1/groups/${group.id}/analytics/trends`,
      {
        headers: authHeader(auth!.accessToken),
        query: {
          startDate: startDate.toISOString(),
          endDate: today.toISOString(),
        },
      }
    );

    // Assert
    expect(response.status).toBe(200);
    expect(response.body.data?.dateRange.from).toBeDefined();
    expect(response.body.data?.dateRange.to).toBeDefined();
  });

  it("should reject non-member access for trends (403)", async () => {
    // Arrange
    const owner = await createTestUser();
    const group = await createTestGroup(owner.id);
    const nonMember = await createTestUser();
    const auth = await loginUser(app, nonMember.email, nonMember.plainPassword);
    expect(auth).not.toBeNull();

    // Act
    const response = await get(
      app,
      `/v1/groups/${group.id}/analytics/trends`,
      { headers: authHeader(auth!.accessToken) }
    );

    // Assert
    expect(response.status).toBe(403);
  });

  it("should include period start and end dates in trends", async () => {
    // Arrange
    const owner = await createTestUser();
    const group = await createTestGroup(owner.id);
    const auth = await loginUser(app, owner.email, owner.plainPassword);
    expect(auth).not.toBeNull();

    await createTestExpense(group.id, group.ownerMemberId, group.ownerMemberId, {
      amount: 100,
    });

    // Act
    const response = await get<ApiResponse<SpendingTrendsResponse>>(
      app,
      `/v1/groups/${group.id}/analytics/trends`,
      { headers: authHeader(auth!.accessToken) }
    );

    // Assert
    expect(response.status).toBe(200);
    if (response.body.data?.trends.length ?? 0 > 0) {
      const firstTrend = response.body.data?.trends[0];
      expect(firstTrend?.period).toBeDefined();
      expect(firstTrend?.periodStart).toBeDefined();
      expect(firstTrend?.periodEnd).toBeDefined();
      expect(firstTrend?.totalAmount).toBeDefined();
      expect(firstTrend?.expenseCount).toBeDefined();
    }
  });

  it("should return empty trends for group with no expenses", async () => {
    // Arrange
    const owner = await createTestUser();
    const group = await createTestGroup(owner.id);
    const auth = await loginUser(app, owner.email, owner.plainPassword);
    expect(auth).not.toBeNull();

    // Act
    const response = await get<ApiResponse<SpendingTrendsResponse>>(
      app,
      `/v1/groups/${group.id}/analytics/trends`,
      { headers: authHeader(auth!.accessToken) }
    );

    // Assert
    expect(response.status).toBe(200);
    expect(response.body.data?.trends).toEqual([]);
  });

  it("should reject missing authentication for trends (401)", async () => {
    // Arrange
    const owner = await createTestUser();
    const group = await createTestGroup(owner.id);

    // Act
    const response = await get(
      app,
      `/v1/groups/${group.id}/analytics/trends`
    );

    // Assert
    expect(response.status).toBe(401);
  });
});

// ============================================================================
// Cross-endpoint Tests
// ============================================================================

describe("Analytics - Cross-endpoint consistency", () => {
  it("should have consistent totals across summary and categories", async () => {
    // Arrange
    const owner = await createTestUser();
    const group = await createTestGroup(owner.id);
    const auth = await loginUser(app, owner.email, owner.plainPassword);
    expect(auth).not.toBeNull();

    // Create some expenses
    await createTestExpense(group.id, group.ownerMemberId, group.ownerMemberId, {
      amount: 100,
      category: "food",
    });
    await createTestExpense(group.id, group.ownerMemberId, group.ownerMemberId, {
      amount: 50,
      category: "transport",
    });

    // Act
    const [summaryResponse, categoriesResponse] = await Promise.all([
      get<ApiResponse<SpendingSummaryResponse>>(
        app,
        `/v1/groups/${group.id}/analytics/summary`,
        { headers: authHeader(auth!.accessToken) }
      ),
      get<ApiResponse<CategoryAnalyticsResponse>>(
        app,
        `/v1/groups/${group.id}/analytics/categories`,
        { headers: authHeader(auth!.accessToken) }
      ),
    ]);

    // Assert - totals should match
    expect(summaryResponse.body.data?.totals.totalSpent).toBe(
      categoriesResponse.body.data?.totalSpent
    );
  });

  it("should allow regular member to view all analytics", async () => {
    // Arrange
    const owner = await createTestUser();
    const group = await createTestGroup(owner.id);
    const member = await createTestUser();
    await addTestMember(group.id, member.id, "member");

    const memberAuth = await loginUser(app, member.email, member.plainPassword);
    expect(memberAuth).not.toBeNull();

    // Act - Member should be able to access all analytics
    const [summaryResponse, categoriesResponse, trendsResponse] =
      await Promise.all([
        get(app, `/v1/groups/${group.id}/analytics/summary`, {
          headers: authHeader(memberAuth!.accessToken),
        }),
        get(app, `/v1/groups/${group.id}/analytics/categories`, {
          headers: authHeader(memberAuth!.accessToken),
        }),
        get(app, `/v1/groups/${group.id}/analytics/trends`, {
          headers: authHeader(memberAuth!.accessToken),
        }),
      ]);

    // Assert
    expect(summaryResponse.status).toBe(200);
    expect(categoriesResponse.status).toBe(200);
    expect(trendsResponse.status).toBe(200);
  });
});
