import { Elysia, t } from "elysia";
import { rateLimit } from "elysia-rate-limit";
import { db, users, userSettings } from "../db";
import { success, error, ErrorCodes } from "../lib/responses";
import { logger } from "../lib/logger";
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
import {
  generateResetToken,
  resetPassword as resetPasswordService,
} from "../services/password-reset.service";
import {
  generateVerificationToken,
  markEmailVerified,
} from "../services/email-verification.service";
import {
  isGoogleOAuthConfigured,
  generateOAuthState,
  verifyOAuthState,
  getGoogleAuthUrl,
  exchangeGoogleCode,
  getGoogleUserInfo,
  findOrCreateGoogleUser,
} from "../services/oauth.service";
import { sendEmail } from "../services/email";
import {
  passwordResetTemplate,
  emailVerificationTemplate,
  resendVerificationTemplate,
} from "../services/email/templates";

// ============================================================================
// Request/Response Schemas
// ============================================================================

const registerSchema = {
  body: t.Object({
    email: t.String({ format: "email" }),
    password: t.String({ minLength: 8 }),
    displayName: t.String({ minLength: 1, maxLength: 100 }),
  }),
  detail: {
    tags: ["Auth"],
    summary: "Register a new user",
    description: "Create a new user account with email, password, and display name. A verification email will be sent to confirm the email address.",
    security: [],
  },
};

const loginSchema = {
  body: t.Object({
    email: t.String({ format: "email" }),
    password: t.String({ minLength: 1 }),
  }),
  detail: {
    tags: ["Auth"],
    summary: "Login with email and password",
    description: "Authenticate with email and password to receive access and refresh tokens.",
    security: [],
  },
};

const refreshSchema = {
  body: t.Object({
    refreshToken: t.String({ minLength: 1 }),
  }),
  detail: {
    tags: ["Auth"],
    summary: "Refresh access token",
    description: "Exchange a valid refresh token for new access and refresh tokens. Refresh tokens are single-use and rotated on each use.",
    security: [],
  },
};

// Sprint 009 - Password Reset Schemas
const forgotPasswordSchema = {
  body: t.Object({
    email: t.String({ format: "email" }),
  }),
  detail: {
    tags: ["Auth"],
    summary: "Request password reset",
    description: "Send a password reset email to the specified address. Always returns success to prevent email enumeration.",
    security: [],
  },
};

const resetPasswordSchema = {
  body: t.Object({
    email: t.String({ format: "email" }),
    token: t.String({ minLength: 1 }),
    newPassword: t.String({ minLength: 8 }),
  }),
  detail: {
    tags: ["Auth"],
    summary: "Reset password with token",
    description: "Complete password reset using the token from the reset email. Token is single-use and expires after 1 hour.",
    security: [],
  },
};

// Sprint 010 - Email Verification Schemas
const verifyEmailSchema = {
  query: t.Object({
    token: t.String({ minLength: 1 }),
  }),
  detail: {
    tags: ["Auth"],
    summary: "Verify email address",
    description: "Verify email address using the token from the verification email. Token expires after 24 hours.",
    security: [],
  },
};

const resendVerificationSchema = {
  body: t.Object({
    email: t.String({ format: "email" }),
  }),
  detail: {
    tags: ["Auth"],
    summary: "Resend verification email",
    description: "Send a new verification email. Always returns success to prevent email enumeration.",
    security: [],
  },
};

// ============================================================================
// Auth Routes
// ============================================================================

// Disable or relax rate limiting in test environment
const isTestEnvironment = !!process.env.DATABASE_URL_TEST;

