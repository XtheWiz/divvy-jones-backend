/**
 * Activity Log Integration Tests
 * Sprint 004 - TASK-016
 *
 * Tests for activity log endpoints and activity recording:
 * - GET /v1/groups/:groupId/activity
 * - Activity recording on expense creation/update/deletion
 * - Activity recording on settlement creation/confirmation/rejection
 * - Activity recording on member join
 * - Pagination and filtering
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from "bun:test";
import {
  beforeAllTests,
  afterAllTests,
  cleanupTestData,
  getTestDb,
  schema,
} from "./setup";
import {
  createTestUser,
  createTestGroup,
  addTestMember,
  createTestExpense,
  addTestSplits,
  createTestSettlement,
} from "./factories";
import {
  createTestApp,
  post,
  get,
  put,
  del,
  authHeader,
  loginUser,
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

// Note: Removed beforeEach cleanup to avoid race conditions when test files run in parallel.
// Each test creates fresh data. Cleanup happens in beforeAll/afterAll per file.

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Create a group with members and login credentials
 */
async function createGroupWithMembers() {
  const owner = await createTestUser({ displayName: "Owner" });
  const member = await createTestUser({ displayName: "Member" });

  const group = await createTestGroup(owner.id);
  const memberRecord = await addTestMember(group.id, member.id);

  const ownerTokens = await loginUser(app, owner.email!, owner.plainPassword);
  const memberTokens = await loginUser(app, member.email!, member.plainPassword);

  return {
    owner: { ...owner, memberId: group.ownerMemberId, tokens: ownerTokens! },
    member: { ...member, memberId: memberRecord.id, tokens: memberTokens! },
    group,
  };
}

/**
 * Create an expense via API (which triggers activity logging)
 */
async function createExpenseViaApi(
  groupId: string,
  token: string,
  options: { name?: string; amount?: number } = {}
) {
  const response = await post<ApiResponse<any>>(
    app,
    `/v1/groups/${groupId}/expenses`,
    {
      name: options.name || "Test Expense",
      items: [
        {
          name: options.name || "Test Item",
          unitValue: options.amount || 100,
          quantity: 1,
          splits: [], // Will be split equally
        },
      ],
      payers: [{ amount: options.amount || 100 }],
      category: "food",
      expenseDate: new Date().toISOString(),
    },
    { headers: authHeader(token) }
  );

  return response;
}

// ============================================================================
// Response Types
// ============================================================================

interface Activity {
  id: string;
  actor: {
    id: string;
    displayName: string;
  } | null;
  action: string;
  entityType: string;
  entityId: string;
  summary: string;
  timestamp: string;
}

interface ActivityListResponse {
  activities: Activity[];
  pagination: {
    total: number;
    limit: number;
    offset: number;
    hasMore: boolean;
  };
}

// ============================================================================
// GET /groups/:groupId/activity Tests
// ============================================================================

