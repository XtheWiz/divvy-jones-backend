/**
 * Activity Service
 * Sprint 004 - TASK-011
 *
 * Handles activity logging and retrieval for group audit trails.
 */

import { eq, and, desc, count, gte, lte, sql, or } from "drizzle-orm";
import {
  db,
  activityLog,
  activityLogArchive,
  groupMembers,
  users,
  type ActivityLog,
  type NewActivityLog,
  ACTIVITY_ACTIONS,
} from "../db";

// ============================================================================
// Types
// ============================================================================

export type ActivityAction = (typeof ACTIVITY_ACTIONS)[number];

export type EntityType =
  | "expense"
  | "settlement"
  | "member"
  | "group"
  | "attachment";

export interface LogActivityParams {
  groupId: string;
  actorMemberId: string | null;
  action: ActivityAction;
  entityType: EntityType;
  entityId: string;
  oldValues?: Record<string, unknown>;
  newValues?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
}

export interface ActivityWithActor {
  id: string;
  groupId: string;
  actorMemberId: string | null;
  action: string;
  entityType: string;
  entityId: string;
  oldValues: unknown;
  newValues: unknown;
  createdAt: Date;
  actor: {
    id: string;
    displayName: string;
  } | null;
}

export interface ListActivityParams {
  groupId: string;
  limit?: number;
  offset?: number;
  entityType?: EntityType;
  from?: Date;
  to?: Date;
  includeArchived?: boolean; // AC-2.6: Include archived activity logs
}

export interface ListActivityResult {
  activities: ActivityWithActor[];
  total: number;
  limit: number;
  offset: number;
}

// ============================================================================
// Activity Logging
// ============================================================================

/**
 * Log an activity to the activity log
 * AC-2.1 through AC-2.9: Record activity for various actions
 */
export async function logActivity(params: LogActivityParams): Promise<void> {
  const {
    groupId,
    actorMemberId,
    action,
    entityType,
    entityId,
    oldValues,
    newValues,
    ipAddress,
    userAgent,
  } = params;

  try {
    await db.insert(activityLog).values({
      groupId,
      actorMemberId,
      action,
      entityType,
      entityId,
      oldValues: oldValues || null,
      newValues: newValues || null,
      ipAddress: ipAddress || null,
      userAgent: userAgent || null,
    });
  } catch (err) {
    // Log error but don't throw - activity logging shouldn't break main operations
    console.error("Failed to log activity:", err);
  }
}

// ============================================================================
// Activity Retrieval
// ============================================================================

/**
 * List activity for a group with pagination and filtering
 * AC-2.10: GET /groups/:groupId/activity
 * AC-2.11: Paginated (default 20, max 100)
 * AC-2.12: Sorted by timestamp descending
 * AC-2.14: Filter by type
 * AC-2.15: Filter by date range
 * AC-2.6: Include archived activity logs when includeArchived=true
 */
