/**
 * Email Verification Integration Tests
 * E2E Test Plan - Phase 2
 *
 * Tests for email verification flow:
 * - POST /v1/auth/register (triggers verification email)
 * - GET /v1/auth/verify-email
 * - POST /v1/auth/resend-verification
 */

import { describe, it, expect, beforeAll, afterAll } from "bun:test";
import { eq, and, isNull } from "drizzle-orm";
import * as bcrypt from "bcryptjs";
import {
  beforeAllTests,
  afterAllTests,
  testEmail,
  getTestDb,
  schema,
} from "./setup";
import {
  createTestApp,
  post,
  get,
  authHeader,
  assertSuccess,
  type ApiResponse,
} from "./helpers";
import { createTestUser } from "./factories";

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

interface RegisterResponse {
  user: {
    id: string;
    email: string;
    displayName: string;
    emailVerified: boolean;
  };
  tokens: {
    accessToken: string;
    refreshToken: string;
    expiresIn: number;
  };
}

interface VerifyEmailResponse {
  message: string;
}

interface ResendVerificationResponse {
  message: string;
}

interface UserProfileResponse {
  id: string;
  email: string;
  displayName: string;
  emailVerified: boolean;
  emailVerifiedAt: string | null;
}

// ============================================================================
// Helper: Get verification token from database
// ============================================================================

async function getVerificationToken(userId: string, retries = 5, delayMs = 100) {
  const db = getTestDb();

  // Token is created asynchronously via setImmediate after registration
  // So we may need to retry a few times
  for (let i = 0; i < retries; i++) {
    const tokens = await db
      .select()
      .from(schema.emailVerificationTokens)
      .where(
        and(
          eq(schema.emailVerificationTokens.userId, userId),
          isNull(schema.emailVerificationTokens.verifiedAt)
        )
      )
      .orderBy(schema.emailVerificationTokens.createdAt);

    if (tokens.length > 0) {
      return tokens[0];
    }

    // Wait before retrying
    await new Promise(resolve => setTimeout(resolve, delayMs));
  }

  return null;
}

// ============================================================================
// POST /v1/auth/register - Email Verification Trigger Tests
// ============================================================================

describe("POST /v1/auth/register - Email Verification", () => {
  it("should create unverified user on registration", async () => {
    // Arrange
    const email = testEmail();
    const password = "SecurePass123!";
    const displayName = "New User";

    // Act
    const response = await post<ApiResponse<RegisterResponse>>(
      app,
      "/v1/auth/register",
      { email, password, displayName }
    );

    // Assert
    expect(response.status).toBe(201);
    const data = assertSuccess(response);
    expect(data.user.emailVerified).toBe(false);
  });

  it("should generate verification token on registration", async () => {
    // Arrange
    const email = testEmail();
    const password = "SecurePass123!";
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

    // Check token was created in database
    const token = await getVerificationToken(data.user.id);
    expect(token).not.toBeNull();
    expect(token?.tokenHash).toBeDefined();
    expect(token?.expiresAt).toBeDefined();
  });

  it("should set token expiry to 24 hours (AC-1.4)", async () => {
    // Arrange
    const email = testEmail();
    const password = "SecurePass123!";
    const displayName = "Expiry Test User";

    // Act
    const response = await post<ApiResponse<RegisterResponse>>(
      app,
      "/v1/auth/register",
      { email, password, displayName }
    );

    // Assert
    expect(response.status).toBe(201);
    const data = assertSuccess(response);

    const token = await getVerificationToken(data.user.id);
    expect(token).not.toBeNull();

    // Token should expire approximately 24 hours from now
    const now = Date.now();
    const expiresAt = new Date(token!.expiresAt).getTime();
    const diffHours = (expiresAt - now) / (1000 * 60 * 60);

    // Should be between 23 and 25 hours (allowing for test execution time)
    expect(diffHours).toBeGreaterThan(23);
    expect(diffHours).toBeLessThan(25);
  });
});

