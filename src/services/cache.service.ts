/**
 * Cache Service
 * Sprint 008 - TASK-013
 *
 * In-memory cache service with TTL support.
 * AC-3.1: Exchange rate cache reduces external API calls (partially implemented in exchange-rate.service)
 * AC-3.2: Group summary data can be cached with configurable TTL
 * AC-3.3: Cache invalidation occurs on relevant data changes
 * AC-3.4: Cache stats endpoint for monitoring (admin only)
 */

// ============================================================================
// Types
// ============================================================================

export interface CacheEntry<T> {
  value: T;
  expiresAt: number; // timestamp in ms
  createdAt: number;
}

export interface CacheStats {
  hits: number;
  misses: number;
  sets: number;
  invalidations: number;
  size: number;
  hitRate: number;
  keys: string[];
  memoryUsageBytes: number;
}

export interface CacheConfig {
  defaultTtl: number; // milliseconds
  maxSize?: number; // maximum number of entries
  cleanupInterval?: number; // how often to clean expired entries (ms)
}

// ============================================================================
// Default Configuration
// ============================================================================

const DEFAULT_CONFIG: CacheConfig = {
  defaultTtl: 5 * 60 * 1000, // 5 minutes
  maxSize: 1000,
  cleanupInterval: 60 * 1000, // 1 minute
};

// TTL presets for different cache types
export const CACHE_TTL = {
  /** Exchange rates - 15 minutes */
  EXCHANGE_RATES: 15 * 60 * 1000,
  /** Group balances - 5 minutes */
  GROUP_BALANCES: 5 * 60 * 1000,
  /** Group summary/analytics - 5 minutes */
  GROUP_SUMMARY: 5 * 60 * 1000,
  /** User preferences - 10 minutes */
  USER_PREFERENCES: 10 * 60 * 1000,
  /** Category analytics - 10 minutes */
  CATEGORY_ANALYTICS: 10 * 60 * 1000,
  /** Short cache - 1 minute */
  SHORT: 1 * 60 * 1000,
  /** Long cache - 30 minutes */
  LONG: 30 * 60 * 1000,
} as const;

// Cache key prefixes for different data types
export const CACHE_KEYS = {
  groupBalances: (groupId: string) => `balances:${groupId}`,
  groupSummary: (groupId: string, dateRange?: string) =>
    `summary:${groupId}${dateRange ? `:${dateRange}` : ""}`,
  categoryAnalytics: (groupId: string, dateRange?: string) =>
    `categories:${groupId}${dateRange ? `:${dateRange}` : ""}`,
  spendingTrends: (groupId: string, period: string, dateRange?: string) =>
    `trends:${groupId}:${period}${dateRange ? `:${dateRange}` : ""}`,
  userPreferences: (userId: string) => `prefs:${userId}`,
  exchangeRates: () => "exchange-rates",
} as const;

// ============================================================================
// Cache Service Class
// ============================================================================

class CacheService {
  private cache: Map<string, CacheEntry<unknown>> = new Map();
  private config: CacheConfig;
  private stats = {
    hits: 0,
    misses: 0,
    sets: 0,
    invalidations: 0,
  };
  private cleanupTimer: ReturnType<typeof setInterval> | null = null;

  constructor(config: Partial<CacheConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.startCleanupTimer();
  }

  /**
   * Get a value from the cache
   * Returns undefined if not found or expired
   */
  get<T>(key: string): T | undefined {
    const entry = this.cache.get(key) as CacheEntry<T> | undefined;

    if (!entry) {
      this.stats.misses++;
      return undefined;
    }

    // Check if expired
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      this.stats.misses++;
      return undefined;
    }

