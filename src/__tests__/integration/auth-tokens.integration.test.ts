/**
 * Auth Tokens Integration Tests
 * E2E Test Plan - Phase 1
 *
 * Tests for POST /v1/auth/refresh and protected route authorization
 */

import { describe, it, expect, beforeAll, afterAll } from "bun:test";
import {
  beforeAllTests,
  afterAllTests,
  testEmail,
} from "./setup";
import {
  createTestApp,
  post,
  get,
  authHeader,
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

interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

interface UserProfile {
  id: string;
  email: string;
  displayName: string;
  createdAt: string;
}

interface RegisterResponse {
  user: UserProfile;
  tokens: AuthTokens;
}

interface RefreshResponse {
  tokens: AuthTokens;
}

// ============================================================================
// Helper Functions
// ============================================================================

async function registerUser(email: string) {
  const response = await post<ApiResponse<RegisterResponse>>(
    app,
    "/v1/auth/register",
    {
      email,
      password: "SecurePassword123!",
      displayName: "Token Test User",
    }
  );
  return assertSuccess(response);
}

// ============================================================================
// POST /v1/auth/refresh Tests
// ============================================================================

describe("POST /v1/auth/refresh", () => {
  it("should refresh with valid refresh token", async () => {
    // Arrange
    const { tokens } = await registerUser(testEmail());

    // Act
    const response = await post<ApiResponse<RefreshResponse>>(
      app,
      "/v1/auth/refresh",
      { refreshToken: tokens.refreshToken }
    );

    // Assert
    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);

    const data = assertSuccess(response);
    expect(data.tokens.accessToken).toBeDefined();
    expect(data.tokens.refreshToken).toBeDefined();
    expect(data.tokens.expiresIn).toBe(900);
  });

  it("should rotate refresh token on use", async () => {
    // Arrange
    const { tokens: originalTokens } = await registerUser(testEmail());

    // Act
    const response = await post<ApiResponse<RefreshResponse>>(
      app,
      "/v1/auth/refresh",
      { refreshToken: originalTokens.refreshToken }
    );

    // Assert
    expect(response.status).toBe(200);
    const data = assertSuccess(response);

    // New refresh token should be different (rotation)
    expect(data.tokens.refreshToken).not.toBe(originalTokens.refreshToken);
  });

  it("should reject reused refresh token (401)", async () => {
    // Arrange
    const { tokens } = await registerUser(testEmail());

    // Use refresh token once
    const firstRefresh = await post<ApiResponse<RefreshResponse>>(
      app,
      "/v1/auth/refresh",
      { refreshToken: tokens.refreshToken }
    );
    expect(firstRefresh.status).toBe(200);

    // Act - Try to reuse the same refresh token
    const response = await post<ApiResponse>(
      app,
      "/v1/auth/refresh",
      { refreshToken: tokens.refreshToken }
    );

    // Assert - Should fail because token was already used
    assertError(response, 401, "INVALID_TOKEN");
  });

  it("should reject invalid token format (401)", async () => {
    // Arrange
    const invalidToken = "this-is-not-a-valid-token-format";

    // Act
    const response = await post<ApiResponse>(
      app,
      "/v1/auth/refresh",
      { refreshToken: invalidToken }
    );

    // Assert
    assertError(response, 401, "INVALID_TOKEN");
  });

  it("should reject access token used as refresh token (401)", async () => {
    // Arrange
    const { tokens } = await registerUser(testEmail());

    // Act - Try to use access token as refresh token
    const response = await post<ApiResponse>(
      app,
      "/v1/auth/refresh",
      { refreshToken: tokens.accessToken }
    );

    // Assert
    assertError(response, 401, "INVALID_TOKEN");
  });

  it("should provide working new access token for protected routes", async () => {
    // Arrange
    const { tokens: originalTokens } = await registerUser(testEmail());

    // Refresh tokens
    const refreshResponse = await post<ApiResponse<RefreshResponse>>(
      app,
      "/v1/auth/refresh",
      { refreshToken: originalTokens.refreshToken }
    );
    const { tokens: newTokens } = assertSuccess(refreshResponse);

    // Act - Use new access token to access protected route
    const response = await get<ApiResponse<UserProfile>>(
      app,
      "/v1/users/me",
      { headers: authHeader(newTokens.accessToken) }
    );

    // Assert
    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
  });

  it("should reject empty refresh token", async () => {
    // Act
    const response = await post<ApiResponse>(
      app,
      "/v1/auth/refresh",
      { refreshToken: "" }
    );

    // Assert - Schema validation should fail
    expect(response.status).toBe(422);
    expect((response.body as any).type).toBe("validation");
  });
});

// ============================================================================
// Protected Route Authorization Tests
// ============================================================================

describe("Protected Routes Authorization", () => {
  it("should reject missing auth header (401)", async () => {
    // Act - Request without auth header
    const response = await get<ApiResponse>(app, "/v1/users/me");

    // Assert
    expect(response.status).toBe(401);
    expect(response.body.success).toBe(false);
  });

  it("should reject invalid auth token (401)", async () => {
    // Arrange
    const invalidToken = "invalid.jwt.token";

    // Act
    const response = await get<ApiResponse>(
      app,
      "/v1/users/me",
      { headers: authHeader(invalidToken) }
    );

    // Assert
    expect(response.status).toBe(401);
    expect(response.body.success).toBe(false);
  });

  it("should reject malformed authorization header (401)", async () => {
    // Act - Missing Bearer prefix
    const response = await get<ApiResponse>(
      app,
      "/v1/users/me",
      { headers: { Authorization: "some-token-without-bearer" } }
    );

    // Assert
    expect(response.status).toBe(401);
    expect(response.body.success).toBe(false);
  });
});