// ============================================================================
// GET /v1/auth/verify-email Tests
// ============================================================================

describe("GET /v1/auth/verify-email", () => {
  it("should verify email with valid token (AC-1.3)", async () => {
    // Arrange - Create user via API
    const email = testEmail();
    const registerResponse = await post<ApiResponse<RegisterResponse>>(
      app,
      "/v1/auth/register",
      { email, password: "SecurePass123!", displayName: "Verify Test" }
    );
    const userId = assertSuccess(registerResponse).user.id;

    // Wait for async token creation to complete
    const existingToken = await getVerificationToken(userId);
    expect(existingToken).not.toBeNull();

    // Get the raw token (we need to create one we know the value of)
    const db = getTestDb();
    const rawToken = "test-verification-token-12345";
    const tokenHash = await bcrypt.hash(rawToken, 10);

    // Update the token in database with known value
    await db
      .update(schema.emailVerificationTokens)
      .set({ tokenHash })
      .where(eq(schema.emailVerificationTokens.id, existingToken!.id));

    // Act
    const response = await get<ApiResponse<VerifyEmailResponse>>(
      app,
      "/v1/auth/verify-email",
      { query: { token: rawToken } }
    );

    // Assert
    expect(response.status).toBe(200);
    const data = assertSuccess(response);
    expect(data.message).toContain("verified");

    // Verify user is now marked as verified
    const [user] = await db
      .select()
      .from(schema.users)
      .where(eq(schema.users.id, userId));
    expect(user.isEmailVerified).toBe(true);
    expect(user.emailVerifiedAt).not.toBeNull();
  });

  it("should reject invalid token (400)", async () => {
    // Act
    const response = await get<ApiResponse>(app, "/v1/auth/verify-email", {
      query: { token: "invalid-token-that-does-not-exist" },
    });

    // Assert
    expect(response.status).toBe(400);
    expect(response.body.success).toBe(false);
    expect(response.body.error?.message).toBeDefined();
  });

  it("should reject expired token (400)", async () => {
    // Arrange - Create user and set token to expired
    const email = testEmail();
    const registerResponse = await post<ApiResponse<RegisterResponse>>(
      app,
      "/v1/auth/register",
      { email, password: "SecurePass123!", displayName: "Expired Test" }
    );
    const userId = assertSuccess(registerResponse).user.id;

    const db = getTestDb();
    const rawToken = "expired-token-12345";
    const tokenHash = await bcrypt.hash(rawToken, 10);
    const expiredDate = new Date(Date.now() - 1000 * 60 * 60); // 1 hour ago

    await db
      .update(schema.emailVerificationTokens)
      .set({ tokenHash, expiresAt: expiredDate })
      .where(eq(schema.emailVerificationTokens.userId, userId));

    // Act
    const response = await get<ApiResponse>(app, "/v1/auth/verify-email", {
      query: { token: rawToken },
    });

    // Assert
    expect(response.status).toBe(400);
    expect(response.body.success).toBe(false);
  });

  it("should mark token as used after verification (AC-1.5)", async () => {
    // Arrange
    const email = testEmail();
    const registerResponse = await post<ApiResponse<RegisterResponse>>(
      app,
      "/v1/auth/register",
      { email, password: "SecurePass123!", displayName: "Single Use Test" }
    );
    const userId = assertSuccess(registerResponse).user.id;

    // Wait for async token creation
    const existingToken = await getVerificationToken(userId);
    expect(existingToken).not.toBeNull();

    const db = getTestDb();
    const rawToken = "single-use-token-12345";
    const tokenHash = await bcrypt.hash(rawToken, 10);

    await db
      .update(schema.emailVerificationTokens)
      .set({ tokenHash })
      .where(eq(schema.emailVerificationTokens.id, existingToken!.id));

    // Act - First verification
    const response1 = await get<ApiResponse<VerifyEmailResponse>>(
      app,
      "/v1/auth/verify-email",
      { query: { token: rawToken } }
    );
    expect(response1.status).toBe(200);

    // Act - Second verification attempt
    const response2 = await get<ApiResponse>(app, "/v1/auth/verify-email", {
      query: { token: rawToken },
    });

    // Assert - Should reject reuse
    expect(response2.status).toBe(400);
    expect(response2.body.success).toBe(false);
  });

  it("should reject missing token parameter", async () => {
    // Act
    const response = await get<ApiResponse>(app, "/v1/auth/verify-email");

    // Assert - Elysia validation returns 400 or 422 for missing required params
    expect([400, 422]).toContain(response.status);
  });
});

