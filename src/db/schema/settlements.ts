import {
  pgTable,
  uuid,
  text,
  boolean,
  numeric,
  integer,
  timestamp,
  index,
  check,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { users } from "./users";
import { groups, groupMembers } from "./groups";
import { expenses } from "./expenses";
import { currencies } from "./currencies";
import { settlementStatus, evidenceTarget } from "./enums";

// ============================================================================
// SETTLEMENTS
// ============================================================================

export const settlements = pgTable(
  "settlements",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    groupId: uuid("group_id")
      .notNull()
      .references(() => groups.id, { onDelete: "cascade" }),
    payerMemberId: uuid("payer_member_id")
      .notNull()
      .references(() => groupMembers.id),
    payeeMemberId: uuid("payee_member_id")
      .notNull()
      .references(() => groupMembers.id),
    amount: numeric("amount", { precision: 20, scale: 4 }).notNull(),
    currencyCode: text("currency_code")
      .notNull()
      .references(() => currencies.code),
    byItems: boolean("by_items").notNull().default(false),
    status: text("status")
      .notNull()
      .references(() => settlementStatus.value)
      .default("pending"),
    note: text("note"), // AC-1.8: Optional note/description
    settledAt: timestamp("settled_at", { withTimezone: true }), // AC-1.29: Confirmation timestamp
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    idx_settlements_group_id: index("idx_settlements_group_id").on(table.groupId),
    idx_settlements_payer: index("idx_settlements_payer").on(table.payerMemberId),
    idx_settlements_payee: index("idx_settlements_payee").on(table.payeeMemberId),
    idx_settlements_status: index("idx_settlements_status")
      .on(table.status)
      .where(sql`status = 'pending'`),
    // Sprint 008 - TASK-014: Optimized indexes for balance calculations
    // AC-3.5: Database indexes added for frequently filtered columns
    idx_settlements_group_status: index("idx_settlements_group_status")
      .on(table.groupId, table.status),
    idx_settlements_group_confirmed: index("idx_settlements_group_confirmed")
      .on(table.groupId)
      .where(sql`status = 'confirmed'`),
    settlements_different_members: check(
      "settlements_different_members",
      sql`${table.payerMemberId} <> ${table.payeeMemberId}`
    ),
    settlements_positive_amount: check("settlements_positive_amount", sql`${table.amount} > 0`),
  })
);

// ============================================================================
// EVIDENCES (File attachments)
// ============================================================================

export const evidences = pgTable(
  "evidences",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    target: text("target")
      .notNull()
      .references(() => evidenceTarget.value),
    expenseId: uuid("expense_id").references(() => expenses.id, { onDelete: "cascade" }),
    settlementId: uuid("settlement_id").references(() => settlements.id, { onDelete: "cascade" }),
    fileKey: text("file_key").notNull(), // S3/storage key
    mimeType: text("mime_type").notNull(),
    sizeBytes: integer("size_bytes").notNull(),
    createdByUserId: uuid("created_by_user_id")
      .notNull()
      .references(() => users.id),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    idx_evidences_expense_id: index("idx_evidences_expense_id")
      .on(table.expenseId)
      .where(sql`expense_id IS NOT NULL`),
    idx_evidences_settlement_id: index("idx_evidences_settlement_id")
      .on(table.settlementId)
      .where(sql`settlement_id IS NOT NULL`),
    // Ensure exactly one target is set
    evidences_single_target: check(
      "evidences_single_target",
      sql`(${table.target} = 'expense' AND ${table.expenseId} IS NOT NULL AND ${table.settlementId} IS NULL) OR (${table.target} = 'settlement' AND ${table.settlementId} IS NOT NULL AND ${table.expenseId} IS NULL)`
    ),
  })
);

// ============================================================================
// Types
// ============================================================================

export type Settlement = typeof settlements.$inferSelect;
export type NewSettlement = typeof settlements.$inferInsert;

export type Evidence = typeof evidences.$inferSelect;
export type NewEvidence = typeof evidences.$inferInsert;
