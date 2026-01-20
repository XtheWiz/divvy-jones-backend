import bcrypt from "bcryptjs";
import { createHash } from "crypto";
import { nanoid } from "nanoid";
import { eq, and, isNull, gt } from "drizzle-orm";
import { db, users, refreshTokens, type User } from "../db";

// ============================================================================
// Configuration
// ============================================================================

const BCRYPT_ROUNDS = 12;
const REFRESH_TOKEN_LENGTH = 64;
const REFRESH_TOKEN_EXPIRY_DAYS = 30;

// Password requirements
const PASSWORD_MIN_LENGTH = 8;
const PASSWORD_REGEX = {
  hasUpperCase: /[A-Z]/,
  hasLowerCase: /[a-z]/,
  hasNumber: /[0-9]/,
};

// ============================================================================
// Password Functions
// ============================================================================

/**
 * Hash a password using bcrypt
 */
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, BCRYPT_ROUNDS);
}

/**
 * Verify a password against a hash
 */
export async function verifyPassword(
  password: string,
  hash: string
): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

/**
 * Validate password strength
 * Requirements: min 8 chars, uppercase, lowercase, number
 */
export function validatePasswordStrength(password: string): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  if (password.length < PASSWORD_MIN_LENGTH) {
    errors.push(`Password must be at least ${PASSWORD_MIN_LENGTH} characters`);
  }

  if (!PASSWORD_REGEX.hasUpperCase.test(password)) {
    errors.push("Password must contain at least one uppercase letter");
  }

  if (!PASSWORD_REGEX.hasLowerCase.test(password)) {
    errors.push("Password must contain at least one lowercase letter");
  }

  if (!PASSWORD_REGEX.hasNumber.test(password)) {
    errors.push("Password must contain at least one number");
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

// ============================================================================
// Token Functions
// ============================================================================

export interface AccessTokenPayload {
  userId: string;
  email: string;
}

/**
 * Hash a token using SHA-256 for deterministic lookup
 * (refresh tokens are already high-entropy, so fast hashing is fine)
 */
function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/**
 * Generate an opaque refresh token and store it hashed in DB
 * Returns the raw token (to send to client) - only chance to see it!
 */
export async function generateRefreshToken(userId: string): Promise<string> {
  const rawToken = nanoid(REFRESH_TOKEN_LENGTH);
  const tokenHash = hashToken(rawToken);

  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + REFRESH_TOKEN_EXPIRY_DAYS);

  await db.insert(refreshTokens).values({
    userId,
    tokenHash,
    expiresAt,
  });

  return rawToken;
}

/**
 * Verify a refresh token and return the associated user ID
 * Returns null if token is invalid, expired, or revoked
 */
export async function verifyRefreshToken(
  rawToken: string
): Promise<{ userId: string; tokenId: string } | null> {
  const tokenHash = hashToken(rawToken);

  const [token] = await db
    .select()
    .from(refreshTokens)
    .where(
      and(
        eq(refreshTokens.tokenHash, tokenHash),
        isNull(refreshTokens.revokedAt),
        gt(refreshTokens.expiresAt, new Date())
      )
    )
    .limit(1);

  if (!token) {
    return null;
  }

  return { userId: token.userId, tokenId: token.id };
}

/**
 * Revoke a refresh token by ID
 */
export async function revokeRefreshToken(tokenId: string): Promise<void> {
  await db
    .update(refreshTokens)
    .set({ revokedAt: new Date() })
    .where(eq(refreshTokens.id, tokenId));
}

/**
 * Revoke all refresh tokens for a user
 */
export async function revokeAllUserRefreshTokens(userId: string): Promise<void> {
  await db
    .update(refreshTokens)
    .set({ revokedAt: new Date() })
    .where(
      and(eq(refreshTokens.userId, userId), isNull(refreshTokens.revokedAt))
    );
}

// ============================================================================
// User Functions
// ============================================================================

/**
 * Find user by email (case-insensitive)
 */
export async function findUserByEmail(email: string): Promise<User | null> {
  const normalizedEmail = email.toLowerCase().trim();

  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.email, normalizedEmail))
    .limit(1);

  return user || null;
}

/**
 * Find user by ID
 */
export async function findUserById(userId: string): Promise<User | null> {
  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  return user || null;
}

/**
 * Check if user is active (not deleted)
 */
export function isUserActive(user: User): boolean {
  return user.deletedAt === null;
}

// ============================================================================
// Email Validation
// ============================================================================

/**
 * Validate email format
 */
export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Normalize email (lowercase, trim)
 */
export function normalizeEmail(email: string): string {
  return email.toLowerCase().trim();
}
