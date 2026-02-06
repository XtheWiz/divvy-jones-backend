/**
 * Admin Routes
 * Sprint 006 - TASK-011
 * Sprint 007 - TASK-015
 * Sprint 008 - TASK-016
 *
 * Administrative endpoints for system management.
 * AC-2.4: Archival can be triggered manually via admin endpoint
 * AC-3.11: Recurring job can be triggered manually via admin endpoint
 * AC-3.4: Cache stats endpoint for monitoring (admin only)
 */

import { Elysia, t } from "elysia";
import { timingSafeEqual } from "crypto";
import { success, error, ErrorCodes } from "../lib/responses";
import { logger } from "../lib/logger";
import {
  archiveOldActivityLogs,
  getArchivalStats,
  getArchivalCandidateCount,
} from "../services/archival.service";
import { generateDueExpenses } from "../services/recurring.service";
import { getCacheService } from "../services/cache.service";

// ============================================================================
// Admin API Key Authentication
// ============================================================================

const ADMIN_API_KEY = process.env.ADMIN_API_KEY;

/**
 * Simple API key check for admin endpoints
 * In production, you might want a more sophisticated auth mechanism
 */
function validateAdminKey(apiKey: string | null): boolean {
  if (!ADMIN_API_KEY || !apiKey) {
    if (!ADMIN_API_KEY) {
      logger.warn("ADMIN_API_KEY is not configured - admin endpoints are disabled");
    }
    return false;
  }
  // Use constant-time comparison to prevent timing attacks
  const keyBuffer = Buffer.from(apiKey);
  const secretBuffer = Buffer.from(ADMIN_API_KEY);
  if (keyBuffer.length !== secretBuffer.length) {
    return false;
  }
  return timingSafeEqual(keyBuffer, secretBuffer);
}

// ============================================================================
// Admin Routes
// ============================================================================