// ============================================================================
// POST /v1/auth/resend-verification Tests
// ============================================================================

describe("POST /v1/auth/resend-verification", () => {
  it("should resend verification for unverified user (AC-1.6)", async () => {
    // Arrange - Create unverified user
    const email = testEmail();
    await post<ApiResponse<RegisterResponse>>(app, "/v1/auth/register", {
      email,
      password: "SecurePass123!",
      displayName: "Resend Test",
    });

    // Act
    const response = await post<ApiResponse<ResendVerificationResponse>>(
      app,
      "/v1/auth/resend-verification",
      { email }
    );

    // Assert
    expect(response.status).toBe(200);
    const data = assertSuccess(response);
    expect(data.message).toBeDefined();
  });

  it("should return success even for non-existent email (prevents enumeration)", async () => {
    // Act
    const response = await post<ApiResponse<ResendVerificationResponse>>(
      app,
      "/v1/auth/resend-verification",
      { email: "nonexistent@example.com" }
    );

    // Assert - Should return success to prevent email enumeration
    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
  });

  it("should return success for already verified user (prevents enumeration)", async () => {
    // Arrange - Create and verify user
    const email = testEmail();
    const registerResponse = await post<ApiResponse<RegisterResponse>>(
      app,
      "/v1/auth/register",
      { email, password: "SecurePass123!", displayName: "Already Verified" }
    );
    const userId = assertSuccess(registerResponse).user.id;

    // Mark user as verified directly
    const db = getTestDb();
    await db
      .update(schema.users)
      .set({ isEmailVerified: true, emailVerifiedAt: new Date() })
      .where(eq(schema.users.id, userId));

    // Act
    const response = await post<ApiResponse<ResendVerificationResponse>>(
      app,
      "/v1/auth/resend-verification",
      { email }
    );

    // Assert - Should return success (no email sent though)
    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
  });

  it("should invalidate old tokens when resending", async () => {
    // Arrange - Create unverified user
    const email = testEmail();
    const registerResponse = await post<ApiResponse<RegisterResponse>>(
      app,
      "/v1/auth/register",
      { email, password: "SecurePass123!", displayName: "Invalidate Test" }
    );
    const userId = assertSuccess(registerResponse).user.id;

    // Get original token
    const db = getTestDb();
    const originalToken = await getVerificationToken(userId);
    expect(originalToken).not.toBeNull();

    // Act - Resend verification
    await post<ApiResponse<ResendVerificationResponse>>(
      app,
      "/v1/auth/resend-verification",
      { email }
    );

    // Assert - Original token should be invalidated (verifiedAt set)
    const [oldToken] = await db
      .select()
      .from(schema.emailVerificationTokens)
      .where(eq(schema.emailVerificationTokens.id, originalToken!.id));

    // Old token should be marked as used/invalidated
    expect(oldToken.verifiedAt).not.toBeNull();
  });

  it("should reject invalid email format", async () => {
    // Act
    const response = await post<ApiResponse>(
      app,
      "/v1/auth/resend-verification",
      { email: "not-an-email" }
    );

    // Assert - Elysia returns 400 or 422 for validation errors
    expect([400, 422]).toContain(response.status);
  });

  it("should reject missing email", async () => {
    // Act
    const response = await post<ApiResponse>(
      app,
      "/v1/auth/resend-verification",
      {}
    );

    // Assert - Elysia returns 400 or 422 for validation errors
    expect([400, 422]).toContain(response.status);
  });
});

