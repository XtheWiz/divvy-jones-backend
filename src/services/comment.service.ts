/**
 * Comment Service
 * Sprint 008 - TASK-005
 *
 * Business logic for expense comments.
 * AC-1.4: POST creates a new comment
 * AC-1.5: GET lists all comments (paginated)
 * AC-1.6: PUT updates comment
 * AC-1.7: DELETE soft-deletes comment
 * AC-1.8: Only comment author can edit/delete their own comments
 */

import { eq, and, isNull, desc, count, asc } from "drizzle-orm";
import {
  db,
  expenseComments,
  groupMembers,
  users,
  expenses,
  type ExpenseComment,
} from "../db";

// ============================================================================
// Constants
// ============================================================================

export const MAX_COMMENT_LENGTH = 2000;

// ============================================================================
// Types
// ============================================================================

export interface CreateCommentInput {
  expenseId: string;
  groupId: string;
  authorMemberId: string;
  content: string;
}

export interface UpdateCommentInput {
  content: string;
}

export interface CommentListFilters {
  page?: number;
  limit?: number;
}

export interface CommentWithAuthor {
  id: string;
  content: string;
  createdAt: Date;
  updatedAt: Date;
  author: {
    memberId: string;
    userId: string;
    displayName: string;
  };
}

// ============================================================================
// Validation Functions
// ============================================================================

/**
 * Validate comment content
 * Must be 1-2000 characters
 */
export function validateCommentContent(content: string): { valid: boolean; error?: string } {
  const trimmed = content.trim();

  if (trimmed.length === 0) {
    return { valid: false, error: "Comment cannot be empty" };
  }

  if (trimmed.length > MAX_COMMENT_LENGTH) {
    return { valid: false, error: `Comment cannot exceed ${MAX_COMMENT_LENGTH} characters` };
  }

  return { valid: true };
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
        isNull(expenses.deletedAt)
      )
    )
    .limit(1);

  return !!expense;
}

/**
 * Check if user is a member of the group (AC-1.8: authorization)
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
        isNull(groupMembers.leftAt)
      )
    )
    .limit(1);

  return member?.id || null;
}

// ============================================================================
// Comment CRUD Functions
// ============================================================================

/**
 * Create a new comment on an expense
 * AC-1.4: POST creates a new comment
 */
export async function createComment(
  input: CreateCommentInput
): Promise<{ comment: ExpenseComment } | { error: string }> {
  // Validate content
  const validation = validateCommentContent(input.content);
  if (!validation.valid) {
    return { error: validation.error! };
  }

  // Create comment
  const [comment] = await db
    .insert(expenseComments)
    .values({
      expenseId: input.expenseId,
      groupId: input.groupId,
      authorMemberId: input.authorMemberId,
      content: input.content.trim(),
    })
    .returning();

  return { comment };
}

/**
 * List comments for an expense with pagination
 * AC-1.5: GET lists all comments (paginated)
 */
export async function listComments(
  expenseId: string,
  groupId: string,
  filters: CommentListFilters = {}
): Promise<{ comments: CommentWithAuthor[]; total: number }> {
  const page = filters.page || 1;
  const limit = Math.min(filters.limit || 20, 100);
  const offset = (page - 1) * limit;

  // Base conditions - only active comments for this expense in this group
  const conditions = [
    eq(expenseComments.expenseId, expenseId),
    eq(expenseComments.groupId, groupId),
    isNull(expenseComments.deletedAt),
  ];

  // Get total count
  const [countResult] = await db
    .select({ count: count() })
    .from(expenseComments)
    .where(and(...conditions));

  const total = countResult?.count || 0;

  // Get comments with author info
  const commentsData = await db
    .select({
      id: expenseComments.id,
      content: expenseComments.content,
      createdAt: expenseComments.createdAt,
      updatedAt: expenseComments.updatedAt,
      memberId: groupMembers.id,
      userId: groupMembers.userId,
      displayName: users.displayName,
    })
    .from(expenseComments)
    .innerJoin(groupMembers, eq(expenseComments.authorMemberId, groupMembers.id))
    .innerJoin(users, eq(groupMembers.userId, users.id))
    .where(and(...conditions))
    .orderBy(asc(expenseComments.createdAt)) // Oldest first for conversation flow
    .limit(limit)
    .offset(offset);

  const comments: CommentWithAuthor[] = commentsData.map((c) => ({
    id: c.id,
    content: c.content,
    createdAt: c.createdAt,
    updatedAt: c.updatedAt,
    author: {
      memberId: c.memberId,
      userId: c.userId,
      displayName: c.displayName,
    },
  }));

  return { comments, total };
}

/**
 * Get a single comment by ID
 */
