import { Elysia, t } from "elysia";
import { eq } from "drizzle-orm";
import { db, users } from "../db";
import { success, error, ErrorCodes } from "../lib/responses";
import { requireAuth } from "../middleware/auth";
import {
  getUserPreferences,
  updateUserPreferences,
} from "../services/preferences.service";

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
        createdAt: users.createdAt,
      })
      .from(users)
      .where(eq(users.id, auth.userId))
      .limit(1);

    if (!user) {
      set.status = 404;
      return error(ErrorCodes.NOT_FOUND, "User not found");
    }

    // AC-1.16: Return profile with specified fields
    return success({
      id: user.id,
      email: user.email,
      displayName: user.displayName,
      createdAt: user.createdAt,
    });
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
    }
  );
