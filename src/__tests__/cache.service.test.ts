/**
 * Cache Service Tests
 * Sprint 008 - TASK-017
 *
 * Tests for the in-memory cache service.
 * AC-3.1: Exchange rate cache reduces external API calls
 * AC-3.2: Group summary data can be cached with configurable TTL
 * AC-3.3: Cache invalidation occurs on relevant data changes
 * AC-3.4: Cache stats endpoint for monitoring
 */

import { describe, expect, test, beforeEach, afterEach } from "bun:test";
import {
  createCacheService,
  CacheService,
  CACHE_TTL,
  CACHE_KEYS,
} from "../services/cache.service";

describe("Cache Service", () => {
  let cache: CacheService;

  beforeEach(() => {
    // Create a fresh cache instance for each test with no cleanup timer
    cache = createCacheService({ cleanupInterval: 0 });
  });

  afterEach(() => {
    cache.destroy();
  });

  // ==========================================================================
  // Basic Operations
  // ==========================================================================

  describe("Basic Operations", () => {
    test("should set and get a value", () => {
      cache.set("key1", "value1");
      expect(cache.get("key1")).toBe("value1");
    });

    test("should return undefined for non-existent key", () => {
      expect(cache.get("nonexistent")).toBeUndefined();
    });

    test("should overwrite existing value", () => {
      cache.set("key1", "value1");
      cache.set("key1", "value2");
      expect(cache.get("key1")).toBe("value2");
    });

    test("should store objects", () => {
      const obj = { name: "test", count: 42 };
      cache.set("obj", obj);
      expect(cache.get("obj")).toEqual(obj);
    });

    test("should store arrays", () => {
      const arr = [1, 2, 3, 4, 5];
      cache.set("arr", arr);
      expect(cache.get("arr")).toEqual(arr);
    });

    test("should store null values", () => {
      cache.set("null", null);
      expect(cache.get("null")).toBeNull();
    });

    test("should check if key exists with has()", () => {
      cache.set("exists", "yes");
      expect(cache.has("exists")).toBe(true);
      expect(cache.has("notexists")).toBe(false);
    });
  });

  // ==========================================================================
  // TTL (Time To Live)
  // ==========================================================================

  describe("TTL (Time To Live)", () => {
    test("should use default TTL", () => {
      cache.set("key1", "value1");
      const ttl = cache.getTtl("key1");
      // Default TTL is 5 minutes (300000ms)
      expect(ttl).toBeGreaterThan(299000);
      expect(ttl).toBeLessThanOrEqual(300000);
    });

    test("should use custom TTL", () => {
      cache.set("key1", "value1", 1000); // 1 second
      const ttl = cache.getTtl("key1");
      expect(ttl).toBeGreaterThan(900);
      expect(ttl).toBeLessThanOrEqual(1000);
    });

    test("should return -1 for non-existent key TTL", () => {
      expect(cache.getTtl("nonexistent")).toBe(-1);
    });

    test("should expire entries after TTL", async () => {
      cache.set("expires", "soon", 50); // 50ms TTL
      expect(cache.get("expires")).toBe("soon");

      // Wait for expiration
      await new Promise((resolve) => setTimeout(resolve, 60));

      expect(cache.get("expires")).toBeUndefined();
    });

    test("should return 0 TTL for expired key", async () => {
      cache.set("expires", "soon", 50);
      await new Promise((resolve) => setTimeout(resolve, 60));
      expect(cache.getTtl("expires")).toBe(0);
    });

    test("should not return expired entries via has()", async () => {
      cache.set("expires", "soon", 50);
      expect(cache.has("expires")).toBe(true);
      await new Promise((resolve) => setTimeout(resolve, 60));
      expect(cache.has("expires")).toBe(false);
    });
  });

  // ==========================================================================
  // AC-3.2: Configurable TTL for Group Summary Data
  // ==========================================================================

  describe("AC-3.2: Configurable TTL", () => {
    test("CACHE_TTL constants are defined correctly", () => {
      expect(CACHE_TTL.EXCHANGE_RATES).toBe(15 * 60 * 1000); // 15 minutes
      expect(CACHE_TTL.GROUP_BALANCES).toBe(5 * 60 * 1000); // 5 minutes
      expect(CACHE_TTL.GROUP_SUMMARY).toBe(5 * 60 * 1000); // 5 minutes
      expect(CACHE_TTL.USER_PREFERENCES).toBe(10 * 60 * 1000); // 10 minutes
      expect(CACHE_TTL.CATEGORY_ANALYTICS).toBe(10 * 60 * 1000); // 10 minutes
      expect(CACHE_TTL.SHORT).toBe(1 * 60 * 1000); // 1 minute
      expect(CACHE_TTL.LONG).toBe(30 * 60 * 1000); // 30 minutes
    });

    test("should cache with GROUP_SUMMARY TTL", () => {
      cache.set("summary", { total: 100 }, CACHE_TTL.GROUP_SUMMARY);
      const ttl = cache.getTtl("summary");
      // 5 minutes = 300000ms
      expect(ttl).toBeGreaterThan(299000);
      expect(ttl).toBeLessThanOrEqual(300000);
    });

    test("should cache with GROUP_BALANCES TTL", () => {
      cache.set("balances", { netBalance: 50 }, CACHE_TTL.GROUP_BALANCES);
      const ttl = cache.getTtl("balances");
      expect(ttl).toBeGreaterThan(299000);
      expect(ttl).toBeLessThanOrEqual(300000);
    });
  });

  // ==========================================================================
  // AC-3.3: Cache Invalidation
  // ==========================================================================

  describe("AC-3.3: Cache Invalidation", () => {
    test("should invalidate a specific key", () => {
      cache.set("key1", "value1");
      cache.set("key2", "value2");

      const result = cache.invalidate("key1");

      expect(result).toBe(true);
      expect(cache.get("key1")).toBeUndefined();
      expect(cache.get("key2")).toBe("value2");
    });

    test("should return false when invalidating non-existent key", () => {
      const result = cache.invalidate("nonexistent");
      expect(result).toBe(false);
    });

    test("should invalidate by prefix", () => {
      cache.set("balances:group1", { total: 100 });
      cache.set("balances:group2", { total: 200 });
      cache.set("summary:group1", { count: 10 });

      const count = cache.invalidatePrefix("balances:");

      expect(count).toBe(2);
      expect(cache.get("balances:group1")).toBeUndefined();
      expect(cache.get("balances:group2")).toBeUndefined();
      expect(cache.get("summary:group1")).toEqual({ count: 10 });
    });

    test("should invalidate all group data", () => {
      const groupId = "test-group-123";
      cache.set(`balances:${groupId}`, { total: 100 });
      cache.set(`summary:${groupId}`, { count: 10 });
      cache.set(`categories:${groupId}`, { food: 50 });
      cache.set(`trends:${groupId}:monthly`, { data: [] });
      cache.set("balances:other-group", { total: 200 });

      const count = cache.invalidateGroup(groupId);

      expect(count).toBe(4);
      expect(cache.get(`balances:${groupId}`)).toBeUndefined();
      expect(cache.get(`summary:${groupId}`)).toBeUndefined();
      expect(cache.get(`categories:${groupId}`)).toBeUndefined();
      expect(cache.get(`trends:${groupId}:monthly`)).toBeUndefined();
      expect(cache.get("balances:other-group")).toEqual({ total: 200 });
    });

    test("should clear all cache entries", () => {
      cache.set("key1", "value1");
      cache.set("key2", "value2");
      cache.set("key3", "value3");

      cache.clear();

      expect(cache.get("key1")).toBeUndefined();
      expect(cache.get("key2")).toBeUndefined();
      expect(cache.get("key3")).toBeUndefined();
      expect(cache.getStats().size).toBe(0);
    });
  });

  // ==========================================================================
  // AC-3.4: Cache Stats
  // ==========================================================================

  describe("AC-3.4: Cache Stats", () => {
    test("should track hits", () => {
      cache.set("key1", "value1");
      cache.get("key1");
      cache.get("key1");
      cache.get("key1");

      const stats = cache.getStats();
      expect(stats.hits).toBe(3);
    });

    test("should track misses", () => {
      cache.get("nonexistent1");
      cache.get("nonexistent2");

      const stats = cache.getStats();
      expect(stats.misses).toBe(2);
    });

    test("should track sets", () => {
      cache.set("key1", "value1");
      cache.set("key2", "value2");
      cache.set("key1", "updated"); // Overwrite counts as a set

      const stats = cache.getStats();
      expect(stats.sets).toBe(3);
    });

    test("should track invalidations", () => {
      cache.set("key1", "value1");
      cache.set("key2", "value2");
      cache.invalidate("key1");
      cache.invalidate("key2");
      cache.invalidate("nonexistent"); // Should not count

      const stats = cache.getStats();
      expect(stats.invalidations).toBe(2);
    });

    test("should track size", () => {
      cache.set("key1", "value1");
      cache.set("key2", "value2");

      expect(cache.getStats().size).toBe(2);

      cache.invalidate("key1");

      expect(cache.getStats().size).toBe(1);
    });

    test("should calculate hit rate", () => {
      cache.set("key1", "value1");
      cache.get("key1"); // hit
      cache.get("key1"); // hit
      cache.get("key1"); // hit
      cache.get("nonexistent"); // miss

      const stats = cache.getStats();
      expect(stats.hitRate).toBe(75); // 3 hits / 4 total = 75%
    });

    test("should return 0 hit rate when no requests", () => {
      const stats = cache.getStats();
      expect(stats.hitRate).toBe(0);
    });

    test("should list all keys", () => {
      cache.set("key1", "value1");
      cache.set("key2", "value2");
      cache.set("key3", "value3");

      const stats = cache.getStats();
      expect(stats.keys).toContain("key1");
      expect(stats.keys).toContain("key2");
      expect(stats.keys).toContain("key3");
      expect(stats.keys.length).toBe(3);
    });

    test("should estimate memory usage", () => {
      cache.set("key1", "a short string");
      cache.set("key2", { nested: { object: { with: "data" } } });

      const stats = cache.getStats();
      expect(stats.memoryUsageBytes).toBeGreaterThan(0);
    });

    test("should reset stats", () => {
      cache.set("key1", "value1");
      cache.get("key1");
      cache.get("nonexistent");

      cache.resetStats();

      const stats = cache.getStats();
      expect(stats.hits).toBe(0);
      expect(stats.misses).toBe(0);
      expect(stats.sets).toBe(0);
      expect(stats.invalidations).toBe(0);
      // Size should still reflect actual cache contents
      expect(stats.size).toBe(1);
    });
  });

  // ==========================================================================
  // Cache Keys
  // ==========================================================================

  describe("Cache Keys", () => {
    test("should generate correct group balances key", () => {
      expect(CACHE_KEYS.groupBalances("group-123")).toBe("balances:group-123");
    });

    test("should generate correct group summary key without date range", () => {
      expect(CACHE_KEYS.groupSummary("group-123")).toBe("summary:group-123");
    });

    test("should generate correct group summary key with date range", () => {
      expect(CACHE_KEYS.groupSummary("group-123", "2024-01-01_2024-12-31")).toBe(
        "summary:group-123:2024-01-01_2024-12-31"
      );
    });

    test("should generate correct category analytics key", () => {
      expect(CACHE_KEYS.categoryAnalytics("group-123")).toBe("categories:group-123");
      expect(CACHE_KEYS.categoryAnalytics("group-123", "2024-Q1")).toBe(
        "categories:group-123:2024-Q1"
      );
    });

    test("should generate correct spending trends key", () => {
      expect(CACHE_KEYS.spendingTrends("group-123", "monthly")).toBe(
        "trends:group-123:monthly"
      );
      expect(CACHE_KEYS.spendingTrends("group-123", "daily", "2024-01")).toBe(
        "trends:group-123:daily:2024-01"
      );
    });

    test("should generate correct user preferences key", () => {
      expect(CACHE_KEYS.userPreferences("user-456")).toBe("prefs:user-456");
    });

    test("should generate correct exchange rates key", () => {
      expect(CACHE_KEYS.exchangeRates()).toBe("exchange-rates");
    });
  });

  // ==========================================================================
  // getOrSet (Cache-Aside Pattern)
  // ==========================================================================

  describe("getOrSet (Cache-Aside Pattern)", () => {
    test("should return cached value without calling factory", async () => {
      cache.set("key1", "cached");
      let factoryCalled = false;

      const result = await cache.getOrSet("key1", async () => {
        factoryCalled = true;
        return "from factory";
      });

      expect(result).toBe("cached");
      expect(factoryCalled).toBe(false);
    });

    test("should call factory and cache result when key not found", async () => {
      let factoryCalled = false;

      const result = await cache.getOrSet("key1", async () => {
        factoryCalled = true;
        return "from factory";
      });

      expect(result).toBe("from factory");
      expect(factoryCalled).toBe(true);
      expect(cache.get("key1")).toBe("from factory");
    });

    test("should use custom TTL for getOrSet", async () => {
      await cache.getOrSet(
        "key1",
        async () => "value",
        1000 // 1 second
      );

      const ttl = cache.getTtl("key1");
      expect(ttl).toBeLessThanOrEqual(1000);
      expect(ttl).toBeGreaterThan(900);
    });

    test("should handle async factory errors", async () => {
      await expect(
        cache.getOrSet("key1", async () => {
          throw new Error("Factory error");
        })
      ).rejects.toThrow("Factory error");

      // Key should not be cached on error
      expect(cache.has("key1")).toBe(false);
    });
  });

  // ==========================================================================
  // Max Size / Eviction
  // ==========================================================================

  describe("Max Size / Eviction", () => {
    test("should evict oldest entries when max size reached", () => {
      const smallCache = createCacheService({ maxSize: 3, cleanupInterval: 0 });

      smallCache.set("key1", "value1");
      smallCache.set("key2", "value2");
      smallCache.set("key3", "value3");
      smallCache.set("key4", "value4"); // Should trigger eviction

      expect(smallCache.getStats().size).toBeLessThanOrEqual(3);
      // key4 should be present as it was just added
      expect(smallCache.get("key4")).toBe("value4");

      smallCache.destroy();
    });
  });

  // ==========================================================================
  // Edge Cases
  // ==========================================================================

  describe("Edge Cases", () => {
    test("should handle empty string key", () => {
      cache.set("", "empty key");
      expect(cache.get("")).toBe("empty key");
    });

    test("should handle empty string value", () => {
      cache.set("key", "");
      expect(cache.get("key")).toBe("");
    });

    test("should handle undefined value correctly", () => {
      // Note: undefined is a valid return for "not found"
      // so we need to use has() to check if key exists with undefined value
      cache.set("key", undefined);
      // get() returns undefined for both "not found" and "value is undefined"
      expect(cache.get("key")).toBeUndefined();
      // has() can distinguish - undefined value still means key exists
      // Actually, our current implementation treats undefined as a valid value
      expect(cache.has("key")).toBe(true);
    });

    test("should handle large values", () => {
      const largeArray = Array(10000).fill({ data: "test" });
      cache.set("large", largeArray);
      expect(cache.get("large")).toHaveLength(10000);
    });

    test("should handle special characters in keys", () => {
      cache.set("key:with:colons", "value1");
      cache.set("key/with/slashes", "value2");
      cache.set("key.with.dots", "value3");

      expect(cache.get("key:with:colons")).toBe("value1");
      expect(cache.get("key/with/slashes")).toBe("value2");
      expect(cache.get("key.with.dots")).toBe("value3");
    });
  });
});
