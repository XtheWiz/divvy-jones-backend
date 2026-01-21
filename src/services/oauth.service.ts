/**
 * OAuth Service
 * Sprint 010 - TASK-018, TASK-019
 *
 * Service for OAuth authentication (Google).
 * AC-2.1: Google OAuth 2.0 integration configured
 * AC-2.4: New users created via OAuth have emailVerified=true
 * AC-2.5: Existing email users can link Google account
 * AC-2.8: OAuth tokens stored securely (refresh tokens encrypted)
 */

import { eq, and } from "drizzle-orm";
import { db, users, userSettings } from "../db";
import { oauthAccounts } from "../db/schema/users";
import crypto from "crypto";

// ============================================================================
// Configuration
// ============================================================================

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || "";
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || "";
const GOOGLE_CALLBACK_URL =
  process.env.GOOGLE_CALLBACK_URL ||
  "http://localhost:3000/auth/google/callback";

// Encryption key for OAuth tokens (should be 32 bytes for AES-256)
const OAUTH_ENCRYPTION_KEY = process.env.OAUTH_ENCRYPTION_KEY || "";

// Google OAuth endpoints
const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GOOGLE_USERINFO_URL = "https://www.googleapis.com/oauth2/v2/userinfo";

// OAuth scopes
const GOOGLE_SCOPES = ["openid", "email", "profile"];

// ============================================================================
// Types
// ============================================================================

export interface GoogleUserInfo {
  id: string;
  email: string;
  name: string;
  picture?: string;
  verified_email: boolean;
}

export interface OAuthTokens {
  accessToken: string;
  refreshToken?: string;
  idToken?: string;
  expiresIn: number;
  tokenType: string;
}

export interface OAuthStatePayload {
  nonce: string;
  timestamp: number;
}

export interface FindOrCreateResult {
  user: {
    id: string;
    email: string | null;
    displayName: string;
    isEmailVerified: boolean;
  };
  isNew: boolean;
  linked: boolean;
}

// ============================================================================
// Configuration Check
// ============================================================================

/**
 * Check if Google OAuth is configured
 */
export function isGoogleOAuthConfigured(): boolean {
  return !!(GOOGLE_CLIENT_ID && GOOGLE_CLIENT_SECRET);
}

// ============================================================================
// Token Encryption (AC-2.8)
// ============================================================================

/**
 * Encrypt OAuth refresh token for secure storage
 * Uses AES-256-GCM
 */
export function encryptToken(token: string): string {
  if (!OAUTH_ENCRYPTION_KEY || OAUTH_ENCRYPTION_KEY.length < 32) {
    // If no encryption key, store as-is (for development)
    // In production, this should throw
    console.warn(
      "OAUTH_ENCRYPTION_KEY not set or too short. OAuth tokens stored unencrypted."
    );
    return `plain:${token}`;
  }

  const key = Buffer.from(OAUTH_ENCRYPTION_KEY.slice(0, 32));
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);

  let encrypted = cipher.update(token, "utf8", "hex");
  encrypted += cipher.final("hex");

  const authTag = cipher.getAuthTag();

  // Format: iv:authTag:encrypted
  return `enc:${iv.toString("hex")}:${authTag.toString("hex")}:${encrypted}`;
}

/**
 * Decrypt OAuth refresh token
 */
export function decryptToken(encryptedToken: string): string | null {
  // Handle plaintext tokens (development)
  if (encryptedToken.startsWith("plain:")) {
    return encryptedToken.slice(6);
  }

  if (!encryptedToken.startsWith("enc:")) {
    return null;
  }

  if (!OAUTH_ENCRYPTION_KEY || OAUTH_ENCRYPTION_KEY.length < 32) {
    console.warn("Cannot decrypt token: OAUTH_ENCRYPTION_KEY not set");
    return null;
  }

  try {
    const parts = encryptedToken.slice(4).split(":");
    if (parts.length !== 3) return null;

    const [ivHex, authTagHex, encrypted] = parts;
    const key = Buffer.from(OAUTH_ENCRYPTION_KEY.slice(0, 32));
    const iv = Buffer.from(ivHex, "hex");
    const authTag = Buffer.from(authTagHex, "hex");

    const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
    decipher.setAuthTag(authTag);

    let decrypted = decipher.update(encrypted, "hex", "utf8");
    decrypted += decipher.final("utf8");

    return decrypted;
  } catch (err) {
    console.error("Failed to decrypt OAuth token:", err);
    return null;
  }
}

// ============================================================================
// OAuth State Management (CSRF Protection)
// ============================================================================

