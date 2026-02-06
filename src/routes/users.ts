import { Elysia, t } from "elysia";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { db, users } from "../db";
import { success, error, ErrorCodes } from "../lib/responses";
import { logger } from "../lib/logger";
import { requireAuth } from "../middleware/auth";
import { rateLimit } from "../middleware/rate-limit";
import { getClientIP, keyFromUserId } from "../services/rate-limiter.service";
import {
  getUserPreferences,
  updateUserPreferences,
} from "../services/preferences.service";
import { getLinkedProviders } from "../services/oauth.service";
import {
  hashPassword,
  validatePasswordStrength,
} from "../services/auth.service";
import {
  requestAccountDeletion,
  cancelAccountDeletion,
  hasPendingDeletion,
  exportUserData,
} from "../services/account-management.service";
import { sendEmail } from "../services/email";
import { accountDeletionTemplate } from "../services/email/templates";

// ============================================================================
// User Routes
// ============================================================================

export const userRoutes = new Elysia({ prefix: "/users" })
  .use(requireAuth)

  // ========================================================================
  // GET /users/me - Get Current User Profile
  // AC-1.15: Authenticated user can retrieve their profile
  // AC-1.16: Profile includes: id, email, displayName, createdAt
  // ========================================================================
  .get("/me", async ({ auth, authError, set }) => {
    // requireAuth guard ensures auth is set, but TypeScript needs help
    if (!auth) {
      set.status = 401;
      return authError;
    }

    // The auth middleware already verified the user exists
    // We could fetch fresh data if needed, but for /me we can use auth context
    // For now, we'll fetch from DB to ensure we have the latest data

    const [user] = await db
      .select({
        id: users.id,
        email: users.email,
        displayName: users.displayName,
        isEmailVerified: users.isEmailVerified,
        emailVerifiedAt: users.emailVerifiedAt,
        primaryAuthProvider: users.primaryAuthProvider,
        hasPassword: users.passwordHash,
        createdAt: users.createdAt,
      })
      .from(users)
      .where(eq(users.id, auth.userId))
      .limit(1);

    if (!user) {
      set.status = 404;
      return error(ErrorCodes.NOT_FOUND, "User not found");
    }

    // AC-2.7: Get linked OAuth providers
    const linkedProviders = await getLinkedProviders(auth.userId);

    // AC-1.16 & Sprint 010 AC-1.9, AC-2.7: Return profile with extended fields
    return success({
      id: user.id,
      email: user.email,
      displayName: user.displayName,
      emailVerified: user.isEmailVerified,
      emailVerifiedAt: user.emailVerifiedAt,
      primaryAuthProvider: user.primaryAuthProvider,
      hasPassword: !!user.hasPassword,
      linkedProviders,
      createdAt: user.createdAt,
    });
  }, {
    detail: {
      tags: ["Users"],
      summary: "Get current user profile",
      description: "Get the authenticated user's profile including email verification status, linked OAuth providers, and account details.",
    },
  })

  // ========================================================================
  // GET /users/me/preferences - Get User Preferences
  // Sprint 006 AC-1.5: GET /users/me/preferences returns current user preferences
  // Sprint 006 AC-1.8: Only authenticated users can access their own preferences
  // ========================================================================
  .get("/me/preferences", async ({ auth, authError, set }) => {
    if (!auth) {
      set.status = 401;
      return authError;
    }

    const preferences = await getUserPreferences(auth.userId);

    // Should not happen if AC-1.4 is implemented correctly
    if (!preferences) {
      set.status = 404;
      return error(ErrorCodes.NOT_FOUND, "Preferences not found");
    }

    return success(preferences);
  }, {
    detail: {
      tags: ["Users"],
      summary: "Get user preferences",
      description: "Get the authenticated user's notification and display preferences.",
    },
  })

  // ========================================================================
  // PUT /users/me/preferences - Update User Preferences
  // Sprint 006 AC-1.6: PUT /users/me/preferences updates user preferences
  // Sprint 006 AC-1.7: Preferences validation ensures valid boolean values
  // Sprint 006 AC-1.8: Only authenticated users can access their own preferences
  // ========================================================================
  .put(
    "/me/preferences",
    async ({ auth, authError, body, set }) => {
      if (!auth) {
        set.status = 401;
        return authError;
      }

      const updated = await updateUserPreferences(auth.userId, body);

      return success(updated);
    },
    {
      // AC-1.7: Preferences validation ensures valid boolean values
      body: t.Object({
        languageCode: t.Optional(t.String({ minLength: 2, maxLength: 10 })),
        defaultCurrencyCode: t.Optional(t.String({ minLength: 3, maxLength: 3 })),
        timezone: t.Optional(t.String({ maxLength: 50 })),
        pushEnabled: t.Optional(t.Boolean()),
        emailNotifications: t.Optional(t.Boolean()),
        notifyOnExpenseAdded: t.Optional(t.Boolean()),
        notifyOnSettlement: t.Optional(t.Boolean()),
        notifyOnGroupActivity: t.Optional(t.Boolean()),
      }),
      detail: {
        tags: ["Users"],
        summary: "Update user preferences",
        description: "Update the authenticated user's notification and display preferences.",
      },
    }
  )

  // ========================================================================
  // POST /users/me/password - Set or Change Password
  // Sprint 010 AC-2.6: OAuth users can optionally set a password for email login
  // ========================================================================
  .post(
    "/me/password",
    async ({ auth, authError, body, set }) => {
      if (!auth) {
        set.status = 401;
        return authError;
      }

      const { newPassword, currentPassword } = body;

      // Get current user to check if they have a password
      const [user] = await db
        .select({ passwordHash: users.passwordHash })
        .from(users)
        .where(eq(users.id, auth.userId))
        .limit(1);

      if (!user) {
        set.status = 404;
        return error(ErrorCodes.NOT_FOUND, "User not found");
      }

      // If user already has password, require current password
      if (user.passwordHash) {
        if (!currentPassword) {
          set.status = 400;
          return error(
            ErrorCodes.VALIDATION_ERROR,
            "Current password is required to change password"
          );
        }

        // Verify current password
        const isValid = await bcrypt.compare(currentPassword, user.passwordHash);
        if (!isValid) {
          set.status = 401;
          return error(ErrorCodes.INVALID_CREDENTIALS, "Current password is incorrect");
        }
      }

      // Validate new password strength
      const validation = validatePasswordStrength(newPassword);
      if (!validation.valid) {
        set.status = 400;
        return error(
          ErrorCodes.VALIDATION_ERROR,
          "Password does not meet requirements",
          { requirements: validation.errors }
        );
      }

      // Hash and save new password
      const passwordHash = await hashPassword(newPassword);

      await db
        .update(users)
        .set({
          passwordHash,
          updatedAt: new Date(),
        })
        .where(eq(users.id, auth.userId));

      return success({
        message: user.passwordHash
          ? "Password changed successfully"
          : "Password set successfully. You can now login with email and password.",
      });
    },
    {
      body: t.Object({
        newPassword: t.String({ minLength: 8 }),
        currentPassword: t.Optional(t.String()),
      }),
      detail: {
        tags: ["Users"],
        summary: "Set or change password",
        description: "Set a password for OAuth users or change existing password. Current password is required if user already has a password.",
      },
    }
  )

  // ========================================================================
  // DELETE /users/me - Request Account Deletion
  // Sprint 010 AC-3.1: DELETE /users/me initiates account deletion request
  // Sprint 010 AC-3.2: Account deletion has 7-day grace period
  // Sprint 010 AC-3.3: User receives confirmation email when deletion requested
  // ========================================================================
  .delete("/me", async ({ auth, authError, set }) => {
    if (!auth) {
      set.status = 401;
      return authError;
    }

    // Request account deletion
    const result = await requestAccountDeletion(auth.userId);

    if (!result.success) {
      set.status = 400;
      return error(ErrorCodes.VALIDATION_ERROR, result.error || "Failed to request deletion");
    }

    // Get user details for email
    const [user] = await db
      .select({
        email: users.email,
        displayName: users.displayName,
      })
      .from(users)
      .where(eq(users.id, auth.userId))
      .limit(1);

    // AC-3.3: Send confirmation email
    if (user?.email && result.deletionDate) {
      const frontendUrl = process.env.FRONTEND_URL || "http://localhost:5173";
      const cancelUrl = `${frontendUrl}/account/cancel-deletion`;

      const emailContent = accountDeletionTemplate({
        recipientName: user.displayName,
        deletionDate: result.deletionDate.toLocaleDateString("en-US", {
          weekday: "long",
          year: "numeric",
          month: "long",
          day: "numeric",
        }),
        cancelUrl,
      });

      await sendEmail({
        to: user.email,
        subject: emailContent.subject,
        html: emailContent.html,
        text: emailContent.text,
      }).catch((err) => {
        logger.error("Failed to send deletion confirmation email", { error: String(err), userId: auth.userId });
      });
    }

    return success({
      message: "Account deletion requested",
      deletionDate: result.deletionDate,
      gracePeriodDays: 7,
    });
  }, {
    detail: {
      tags: ["Users"],
      summary: "Request account deletion",
      description: "Initiate account deletion with a 7-day grace period. A confirmation email is sent. User can cancel during the grace period.",
    },
  })

  // ========================================================================
  // GET /users/me/deletion-status - Get Deletion Status
  // Sprint 010 AC-3.4: User can cancel deletion within 7-day grace period
  // ========================================================================
  .get("/me/deletion-status", async ({ auth, authError, set }) => {
    if (!auth) {
      set.status = 401;
      return authError;
    }

    const status = await hasPendingDeletion(auth.userId);

    return success({
      pending: status.pending,
      deletionDate: status.deletionDate,
      canCancel: status.canCancel,
    });
  }, {
    detail: {
      tags: ["Users"],
      summary: "Get deletion status",
      description: "Check if an account deletion is pending and whether it can still be cancelled.",
    },
  })

  // ========================================================================
  // POST /users/me/cancel-deletion - Cancel Account Deletion
  // Sprint 010 AC-3.4: User can cancel deletion within 7-day grace period
  // ========================================================================
  .post("/me/cancel-deletion", async ({ auth, authError, set }) => {
    if (!auth) {
      set.status = 401;
      return authError;
    }

    const result = await cancelAccountDeletion(auth.userId);

    if (!result.success) {
      set.status = 400;
      return error(ErrorCodes.VALIDATION_ERROR, result.error || "Failed to cancel deletion");
    }

    return success({
      message: "Account deletion cancelled",
    });
  }, {
    detail: {
      tags: ["Users"],
      summary: "Cancel account deletion",
      description: "Cancel a pending account deletion during the 7-day grace period.",
    },
  })

  // ========================================================================
  // GET /users/me/data-export - Export User Data
  // Sprint 010 AC-3.7: Data export returns all user data as JSON
  // Sprint 010 AC-3.8: Data export includes: profile, groups, expenses, settlements, activity
  // Rate limited: 3 requests per hour per user to prevent abuse
  // ========================================================================
  .use(rateLimit({
    config: { maxRequests: 3, windowMs: 60 * 60 * 1000, prefix: "data-export" },
    keyGenerator: (ctx) => {
      const auth = (ctx as { auth?: { userId: string } }).auth;
      return auth?.userId ? keyFromUserId(auth.userId) : getClientIP(ctx.request);
    },
    errorMessage: "Too many data export requests. Please try again later.",
  }))
  .get("/me/data-export", async ({ auth, authError, set }) => {
    if (!auth) {
      set.status = 401;
      return authError;
    }

    const data = await exportUserData(auth.userId);

    if (!data) {
      set.status = 404;
      return error(ErrorCodes.NOT_FOUND, "User not found");
    }

    // AC-3.7 & AC-3.8: Return complete user data
    return success(data);
  }, {
    detail: {
      tags: ["Users"],
      summary: "Export user data",
      description: "Export all user data in JSON format (GDPR compliance). Includes profile, groups, expenses, settlements, and activity logs.",
    },
  });
