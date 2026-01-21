/**
 * Auth Login Integration Tests
 * E2E Test Plan - Phase 1
 *
 * Tests for POST /v1/auth/login endpoint
 */

import { describe, it, expect, beforeAll, afterAll } from "bun:test";
import { eq } from "drizzle-orm";
import {
  beforeAllTests,
  afterAllTests,
  testEmail,
  getTestDb,
  schema,
} from "./setup";
import { createTestUser } from "./factories";
import {
  createTestApp,
  post,
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

interface LoginResponse {
  user: UserProfile;
  tokens: AuthTokens;
}

// ============================================================================
// POST /v1/auth/login Tests
// ============================================================================

describe("POST /v1/auth/login", () => {
  it("should login with valid credentials", async () => {
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
    expect(data.user.displayName).toBe(user.displayName);
  });

  it("should return access + refresh tokens", async () => {
    // Arrange
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
    const data = assertSuccess(response);

    expect(data.tokens).toBeDefined();
    expect(data.tokens.accessToken).toBeDefined();
    expect(typeof data.tokens.accessToken).toBe("string");
    expect(data.tokens.accessToken.split(".")).toHaveLength(3); // JWT format

    expect(data.tokens.refreshToken).toBeDefined();
    expect(typeof data.tokens.refreshToken).toBe("string");
    expect(data.tokens.refreshToken.length).toBeGreaterThan(0);

    expect(data.tokens.expiresIn).toBe(900); // 15 minutes
  });

  it("should reject invalid password (401)", async () => {
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

  it("should reject non-existent email (401)", async () => {
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

  it("should reject deleted account (401)", async () => {
    // Arrange - Create a user and soft-delete them
    const user = await createTestUser({ password: "TestPassword123!" });
    const db = getTestDb();

    // Soft delete the user
    await db
      .update(schema.users)
      .set({ deletedAt: new Date() })
      .where(eq(schema.users.id, user.id));

    // Act - Try to login with deleted account
    const response = await post<ApiResponse>(
      app,
      "/v1/auth/login",
      {
        email: user.email,
        password: "TestPassword123!",
      }
    );

    // Assert
    assertError(response, 401, "INVALID_CREDENTIALS");
    expect(response.body.error?.message).toBe("Invalid email or password");
  });

  it("should use generic error message to prevent email enumeration", async () => {
    // Test that both non-existent and wrong password return the same message
    const user = await createTestUser({ password: "TestPassword123!" });

    // Wrong password
    const wrongPasswordResponse = await post<ApiResponse>(
      app,
      "/v1/auth/login",
      {
        email: user.email,
        password: "WrongPassword123!",
      }
    );

    // Non-existent email
    const nonExistentResponse = await post<ApiResponse>(
      app,
      "/v1/auth/login",
      {
        email: testEmail(),
        password: "SomePassword123!",
      }
    );

    // Assert - Both should return same error message to prevent enumeration
    expect(wrongPasswordResponse.status).toBe(401);
    expect(nonExistentResponse.status).toBe(401);
    expect(wrongPasswordResponse.body.error?.message).toBe(nonExistentResponse.body.error?.message);
    expect(wrongPasswordResponse.body.error?.message).toBe("Invalid email or password");
  });

  it("should return token containing correct user ID", async () => {
    // Arrange
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
    const data = assertSuccess(response);

    // Decode the JWT to verify payload (without verifying signature)
    const accessToken = data.tokens.accessToken;
    const payload = JSON.parse(Buffer.from(accessToken.split(".")[1], "base64").toString());

    expect(payload.userId).toBe(user.id);
    expect(payload.email).toBe(user.email!);
  });

  it("should handle case-insensitive email login", async () => {
    // Arrange
    const lowerEmail = testEmail();
    const password = "TestPassword123!";

    // Create user with lowercase email
    await createTestUser({ email: lowerEmail, password });

    // Act - Login with uppercase email
    const response = await post<ApiResponse<LoginResponse>>(
      app,
      "/v1/auth/login",
      {
        email: lowerEmail.toUpperCase(),
        password,
      }
    );

    // Assert
    expect(response.status).toBe(200);
    const data = assertSuccess(response);
    expect(data.user.email).toBe(lowerEmail);
  });
});
