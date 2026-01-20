import { Elysia } from "elysia";
import { success, error, ErrorCodes } from "../lib/responses";
import { requireAuth } from "../middleware/auth";

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

    const { db, users } = await import("../db");
    const { eq } = await import("drizzle-orm");

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
  });
