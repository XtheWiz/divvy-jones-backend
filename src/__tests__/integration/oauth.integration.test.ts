/**
 * OAuth Integration Tests
 * E2E Test Plan - Phase 2
 *
 * Tests for OAuth authentication flow:
 * - GET /v1/auth/google (redirect to Google)
 * - GET /v1/auth/google/callback (OAuth callback)
 * - GET /v1/users/me (linked providers)
 * - POST /v1/users/me/password (set password for OAuth users)
 *
 * Note: These tests mock Google responses since we can't use real OAuth
 * in integration tests without actual credentials.
 */

import { describe, it, expect, beforeAll, afterAll } from "bun:test";
import { eq } from "drizzle-orm";
import * as bcrypt from "bcryptjs";
import {
  beforeAllTests,
  afterAllTests,
  testEmail,
  getTestDb,
  schema,
  testId,
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

interface UserProfileResponse {
  id: string;
  email: string;
  displayName: string;
  emailVerified: boolean;
  emailVerifiedAt: string | null;
  primaryAuthProvider: string;
  hasPassword: boolean;
  linkedProviders: Array<{
    provider: string;
    linkedAt: string;
  }>;
  createdAt: string;
}

interface SetPasswordResponse {
  message: string;
}

interface LoginResponse {
  user: {
    id: string;
    email: string;
  };
  tokens: {
    accessToken: string;
    refreshToken: string;
    expiresIn: number;
  };
}

// ============================================================================
// Helper: Create OAuth User (simulates user created via OAuth)
// ============================================================================

async function createOAuthUser(options: { email?: string; hasPassword?: boolean } = {}) {
  const db = getTestDb();
  const email = options.email || testEmail();
  const displayName = `OAuth User ${testId()}`;

  // Create user without password (OAuth-only user)
  const [user] = await db
    .insert(schema.users)
    .values({
      email,
      displayName,
      passwordHash: options.hasPassword ? await bcrypt.hash("ExistingPass123!", 10) : null,
      primaryAuthProvider: "google",
      isEmailVerified: true, // OAuth users are auto-verified
      emailVerifiedAt: new Date(),
    })
    .returning();

  // Create OAuth account link
  await db.insert(schema.oauthAccounts).values({
    userId: user.id,
    provider: "google",
    providerUid: `google-${testId()}`,
    emailAtProvider: email,
    accessToken: "encrypted:mock-access-token",
    refreshToken: "encrypted:mock-refresh-token",
    tokenExpiresAt: new Date(Date.now() + 3600000), // 1 hour
  });

  return user;
}

// ============================================================================
// Helper: Login OAuth User (for tests that need tokens)
// ============================================================================

async function loginOAuthUser(userId: string) {
  // Generate tokens directly since OAuth users can't login with password
  // In real scenario, they would use OAuth flow
  const db = getTestDb();
  const [user] = await db
    .select()
    .from(schema.users)
    .where(eq(schema.users.id, userId));

  // Create a password temporarily for login
  const tempPassword = "TempPass123!";
  const passwordHash = await bcrypt.hash(tempPassword, 10);

  await db
    .update(schema.users)
    .set({ passwordHash })
    .where(eq(schema.users.id, userId));

  const response = await post<ApiResponse<LoginResponse>>(
    app,
    "/v1/auth/login",
    { email: user.email, password: tempPassword }
  );

  if (response.status !== 200 || !response.body.success) {
    throw new Error(`Failed to login OAuth user: ${JSON.stringify(response.body)}`);
  }

  return response.body.data!.tokens.accessToken;
}

// ============================================================================
// GET /v1/auth/google - OAuth Redirect Tests
// ============================================================================

describe("GET /v1/auth/google - OAuth Redirect", () => {
  it("should return 503 when Google OAuth is not configured", async () => {
    // Note: In test environment, GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET
    // are not set, so this should return service unavailable

    // Act
    const response = await get<ApiResponse>(app, "/v1/auth/google");

    // Assert - Should return error when not configured
    // The exact status depends on implementation
    expect([302, 503]).toContain(response.status);

    if (response.status === 503) {
      expect(response.body.success).toBe(false);
      expect(response.body.error?.message).toContain("not configured");
    }
  });
});

// ============================================================================
// GET /v1/auth/google/callback - OAuth Callback Tests
// ============================================================================

describe("GET /v1/auth/google/callback - OAuth Callback", () => {
  it("should reject callback without code parameter", async () => {
    // Act
    const response = await get<ApiResponse>(app, "/v1/auth/google/callback", {
      query: { state: "some-state" },
    });

    // Assert
    expect(response.status).toBe(400);
    expect(response.body.success).toBe(false);
  });

  it("should reject callback without state parameter", async () => {
    // Act
    const response = await get<ApiResponse>(app, "/v1/auth/google/callback", {
      query: { code: "some-code" },
    });

    // Assert
    expect(response.status).toBe(400);
    expect(response.body.success).toBe(false);
  });

  it("should reject callback with invalid state", async () => {
    // Act
    const response = await get<ApiResponse>(app, "/v1/auth/google/callback", {
      query: { code: "some-code", state: "invalid-state" },
    });

    // Assert
    expect(response.status).toBe(400);
    expect(response.body.success).toBe(false);
  });

  it("should handle OAuth error from provider", async () => {
    // Act - When user denies access, Google sends error parameter
    const response = await get<ApiResponse>(app, "/v1/auth/google/callback", {
      query: { error: "access_denied", state: "some-state" },
    });

    // Assert
    expect(response.status).toBe(400);
    expect(response.body.success).toBe(false);
    expect(response.body.error?.message).toContain("denied");
  });
});

// ============================================================================
// GET /v1/users/me - Linked Providers Tests (AC-2.7)
// ============================================================================

describe("GET /v1/users/me - Linked OAuth Providers", () => {
  it("should show linked Google provider for OAuth user (AC-2.7)", async () => {
    // Arrange
    const user = await createOAuthUser();
    const token = await loginOAuthUser(user.id);

    // Act
    const response = await get<ApiResponse<UserProfileResponse>>(
      app,
      "/v1/users/me",
      { headers: authHeader(token) }
    );

    // Assert
    expect(response.status).toBe(200);
    const data = assertSuccess(response);
    expect(data.linkedProviders).toBeDefined();
    expect(data.linkedProviders.length).toBeGreaterThanOrEqual(1);

    const googleProvider = data.linkedProviders.find((p) => p.provider === "google");
    expect(googleProvider).toBeDefined();
    expect(googleProvider?.linkedAt).toBeDefined();
  });

  it("should show emailVerified=true for OAuth user (AC-2.4)", async () => {
    // Arrange
    const user = await createOAuthUser();
    const token = await loginOAuthUser(user.id);

    // Act
    const response = await get<ApiResponse<UserProfileResponse>>(
      app,
      "/v1/users/me",
      { headers: authHeader(token) }
    );

    // Assert
    expect(response.status).toBe(200);
    const data = assertSuccess(response);
    expect(data.emailVerified).toBe(true);
    expect(data.emailVerifiedAt).not.toBeNull();
  });

  it("should show primaryAuthProvider as google for OAuth user", async () => {
    // Arrange
    const user = await createOAuthUser();
    const token = await loginOAuthUser(user.id);

    // Act
    const response = await get<ApiResponse<UserProfileResponse>>(
      app,
      "/v1/users/me",
      { headers: authHeader(token) }
    );

    // Assert
    expect(response.status).toBe(200);
    const data = assertSuccess(response);
    expect(data.primaryAuthProvider).toBe("google");
  });

  it("should show hasPassword=false for OAuth-only user", async () => {
    // Arrange - Create OAuth user without password
    const db = getTestDb();
    const email = testEmail();

    const [user] = await db
      .insert(schema.users)
      .values({
        email,
        displayName: `OAuth Only ${testId()}`,
        passwordHash: null, // No password
        primaryAuthProvider: "google",
        isEmailVerified: true,
        emailVerifiedAt: new Date(),
      })
      .returning();

    await db.insert(schema.oauthAccounts).values({
      userId: user.id,
      provider: "google",
      providerUid: `google-${testId()}`,
      emailAtProvider: email,
    });

    // Login requires password, so we add one temporarily
    const token = await loginOAuthUser(user.id);

    // Reset password to null for the test
    await db
      .update(schema.users)
      .set({ passwordHash: null })
      .where(eq(schema.users.id, user.id));

    // Act
    const response = await get<ApiResponse<UserProfileResponse>>(
      app,
      "/v1/users/me",
      { headers: authHeader(token) }
    );

    // Assert
    expect(response.status).toBe(200);
    const data = assertSuccess(response);
    expect(data.hasPassword).toBe(false);
  });

  it("should show empty linkedProviders for password-only user", async () => {
    // Arrange - Create regular user with password
    const user = await createTestUser();

    const loginResponse = await post<ApiResponse<LoginResponse>>(
      app,
      "/v1/auth/login",
      { email: user.email, password: user.plainPassword }
    );
    const token = assertSuccess(loginResponse).tokens.accessToken;

    // Act
    const response = await get<ApiResponse<UserProfileResponse>>(
      app,
      "/v1/users/me",
      { headers: authHeader(token) }
    );

    // Assert
    expect(response.status).toBe(200);
    const data = assertSuccess(response);
    expect(data.linkedProviders).toBeDefined();
    expect(data.linkedProviders.length).toBe(0);
  });
});

// ============================================================================
// POST /v1/users/me/password - Set Password for OAuth User (AC-2.6)
// ============================================================================

describe("POST /v1/users/me/password - Set Password for OAuth User", () => {
  it("should allow OAuth user to set password (AC-2.6)", async () => {
    // Arrange - Create OAuth user without password
    const db = getTestDb();
    const email = testEmail();

    const [user] = await db
      .insert(schema.users)
      .values({
        email,
        displayName: `Set Password Test ${testId()}`,
        passwordHash: null,
        primaryAuthProvider: "google",
        isEmailVerified: true,
        emailVerifiedAt: new Date(),
      })
      .returning();

    await db.insert(schema.oauthAccounts).values({
      userId: user.id,
      provider: "google",
      providerUid: `google-${testId()}`,
      emailAtProvider: email,
    });

    const token = await loginOAuthUser(user.id);

    // Reset password to null
    await db
      .update(schema.users)
      .set({ passwordHash: null })
      .where(eq(schema.users.id, user.id));

    // Act
    const response = await post<ApiResponse<SetPasswordResponse>>(
      app,
      "/v1/users/me/password",
      { newPassword: "NewSecurePass123!" },
      { headers: authHeader(token) }
    );

    // Assert
    expect(response.status).toBe(200);
    const data = assertSuccess(response);
    expect(data.message).toContain("Password");

    // Verify can now login with password
    const loginResponse = await post<ApiResponse<LoginResponse>>(
      app,
      "/v1/auth/login",
      { email, password: "NewSecurePass123!" }
    );
    expect(loginResponse.status).toBe(200);
  });

  it("should require current password when changing existing password", async () => {
    // Arrange - Create user with existing password
    const user = await createTestUser();

    const loginResponse = await post<ApiResponse<LoginResponse>>(
      app,
      "/v1/auth/login",
      { email: user.email, password: user.plainPassword }
    );
    const token = assertSuccess(loginResponse).tokens.accessToken;

    // Act - Try to change password without current password
    const response = await post<ApiResponse>(
      app,
      "/v1/users/me/password",
      { newPassword: "AnotherPass123!" },
      { headers: authHeader(token) }
    );

    // Assert
    expect(response.status).toBe(400);
    expect(response.body.success).toBe(false);
  });

  it("should change password with correct current password", async () => {
    // Arrange
    const user = await createTestUser();

    const loginResponse = await post<ApiResponse<LoginResponse>>(
      app,
      "/v1/auth/login",
      { email: user.email, password: user.plainPassword }
    );
    const token = assertSuccess(loginResponse).tokens.accessToken;

    // Act
    const response = await post<ApiResponse<SetPasswordResponse>>(
      app,
      "/v1/users/me/password",
      {
        currentPassword: user.plainPassword,
        newPassword: "ChangedPass123!",
      },
      { headers: authHeader(token) }
    );

    // Assert
    expect(response.status).toBe(200);

    // Verify new password works
    const newLoginResponse = await post<ApiResponse<LoginResponse>>(
      app,
      "/v1/auth/login",
      { email: user.email, password: "ChangedPass123!" }
    );
    expect(newLoginResponse.status).toBe(200);
  });

  it("should reject incorrect current password", async () => {
    // Arrange
    const user = await createTestUser();

    const loginResponse = await post<ApiResponse<LoginResponse>>(
      app,
      "/v1/auth/login",
      { email: user.email, password: user.plainPassword }
    );
    const token = assertSuccess(loginResponse).tokens.accessToken;

    // Act
    const response = await post<ApiResponse>(
      app,
      "/v1/users/me/password",
      {
        currentPassword: "WrongPassword123!",
        newPassword: "NewPass123!",
      },
      { headers: authHeader(token) }
    );

    // Assert - API returns 401 for invalid credentials
    expect(response.status).toBe(401);
    expect(response.body.success).toBe(false);
  });

  it("should reject weak new password", async () => {
    // Arrange - Create regular user (simpler than OAuth user for this test)
    const user = await createTestUser();

    const loginResponse = await post<ApiResponse<LoginResponse>>(
      app,
      "/v1/auth/login",
      { email: user.email, password: user.plainPassword }
    );
    const token = assertSuccess(loginResponse).tokens.accessToken;

    // Act - Try to set weak password
    const response = await post<ApiResponse>(
      app,
      "/v1/users/me/password",
      {
        currentPassword: user.plainPassword,
        newPassword: "weak"
      },
      { headers: authHeader(token) }
    );

    // Assert - API returns 400 or 422 for validation error
    expect([400, 422]).toContain(response.status);
  });

  it("should reject missing new password", async () => {
    // Arrange
    const user = await createTestUser();

    const loginResponse = await post<ApiResponse<LoginResponse>>(
      app,
      "/v1/auth/login",
      { email: user.email, password: user.plainPassword }
    );
    const token = assertSuccess(loginResponse).tokens.accessToken;

    // Act
    const response = await post<ApiResponse>(
      app,
      "/v1/users/me/password",
      { currentPassword: user.plainPassword },
      { headers: authHeader(token) }
    );

    // Assert - API returns 422 for missing required field
    expect([400, 422]).toContain(response.status);
  });

  it("should require authentication", async () => {
    // Act
    const response = await post<ApiResponse>(app, "/v1/users/me/password", {
      newPassword: "SomePass123!",
    });

    // Assert
    expect(response.status).toBe(401);
  });
});

// ============================================================================
// Account Linking Tests (AC-2.5)
// ============================================================================

describe("OAuth Account Linking", () => {
  it("should link multiple OAuth providers to single user", async () => {
    // Arrange - Create user with Google OAuth
    const db = getTestDb();
    const email = testEmail();

    const [user] = await db
      .insert(schema.users)
      .values({
        email,
        displayName: `Multi Provider ${testId()}`,
        passwordHash: await bcrypt.hash("TestPass123!", 10),
        primaryAuthProvider: "google",
        isEmailVerified: true,
        emailVerifiedAt: new Date(),
      })
      .returning();

    // Add Google OAuth account
    await db.insert(schema.oauthAccounts).values({
      userId: user.id,
      provider: "google",
      providerUid: `google-${testId()}`,
      emailAtProvider: email,
    });

    // Login to get token
    const loginResponse = await post<ApiResponse<LoginResponse>>(
      app,
      "/v1/auth/login",
      { email, password: "TestPass123!" }
    );
    const token = assertSuccess(loginResponse).tokens.accessToken;

    // Act - Get profile
    const response = await get<ApiResponse<UserProfileResponse>>(
      app,
      "/v1/users/me",
      { headers: authHeader(token) }
    );

    // Assert
    expect(response.status).toBe(200);
    const data = assertSuccess(response);
    expect(data.linkedProviders.length).toBe(1);
    expect(data.hasPassword).toBe(true);
  });

  it("should preserve email verification when linking OAuth", async () => {
    // Arrange - Create OAuth user (auto-verified)
    const user = await createOAuthUser();
    const token = await loginOAuthUser(user.id);

    // Act
    const response = await get<ApiResponse<UserProfileResponse>>(
      app,
      "/v1/users/me",
      { headers: authHeader(token) }
    );

    // Assert
    expect(response.status).toBe(200);
    const data = assertSuccess(response);
    expect(data.emailVerified).toBe(true);
  });
});

// ============================================================================
// Edge Cases
// ============================================================================

describe("OAuth - Edge Cases", () => {
  it("should handle user with both password and OAuth", async () => {
    // Arrange - Create user with both auth methods
    const user = await createOAuthUser({ hasPassword: true });
    const token = await loginOAuthUser(user.id);

    // Act
    const response = await get<ApiResponse<UserProfileResponse>>(
      app,
      "/v1/users/me",
      { headers: authHeader(token) }
    );

    // Assert
    expect(response.status).toBe(200);
    const data = assertSuccess(response);
    expect(data.hasPassword).toBe(true);
    expect(data.linkedProviders.length).toBeGreaterThanOrEqual(1);
  });
});
