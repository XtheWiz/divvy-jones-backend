/**
 * Groups CRUD Integration Tests
 * E2E Test Plan - Phase 1
 *
 * Tests for POST/GET/PUT/DELETE /v1/groups endpoints
 */

import { describe, it, expect, beforeAll, afterAll } from "bun:test";
import {
  beforeAllTests,
  afterAllTests,
  testEmail,
  testId,
} from "./setup";
import { createTestUser, createTestGroup, addTestMember } from "./factories";
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

interface GroupResponse {
  id: string;
  name: string;
  description?: string;
  joinCode: string;
  defaultCurrencyCode: string;
  role: string;
  createdAt: string;
  updatedAt?: string;
  memberCount?: number;
}

interface GroupListItem {
  id: string;
  name: string;
  description?: string;
  role: string;
  memberCount: number;
  createdAt: string;
}

// ============================================================================
// POST /v1/groups Tests (Create Group)
// ============================================================================

describe("POST /v1/groups", () => {
  it("should create group with name only", async () => {
    // Arrange
    const authData = await registerUser(app, testEmail(), "SecurePassword123!", "Group Creator");
    const groupName = `Test Group ${testId()}`;

    // Act
    const response = await post<ApiResponse<GroupResponse>>(
      app,
      "/v1/groups",
      { name: groupName },
      { headers: authHeader(authData!.accessToken) }
    );

    // Assert
    expect(response.status).toBe(201);
    const data = assertSuccess(response);
    expect(data.name).toBe(groupName);
    expect(data.defaultCurrencyCode).toBe("USD"); // Default currency
  });

  it("should create group with all options", async () => {
    // Arrange
    const authData = await registerUser(app, testEmail(), "SecurePassword123!", "Full Group Creator");
    const groupName = `Full Options Group ${testId()}`;
    const description = "A group with all options set";

    // Act
    const response = await post<ApiResponse<GroupResponse>>(
      app,
      "/v1/groups",
      {
        name: groupName,
        description,
        defaultCurrencyCode: "EUR",
      },
      { headers: authHeader(authData!.accessToken) }
    );

    // Assert
    expect(response.status).toBe(201);
    const data = assertSuccess(response);
    expect(data.name).toBe(groupName);
    expect(data.description).toBe(description);
    expect(data.defaultCurrencyCode).toBe("EUR");
  });

  it("should generate unique 8-char join code", async () => {
    // Arrange
    const authData = await registerUser(app, testEmail(), "SecurePassword123!", "Join Code Test");

    // Act
    const response = await post<ApiResponse<GroupResponse>>(
      app,
      "/v1/groups",
      { name: `Join Code Test Group ${testId()}` },
      { headers: authHeader(authData!.accessToken) }
    );

    // Assert
    expect(response.status).toBe(201);
    const data = assertSuccess(response);
    expect(data.joinCode).toBeDefined();
    expect(typeof data.joinCode).toBe("string");
    expect(data.joinCode.length).toBeGreaterThanOrEqual(8);
  });

  it("should make creator the owner member", async () => {
    // Arrange
    const authData = await registerUser(app, testEmail(), "SecurePassword123!", "Owner Test");

    // Act
    const response = await post<ApiResponse<GroupResponse>>(
      app,
      "/v1/groups",
      { name: `Owner Test Group ${testId()}` },
      { headers: authHeader(authData!.accessToken) }
    );

    // Assert
    expect(response.status).toBe(201);
    const data = assertSuccess(response);
    expect(data.role).toBe("owner");
  });
});

// ============================================================================
// GET /v1/groups Tests (List Groups)
// ============================================================================

describe("GET /v1/groups", () => {
  it("should list user's groups (paginated)", async () => {
    // Arrange - Create user and groups
    const authData = await registerUser(app, testEmail(), "SecurePassword123!", "List Test User");

    // Create two groups
    await post(app, "/v1/groups", { name: `List Test Group 1 ${testId()}` }, { headers: authHeader(authData!.accessToken) });
    await post(app, "/v1/groups", { name: `List Test Group 2 ${testId()}` }, { headers: authHeader(authData!.accessToken) });

    // Act
    const response = await get<ApiResponse<GroupListItem[]>>(
      app,
      "/v1/groups",
      { headers: authHeader(authData!.accessToken) }
    );

    // Assert
    expect(response.status).toBe(200);
    const data = assertSuccess(response);
    expect(Array.isArray(data)).toBe(true);
    expect(data.length).toBeGreaterThanOrEqual(2);
  });
});

// ============================================================================
// GET /v1/groups/:groupId Tests (Get Group Details)
// ============================================================================

describe("GET /v1/groups/:groupId", () => {
  it("should get group details as member", async () => {
    // Arrange
    const authData = await registerUser(app, testEmail(), "SecurePassword123!", "Details Test User");
    const createResponse = await post<ApiResponse<GroupResponse>>(
      app,
      "/v1/groups",
      { name: `Details Test Group ${testId()}` },
      { headers: authHeader(authData!.accessToken) }
    );
    const group = assertSuccess(createResponse);

    // Act
    const response = await get<ApiResponse<GroupResponse>>(
      app,
      `/v1/groups/${group.id}`,
      { headers: authHeader(authData!.accessToken) }
    );

    // Assert
    expect(response.status).toBe(200);
    const data = assertSuccess(response);
    expect(data.id).toBe(group.id);
    expect(data.name).toBe(group.name);
    expect(data.joinCode).toBe(group.joinCode);
  });

  it("should reject get group as non-member (403)", async () => {
    // Arrange - Create group as one user
    const owner = await createTestUser();
    const group = await createTestGroup(owner.id);

    // Different user
    const nonMember = await registerUser(app, testEmail(), "SecurePassword123!", "Non Member");

    // Act
    const response = await get<ApiResponse>(
      app,
      `/v1/groups/${group.id}`,
      { headers: authHeader(nonMember!.accessToken) }
    );

    // Assert
    assertError(response, 403, "NOT_MEMBER");
  });
});

