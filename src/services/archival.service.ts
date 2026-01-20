/**
 * Archival Service
 * Sprint 006 - TASK-011
 *
 * Handles archiving of old activity logs to maintain database performance.
 *
 * AC-2.3: Archival job moves logs older than 90 days to archive table
 * AC-2.4: Archival can be triggered manually via admin endpoint
 * AC-2.5: Archival job can run on a schedule (cron-compatible)
 */

import { db, activityLog, activityLogArchive } from "../db";
import { lt, sql } from "drizzle-orm";

// ============================================================================
// Configuration
// ============================================================================

/**
 * Default retention period in days
 * Configurable via ARCHIVAL_RETENTION_DAYS environment variable
 */
const DEFAULT_RETENTION_DAYS = 90;

/**
 * Batch size for archival operations to avoid long-running transactions
 */
const BATCH_SIZE = 1000;

// ============================================================================
// Types
// ============================================================================

export interface ArchivalResult {
  success: boolean;
  archivedCount: number;
  deletedCount: number;
  batchesProcessed: number;
  durationMs: number;
  error?: string;
}

export interface ArchivalOptions {
  retentionDays?: number;
  batchSize?: number;
  dryRun?: boolean;
}

// ============================================================================
// Archival Service Functions
// ============================================================================

/**
 * Get the configured retention period in days
 */
export function getRetentionDays(): number {
  const envValue = process.env.ARCHIVAL_RETENTION_DAYS;
  if (envValue) {
    const parsed = parseInt(envValue, 10);
    if (!isNaN(parsed) && parsed > 0) {
      return parsed;
    }
  }
  return DEFAULT_RETENTION_DAYS;
}

/**
 * Calculate the cutoff date for archival
 */
export function getArchivalCutoffDate(retentionDays: number = getRetentionDays()): Date {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - retentionDays);
  return cutoff;
}

/**
 * Archive old activity logs
 * AC-2.3: Moves logs older than retention period to archive table
 *
 * This operation:
 * 1. Selects records older than the cutoff date
 * 2. Inserts them into the archive table
 * 3. Deletes them from the source table
 * Uses batching to avoid long-running transactions
 */
export async function archiveOldActivityLogs(
  options: ArchivalOptions = {}
): Promise<ArchivalResult> {
  const startTime = Date.now();
  const retentionDays = options.retentionDays ?? getRetentionDays();
  const batchSize = options.batchSize ?? BATCH_SIZE;
  const dryRun = options.dryRun ?? false;

  const cutoffDate = getArchivalCutoffDate(retentionDays);

  let totalArchived = 0;
  let totalDeleted = 0;
  let batchesProcessed = 0;

  try {
    // Process in batches
    let hasMore = true;
    while (hasMore) {
      // Find records to archive
      const recordsToArchive = await db
        .select()
        .from(activityLog)
        .where(lt(activityLog.createdAt, cutoffDate))
        .limit(batchSize);

      if (recordsToArchive.length === 0) {
        hasMore = false;
        continue;
      }

      if (dryRun) {
        // Dry run - just count
        totalArchived += recordsToArchive.length;
        totalDeleted += recordsToArchive.length;
        batchesProcessed++;
        hasMore = recordsToArchive.length === batchSize;
        continue;
      }

      // Use a transaction for atomicity
      await db.transaction(async (tx) => {
        // Insert into archive table
        const archiveRecords = recordsToArchive.map((record) => ({
          id: record.id,
          groupId: record.groupId,
          actorMemberId: record.actorMemberId,
          action: record.action,
          entityType: record.entityType,
          entityId: record.entityId,
          oldValues: record.oldValues,
          newValues: record.newValues,
          ipAddress: record.ipAddress,
          userAgent: record.userAgent,
          createdAt: record.createdAt,
          // archivedAt will be set by defaultNow()
        }));

        await tx.insert(activityLogArchive).values(archiveRecords);
        totalArchived += archiveRecords.length;

        // Delete from source table
        const idsToDelete = recordsToArchive.map((r) => r.id);
        await tx
          .delete(activityLog)
          .where(
            sql`${activityLog.id} IN (${sql.join(
              idsToDelete.map((id) => sql`${id}`),
              sql`, `
            )})`
          );
        totalDeleted += idsToDelete.length;
      });

      batchesProcessed++;
      hasMore = recordsToArchive.length === batchSize;
    }

    const durationMs = Date.now() - startTime;

    return {
      success: true,
      archivedCount: totalArchived,
      deletedCount: totalDeleted,
      batchesProcessed,
      durationMs,
    };
  } catch (error) {
    const durationMs = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : String(error);

    console.error("Archival failed:", errorMessage);

    return {
      success: false,
      archivedCount: totalArchived,
      deletedCount: totalDeleted,
      batchesProcessed,
      durationMs,
      error: errorMessage,
    };
  }
}

/**
 * Get count of records eligible for archival
 */
export async function getArchivalCandidateCount(
  retentionDays: number = getRetentionDays()
): Promise<number> {
  const cutoffDate = getArchivalCutoffDate(retentionDays);

  const [result] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(activityLog)
    .where(lt(activityLog.createdAt, cutoffDate));

  return result?.count ?? 0;
}

/**
 * Get archival statistics
 */
export async function getArchivalStats(): Promise<{
  activeRecords: number;
  archivedRecords: number;
  eligibleForArchival: number;
  retentionDays: number;
  cutoffDate: Date;
}> {
  const retentionDays = getRetentionDays();
  const cutoffDate = getArchivalCutoffDate(retentionDays);

  const [activeResult] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(activityLog);

  const [archivedResult] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(activityLogArchive);

  const eligibleForArchival = await getArchivalCandidateCount(retentionDays);

  return {
    activeRecords: activeResult?.count ?? 0,
    archivedRecords: archivedResult?.count ?? 0,
    eligibleForArchival,
    retentionDays,
    cutoffDate,
  };
}

// ============================================================================
// Cron Job Support
// AC-2.5: Archival job can run on a schedule (cron-compatible)
// ============================================================================

let archivalJob: ReturnType<typeof setInterval> | null = null;

/**
 * Start the archival scheduler
 * Uses setInterval as a simple alternative to node-cron
 * Can be replaced with node-cron if more complex scheduling is needed
 */
export function startArchivalScheduler(
  intervalMs: number = 24 * 60 * 60 * 1000 // Default: daily
): void {
  if (archivalJob) {
    console.warn("Archival scheduler is already running");
    return;
  }

  console.log(`Starting archival scheduler (interval: ${intervalMs}ms)`);

  archivalJob = setInterval(async () => {
    console.log("Running scheduled archival job...");
    const result = await archiveOldActivityLogs();
    console.log("Archival job completed:", result);
  }, intervalMs);

  // Run immediately on start
  archiveOldActivityLogs().then((result) => {
    console.log("Initial archival completed:", result);
  });
}

/**
 * Stop the archival scheduler
 */
export function stopArchivalScheduler(): void {
  if (archivalJob) {
    clearInterval(archivalJob);
    archivalJob = null;
    console.log("Archival scheduler stopped");
  }
}

/**
 * Check if the archival scheduler is running
 */
export function isArchivalSchedulerRunning(): boolean {
  return archivalJob !== null;
}
