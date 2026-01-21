/**
 * Password Reset Service
 * Sprint 009 - TASK-014
 *
 * Service for password reset functionality.
 * AC-4.2: Reset token generated with 1-hour expiry
 * AC-4.3: Reset token stored securely (hashed in database)
 * AC-4.5: Password reset invalidates all existing sessions for user
 * AC-4.6: Reset token is single-use (invalidated after use)
 */

import { eq, and, isNull, gt } from "drizzle-orm";
import { db, users, refreshTokens } from "../db";
import { passwordResetTokens } from "../db/schema/users";
import { hashPassword, findUserByEmail } from "./auth.service";
import bcrypt from "bcryptjs";
import { nanoid } from "nanoid";

// ============================================================================
// Configuration
// ============================================================================

/** Token expiry time in milliseconds (1 hour - AC-4.2) */
const TOKEN_EXPIRY_MS = 60 * 60 * 1000;

/** Length of the raw token (before hashing) */
const TOKEN_LENGTH = 32;

/** Bcrypt salt rounds for token hashing */
const HASH_ROUNDS = 10;

// ============================================================================
// Types
// ============================================================================

export interface GenerateTokenResult {
  /** The raw token to send in the email (NOT stored in DB) */
  token: string;
  /** Token expiry timestamp */
  expiresAt: Date;
}

export interface VerifyTokenResult {
  /** Whether the token is valid */
  valid: boolean;
  /** User ID if valid */
  userId?: string;
  /** Token ID for invalidation */
  tokenId?: string;
  /** Error message if invalid */
  error?: string;
}

export interface ResetPasswordResult {
  success: boolean;
  error?: string;
}

// ============================================================================
// Token Generation (AC-4.2, AC-4.3)
// ============================================================================

/**
 * Generate a password reset token for a user
 *
 * AC-4.2: Token expires in 1 hour
 * AC-4.3: Token is hashed before storing in database
 *
 * @param email - User's email address
 * @returns Token result or null if user not found
 */
export async function generateResetToken(
  email: string
): Promise<GenerateTokenResult | null> {
  // Find user by email
  const user = await findUserByEmail(email.toLowerCase().trim());
  if (!user) {
    // Return null silently - don't reveal if email exists
    return null;
  }

  // Generate random token
  const rawToken = nanoid(TOKEN_LENGTH);

  // AC-4.3: Hash token before storing (like a password)
  const tokenHash = await bcrypt.hash(rawToken, HASH_ROUNDS);

  // AC-4.2: Set expiry to 1 hour from now
  const expiresAt = new Date(Date.now() + TOKEN_EXPIRY_MS);

  // Invalidate any existing reset tokens for this user (optional security measure)
  await db
    .update(passwordResetTokens)
    .set({ usedAt: new Date() })
    .where(
      and(
        eq(passwordResetTokens.userId, user.id),
        isNull(passwordResetTokens.usedAt)
      )
    );

  // Store hashed token in database
  await db.insert(passwordResetTokens).values({
    userId: user.id,
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
 * Verify a password reset token
 *
 * Checks:
 * - Token exists and matches hash
 * - Token is not expired
 * - Token has not been used (AC-4.6)
 *
 * @param email - User's email address
 * @param token - Raw token from the reset link
 * @returns Verification result
 */
export async function verifyResetToken(
  email: string,
  token: string
): Promise<VerifyTokenResult> {
  // Find user by email
  const user = await findUserByEmail(email.toLowerCase().trim());
  if (!user) {
    return { valid: false, error: "Invalid or expired reset token" };
  }

  // Find valid (unused, non-expired) tokens for this user
  const tokens = await db
    .select()
    .from(passwordResetTokens)
    .where(
      and(
        eq(passwordResetTokens.userId, user.id),
        isNull(passwordResetTokens.usedAt),
        gt(passwordResetTokens.expiresAt, new Date())
      )
    )
    .orderBy(passwordResetTokens.createdAt);

  if (tokens.length === 0) {
    return { valid: false, error: "Invalid or expired reset token" };
  }

  // Check if token matches any of the valid tokens
  for (const tokenRecord of tokens) {
    const isMatch = await bcrypt.compare(token, tokenRecord.tokenHash);
    if (isMatch) {
      return {
        valid: true,
        userId: user.id,
        tokenId: tokenRecord.id,
      };
    }
  }

  return { valid: false, error: "Invalid or expired reset token" };
}

// ============================================================================
// Password Reset (AC-4.5, AC-4.6)
// ============================================================================

/**
 * Reset a user's password
 *
 * AC-4.5: Invalidates all existing sessions (refresh tokens) for the user
 * AC-4.6: Marks the reset token as used (single-use)
 *
 * @param email - User's email address
 * @param token - Raw token from the reset link
 * @param newPassword - New password to set
 * @returns Reset result
 */
export async function resetPassword(
  email: string,
  token: string,
  newPassword: string
): Promise<ResetPasswordResult> {
  // Verify the token first
  const verification = await verifyResetToken(email, token);
  if (!verification.valid || !verification.userId || !verification.tokenId) {
    return { success: false, error: verification.error };
  }

  const { userId, tokenId } = verification;

  // Hash the new password
  const newPasswordHash = await hashPassword(newPassword);

  // Perform the reset in a transaction
  await db.transaction(async (tx) => {
    // Update the user's password
    await tx
      .update(users)
      .set({
        passwordHash: newPasswordHash,
        updatedAt: new Date(),
      })
      .where(eq(users.id, userId));

    // AC-4.6: Mark the reset token as used (single-use)
    await tx
      .update(passwordResetTokens)
      .set({ usedAt: new Date() })
      .where(eq(passwordResetTokens.id, tokenId));

    // AC-4.5: Invalidate all existing refresh tokens for the user
    // This forces re-login on all devices
    await tx
      .update(refreshTokens)
      .set({ revokedAt: new Date() })
      .where(
        and(
          eq(refreshTokens.userId, userId),
          isNull(refreshTokens.revokedAt)
        )
      );
  });

  return { success: true };
}

// ============================================================================
// Cleanup Functions
// ============================================================================

/**
 * Clean up expired reset tokens
 * Can be run periodically to remove old records
 */
export async function cleanupExpiredTokens(): Promise<number> {
  const result = await db
    .delete(passwordResetTokens)
    .where(
      gt(passwordResetTokens.expiresAt, new Date(Date.now() - 24 * 60 * 60 * 1000))
    )
    .returning();

  return result.length;
}

/**
 * Check if a user has a pending (valid) reset token
 * Useful for preventing multiple reset emails in quick succession
 */
export async function hasPendingResetToken(email: string): Promise<boolean> {
  const user = await findUserByEmail(email.toLowerCase().trim());
  if (!user) return false;

  const [token] = await db
    .select({ id: passwordResetTokens.id })
    .from(passwordResetTokens)
    .where(
      and(
        eq(passwordResetTokens.userId, user.id),
        isNull(passwordResetTokens.usedAt),
        gt(passwordResetTokens.expiresAt, new Date())
      )
    )
    .limit(1);

  return !!token;
}
