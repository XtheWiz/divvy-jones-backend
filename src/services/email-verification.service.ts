/**
 * Email Verification Service
 * Sprint 010 - TASK-011
 *
 * Service for email verification functionality.
 * AC-1.2: Registration sends verification email with unique token
 * AC-1.4: Verification token expires after 24 hours
 * AC-1.5: Verification token is single-use (invalidated after verification)
 */

import { eq, and, isNull, gt, lt } from "drizzle-orm";
import { db, users } from "../db";
import { emailVerificationTokens } from "../db/schema/users";
import { findUserById } from "./auth.service";
import bcrypt from "bcryptjs";
import { nanoid } from "nanoid";

// ============================================================================
// Configuration
// ============================================================================

/** Token expiry time in milliseconds (24 hours - AC-1.4) */
const TOKEN_EXPIRY_MS = 24 * 60 * 60 * 1000;

/** Environment variable override for expiry */
const TOKEN_EXPIRY_HOURS = parseInt(
  process.env.EMAIL_VERIFICATION_EXPIRY_HOURS || "24",
  10
);

/** Effective expiry in milliseconds */
const EFFECTIVE_TOKEN_EXPIRY_MS = TOKEN_EXPIRY_HOURS * 60 * 60 * 1000;

/** Length of the raw token (before hashing) */
const TOKEN_LENGTH = 32;

/** Bcrypt salt rounds for token hashing */
const HASH_ROUNDS = 10;

// ============================================================================
// Types
// ============================================================================

export interface GenerateVerificationTokenResult {
  /** The raw token to send in the email (NOT stored in DB) */
  token: string;
  /** Token expiry timestamp */
  expiresAt: Date;
}

export interface VerifyEmailTokenResult {
  /** Whether the token is valid */
  valid: boolean;
  /** User ID if valid */
  userId?: string;
  /** Token ID for invalidation */
  tokenId?: string;
  /** Error message if invalid */
  error?: string;
}

export interface MarkEmailVerifiedResult {
  success: boolean;
  error?: string;
}

// ============================================================================
// Token Generation (AC-1.2, AC-1.4)
// ============================================================================

/**
 * Generate an email verification token for a user
 *
 * AC-1.4: Token expires in 24 hours
 * Token is hashed before storing in database
 *
 * @param userId - User's ID
 * @returns Token result or null if user not found
 */
export async function generateVerificationToken(
  userId: string
): Promise<GenerateVerificationTokenResult | null> {
  // Find user
  const user = await findUserById(userId);
  if (!user) {
    return null;
  }

  // If already verified, no need to generate token
  if (user.isEmailVerified) {
    return null;
  }

  // Generate random token
  const rawToken = nanoid(TOKEN_LENGTH);

  // Hash token before storing (like a password)
  const tokenHash = await bcrypt.hash(rawToken, HASH_ROUNDS);

  // AC-1.4: Set expiry to 24 hours from now
  const expiresAt = new Date(Date.now() + EFFECTIVE_TOKEN_EXPIRY_MS);

  // Invalidate any existing verification tokens for this user
  await db
    .update(emailVerificationTokens)
    .set({ verifiedAt: new Date() })
    .where(
      and(
        eq(emailVerificationTokens.userId, userId),
        isNull(emailVerificationTokens.verifiedAt)
      )
    );

  // Store hashed token in database
  await db.insert(emailVerificationTokens).values({
    userId,
    tokenHash,
    expiresAt,
  });

  // Return raw token (to be sent in email) and expiry
  return {
    token: rawToken,
    expiresAt,
  };
}

// ============================================================================
// Token Verification
// ============================================================================

/**
 * Verify an email verification token
 *
 * Checks:
 * - Token exists and matches hash
 * - Token is not expired
 * - Token has not been used (AC-1.5)
 *
 * @param token - Raw token from the verification link
 * @returns Verification result
 */
