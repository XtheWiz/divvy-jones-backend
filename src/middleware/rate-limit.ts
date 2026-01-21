/**
 * Rate Limit Middleware
 * Sprint 009 - TASK-010
 *
 * Elysia middleware for rate limiting API endpoints.
 * AC-3.5: Rate limit headers included in responses (X-RateLimit-*)
 * AC-3.6: 429 Too Many Requests returned when limit exceeded
 */

import { Elysia } from "elysia";
import {
  rateLimiter,
  type RateLimitConfig,
  RATE_LIMITS,
  getClientIP,
  keyFromIP,
  keyFromUserId,
  keyFromEmail,
} from "../services/rate-limiter.service";
import { error, ErrorCodes } from "../lib/responses";

// ============================================================================
// Types
// ============================================================================

/**
 * Options for rate limit middleware
 */
export interface RateLimitMiddlewareOptions {
  /** Rate limit configuration */
  config: RateLimitConfig;
  /**
   * Function to generate the rate limit key from the context
   * Default: uses client IP
   */
  keyGenerator?: (ctx: RateLimitContext) => string;
  /**
   * Custom error message when rate limit exceeded
   */
  errorMessage?: string;
  /**
   * Whether to skip rate limiting (useful for testing)
   * Can also be controlled via SKIP_RATE_LIMITING env var
   */
  skip?: boolean;
}

/**
 * Context available to key generator
 */
export interface RateLimitContext {
  request: Request;
  auth?: { userId: string; email: string } | null;
  body?: unknown;
}

// ============================================================================
// Rate Limit Header Names (AC-3.5)
// ============================================================================

export const RATE_LIMIT_HEADERS = {
  /** Maximum requests allowed in the window */
  LIMIT: "X-RateLimit-Limit",
  /** Remaining requests in the current window */
  REMAINING: "X-RateLimit-Remaining",
  /** Unix timestamp when the window resets */
  RESET: "X-RateLimit-Reset",
  /** Time in seconds until the window resets */
  RETRY_AFTER: "Retry-After",
};

// ============================================================================
// Rate Limit Middleware Factory
// ============================================================================

/**
 * Create a rate limit middleware with the specified configuration
 *
 * Usage:
 * ```typescript
 * // Rate limit by IP
 * app.use(rateLimit({ config: RATE_LIMITS.AUTH }))
 *
 * // Rate limit by user ID
 * app.use(rateLimit({
 *   config: RATE_LIMITS.SOCIAL,
 *   keyGenerator: (ctx) => ctx.auth?.userId || getClientIP(ctx.request)
 * }))
 *
 * // Rate limit by email in request body
 * app.use(rateLimit({
 *   config: RATE_LIMITS.FORGOT_PASSWORD,
 *   keyGenerator: (ctx) => keyFromEmail((ctx.body as any)?.email || "")
 * }))
 * ```
 */
export function rateLimit(options: RateLimitMiddlewareOptions) {
  const {
    config,
    keyGenerator = (ctx) => keyFromIP(getClientIP(ctx.request)),
    errorMessage = "Too many requests. Please try again later.",
    skip = false,
  } = options;

  return new Elysia({ name: `rate-limit-${config.prefix || "default"}` })
    .onBeforeHandle(({ request, set, body }) => {
      // Skip if disabled
      if (skip || process.env.SKIP_RATE_LIMITING === "true") {
        return;
      }

      // Generate the rate limit key
      const ctx: RateLimitContext = { request, body };
      const key = keyGenerator(ctx);

      // Check the rate limit
      const result = rateLimiter.check(key, config);

      // AC-3.5: Set rate limit headers
      set.headers = {
        ...set.headers,
        [RATE_LIMIT_HEADERS.LIMIT]: String(result.limit),
        [RATE_LIMIT_HEADERS.REMAINING]: String(result.remaining),
        [RATE_LIMIT_HEADERS.RESET]: String(Math.ceil(result.resetAt.getTime() / 1000)),
      };

      // AC-3.6: Return 429 if rate limit exceeded
      if (!result.allowed) {
        set.status = 429;
        set.headers[RATE_LIMIT_HEADERS.RETRY_AFTER] = String(
          Math.ceil(result.resetMs / 1000)
        );
        return error(ErrorCodes.RATE_LIMIT_EXCEEDED, errorMessage);
      }
    });
}

