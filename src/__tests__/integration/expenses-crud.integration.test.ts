/**
 * Expenses CRUD Integration Tests
 * E2E Test Plan - Phase 1
 *
 * Tests for POST/GET/PUT/DELETE /v1/groups/:groupId/expenses endpoints
 */

import { describe, it, expect, beforeAll, afterAll } from "bun:test";
import {
  beforeAllTests,
  afterAllTests,
  testEmail,
  testId,
} from "./setup";
import { createTestUser, createTestGroup, addTestMember, createTestExpense, addTestSplits } from "./factories";
import {
  createTestApp,
  post,
  get,
  put,
  del,
  authHeader,
  registerUser,
  assertSuccess,
  assertError,
  type ApiResponse,
} from "./helpers";

// ============================================================================
// Test Setup
// ============================================================================

const app = createTestApp();

beforeAll(async () => {
  await beforeAllTests();
});

afterAll(async () => {
  await afterAllTests();
});

// ============================================================================
// Response Types
// ============================================================================

interface ExpenseResponse {
  id: string;
  title: string;
  amount: number;
  currency: string;
  category?: string;
  date?: string;
  createdAt: string;
  updatedAt?: string;
  splits?: Array<{
    userId: string;
    amount: number;
    shareMode: string;
  }>;
}