export async function verifyEmailToken(
  token: string
): Promise<VerifyEmailTokenResult> {
  // Find all valid (unused, non-expired) tokens
  const tokens = await db
    .select()
    .from(emailVerificationTokens)
    .where(
      and(
        isNull(emailVerificationTokens.verifiedAt),
        gt(emailVerificationTokens.expiresAt, new Date())
      )
    );

  if (tokens.length === 0) {
    return { valid: false, error: "Invalid or expired verification token" };
  }

  // Check if token matches any of the valid tokens
  for (const tokenRecord of tokens) {
    const isMatch = await bcrypt.compare(token, tokenRecord.tokenHash);
    if (isMatch) {
      return {
        valid: true,
        userId: tokenRecord.userId,
        tokenId: tokenRecord.id,
      };
    }
  }

  return { valid: false, error: "Invalid or expired verification token" };
}

// ============================================================================
// Email Verification (AC-1.3, AC-1.5)
// ============================================================================

/**
 * Mark a user's email as verified
 *
 * AC-1.3: Updates user record with verified status
 * AC-1.5: Marks the verification token as used (single-use)
 *
 * @param token - Raw token from the verification link
 * @returns Verification result
 */
export async function markEmailVerified(
  token: string
): Promise<MarkEmailVerifiedResult> {
  // Verify the token first
  const verification = await verifyEmailToken(token);
  if (!verification.valid || !verification.userId || !verification.tokenId) {
    return { success: false, error: verification.error };
  }

  const { userId, tokenId } = verification;

  // Perform the verification in a transaction
  await db.transaction(async (tx) => {
    // Update the user's email verification status
    await tx
      .update(users)
      .set({
        isEmailVerified: true,
        emailVerifiedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(users.id, userId));

    // AC-1.5: Mark the verification token as used (single-use)
    await tx
      .update(emailVerificationTokens)
      .set({ verifiedAt: new Date() })
      .where(eq(emailVerificationTokens.id, tokenId));
  });

  return { success: true };
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Check if a user's email is verified
 *
 * @param userId - User's ID
 * @returns Whether the email is verified
 */
export async function isEmailVerified(userId: string): Promise<boolean> {
  const user = await findUserById(userId);
  return user?.isEmailVerified ?? false;
}

/**
 * Check if a user has a pending (valid) verification token
 * Useful for rate limiting resend requests
 *
 * @param userId - User's ID
 * @returns Whether a pending token exists
 */
export async function hasPendingVerificationToken(
  userId: string
): Promise<boolean> {
  const [token] = await db
    .select({ id: emailVerificationTokens.id })
    .from(emailVerificationTokens)
    .where(
      and(
        eq(emailVerificationTokens.userId, userId),
        isNull(emailVerificationTokens.verifiedAt),
        gt(emailVerificationTokens.expiresAt, new Date())
      )
    )
    .limit(1);

  return !!token;
}

/**
 * Clean up expired verification tokens
 * Can be run periodically to remove old records
 */
export async function cleanupExpiredVerificationTokens(): Promise<number> {
  const cutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000); // 7 days ago

  const result = await db
    .delete(emailVerificationTokens)
    .where(
      and(
        lt(emailVerificationTokens.expiresAt, cutoff), // Expired more than 7 days ago
        isNull(emailVerificationTokens.verifiedAt) // Never verified (orphaned)
      )
    )
    .returning();

  return result.length;
}

/**
 * Get user's verification status
 *
 * @param userId - User's ID
 * @returns Verification status details
 */
export async function getVerificationStatus(userId: string): Promise<{
  isVerified: boolean;
  verifiedAt: Date | null;
  hasPendingToken: boolean;
}> {
  const user = await findUserById(userId);

  if (!user) {
    return {
      isVerified: false,
      verifiedAt: null,
      hasPendingToken: false,
    };
  }

  const hasPending = await hasPendingVerificationToken(userId);

  return {
    isVerified: user.isEmailVerified,
    verifiedAt: user.emailVerifiedAt,
    hasPendingToken: hasPending,
  };
}