// ============================================================================
// User Profile - Email Verification Status Tests
// ============================================================================

describe("GET /v1/users/me - Email Verification Status", () => {
  it("should show emailVerified=false for new user", async () => {
    // Arrange - Create and login user
    const email = testEmail();
    const registerResponse = await post<ApiResponse<RegisterResponse>>(
      app,
      "/v1/auth/register",
      { email, password: "SecurePass123!", displayName: "Profile Test" }
    );
    const { tokens } = assertSuccess(registerResponse);

    // Act
    const response = await get<ApiResponse<UserProfileResponse>>(
      app,
      "/v1/users/me",
      { headers: authHeader(tokens.accessToken) }
    );

    // Assert
    expect(response.status).toBe(200);
    const data = assertSuccess(response);
    expect(data.emailVerified).toBe(false);
    expect(data.emailVerifiedAt).toBeNull();
  });

  it("should show emailVerified=true after verification", async () => {
    // Arrange - Create user
    const email = testEmail();
    const registerResponse = await post<ApiResponse<RegisterResponse>>(
      app,
      "/v1/auth/register",
      { email, password: "SecurePass123!", displayName: "Verified Profile" }
    );
    const { user, tokens } = assertSuccess(registerResponse);

    // Wait for async token creation
    const existingToken = await getVerificationToken(user.id);
    expect(existingToken).not.toBeNull();

    // Set up known token and verify
    const db = getTestDb();
    const rawToken = "profile-verify-token-12345";
    const tokenHash = await bcrypt.hash(rawToken, 10);

    await db
      .update(schema.emailVerificationTokens)
      .set({ tokenHash })
      .where(eq(schema.emailVerificationTokens.id, existingToken!.id));

    const verifyResponse = await get<ApiResponse>(app, "/v1/auth/verify-email", {
      query: { token: rawToken },
    });
    expect(verifyResponse.status).toBe(200);

    // Act
    const response = await get<ApiResponse<UserProfileResponse>>(
      app,
      "/v1/users/me",
      { headers: authHeader(tokens.accessToken) }
    );

    // Assert
    expect(response.status).toBe(200);
    const data = assertSuccess(response);
    expect(data.emailVerified).toBe(true);
    expect(data.emailVerifiedAt).not.toBeNull();
  });
});

// ============================================================================
// Edge Cases
// ============================================================================

describe("Email Verification - Edge Cases", () => {
  it("should handle deleted user gracefully", async () => {
    // Arrange - Create user and delete
    const email = testEmail();
    const registerResponse = await post<ApiResponse<RegisterResponse>>(
      app,
      "/v1/auth/register",
      { email, password: "SecurePass123!", displayName: "Deleted User" }
    );
    const { user } = assertSuccess(registerResponse);

    const db = getTestDb();
    await db
      .update(schema.users)
      .set({ deletedAt: new Date() })
      .where(eq(schema.users.id, user.id));

    // Act - Try to resend verification
    const response = await post<ApiResponse<ResendVerificationResponse>>(
      app,
      "/v1/auth/resend-verification",
      { email }
    );

    // Assert - Should return success (prevents enumeration)
    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
  });

  it("should handle case-insensitive email for resend", async () => {
    // Arrange - Create user with lowercase email
    const email = testEmail();
    await post<ApiResponse<RegisterResponse>>(app, "/v1/auth/register", {
      email: email.toLowerCase(),
      password: "SecurePass123!",
      displayName: "Case Test",
    });

    // Act - Resend with uppercase email
    const response = await post<ApiResponse<ResendVerificationResponse>>(
      app,
      "/v1/auth/resend-verification",
      { email: email.toUpperCase() }
    );

    // Assert
    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
  });
});
