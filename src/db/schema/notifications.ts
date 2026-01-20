import {
  pgTable,
  uuid,
  text,
  boolean,
  timestamp,
  jsonb,
  index,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { users } from "./users";
import { groups, groupMembers } from "./groups";
import { notificationType, activityAction } from "./enums";

// ============================================================================
// NOTIFICATIONS
// ============================================================================

export const notifications = pgTable(
  "notifications",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: text("type")
      .notNull()
      .references(() => notificationType.value),
    title: text("title").notNull(),
    body: text("body"),
    data: jsonb("data"), // additional payload
    referenceId: uuid("reference_id"), // generic FK to related entity
    referenceType: text("reference_type"), // 'expense', 'settlement', 'group', etc.
    isRead: boolean("is_read").notNull().default(false),
    readAt: timestamp("read_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    idx_notifications_user_id: index("idx_notifications_user_id").on(table.userId),
    idx_notifications_unread: index("idx_notifications_unread")
      .on(table.userId, table.createdAt)
      .where(sql`is_read = FALSE`),
    idx_notifications_created_at: index("idx_notifications_created_at").on(table.createdAt),
  })
);

// ============================================================================
// ACTIVITY LOG (Audit Trail)
// ============================================================================

export const activityLog = pgTable(
  "activity_log",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    groupId: uuid("group_id")
      .notNull()
      .references(() => groups.id, { onDelete: "cascade" }),
    actorMemberId: uuid("actor_member_id").references(() => groupMembers.id), // nullable for system actions
    action: text("action")
      .notNull()
      .references(() => activityAction.value),
    entityType: text("entity_type").notNull(), // 'expense', 'settlement', 'member', etc.
    entityId: uuid("entity_id").notNull(),
    oldValues: jsonb("old_values"), // previous state
    newValues: jsonb("new_values"), // new state
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    idx_activity_log_group_id: index("idx_activity_log_group_id").on(table.groupId),
    idx_activity_log_actor: index("idx_activity_log_actor")
      .on(table.actorMemberId)
      .where(sql`actor_member_id IS NOT NULL`),
    idx_activity_log_entity: index("idx_activity_log_entity").on(table.entityType, table.entityId),
    idx_activity_log_created_at: index("idx_activity_log_created_at").on(table.createdAt),
  })
);

// ============================================================================
// ACTIVITY LOG ARCHIVE
// Sprint 006 - TASK-010
// AC-2.1: Archive table mirrors activity_logs structure
// AC-2.2: Archived records include original timestamps and metadata
// ============================================================================

export const activityLogArchive = pgTable(
  "activity_log_archive",
  {
    id: uuid("id").primaryKey(), // Keep original ID (no defaultRandom)
    groupId: uuid("group_id").notNull(), // No FK constraint for independence
    actorMemberId: uuid("actor_member_id"),
    action: text("action").notNull(),
    entityType: text("entity_type").notNull(),
    entityId: uuid("entity_id").notNull(),
    oldValues: jsonb("old_values"),
    newValues: jsonb("new_values"),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull(), // Original timestamp
    archivedAt: timestamp("archived_at", { withTimezone: true }).notNull().defaultNow(), // When archived
  },
  (table) => ({
    // Index for querying archived data
    idx_activity_log_archive_group_id: index("idx_activity_log_archive_group_id").on(table.groupId),
    idx_activity_log_archive_created_at: index("idx_activity_log_archive_created_at").on(table.createdAt),
    idx_activity_log_archive_archived_at: index("idx_activity_log_archive_archived_at").on(table.archivedAt),
  })
);

// ============================================================================
// Types
// ============================================================================

export type Notification = typeof notifications.$inferSelect;
export type NewNotification = typeof notifications.$inferInsert;

export type ActivityLog = typeof activityLog.$inferSelect;
export type NewActivityLog = typeof activityLog.$inferInsert;

export type ActivityLogArchive = typeof activityLogArchive.$inferSelect;
export type NewActivityLogArchive = typeof activityLogArchive.$inferInsert;
