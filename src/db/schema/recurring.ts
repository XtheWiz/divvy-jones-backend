/**
 * Recurring Expenses Schema
 * Sprint 007 - TASK-012
 *
 * AC-3.1: Recurring expense table stores rule configuration
 * AC-3.2: Supports frequency types: daily, weekly, biweekly, monthly, yearly
 * AC-3.3: Tracks next occurrence date and last generated date
 */

import {
  pgTable,
  uuid,
  text,
  boolean,
  numeric,
  timestamp,
  integer,
  index,
} from "drizzle-orm/pg-core";
import { groups, groupMembers } from "./groups";
import { currencies } from "./currencies";
import { recurringFrequency, expenseCategory, shareMode } from "./enums";

// ============================================================================
// RECURRING EXPENSES
// AC-3.1: Table stores rule configuration
// ============================================================================

export const recurringExpenses = pgTable(
  "recurring_expenses",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    groupId: uuid("group_id")
      .notNull()
      .references(() => groups.id, { onDelete: "cascade" }),
    createdByMemberId: uuid("created_by_member_id")
      .notNull()
      .references(() => groupMembers.id),

    // Expense template
    name: text("name").notNull(),
    description: text("description"),
    category: text("category").references(() => expenseCategory.value),
    amount: numeric("amount", { precision: 20, scale: 4 }).notNull(),
    currencyCode: text("currency_code")
      .notNull()
      .references(() => currencies.code),

    // AC-3.2: Frequency configuration
    frequency: text("frequency")
      .notNull()
      .references(() => recurringFrequency.value),
    dayOfWeek: integer("day_of_week"), // 0-6 for weekly/biweekly (0=Sunday)
    dayOfMonth: integer("day_of_month"), // 1-31 for monthly
    monthOfYear: integer("month_of_year"), // 1-12 for yearly

    // Split configuration (for generated expenses)
    splitMode: text("split_mode")
      .notNull()
      .references(() => shareMode.value)
      .default("equal"),

    // AC-3.3: Occurrence tracking
    startDate: timestamp("start_date", { withTimezone: true }).notNull(),
    endDate: timestamp("end_date", { withTimezone: true }), // null = indefinite
    nextOccurrence: timestamp("next_occurrence", { withTimezone: true }).notNull(),
    lastGeneratedAt: timestamp("last_generated_at", { withTimezone: true }),

    // Status
    isActive: boolean("is_active").notNull().default(true),

    // Timestamps
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    idx_recurring_group_id: index("idx_recurring_group_id").on(table.groupId),
    idx_recurring_next_occurrence: index("idx_recurring_next_occurrence").on(
      table.nextOccurrence
    ),
    idx_recurring_active: index("idx_recurring_active").on(table.isActive),
  })
);

// ============================================================================
// RECURRING EXPENSE PAYERS
// Stores who will pay for the generated expenses
// ============================================================================

export const recurringExpensePayers = pgTable(
  "recurring_expense_payers",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    recurringExpenseId: uuid("recurring_expense_id")
      .notNull()
      .references(() => recurringExpenses.id, { onDelete: "cascade" }),
    memberId: uuid("member_id")
      .notNull()
      .references(() => groupMembers.id),
    amount: numeric("amount", { precision: 20, scale: 4 }).notNull(),
  },
  (table) => ({
    idx_recurring_payers_expense: index("idx_recurring_payers_expense").on(
      table.recurringExpenseId
    ),
  })
);

// ============================================================================
// RECURRING EXPENSE SPLITS
// Stores how the expense should be split among members
// ============================================================================

export const recurringExpenseSplits = pgTable(
  "recurring_expense_splits",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    recurringExpenseId: uuid("recurring_expense_id")
      .notNull()
      .references(() => recurringExpenses.id, { onDelete: "cascade" }),
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
  (table) => ({
    idx_recurring_splits_expense: index("idx_recurring_splits_expense").on(
      table.recurringExpenseId
    ),
  })
);