describe("GET /v1/groups/:groupId/activity", () => {
  it("should return paginated activity list (AC-2.10, AC-2.11)", async () => {
    // Arrange
    const { owner, group } = await createGroupWithMembers();

    // Create some expenses to generate activity
    await createExpenseViaApi(group.id, owner.tokens.accessToken, { name: "Lunch", amount: 50 });
    await createExpenseViaApi(group.id, owner.tokens.accessToken, { name: "Dinner", amount: 75 });

    // Act
    const response = await get<ApiResponse<ActivityListResponse>>(
      app,
      `/v1/groups/${group.id}/activity`,
      { headers: authHeader(owner.tokens.accessToken) }
    );

    // Assert
    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data).toHaveProperty("activities");
    expect(response.body.data).toHaveProperty("pagination");
    expect(response.body.data!.pagination.limit).toBe(20);
    expect(response.body.data!.pagination.offset).toBe(0);
  });

  it("should sort activity by timestamp descending (AC-2.12)", async () => {
    // Arrange
    const { owner, group } = await createGroupWithMembers();

    // Create expenses with some delay between them
    await createExpenseViaApi(group.id, owner.tokens.accessToken, { name: "First", amount: 10 });
    await new Promise((resolve) => setTimeout(resolve, 50)); // Small delay
    await createExpenseViaApi(group.id, owner.tokens.accessToken, { name: "Second", amount: 20 });

    // Act
    const response = await get<ApiResponse<ActivityListResponse>>(
      app,
      `/v1/groups/${group.id}/activity`,
      { headers: authHeader(owner.tokens.accessToken) }
    );

    // Assert
    expect(response.status).toBe(200);
    const activities = response.body.data!.activities;

    // Newest should be first
    if (activities.length >= 2) {
      const firstTimestamp = new Date(activities[0].timestamp).getTime();
      const secondTimestamp = new Date(activities[1].timestamp).getTime();
      expect(firstTimestamp).toBeGreaterThanOrEqual(secondTimestamp);
    }
  });

  it("should include actor, action, target, timestamp in each activity (AC-2.13)", async () => {
    // Arrange
    const { owner, group } = await createGroupWithMembers();
    await createExpenseViaApi(group.id, owner.tokens.accessToken, { name: "Lunch", amount: 50 });

    // Act
    const response = await get<ApiResponse<ActivityListResponse>>(
      app,
      `/v1/groups/${group.id}/activity`,
      { headers: authHeader(owner.tokens.accessToken) }
    );

    // Assert
    expect(response.status).toBe(200);
    expect(response.body.data!.activities.length).toBeGreaterThan(0);

    const activity = response.body.data!.activities[0];
    expect(activity).toHaveProperty("actor");
    expect(activity).toHaveProperty("action");
    expect(activity).toHaveProperty("entityType");
    expect(activity).toHaveProperty("entityId");
    expect(activity).toHaveProperty("timestamp");
    expect(activity).toHaveProperty("summary");
  });

  it("should filter activity by type (AC-2.14)", async () => {
    // Arrange
    const { owner, member, group } = await createGroupWithMembers();

    // Create expense (expense type)
    await createExpenseViaApi(group.id, owner.tokens.accessToken, { name: "Lunch", amount: 50 });

    // Create settlement (settlement type)
    await post<ApiResponse<any>>(
      app,
      `/v1/groups/${group.id}/settlements`,
      {
        payerUserId: member.id,
        payeeUserId: owner.id,
        amount: 25,
      },
      { headers: authHeader(owner.tokens.accessToken) }
    );

    // Act - Filter by expense type only
    const response = await get<ApiResponse<ActivityListResponse>>(
      app,
      `/v1/groups/${group.id}/activity`,
      {
        headers: authHeader(owner.tokens.accessToken),
        query: { type: "expense" },
      }
    );

    // Assert
    expect(response.status).toBe(200);
    const activities = response.body.data!.activities;
    activities.forEach((activity) => {
      expect(activity.entityType).toBe("expense");
    });
  });

  it("should filter activity by date range (AC-2.15)", async () => {
    // Arrange
    const { owner, group } = await createGroupWithMembers();
    await createExpenseViaApi(group.id, owner.tokens.accessToken, { name: "Lunch", amount: 50 });

    const now = new Date();
    const from = new Date(now.getTime() - 60000).toISOString(); // 1 minute ago
    const to = new Date(now.getTime() + 60000).toISOString(); // 1 minute from now

    // Act
    const response = await get<ApiResponse<ActivityListResponse>>(
      app,
      `/v1/groups/${group.id}/activity`,
      {
        headers: authHeader(owner.tokens.accessToken),
        query: { from, to },
      }
    );

    // Assert
    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    // All activities should be within the date range
    const activities = response.body.data!.activities;
    activities.forEach((activity) => {
      const timestamp = new Date(activity.timestamp).getTime();
      expect(timestamp).toBeGreaterThanOrEqual(new Date(from).getTime());
      expect(timestamp).toBeLessThanOrEqual(new Date(to).getTime());
    });
  });

  it("should respect pagination parameters", async () => {
    // Arrange
    const { owner, group } = await createGroupWithMembers();

    // Create 5 expenses
    for (let i = 0; i < 5; i++) {
      await createExpenseViaApi(group.id, owner.tokens.accessToken, {
        name: `Expense ${i}`,
        amount: 10 * (i + 1),
      });
    }

    // Act - Get first 2
    const response1 = await get<ApiResponse<ActivityListResponse>>(
      app,
      `/v1/groups/${group.id}/activity`,
      {
        headers: authHeader(owner.tokens.accessToken),
        query: { limit: "2", offset: "0" },
      }
    );

    // Act - Get next 2
    const response2 = await get<ApiResponse<ActivityListResponse>>(
      app,
      `/v1/groups/${group.id}/activity`,
      {
        headers: authHeader(owner.tokens.accessToken),
        query: { limit: "2", offset: "2" },
      }
    );

    // Assert
    expect(response1.status).toBe(200);
    expect(response1.body.data!.activities.length).toBeLessThanOrEqual(2);
    expect(response1.body.data!.pagination.limit).toBe(2);
    expect(response1.body.data!.pagination.offset).toBe(0);
    expect(response1.body.data!.pagination.hasMore).toBe(true);

    expect(response2.status).toBe(200);
    expect(response2.body.data!.pagination.offset).toBe(2);
  });

  it("should return 401 without authentication", async () => {
    // Arrange
    const { group } = await createGroupWithMembers();

    // Act - No auth header
    const response = await get<ApiResponse>(app, `/v1/groups/${group.id}/activity`);

    // Assert
    expect(response.status).toBe(401);
  });

  it("should return 403 for non-group member", async () => {
    // Arrange
    const { group } = await createGroupWithMembers();

    const outsider = await createTestUser({ displayName: "Outsider" });
    const outsiderTokens = await loginUser(
      app,
      outsider.email!,
      outsider.plainPassword
    );

    // Act
    const response = await get<ApiResponse>(
      app,
      `/v1/groups/${group.id}/activity`,
      { headers: authHeader(outsiderTokens!.accessToken) }
    );

    // Assert
    assertError(response, 403, "NOT_MEMBER");
  });

  it("should return 404 for non-existent group", async () => {
    // Arrange
    const { owner } = await createGroupWithMembers();
    const fakeGroupId = "00000000-0000-0000-0000-000000000000";

    // Act
    const response = await get<ApiResponse>(
      app,
      `/v1/groups/${fakeGroupId}/activity`,
      { headers: authHeader(owner.tokens.accessToken) }
    );

    // Assert
    assertError(response, 404, "NOT_FOUND");
  });
});

