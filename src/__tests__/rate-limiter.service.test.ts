/**
 * Rate Limiter Service Unit Tests
 * Sprint 009 - TASK-012
 *
 * Tests for the sliding window rate limiter service.
 * AC-3.8: Unit tests for rate limiter logic
 */

import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import {
  rateLimiter,
  RATE_LIMITS,
  keyFromIP,
  keyFromUserId,
  keyFromEmail,
  type RateLimitConfig,
} from "../services/rate-limiter.service";

// ============================================================================
// Test Configuration
// ============================================================================

/** Test configuration with short window for faster tests */
const testConfig: RateLimitConfig = {
  maxRequests: 3,
  windowMs: 1000, // 1 second window
  prefix: "test",
};

// ============================================================================
// Sliding Window Algorithm Tests
// ============================================================================

describe("RateLimiterService", () => {
  beforeEach(() => {
    // Clear all rate limit data before each test
    rateLimiter.clearAll();
    // Ensure rate limiting is not bypassed
    rateLimiter.setBypass(false);
  });

  afterEach(() => {
    // Clean up
    rateLimiter.clearAll();
  });

  describe("sliding window behavior", () => {
    it("should allow requests within the limit", () => {
      // Arrange
      const key = "test-user-1";

      // Act & Assert - First 3 requests should be allowed
      for (let i = 0; i < 3; i++) {
        const result = rateLimiter.check(key, testConfig);
        expect(result.allowed).toBe(true);
        expect(result.current).toBe(i + 1);
        // remaining = maxRequests - current (after adding this request)
        expect(result.remaining).toBe(testConfig.maxRequests - i - 1);
      }
    });

    it("should block requests when limit is exceeded", () => {
      // Arrange
      const key = "test-user-2";

      // Act - Make 3 allowed requests
      for (let i = 0; i < 3; i++) {
        rateLimiter.check(key, testConfig);
      }

      // Act - 4th request should be blocked
      const result = rateLimiter.check(key, testConfig);

      // Assert
      expect(result.allowed).toBe(false);
      expect(result.current).toBe(3);
      expect(result.remaining).toBe(0);
    });

    it("should track correct remaining count", () => {
      // Arrange
      const key = "test-user-3";

      // Act & Assert - maxRequests=3
      let result = rateLimiter.check(key, testConfig);
      expect(result.remaining).toBe(2); // After 1st request: 3 - 1 = 2 remaining

      result = rateLimiter.check(key, testConfig);
      expect(result.remaining).toBe(1); // After 2nd request: 3 - 2 = 1 remaining

      result = rateLimiter.check(key, testConfig);
      expect(result.remaining).toBe(0); // At limit: 3 - 3 = 0 remaining
    });

    it("should reset after window expires", async () => {
      // Arrange
      const key = "test-user-4";
      const shortConfig: RateLimitConfig = {
        maxRequests: 2,
        windowMs: 100, // 100ms window
        prefix: "short",
      };

      // Act - Exhaust the limit
      rateLimiter.check(key, shortConfig);
      rateLimiter.check(key, shortConfig);
      let result = rateLimiter.check(key, shortConfig);
      expect(result.allowed).toBe(false);

      // Wait for window to expire
      await new Promise((resolve) => setTimeout(resolve, 150));

      // Act - Should be allowed again
      result = rateLimiter.check(key, shortConfig);

      // Assert
      expect(result.allowed).toBe(true);
      expect(result.current).toBe(1);
    });
  });

  describe("limit exceeded scenarios", () => {
    it("should return correct reset time when limit exceeded", () => {
      // Arrange
      const key = "test-user-5";

      // Act - Exhaust limit
      for (let i = 0; i < 3; i++) {
        rateLimiter.check(key, testConfig);
      }
      const result = rateLimiter.check(key, testConfig);

      // Assert
      expect(result.allowed).toBe(false);
      expect(result.resetMs).toBeGreaterThan(0);
      expect(result.resetMs).toBeLessThanOrEqual(testConfig.windowMs);
      expect(result.resetAt).toBeInstanceOf(Date);
    });

    it("should not increment count on blocked requests", () => {
      // Arrange
      const key = "test-user-6";

      // Act - Exhaust limit
      for (let i = 0; i < 3; i++) {
        rateLimiter.check(key, testConfig);
      }

      // Make blocked requests
      const blocked1 = rateLimiter.check(key, testConfig);
      const blocked2 = rateLimiter.check(key, testConfig);

      // Assert - count should remain at 3
      expect(blocked1.current).toBe(3);
      expect(blocked2.current).toBe(3);
    });
  });

  describe("bypass option (AC-3.7)", () => {
    it("should allow all requests when bypassed", () => {
      // Arrange
      const key = "test-user-7";
      rateLimiter.setBypass(true);

      // Act - Make more requests than the limit
      for (let i = 0; i < 10; i++) {
        const result = rateLimiter.check(key, testConfig);
        // Assert - all should be allowed
        expect(result.allowed).toBe(true);
      }
    });

    it("should report max remaining when bypassed", () => {
      // Arrange
      const key = "test-user-8";
      rateLimiter.setBypass(true);

      // Act
      const result = rateLimiter.check(key, testConfig);

      // Assert - should report full limit remaining
      expect(result.remaining).toBe(testConfig.maxRequests);
      expect(result.current).toBe(0);
    });

    it("should respect bypass toggle", () => {
      // Arrange
      const key = "test-user-9";

      // Act - Enable bypass
      rateLimiter.setBypass(true);
      expect(rateLimiter.isBypassed()).toBe(true);

      // Act - Disable bypass
      rateLimiter.setBypass(false);
      expect(rateLimiter.isBypassed()).toBe(false);

      // Now rate limiting should work
      for (let i = 0; i < 3; i++) {
        rateLimiter.check(key, testConfig);
      }
      const result = rateLimiter.check(key, testConfig);
      expect(result.allowed).toBe(false);
    });
  });

  describe("key isolation", () => {
    it("should track different keys independently", () => {
      // Arrange
      const key1 = "user-a";
      const key2 = "user-b";

      // Act - Exhaust limit for key1
      for (let i = 0; i < 3; i++) {
        rateLimiter.check(key1, testConfig);
      }

      // Act - key2 should still be allowed
      const result = rateLimiter.check(key2, testConfig);

      // Assert
      expect(result.allowed).toBe(true);
    });

    it("should use prefix to namespace keys", () => {
      // Arrange
      const key = "same-key";
      const config1: RateLimitConfig = { ...testConfig, prefix: "prefix1" };
      const config2: RateLimitConfig = { ...testConfig, prefix: "prefix2" };

      // Act - Exhaust limit for prefix1
      for (let i = 0; i < 3; i++) {
        rateLimiter.check(key, config1);
      }

      // Act - prefix2 should still be allowed
      const result = rateLimiter.check(key, config2);

      // Assert
      expect(result.allowed).toBe(true);
    });
  });

  describe("reset functionality", () => {
    it("should reset rate limit for specific key", () => {
      // Arrange
      const key = "test-user-10";

      // Act - Exhaust limit
      for (let i = 0; i < 3; i++) {
        rateLimiter.check(key, testConfig);
      }
      let result = rateLimiter.check(key, testConfig);
      expect(result.allowed).toBe(false);

      // Act - Reset the key
      rateLimiter.reset(key, testConfig);

      // Act - Should be allowed again
      result = rateLimiter.check(key, testConfig);

      // Assert
      expect(result.allowed).toBe(true);
      expect(result.current).toBe(1);
    });

    it("should clear all rate limits", () => {
      // Arrange
      const key1 = "test-user-11";
      const key2 = "test-user-12";

      // Act - Exhaust limits for both keys
      for (let i = 0; i < 3; i++) {
        rateLimiter.check(key1, testConfig);
        rateLimiter.check(key2, testConfig);
      }

      // Act - Clear all
      rateLimiter.clearAll();

      // Act & Assert - Both should be allowed
      expect(rateLimiter.check(key1, testConfig).allowed).toBe(true);
      expect(rateLimiter.check(key2, testConfig).allowed).toBe(true);
    });
  });

  describe("consume function", () => {
    it("should manually consume a request slot", () => {
      // Arrange
      const key = "test-user-13";

      // Act - Consume 2 slots manually
      rateLimiter.consume(key, testConfig);
      rateLimiter.consume(key, testConfig);

      // Check - Only 1 slot remaining
      const result = rateLimiter.check(key, testConfig);
      expect(result.allowed).toBe(true);
      expect(result.current).toBe(3); // 2 consumed + 1 checked

      // Next should be blocked
      expect(rateLimiter.check(key, testConfig).allowed).toBe(false);
    });
  });

  describe("getCount function", () => {
    it("should return current count for a key", () => {
      // Arrange
      const key = "test-user-14";

      // Act - Make some requests
      rateLimiter.check(key, testConfig);
      rateLimiter.check(key, testConfig);

      // Assert
      expect(rateLimiter.getCount(key, testConfig)).toBe(2);
    });

    it("should return 0 for unknown key", () => {
      expect(rateLimiter.getCount("unknown-key", testConfig)).toBe(0);
    });
  });
});