export async function getCommentById(
  commentId: string,
  groupId: string
): Promise<ExpenseComment | null> {
  const [comment] = await db
    .select()
    .from(expenseComments)
    .where(
      and(
        eq(expenseComments.id, commentId),
        eq(expenseComments.groupId, groupId),
        isNull(expenseComments.deletedAt)
      )
    )
    .limit(1);

  return comment || null;
}

/**
 * Check if user is the author of a comment
 * AC-1.8: Only comment author can edit/delete their own comments
 */
export async function isCommentAuthor(
  commentId: string,
  memberId: string
): Promise<boolean> {
  const [comment] = await db
    .select({ authorMemberId: expenseComments.authorMemberId })
    .from(expenseComments)
    .where(
      and(
        eq(expenseComments.id, commentId),
        isNull(expenseComments.deletedAt)
      )
    )
    .limit(1);

  return comment?.authorMemberId === memberId;
}

/**
 * Update a comment
 * AC-1.6: PUT updates comment
 */
export async function updateComment(
  commentId: string,
  groupId: string,
  input: UpdateCommentInput
): Promise<{ comment: ExpenseComment } | { error: string }> {
  // Validate content
  const validation = validateCommentContent(input.content);
  if (!validation.valid) {
    return { error: validation.error! };
  }

  const [comment] = await db
    .update(expenseComments)
    .set({
      content: input.content.trim(),
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(expenseComments.id, commentId),
        eq(expenseComments.groupId, groupId),
        isNull(expenseComments.deletedAt)
      )
    )
    .returning();

  if (!comment) {
    return { error: "Comment not found" };
  }

  return { comment };
}

/**
 * Soft delete a comment
 * AC-1.7: DELETE soft-deletes comment
 */
export async function deleteComment(
  commentId: string,
  groupId: string
): Promise<{ success: boolean; error?: string }> {
  const [deleted] = await db
    .update(expenseComments)
    .set({ deletedAt: new Date() })
    .where(
      and(
        eq(expenseComments.id, commentId),
        eq(expenseComments.groupId, groupId),
        isNull(expenseComments.deletedAt)
      )
    )
    .returning();

  if (!deleted) {
    return { success: false, error: "Comment not found" };
  }

  return { success: true };
}

/**
 * Get comment with author details (for notifications)
 */
export async function getCommentWithAuthor(
  commentId: string
): Promise<CommentWithAuthor | null> {
  const [data] = await db
    .select({
      id: expenseComments.id,
      content: expenseComments.content,
      createdAt: expenseComments.createdAt,
      updatedAt: expenseComments.updatedAt,
      memberId: groupMembers.id,
      userId: groupMembers.userId,
      displayName: users.displayName,
    })
    .from(expenseComments)
    .innerJoin(groupMembers, eq(expenseComments.authorMemberId, groupMembers.id))
    .innerJoin(users, eq(groupMembers.userId, users.id))
    .where(
      and(
        eq(expenseComments.id, commentId),
        isNull(expenseComments.deletedAt)
      )
    )
    .limit(1);

  if (!data) {
    return null;
  }

  return {
    id: data.id,
    content: data.content,
    createdAt: data.createdAt,
    updatedAt: data.updatedAt,
    author: {
      memberId: data.memberId,
      userId: data.userId,
      displayName: data.displayName,
    },
  };
}

/**
 * Get expense participants (payers and split participants) for notification
 * Used in TASK-007 for comment notifications
 */
export async function getExpenseParticipantUserIds(
  expenseId: string
): Promise<string[]> {
  // Import here to avoid circular dependency
  const { expensePayers, expenseItems, expenseItemMembers } = await import("../db");

  // Get payers
  const payers = await db
    .select({ userId: groupMembers.userId })
    .from(expensePayers)
    .innerJoin(groupMembers, eq(expensePayers.memberId, groupMembers.id))
    .where(eq(expensePayers.expenseId, expenseId));

  // Get split participants
  const items = await db
    .select({ id: expenseItems.id })
    .from(expenseItems)
    .where(eq(expenseItems.expenseId, expenseId));

  const itemIds = items.map((i) => i.id);

  let splitParticipants: { userId: string }[] = [];
  if (itemIds.length > 0) {
    const { inArray } = await import("drizzle-orm");
    splitParticipants = await db
      .select({ userId: groupMembers.userId })
      .from(expenseItemMembers)
      .innerJoin(groupMembers, eq(expenseItemMembers.memberId, groupMembers.id))
      .where(inArray(expenseItemMembers.itemId, itemIds));
  }

  // Combine and deduplicate
  const userIds = new Set([
    ...payers.map((p) => p.userId),
    ...splitParticipants.map((s) => s.userId),
  ]);

  return Array.from(userIds);
}
