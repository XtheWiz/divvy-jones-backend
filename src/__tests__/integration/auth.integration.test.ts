/**
 * Auth Integration Tests
 * Sprint 003 - TASK-013
 *
 * Tests for authentication endpoints:
 * - POST /v1/auth/register
 * - POST /v1/auth/login
 * - POST /v1/auth/refresh
 * - GET /v1/users/me
 */

import { describe, it, expect, beforeAll, afterAll } from "bun:test";
import {
  beforeAllTests,
  afterAllTests,
  testEmail,
} from "./setup";
import { createTestUser } from "./factories";
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

interface LoginResponse {
  user: UserProfile;
  tokens: AuthTokens;
}

interface RefreshResponse {
  tokens: AuthTokens;
}

// ============================================================================
// POST /v1/auth/register Tests
// ============================================================================

describe("POST /v1/auth/register", () => {
  it("should register a new user successfully", async () => {
    // Arrange
    const email = testEmail();
    const password = "SecurePassword123!";
    const displayName = "Test User";

    // Act
    const response = await post<ApiResponse<RegisterResponse>>(
      app,
      "/v1/auth/register",
      { email, password, displayName }
    );

    // Assert
    expect(response.status).toBe(201);
    expect(response.body.success).toBe(true);

    const data = assertSuccess(response);
    expect(data.user.email).toBe(email.toLowerCase());
    expect(data.user.displayName).toBe(displayName);
    expect(data.user.id).toBeDefined();
    expect(data.tokens.accessToken).toBeDefined();
    expect(data.tokens.refreshToken).toBeDefined();
    expect(data.tokens.expiresIn).toBe(900);
  });

  it("should return 409 for duplicate email", async () => {
    // Arrange - Create a user first
    const existingUser = await createTestUser();

    // Act - Try to register with same email
    const response = await post<ApiResponse>(
      app,
      "/v1/auth/register",
      {
        email: existingUser.email,
        password: "AnotherPassword123!",
        displayName: "Another User",
      }
    );

    // Assert
    assertError(response, 409, "ALREADY_EXISTS");
    expect(response.body.error?.message).toContain("already registered");
  });

  it("should return 422 for weak password (schema validation)", async () => {
    // Arrange
    const email = testEmail();
    const weakPassword = "weak"; // Too short - fails TypeBox minLength: 8

    // Act
    const response = await post<ApiResponse>(
      app,
      "/v1/auth/register",
      {
        email,
        password: weakPassword,
        displayName: "Test User",
      }
    );

    // Assert - TypeBox schema validation returns 422 with validation error format
    expect(response.status).toBe(422);
    // TypeBox returns { type: "validation", ... } not { success: false, ... }
    expect((response.body as any).type).toBe("validation");
  });

  it("should return 422 for invalid email format (schema validation)", async () => {
    // Arrange
    const invalidEmail = "not-an-email";

    // Act
    const response = await post<ApiResponse>(
      app,
      "/v1/auth/register",
      {
        email: invalidEmail,
        password: "SecurePassword123!",
        displayName: "Test User",
      }
    );

    // Assert - TypeBox format: "email" validation returns 422 with validation error format
    expect(response.status).toBe(422);
    // TypeBox returns { type: "validation", ... } not { success: false, ... }
    expect((response.body as any).type).toBe("validation");
  });
});

// ============================================================================
// POST /v1/auth/login Tests
// ============================================================================

describe("POST /v1/auth/login", () => {
  it("should login successfully with valid credentials", async () => {
    // Arrange - Create a user with known password
    const user = await createTestUser({ password: "TestPassword123!" });

    // Act
    const response = await post<ApiResponse<LoginResponse>>(
      app,
      "/v1/auth/login",
      {
        email: user.email,
        password: "TestPassword123!",
      }
    );

    // Assert
    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);

    const data = assertSuccess(response);
    expect(data.user.id).toBe(user.id);
    expect(data.user.email).toBe(user.email!);
    expect(data.tokens.accessToken).toBeDefined();
    expect(data.tokens.refreshToken).toBeDefined();
  });

  it("should return 401 for invalid password", async () => {
    // Arrange - Create a user
    const user = await createTestUser({ password: "CorrectPassword123!" });

    // Act - Login with wrong password
    const response = await post<ApiResponse>(
      app,
      "/v1/auth/login",
      {
        email: user.email,
        password: "WrongPassword123!",
      }
    );

    // Assert
    assertError(response, 401, "INVALID_CREDENTIALS");
    expect(response.body.error?.message).toBe("Invalid email or password");
  });

  it("should return 401 for non-existent email", async () => {
    // Arrange
    const nonExistentEmail = testEmail();

    // Act
    const response = await post<ApiResponse>(
      app,
      "/v1/auth/login",
      {
        email: nonExistentEmail,
        password: "SomePassword123!",
      }
    );

    // Assert
    assertError(response, 401, "INVALID_CREDENTIALS");
    // Should use generic message to prevent email enumeration
    expect(response.body.error?.message).toBe("Invalid email or password");
  });
});