// ============================================================================
// Pre-configured Middleware Factories
// ============================================================================

/**
 * Rate limit for authentication endpoints (5/min per IP)
 * AC-3.3: Auth endpoints rate limited
 */
export function authRateLimit() {
  return rateLimit({
    config: RATE_LIMITS.AUTH,
    keyGenerator: (ctx) => keyFromIP(getClientIP(ctx.request)),
    errorMessage: "Too many authentication attempts. Please wait a minute before trying again.",
  });
}

/**
 * Rate limit for forgot password endpoint (3/hour per email)
 * AC-4.8: Forgot password rate limiting
 */
export function forgotPasswordRateLimit() {
  return rateLimit({
    config: RATE_LIMITS.FORGOT_PASSWORD,
    keyGenerator: (ctx) => {
      const email = (ctx.body as { email?: string })?.email;
      return email ? keyFromEmail(email) : keyFromIP(getClientIP(ctx.request));
    },
    errorMessage: "Too many password reset requests. Please try again later.",
  });
}

/**
 * Rate limit for social endpoints (30/min per user)
 * AC-3.4: Social endpoints rate limited
 */
export function socialRateLimit() {
  return new Elysia({ name: "social-rate-limit" })
    .onBeforeHandle(({ request, set, ...ctx }) => {
      // Skip if disabled
      if (process.env.SKIP_RATE_LIMITING === "true") {
        return;
      }

      // Use user ID if authenticated (auth comes from parent middleware), otherwise IP
      const auth = (ctx as { auth?: { userId: string } }).auth;
      const key = auth?.userId
        ? keyFromUserId(auth.userId)
        : keyFromIP(getClientIP(request));

      // Check the rate limit
      const result = rateLimiter.check(key, RATE_LIMITS.SOCIAL);

      // Set rate limit headers
      set.headers = {
        ...set.headers,
        [RATE_LIMIT_HEADERS.LIMIT]: String(result.limit),
        [RATE_LIMIT_HEADERS.REMAINING]: String(result.remaining),
        [RATE_LIMIT_HEADERS.RESET]: String(Math.ceil(result.resetAt.getTime() / 1000)),
      };

      // Return 429 if exceeded
      if (!result.allowed) {
        set.status = 429;
        set.headers[RATE_LIMIT_HEADERS.RETRY_AFTER] = String(
          Math.ceil(result.resetMs / 1000)
        );
        return error(
          ErrorCodes.RATE_LIMIT_EXCEEDED,
          "Too many requests. Please slow down."
        );
      }
    });
}

/**
 * General rate limit (100/min per user)
 */
export function generalRateLimit() {
  return new Elysia({ name: "general-rate-limit" })
    .onBeforeHandle(({ request, set, ...ctx }) => {
      // Skip if disabled
      if (process.env.SKIP_RATE_LIMITING === "true") {
        return;
      }

      // Use user ID if authenticated (auth comes from parent middleware), otherwise IP
      const auth = (ctx as { auth?: { userId: string } }).auth;
      const key = auth?.userId
        ? keyFromUserId(auth.userId)
        : keyFromIP(getClientIP(request));

      // Check the rate limit
      const result = rateLimiter.check(key, RATE_LIMITS.GENERAL);

      // Set rate limit headers
      set.headers = {
        ...set.headers,
        [RATE_LIMIT_HEADERS.LIMIT]: String(result.limit),
        [RATE_LIMIT_HEADERS.REMAINING]: String(result.remaining),
        [RATE_LIMIT_HEADERS.RESET]: String(Math.ceil(result.resetAt.getTime() / 1000)),
      };

      // Return 429 if exceeded
      if (!result.allowed) {
        set.status = 429;
        set.headers[RATE_LIMIT_HEADERS.RETRY_AFTER] = String(
          Math.ceil(result.resetMs / 1000)
        );
        return error(
          ErrorCodes.RATE_LIMIT_EXCEEDED,
          "Rate limit exceeded. Please try again later."
        );
      }
    });
}
