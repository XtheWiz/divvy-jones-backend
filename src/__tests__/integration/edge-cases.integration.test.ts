/**
 * Edge Cases Integration Tests
 * Phase 5 - E2E Testing
 *
 * Tests boundary conditions, unicode handling, and edge scenarios.
 */

import { describe, it, expect, beforeAll, afterAll } from "bun:test";
import {
  createTestApp,
  get,
  post,
  put,
  authHeader,
  loginUser,
  ApiResponse,
} from "./helpers";
import { beforeAllTests, afterAllTests } from "./setup";
import { createTestUser, createTestGroup, addTestMember } from "./factories";

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
// Unicode and Special Character Tests
// ============================================================================

describe("Edge Cases - Unicode and Special Characters", () => {
  it("should accept unicode characters in group name", async () => {
    const user = await createTestUser();
    const tokens = await loginUser(app, user.email, user.plainPassword);
    expect(tokens).not.toBeNull();

    const response = await post(
      app,
      "/v1/groups",
      { name: "日本語グループ 🎉", description: "Unicode test group" },
      { headers: authHeader(tokens!.accessToken) }
    );

    expect(response.status).toBe(201);
    expect(response.body.success).toBe(true);
    expect((response.body as ApiResponse<{ name: string }>).data?.name).toBe("日本語グループ 🎉");
  });

  it("should accept unicode characters in expense title", async () => {
    const user = await createTestUser();
    const group = await createTestGroup(user.id);
    const tokens = await loginUser(app, user.email, user.plainPassword);
    expect(tokens).not.toBeNull();

    const response = await post(
      app,
      `/v1/groups/${group.id}/expenses`,
      {
        title: "晚餐费用 🍜",
        amount: 50.00,
        currency: "USD",
        paidBy: user.id,
      },
      { headers: authHeader(tokens!.accessToken) }
    );

    expect(response.status).toBe(201);
    expect(response.body.success).toBe(true);
  });

  it("should accept special characters in display name", async () => {
    const response = await post(app, "/v1/auth/register", {
      email: `special-${Date.now()}@example.com`,
      password: "TestPass123",
      displayName: "O'Brien-Smith & Co.",
    });

    expect(response.status).toBe(201);
    expect(response.body.success).toBe(true);
    expect((response.body as ApiResponse<{ user: { displayName: string } }>).data?.user.displayName).toBe("O'Brien-Smith & Co.");
  });

  it("should handle emoji-only group name", async () => {
    const user = await createTestUser();
    const tokens = await loginUser(app, user.email, user.plainPassword);
    expect(tokens).not.toBeNull();

    const response = await post(
      app,
      "/v1/groups",
      { name: "🏠🎉🍕" },
      { headers: authHeader(tokens!.accessToken) }
    );

    expect(response.status).toBe(201);
    expect((response.body as ApiResponse<{ name: string }>).data?.name).toBe("🏠🎉🍕");
  });
});

// ============================================================================
// Amount Boundary Tests
// ============================================================================

describe("Edge Cases - Amount Boundaries", () => {
  it("should accept minimum amount (0.01)", async () => {
    const user = await createTestUser();
    const group = await createTestGroup(user.id);
    const tokens = await loginUser(app, user.email, user.plainPassword);
    expect(tokens).not.toBeNull();

    const response = await post(
      app,
      `/v1/groups/${group.id}/expenses`,
      {
        title: "Minimum expense",
        amount: 0.01,
        currency: "USD",
        paidBy: user.id,
      },
      { headers: authHeader(tokens!.accessToken) }
    );

    expect(response.status).toBe(201);
    expect(response.body.success).toBe(true);
  });

  it("should reject zero amount", async () => {
    const user = await createTestUser();
    const group = await createTestGroup(user.id);
    const tokens = await loginUser(app, user.email, user.plainPassword);
    expect(tokens).not.toBeNull();

    const response = await post(
      app,
      `/v1/groups/${group.id}/expenses`,
      {
        title: "Zero expense",
        amount: 0,
        currency: "USD",
        paidBy: user.id,
      },
      { headers: authHeader(tokens!.accessToken) }
    );

    expect(response.status).toBe(422);
  });

  it("should reject negative amount", async () => {
    const user = await createTestUser();
    const group = await createTestGroup(user.id);
    const tokens = await loginUser(app, user.email, user.plainPassword);
    expect(tokens).not.toBeNull();

    const response = await post(
      app,
      `/v1/groups/${group.id}/expenses`,
      {
        title: "Negative expense",
        amount: -10.00,
        currency: "USD",
        paidBy: user.id,
      },
      { headers: authHeader(tokens!.accessToken) }
    );

    expect(response.status).toBe(422);
  });

  it("should handle large amounts", async () => {
    const user = await createTestUser();
    const group = await createTestGroup(user.id);
    const tokens = await loginUser(app, user.email, user.plainPassword);
    expect(tokens).not.toBeNull();

    const response = await post(
      app,
      `/v1/groups/${group.id}/expenses`,
      {
        title: "Large expense",
        amount: 999999.99,
        currency: "USD",
        paidBy: user.id,
      },
      { headers: authHeader(tokens!.accessToken) }
    );

    expect(response.status).toBe(201);
    expect(response.body.success).toBe(true);
  });

  it("should preserve decimal precision", async () => {
    const user = await createTestUser();
    const group = await createTestGroup(user.id);
    const tokens = await loginUser(app, user.email, user.plainPassword);
    expect(tokens).not.toBeNull();

    const response = await post(
      app,
      `/v1/groups/${group.id}/expenses`,
      {
        title: "Precision test",
        amount: 123.45,
        currency: "USD",
        paidBy: user.id,
      },
      { headers: authHeader(tokens!.accessToken) }
    );

    expect(response.status).toBe(201);
    const data = (response.body as ApiResponse<{ amount: number }>).data;
    expect(data?.amount).toBe(123.45);
  });
});