// ============================================================================
// POST /v1/auth/refresh Tests
// ============================================================================

describe("POST /v1/auth/refresh", () => {
  it("should refresh tokens with valid refresh token", async () => {
    // Arrange - Register a user to get tokens
    const email = testEmail();
    const registerResponse = await post<ApiResponse<RegisterResponse>>(
      app,
      "/v1/auth/register",
      {
        email,
        password: "SecurePassword123!",
        displayName: "Refresh Test User",
      }
    );

    const { refreshToken } = assertSuccess(registerResponse).tokens;

    // Act - Use refresh token to get new tokens
    const response = await post<ApiResponse<RefreshResponse>>(
      app,
      "/v1/auth/refresh",
      { refreshToken }
    );

    // Assert
    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);

    const data = assertSuccess(response);
    expect(data.tokens.accessToken).toBeDefined();
    expect(data.tokens.refreshToken).toBeDefined();
    // New refresh token should be different (rotation)
    expect(data.tokens.refreshToken).not.toBe(refreshToken);
  });

  it("should return 401 for invalid refresh token", async () => {
    // Arrange
    const invalidToken = "invalid-refresh-token-12345";

    // Act
    const response = await post<ApiResponse>(
      app,
      "/v1/auth/refresh",
      { refreshToken: invalidToken }
    );

    // Assert
    assertError(response, 401, "INVALID_TOKEN");
  });

  it("should return 401 for reused refresh token (single-use)", async () => {
    // Arrange - Register and get tokens
    const email = testEmail();
    const registerResponse = await post<ApiResponse<RegisterResponse>>(
      app,
      "/v1/auth/register",
      {
        email,
        password: "SecurePassword123!",
        displayName: "Single Use Test",
      }
    );

    const { refreshToken } = assertSuccess(registerResponse).tokens;

    // Use refresh token once
    await post<ApiResponse<RefreshResponse>>(
      app,
      "/v1/auth/refresh",
      { refreshToken }
    );

    // Act - Try to use same refresh token again
    const response = await post<ApiResponse>(
      app,
      "/v1/auth/refresh",
      { refreshToken }
    );

    // Assert - Should fail because token was already used
    assertError(response, 401, "INVALID_TOKEN");
  });
});

// ============================================================================
// GET /v1/users/me Tests
// ============================================================================

describe("GET /v1/users/me", () => {
  it("should return authenticated user profile", async () => {
    // Arrange - Register a user
    const email = testEmail();
    const displayName = "Profile Test User";

    const registerResponse = await post<ApiResponse<RegisterResponse>>(
      app,
      "/v1/auth/register",
      {
        email,
        password: "SecurePassword123!",
        displayName,
      }
    );

    const { accessToken } = assertSuccess(registerResponse).tokens;
    const expectedUserId = assertSuccess(registerResponse).user.id;

    // Act - Get user profile
    const response = await get<ApiResponse<UserProfile>>(
      app,
      "/v1/users/me",
      { headers: authHeader(accessToken) }
    );

    // Assert
    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);

    const data = assertSuccess(response);
    expect(data.id).toBe(expectedUserId);
    expect(data.email).toBe(email.toLowerCase());
    expect(data.displayName).toBe(displayName);
    expect(data.createdAt).toBeDefined();
  });

  it("should return 401 without authentication", async () => {
    // Act - Request without auth header
    const response = await get<ApiResponse>(app, "/v1/users/me");

    // Assert
    expect(response.status).toBe(401);
    expect(response.body.success).toBe(false);
  });

  it("should return 401 with invalid token", async () => {
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
});