export async function listActivity(
  params: ListActivityParams
): Promise<ListActivityResult> {
  const { groupId, limit = 20, offset = 0, entityType, from, to, includeArchived = false } = params;

  // Enforce max limit
  const effectiveLimit = Math.min(limit, 100);

  // Build conditions for active logs
  const conditions = [eq(activityLog.groupId, groupId)];

  if (entityType) {
    conditions.push(eq(activityLog.entityType, entityType));
  }

  if (from) {
    conditions.push(gte(activityLog.createdAt, from));
  }

  if (to) {
    conditions.push(lte(activityLog.createdAt, to));
  }

  // Get total count (including archived if requested)
  let total = 0;

  const [activeCountResult] = await db
    .select({ count: count() })
    .from(activityLog)
    .where(and(...conditions));

  total = activeCountResult?.count || 0;

  if (includeArchived) {
    // Build archive conditions
    const archiveConditions = [eq(activityLogArchive.groupId, groupId)];

    if (entityType) {
      archiveConditions.push(eq(activityLogArchive.entityType, entityType));
    }

    if (from) {
      archiveConditions.push(gte(activityLogArchive.createdAt, from));
    }

    if (to) {
      archiveConditions.push(lte(activityLogArchive.createdAt, to));
    }

    const [archivedCountResult] = await db
      .select({ count: count() })
      .from(activityLogArchive)
      .where(and(...archiveConditions));

    total += archivedCountResult?.count || 0;
  }

  // Get activities with actor info
  const activeResults = await db
    .select({
      id: activityLog.id,
      groupId: activityLog.groupId,
      actorMemberId: activityLog.actorMemberId,
      action: activityLog.action,
      entityType: activityLog.entityType,
      entityId: activityLog.entityId,
      oldValues: activityLog.oldValues,
      newValues: activityLog.newValues,
      createdAt: activityLog.createdAt,
      actorUserId: users.id,
      actorDisplayName: users.displayName,
      isArchived: sql<boolean>`false`.as("is_archived"),
    })
    .from(activityLog)
    .leftJoin(groupMembers, eq(groupMembers.id, activityLog.actorMemberId))
    .leftJoin(users, eq(users.id, groupMembers.userId))
    .where(and(...conditions))
    .orderBy(desc(activityLog.createdAt))
    .limit(effectiveLimit)
    .offset(offset);

  let allResults = [...activeResults];

  // Include archived records if requested
  // AC-2.6: GET /groups/:groupId/activity supports `includeArchived` query param
  if (includeArchived) {
    const archiveConditions = [eq(activityLogArchive.groupId, groupId)];

    if (entityType) {
      archiveConditions.push(eq(activityLogArchive.entityType, entityType));
    }

    if (from) {
      archiveConditions.push(gte(activityLogArchive.createdAt, from));
    }

    if (to) {
      archiveConditions.push(lte(activityLogArchive.createdAt, to));
    }

    const archivedResults = await db
      .select({
        id: activityLogArchive.id,
        groupId: activityLogArchive.groupId,
        actorMemberId: activityLogArchive.actorMemberId,
        action: activityLogArchive.action,
        entityType: activityLogArchive.entityType,
        entityId: activityLogArchive.entityId,
        oldValues: activityLogArchive.oldValues,
        newValues: activityLogArchive.newValues,
        createdAt: activityLogArchive.createdAt,
        actorUserId: sql<string | null>`null`.as("actor_user_id"),
        actorDisplayName: sql<string | null>`null`.as("actor_display_name"),
        isArchived: sql<boolean>`true`.as("is_archived"),
      })
      .from(activityLogArchive)
      .where(and(...archiveConditions))
      .orderBy(desc(activityLogArchive.createdAt))
      .limit(effectiveLimit)
      .offset(offset);

    // Merge and sort by createdAt descending
    allResults = [...activeResults, ...archivedResults]
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .slice(0, effectiveLimit);
  }

  const activities: ActivityWithActor[] = allResults.map((r) => ({
    id: r.id,
    groupId: r.groupId,
    actorMemberId: r.actorMemberId,
    action: r.action,
    entityType: r.entityType,
    entityId: r.entityId,
    oldValues: r.oldValues,
    newValues: r.newValues,
    createdAt: r.createdAt,
    actor: r.actorUserId
      ? {
          id: r.actorUserId,
          displayName: r.actorDisplayName || "Unknown",
        }
      : null,
  }));

  return {
    activities,
    total,
    limit: effectiveLimit,
    offset,
  };
}

// ============================================================================
// Activity Summary Formatting
// ============================================================================

/**
 * Generate human-readable summary for an activity
 * AC-2.13: Each activity shows: actor, action type, target, timestamp
 */
export function formatActivitySummary(activity: ActivityWithActor): string {
  const actorName = activity.actor?.displayName || "System";
  const action = activity.action;
  const entityType = activity.entityType;

  // Map actions to past tense verbs
  const actionVerbs: Record<string, string> = {
    create: "created",
    update: "updated",
    delete: "deleted",
    restore: "restored",
    join: "joined",
    leave: "left",
    invite: "invited",
    remove: "removed",
    approve: "approved",
    reject: "rejected",
    settle: "settled",
    confirm: "confirmed",
    cancel: "cancelled",
  };

  const verb = actionVerbs[action] || action;

  // Map entity types to readable names
  const entityNames: Record<string, string> = {
    expense: "an expense",
    settlement: "a settlement",
    member: "the group",
    group: "the group",
    attachment: "an attachment",
  };

  const entity = entityNames[entityType] || entityType;

  return actorName + " " + verb + " " + entity;
}

