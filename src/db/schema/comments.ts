/**
 * Comments Schema
 * Sprint 008 - TASK-004
 *
 * Expense comments for group discussion and clarification.
 * AC-1.1: Comment table stores expense comments with author, text, and timestamps
 * AC-1.2: Comments support soft delete (deletedAt column)
 * AC-1.3: Comments are linked to expenses via expenseId foreign key
 */

import {
  pgTable,
  uuid,
  text,
  timestamp,
  index,
  check,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { groups, groupMembers } from "./groups";
import { expenses } from "./expenses";

// ============================================================================
// EXPENSE COMMENTS
// ============================================================================

export const expenseComments = pgTable(
  "expense_comments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    expenseId: uuid("expense_id")
      .notNull()
      .references(() => expenses.id, { onDelete: "cascade" }),
    groupId: uuid("group_id")
      .notNull()
      .references(() => groups.id, { onDelete: "cascade" }),
    authorMemberId: uuid("author_member_id")
      .notNull()
      .references(() => groupMembers.id),
    content: text("content").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }), // soft delete (AC-1.2)
  },
  (table) => ({
    // Index for fetching comments by expense (most common query)
    idx_comments_expense: index("idx_comments_expense")
      .on(table.expenseId)
      .where(sql`deleted_at IS NULL`),
    // Index for fetching comments by author
    idx_comments_author: index("idx_comments_author").on(table.authorMemberId),
    // Index for fetching all comments in a group
    idx_comments_group: index("idx_comments_group")
      .on(table.groupId)
      .where(sql`deleted_at IS NULL`),
    // Constraint: content length <= 2000 characters
    comment_content_length: check(
      "comment_content_length",
      sql`char_length(${table.content}) <= 2000`
    ),
  })
);

// ============================================================================
// Types
// ============================================================================

export type ExpenseComment = typeof expenseComments.$inferSelect;
export type NewExpenseComment = typeof expenseComments.$inferInsert;
