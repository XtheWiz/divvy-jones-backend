import { pgTable, text } from "drizzle-orm/pg-core";

// ============================================================================
// LOOKUP TABLES (Enums)
// Using lookup tables instead of native enums for runtime flexibility
// ============================================================================

export const authProviderType = pgTable("auth_provider_type", {
  value: text("value").primaryKey(),
});

export const membershipRole = pgTable("membership_role", {
  value: text("value").primaryKey(),
});

export const membershipStatus = pgTable("membership_status", {
  value: text("value").primaryKey(),
});

export const groupIcon = pgTable("group_icon", {
  value: text("value").primaryKey(),
});

export const colorName = pgTable("color_name", {
  value: text("value").primaryKey(),
});

export const discountMode = pgTable("discount_mode", {
  value: text("value").primaryKey(),
});

export const shareMode = pgTable("share_mode", {
  value: text("value").primaryKey(),
});

export const settlementStatus = pgTable("settlement_status", {
  value: text("value").primaryKey(),
});

export const evidenceTarget = pgTable("evidence_target", {
  value: text("value").primaryKey(),
});

export const leaveRequestStatus = pgTable("leave_request_status", {
  value: text("value").primaryKey(),
});

export const notificationType = pgTable("notification_type", {
  value: text("value").primaryKey(),
});

export const activityAction = pgTable("activity_action", {
  value: text("value").primaryKey(),
});

export const expenseCategory = pgTable("expense_category", {
  value: text("value").primaryKey(),
});

// Sprint 007 - Recurring Expenses
export const recurringFrequency = pgTable("recurring_frequency", {
  value: text("value").primaryKey(),
});

// ============================================================================
// Type Constants (for application use)
// ============================================================================

export const AUTH_PROVIDERS = ["email", "password", "google", "apple", "facebook", "line"] as const;
export type AuthProvider = (typeof AUTH_PROVIDERS)[number];

export const MEMBERSHIP_ROLES = ["owner", "admin", "member", "viewer"] as const;
export type MembershipRole = (typeof MEMBERSHIP_ROLES)[number];

export const MEMBERSHIP_STATUSES = ["active", "inactive", "pending", "banned"] as const;
export type MembershipStatus = (typeof MEMBERSHIP_STATUSES)[number];

export const GROUP_ICONS = [
  "home", "work", "travel", "food", "shopping", "entertainment",
  "transport", "utilities", "health", "education", "gift", "other",
] as const;
export type GroupIcon = (typeof GROUP_ICONS)[number];

export const COLOR_NAMES = [
  "red", "orange", "yellow", "green", "teal", "blue",
  "indigo", "purple", "pink", "gray",
] as const;
export type ColorName = (typeof COLOR_NAMES)[number];

export const DISCOUNT_MODES = ["percent", "fixed"] as const;
export type DiscountMode = (typeof DISCOUNT_MODES)[number];

export const SHARE_MODES = ["equal", "weight", "exact", "percent"] as const;
export type ShareMode = (typeof SHARE_MODES)[number];

export const SETTLEMENT_STATUSES = ["pending", "confirmed", "rejected", "cancelled"] as const;
export type SettlementStatus = (typeof SETTLEMENT_STATUSES)[number];

export const EVIDENCE_TARGETS = ["expense", "settlement"] as const;
export type EvidenceTarget = (typeof EVIDENCE_TARGETS)[number];

export const LEAVE_REQUEST_STATUSES = ["pending", "approved", "rejected", "cancelled"] as const;
export type LeaveRequestStatus = (typeof LEAVE_REQUEST_STATUSES)[number];

export const NOTIFICATION_TYPES = [
  "expense_created", "expense_updated", "expense_deleted",
  "settlement_requested", "settlement_confirmed", "settlement_rejected",
  "member_joined", "member_left", "member_removed",
  "group_invite", "leave_request", "reminder",
] as const;
export type NotificationType = (typeof NOTIFICATION_TYPES)[number];

export const ACTIVITY_ACTIONS = [
  "create", "update", "delete", "restore",
  "join", "leave", "invite", "remove", "approve", "reject",
  "settle", "confirm", "cancel",
] as const;
export type ActivityAction = (typeof ACTIVITY_ACTIONS)[number];

export const EXPENSE_CATEGORIES = [
  "food", "transport", "accommodation", "entertainment",
  "shopping", "utilities", "health", "travel", "groceries", "other",
] as const;
export type ExpenseCategory = (typeof EXPENSE_CATEGORIES)[number];

// Sprint 007 - AC-3.2: Supports frequency types
export const RECURRING_FREQUENCIES = [
  "daily", "weekly", "biweekly", "monthly", "yearly",
] as const;
export type RecurringFrequency = (typeof RECURRING_FREQUENCIES)[number];
