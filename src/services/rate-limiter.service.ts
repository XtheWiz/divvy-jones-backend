/**
 * Rate Limiter Service
 * Sprint 009 - TASK-009
 *
 * In-memory rate limiter using sliding window algorithm.
 * AC-3.1: Rate limiter service created with configurable limits
 * AC-3.2: In-memory rate limiting with sliding window algorithm
 * AC-3.7: Rate limiter can be bypassed for testing (configurable)
 */

// ============================================================================
// Types
// ============================================================================

/**
 * Configuration for a rate limit
 */
export interface RateLimitConfig {
  /** Maximum number of requests allowed in the window */
  maxRequests: number;
  /** Time window in milliseconds */
  windowMs: number;
  /** Optional custom key prefix for the limit type */
  prefix?: string;
}

/**
 * Result of a rate limit check
 */
export interface RateLimitResult {
  /** Whether the request is allowed */
  allowed: boolean;
  /** Current number of requests in the window */
  current: number;
  /** Maximum requests allowed */
  limit: number;
  /** Remaining requests in the current window */
  remaining: number;
  /** Time in milliseconds until the window resets */
  resetMs: number;
  /** Timestamp when the window resets */
  resetAt: Date;
}

/**
 * Entry in the sliding window
 */
interface WindowEntry {
  /** Timestamp of the request */
  timestamp: number;
}

// ============================================================================
// Default Configurations
// ============================================================================

/**
 * Preset rate limit configurations
 * AC-3.3, AC-3.4: Auth and social endpoints rate limits
 */
export const RATE_LIMITS = {
  /** Auth endpoints: 5 requests per minute per IP (AC-3.3) */
  AUTH: {
    maxRequests: 5,
    windowMs: 60 * 1000, // 1 minute
    prefix: "auth",
  } as RateLimitConfig,

  /** Forgot password: 3 requests per hour per email (AC-4.8) */
  FORGOT_PASSWORD: {
    maxRequests: 3,
    windowMs: 60 * 60 * 1000, // 1 hour
    prefix: "forgot-password",
  } as RateLimitConfig,

  /** Social endpoints: 30 requests per minute per user (AC-3.4) */
  SOCIAL: {
    maxRequests: 30,
    windowMs: 60 * 1000, // 1 minute
    prefix: "social",
  } as RateLimitConfig,

  /** General API: 100 requests per minute per user */
  GENERAL: {
    maxRequests: 100,
    windowMs: 60 * 1000, // 1 minute
    prefix: "general",
  } as RateLimitConfig,

  /** Strict limit for sensitive operations: 10 per hour */
  STRICT: {
    maxRequests: 10,
    windowMs: 60 * 60 * 1000, // 1 hour
    prefix: "strict",
  } as RateLimitConfig,
};

// ============================================================================
// Rate Limiter Service
// ============================================================================

/**
 * In-memory sliding window rate limiter
 *
 * Uses a sliding window algorithm that:
 * 1. Stores timestamps of recent requests
 * 2. Removes expired timestamps on each check
 * 3. Counts remaining requests in the current window
 *
 * AC-3.2: Sliding window provides smoother rate limiting than fixed windows
 */
class RateLimiterService {
  /** Map of key -> request timestamps */
  private windows: Map<string, WindowEntry[]> = new Map();

  /** Cleanup interval reference */
  private cleanupInterval: ReturnType<typeof setInterval> | null = null;

  /** Whether rate limiting is bypassed (AC-3.7) */
  private bypassed: boolean = false;

  constructor() {
    // Check environment variable for bypass (useful for testing)
    this.bypassed = process.env.SKIP_RATE_LIMITING === "true";

    // Start periodic cleanup of expired entries
    this.startCleanup();
  }

  /**
   * Check if a request is allowed under the rate limit
   *
   * @param key - Unique identifier for the rate limit (e.g., IP address, user ID)
   * @param config - Rate limit configuration
   * @returns Result indicating if request is allowed and current status
   */
  check(key: string, config: RateLimitConfig): RateLimitResult {
    const now = Date.now();
    const windowStart = now - config.windowMs;
    const fullKey = config.prefix ? `${config.prefix}:${key}` : key;

    // AC-3.7: Allow bypass for testing
    if (this.bypassed) {
      return {
        allowed: true,
        current: 0,
        limit: config.maxRequests,
        remaining: config.maxRequests,
        resetMs: config.windowMs,
        resetAt: new Date(now + config.windowMs),
      };
    }

    // Get or initialize the window for this key
    let entries = this.windows.get(fullKey) || [];

    // Remove expired entries (sliding window)
    entries = entries.filter((entry) => entry.timestamp > windowStart);

    // Calculate current count and remaining
    const current = entries.length;
    const allowed = current < config.maxRequests;
    const remaining = Math.max(0, config.maxRequests - current - (allowed ? 1 : 0));

    // Calculate reset time (when the oldest entry expires)
    const oldestTimestamp = entries.length > 0 ? entries[0].timestamp : now;
    const resetMs = Math.max(0, oldestTimestamp + config.windowMs - now);

    // If allowed, add the current request
    if (allowed) {
      entries.push({ timestamp: now });
    }

    // Update the window
    this.windows.set(fullKey, entries);

    return {
      allowed,
      current: allowed ? current + 1 : current,
      limit: config.maxRequests,
      remaining,
      resetMs,
      resetAt: new Date(now + resetMs),
    };
  }

