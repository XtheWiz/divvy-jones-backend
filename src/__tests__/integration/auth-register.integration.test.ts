/**
 * Auth Register Integration Tests
 * E2E Test Plan - Phase 1
 *
 * Tests for POST /v1/auth/register endpoint
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
  emailVerified?: boolean;
  createdAt: string;
}

interface RegisterResponse {
  user: UserProfile;
  tokens: AuthTokens;
}

// ============================================================================
// POST /v1/auth/register Tests
// ============================================================================

describe("POST /v1/auth/register", () => {
  it("should register with valid credentials", async () => {
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
    expect(data.user.id).toBeDefined();
    expect(data.user.displayName).toBe(displayName);
  });

  it("should return tokens on registration", async () => {
    // Arrange
    const email = testEmail();
    const password = "SecurePassword123!";
    const displayName = "Token Test User";

    // Act
    const response = await post<ApiResponse<RegisterResponse>>(
      app,
      "/v1/auth/register",
      { email, password, displayName }
    );

    // Assert
    expect(response.status).toBe(201);
    const data = assertSuccess(response);

    expect(data.tokens).toBeDefined();
    expect(data.tokens.accessToken).toBeDefined();
    expect(typeof data.tokens.accessToken).toBe("string");
    expect(data.tokens.accessToken.length).toBeGreaterThan(0);

    expect(data.tokens.refreshToken).toBeDefined();
    expect(typeof data.tokens.refreshToken).toBe("string");
    expect(data.tokens.refreshToken.length).toBeGreaterThan(0);

    expect(data.tokens.expiresIn).toBe(900); // 15 minutes
  });

  it("should normalize email to lowercase", async () => {
    // Arrange
    const mixedCaseEmail = "Test.User@EXAMPLE.COM";
    const password = "SecurePassword123!";
    const displayName = "Lowercase Test User";

    // Act
    const response = await post<ApiResponse<RegisterResponse>>(
      app,
      "/v1/auth/register",
      { email: mixedCaseEmail, password, displayName }
    );

    // Assert
    expect(response.status).toBe(201);
    const data = assertSuccess(response);
    expect(data.user.email).toBe(mixedCaseEmail.toLowerCase());
  });

  it("should reject duplicate email (409)", async () => {
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

  it("should reject invalid email format (422)", async () => {
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

    // Assert - TypeBox schema validation returns 422
    expect(response.status).toBe(422);
    expect((response.body as any).type).toBe("validation");
  });

  it("should reject weak password - too short (422)", async () => {
    // Arrange
    const email = testEmail();
    const weakPassword = "weak"; // Less than 8 characters

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

    // Assert - TypeBox minLength validation returns 422
    expect(response.status).toBe(422);
    expect((response.body as any).type).toBe("validation");
  });

  it("should reject weak password - no uppercase (400)", async () => {
    // Arrange
    const email = testEmail();
    const weakPassword = "password123!"; // No uppercase letter

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

    // Assert - Server-side password strength validation returns 400
    expect(response.status).toBe(400);
    expect(response.body.success).toBe(false);
    expect(response.body.error?.code).toBe("VALIDATION_ERROR");
    expect(response.body.error?.message).toContain("Password does not meet requirements");
  });

  it("should reject missing required fields (422)", async () => {
    // Arrange - Missing displayName
    const email = testEmail();

    // Act
    const response = await post<ApiResponse>(
      app,
      "/v1/auth/register",
      {
        email,
        password: "SecurePassword123!",
        // displayName is missing
      }
    );

    // Assert
    expect(response.status).toBe(422);
    expect((response.body as any).type).toBe("validation");
  });
});