// ============================================================================
// PUT /v1/groups/:groupId Tests (Update Group)
// ============================================================================

describe("PUT /v1/groups/:groupId", () => {
  it("should update group name as owner", async () => {
    // Arrange
    const authData = await registerUser(app, testEmail(), "SecurePassword123!", "Update Owner");
    const createResponse = await post<ApiResponse<GroupResponse>>(
      app,
      "/v1/groups",
      { name: `Original Name ${testId()}` },
      { headers: authHeader(authData!.accessToken) }
    );
    const group = assertSuccess(createResponse);
    const newName = `Updated Name ${testId()}`;

    // Act
    const response = await put<ApiResponse<GroupResponse>>(
      app,
      `/v1/groups/${group.id}`,
      { name: newName },
      { headers: authHeader(authData!.accessToken) }
    );

    // Assert
    expect(response.status).toBe(200);
    const data = assertSuccess(response);
    expect(data.name).toBe(newName);
  });

  it("should update group as admin", async () => {
    // Arrange - Create owner and admin
    const owner = await createTestUser();
    const admin = await createTestUser();
    const group = await createTestGroup(owner.id);
    await addTestMember(group.id, admin.id, "admin");

    // Login as admin
    const adminAuth = await registerUser(app, admin.email!, admin.plainPassword, admin.displayName);
    // Note: Since we created admin via factory, we need to login instead
    const loginResponse = await post<ApiResponse<{ tokens: { accessToken: string; refreshToken: string } }>>(
      app,
      "/v1/auth/login",
      { email: admin.email, password: admin.plainPassword }
    );
    const adminTokens = assertSuccess(loginResponse);

    const newName = `Admin Updated ${testId()}`;

    // Act
    const response = await put<ApiResponse<GroupResponse>>(
      app,
      `/v1/groups/${group.id}`,
      { name: newName },
      { headers: authHeader(adminTokens.tokens.accessToken) }
    );

    // Assert
    expect(response.status).toBe(200);
    const data = assertSuccess(response);
    expect(data.name).toBe(newName);
  });

  it("should reject update from regular member (403)", async () => {
    // Arrange - Create owner and regular member
    const owner = await createTestUser();
    const member = await createTestUser();
    const group = await createTestGroup(owner.id);
    await addTestMember(group.id, member.id, "member");

    // Login as member
    const loginResponse = await post<ApiResponse<{ tokens: { accessToken: string; refreshToken: string } }>>(
      app,
      "/v1/auth/login",
      { email: member.email, password: member.plainPassword }
    );
    const memberTokens = assertSuccess(loginResponse);

    // Act
    const response = await put<ApiResponse>(
      app,
      `/v1/groups/${group.id}`,
      { name: `Member Update Attempt ${testId()}` },
      { headers: authHeader(memberTokens.tokens.accessToken) }
    );

    // Assert
    assertError(response, 403, "FORBIDDEN");
  });
});

// ============================================================================
// DELETE /v1/groups/:groupId Tests (Delete Group)
// ============================================================================

describe("DELETE /v1/groups/:groupId", () => {
  it("should delete group as owner (soft delete)", async () => {
    // Arrange
    const authData = await registerUser(app, testEmail(), "SecurePassword123!", "Delete Owner");
    const createResponse = await post<ApiResponse<GroupResponse>>(
      app,
      "/v1/groups",
      { name: `Delete Test Group ${testId()}` },
      { headers: authHeader(authData!.accessToken) }
    );
    const group = assertSuccess(createResponse);

    // Act
    const response = await del<ApiResponse<{ message: string; deletedAt: string }>>(
      app,
      `/v1/groups/${group.id}`,
      { headers: authHeader(authData!.accessToken) }
    );

    // Assert
    expect(response.status).toBe(200);
    const data = assertSuccess(response);
    expect(data.message).toBe("Group has been deleted");
    expect(data.deletedAt).toBeDefined();

    // Verify group is no longer accessible
    const getResponse = await get<ApiResponse>(
      app,
      `/v1/groups/${group.id}`,
      { headers: authHeader(authData!.accessToken) }
    );
    expect(getResponse.status).toBe(404);
  });

  it("should reject delete from non-owner (403)", async () => {
    // Arrange - Create owner and admin (admin can't delete)
    const owner = await createTestUser();
    const admin = await createTestUser();
    const group = await createTestGroup(owner.id);
    await addTestMember(group.id, admin.id, "admin");

    // Login as admin
    const loginResponse = await post<ApiResponse<{ tokens: { accessToken: string; refreshToken: string } }>>(
      app,
      "/v1/auth/login",
      { email: admin.email, password: admin.plainPassword }
    );
    const adminTokens = assertSuccess(loginResponse);

    // Act
    const response = await del<ApiResponse>(
      app,
      `/v1/groups/${group.id}`,
      { headers: authHeader(adminTokens.tokens.accessToken) }
    );

    // Assert
    assertError(response, 403, "FORBIDDEN");
  });
});