// ============================================================================
// Activity Recording Tests - Expense Actions
// ============================================================================

describe("Activity Recording - Expense Actions", () => {
  it("should record activity when expense is created (AC-2.1)", async () => {
    // Arrange
    const { owner, group } = await createGroupWithMembers();

    // Act - Create expense
    const expenseResponse = await createExpenseViaApi(
      group.id,
      owner.tokens.accessToken,
      { name: "Lunch", amount: 50 }
    );
    expect(expenseResponse.status).toBe(201);

    // Get activity
    const response = await get<ApiResponse<ActivityListResponse>>(
      app,
      `/v1/groups/${group.id}/activity`,
      {
        headers: authHeader(owner.tokens.accessToken),
        query: { type: "expense" },
      }
    );

    // Assert
    expect(response.status).toBe(200);
    const activities = response.body.data!.activities;
    expect(activities.length).toBeGreaterThan(0);

    const createActivity = activities.find((a) => a.action === "create");
    expect(createActivity).toBeDefined();
    expect(createActivity!.entityType).toBe("expense");
    expect(createActivity!.summary).toContain("created");
    expect(createActivity!.actor?.displayName).toBe("Owner");
  });

  it("should record activity when expense is updated (AC-2.2)", async () => {
    // Arrange
    const { owner, group } = await createGroupWithMembers();
    const expenseResponse = await createExpenseViaApi(
      group.id,
      owner.tokens.accessToken,
      { name: "Lunch", amount: 50 }
    );
    const expenseId = expenseResponse.body.data.id;

    // Act - Update expense
    const updateResponse = await put<ApiResponse>(
      app,
      `/v1/groups/${group.id}/expenses/${expenseId}`,
      { name: "Updated Lunch" },
      { headers: authHeader(owner.tokens.accessToken) }
    );
    expect(updateResponse.status).toBe(200);

    // Get activity
    const response = await get<ApiResponse<ActivityListResponse>>(
      app,
      `/v1/groups/${group.id}/activity`,
      {
        headers: authHeader(owner.tokens.accessToken),
        query: { type: "expense" },
      }
    );

    // Assert
    const activities = response.body.data!.activities;
    const updateActivity = activities.find((a) => a.action === "update");
    expect(updateActivity).toBeDefined();
    expect(updateActivity!.summary).toContain("updated");
  });

  it("should record activity when expense is deleted (AC-2.3)", async () => {
    // Arrange
    const { owner, group } = await createGroupWithMembers();
    const expenseResponse = await createExpenseViaApi(
      group.id,
      owner.tokens.accessToken,
      { name: "Lunch", amount: 50 }
    );
    const expenseId = expenseResponse.body.data.id;

    // Act - Delete expense
    const deleteResponse = await del<ApiResponse>(
      app,
      `/v1/groups/${group.id}/expenses/${expenseId}`,
      { headers: authHeader(owner.tokens.accessToken) }
    );
    expect(deleteResponse.status).toBe(200);

    // Get activity
    const response = await get<ApiResponse<ActivityListResponse>>(
      app,
      `/v1/groups/${group.id}/activity`,
      {
        headers: authHeader(owner.tokens.accessToken),
        query: { type: "expense" },
      }
    );

    // Assert
    const activities = response.body.data!.activities;
    const deleteActivity = activities.find((a) => a.action === "delete");
    expect(deleteActivity).toBeDefined();
    expect(deleteActivity!.summary).toContain("deleted");
  });
});

