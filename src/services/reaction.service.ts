/**
 * Reaction Service
 * Sprint 008 - TASK-010
 *
 * Business logic for reactions on expenses and settlements.
 * AC-2.3: POST adds or toggles a reaction
 * AC-2.4: DELETE removes a reaction
 * AC-2.5: GET includes reaction counts and current user's reactions
 * AC-2.6: Settlement endpoints also support reactions
 * AC-2.7: Support reaction types: thumbsUp, thumbsDown, heart, laugh, surprised, angry
 * AC-2.8: Reaction type is validated against allowed enum values
 */

import { eq, and, count, sql } from "drizzle-orm";
import {
  db,
  reactions,
  groupMembers,
  users,
  expenses,
  settlements,
  type Reaction,
  REACTION_TYPES,
  type ReactionType,
  REACTION_ENTITY_TYPES,
  type ReactionEntityType,
} from "../db";

// ============================================================================
// Re-export constants
// ============================================================================

export { REACTION_TYPES, REACTION_ENTITY_TYPES };
export type { ReactionType, ReactionEntityType };

// ============================================================================
// Types
// ============================================================================

export interface ReactionCounts {
  thumbsUp: number;
  thumbsDown: number;
  heart: number;
  laugh: number;
  surprised: number;
  angry: number;
  total: number;
}

export interface ReactionSummary {
  counts: ReactionCounts;
  userReactions: ReactionType[];
}

export interface ReactionWithUser {
  id: string;
  reactionType: ReactionType;
  createdAt: Date;
  user: {
    memberId: string;
    userId: string;
    displayName: string;
  };
}

// ============================================================================
// Validation Functions
// ============================================================================

/**
 * Validate reaction type
 * AC-2.8: Reaction type is validated against allowed enum values
 */
export function validateReactionType(reactionType: string): reactionType is ReactionType {
  return REACTION_TYPES.includes(reactionType as ReactionType);
}

/**
 * Validate entity type
 */
export function validateEntityType(entityType: string): entityType is ReactionEntityType {
  return REACTION_ENTITY_TYPES.includes(entityType as ReactionEntityType);
}

/**
 * Check if expense exists and belongs to group
 */
export async function expenseExistsInGroup(
  expenseId: string,
  groupId: string
): Promise<boolean> {
  const [expense] = await db
    .select({ id: expenses.id })
    .from(expenses)
    .where(
      and(
        eq(expenses.id, expenseId),
        eq(expenses.groupId, groupId),
        sql`${expenses.deletedAt} IS NULL`
      )
    )
    .limit(1);

  return !!expense;
}

/**
 * Check if settlement exists and belongs to group
 */
export async function settlementExistsInGroup(
  settlementId: string,
  groupId: string
): Promise<boolean> {
  const [settlement] = await db
    .select({ id: settlements.id })
    .from(settlements)
    .where(
      and(
        eq(settlements.id, settlementId),
        eq(settlements.groupId, groupId)
      )
    )
    .limit(1);

  return !!settlement;
}

/**
 * Check if user is a member of the group
 */
export async function getMemberIdForUser(
  userId: string,
  groupId: string
): Promise<string | null> {
  const [member] = await db
    .select({ id: groupMembers.id })
    .from(groupMembers)
    .where(
      and(
        eq(groupMembers.userId, userId),
        eq(groupMembers.groupId, groupId),
        sql`${groupMembers.leftAt} IS NULL`
      )
    )
    .limit(1);

  return member?.id || null;
}

// ============================================================================
// Reaction CRUD Functions
// ============================================================================

/**
 * Add a reaction
 * Returns the created reaction or null if it already exists
 */
export async function addReaction(
  entityType: ReactionEntityType,
  entityId: string,
  groupId: string,
  memberId: string,
  reactionType: ReactionType
): Promise<{ reaction: Reaction } | { error: string }> {
  // Check if reaction already exists
  const [existing] = await db
    .select({ id: reactions.id })
    .from(reactions)
    .where(
      and(
        eq(reactions.entityType, entityType),
        eq(reactions.entityId, entityId),
        eq(reactions.memberId, memberId),
        eq(reactions.reactionType, reactionType)
      )
    )
    .limit(1);

  if (existing) {
    return { error: "Reaction already exists" };
  }

  const [reaction] = await db
    .insert(reactions)
    .values({
      entityType,
      entityId,
      groupId,
      memberId,
      reactionType,
    })
    .returning();

  return { reaction };
}

/**
 * Remove a reaction
 * AC-2.4: DELETE removes a reaction
 */
export async function removeReaction(
  entityType: ReactionEntityType,
  entityId: string,
  memberId: string,
  reactionType: ReactionType
): Promise<{ success: boolean; error?: string }> {
  const result = await db
    .delete(reactions)
    .where(
      and(
        eq(reactions.entityType, entityType),
        eq(reactions.entityId, entityId),
        eq(reactions.memberId, memberId),
        eq(reactions.reactionType, reactionType)
      )
    )
    .returning({ id: reactions.id });

  if (result.length === 0) {
    return { success: false, error: "Reaction not found" };
  }

  return { success: true };
}

