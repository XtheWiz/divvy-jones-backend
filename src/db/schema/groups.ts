import {
  pgTable,
  uuid,
  text,
  boolean,
  timestamp,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { users } from "./users";
import { currencies } from "./currencies";
import { groupIcon, colorName, membershipRole, membershipStatus } from "./enums";

// ============================================================================
// GROUPS
// ============================================================================

export const groups = pgTable(
  "groups",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ownerUserId: uuid("owner_user_id")
      .notNull()
      .references(() => users.id),
    name: text("name").notNull(),
    label: text("label"),
    icon: text("icon")
      .references(() => groupIcon.value)
      .default("other"),
    color: text("color")
      .references(() => colorName.value)
      .default("blue"),
    defaultCurrencyCode: text("default_currency_code")
      .notNull()
      .references(() => currencies.code)
      .default("USD"),
    regionCode: text("region_code"),
    joinCode: text("join_code").unique(),
    qrToken: text("qr_token").unique(),
    expiresAt: timestamp("expires_at", { withTimezone: true }), // for join code expiry
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    idx_groups_owner: index("idx_groups_owner")
      .on(table.ownerUserId)
      .where(sql`deleted_at IS NULL`),
    idx_groups_join_code: index("idx_groups_join_code")
      .on(table.joinCode)
      .where(sql`join_code IS NOT NULL AND deleted_at IS NULL`),
    idx_groups_qr_token: index("idx_groups_qr_token")
      .on(table.qrToken)
      .where(sql`qr_token IS NOT NULL AND deleted_at IS NULL`),
  })
);

// ============================================================================
// GROUP CURRENCIES
// ============================================================================

export const groupCurrencies = pgTable(
  "group_currencies",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    groupId: uuid("group_id")
      .notNull()
      .references(() => groups.id, { onDelete: "cascade" }),
    currencyCode: text("currency_code")
      .notNull()
      .references(() => currencies.code),
  },
  (table) => ({
    group_currencies_unique: uniqueIndex("group_currencies_unique").on(table.groupId, table.currencyCode),
  })
);

// ============================================================================
// GROUP MEMBERS
// ============================================================================

export const groupMembers = pgTable(
  "group_members",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    groupId: uuid("group_id")
      .notNull()
      .references(() => groups.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id),
    role: text("role")
      .notNull()
      .references(() => membershipRole.value)
      .default("member"),
    status: text("status")
      .notNull()
      .references(() => membershipStatus.value)
      .default("active"),
    isGuest: boolean("is_guest").notNull().default(false),
    originMemberId: uuid("origin_member_id"), // self-reference, added in relations
    joinedAt: timestamp("joined_at", { withTimezone: true }).notNull().defaultNow(),
    leftAt: timestamp("left_at", { withTimezone: true }),
  },
  (table) => ({
    group_members_unique: uniqueIndex("group_members_unique").on(table.groupId, table.userId),
    idx_group_members_group_id: index("idx_group_members_group_id")
      .on(table.groupId)
      .where(sql`left_at IS NULL`),
    idx_group_members_user_id: index("idx_group_members_user_id")
      .on(table.userId)
      .where(sql`left_at IS NULL`),
  })
);

// ============================================================================
// LEAVE REQUESTS
// ============================================================================

export const leaveRequests = pgTable(
  "leave_requests",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    groupId: uuid("group_id")
      .notNull()
      .references(() => groups.id, { onDelete: "cascade" }),
    memberId: uuid("member_id")
      .notNull()
      .references(() => groupMembers.id),
    reason: text("reason"),
    hasUnsettled: boolean("has_unsettled").notNull().default(false),
    approvedByMemberId: uuid("approved_by_member_id").references(() => groupMembers.id),
    approvedAt: timestamp("approved_at", { withTimezone: true }),
    status: text("status").notNull().default("pending"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    idx_leave_requests_group_id: index("idx_leave_requests_group_id").on(table.groupId),
    idx_leave_requests_member_id: index("idx_leave_requests_member_id").on(table.memberId),
    idx_leave_requests_status: index("idx_leave_requests_status")
      .on(table.status)
      .where(sql`status = 'pending'`),
  })
);

// ============================================================================
// GROUP INVITES
// ============================================================================

export const groupInvites = pgTable(
  "group_invites",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    groupId: uuid("group_id")
      .notNull()
      .references(() => groups.id, { onDelete: "cascade" }),
    issuedByMemberId: uuid("issued_by_member_id")
      .notNull()
      .references(() => groupMembers.id),
    method: text("method").notNull(), // 'link', 'qr', 'email', 'sms'
    codeSnapshot: text("code_snapshot"),
    qrTokenSnapshot: text("qr_token_snapshot"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    usedByUserId: uuid("used_by_user_id").references(() => users.id),
    usedAt: timestamp("used_at", { withTimezone: true }),
  },
  (table) => ({
    idx_group_invites_group_id: index("idx_group_invites_group_id").on(table.groupId),
    idx_group_invites_issued_by: index("idx_group_invites_issued_by").on(table.issuedByMemberId),
  })
);

// ============================================================================
// Types
// ============================================================================

export type Group = typeof groups.$inferSelect;
export type NewGroup = typeof groups.$inferInsert;

export type GroupCurrency = typeof groupCurrencies.$inferSelect;
export type NewGroupCurrency = typeof groupCurrencies.$inferInsert;

export type GroupMember = typeof groupMembers.$inferSelect;
export type NewGroupMember = typeof groupMembers.$inferInsert;

export type LeaveRequest = typeof leaveRequests.$inferSelect;
export type NewLeaveRequest = typeof leaveRequests.$inferInsert;

export type GroupInvite = typeof groupInvites.$inferSelect;
export type NewGroupInvite = typeof groupInvites.$inferInsert;