interface ExpenseListResponse {
  success: boolean;
  data: ExpenseResponse[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

// ============================================================================
// Helper: Login Test User
// ============================================================================

async function loginTestUser(user: { email: string | null; plainPassword: string }) {
  const loginResponse = await post<ApiResponse<{ tokens: { accessToken: string } }>>(
    app,
    "/v1/auth/login",
    { email: user.email, password: user.plainPassword }
  );
  return assertSuccess(loginResponse).tokens.accessToken;
}

// ============================================================================
// POST /v1/groups/:groupId/expenses Tests (Create Expense)
// ============================================================================

describe("POST /v1/groups/:groupId/expenses", () => {
  it("should create expense with required fields", async () => {
    // Arrange
    const owner = await createTestUser();
    const group = await createTestGroup(owner.id);
    const token = await loginTestUser(owner);

    // Act
    const response = await post<ApiResponse<ExpenseResponse>>(
      app,
      `/v1/groups/${group.id}/expenses`,
      {
        title: `Test Expense ${testId()}`,
        amount: 50.00,
        currency: "USD",
        paidBy: owner.id,
      },
      { headers: authHeader(token) }
    );

    // Assert
    expect(response.status).toBe(201);
    const data = assertSuccess(response);
    expect(data.id).toBeDefined();
    expect(data.amount).toBe(50);
    expect(data.currency).toBe("USD");
  });

  it("should create expense with all optional fields", async () => {
    // Arrange
    const owner = await createTestUser();
    const group = await createTestGroup(owner.id);
    const token = await loginTestUser(owner);
    const expenseDate = new Date().toISOString();

    // Act
    const response = await post<ApiResponse<ExpenseResponse>>(
      app,
      `/v1/groups/${group.id}/expenses`,
      {
        title: `Full Options Expense ${testId()}`,
        amount: 75.50,
        currency: "USD",
        paidBy: owner.id,
        description: "Test expense with all options",
        category: "food",
        date: expenseDate,
      },
      { headers: authHeader(token) }
    );

    // Assert
    expect(response.status).toBe(201);
    const data = assertSuccess(response);
    expect(data.category).toBe("food");
    expect(data.date).toBeDefined();
  });

  it("should validate payer is group member", async () => {
    // Arrange
    const owner = await createTestUser();
    const nonMember = await createTestUser();
    const group = await createTestGroup(owner.id);
    const token = await loginTestUser(owner);

    // Act - Try to use non-member as payer
    const response = await post<ApiResponse>(
      app,
      `/v1/groups/${group.id}/expenses`,
      {
        title: `Invalid Payer Expense ${testId()}`,
        amount: 50.00,
        currency: "USD",
        paidBy: nonMember.id,
      },
      { headers: authHeader(token) }
    );

    // Assert
    expect(response.status).toBe(400);
    expect(response.body.error?.message).toContain("not a member");
  });

  it("should validate currency code", async () => {
    // Arrange
    const owner = await createTestUser();
    const group = await createTestGroup(owner.id);
    const token = await loginTestUser(owner);

    // Act - Use invalid currency
    const response = await post<ApiResponse>(
      app,
      `/v1/groups/${group.id}/expenses`,
      {
        title: `Invalid Currency Expense ${testId()}`,
        amount: 50.00,
        currency: "INVALID",
        paidBy: owner.id,
      },
      { headers: authHeader(token) }
    );

    // Assert - Schema validation should fail for currency length
    expect(response.status).toBe(422);
  });

  it("should validate positive amount", async () => {
    // Arrange
    const owner = await createTestUser();
    const group = await createTestGroup(owner.id);
    const token = await loginTestUser(owner);

    // Act - Use negative amount
    const response = await post<ApiResponse>(
      app,
      `/v1/groups/${group.id}/expenses`,
      {
        title: `Negative Amount ${testId()}`,
        amount: -10.00,
        currency: "USD",
        paidBy: owner.id,
      },
      { headers: authHeader(token) }
    );

    // Assert - Schema validation should fail for minimum
    expect(response.status).toBe(422);
  });

  it("should reject non-member access (403)", async () => {
    // Arrange
    const owner = await createTestUser();
    const nonMember = await createTestUser();
    const group = await createTestGroup(owner.id);
    const nonMemberToken = await loginTestUser(nonMember);

    // Act
    const response = await post<ApiResponse>(
      app,
      `/v1/groups/${group.id}/expenses`,
      {
        title: `Non-Member Expense ${testId()}`,
        amount: 50.00,
        currency: "USD",
        paidBy: nonMember.id,
      },
      { headers: authHeader(nonMemberToken) }
    );

    // Assert
    assertError(response, 403, "NOT_MEMBER");
  });
});

// ============================================================================
// GET /v1/groups/:groupId/expenses Tests (List & Get Details)
// ============================================================================

describe("GET /v1/groups/:groupId/expenses", () => {
  it("should get expense details with splits", async () => {
    // Arrange
    const owner = await createTestUser();
    const member = await createTestUser();
    const group = await createTestGroup(owner.id);
    const memberRecord = await addTestMember(group.id, member.id, "member");
    const expense = await createTestExpense(group.id, group.ownerMemberId, group.ownerMemberId, { amount: 100 });
    await addTestSplits(expense.itemId, [group.ownerMemberId, memberRecord.id], "equal");

    const token = await loginTestUser(owner);

    // Act
    const response = await get<ApiResponse<any>>(
      app,
      `/v1/groups/${group.id}/expenses/${expense.id}`,
      { headers: authHeader(token) }
    );

    // Assert
    expect(response.status).toBe(200);
    const data = assertSuccess(response);
    expect(data.id).toBe(expense.id);
    expect(data.splits).toBeDefined();
    expect(Array.isArray(data.splits)).toBe(true);
  });

  it("should list expenses with pagination", async () => {
    // Arrange
    const owner = await createTestUser();
    const group = await createTestGroup(owner.id);
    const token = await loginTestUser(owner);

    // Create a few expenses
    for (let i = 0; i < 3; i++) {
      await createTestExpense(group.id, group.ownerMemberId, group.ownerMemberId, { amount: 10 * (i + 1) });
    }

    // Act
    const response = await get<ExpenseListResponse>(
      app,
      `/v1/groups/${group.id}/expenses`,
      {
        headers: authHeader(token),
        query: { page: "1", limit: "10" },
      }
    );

    // Assert
    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data).toBeDefined();
    expect(Array.isArray(response.body.data)).toBe(true);
    expect(response.body.pagination).toBeDefined();
    expect(response.body.pagination.page).toBe(1);
  });

  it("should filter expenses by category", async () => {
    // Arrange
    const owner = await createTestUser();
    const group = await createTestGroup(owner.id);
    const token = await loginTestUser(owner);

    // Create expenses with different categories
    await createTestExpense(group.id, group.ownerMemberId, group.ownerMemberId, { category: "food" });
    await createTestExpense(group.id, group.ownerMemberId, group.ownerMemberId, { category: "transport" });

    // Act
    const response = await get<ExpenseListResponse>(
      app,
      `/v1/groups/${group.id}/expenses`,
      {
        headers: authHeader(token),
        query: { category: "food" },
      }
    );

    // Assert
    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    // All returned expenses should have food category
    for (const expense of response.body.data) {
      expect(expense.category).toBe("food");
    }
  });

  it("should filter expenses by payer", async () => {
    // Arrange
    const owner = await createTestUser();
    const member = await createTestUser();
    const group = await createTestGroup(owner.id);
    const memberRecord = await addTestMember(group.id, member.id, "member");

    // Create expenses from different payers
    await createTestExpense(group.id, group.ownerMemberId, group.ownerMemberId, { amount: 50 });
    await createTestExpense(group.id, group.ownerMemberId, memberRecord.id, { amount: 30 });

    const token = await loginTestUser(owner);

    // Act - Filter by member
    const response = await get<ExpenseListResponse>(
      app,
      `/v1/groups/${group.id}/expenses`,
      {
        headers: authHeader(token),
        query: { paidBy: member.id },
      }
    );

    // Assert
    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
  });
});

// ============================================================================
// PUT /v1/groups/:groupId/expenses/:expenseId Tests (Update)
// ============================================================================

describe("PUT /v1/groups/:groupId/expenses/:expenseId", () => {
  it("should update expense as creator", async () => {
    // Arrange
    const owner = await createTestUser();
    const group = await createTestGroup(owner.id);
    const expense = await createTestExpense(group.id, group.ownerMemberId, group.ownerMemberId);
    const token = await loginTestUser(owner);
    const newTitle = `Updated Title ${testId()}`;

    // Act
    const response = await put<ApiResponse<ExpenseResponse>>(
      app,
      `/v1/groups/${group.id}/expenses/${expense.id}`,
      { title: newTitle },
      { headers: authHeader(token) }
    );

    // Assert
    expect(response.status).toBe(200);
    const data = assertSuccess(response);
    expect(data.title).toBe(newTitle);
  });

  it("should update expense as admin", async () => {
    // Arrange
    const owner = await createTestUser();
    const admin = await createTestUser();
    const group = await createTestGroup(owner.id);
    await addTestMember(group.id, admin.id, "admin");

    // Create expense as owner
    const expense = await createTestExpense(group.id, group.ownerMemberId, group.ownerMemberId);

    // Login as admin
    const adminToken = await loginTestUser(admin);
    const newTitle = `Admin Updated ${testId()}`;

    // Act
    const response = await put<ApiResponse<ExpenseResponse>>(
      app,
      `/v1/groups/${group.id}/expenses/${expense.id}`,
      { title: newTitle },
      { headers: authHeader(adminToken) }
    );

    // Assert
    expect(response.status).toBe(200);
    const data = assertSuccess(response);
    expect(data.title).toBe(newTitle);
  });

  it("should reject update from other member (403)", async () => {
    // Arrange
    const owner = await createTestUser();
    const member = await createTestUser();
    const group = await createTestGroup(owner.id);
    await addTestMember(group.id, member.id, "member");

    // Create expense as owner
    const expense = await createTestExpense(group.id, group.ownerMemberId, group.ownerMemberId);

    // Login as regular member
    const memberToken = await loginTestUser(member);

    // Act
    const response = await put<ApiResponse>(
      app,
      `/v1/groups/${group.id}/expenses/${expense.id}`,
      { title: `Member Update Attempt ${testId()}` },
      { headers: authHeader(memberToken) }
    );

    // Assert
    assertError(response, 403, "FORBIDDEN");
  });
});

// ============================================================================
// DELETE /v1/groups/:groupId/expenses/:expenseId Tests (Soft Delete)
// ============================================================================

describe("DELETE /v1/groups/:groupId/expenses/:expenseId", () => {
  it("should soft delete expense as creator", async () => {
    // Arrange
    const owner = await createTestUser();
    const group = await createTestGroup(owner.id);
    const expense = await createTestExpense(group.id, group.ownerMemberId, group.ownerMemberId);
    const token = await loginTestUser(owner);

    // Act
    const response = await del<ApiResponse<{ message: string; deletedAt: string }>>(
      app,
      `/v1/groups/${group.id}/expenses/${expense.id}`,
      { headers: authHeader(token) }
    );

    // Assert
    expect(response.status).toBe(200);
    const data = assertSuccess(response);
    expect(data.message).toBe("Expense deleted");
    expect(data.deletedAt).toBeDefined();

    // Verify expense is no longer accessible
    const getResponse = await get<ApiResponse>(
      app,
      `/v1/groups/${group.id}/expenses/${expense.id}`,
      { headers: authHeader(token) }
    );
    expect(getResponse.status).toBe(404);
  });

  it("should soft delete expense as admin", async () => {
    // Arrange
    const owner = await createTestUser();
    const admin = await createTestUser();
    const group = await createTestGroup(owner.id);
    await addTestMember(group.id, admin.id, "admin");

    // Create expense as owner
    const expense = await createTestExpense(group.id, group.ownerMemberId, group.ownerMemberId);

    // Login as admin
    const adminToken = await loginTestUser(admin);

    // Act
    const response = await del<ApiResponse<{ message: string; deletedAt: string }>>(
      app,
      `/v1/groups/${group.id}/expenses/${expense.id}`,
      { headers: authHeader(adminToken) }
    );

    // Assert
    expect(response.status).toBe(200);
    const data = assertSuccess(response);
    expect(data.message).toBe("Expense deleted");
  });

  it("should reject delete from regular member (403)", async () => {
    // Arrange
    const owner = await createTestUser();
    const member = await createTestUser();
    const group = await createTestGroup(owner.id);
    await addTestMember(group.id, member.id, "member");

    // Create expense as owner
    const expense = await createTestExpense(group.id, group.ownerMemberId, group.ownerMemberId);

    // Login as member
    const memberToken = await loginTestUser(member);

    // Act
    const response = await del<ApiResponse>(
      app,
      `/v1/groups/${group.id}/expenses/${expense.id}`,
      { headers: authHeader(memberToken) }
    );

    // Assert
    assertError(response, 403, "FORBIDDEN");
  });
});