    this.stats.hits++;
    return entry.value;
  }

  /**
   * Set a value in the cache with optional TTL
   * AC-3.2: Group summary data can be cached with configurable TTL
   */
  set<T>(key: string, value: T, ttl?: number): void {
    const now = Date.now();
    const effectiveTtl = ttl ?? this.config.defaultTtl;

    // Enforce max size by removing oldest entries
    if (this.config.maxSize && this.cache.size >= this.config.maxSize) {
      this.evictOldest();
    }

    this.cache.set(key, {
      value,
      expiresAt: now + effectiveTtl,
      createdAt: now,
    });

    this.stats.sets++;
  }

  /**
   * Check if a key exists and is not expired
   */
  has(key: string): boolean {
    const entry = this.cache.get(key);
    if (!entry) return false;
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return false;
    }
    return true;
  }

  /**
   * Get a value or set it if not present
   * Useful for cache-aside pattern
   */
  async getOrSet<T>(
    key: string,
    factory: () => Promise<T>,
    ttl?: number
  ): Promise<T> {
    const cached = this.get<T>(key);
    if (cached !== undefined) {
      return cached;
    }

    const value = await factory();
    this.set(key, value, ttl);
    return value;
  }

  /**
   * Invalidate a specific cache entry
   * AC-3.3: Cache invalidation occurs on relevant data changes
   */
  invalidate(key: string): boolean {
    const deleted = this.cache.delete(key);
    if (deleted) {
      this.stats.invalidations++;
    }
    return deleted;
  }

  /**
   * Invalidate all entries matching a prefix
   * AC-3.3: Useful for invalidating all group-related cache on group changes
   */
  invalidatePrefix(prefix: string): number {
    let count = 0;
    for (const key of this.cache.keys()) {
      if (key.startsWith(prefix)) {
        this.cache.delete(key);
        count++;
      }
    }
    if (count > 0) {
      this.stats.invalidations += count;
    }
    return count;
  }

  /**
   * Invalidate all cache entries for a specific group
   * AC-3.3: Cache invalidation occurs on relevant data changes
   */
  invalidateGroup(groupId: string): number {
    const prefixes = [
      `balances:${groupId}`,
      `summary:${groupId}`,
      `categories:${groupId}`,
      `trends:${groupId}`,
    ];

    let count = 0;
    for (const prefix of prefixes) {
      count += this.invalidatePrefix(prefix);
    }
    return count;
  }

  /**
   * Clear all cache entries
   */
  clear(): void {
    const size = this.cache.size;
    this.cache.clear();
    this.stats.invalidations += size;
  }

  /**
   * Get cache statistics
   * AC-3.4: Cache stats endpoint for monitoring
   */
  getStats(): CacheStats {
    // Clean up expired entries first for accurate stats
    this.cleanup();

    const totalRequests = this.stats.hits + this.stats.misses;
    const hitRate = totalRequests > 0 ? this.stats.hits / totalRequests : 0;

    // Estimate memory usage (rough approximation)
    let memoryUsageBytes = 0;
    for (const [key, entry] of this.cache.entries()) {
      // Key length + estimated value size + overhead
      memoryUsageBytes += key.length * 2; // UTF-16
      memoryUsageBytes += JSON.stringify(entry.value).length * 2;
      memoryUsageBytes += 48; // CacheEntry overhead
    }

    return {
      hits: this.stats.hits,
      misses: this.stats.misses,
      sets: this.stats.sets,
      invalidations: this.stats.invalidations,
      size: this.cache.size,
      hitRate: Math.round(hitRate * 10000) / 100, // percentage with 2 decimals
      keys: Array.from(this.cache.keys()),
      memoryUsageBytes,
    };
  }

  /**
   * Reset statistics (useful for testing)
   */
  resetStats(): void {
    this.stats = {
      hits: 0,
      misses: 0,
      sets: 0,
      invalidations: 0,
    };
  }

  /**
   * Get the TTL remaining for a key (in ms)
   * Returns -1 if key doesn't exist, 0 if expired
   */
  getTtl(key: string): number {
    const entry = this.cache.get(key);
    if (!entry) return -1;

    const remaining = entry.expiresAt - Date.now();
    return remaining > 0 ? remaining : 0;
  }

  /**
   * Remove expired entries
   */
  private cleanup(): void {
    const now = Date.now();
    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.expiresAt) {
        this.cache.delete(key);
      }
    }
  }

  /**
   * Evict oldest entries when max size reached
   */
  private evictOldest(): void {
    // Sort by createdAt and remove oldest 10%
    const entries = Array.from(this.cache.entries())
      .sort((a, b) => a[1].createdAt - b[1].createdAt);

    const toRemove = Math.max(1, Math.floor(entries.length * 0.1));
    for (let i = 0; i < toRemove && i < entries.length; i++) {
      this.cache.delete(entries[i][0]);
    }
  }

  /**
   * Start periodic cleanup timer
   */
  private startCleanupTimer(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
    }

    if (this.config.cleanupInterval && this.config.cleanupInterval > 0) {
      this.cleanupTimer = setInterval(() => {
        this.cleanup();
      }, this.config.cleanupInterval);

      // Don't prevent process from exiting
      if (this.cleanupTimer.unref) {
        this.cleanupTimer.unref();
      }
    }
  }

  /**
   * Stop cleanup timer (for graceful shutdown or testing)
   */
  stopCleanupTimer(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }
  }

  /**
   * Destroy the cache service
   */
  destroy(): void {
    this.stopCleanupTimer();
    this.cache.clear();
  }
}

// ============================================================================
// Singleton Instance
// ============================================================================

let cacheServiceInstance: CacheService | null = null;

/**
 * Get the cache service singleton
 */
export function getCacheService(config?: Partial<CacheConfig>): CacheService {
  if (!cacheServiceInstance) {
    cacheServiceInstance = new CacheService(config);
  }
  return cacheServiceInstance;
}

/**
 * Create a new cache service instance (for testing)
 */
export function createCacheService(config?: Partial<CacheConfig>): CacheService {
  return new CacheService(config);
}

/**
 * Reset the singleton (for testing)
 */
export function resetCacheService(): void {
  if (cacheServiceInstance) {
    cacheServiceInstance.destroy();
    cacheServiceInstance = null;
  }
}

export { CacheService };