// ============================================================================
// Pagination Edge Cases
// ============================================================================

describe("Edge Cases - Pagination", () => {
  it("should return empty list for page beyond results", async () => {
    const user = await createTestUser();
    const tokens = await loginUser(app, user.email, user.plainPassword);
    expect(tokens).not.toBeNull();

    const response = await get(
      app,
      "/v1/groups",
      {
        headers: authHeader(tokens!.accessToken),
        query: { page: "999", limit: "10" },
      }
    );

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
  });

  it("should handle page 1 correctly", async () => {
    const user = await createTestUser();
    const tokens = await loginUser(app, user.email, user.plainPassword);
    expect(tokens).not.toBeNull();

    // Create a group
    await post(
      app,
      "/v1/groups",
      { name: "Test Group" },
      { headers: authHeader(tokens!.accessToken) }
    );

    const response = await get(
      app,
      "/v1/groups",
      {
        headers: authHeader(tokens!.accessToken),
        query: { page: "1", limit: "10" },
      }
    );

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
  });

  it("should handle limit of 1", async () => {
    const user = await createTestUser();
    const tokens = await loginUser(app, user.email, user.plainPassword);
    expect(tokens).not.toBeNull();

    // Create two groups
    await post(
      app,
      "/v1/groups",
      { name: "Group 1" },
      { headers: authHeader(tokens!.accessToken) }
    );
    await post(
      app,
      "/v1/groups",
      { name: "Group 2" },
      { headers: authHeader(tokens!.accessToken) }
    );

    const response = await get(
      app,
      "/v1/groups",
      {
        headers: authHeader(tokens!.accessToken),
        query: { page: "1", limit: "1" },
      }
    );

    expect(response.status).toBe(200);
  });
});

// ============================================================================
// String Length Boundary Tests
// ============================================================================

describe("Edge Cases - String Lengths", () => {
  it("should accept maximum length group name (100 chars)", async () => {
    const user = await createTestUser();
    const tokens = await loginUser(app, user.email, user.plainPassword);
    expect(tokens).not.toBeNull();

    const longName = "A".repeat(100);
    const response = await post(
      app,
      "/v1/groups",
      { name: longName },
      { headers: authHeader(tokens!.accessToken) }
    );

    expect(response.status).toBe(201);
    expect((response.body as ApiResponse<{ name: string }>).data?.name).toBe(longName);
  });

  it("should reject group name exceeding maximum length", async () => {
    const user = await createTestUser();
    const tokens = await loginUser(app, user.email, user.plainPassword);
    expect(tokens).not.toBeNull();

    const tooLongName = "A".repeat(101);
    const response = await post(
      app,
      "/v1/groups",
      { name: tooLongName },
      { headers: authHeader(tokens!.accessToken) }
    );

    expect(response.status).toBe(422);
  });

  it("should reject empty group name", async () => {
    const user = await createTestUser();
    const tokens = await loginUser(app, user.email, user.plainPassword);
    expect(tokens).not.toBeNull();

    const response = await post(
      app,
      "/v1/groups",
      { name: "" },
      { headers: authHeader(tokens!.accessToken) }
    );

    expect(response.status).toBe(422);
  });

  it("should reject whitespace-only group name", async () => {
    const user = await createTestUser();
    const tokens = await loginUser(app, user.email, user.plainPassword);
    expect(tokens).not.toBeNull();

    const response = await post(
      app,
      "/v1/groups",
      { name: "   " },
      { headers: authHeader(tokens!.accessToken) }
    );

    // May be trimmed to empty or rejected
    expect([400, 422]).toContain(response.status);
  });
});

// ============================================================================
// Date Edge Cases
// ============================================================================