/**
 * Toggle a reaction (add if not exists, remove if exists)
 * AC-2.3: POST adds or toggles a reaction
 */
export async function toggleReaction(
  entityType: ReactionEntityType,
  entityId: string,
  groupId: string,
  memberId: string,
  reactionType: ReactionType
): Promise<{ added: boolean; reaction?: Reaction }> {
  // Check if reaction exists
  const [existing] = await db
    .select()
    .from(reactions)
    .where(
      and(
        eq(reactions.entityType, entityType),
        eq(reactions.entityId, entityId),
        eq(reactions.memberId, memberId),
        eq(reactions.reactionType, reactionType)
      )
    )
    .limit(1);

  if (existing) {
    // Remove the reaction
    await db
      .delete(reactions)
      .where(eq(reactions.id, existing.id));

    return { added: false };
  } else {
    // Add the reaction
    const [reaction] = await db
      .insert(reactions)
      .values({
        entityType,
        entityId,
        groupId,
        memberId,
        reactionType,
      })
      .returning();

    return { added: true, reaction };
  }
}

/**
 * Get reaction counts for an entity
 * AC-2.5: GET includes reaction counts
 */
export async function getReactionCounts(
  entityType: ReactionEntityType,
  entityId: string
): Promise<ReactionCounts> {
  const results = await db
    .select({
      reactionType: reactions.reactionType,
      count: count(),
    })
    .from(reactions)
    .where(
      and(
        eq(reactions.entityType, entityType),
        eq(reactions.entityId, entityId)
      )
    )
    .groupBy(reactions.reactionType);

  // Initialize counts with zeros
  const counts: ReactionCounts = {
    thumbsUp: 0,
    thumbsDown: 0,
    heart: 0,
    laugh: 0,
    surprised: 0,
    angry: 0,
    total: 0,
  };

  // Fill in the actual counts
  for (const row of results) {
    const type = row.reactionType as ReactionType;
    if (type in counts) {
      counts[type] = row.count;
      counts.total += row.count;
    }
  }

  return counts;
}

/**
 * Get user's reactions for an entity
 * AC-2.5: GET includes current user's reactions
 */
export async function getUserReactions(
  entityType: ReactionEntityType,
  entityId: string,
  memberId: string
): Promise<ReactionType[]> {
  const results = await db
    .select({ reactionType: reactions.reactionType })
    .from(reactions)
    .where(
      and(
        eq(reactions.entityType, entityType),
        eq(reactions.entityId, entityId),
        eq(reactions.memberId, memberId)
      )
    );

  return results.map((r) => r.reactionType as ReactionType);
}

/**
 * Get full reaction summary for an entity
 * AC-2.5: GET includes reaction counts and current user's reactions
 */
export async function getReactionSummary(
  entityType: ReactionEntityType,
  entityId: string,
  memberId?: string
): Promise<ReactionSummary> {
  const counts = await getReactionCounts(entityType, entityId);
  const userReactions = memberId
    ? await getUserReactions(entityType, entityId, memberId)
    : [];

  return { counts, userReactions };
}

/**
 * Get all reactions for an entity with user details
 * Used for showing who reacted
 */
export async function getReactionsWithUsers(
  entityType: ReactionEntityType,
  entityId: string
): Promise<ReactionWithUser[]> {
  const results = await db
    .select({
      id: reactions.id,
      reactionType: reactions.reactionType,
      createdAt: reactions.createdAt,
      memberId: groupMembers.id,
      userId: groupMembers.userId,
      displayName: users.displayName,
    })
    .from(reactions)
    .innerJoin(groupMembers, eq(reactions.memberId, groupMembers.id))
    .innerJoin(users, eq(groupMembers.userId, users.id))
    .where(
      and(
        eq(reactions.entityType, entityType),
        eq(reactions.entityId, entityId)
      )
    )
    .orderBy(reactions.createdAt);

  return results.map((r) => ({
    id: r.id,
    reactionType: r.reactionType as ReactionType,
    createdAt: r.createdAt,
    user: {
      memberId: r.memberId,
      userId: r.userId,
      displayName: r.displayName,
    },
  }));
}

/**
 * Get reactions grouped by type with users
 * Useful for UI display (e.g., "John, Jane, and 3 others")
 */
export async function getReactionsGroupedByType(
  entityType: ReactionEntityType,
  entityId: string
): Promise<Record<ReactionType, ReactionWithUser[]>> {
  const allReactions = await getReactionsWithUsers(entityType, entityId);

  const grouped: Record<ReactionType, ReactionWithUser[]> = {
    thumbsUp: [],
    thumbsDown: [],
    heart: [],
    laugh: [],
    surprised: [],
    angry: [],
  };

  for (const reaction of allReactions) {
    grouped[reaction.reactionType].push(reaction);
  }

  return grouped;
}