// ============================================================================
// Helper Function Tests
// ============================================================================

describe("Rate limiter key helpers", () => {
  describe("keyFromIP", () => {
    it("should return IP as key", () => {
      expect(keyFromIP("192.168.1.1")).toBe("192.168.1.1");
    });

    it("should handle null/undefined IP", () => {
      expect(keyFromIP(null)).toBe("unknown-ip");
      expect(keyFromIP(undefined)).toBe("unknown-ip");
    });
  });

  describe("keyFromUserId", () => {
    it("should prefix user ID with 'user:'", () => {
      expect(keyFromUserId("abc123")).toBe("user:abc123");
    });
  });

  describe("keyFromEmail", () => {
    it("should prefix email with 'email:' and lowercase", () => {
      expect(keyFromEmail("Test@Example.COM")).toBe("email:test@example.com");
    });
  });
});

// ============================================================================
// Preset Configuration Tests
// ============================================================================

describe("RATE_LIMITS presets", () => {
  it("should have AUTH limit of 5 requests per minute", () => {
    expect(RATE_LIMITS.AUTH.maxRequests).toBe(5);
    expect(RATE_LIMITS.AUTH.windowMs).toBe(60 * 1000);
  });

  it("should have FORGOT_PASSWORD limit of 3 requests per hour", () => {
    expect(RATE_LIMITS.FORGOT_PASSWORD.maxRequests).toBe(3);
    expect(RATE_LIMITS.FORGOT_PASSWORD.windowMs).toBe(60 * 60 * 1000);
  });

  it("should have SOCIAL limit of 30 requests per minute", () => {
    expect(RATE_LIMITS.SOCIAL.maxRequests).toBe(30);
    expect(RATE_LIMITS.SOCIAL.windowMs).toBe(60 * 1000);
  });

  it("should have GENERAL limit of 100 requests per minute", () => {
    expect(RATE_LIMITS.GENERAL.maxRequests).toBe(100);
    expect(RATE_LIMITS.GENERAL.windowMs).toBe(60 * 1000);
  });
});