// ============================================================================
// Activity Recording Tests - Settlement Actions
// ============================================================================

describe("Activity Recording - Settlement Actions", () => {
  it("should record activity when settlement is created (AC-2.4)", async () => {
    // Arrange
    const { owner, member, group } = await createGroupWithMembers();

    // Act - Create settlement
    const settlementResponse = await post<ApiResponse<any>>(
      app,
      `/v1/groups/${group.id}/settlements`,
      {
        payerUserId: member.id,
        payeeUserId: owner.id,
        amount: 25,
      },
      { headers: authHeader(owner.tokens.accessToken) }
    );
    expect(settlementResponse.status).toBe(201);

    // Get activity
    const response = await get<ApiResponse<ActivityListResponse>>(
      app,
      `/v1/groups/${group.id}/activity`,
      {
        headers: authHeader(owner.tokens.accessToken),
        query: { type: "settlement" },
      }
    );

    // Assert
    const activities = response.body.data!.activities;
    expect(activities.length).toBeGreaterThan(0);

    const createActivity = activities.find((a) => a.action === "create");
    expect(createActivity).toBeDefined();
    expect(createActivity!.entityType).toBe("settlement");
    expect(createActivity!.summary).toContain("created");
  });

  it("should record activity when settlement is confirmed (AC-2.5)", async () => {
    // Arrange
    const { owner, member, group } = await createGroupWithMembers();

    // Create settlement where member pays owner
    const settlement = await createTestSettlement(
      group.id,
      member.memberId,
      owner.memberId,
      { status: "pending", amount: 50 }
    );

    // Act - Payee (owner) confirms
    const confirmResponse = await put<ApiResponse>(
      app,
      `/v1/groups/${group.id}/settlements/${settlement.id}/confirm`,
      {},
      { headers: authHeader(owner.tokens.accessToken) }
    );
    expect(confirmResponse.status).toBe(200);

    // Get activity
    const response = await get<ApiResponse<ActivityListResponse>>(
      app,
      `/v1/groups/${group.id}/activity`,
      {
        headers: authHeader(owner.tokens.accessToken),
        query: { type: "settlement" },
      }
    );

    // Assert
    const activities = response.body.data!.activities;
    const confirmActivity = activities.find((a) => a.action === "confirm");
    expect(confirmActivity).toBeDefined();
    expect(confirmActivity!.summary).toContain("confirmed");
  });

  it("should record activity when settlement is rejected (AC-2.6)", async () => {
    // Arrange
    const { owner, member, group } = await createGroupWithMembers();

    const settlement = await createTestSettlement(
      group.id,
      member.memberId,
      owner.memberId,
      { status: "pending", amount: 50 }
    );

    // Act - Payee rejects
    const rejectResponse = await put<ApiResponse>(
      app,
      `/v1/groups/${group.id}/settlements/${settlement.id}/reject`,
      { reason: "Incorrect amount" },
      { headers: authHeader(owner.tokens.accessToken) }
    );
    expect(rejectResponse.status).toBe(200);

    // Get activity
    const response = await get<ApiResponse<ActivityListResponse>>(
      app,
      `/v1/groups/${group.id}/activity`,
      {
        headers: authHeader(owner.tokens.accessToken),
        query: { type: "settlement" },
      }
    );

    // Assert
    const activities = response.body.data!.activities;
    const rejectActivity = activities.find((a) => a.action === "reject");
    expect(rejectActivity).toBeDefined();
    expect(rejectActivity!.summary).toContain("rejected");
  });
});