export const authRoutes = new Elysia({ prefix: "/auth" })
  // AC-0.4: Rate limiting - 5 requests per minute per IP
  // AC-0.5: Returns 429 Too Many Requests when exceeded
  .use(
    rateLimit({
      duration: 60000, // 1 minute window
      max: isTestEnvironment ? 1000 : 5, // Relaxed in tests, strict in production
      generator: (req) => {
        // Only trust proxy headers when TRUST_PROXY=true to prevent spoofing
        const trustProxy = process.env.TRUST_PROXY === "true";
        if (trustProxy) {
          const forwarded = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
          if (forwarded) return forwarded;
          const realIp = req.headers.get("x-real-ip");
          if (realIp) return realIp;
        }
        return "127.0.0.1";
      },
      errorResponse: new Response(JSON.stringify({
        success: false,
        error: {
          code: "RATE_LIMIT_EXCEEDED",
          message: "Too many requests. Please try again later.",
        },
      }), { status: 429, headers: { "Content-Type": "application/json" } }),
      headers: true, // Include rate limit headers in response
    })
  )
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

      // Sprint 006 AC-1.4: Create default user preferences
      await db.insert(userSettings).values({
        userId: newUser.id,
        // All defaults are set in schema, but explicit for clarity
        pushEnabled: true,
        emailNotifications: true,
        notifyOnExpenseAdded: true,
        notifyOnSettlement: true,
        notifyOnGroupActivity: true,
      });

      // AC-1.4: Generate tokens
      const tokenPayload: AccessTokenPayload = {
        userId: newUser.id,
        email: newUser.email!,
      };

      const accessToken = await generateAccessToken(jwt, tokenPayload);
      const refreshToken = await generateRefreshToken(newUser.id);

      // Sprint 010 - AC-1.2: Send verification email
      setImmediate(async () => {
        try {
          const verificationResult = await generateVerificationToken(newUser.id);
          if (verificationResult) {
            const baseUrl = process.env.APP_URL || "http://localhost:3000";
            const verificationUrl = `${baseUrl}/auth/verify-email?token=${verificationResult.token}`;

            const emailContent = emailVerificationTemplate({
              recipientName: newUser.displayName,
              verificationUrl,
              expiryTime: "24 hours",
            });

            await sendEmail({
              to: normalizedEmail,
              subject: emailContent.subject,
              html: emailContent.html,
              text: emailContent.text,
            });
          }
        } catch (err) {
          logger.error("Failed to send verification email", { error: String(err) });
        }
      });

      set.status = 201;
      return success({
        user: {
          id: newUser.id,
          email: newUser.email,
          displayName: newUser.displayName,
          emailVerified: newUser.isEmailVerified,
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
  )

  // ========================================================================
  // POST /auth/forgot-password - Request Password Reset
  // Sprint 009 - AC-4.1: Accepts email and sends reset link
  // AC-4.8: Rate limiting (3/hour per email) - handled by global rate limit
  // ========================================================================
  .post(
    "/forgot-password",
    async ({ body, set }) => {
      const { email } = body;

      // Generate reset token (returns null if user not found)
      // We don't reveal if email exists to prevent enumeration
      const result = await generateResetToken(email);

      // Always return success to prevent email enumeration
      if (result) {
        // Find user to get display name
        const user = await findUserByEmail(email.toLowerCase().trim());
        const displayName = user?.displayName || "User";

        // Build reset URL
        // In production, this should come from environment variable
        const baseUrl = process.env.APP_URL || "http://localhost:3000";
        const resetUrl = `${baseUrl}/reset-password?email=${encodeURIComponent(email)}&token=${result.token}`;

        // AC-4.7: Generate email from template
        const emailContent = passwordResetTemplate({
          recipientName: displayName,
          resetUrl,
          expiryTime: "1 hour",
        });

        // Send email asynchronously (don't block response)
        setImmediate(async () => {
          try {
            await sendEmail({
              to: email,
              subject: emailContent.subject,
              html: emailContent.html,
              text: emailContent.text,
            });
          } catch (err) {
            logger.error("Failed to send password reset email", { error: String(err) });
          }
        });
      }

      // Always return success message
      return success({
        message: "If an account exists with that email, you will receive a password reset link shortly.",
      });
    },
    forgotPasswordSchema
  )

  // ========================================================================
  // POST /auth/reset-password - Complete Password Reset
  // Sprint 009 - AC-4.4: Accepts token and new password
  // AC-4.5: Invalidates all existing sessions for user
  // AC-4.6: Reset token is single-use
  // ========================================================================
  .post(
    "/reset-password",
    async ({ body, set }) => {
      const { email, token, newPassword } = body;

      // Validate password strength
      const passwordValidation = validatePasswordStrength(newPassword);
      if (!passwordValidation.valid) {
        set.status = 400;
        return error(
          ErrorCodes.VALIDATION_ERROR,
          "Password does not meet requirements",
          { requirements: passwordValidation.errors }
        );
      }

      // Reset the password (verifies token, updates password, invalidates sessions)
      const result = await resetPasswordService(email, token, newPassword);

      if (!result.success) {
        set.status = 400;
        return error(ErrorCodes.INVALID_TOKEN, result.error || "Invalid or expired reset token");
      }

      return success({
        message: "Password has been reset successfully. Please log in with your new password.",
      });
    },
    resetPasswordSchema
  )

  // ========================================================================
  // GET /auth/verify-email - Verify Email Address
  // Sprint 010 - AC-1.3: Verifies email and updates user record
  // AC-1.4: Token expires after 24 hours
  // AC-1.5: Token is single-use
  // ========================================================================
  .get(
    "/verify-email",
    async ({ query, set }) => {
      const { token } = query;

      // Verify and mark email as verified
      const result = await markEmailVerified(token);

      if (!result.success) {
        set.status = 400;
        return error(ErrorCodes.INVALID_TOKEN, result.error || "Invalid or expired verification token");
      }

      return success({
        message: "Email has been verified successfully. You can now use all features.",
      });
    },
    verifyEmailSchema
  )

  // ========================================================================
  // POST /auth/resend-verification - Resend Verification Email
  // Sprint 010 - AC-1.6: Sends new verification email
  // AC-1.7: Rate limited to 3 per hour per email (handled by global limiter)
  // ========================================================================
  .post(
    "/resend-verification",
    async ({ body, set }) => {
      const { email } = body;

      const normalizedEmail = normalizeEmail(email);

      // Find user by email
      const user = await findUserByEmail(normalizedEmail);

      // Always return success to prevent email enumeration
      if (user && !user.isEmailVerified && isUserActive(user)) {
        // Generate new verification token (invalidates old ones)
        const verificationResult = await generateVerificationToken(user.id);

        if (verificationResult) {
          const baseUrl = process.env.APP_URL || "http://localhost:3000";
          const verificationUrl = `${baseUrl}/auth/verify-email?token=${verificationResult.token}`;

          const emailContent = resendVerificationTemplate({
            recipientName: user.displayName,
            verificationUrl,
            expiryTime: "24 hours",
          });

          // Send email asynchronously
          setImmediate(async () => {
            try {
              await sendEmail({
                to: normalizedEmail,
                subject: emailContent.subject,
                html: emailContent.html,
                text: emailContent.text,
              });
            } catch (err) {
              logger.error("Failed to send verification email", { error: String(err) });
            }
          });
        }
      }

      // Always return success to prevent email enumeration
      return success({
        message: "If an account exists with that email and is not yet verified, a new verification link has been sent.",
      });
    },
    resendVerificationSchema
  )

  // ========================================================================
  // GET /auth/google - Google OAuth Redirect
  // Sprint 010 - AC-2.2: Redirects to Google OAuth consent screen
  // ========================================================================
  .get("/google", async ({ set, redirect }) => {
    // Check if OAuth is configured
    if (!isGoogleOAuthConfigured()) {
      set.status = 503;
      return error(
        ErrorCodes.INTERNAL_ERROR,
        "Google OAuth is not configured. Please set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET."
      );
    }

    // Generate state for CSRF protection
    const state = generateOAuthState();

    // Redirect to Google
    const authUrl = getGoogleAuthUrl(state);
    set.redirect = authUrl;
    return redirect(authUrl);
  }, {
    detail: {
      tags: ["Auth"],
      summary: "Initiate Google OAuth login",
      description: "Redirects to Google OAuth consent screen. After authorization, Google redirects back to the callback URL.",
      security: [],
    },
  })

  // ========================================================================
  // GET /auth/google/callback - Google OAuth Callback
  // Sprint 010 - AC-2.3: Handles OAuth callback and creates/links account
  // ========================================================================
  .get(
    "/google/callback",
    async ({ query, jwt, set }) => {
      const { code, state: stateParam, error: oauthError } = query;

      // Handle OAuth errors
      if (oauthError) {
        set.status = 400;
        return error(
          ErrorCodes.INVALID_INPUT,
          `OAuth error: ${oauthError}`
        );
      }

      // Verify state (CSRF protection)
      if (!stateParam || !verifyOAuthState(stateParam)) {
        set.status = 400;
        return error(ErrorCodes.INVALID_TOKEN, "Invalid or expired OAuth state");
      }

      // Exchange code for tokens
      if (!code) {
        set.status = 400;
        return error(ErrorCodes.INVALID_INPUT, "Missing authorization code");
      }

      const tokens = await exchangeGoogleCode(code);
      if (!tokens) {
        set.status = 400;
        return error(ErrorCodes.INVALID_TOKEN, "Failed to exchange authorization code");
      }

      // Get user info from Google
      const googleUser = await getGoogleUserInfo(tokens.accessToken);
      if (!googleUser) {
        set.status = 400;
        return error(ErrorCodes.INTERNAL_ERROR, "Failed to get user info from Google");
      }

      // Find or create user
      const result = await findOrCreateGoogleUser(googleUser, tokens);
      if (!result) {
        set.status = 500;
        return error(ErrorCodes.INTERNAL_ERROR, "Failed to create or link user");
      }

      // Generate JWT tokens
      const tokenPayload: AccessTokenPayload = {
        userId: result.user.id,
        email: result.user.email!,
      };

      const accessToken = await generateAccessToken(jwt, tokenPayload);
      const refreshToken = await generateRefreshToken(result.user.id);

      return success({
        user: {
          id: result.user.id,
          email: result.user.email,
          displayName: result.user.displayName,
          emailVerified: result.user.isEmailVerified,
        },
        tokens: {
          accessToken,
          refreshToken,
          expiresIn: 900,
        },
        isNewUser: result.isNew,
        accountLinked: result.linked,
      });
    },
    {
      query: t.Object({
        code: t.Optional(t.String()),
        state: t.Optional(t.String()),
        error: t.Optional(t.String()),
      }),
      detail: {
        tags: ["Auth"],
        summary: "Google OAuth callback",
        description: "Handles the OAuth callback from Google. Creates or links the user account and returns authentication tokens.",
        security: [],
      },
    }
  );
