/**
 * Reactions Schema
 * Sprint 008 - TASK-009
 *
 * Reactions for expenses and settlements.
 * AC-2.1: Reaction table stores entityType (expense/settlement), entityId, userId, reactionType
 * AC-2.2: Unique constraint prevents duplicate reactions (same user, same entity, same type)
 * AC-2.7: Support reaction types: thumbsUp, thumbsDown, heart, laugh, surprised, angry
 * AC-2.8: Reaction type is validated against allowed enum values
 */

import {
  pgTable,
  uuid,
  text,
  timestamp,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { groups, groupMembers } from "./groups";

// ============================================================================
// REACTION TYPES
// ============================================================================

// AC-2.7: Support reaction types
export const REACTION_TYPES = [
  "thumbsUp",
  "thumbsDown",
  "heart",
  "laugh",
  "surprised",
  "angry",
] as const;

export type ReactionType = (typeof REACTION_TYPES)[number];

// AC-2.1: Entity types that can have reactions
export const REACTION_ENTITY_TYPES = ["expense", "settlement"] as const;
export type ReactionEntityType = (typeof REACTION_ENTITY_TYPES)[number];

// ============================================================================
// REACTIONS TABLE
// ============================================================================

export const reactions = pgTable(
  "reactions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    // AC-2.1: Polymorphic reference to expense or settlement
    entityType: text("entity_type").notNull(), // 'expense' or 'settlement'
    entityId: uuid("entity_id").notNull(),
    // Group reference for cascade delete and authorization
    groupId: uuid("group_id")
      .notNull()
      .references(() => groups.id, { onDelete: "cascade" }),
    // Who reacted
    memberId: uuid("member_id")
      .notNull()
      .references(() => groupMembers.id),
    // AC-2.7: Reaction type
    reactionType: text("reaction_type").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    // AC-2.2: Unique constraint - one reaction per user per entity per type
    reactions_unique: uniqueIndex("reactions_unique").on(
      table.entityType,
      table.entityId,
      table.memberId,
      table.reactionType
    ),
    // Index for fetching reactions by entity
    idx_reactions_entity: index("idx_reactions_entity").on(
      table.entityType,
      table.entityId
    ),
    // Index for fetching reactions by member
    idx_reactions_member: index("idx_reactions_member").on(table.memberId),
    // Index for fetching reactions by group
    idx_reactions_group: index("idx_reactions_group").on(table.groupId),
  })
);

// ============================================================================
// Types
// ============================================================================

export type Reaction = typeof reactions.$inferSelect;
export type NewReaction = typeof reactions.$inferInsert;