  /**
   * Consume a request slot without checking
   * Useful when you want to manually track requests
   */
  consume(key: string, config: RateLimitConfig): void {
    if (this.bypassed) return;

    const now = Date.now();
    const fullKey = config.prefix ? `${config.prefix}:${key}` : key;

    let entries = this.windows.get(fullKey) || [];
    entries.push({ timestamp: now });
    this.windows.set(fullKey, entries);
  }

  /**
   * Reset the rate limit for a specific key
   * Useful for testing or manual override
   */
  reset(key: string, config?: RateLimitConfig): void {
    const fullKey = config?.prefix ? `${config.prefix}:${key}` : key;
    this.windows.delete(fullKey);
  }

  /**
   * Clear all rate limit data
   * Useful for testing
   */
  clearAll(): void {
    this.windows.clear();
  }

  /**
   * Get the current count for a key
   * Useful for debugging/monitoring
   */
  getCount(key: string, config: RateLimitConfig): number {
    const now = Date.now();
    const windowStart = now - config.windowMs;
    const fullKey = config.prefix ? `${config.prefix}:${key}` : key;

    const entries = this.windows.get(fullKey) || [];
    return entries.filter((entry) => entry.timestamp > windowStart).length;
  }

  /**
   * Set bypass mode (AC-3.7)
   * Used primarily for testing
   */
  setBypass(bypass: boolean): void {
    this.bypassed = bypass;
  }

  /**
   * Check if bypass mode is enabled
   */
  isBypassed(): boolean {
    return this.bypassed;
  }

  /**
   * Start periodic cleanup of expired entries
   * Runs every minute to prevent memory leaks
   */
  private startCleanup(): void {
    // Clean up every minute
    this.cleanupInterval = setInterval(() => {
      this.cleanup();
    }, 60 * 1000);

    // Don't prevent process from exiting
    if (this.cleanupInterval.unref) {
      this.cleanupInterval.unref();
    }
  }

  /**
   * Clean up expired entries from all windows
   */
  private cleanup(): void {
    const now = Date.now();
    const maxWindowMs = Math.max(
      ...Object.values(RATE_LIMITS).map((c) => c.windowMs)
    );

    for (const [key, entries] of this.windows.entries()) {
      // Filter out entries older than the longest window
      const validEntries = entries.filter(
        (entry) => entry.timestamp > now - maxWindowMs
      );

      if (validEntries.length === 0) {
        this.windows.delete(key);
      } else if (validEntries.length < entries.length) {
        this.windows.set(key, validEntries);
      }
    }
  }

  /**
   * Stop the cleanup interval
   * Call this when shutting down the service
   */
  stop(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
  }
}

// ============================================================================
// Singleton Instance
// ============================================================================

/** Global rate limiter instance */
export const rateLimiter = new RateLimiterService();

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Generate a rate limit key from IP address
 */
export function keyFromIP(ip: string | null | undefined): string {
  return ip || "unknown-ip";
}

/**
 * Generate a rate limit key from user ID
 */
export function keyFromUserId(userId: string): string {
  return `user:${userId}`;
}

/**
 * Generate a rate limit key from email
 */
export function keyFromEmail(email: string): string {
  return `email:${email.toLowerCase()}`;
}

/**
 * Get client IP from request headers
 * Handles common proxy headers
 */
export function getClientIP(request: Request): string {
  // Check common proxy headers
  const forwardedFor = request.headers.get("x-forwarded-for");
  if (forwardedFor) {
    // Take the first IP in the chain (original client)
    return forwardedFor.split(",")[0].trim();
  }

  const realIP = request.headers.get("x-real-ip");
  if (realIP) {
    return realIP;
  }

  // Fallback - in development, might not have these headers
  return "127.0.0.1";
}