/**
 * Generate OAuth state parameter
 * Uses signed JWT-like structure for CSRF protection
 */
export function generateOAuthState(): string {
  const payload: OAuthStatePayload = {
    nonce: crypto.randomUUID(),
    timestamp: Date.now(),
  };

  const data = JSON.stringify(payload);
  const signature = crypto
    .createHmac("sha256", GOOGLE_CLIENT_SECRET || "dev-secret")
    .update(data)
    .digest("hex");

  return Buffer.from(`${data}.${signature}`).toString("base64url");
}

/**
 * Verify OAuth state parameter
 */
export function verifyOAuthState(state: string): OAuthStatePayload | null {
  try {
    const decoded = Buffer.from(state, "base64url").toString("utf8");
    const [data, signature] = decoded.split(".");

    if (!data || !signature) return null;

    // Verify signature
    const expectedSignature = crypto
      .createHmac("sha256", GOOGLE_CLIENT_SECRET || "dev-secret")
      .update(data)
      .digest("hex");

    if (signature !== expectedSignature) return null;

    const payload: OAuthStatePayload = JSON.parse(data);

    // Check timestamp (state valid for 10 minutes)
    const maxAge = 10 * 60 * 1000;
    if (Date.now() - payload.timestamp > maxAge) return null;

    return payload;
  } catch {
    return null;
  }
}

// ============================================================================
// Google OAuth URLs
// ============================================================================

/**
 * Get Google OAuth authorization URL
 * AC-2.2: Redirects to Google OAuth consent screen
 */
export function getGoogleAuthUrl(state: string): string {
  const params = new URLSearchParams({
    client_id: GOOGLE_CLIENT_ID,
    redirect_uri: GOOGLE_CALLBACK_URL,
    response_type: "code",
    scope: GOOGLE_SCOPES.join(" "),
    state,
    access_type: "offline", // Request refresh token
    prompt: "consent", // Force consent to get refresh token
  });

  return `${GOOGLE_AUTH_URL}?${params.toString()}`;
}

// ============================================================================
// Google Token Exchange
// ============================================================================

/**
 * Exchange authorization code for tokens
 * AC-2.3: Handles OAuth callback
 */
export async function exchangeGoogleCode(
  code: string
): Promise<OAuthTokens | null> {
  try {
    const response = await fetch(GOOGLE_TOKEN_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        client_id: GOOGLE_CLIENT_ID,
        client_secret: GOOGLE_CLIENT_SECRET,
        code,
        grant_type: "authorization_code",
        redirect_uri: GOOGLE_CALLBACK_URL,
      }),
    });

    if (!response.ok) {
      console.error("Google token exchange failed:", await response.text());
      return null;
    }

    const data = (await response.json()) as {
      access_token: string;
      refresh_token?: string;
      id_token?: string;
      expires_in: number;
      token_type: string;
    };

    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      idToken: data.id_token,
      expiresIn: data.expires_in,
      tokenType: data.token_type,
    };
  } catch (err) {
    console.error("Error exchanging Google code:", err);
    return null;
  }
}

// ============================================================================
// Google User Info
// ============================================================================

/**
 * Get user info from Google
 */
export async function getGoogleUserInfo(
  accessToken: string
): Promise<GoogleUserInfo | null> {
  try {
    const response = await fetch(GOOGLE_USERINFO_URL, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!response.ok) {
      console.error("Failed to get Google user info:", await response.text());
      return null;
    }

    return (await response.json()) as GoogleUserInfo;
  } catch (err) {
    console.error("Error getting Google user info:", err);
    return null;
  }
}

// ============================================================================
// User Management (AC-2.4, AC-2.5)
// ============================================================================

/**
 * Find or create user from Google OAuth
 *
 * AC-2.4: New users have emailVerified=true
 * AC-2.5: Existing users get account linked
 */
