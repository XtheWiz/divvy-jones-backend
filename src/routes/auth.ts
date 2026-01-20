import { Elysia, t } from "elysia";
import { db, users } from "../db";
import { success, error, ErrorCodes } from "../lib/responses";
import { jwtPlugin, generateAccessToken } from "../middleware/auth";
import {
  hashPassword,
  verifyPassword,
  validatePasswordStrength,
  generateRefreshToken,
  verifyRefreshToken,
  revokeRefreshToken,
  findUserByEmail,
  isValidEmail,
  normalizeEmail,
  isUserActive,
  type AccessTokenPayload,
} from "../services/auth.service";

// ============================================================================
// Request/Response Schemas
// ============================================================================

const registerSchema = {
  body: t.Object({
    email: t.String({ format: "email" }),
    password: t.String({ minLength: 8 }),
    displayName: t.String({ minLength: 1, maxLength: 100 }),
  }),
};

const loginSchema = {
  body: t.Object({
    email: t.String({ format: "email" }),
    password: t.String({ minLength: 1 }),
  }),
};

const refreshSchema = {
  body: t.Object({
    refreshToken: t.String({ minLength: 1 }),
  }),
};

// ============================================================================
// Auth Routes
// ============================================================================

export const authRoutes = new Elysia({ prefix: "/auth" })
  .use(jwtPlugin)

  // ========================================================================
  // POST /auth/register - User Registration
  // AC-1.1: User can register with email, password, and display name
  // AC-1.2: Email must be unique and validated (format check)
  // AC-1.3: Password must meet security requirements
  // AC-1.4: Registration returns JWT access token and refresh token
  // AC-1.5: Password is hashed using bcrypt before storage
  // AC-1.6: Duplicate email returns appropriate error message
  // ========================================================================
  .post(
    "/register",
    async ({ body, jwt, set }) => {
      const { email, password, displayName } = body;

      // AC-1.2: Validate email format
      if (!isValidEmail(email)) {
        set.status = 400;
        return error(ErrorCodes.VALIDATION_ERROR, "Invalid email format");
      }

      const normalizedEmail = normalizeEmail(email);

      // AC-1.3: Validate password strength
      const passwordValidation = validatePasswordStrength(password);
      if (!passwordValidation.valid) {
        set.status = 400;
        return error(
          ErrorCodes.VALIDATION_ERROR,
          "Password does not meet requirements",
          { requirements: passwordValidation.errors }
        );
      }

      // AC-1.6: Check for duplicate email
      const existingUser = await findUserByEmail(normalizedEmail);
      if (existingUser) {
        set.status = 409;
        return error(ErrorCodes.ALREADY_EXISTS, "Email is already registered");
      }

      // AC-1.5: Hash password using bcrypt
      const passwordHash = await hashPassword(password);

      // Create user
      const [newUser] = await db
        .insert(users)
        .values({
          email: normalizedEmail,
          displayName: displayName.trim(),
          passwordHash,
          primaryAuthProvider: "email",
        })
        .returning();

      // AC-1.4: Generate tokens
      const tokenPayload: AccessTokenPayload = {
        userId: newUser.id,
        email: newUser.email!,
      };

      const accessToken = await generateAccessToken(jwt, tokenPayload);
      const refreshToken = await generateRefreshToken(newUser.id);

      set.status = 201;
      return success({
        user: {
          id: newUser.id,
          email: newUser.email,
          displayName: newUser.displayName,
          createdAt: newUser.createdAt,
        },
        tokens: {
          accessToken,
          refreshToken,
          expiresIn: 900, // 15 minutes in seconds
        },
      });
    },
    registerSchema
  )

  // ========================================================================
  // POST /auth/login - User Login
  // AC-1.7: User can log in with email and password
  // AC-1.8: Successful login returns JWT access token and refresh token
  // AC-1.9: Invalid credentials return 401 with generic error message
  // AC-1.10: Locked/deleted accounts cannot log in
  // ========================================================================
  .post(
    "/login",
    async ({ body, jwt, set }) => {
      const { email, password } = body;

      const normalizedEmail = normalizeEmail(email);

      // Find user by email
      const user = await findUserByEmail(normalizedEmail);

      // AC-1.9: Generic error for invalid credentials (prevents email enumeration)
      if (!user) {
        set.status = 401;
        return error(
          ErrorCodes.INVALID_CREDENTIALS,
          "Invalid email or password"
        );
      }

      // AC-1.10: Check if user account is active
      if (!isUserActive(user)) {
        set.status = 401;
        return error(
          ErrorCodes.INVALID_CREDENTIALS,
          "Invalid email or password"
        );
      }

      // Check password (only for email auth users)
      if (!user.passwordHash) {
        set.status = 401;
        return error(
          ErrorCodes.INVALID_CREDENTIALS,
          "Invalid email or password"
        );
      }

      const isValidPassword = await verifyPassword(password, user.passwordHash);

      if (!isValidPassword) {
        set.status = 401;
        return error(
          ErrorCodes.INVALID_CREDENTIALS,
          "Invalid email or password"
        );
      }

      // AC-1.8: Generate tokens
      const tokenPayload: AccessTokenPayload = {
        userId: user.id,
        email: user.email!,
      };

      const accessToken = await generateAccessToken(jwt, tokenPayload);
      const refreshToken = await generateRefreshToken(user.id);

      return success({
        user: {
          id: user.id,
          email: user.email,
          displayName: user.displayName,
          createdAt: user.createdAt,
        },
        tokens: {
          accessToken,
          refreshToken,
          expiresIn: 900, // 15 minutes in seconds
        },
      });
    },
    loginSchema
  )

  // ========================================================================
  // POST /auth/refresh - Refresh Access Token
  // AC-1.11: Access token contains user ID and email in payload
  // AC-1.12: Refresh token can be used to obtain new access token
  // AC-1.13: Refresh tokens are single-use (rotated on refresh)
  // AC-1.14: Invalid/expired refresh tokens return 401
  // ========================================================================
  .post(
    "/refresh",
    async ({ body, jwt, set }) => {
      const { refreshToken: rawToken } = body;

      // AC-1.14: Verify refresh token
      const tokenResult = await verifyRefreshToken(rawToken);

      if (!tokenResult) {
        set.status = 401;
        return error(ErrorCodes.INVALID_TOKEN, "Invalid or expired refresh token");
      }

      const { userId, tokenId } = tokenResult;

      // Find user to get email for new access token
      const user = await db.query.users.findFirst({
        where: (users, { eq }) => eq(users.id, userId),
      });

      if (!user || !isUserActive(user)) {
        set.status = 401;
        return error(ErrorCodes.UNAUTHORIZED, "User account is not active");
      }

      // AC-1.13: Revoke the used refresh token (single-use)
      await revokeRefreshToken(tokenId);

      // Generate new tokens
      const tokenPayload: AccessTokenPayload = {
        userId: user.id,
        email: user.email!,
      };

      // AC-1.11: Access token contains user ID and email
      const accessToken = await generateAccessToken(jwt, tokenPayload);

      // AC-1.13: Issue new refresh token (rotation)
      const newRefreshToken = await generateRefreshToken(user.id);

      return success({
        tokens: {
          accessToken,
          refreshToken: newRefreshToken,
          expiresIn: 900, // 15 minutes in seconds
        },
      });
    },
    refreshSchema
  );