describe("Edge Cases - Date Handling", () => {
  it("should accept expense date in the past", async () => {
    const user = await createTestUser();
    const group = await createTestGroup(user.id);
    const tokens = await loginUser(app, user.email, user.plainPassword);
    expect(tokens).not.toBeNull();

    const response = await post(
      app,
      `/v1/groups/${group.id}/expenses`,
      {
        title: "Past expense",
        amount: 25.00,
        currency: "USD",
        paidBy: user.id,
        date: "2020-01-15",
      },
      { headers: authHeader(tokens!.accessToken) }
    );

    expect(response.status).toBe(201);
  });

  it("should handle leap year date (Feb 29)", async () => {
    const user = await createTestUser();
    const group = await createTestGroup(user.id);
    const tokens = await loginUser(app, user.email, user.plainPassword);
    expect(tokens).not.toBeNull();

    const response = await post(
      app,
      `/v1/groups/${group.id}/expenses`,
      {
        title: "Leap year expense",
        amount: 29.00,
        currency: "USD",
        paidBy: user.id,
        date: "2024-02-29",
      },
      { headers: authHeader(tokens!.accessToken) }
    );

    expect(response.status).toBe(201);
  });

  it("should handle date range filters at boundaries", async () => {
    const user = await createTestUser();
    const group = await createTestGroup(user.id);
    const tokens = await loginUser(app, user.email, user.plainPassword);
    expect(tokens).not.toBeNull();

    // Query with same start and end date
    const response = await get(
      app,
      `/v1/groups/${group.id}/analytics/summary`,
      {
        headers: authHeader(tokens!.accessToken),
        query: {
          startDate: "2024-01-01",
          endDate: "2024-01-01",
        },
      }
    );

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
  });
});

// ============================================================================
// Empty Collection Edge Cases
// ============================================================================

describe("Edge Cases - Empty Collections", () => {
  it("should return empty expenses list for new group", async () => {
    const user = await createTestUser();
    const group = await createTestGroup(user.id);
    const tokens = await loginUser(app, user.email, user.plainPassword);
    expect(tokens).not.toBeNull();

    const response = await get(
      app,
      `/v1/groups/${group.id}/expenses`,
      { headers: authHeader(tokens!.accessToken) }
    );

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
  });

  it("should return empty settlements list for new group", async () => {
    const user = await createTestUser();
    const group = await createTestGroup(user.id);
    const tokens = await loginUser(app, user.email, user.plainPassword);
    expect(tokens).not.toBeNull();

    const response = await get(
      app,
      `/v1/groups/${group.id}/settlements`,
      { headers: authHeader(tokens!.accessToken) }
    );

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
  });

  it("should return empty analytics for group with no expenses", async () => {
    const user = await createTestUser();
    const group = await createTestGroup(user.id);
    const tokens = await loginUser(app, user.email, user.plainPassword);
    expect(tokens).not.toBeNull();

    const response = await get(
      app,
      `/v1/groups/${group.id}/analytics/summary`,
      { headers: authHeader(tokens!.accessToken) }
    );

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
  });

  it("should return zero balances for group with no activity", async () => {
    const user = await createTestUser();
    const group = await createTestGroup(user.id);
    const tokens = await loginUser(app, user.email, user.plainPassword);
    expect(tokens).not.toBeNull();

    const response = await get(
      app,
      `/v1/groups/${group.id}/balances`,
      { headers: authHeader(tokens!.accessToken) }
    );

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
  });
});

// ============================================================================
// Multiple Member Edge Cases
// ============================================================================

describe("Edge Cases - Multiple Members", () => {
  it("should handle expense with equal split among multiple members", async () => {
    const owner = await createTestUser();
    const member = await createTestUser();
    const group = await createTestGroup(owner.id);
    await addTestMember(group.id, member.id);

    const tokens = await loginUser(app, owner.email, owner.plainPassword);
    expect(tokens).not.toBeNull();

    const response = await post(
      app,
      `/v1/groups/${group.id}/expenses`,
      {
        title: "Split expense",
        amount: 100.00,
        currency: "USD",
        paidBy: owner.id,
        splits: { type: "equal" },
      },
      { headers: authHeader(tokens!.accessToken) }
    );

    expect(response.status).toBe(201);
    expect(response.body.success).toBe(true);
  });

  it("should handle group with exactly two members", async () => {
    const owner = await createTestUser();
    const member = await createTestUser();
    const group = await createTestGroup(owner.id);
    await addTestMember(group.id, member.id);

    const tokens = await loginUser(app, owner.email, owner.plainPassword);
    expect(tokens).not.toBeNull();

    // Get balances for group with two members
    const response = await get(
      app,
      `/v1/groups/${group.id}/balances`,
      { headers: authHeader(tokens!.accessToken) }
    );

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
  });
});