export async function findOrCreateGoogleUser(
  googleUser: GoogleUserInfo,
  tokens: OAuthTokens
): Promise<FindOrCreateResult | null> {
  const email = googleUser.email.toLowerCase().trim();

  // Check if already linked via OAuth
  const [existingOAuth] = await db
    .select()
    .from(oauthAccounts)
    .where(
      and(
        eq(oauthAccounts.provider, "google"),
        eq(oauthAccounts.providerUid, googleUser.id)
      )
    )
    .limit(1);

  if (existingOAuth) {
    // User already linked, update tokens and return
    await updateOAuthTokens(existingOAuth.id, tokens);

    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.id, existingOAuth.userId))
      .limit(1);

    if (!user) return null;

    return {
      user: {
        id: user.id,
        email: user.email,
        displayName: user.displayName,
        isEmailVerified: user.isEmailVerified,
      },
      isNew: false,
      linked: false,
    };
  }

  // Check if user exists with same email
  const [existingUser] = await db
    .select()
    .from(users)
    .where(eq(users.email, email))
    .limit(1);

  if (existingUser) {
    // AC-2.5: Link Google account to existing user
    await linkGoogleAccount(existingUser.id, googleUser, tokens);

    // Mark email as verified (Google verified it)
    if (!existingUser.isEmailVerified) {
      await db
        .update(users)
        .set({
          isEmailVerified: true,
          emailVerifiedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(users.id, existingUser.id));
    }

    return {
      user: {
        id: existingUser.id,
        email: existingUser.email,
        displayName: existingUser.displayName,
        isEmailVerified: true,
      },
      isNew: false,
      linked: true,
    };
  }

  // AC-2.4: Create new user with emailVerified=true
  const [newUser] = await db
    .insert(users)
    .values({
      email,
      displayName: googleUser.name || email.split("@")[0],
      primaryAuthProvider: "google",
      isEmailVerified: true, // AC-2.4
      emailVerifiedAt: new Date(),
    })
    .returning();

  // Create user settings
  await db.insert(userSettings).values({
    userId: newUser.id,
  });

  // Link Google account
  await linkGoogleAccount(newUser.id, googleUser, tokens);

  return {
    user: {
      id: newUser.id,
      email: newUser.email,
      displayName: newUser.displayName,
      isEmailVerified: newUser.isEmailVerified,
    },
    isNew: true,
    linked: true,
  };
}

/**
 * Link Google account to user
 */
async function linkGoogleAccount(
  userId: string,
  googleUser: GoogleUserInfo,
  tokens: OAuthTokens
): Promise<void> {
  await db.insert(oauthAccounts).values({
    userId,
    provider: "google",
    providerUid: googleUser.id,
    emailAtProvider: googleUser.email,
    refreshToken: tokens.refreshToken
      ? encryptToken(tokens.refreshToken)
      : null,
    accessToken: encryptToken(tokens.accessToken),
    tokenExpiresAt: new Date(Date.now() + tokens.expiresIn * 1000),
  });
}

/**
 * Update OAuth tokens for existing account
 */
async function updateOAuthTokens(
  oauthAccountId: string,
  tokens: OAuthTokens
): Promise<void> {
  const updates: Record<string, any> = {
    accessToken: encryptToken(tokens.accessToken),
    tokenExpiresAt: new Date(Date.now() + tokens.expiresIn * 1000),
    updatedAt: new Date(),
  };

  if (tokens.refreshToken) {
    updates.refreshToken = encryptToken(tokens.refreshToken);
  }

  await db
    .update(oauthAccounts)
    .set(updates)
    .where(eq(oauthAccounts.id, oauthAccountId));
}

// ============================================================================
// OAuth Account Management (AC-2.7)
// ============================================================================

/**
 * Get linked OAuth providers for user
 * AC-2.7: User profile shows linked OAuth providers
 */
export async function getLinkedProviders(
  userId: string
): Promise<Array<{ provider: string; linkedAt: Date }>> {
  const accounts = await db
    .select({
      provider: oauthAccounts.provider,
      linkedAt: oauthAccounts.createdAt,
    })
    .from(oauthAccounts)
    .where(eq(oauthAccounts.userId, userId));

  return accounts.map((a) => ({
    provider: a.provider,
    linkedAt: a.linkedAt,
  }));
}

/**
 * Unlink OAuth provider from user
 */
export async function unlinkProvider(
  userId: string,
  provider: string
): Promise<boolean> {
  // Check if user has password or other OAuth providers
  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  if (!user) return false;

  // Count OAuth providers
  const providers = await db
    .select({ provider: oauthAccounts.provider })
    .from(oauthAccounts)
    .where(eq(oauthAccounts.userId, userId));

  // Cannot unlink if it's the only auth method
  if (!user.passwordHash && providers.length <= 1) {
    return false;
  }

  // Delete the OAuth account
  await db
    .delete(oauthAccounts)
    .where(
      and(eq(oauthAccounts.userId, userId), eq(oauthAccounts.provider, provider))
    );

  return true;
}

/**
 * Check if user has OAuth provider linked
 */
export async function hasProviderLinked(
  userId: string,
  provider: string
): Promise<boolean> {
  const [account] = await db
    .select({ id: oauthAccounts.id })
    .from(oauthAccounts)
    .where(
      and(eq(oauthAccounts.userId, userId), eq(oauthAccounts.provider, provider))
    )
    .limit(1);

  return !!account;
}
