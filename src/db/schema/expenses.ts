import {
  pgTable,
  uuid,
  text,
  boolean,
  numeric,
  timestamp,
  index,
  uniqueIndex,
  check,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { groups, groupMembers } from "./groups";
import { currencies } from "./currencies";
import { groupIcon, colorName, discountMode, shareMode } from "./enums";

// ============================================================================
// EXPENSES
// ============================================================================

export const expenses = pgTable(
  "expenses",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    groupId: uuid("group_id")
      .notNull()
      .references(() => groups.id, { onDelete: "cascade" }),
    createdByMemberId: uuid("created_by_member_id")
      .notNull()
      .references(() => groupMembers.id),
    name: text("name").notNull(),
    label: text("label"),
    icon: text("icon")
      .references(() => groupIcon.value)
      .default("other"),
    color: text("color").references(() => colorName.value),
    latitude: numeric("latitude", { precision: 10, scale: 7 }),
    longitude: numeric("longitude", { precision: 10, scale: 7 }),
    currencyCode: text("currency_code")
      .notNull()
      .references(() => currencies.code),
    subtotal: numeric("subtotal", { precision: 20, scale: 4 }).notNull(),
    serviceChargePct: numeric("service_charge_pct", { precision: 5, scale: 2 }).default("0"),
    vatPct: numeric("vat_pct", { precision: 5, scale: 2 }).default("0"),
    extraDiscountValue: numeric("extra_discount_value", { precision: 20, scale: 4 }).default("0"),
    extraDiscountMode: text("extra_discount_mode").references(() => discountMode.value),
    expenseDate: timestamp("expense_date", { withTimezone: true }).notNull().defaultNow(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }), // soft delete
  },
  (table) => [
    index("idx_expenses_group_id")
      .on(table.groupId)
      .where("deleted_at IS NULL"),
    index("idx_expenses_created_by").on(table.createdByMemberId),
    index("idx_expenses_date")
      .on(table.expenseDate)
      .where("deleted_at IS NULL"),
  ]
);

// ============================================================================
// EXPENSE ITEMS
// ============================================================================

export const expenseItems = pgTable(
  "expense_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    expenseId: uuid("expense_id")
      .notNull()
      .references(() => expenses.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    quantity: numeric("quantity", { precision: 10, scale: 3 }).notNull().default("1"),
    unitValue: numeric("unit_value", { precision: 20, scale: 4 }).notNull(),
    currencyCode: text("currency_code")
      .notNull()
      .references(() => currencies.code),
    applyServiceCharge: boolean("apply_service_charge").notNull().default(true),
    applyVat: boolean("apply_vat").notNull().default(true),
    applyExtraDiscount: boolean("apply_extra_discount").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("idx_expense_items_expense_id").on(table.expenseId),
  ]
);

// ============================================================================
// EXPENSE ITEM MEMBERS (who owes what)
// ============================================================================

export const expenseItemMembers = pgTable(
  "expense_item_members",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    itemId: uuid("item_id")
      .notNull()
      .references(() => expenseItems.id, { onDelete: "cascade" }),
    memberId: uuid("member_id")
      .notNull()
      .references(() => groupMembers.id),
    shareMode: text("share_mode")
      .notNull()
      .references(() => shareMode.value)
      .default("equal"),
    weight: numeric("weight", { precision: 10, scale: 4 }).default("1"),
    exactAmount: numeric("exact_amount", { precision: 20, scale: 4 }),
  },
  (table) => [
    uniqueIndex("expense_item_members_unique").on(table.itemId, table.memberId),
    index("idx_expense_item_members_item_id").on(table.itemId),
    index("idx_expense_item_members_member_id").on(table.memberId),
  ]
);

// ============================================================================
// EXPENSE PAYERS (who paid)
// ============================================================================

export const expensePayers = pgTable(
  "expense_payers",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    expenseId: uuid("expense_id")
      .notNull()
      .references(() => expenses.id, { onDelete: "cascade" }),
    memberId: uuid("member_id")
      .notNull()
      .references(() => groupMembers.id),
    amount: numeric("amount", { precision: 20, scale: 4 }).notNull(),
    currencyCode: text("currency_code")
      .notNull()
      .references(() => currencies.code),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("expense_payers_unique").on(table.expenseId, table.memberId),
    index("idx_expense_payers_expense_id").on(table.expenseId),
    index("idx_expense_payers_member_id").on(table.memberId),
    check("expense_payers_positive_amount", sql`${table.amount} > 0`),
  ]
);

// ============================================================================
// OCR RECEIPTS
// ============================================================================

export const ocrReceipts = pgTable(
  "ocr_receipts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    expenseId: uuid("expense_id")
      .notNull()
      .references(() => expenses.id, { onDelete: "cascade" }),
    source: text("source").notNull(), // 'camera', 'gallery', 'file'
    rawText: text("raw_text"),
    parsedJson: text("parsed_json"), // stored as JSONB in postgres
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("idx_ocr_receipts_expense_id").on(table.expenseId),
  ]
);

// ============================================================================
// Types
// ============================================================================

export type Expense = typeof expenses.$inferSelect;
export type NewExpense = typeof expenses.$inferInsert;

export type ExpenseItem = typeof expenseItems.$inferSelect;
export type NewExpenseItem = typeof expenseItems.$inferInsert;

export type ExpenseItemMember = typeof expenseItemMembers.$inferSelect;
export type NewExpenseItemMember = typeof expenseItemMembers.$inferInsert;

export type ExpensePayer = typeof expensePayers.$inferSelect;
export type NewExpensePayer = typeof expensePayers.$inferInsert;

export type OcrReceipt = typeof ocrReceipts.$inferSelect;
export type NewOcrReceipt = typeof ocrReceipts.$inferInsert;
