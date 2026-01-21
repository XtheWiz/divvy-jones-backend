/**
 * Export Integration Tests
 * Sprint 006 - TASK-003
 *
 * Tests for export endpoints:
 * - GET /v1/groups/:groupId/export/csv
 * - GET /v1/groups/:groupId/export/json
 *
 * AC-0.10: Integration tests exist for export endpoints (CSV/JSON)
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from "bun:test";
import {
  beforeAllTests,
  afterAllTests,
  cleanupTestData,
} from "./setup";
import {
  createTestUser,
  createTestGroup,
  createTestExpense,
  addTestMember,
  addTestSplits,
} from "./factories";
import {
  createTestApp,
  get,
  post,
  authHeader,
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

async function loginAndGetToken(email: string, password: string): Promise<string> {
  const response = await post<ApiResponse<{ accessToken: string }>>(
    app,
    "/v1/auth/login",
    { email, password }
  );

  if (!response.body.success || !response.body.data) {
    throw new Error(`Login failed: ${JSON.stringify(response.body)}`);
  }

  return response.body.data.accessToken;
}

async function createTestScenarioWithExpenses() {
  // Create users
  const owner = await createTestUser({ displayName: "Group Owner" });
  const member = await createTestUser({ displayName: "Group Member" });
  const nonMember = await createTestUser({ displayName: "Non Member" });

  // Create group
  const group = await createTestGroup(owner.id, { name: "Test Export Group" });

  // Add member
  const memberRecord = await addTestMember(group.id, member.id);

  // Create expense
  const expense = await createTestExpense(
    group.id,
    group.ownerMemberId,
    group.ownerMemberId,
    { name: "Test Expense", amount: 100 }
  );

  // Add splits
  await addTestSplits(expense.itemId, [group.ownerMemberId, memberRecord.id], "equal");

  return {
    owner,
    member,
    nonMember,
    group,
    expense,
    memberRecord,
  };
}

// ============================================================================
// GET /v1/groups/:groupId/export/csv Tests
// ============================================================================

describe("GET /v1/groups/:groupId/export/csv", () => {
  it("should export expenses as CSV for group member", async () => {
    // Arrange
    const scenario = await createTestScenarioWithExpenses();
    const token = await loginAndGetToken(
      scenario.owner.email!,
      scenario.owner.plainPassword
    );

    // Act
    const response = await get<string>(
      app,
      `/v1/groups/${scenario.group.id}/export/csv`,
      { headers: authHeader(token) }
    );

    // Assert
    expect(response.status).toBe(200);

    // Check Content-Type header
    const contentType = response.headers.get("content-type");
    expect(contentType).toContain("text/csv");

    // Check Content-Disposition header (file download)
    const contentDisposition = response.headers.get("content-disposition");
    expect(contentDisposition).toContain("attachment");
    expect(contentDisposition).toContain(".csv");

    // Check CSV content
    const csv = response.body as unknown as string;
    expect(csv).toContain("Date");
    expect(csv).toContain("Description");
    expect(csv).toContain("Amount");
    expect(csv).toContain("Test Expense");
  });

  it("should support date range filtering", async () => {
    // Arrange
    const scenario = await createTestScenarioWithExpenses();
    const token = await loginAndGetToken(
      scenario.owner.email!,
      scenario.owner.plainPassword
    );

    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    // Act - filter to future dates (should return empty)
    const response = await get<string>(
      app,
      `/v1/groups/${scenario.group.id}/export/csv`,
      {
        headers: authHeader(token),
        query: {
          startDate: tomorrow.toISOString().split("T")[0],
          endDate: tomorrow.toISOString().split("T")[0],
        },
      }
    );

    // Assert
    expect(response.status).toBe(200);

    // CSV should have headers but no expense data (filtered out)
    const csv = response.body as unknown as string;
    const lines = csv.trim().split("\n");
    expect(lines.length).toBe(1); // Just headers, no data rows
  });

  it("should reject unauthenticated requests", async () => {
    // Arrange
    const scenario = await createTestScenarioWithExpenses();

    // Act - no auth header
    const response = await get<ApiResponse>(
      app,
      `/v1/groups/${scenario.group.id}/export/csv`
    );

    // Assert
    expect(response.status).toBe(401);
  });

  it("should reject non-members", async () => {
    // Arrange
    const scenario = await createTestScenarioWithExpenses();
    const token = await loginAndGetToken(
      scenario.nonMember.email!,
      scenario.nonMember.plainPassword
    );

    // Act
    const response = await get<ApiResponse>(
      app,
      `/v1/groups/${scenario.group.id}/export/csv`,
      { headers: authHeader(token) }
    );

    // Assert
    expect(response.status).toBe(403);
    expect(response.body.error?.code).toBe("FORBIDDEN");
  });

  it("should return 404 for non-existent group", async () => {
    // Arrange
    const owner = await createTestUser();
    const token = await loginAndGetToken(owner.email!, owner.plainPassword);

    // Act
    const response = await get<ApiResponse>(
      app,
      "/v1/groups/00000000-0000-0000-0000-000000000000/export/csv",
      { headers: authHeader(token) }
    );

    // Assert
    expect(response.status).toBe(404);
  });
});

// ============================================================================
// GET /v1/groups/:groupId/export/json Tests
// ============================================================================

describe("GET /v1/groups/:groupId/export/json", () => {
  it("should export expenses as JSON for group member", async () => {
    // Arrange
    const scenario = await createTestScenarioWithExpenses();
    const token = await loginAndGetToken(
      scenario.owner.email!,
      scenario.owner.plainPassword
    );

    // Act
    const response = await get<Record<string, unknown>>(
      app,
      `/v1/groups/${scenario.group.id}/export/json`,
      { headers: authHeader(token) }
    );

    // Assert
    expect(response.status).toBe(200);

    // Check Content-Type header
    const contentType = response.headers.get("content-type");
    expect(contentType).toContain("application/json");

    // Check Content-Disposition header (file download)
    const contentDisposition = response.headers.get("content-disposition");
    expect(contentDisposition).toContain("attachment");
    expect(contentDisposition).toContain(".json");

    // Check JSON content structure
    const json = response.body as Record<string, unknown>;
    expect(json.groupId).toBe(scenario.group.id);
    expect(json.groupName).toBe("Test Export Group");
    expect(json.expenses).toBeArray();
    expect((json.expenses as unknown[]).length).toBeGreaterThan(0);
  });

  it("should include expense details in JSON export", async () => {
    // Arrange
    const scenario = await createTestScenarioWithExpenses();
    const token = await loginAndGetToken(
      scenario.owner.email!,
      scenario.owner.plainPassword
    );

    // Act
    const response = await get<Record<string, unknown>>(
      app,
      `/v1/groups/${scenario.group.id}/export/json`,
      { headers: authHeader(token) }
    );

    // Assert
    const json = response.body as Record<string, unknown>;
    const expenses = json.expenses as Array<Record<string, unknown>>;

    expect(expenses[0].id).toBeDefined();
    expect(expenses[0].name).toBe("Test Expense");
    expect(expenses[0].subtotal).toBeDefined();
    expect(expenses[0].currencyCode).toBe("USD");
  });

  it("should support date range filtering", async () => {
    // Arrange
    const scenario = await createTestScenarioWithExpenses();
    const token = await loginAndGetToken(
      scenario.owner.email!,
      scenario.owner.plainPassword
    );

    const pastDate = new Date();
    pastDate.setFullYear(pastDate.getFullYear() - 1);

    // Act - filter to past dates (expense is today, should not match)
    const response = await get<Record<string, unknown>>(
      app,
      `/v1/groups/${scenario.group.id}/export/json`,
      {
        headers: authHeader(token),
        query: {
          startDate: pastDate.toISOString().split("T")[0],
          endDate: pastDate.toISOString().split("T")[0],
        },
      }
    );

    // Assert
    expect(response.status).toBe(200);
    const json = response.body as Record<string, unknown>;
    expect((json.expenses as unknown[]).length).toBe(0);
  });

  it("should reject unauthenticated requests", async () => {
    // Arrange
    const scenario = await createTestScenarioWithExpenses();

    // Act - no auth header
    const response = await get<ApiResponse>(
      app,
      `/v1/groups/${scenario.group.id}/export/json`
    );

    // Assert
    expect(response.status).toBe(401);
  });

  it("should reject non-members", async () => {
    // Arrange
    const scenario = await createTestScenarioWithExpenses();
    const token = await loginAndGetToken(
      scenario.nonMember.email!,
      scenario.nonMember.plainPassword
    );

    // Act
    const response = await get<ApiResponse>(
      app,
      `/v1/groups/${scenario.group.id}/export/json`,
      { headers: authHeader(token) }
    );

    // Assert
    expect(response.status).toBe(403);
    expect(response.body.error?.code).toBe("FORBIDDEN");
  });
});
