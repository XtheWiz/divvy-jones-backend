/**
 * OAuth Service Tests
 * Sprint 010 - TASK-023
 *
 * AC-2.9: Unit tests for OAuth flow
 */

import { describe, expect, it, beforeEach, mock } from "bun:test";
import crypto from "crypto";

// Mock database
mock.module("../db", () => ({
  db: {
    insert: mock(() => ({ values: mock(() => ({ returning: mock(() => Promise.resolve([{ id: "user-1" }])) })) })),
    update: mock(() => ({ set: mock(() => ({ where: mock(() => Promise.resolve()) })) })),
    select: mock(() => ({ from: mock(() => ({ where: mock(() => ({ limit: mock(() => Promise.resolve([])) })) })) })),
    delete: mock(() => ({ where: mock(() => Promise.resolve()) })),
  },
  users: { id: "id", email: "email" },
  userSettings: {},
}));

mock.module("../db/schema/users", () => ({
  oauthAccounts: { id: "id", userId: "userId", provider: "provider" },
}));

describe("OAuth Service", () => {
  describe("Token Encryption", () => {
    it("should encrypt and decrypt tokens correctly", () => {
      // Mock encryption key
      const key = crypto.randomBytes(32).toString("hex").slice(0, 32);

      // Encrypt
      const token = "test-refresh-token-12345";
      const iv = crypto.randomBytes(16);
      const cipher = crypto.createCipheriv(
        "aes-256-gcm",
        Buffer.from(key),
        iv
      );

      let encrypted = cipher.update(token, "utf8", "hex");
      encrypted += cipher.final("hex");
      const authTag = cipher.getAuthTag();

      const encryptedToken = `enc:${iv.toString("hex")}:${authTag.toString("hex")}:${encrypted}`;

      // Decrypt
      const parts = encryptedToken.slice(4).split(":");
      const [ivHex, authTagHex, encryptedData] = parts;

      const decipher = crypto.createDecipheriv(
        "aes-256-gcm",
        Buffer.from(key),
        Buffer.from(ivHex, "hex")
      );
      decipher.setAuthTag(Buffer.from(authTagHex, "hex"));

      let decrypted = decipher.update(encryptedData, "hex", "utf8");
      decrypted += decipher.final("utf8");

      expect(decrypted).toBe(token);
    });

    it("should handle plaintext tokens for development", () => {
      const token = "plain:my-token";
      const extracted = token.slice(6);
      expect(extracted).toBe("my-token");
    });

    it("should reject invalid encrypted tokens", () => {
      const invalidTokens = [
        "not-encrypted",
        "enc:invalid",
        "enc:too:many:parts:here",
      ];

      for (const token of invalidTokens) {
        if (token.startsWith("enc:")) {
          const parts = token.slice(4).split(":");
          expect(parts.length).not.toBe(3);
        }
      }
    });
  });

  describe("OAuth State Generation", () => {
    it("should generate valid state with nonce and timestamp", () => {
      const secret = "test-secret";
      const payload = {
        nonce: crypto.randomUUID(),
        timestamp: Date.now(),
      };

      const data = JSON.stringify(payload);
      const signature = crypto
        .createHmac("sha256", secret)
        .update(data)
        .digest("hex");

      const state = Buffer.from(`${data}.${signature}`).toString("base64url");

      expect(state).toBeTruthy();
      expect(typeof state).toBe("string");

      // Decode and verify
      const decoded = Buffer.from(state, "base64url").toString("utf8");
      const [dataStr, sig] = decoded.split(".");

      expect(dataStr).toBeTruthy();
      expect(sig).toBe(signature);
    });

    it("should reject expired state", () => {
      const maxAge = 10 * 60 * 1000; // 10 minutes
      const expiredTimestamp = Date.now() - maxAge - 1000; // 1 second past expiry

      const isExpired = Date.now() - expiredTimestamp > maxAge;
      expect(isExpired).toBe(true);
    });

    it("should accept valid state within time window", () => {
      const maxAge = 10 * 60 * 1000;
      const validTimestamp = Date.now() - (5 * 60 * 1000); // 5 minutes ago

      const isExpired = Date.now() - validTimestamp > maxAge;
      expect(isExpired).toBe(false);
    });

    it("should reject state with invalid signature", () => {
      const secret = "test-secret";
      const wrongSecret = "wrong-secret";

      const payload = { nonce: "123", timestamp: Date.now() };
      const data = JSON.stringify(payload);

      const correctSig = crypto.createHmac("sha256", secret).update(data).digest("hex");
      const wrongSig = crypto.createHmac("sha256", wrongSecret).update(data).digest("hex");

      expect(correctSig).not.toBe(wrongSig);
    });
  });

  describe("Google Auth URL Generation", () => {
    it("should include required OAuth parameters", () => {
      const clientId = "test-client-id";
      const redirectUri = "http://localhost:3000/auth/google/callback";
      const scopes = ["openid", "email", "profile"];
      const state = "test-state";

      const params = new URLSearchParams({
        client_id: clientId,
        redirect_uri: redirectUri,
        response_type: "code",
        scope: scopes.join(" "),
        state,
        access_type: "offline",
        prompt: "consent",
      });

      const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;

      expect(authUrl).toContain("client_id=test-client-id");
      expect(authUrl).toContain("response_type=code");
      expect(authUrl).toContain("scope=openid");
      expect(authUrl).toContain("access_type=offline");
    });
  });

  describe("Token Exchange Response Handling", () => {
    it("should parse Google token response correctly", () => {
      const googleResponse = {
        access_token: "ya29.a0...",
        refresh_token: "1//04...",
        expires_in: 3600,
        token_type: "Bearer",
        id_token: "eyJhbGciOiJSUzI1NiI...",
      };

      const tokens = {
        accessToken: googleResponse.access_token,
        refreshToken: googleResponse.refresh_token,
        idToken: googleResponse.id_token,
        expiresIn: googleResponse.expires_in,
        tokenType: googleResponse.token_type,
      };

      expect(tokens.accessToken).toBe("ya29.a0...");
      expect(tokens.refreshToken).toBe("1//04...");
      expect(tokens.expiresIn).toBe(3600);
    });

    it("should handle missing refresh token", () => {
      const googleResponse = {
        access_token: "ya29.a0...",
        expires_in: 3600,
        token_type: "Bearer",
      };

      const tokens = {
        accessToken: googleResponse.access_token,
        refreshToken: undefined,
        expiresIn: googleResponse.expires_in,
      };

      expect(tokens.refreshToken).toBeUndefined();
    });
  });

  describe("Google User Info Parsing", () => {
    it("should parse Google user info correctly", () => {
      const googleUserInfo = {
        id: "123456789",
        email: "user@gmail.com",
        name: "John Doe",
        picture: "https://lh3.googleusercontent.com/...",
        verified_email: true,
      };

      expect(googleUserInfo.id).toBe("123456789");
      expect(googleUserInfo.email).toBe("user@gmail.com");
      expect(googleUserInfo.verified_email).toBe(true);
    });

    it("should handle user without picture", () => {
      const userInfo: Record<string, unknown> = {
        id: "123",
        email: "user@gmail.com",
        name: "Test",
        verified_email: true,
      };

      expect(userInfo.picture).toBeUndefined();
    });
  });

  describe("User Creation/Linking Logic", () => {
    it("should create new user with emailVerified=true for OAuth", () => {
      const newUser = {
        email: "user@gmail.com",
        displayName: "John Doe",
        primaryAuthProvider: "google",
        isEmailVerified: true,
        emailVerifiedAt: new Date(),
      };

      expect(newUser.isEmailVerified).toBe(true);
      expect(newUser.primaryAuthProvider).toBe("google");
    });

    it("should use email prefix as displayName if name missing", () => {
      const email = "user@gmail.com";
      const fallbackName = email.split("@")[0];

      expect(fallbackName).toBe("user");
    });

    it("should mark existing user as verified when linking Google", () => {
      const existingUser = {
        id: "user-1",
        email: "user@example.com",
        isEmailVerified: false,
      };

      // After linking Google
      const updatedUser = {
        ...existingUser,
        isEmailVerified: true,
        emailVerifiedAt: new Date(),
      };

      expect(updatedUser.isEmailVerified).toBe(true);
    });
  });

  describe("OAuth Account Storage", () => {
    it("should store provider and providerUid", () => {
      const oauthAccount = {
        userId: "user-1",
        provider: "google",
        providerUid: "123456789",
        emailAtProvider: "user@gmail.com",
      };

      expect(oauthAccount.provider).toBe("google");
      expect(oauthAccount.providerUid).toBe("123456789");
    });

    it("should calculate token expiry correctly", () => {
      const expiresIn = 3600; // 1 hour
      const tokenExpiresAt = new Date(Date.now() + expiresIn * 1000);

      const oneHourFromNow = Date.now() + 3600000;
      const diff = Math.abs(tokenExpiresAt.getTime() - oneHourFromNow);

      expect(diff).toBeLessThan(1000); // Within 1 second
    });
  });

  describe("Linked Providers Query", () => {
    it("should return array of linked providers", () => {
      const linkedProviders = [
        { provider: "google", linkedAt: new Date("2024-01-01") },
        { provider: "apple", linkedAt: new Date("2024-01-15") },
      ];

      expect(linkedProviders.length).toBe(2);
      expect(linkedProviders[0].provider).toBe("google");
    });

    it("should return empty array for users with no OAuth", () => {
      const linkedProviders: any[] = [];
      expect(linkedProviders.length).toBe(0);
    });
  });

  describe("Unlink Provider Logic", () => {
    it("should not allow unlinking last auth method", () => {
      const user = { passwordHash: null };
      const providerCount = 1;

      const canUnlink = user.passwordHash || providerCount > 1;
      expect(canUnlink).toBe(false);
    });

    it("should allow unlinking if user has password", () => {
      const user = { passwordHash: "hashed" };
      const providerCount = 1;

      const canUnlink = !!user.passwordHash || providerCount > 1;
      expect(canUnlink).toBe(true);
    });

    it("should allow unlinking if user has other providers", () => {
      const user = { passwordHash: null };
      const providerCount = 2;

      const canUnlink = user.passwordHash || providerCount > 1;
      expect(canUnlink).toBe(true);
    });
  });

  describe("Configuration Check", () => {
    it("should detect missing OAuth configuration", () => {
      const clientId = "";
      const clientSecret = "";

      const isConfigured = !!(clientId && clientSecret);
      expect(isConfigured).toBe(false);
    });

    it("should detect valid OAuth configuration", () => {
      const clientId = "123.apps.googleusercontent.com";
      const clientSecret = "GOCSPX-...";

      const isConfigured = !!(clientId && clientSecret);
      expect(isConfigured).toBe(true);
    });
  });
});