// ============================================================================
// Helper Functions for Integration
// ============================================================================

/**
 * Log expense creation activity
 */
export async function logExpenseCreated(
  groupId: string,
  actorMemberId: string,
  expenseId: string,
  expenseData: Record<string, unknown>
): Promise<void> {
  await logActivity({
    groupId,
    actorMemberId,
    action: "create",
    entityType: "expense",
    entityId: expenseId,
    newValues: expenseData,
  });
}

/**
 * Log expense update activity
 */
export async function logExpenseUpdated(
  groupId: string,
  actorMemberId: string,
  expenseId: string,
  oldData: Record<string, unknown>,
  newData: Record<string, unknown>
): Promise<void> {
  await logActivity({
    groupId,
    actorMemberId,
    action: "update",
    entityType: "expense",
    entityId: expenseId,
    oldValues: oldData,
    newValues: newData,
  });
}

/**
 * Log expense deletion activity
 */
export async function logExpenseDeleted(
  groupId: string,
  actorMemberId: string,
  expenseId: string,
  expenseData: Record<string, unknown>
): Promise<void> {
  await logActivity({
    groupId,
    actorMemberId,
    action: "delete",
    entityType: "expense",
    entityId: expenseId,
    oldValues: expenseData,
  });
}

/**
 * Log settlement creation activity
 */
export async function logSettlementCreated(
  groupId: string,
  actorMemberId: string,
  settlementId: string,
  settlementData: Record<string, unknown>
): Promise<void> {
  await logActivity({
    groupId,
    actorMemberId,
    action: "create",
    entityType: "settlement",
    entityId: settlementId,
    newValues: settlementData,
  });
}

/**
 * Log settlement confirmation activity
 */
export async function logSettlementConfirmed(
  groupId: string,
  actorMemberId: string,
  settlementId: string
): Promise<void> {
  await logActivity({
    groupId,
    actorMemberId,
    action: "confirm",
    entityType: "settlement",
    entityId: settlementId,
  });
}

/**
 * Log settlement rejection activity
 */
export async function logSettlementRejected(
  groupId: string,
  actorMemberId: string,
  settlementId: string
): Promise<void> {
  await logActivity({
    groupId,
    actorMemberId,
    action: "reject",
    entityType: "settlement",
    entityId: settlementId,
  });
}

/**
 * Log settlement cancellation activity
 */
export async function logSettlementCancelled(
  groupId: string,
  actorMemberId: string,
  settlementId: string
): Promise<void> {
  await logActivity({
    groupId,
    actorMemberId,
    action: "cancel",
    entityType: "settlement",
    entityId: settlementId,
  });
}

/**
 * Log member join activity
 */
export async function logMemberJoined(
  groupId: string,
  memberId: string,
  userId: string
): Promise<void> {
  await logActivity({
    groupId,
    actorMemberId: memberId,
    action: "join",
    entityType: "member",
    entityId: userId,
  });
}

/**
 * Log member leave activity
 */
export async function logMemberLeft(
  groupId: string,
  memberId: string,
  userId: string
): Promise<void> {
  await logActivity({
    groupId,
    actorMemberId: memberId,
    action: "leave",
    entityType: "member",
    entityId: userId,
  });
}

/**
 * Log attachment added activity
 */
export async function logAttachmentAdded(
  groupId: string,
  actorMemberId: string,
  attachmentId: string,
  targetType: "expense" | "settlement",
  targetId: string
): Promise<void> {
  await logActivity({
    groupId,
    actorMemberId,
    action: "create",
    entityType: "attachment",
    entityId: attachmentId,
    newValues: { targetType, targetId },
  });
}