export const adminRoutes = new Elysia({ prefix: "/admin" })
  // Middleware to check admin API key
  .derive(({ request, set }) => {
    const apiKey = request.headers.get("x-admin-key");
    const isAdmin = validateAdminKey(apiKey);

    if (!isAdmin) {
      set.status = 403;
    }

    return { isAdmin };
  })

  // ========================================================================
  // POST /admin/archive-activity - Trigger Activity Log Archival
  // AC-2.4: Archival can be triggered manually via admin endpoint
  // ========================================================================
  .post(
    "/archive-activity",
    async ({ isAdmin, body, set }) => {
      if (!isAdmin) {
        return error(ErrorCodes.FORBIDDEN, "Admin access required");
      }

      const result = await archiveOldActivityLogs({
        retentionDays: body.retentionDays,
        dryRun: body.dryRun,
      });

      if (!result.success) {
        set.status = 500;
        return error(ErrorCodes.INTERNAL_ERROR, result.error || "Archival failed");
      }

      return success({
        message: body.dryRun ? "Dry run completed" : "Archival completed",
        ...result,
      });
    },
    {
      body: t.Object({
        retentionDays: t.Optional(t.Number({ minimum: 1 })),
        dryRun: t.Optional(t.Boolean()),
      }),
      detail: {
        summary: "Archive old activity logs",
        description:
          "Manually trigger archival of activity logs older than the retention period. Requires admin API key.",
        tags: ["Admin"],
      },
    }
  )

  // ========================================================================
  // GET /admin/archive-stats - Get Archival Statistics
  // ========================================================================
  .get(
    "/archive-stats",
    async ({ isAdmin, set }) => {
      if (!isAdmin) {
        set.status = 403;
        return error(ErrorCodes.FORBIDDEN, "Admin access required");
      }

      const stats = await getArchivalStats();

      return success(stats);
    },
    {
      detail: {
        summary: "Get archival statistics",
        description:
          "Returns statistics about activity log archival including active records, archived records, and retention settings.",
        tags: ["Admin"],
      },
    }
  )

  // ========================================================================
  // GET /admin/archive-preview - Preview Archival Candidates
  // ========================================================================
  .get(
    "/archive-preview",
    async ({ isAdmin, query, set }) => {
      if (!isAdmin) {
        set.status = 403;
        return error(ErrorCodes.FORBIDDEN, "Admin access required");
      }

      const retentionDays = query.retentionDays
        ? parseInt(query.retentionDays, 10)
        : undefined;

      const count = await getArchivalCandidateCount(retentionDays);

      return success({
        candidateCount: count,
        retentionDays: retentionDays || parseInt(process.env.ARCHIVAL_RETENTION_DAYS || "90", 10),
      });
    },
    {
      query: t.Object({
        retentionDays: t.Optional(t.String()),
      }),
      detail: {
        summary: "Preview archival candidates",
        description:
          "Returns the count of activity logs that would be archived with the given retention period.",
        tags: ["Admin"],
      },
    }
  )

  // ========================================================================
  // POST /admin/generate-recurring - Generate Due Recurring Expenses
  // Sprint 007 - AC-3.11: Job can be triggered manually via admin endpoint
  // ========================================================================
  .post(
    "/generate-recurring",
    async ({ isAdmin, set }) => {
      if (!isAdmin) {
        set.status = 403;
        return error(ErrorCodes.FORBIDDEN, "Admin access required");
      }

      const result = await generateDueExpenses();

      return success({
        message: "Recurring expense generation completed",
        processed: result.processed,
        generated: result.generated,
        skipped: result.skipped,
        errors: result.errors,
      });
    },
    {
      detail: {
        summary: "Generate due recurring expenses",
        description:
          "Manually trigger generation of all due recurring expenses. This processes all active recurring rules that have passed their next occurrence date.",
        tags: ["Admin"],
      },
    }
  )

  // ========================================================================
  // GET /admin/cache/stats - Get Cache Statistics
  // Sprint 008 - AC-3.4: Cache stats endpoint for monitoring (admin only)
  // ========================================================================
  .get(
    "/cache/stats",
    async ({ isAdmin, set }) => {
      if (!isAdmin) {
        set.status = 403;
        return error(ErrorCodes.FORBIDDEN, "Admin access required");
      }

      const cache = getCacheService();
      const stats = cache.getStats();

      return success({
        stats: {
          hits: stats.hits,
          misses: stats.misses,
          sets: stats.sets,
          invalidations: stats.invalidations,
          size: stats.size,
          hitRate: stats.hitRate,
          memoryUsageBytes: stats.memoryUsageBytes,
          memoryUsageMB: Math.round((stats.memoryUsageBytes / 1024 / 1024) * 100) / 100,
        },
        keys: stats.keys,
      });
    },
    {
      detail: {
        summary: "Get cache statistics",
        description:
          "Returns cache statistics including hit/miss counts, size, and memory usage. Requires admin API key.",
        tags: ["Admin"],
      },
    }
  )

  // ========================================================================
  // POST /admin/cache/clear - Clear All Cache
  // Sprint 008 - AC-3.3: Cache invalidation
  // ========================================================================
  .post(
    "/cache/clear",
    async ({ isAdmin, set }) => {
      if (!isAdmin) {
        set.status = 403;
        return error(ErrorCodes.FORBIDDEN, "Admin access required");
      }

      const cache = getCacheService();
      const previousSize = cache.getStats().size;
      cache.clear();

      return success({
        message: "Cache cleared",
        clearedEntries: previousSize,
      });
    },
    {
      detail: {
        summary: "Clear all cache entries",
        description:
          "Clears all entries from the in-memory cache. Requires admin API key.",
        tags: ["Admin"],
      },
    }
  )

  // ========================================================================
  // DELETE /admin/cache/invalidate/:prefix - Invalidate Cache by Prefix
  // Sprint 008 - AC-3.3: Cache invalidation
  // ========================================================================
  .delete(
    "/cache/invalidate/:prefix",
    async ({ isAdmin, params, set }) => {
      if (!isAdmin) {
        set.status = 403;
        return error(ErrorCodes.FORBIDDEN, "Admin access required");
      }

      const cache = getCacheService();
      const count = cache.invalidatePrefix(params.prefix);

      return success({
        message: `Invalidated ${count} cache entries`,
        prefix: params.prefix,
        invalidatedCount: count,
      });
    },
    {
      params: t.Object({
        prefix: t.String(),
      }),
      detail: {
        summary: "Invalidate cache entries by prefix",
        description:
          "Invalidates all cache entries matching the given prefix. Useful for clearing group-specific cache. Requires admin API key.",
        tags: ["Admin"],
      },
    }
  );
