/**
 * Recurring Expenses Integration Tests
 * Phase 3 - E2E Testing
 *
 * Tests for recurring expense CRUD operations.
 *
 * AC-3.4: POST /groups/:groupId/recurring-expenses creates recurring rule
 * AC-3.5: GET /groups/:groupId/recurring-expenses lists all recurring rules
 * AC-3.6: GET /groups/:groupId/recurring-expenses/:id returns single rule
 * AC-3.7: PUT /groups/:groupId/recurring-expenses/:id updates rule
 * AC-3.8: DELETE /groups/:groupId/recurring-expenses/:id deactivates rule
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
  post,
  put,
  del,
  authHeader,
  loginUser,
  ApiResponse,
} from "./helpers";
import { createTestUser, createTestGroup, addTestMember } from "./factories";
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
// Helper Functions
// ============================================================================

interface RecurringExpenseResponse {
  id: string;
  groupId: string;
  name: string;
  amount: number;
  currencyCode: string;
  frequency: string;
  splitMode: string;
  isActive: boolean;
  payers: Array<{ memberId: string; amount: number }>;
  splits: Array<{ memberId: string; shareMode: string }>;
}

function createValidRecurringExpenseBody(
  memberId: string,
  options: {
    name?: string;
    amount?: number;
    frequency?: string;
    category?: string;
    description?: string;
  } = {}
) {
  const amount = options.amount || 100;
  return {
    name: options.name || `Recurring ${testId()}`,
    description: options.description,
    category: options.category || "utilities",
    amount,
    currencyCode: "USD",
    frequency: options.frequency || "monthly",
    dayOfMonth: 15,
    splitMode: "equal",
    startDate: new Date().toISOString(),
    payers: [{ memberId, amount }],
    splits: [{ memberId, shareMode: "equal", weight: 1 }],
  };
}

// ============================================================================
// Create Recurring Expense Tests (AC-3.4)
// ============================================================================

describe("POST /groups/:groupId/recurring-expenses - Create Recurring Expense", () => {
  it("should create recurring expense with required fields", async () => {
    // Arrange
    const owner = await createTestUser();
    const group = await createTestGroup(owner.id);
    const auth = await loginUser(app, owner.email, owner.plainPassword);
    expect(auth).not.toBeNull();

    const body = createValidRecurringExpenseBody(group.ownerMemberId);

    // Act
    const response = await post<ApiResponse<{ id: string }>>(
      app,
      `/v1/groups/${group.id}/recurring-expenses`,
      body,
      { headers: authHeader(auth!.accessToken) }
    );

    // Assert
    expect(response.status).toBe(201);
    expect(response.body.success).toBe(true);
    expect(response.body.data?.id).toBeDefined();
  });

  it("should create recurring expense with all optional fields", async () => {
    // Arrange
    const owner = await createTestUser();
    const group = await createTestGroup(owner.id);
    const auth = await loginUser(app, owner.email, owner.plainPassword);
    expect(auth).not.toBeNull();

    const body = {
      ...createValidRecurringExpenseBody(group.ownerMemberId),
      description: "Monthly rent payment",
      category: "accommodation",
      dayOfWeek: 1,
      dayOfMonth: 1,
      monthOfYear: 1,
      endDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
    };

    // Act
    const response = await post<ApiResponse<{ id: string }>>(
      app,
      `/v1/groups/${group.id}/recurring-expenses`,
      body,
      { headers: authHeader(auth!.accessToken) }
    );

    // Assert
    expect(response.status).toBe(201);
    expect(response.body.success).toBe(true);
  });

  it("should create daily recurring expense", async () => {
    // Arrange
    const owner = await createTestUser();
    const group = await createTestGroup(owner.id);
    const auth = await loginUser(app, owner.email, owner.plainPassword);
    expect(auth).not.toBeNull();

    const body = createValidRecurringExpenseBody(group.ownerMemberId, {
      frequency: "daily",
      name: "Daily Coffee",
    });

    // Act
    const response = await post<ApiResponse<{ id: string }>>(
      app,
      `/v1/groups/${group.id}/recurring-expenses`,
      body,
      { headers: authHeader(auth!.accessToken) }
    );

    // Assert
    expect(response.status).toBe(201);
  });

  it("should create weekly recurring expense", async () => {
    // Arrange
    const owner = await createTestUser();
    const group = await createTestGroup(owner.id);
    const auth = await loginUser(app, owner.email, owner.plainPassword);
    expect(auth).not.toBeNull();

    const body = {
      ...createValidRecurringExpenseBody(group.ownerMemberId, {
        frequency: "weekly",
      }),
      dayOfWeek: 5, // Friday
    };

    // Act
    const response = await post<ApiResponse<{ id: string }>>(
      app,
      `/v1/groups/${group.id}/recurring-expenses`,
      body,
      { headers: authHeader(auth!.accessToken) }
    );

    // Assert
    expect(response.status).toBe(201);
  });

  it("should create biweekly recurring expense", async () => {
    // Arrange
    const owner = await createTestUser();
    const group = await createTestGroup(owner.id);
    const auth = await loginUser(app, owner.email, owner.plainPassword);
    expect(auth).not.toBeNull();

    const body = createValidRecurringExpenseBody(group.ownerMemberId, {
      frequency: "biweekly",
    });

    // Act
    const response = await post<ApiResponse<{ id: string }>>(
      app,
      `/v1/groups/${group.id}/recurring-expenses`,
      body,
      { headers: authHeader(auth!.accessToken) }
    );

    // Assert
    expect(response.status).toBe(201);
  });

  it("should create yearly recurring expense", async () => {
    // Arrange
    const owner = await createTestUser();
    const group = await createTestGroup(owner.id);
    const auth = await loginUser(app, owner.email, owner.plainPassword);
    expect(auth).not.toBeNull();

    const body = {
      ...createValidRecurringExpenseBody(group.ownerMemberId, {
        frequency: "yearly",
        name: "Annual Insurance",
      }),
      monthOfYear: 6,
      dayOfMonth: 15,
    };

    // Act
    const response = await post<ApiResponse<{ id: string }>>(
      app,
      `/v1/groups/${group.id}/recurring-expenses`,
      body,
      { headers: authHeader(auth!.accessToken) }
    );

    // Assert
    expect(response.status).toBe(201);
  });

  it("should reject non-member access (403)", async () => {
    // Arrange
    const owner = await createTestUser();
    const group = await createTestGroup(owner.id);
    const nonMember = await createTestUser();
    const auth = await loginUser(app, nonMember.email, nonMember.plainPassword);
    expect(auth).not.toBeNull();

    const body = createValidRecurringExpenseBody(group.ownerMemberId);

    // Act
    const response = await post(
      app,
      `/v1/groups/${group.id}/recurring-expenses`,
      body,
      { headers: authHeader(auth!.accessToken) }
    );

    // Assert
    expect(response.status).toBe(403);
  });

  it("should reject invalid group (404)", async () => {
    // Arrange
    const owner = await createTestUser();
    const auth = await loginUser(app, owner.email, owner.plainPassword);
    expect(auth).not.toBeNull();

    // Use a valid UUID format that doesn't exist
    const nonExistentGroupId = "00000000-0000-0000-0000-000000000000";
    const body = createValidRecurringExpenseBody("00000000-0000-0000-0000-000000000001");

    // Act
    const response = await post(
      app,
      `/v1/groups/${nonExistentGroupId}/recurring-expenses`,
      body,
      { headers: authHeader(auth!.accessToken) }
    );

    // Assert
    expect(response.status).toBe(404);
  });

  it("should reject missing authentication (401)", async () => {
    // Arrange
    const owner = await createTestUser();
    const group = await createTestGroup(owner.id);
    const body = createValidRecurringExpenseBody(group.ownerMemberId);

    // Act
    const response = await post(
      app,
      `/v1/groups/${group.id}/recurring-expenses`,
      body
    );

    // Assert
    expect(response.status).toBe(401);
  });

  it("should reject when payer amounts don't sum to total", async () => {
    // Arrange
    const owner = await createTestUser();
    const group = await createTestGroup(owner.id);
    const auth = await loginUser(app, owner.email, owner.plainPassword);
    expect(auth).not.toBeNull();

    const body = {
      ...createValidRecurringExpenseBody(group.ownerMemberId),
      amount: 100,
      payers: [{ memberId: group.ownerMemberId, amount: 50 }], // Only 50, not 100
    };

    // Act
    const response = await post(
      app,
      `/v1/groups/${group.id}/recurring-expenses`,
      body,
      { headers: authHeader(auth!.accessToken) }
    );

    // Assert
    expect(response.status).toBe(400);
  });

  it("should reject invalid startDate format", async () => {
    // Arrange
    const owner = await createTestUser();
    const group = await createTestGroup(owner.id);
    const auth = await loginUser(app, owner.email, owner.plainPassword);
    expect(auth).not.toBeNull();

    const body = {
      ...createValidRecurringExpenseBody(group.ownerMemberId),
      startDate: "not-a-date",
    };

    // Act
    const response = await post(
      app,
      `/v1/groups/${group.id}/recurring-expenses`,
      body,
      { headers: authHeader(auth!.accessToken) }
    );

    // Assert
    expect(response.status).toBe(400);
  });
});

// ============================================================================
// List Recurring Expenses Tests (AC-3.5)
// ============================================================================

describe("GET /groups/:groupId/recurring-expenses - List Recurring Expenses", () => {
  it("should list recurring expenses for group member", async () => {
    // Arrange
    const owner = await createTestUser();
    const group = await createTestGroup(owner.id);
    const auth = await loginUser(app, owner.email, owner.plainPassword);
    expect(auth).not.toBeNull();

    // Create some recurring expenses
    const body1 = createValidRecurringExpenseBody(group.ownerMemberId, {
      name: "Rent",
    });
    const body2 = createValidRecurringExpenseBody(group.ownerMemberId, {
      name: "Utilities",
    });

    await post(app, `/v1/groups/${group.id}/recurring-expenses`, body1, {
      headers: authHeader(auth!.accessToken),
    });
    await post(app, `/v1/groups/${group.id}/recurring-expenses`, body2, {
      headers: authHeader(auth!.accessToken),
    });

    // Act
    const response = await get<
      ApiResponse<{ recurringExpenses: RecurringExpenseResponse[]; count: number }>
    >(app, `/v1/groups/${group.id}/recurring-expenses`, {
      headers: authHeader(auth!.accessToken),
    });

    // Assert
    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data?.recurringExpenses.length).toBeGreaterThanOrEqual(2);
    expect(response.body.data?.count).toBeGreaterThanOrEqual(2);
  });

  it("should return empty array for group with no recurring expenses", async () => {
    // Arrange
    const owner = await createTestUser();
    const group = await createTestGroup(owner.id);
    const auth = await loginUser(app, owner.email, owner.plainPassword);
    expect(auth).not.toBeNull();

    // Act
    const response = await get<
      ApiResponse<{ recurringExpenses: RecurringExpenseResponse[]; count: number }>
    >(app, `/v1/groups/${group.id}/recurring-expenses`, {
      headers: authHeader(auth!.accessToken),
    });

    // Assert
    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data?.recurringExpenses).toEqual([]);
    expect(response.body.data?.count).toBe(0);
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
      `/v1/groups/${group.id}/recurring-expenses`,
      { headers: authHeader(auth!.accessToken) }
    );

    // Assert
    expect(response.status).toBe(403);
  });
});

// ============================================================================
// Get Single Recurring Expense Tests (AC-3.6)
// ============================================================================

describe("GET /groups/:groupId/recurring-expenses/:recurringId - Get Single", () => {
  it("should return recurring expense details with payers and splits", async () => {
    // Arrange
    const owner = await createTestUser();
    const group = await createTestGroup(owner.id);
    const auth = await loginUser(app, owner.email, owner.plainPassword);
    expect(auth).not.toBeNull();

    // Create a recurring expense
    const body = createValidRecurringExpenseBody(group.ownerMemberId, {
      name: "Monthly Rent",
      amount: 1500,
      category: "accommodation",
    });

    const createResponse = await post<ApiResponse<{ id: string }>>(
      app,
      `/v1/groups/${group.id}/recurring-expenses`,
      body,
      { headers: authHeader(auth!.accessToken) }
    );
    const recurringId = createResponse.body.data?.id;
    expect(recurringId).toBeDefined();

    // Act
    const response = await get<ApiResponse<RecurringExpenseResponse>>(
      app,
      `/v1/groups/${group.id}/recurring-expenses/${recurringId}`,
      { headers: authHeader(auth!.accessToken) }
    );

    // Assert
    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data?.name).toBe("Monthly Rent");
    expect(response.body.data?.amount).toBe(1500);
    expect(response.body.data?.currencyCode).toBe("USD");
    expect(response.body.data?.frequency).toBe("monthly");
    expect(response.body.data?.payers).toBeDefined();
    expect(response.body.data?.splits).toBeDefined();
  });

  it("should reject non-existent recurring expense (404)", async () => {
    // Arrange
    const owner = await createTestUser();
    const group = await createTestGroup(owner.id);
    const auth = await loginUser(app, owner.email, owner.plainPassword);
    expect(auth).not.toBeNull();

    // Use a valid UUID format that doesn't exist
    const nonExistentRecurringId = "00000000-0000-0000-0000-000000000000";

    // Act
    const response = await get(
      app,
      `/v1/groups/${group.id}/recurring-expenses/${nonExistentRecurringId}`,
      { headers: authHeader(auth!.accessToken) }
    );

    // Assert
    expect(response.status).toBe(404);
  });

  it("should reject access to recurring expense from different group (404)", async () => {
    // Arrange
    const owner1 = await createTestUser();
    const group1 = await createTestGroup(owner1.id);
    const owner2 = await createTestUser();
    const group2 = await createTestGroup(owner2.id);

    const auth1 = await loginUser(app, owner1.email, owner1.plainPassword);
    const auth2 = await loginUser(app, owner2.email, owner2.plainPassword);
    expect(auth1).not.toBeNull();
    expect(auth2).not.toBeNull();

    // Create recurring expense in group1
    const body = createValidRecurringExpenseBody(group1.ownerMemberId);
    const createResponse = await post<ApiResponse<{ id: string }>>(
      app,
      `/v1/groups/${group1.id}/recurring-expenses`,
      body,
      { headers: authHeader(auth1!.accessToken) }
    );
    const recurringId = createResponse.body.data?.id;

    // Act - Try to access from group2
    const response = await get(
      app,
      `/v1/groups/${group2.id}/recurring-expenses/${recurringId}`,
      { headers: authHeader(auth2!.accessToken) }
    );

    // Assert
    expect(response.status).toBe(404);
  });
});

// ============================================================================
// Update Recurring Expense Tests (AC-3.7)
// ============================================================================

describe("PUT /groups/:groupId/recurring-expenses/:recurringId - Update", () => {
  it("should update recurring expense name", async () => {
    // Arrange
    const owner = await createTestUser();
    const group = await createTestGroup(owner.id);
    const auth = await loginUser(app, owner.email, owner.plainPassword);
    expect(auth).not.toBeNull();

    // Create a recurring expense
    const body = createValidRecurringExpenseBody(group.ownerMemberId, {
      name: "Old Name",
    });
    const createResponse = await post<ApiResponse<{ id: string }>>(
      app,
      `/v1/groups/${group.id}/recurring-expenses`,
      body,
      { headers: authHeader(auth!.accessToken) }
    );
    const recurringId = createResponse.body.data?.id;

    // Act
    const response = await put<ApiResponse<RecurringExpenseResponse>>(
      app,
      `/v1/groups/${group.id}/recurring-expenses/${recurringId}`,
      { name: "New Name" },
      { headers: authHeader(auth!.accessToken) }
    );

    // Assert
    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data?.name).toBe("New Name");
  });

  it("should update recurring expense amount and currency", async () => {
    // Arrange
    const owner = await createTestUser();
    const group = await createTestGroup(owner.id);
    const auth = await loginUser(app, owner.email, owner.plainPassword);
    expect(auth).not.toBeNull();

    // Create a recurring expense
    const body = createValidRecurringExpenseBody(group.ownerMemberId);
    const createResponse = await post<ApiResponse<{ id: string }>>(
      app,
      `/v1/groups/${group.id}/recurring-expenses`,
      body,
      { headers: authHeader(auth!.accessToken) }
    );
    const recurringId = createResponse.body.data?.id;

    // Act
    const response = await put<ApiResponse<RecurringExpenseResponse>>(
      app,
      `/v1/groups/${group.id}/recurring-expenses/${recurringId}`,
      { amount: 200, currencyCode: "EUR" },
      { headers: authHeader(auth!.accessToken) }
    );

    // Assert
    expect(response.status).toBe(200);
    expect(response.body.data?.amount).toBe(200);
    expect(response.body.data?.currencyCode).toBe("EUR");
  });

  it("should update frequency", async () => {
    // Arrange
    const owner = await createTestUser();
    const group = await createTestGroup(owner.id);
    const auth = await loginUser(app, owner.email, owner.plainPassword);
    expect(auth).not.toBeNull();

    // Create a monthly recurring expense
    const body = createValidRecurringExpenseBody(group.ownerMemberId, {
      frequency: "monthly",
    });
    const createResponse = await post<ApiResponse<{ id: string }>>(
      app,
      `/v1/groups/${group.id}/recurring-expenses`,
      body,
      { headers: authHeader(auth!.accessToken) }
    );
    const recurringId = createResponse.body.data?.id;

    // Act - Change to weekly
    const response = await put<ApiResponse<RecurringExpenseResponse>>(
      app,
      `/v1/groups/${group.id}/recurring-expenses/${recurringId}`,
      { frequency: "weekly" },
      { headers: authHeader(auth!.accessToken) }
    );

    // Assert
    expect(response.status).toBe(200);
    expect(response.body.data?.frequency).toBe("weekly");
  });

  it("should update category", async () => {
    // Arrange
    const owner = await createTestUser();
    const group = await createTestGroup(owner.id);
    const auth = await loginUser(app, owner.email, owner.plainPassword);
    expect(auth).not.toBeNull();

    // Create a recurring expense
    const body = createValidRecurringExpenseBody(group.ownerMemberId, {
      category: "utilities",
    });
    const createResponse = await post<ApiResponse<{ id: string }>>(
      app,
      `/v1/groups/${group.id}/recurring-expenses`,
      body,
      { headers: authHeader(auth!.accessToken) }
    );
    const recurringId = createResponse.body.data?.id;

    // Act
    const response = await put<ApiResponse<RecurringExpenseResponse>>(
      app,
      `/v1/groups/${group.id}/recurring-expenses/${recurringId}`,
      { category: "entertainment" },
      { headers: authHeader(auth!.accessToken) }
    );

    // Assert
    expect(response.status).toBe(200);
  });

  it("should reject update from non-member (403)", async () => {
    // Arrange
    const owner = await createTestUser();
    const group = await createTestGroup(owner.id);
    const ownerAuth = await loginUser(app, owner.email, owner.plainPassword);
    expect(ownerAuth).not.toBeNull();

    // Create a recurring expense
    const body = createValidRecurringExpenseBody(group.ownerMemberId);
    const createResponse = await post<ApiResponse<{ id: string }>>(
      app,
      `/v1/groups/${group.id}/recurring-expenses`,
      body,
      { headers: authHeader(ownerAuth!.accessToken) }
    );
    const recurringId = createResponse.body.data?.id;

    // Try to update as non-member
    const nonMember = await createTestUser();
    const nonMemberAuth = await loginUser(app, nonMember.email, nonMember.plainPassword);
    expect(nonMemberAuth).not.toBeNull();

    // Act
    const response = await put(
      app,
      `/v1/groups/${group.id}/recurring-expenses/${recurringId}`,
      { name: "Hacked Name" },
      { headers: authHeader(nonMemberAuth!.accessToken) }
    );

    // Assert
    expect(response.status).toBe(403);
  });

  it("should reject update of non-existent recurring expense (404)", async () => {
    // Arrange
    const owner = await createTestUser();
    const group = await createTestGroup(owner.id);
    const auth = await loginUser(app, owner.email, owner.plainPassword);
    expect(auth).not.toBeNull();

    // Use a valid UUID format that doesn't exist
    const nonExistentRecurringId = "00000000-0000-0000-0000-000000000000";

    // Act
    const response = await put(
      app,
      `/v1/groups/${group.id}/recurring-expenses/${nonExistentRecurringId}`,
      { name: "New Name" },
      { headers: authHeader(auth!.accessToken) }
    );

    // Assert
    expect(response.status).toBe(404);
  });
});

// ============================================================================
// Delete (Deactivate) Recurring Expense Tests (AC-3.8)
// ============================================================================

describe("DELETE /groups/:groupId/recurring-expenses/:recurringId - Deactivate", () => {
  it("should deactivate recurring expense", async () => {
    // Arrange
    const owner = await createTestUser();
    const group = await createTestGroup(owner.id);
    const auth = await loginUser(app, owner.email, owner.plainPassword);
    expect(auth).not.toBeNull();

    // Create a recurring expense
    const body = createValidRecurringExpenseBody(group.ownerMemberId);
    const createResponse = await post<ApiResponse<{ id: string }>>(
      app,
      `/v1/groups/${group.id}/recurring-expenses`,
      body,
      { headers: authHeader(auth!.accessToken) }
    );
    const recurringId = createResponse.body.data?.id;

    // Act
    const response = await del<ApiResponse<{ message: string }>>(
      app,
      `/v1/groups/${group.id}/recurring-expenses/${recurringId}`,
      { headers: authHeader(auth!.accessToken) }
    );

    // Assert
    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data?.message).toBe("Recurring expense deactivated");

    // Verify it's deactivated by fetching it
    const getResponse = await get<ApiResponse<RecurringExpenseResponse>>(
      app,
      `/v1/groups/${group.id}/recurring-expenses/${recurringId}`,
      { headers: authHeader(auth!.accessToken) }
    );
    expect(getResponse.body.data?.isActive).toBe(false);
  });

  it("should reject deactivate from non-member (403)", async () => {
    // Arrange
    const owner = await createTestUser();
    const group = await createTestGroup(owner.id);
    const ownerAuth = await loginUser(app, owner.email, owner.plainPassword);
    expect(ownerAuth).not.toBeNull();

    // Create a recurring expense
    const body = createValidRecurringExpenseBody(group.ownerMemberId);
    const createResponse = await post<ApiResponse<{ id: string }>>(
      app,
      `/v1/groups/${group.id}/recurring-expenses`,
      body,
      { headers: authHeader(ownerAuth!.accessToken) }
    );
    const recurringId = createResponse.body.data?.id;

    // Try to delete as non-member
    const nonMember = await createTestUser();
    const nonMemberAuth = await loginUser(app, nonMember.email, nonMember.plainPassword);
    expect(nonMemberAuth).not.toBeNull();

    // Act
    const response = await del(
      app,
      `/v1/groups/${group.id}/recurring-expenses/${recurringId}`,
      { headers: authHeader(nonMemberAuth!.accessToken) }
    );

    // Assert
    expect(response.status).toBe(403);
  });

  it("should reject deactivate of non-existent recurring expense (404)", async () => {
    // Arrange
    const owner = await createTestUser();
    const group = await createTestGroup(owner.id);
    const auth = await loginUser(app, owner.email, owner.plainPassword);
    expect(auth).not.toBeNull();

    // Use a valid UUID format that doesn't exist
    const nonExistentRecurringId = "00000000-0000-0000-0000-000000000000";

    // Act
    const response = await del(
      app,
      `/v1/groups/${group.id}/recurring-expenses/${nonExistentRecurringId}`,
      { headers: authHeader(auth!.accessToken) }
    );

    // Assert
    expect(response.status).toBe(404);
  });

  it("should allow member to deactivate recurring expense", async () => {
    // Arrange
    const owner = await createTestUser();
    const group = await createTestGroup(owner.id);
    const member = await createTestUser();
    await addTestMember(group.id, member.id, "member");

    const ownerAuth = await loginUser(app, owner.email, owner.plainPassword);
    const memberAuth = await loginUser(app, member.email, member.plainPassword);
    expect(ownerAuth).not.toBeNull();
    expect(memberAuth).not.toBeNull();

    // Create a recurring expense as owner
    const body = createValidRecurringExpenseBody(group.ownerMemberId);
    const createResponse = await post<ApiResponse<{ id: string }>>(
      app,
      `/v1/groups/${group.id}/recurring-expenses`,
      body,
      { headers: authHeader(ownerAuth!.accessToken) }
    );
    const recurringId = createResponse.body.data?.id;

    // Act - Delete as member
    const response = await del(
      app,
      `/v1/groups/${group.id}/recurring-expenses/${recurringId}`,
      { headers: authHeader(memberAuth!.accessToken) }
    );

    // Assert - Members can deactivate (no special permission check)
    expect(response.status).toBe(200);
  });
});

// ============================================================================
// Multi-Member Recurring Expense Tests
// ============================================================================

describe("Multi-member recurring expenses", () => {
  it("should create recurring expense with multiple payers", async () => {
    // Arrange
    const owner = await createTestUser();
    const group = await createTestGroup(owner.id);
    const member = await createTestUser();
    const memberRecord = await addTestMember(group.id, member.id);

    const auth = await loginUser(app, owner.email, owner.plainPassword);
    expect(auth).not.toBeNull();

    const body = {
      name: "Shared Rent",
      amount: 1000,
      currencyCode: "USD",
      frequency: "monthly",
      dayOfMonth: 1,
      splitMode: "equal",
      startDate: new Date().toISOString(),
      payers: [
        { memberId: group.ownerMemberId, amount: 500 },
        { memberId: memberRecord.id, amount: 500 },
      ],
      splits: [
        { memberId: group.ownerMemberId, shareMode: "equal", weight: 1 },
        { memberId: memberRecord.id, shareMode: "equal", weight: 1 },
      ],
    };

    // Act
    const response = await post<ApiResponse<{ id: string }>>(
      app,
      `/v1/groups/${group.id}/recurring-expenses`,
      body,
      { headers: authHeader(auth!.accessToken) }
    );

    // Assert
    expect(response.status).toBe(201);
  });

  it("should create recurring expense with weighted splits", async () => {
    // Arrange
    const owner = await createTestUser();
    const group = await createTestGroup(owner.id);
    const member = await createTestUser();
    const memberRecord = await addTestMember(group.id, member.id);

    const auth = await loginUser(app, owner.email, owner.plainPassword);
    expect(auth).not.toBeNull();

    const body = {
      name: "Weighted Utility Bill",
      amount: 150,
      currencyCode: "USD",
      frequency: "monthly",
      dayOfMonth: 15,
      splitMode: "weight",
      startDate: new Date().toISOString(),
      payers: [{ memberId: group.ownerMemberId, amount: 150 }],
      splits: [
        { memberId: group.ownerMemberId, shareMode: "weight", weight: 2 },
        { memberId: memberRecord.id, shareMode: "weight", weight: 1 },
      ],
    };

    // Act
    const response = await post<ApiResponse<{ id: string }>>(
      app,
      `/v1/groups/${group.id}/recurring-expenses`,
      body,
      { headers: authHeader(auth!.accessToken) }
    );

    // Assert
    expect(response.status).toBe(201);
  });
});
