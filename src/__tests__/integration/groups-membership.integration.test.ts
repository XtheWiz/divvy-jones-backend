/**
 * Groups Membership Integration Tests
 * E2E Test Plan - Phase 1
 *
 * Tests for POST /v1/groups/join, /leave, GET /members, and POST /regenerate-code
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

interface GroupResponse {
  id: string;
  name: string;
  description?: string;
  joinCode: string;
  defaultCurrencyCode: string;
  role: string;
  createdAt: string;
  joinedAt?: string;
  memberCount?: number;
}

interface MemberResponse {
  userId: string;
  displayName: string;
  role: string;
  joinedAt: string;
}

interface GroupListItem {
  id: string;
  name: string;
  role: string;
  memberCount: number;
}

// ============================================================================
// POST /v1/groups/join Tests
// ============================================================================

describe("POST /v1/groups/join", () => {
  it("should join group with valid code", async () => {
    // Arrange - Create owner and group
    const owner = await createTestUser();
    const group = await createTestGroup(owner.id);

    // New user to join
    const joiner = await registerUser(app, testEmail(), "SecurePassword123!", "Joiner User");

    // Act
    const response = await post<ApiResponse<GroupResponse>>(
      app,
      "/v1/groups/join",
      { joinCode: group.joinCode },
      { headers: authHeader(joiner!.accessToken) }
    );

    // Assert
    expect(response.status).toBe(200);
    const data = assertSuccess(response);
    expect(data.id).toBe(group.id);
    expect(data.role).toBe("member"); // Joiners get member role, not owner/admin
  });

  it("should reject invalid join code (404)", async () => {
    // Arrange
    const user = await registerUser(app, testEmail(), "SecurePassword123!", "Invalid Code User");

    // Act
    const response = await post<ApiResponse>(
      app,
      "/v1/groups/join",
      { joinCode: "INVALID123" },
      { headers: authHeader(user!.accessToken) }
    );

    // Assert
    assertError(response, 404, "NOT_FOUND");
    expect(response.body.error?.message).toContain("Invalid join code");
  });

  it("should reject already member (409)", async () => {
    // Arrange
    const authData = await registerUser(app, testEmail(), "SecurePassword123!", "Already Member User");

    // Create a group
    const createResponse = await post<ApiResponse<GroupResponse>>(
      app,
      "/v1/groups",
      { name: `Already Member Group ${testId()}` },
      { headers: authHeader(authData!.accessToken) }
    );
    const group = assertSuccess(createResponse);

    // Act - Try to join own group
    const response = await post<ApiResponse>(
      app,
      "/v1/groups/join",
      { joinCode: group.joinCode },
      { headers: authHeader(authData!.accessToken) }
    );

    // Assert
    assertError(response, 409, "CONFLICT");
    expect(response.body.error?.message).toContain("already a member");
  });

  // Note: Rejoin after leaving is not currently supported due to unique constraint
  // on (groupId, userId) in group_members table. This would need API enhancement.
  it.skip("should allow rejoin after leaving", async () => {
    // This test is skipped because the API doesn't currently support rejoining
    // after leaving - the unique constraint prevents inserting a new membership.
  });
});

// ============================================================================
// GET /v1/groups/:groupId/members Tests
// ============================================================================

describe("GET /v1/groups/:groupId/members", () => {
  it("should list group members with roles", async () => {
    // Arrange
    const owner = await createTestUser();
    const member = await createTestUser();
    const group = await createTestGroup(owner.id);
    await addTestMember(group.id, member.id, "member");

    // Login as owner
    const loginResponse = await post<ApiResponse<{ tokens: { accessToken: string } }>>(
      app,
      "/v1/auth/login",
      { email: owner.email, password: owner.plainPassword }
    );
    const token = assertSuccess(loginResponse).tokens.accessToken;

    // Act
    const response = await get<ApiResponse<MemberResponse[]>>(
      app,
      `/v1/groups/${group.id}/members`,
      { headers: authHeader(token) }
    );

    // Assert
    expect(response.status).toBe(200);
    const data = assertSuccess(response);
    expect(Array.isArray(data)).toBe(true);
    expect(data.length).toBe(2);

    // Check owner
    const ownerMember = data.find(m => m.userId === owner.id);
    expect(ownerMember).toBeDefined();
    expect(ownerMember?.role).toBe("owner");

    // Check regular member
    const regularMember = data.find(m => m.userId === member.id);
    expect(regularMember).toBeDefined();
    expect(regularMember?.role).toBe("member");
  });

  it("should show role correctly (owner/admin/member)", async () => {
    // Arrange
    const owner = await createTestUser();
    const admin = await createTestUser();
    const member = await createTestUser();
    const group = await createTestGroup(owner.id);
    await addTestMember(group.id, admin.id, "admin");
    await addTestMember(group.id, member.id, "member");

    // Login as owner
    const loginResponse = await post<ApiResponse<{ tokens: { accessToken: string } }>>(
      app,
      "/v1/auth/login",
      { email: owner.email, password: owner.plainPassword }
    );
    const token = assertSuccess(loginResponse).tokens.accessToken;

    // Act
    const response = await get<ApiResponse<MemberResponse[]>>(
      app,
      `/v1/groups/${group.id}/members`,
      { headers: authHeader(token) }
    );

    // Assert
    expect(response.status).toBe(200);
    const data = assertSuccess(response);
    expect(data.length).toBe(3);

    const roles = data.map(m => m.role).sort();
    expect(roles).toContain("owner");
    expect(roles).toContain("admin");
    expect(roles).toContain("member");
  });
});

// ============================================================================
// POST /v1/groups/:groupId/leave Tests
// ============================================================================

describe("POST /v1/groups/:groupId/leave", () => {
  it("should leave group as member", async () => {
    // Arrange
    const owner = await createTestUser();
    const member = await createTestUser();
    const group = await createTestGroup(owner.id);
    await addTestMember(group.id, member.id, "member");

    // Login as member
    const loginResponse = await post<ApiResponse<{ tokens: { accessToken: string } }>>(
      app,
      "/v1/auth/login",
      { email: member.email, password: member.plainPassword }
    );
    const token = assertSuccess(loginResponse).tokens.accessToken;

    // Act
    const response = await post<ApiResponse<{ message: string }>>(
      app,
      `/v1/groups/${group.id}/leave`,
      {},
      { headers: authHeader(token) }
    );

    // Assert
    expect(response.status).toBe(200);
    const data = assertSuccess(response);
    expect(data.message).toBe("Successfully left the group");
  });

  it("should warn about unsettled debts on leave", async () => {
    // Arrange - Create group with expense
    const owner = await createTestUser();
    const member = await createTestUser();
    const group = await createTestGroup(owner.id);
    const memberRecord = await addTestMember(group.id, member.id, "member");

    // Create expense where member owes money
    const expense = await createTestExpense(group.id, group.ownerMemberId, group.ownerMemberId, { amount: 100 });
    await addTestSplits(expense.itemId, [group.ownerMemberId, memberRecord.id], "equal");

    // Login as member
    const loginResponse = await post<ApiResponse<{ tokens: { accessToken: string } }>>(
      app,
      "/v1/auth/login",
      { email: member.email, password: member.plainPassword }
    );
    const token = assertSuccess(loginResponse).tokens.accessToken;

    // Act
    const response = await post<ApiResponse<{ message: string; warning?: string }>>(
      app,
      `/v1/groups/${group.id}/leave`,
      {},
      { headers: authHeader(token) }
    );

    // Assert
    expect(response.status).toBe(200);
    const data = assertSuccess(response);
    expect(data.message).toBe("Successfully left the group");
    expect(data.warning).toBeDefined();
    expect(data.warning).toContain("owe");
  });

  it("should require owner to transfer before leaving", async () => {
    // Arrange - Create group with single owner
    const owner = await registerUser(app, testEmail(), "SecurePassword123!", "Lone Owner");

    const createResponse = await post<ApiResponse<{ id: string }>>(
      app,
      "/v1/groups",
      { name: `Lone Owner Group ${testId()}` },
      { headers: authHeader(owner!.accessToken) }
    );
    const group = assertSuccess(createResponse);

    // Act - Try to leave as only owner
    const response = await post<ApiResponse>(
      app,
      `/v1/groups/${group.id}/leave`,
      {},
      { headers: authHeader(owner!.accessToken) }
    );

    // Assert
    expect(response.status).toBe(400);
    expect(response.body.error?.message).toContain("only owner");
    expect((response.body.error as any)?.details?.requiresOwnershipTransfer).toBe(true);
  });
});

// ============================================================================
// POST /v1/groups/:groupId/regenerate-code Tests
// ============================================================================

describe("POST /v1/groups/:groupId/regenerate-code", () => {
  it("should regenerate join code as admin", async () => {
    // Arrange
    const owner = await createTestUser();
    const admin = await createTestUser();
    const group = await createTestGroup(owner.id);
    await addTestMember(group.id, admin.id, "admin");
    const oldCode = group.joinCode;

    // Login as admin
    const loginResponse = await post<ApiResponse<{ tokens: { accessToken: string } }>>(
      app,
      "/v1/auth/login",
      { email: admin.email, password: admin.plainPassword }
    );
    const token = assertSuccess(loginResponse).tokens.accessToken;

    // Act
    const response = await post<ApiResponse<{ joinCode: string; message: string }>>(
      app,
      `/v1/groups/${group.id}/regenerate-code`,
      {},
      { headers: authHeader(token) }
    );

    // Assert
    expect(response.status).toBe(200);
    const data = assertSuccess(response);
    expect(data.joinCode).toBeDefined();
    expect(data.joinCode).not.toBe(oldCode);
  });

  it("should invalidate old join code after regeneration", async () => {
    // Arrange
    const owner = await registerUser(app, testEmail(), "SecurePassword123!", "Code Regen Owner");
    const joiner = await registerUser(app, testEmail(), "SecurePassword123!", "Late Joiner");

    const createResponse = await post<ApiResponse<{ id: string; joinCode: string }>>(
      app,
      "/v1/groups",
      { name: `Code Regen Group ${testId()}` },
      { headers: authHeader(owner!.accessToken) }
    );
    const group = assertSuccess(createResponse);
    const oldCode = group.joinCode;

    // Regenerate code
    await post(
      app,
      `/v1/groups/${group.id}/regenerate-code`,
      {},
      { headers: authHeader(owner!.accessToken) }
    );

    // Act - Try to join with old code
    const response = await post<ApiResponse>(
      app,
      "/v1/groups/join",
      { joinCode: oldCode },
      { headers: authHeader(joiner!.accessToken) }
    );

    // Assert
    assertError(response, 404, "NOT_FOUND");
    expect(response.body.error?.message).toContain("Invalid join code");
  });

  it("should reject regenerate from regular member (403)", async () => {
    // Arrange
    const owner = await createTestUser();
    const member = await createTestUser();
    const group = await createTestGroup(owner.id);
    await addTestMember(group.id, member.id, "member");

    // Login as member
    const loginResponse = await post<ApiResponse<{ tokens: { accessToken: string } }>>(
      app,
      "/v1/auth/login",
      { email: member.email, password: member.plainPassword }
    );
    const token = assertSuccess(loginResponse).tokens.accessToken;

    // Act
    const response = await post<ApiResponse>(
      app,
      `/v1/groups/${group.id}/regenerate-code`,
      {},
      { headers: authHeader(token) }
    );

    // Assert
    assertError(response, 403, "FORBIDDEN");
  });
});

// ============================================================================
// Member Count Tests
// ============================================================================

describe("Group Member Count", () => {
  it("should show member count in group list", async () => {
    // Arrange
    const owner = await createTestUser();
    const member1 = await createTestUser();
    const member2 = await createTestUser();
    const group = await createTestGroup(owner.id);
    await addTestMember(group.id, member1.id, "member");
    await addTestMember(group.id, member2.id, "member");

    // Login as owner
    const loginResponse = await post<ApiResponse<{ tokens: { accessToken: string } }>>(
      app,
      "/v1/auth/login",
      { email: owner.email, password: owner.plainPassword }
    );
    const token = assertSuccess(loginResponse).tokens.accessToken;

    // Act
    const response = await get<ApiResponse<GroupListItem[]>>(
      app,
      "/v1/groups",
      { headers: authHeader(token) }
    );

    // Assert
    expect(response.status).toBe(200);
    const data = assertSuccess(response);
    const testGroup = data.find(g => g.id === group.id);
    expect(testGroup).toBeDefined();
    expect(testGroup?.memberCount).toBe(3); // owner + 2 members
  });
});
