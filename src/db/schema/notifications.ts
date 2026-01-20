import {
  pgTable,
  uuid,
  text,
  boolean,
  timestamp,
  jsonb,
  index,
} from "drizzle-orm/pg-core";
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
  (table) => [
    index("idx_notifications_user_id").on(table.userId),
    index("idx_notifications_unread")
      .on(table.userId, table.createdAt)
      .where("is_read = FALSE"),
    index("idx_notifications_created_at").on(table.createdAt),
  ]
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
  (table) => [
    index("idx_activity_log_group_id").on(table.groupId),
    index("idx_activity_log_actor")
      .on(table.actorMemberId)
      .where("actor_member_id IS NOT NULL"),
    index("idx_activity_log_entity").on(table.entityType, table.entityId),
    index("idx_activity_log_created_at").on(table.createdAt),
  ]
);

// ============================================================================
// Types
// ============================================================================

export type Notification = typeof notifications.$inferSelect;
export type NewNotification = typeof notifications.$inferInsert;

export type ActivityLog = typeof activityLog.$inferSelect;
export type NewActivityLog = typeof activityLog.$inferInsert;
