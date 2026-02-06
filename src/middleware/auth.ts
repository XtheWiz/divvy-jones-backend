import { Elysia } from "elysia";
import { jwt } from "@elysiajs/jwt";
import { error, ErrorCodes } from "../lib/responses";
import { findUserById, isUserActive, type AccessTokenPayload } from "../services/auth.service";

// ============================================================================
// JWT Configuration
// ============================================================================

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  throw new Error(
    "JWT_SECRET environment variable is required. " +
    "Set a secure, random secret (minimum 32 characters recommended)."
  );
}
const JWT_ACCESS_EXPIRY = process.env.JWT_ACCESS_EXPIRY || "15m";

// ============================================================================
// JWT Plugin Setup
// ============================================================================

export const jwtPlugin = new Elysia({ name: "jwt" }).use(
  jwt({
    name: "jwt",
    secret: JWT_SECRET,
    exp: JWT_ACCESS_EXPIRY,
  })
);

// ============================================================================
// Auth Context Types
// ============================================================================

export interface AuthContext {
  userId: string;
  email: string;
}

// ============================================================================
// Auth Middleware
// ============================================================================

/**
 * Authentication middleware that validates JWT tokens
 * Use with .use(authMiddleware) on routes that require authentication
 */
export const authMiddleware = new Elysia({ name: "auth" })
  .use(jwtPlugin)
  .derive(async ({ jwt, request, set }) => {
    // Extract token from Authorization header
    const authHeader = request.headers.get("authorization");

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      set.status = 401;
      return {
        auth: null as AuthContext | null,
        authError: error(
          ErrorCodes.UNAUTHORIZED,
          "Missing or invalid authorization header"
        ),
      };
    }

    const token = authHeader.slice(7); // Remove "Bearer "

    // Verify JWT
    const payload = await jwt.verify(token);

    if (!payload) {
      set.status = 401;
      return {
        auth: null as AuthContext | null,
        authError: error(ErrorCodes.INVALID_TOKEN, "Invalid or expired token"),
      };
    }

    // Extract user info from payload
    const { userId, email } = payload as unknown as AccessTokenPayload;

    if (!userId || !email) {
      set.status = 401;
      return {
        auth: null as AuthContext | null,
        authError: error(ErrorCodes.INVALID_TOKEN, "Invalid token payload"),
      };
    }

    // Optionally verify user still exists and is active
    const user = await findUserById(userId);

    if (!user || !isUserActive(user)) {
      set.status = 401;
      return {
        auth: null as AuthContext | null,
        authError: error(ErrorCodes.UNAUTHORIZED, "User account is not active"),
      };
    }

    return {
      auth: { userId, email } as AuthContext,
      authError: null,
    };
  })
  .as("scoped");

/**
 * Guard that ensures authentication is valid
 * Use after authMiddleware to protect routes
 */
export const requireAuth = new Elysia({ name: "requireAuth" })
  .use(authMiddleware)
  .onBeforeHandle(({ auth, authError, set }) => {
    if (!auth) {
      set.status = 401;
      return authError;
    }
  })
  .as("scoped");

// ============================================================================
// JWT Token Generation
// ============================================================================

/**
 * Generate access token with user payload
 * This is a helper to be used in auth routes
 */
export async function generateAccessToken(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  jwt: { sign: (payload: any) => Promise<string> },
  payload: AccessTokenPayload
): Promise<string> {
  return jwt.sign({
    userId: payload.userId,
    email: payload.email,
  });
}