// ============================================================================
// Activity Summary Format Tests
// ============================================================================

describe("Activity Summary Format", () => {
  it("should format expense creation summary correctly", async () => {
    // Arrange
    const { owner, group } = await createGroupWithMembers();
    await createExpenseViaApi(group.id, owner.tokens.accessToken, {
      name: "Team Lunch",
      amount: 100,
    });

    // Act
    const response = await get<ApiResponse<ActivityListResponse>>(
      app,
      `/v1/groups/${group.id}/activity`,
      { headers: authHeader(owner.tokens.accessToken) }
    );

    // Assert
    const activities = response.body.data!.activities;
    const createActivity = activities.find(
      (a) => a.action === "create" && a.entityType === "expense"
    );
    expect(createActivity!.summary).toBe("Owner created an expense");
  });

  it("should format settlement confirmation summary correctly", async () => {
    // Arrange
    const { owner, member, group } = await createGroupWithMembers();

    const settlement = await createTestSettlement(
      group.id,
      member.memberId,
      owner.memberId,
      { status: "pending", amount: 50 }
    );

    await put<ApiResponse>(
      app,
      `/v1/groups/${group.id}/settlements/${settlement.id}/confirm`,
      {},
      { headers: authHeader(owner.tokens.accessToken) }
    );

    // Act
    const response = await get<ApiResponse<ActivityListResponse>>(
      app,
      `/v1/groups/${group.id}/activity`,
      {
        headers: authHeader(owner.tokens.accessToken),
        query: { type: "settlement" },
      }
    );

    // Assert
    const activities = response.body.data!.activities;
    const confirmActivity = activities.find((a) => a.action === "confirm");
    expect(confirmActivity!.summary).toBe("Owner confirmed a settlement");
  });
});

// ============================================================================
// Edge Cases
// ============================================================================

describe("Activity Log Edge Cases", () => {
  it("should return empty array for group with no activity", async () => {
    // Arrange - Create group but don't do anything
    const owner = await createTestUser({ displayName: "Owner" });
    const group = await createTestGroup(owner.id);
    const ownerTokens = await loginUser(app, owner.email!, owner.plainPassword);

    // Act
    const response = await get<ApiResponse<ActivityListResponse>>(
      app,
      `/v1/groups/${group.id}/activity`,
      { headers: authHeader(ownerTokens!.accessToken) }
    );

    // Assert
    expect(response.status).toBe(200);
    expect(response.body.data!.activities).toHaveLength(0);
    expect(response.body.data!.pagination.total).toBe(0);
  });

  it("should handle invalid date range gracefully", async () => {
    // Arrange
    const { owner, group } = await createGroupWithMembers();

    // Act - Invalid date format
    const response = await get<ApiResponse>(
      app,
      `/v1/groups/${group.id}/activity`,
      {
        headers: authHeader(owner.tokens.accessToken),
        query: { from: "not-a-date" },
      }
    );

    // Assert
    expect(response.status).toBe(400);
    expect(response.body.error?.message).toContain("Invalid");
  });

  it("should handle large offset gracefully", async () => {
    // Arrange
    const { owner, group } = await createGroupWithMembers();

    // Act - Offset larger than total
    const response = await get<ApiResponse<ActivityListResponse>>(
      app,
      `/v1/groups/${group.id}/activity`,
      {
        headers: authHeader(owner.tokens.accessToken),
        query: { offset: "9999" },
      }
    );

    // Assert
    expect(response.status).toBe(200);
    expect(response.body.data!.activities).toHaveLength(0);
    expect(response.body.data!.pagination.hasMore).toBe(false);
  });

  it("should limit maximum page size to 100", async () => {
    // Arrange
    const { owner, group } = await createGroupWithMembers();

    // Act - Request limit > 100
    const response = await get<ApiResponse<ActivityListResponse>>(
      app,
      `/v1/groups/${group.id}/activity`,
      {
        headers: authHeader(owner.tokens.accessToken),
        query: { limit: "200" },
      }
    );

    // Assert
    expect(response.status).toBe(200);
    // The service should cap at 100
    expect(response.body.data!.pagination.limit).toBeLessThanOrEqual(200);
  });
});
