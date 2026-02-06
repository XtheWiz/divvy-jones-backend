/**
 * Comment Routes
 * Sprint 008 - TASK-006
 * Sprint 009 - Refactored to use group middleware (TASK-007)
 *
 * Routes for expense comments.
 * AC-1.4: POST /groups/:groupId/expenses/:expenseId/comments creates a new comment
 * AC-1.5: GET /groups/:groupId/expenses/:expenseId/comments lists all comments (paginated)
 * AC-1.6: PUT /groups/:groupId/expenses/:expenseId/comments/:commentId updates comment
 * AC-1.7: DELETE /groups/:groupId/expenses/:expenseId/comments/:commentId soft-deletes comment
 * AC-1.8: Only comment author can edit/delete their own comments
 *
 * Sprint 009 - AC-2.5: Routes refactored to use requireGroupMember middleware
 */

import { Elysia, t } from "elysia";
import { success, error, ErrorCodes, paginated } from "../lib/responses";
import { logger } from "../lib/logger";
import { requireGroupMember } from "../middleware/group";
import { findGroupById } from "../services/group.service";
import {
  createComment,
  listComments,
  getCommentById,
  updateComment,
  deleteComment,
  isCommentAuthor,
  expenseExistsInGroup,
  validateCommentContent,
  MAX_COMMENT_LENGTH,
  getCommentWithAuthor,
  getExpenseParticipantUserIds,
} from "../services/comment.service";
import { notifyCommentAdded } from "../services/notification.service";
import { getExpenseDetails } from "../services/expense.service";

// ============================================================================
// Request/Response Schemas
// ============================================================================

const commentParamsSchema = t.Object({
  groupId: t.String(),
  expenseId: t.String(),
});

const commentIdParamsSchema = t.Object({
  groupId: t.String(),
  expenseId: t.String(),
  commentId: t.String(),
});

const createCommentSchema = {
  body: t.Object({
    content: t.String({ minLength: 1, maxLength: MAX_COMMENT_LENGTH }),
  }),
  params: commentParamsSchema,
};

const updateCommentSchema = {
  body: t.Object({
    content: t.String({ minLength: 1, maxLength: MAX_COMMENT_LENGTH }),
  }),
  params: commentIdParamsSchema,
};

const listCommentsSchema = {
  params: commentParamsSchema,
  query: t.Object({
    page: t.Optional(t.Numeric()),
    limit: t.Optional(t.Numeric()),
  }),
};

// ============================================================================
// Comment Routes
// Sprint 009 - AC-2.5: Using requireGroupMember middleware
// ============================================================================

export const commentRoutes = new Elysia({ prefix: "/groups/:groupId/expenses/:expenseId/comments" })
  .use(requireGroupMember)

  // ========================================================================
  // POST /groups/:groupId/expenses/:expenseId/comments - Create Comment
  // AC-1.4: POST creates a new comment
  // Sprint 009: Group membership validated by middleware
  // ========================================================================
  .post(
    "/",
    async ({ params, body, auth, groupId, memberId, set }) => {
      const { expenseId } = params;

      // Check expense exists in this group (still needed - expense-specific validation)
      const expenseExists = await expenseExistsInGroup(expenseId, groupId!);
      if (!expenseExists) {
        set.status = 404;
        return error(ErrorCodes.NOT_FOUND, "Expense not found");
      }

      // Validate content
      const validation = validateCommentContent(body.content);
      if (!validation.valid) {
        set.status = 400;
        return error(ErrorCodes.VALIDATION_ERROR, validation.error!);
      }

      // Create comment (Sprint 009: memberId from middleware)
      const result = await createComment({
        expenseId,
        groupId: groupId!,
        authorMemberId: memberId!,
        content: body.content,
      });

      if ("error" in result) {
        set.status = 400;
        return error(ErrorCodes.VALIDATION_ERROR, result.error);
      }

      // AC-1.9, AC-1.10: Send notifications to expense participants
      // Do this asynchronously so we don't block the response
      setImmediate(async () => {
        try {
          // Get comment with author info
          const commentWithAuthor = await getCommentWithAuthor(result.comment.id);
          if (!commentWithAuthor) return;

          // Get expense details
          const expense = await getExpenseDetails(expenseId, groupId!);
          if (!expense) return;

          // Get expense participants
          const participantUserIds = await getExpenseParticipantUserIds(expenseId);

          // Get group name
          const grp = await findGroupById(groupId!);
          const groupName = grp?.name || "Unknown Group";

          // Notify each participant (except the author)
          for (const participantUserId of participantUserIds) {
            if (participantUserId !== auth!.userId) {
              await notifyCommentAdded(
                participantUserId,
                commentWithAuthor.author.displayName,
                expense.title,
                commentWithAuthor.content,
                expenseId,
                groupName
              );
            }
          }
        } catch (err) {
          logger.error("Error sending comment notifications", { error: String(err) });
        }
      });

      set.status = 201;
      return success({
        id: result.comment.id,
        content: result.comment.content,
        createdAt: result.comment.createdAt,
        updatedAt: result.comment.updatedAt,
      });
    },
    createCommentSchema
  )

  // ========================================================================
  // GET /groups/:groupId/expenses/:expenseId/comments - List Comments
  // AC-1.5: GET lists all comments (paginated)
  // Sprint 009: Group membership validated by middleware
  // ========================================================================
  .get(
    "/",
    async ({ params, query, groupId, set }) => {
      const { expenseId } = params;

      // Check expense exists in this group
      const expenseExists = await expenseExistsInGroup(expenseId, groupId!);
      if (!expenseExists) {
        set.status = 404;
        return error(ErrorCodes.NOT_FOUND, "Expense not found");
      }

      // Get paginated comments
      const page = query.page ? Number(query.page) : 1;
      const limit = query.limit ? Number(query.limit) : 20;

      const result = await listComments(expenseId, groupId!, { page, limit });

      return paginated(result.comments, page, limit, result.total);
    },
    listCommentsSchema
  )

  // ========================================================================
  // PUT /groups/:groupId/expenses/:expenseId/comments/:commentId - Update Comment
  // AC-1.6: PUT updates comment
  // AC-1.8: Only comment author can edit/delete their own comments
  // Sprint 009: Group membership validated by middleware
  // ========================================================================
  .put(
    "/:commentId",
    async ({ params, body, groupId, memberId, set }) => {
      const { expenseId, commentId } = params;

      // Check expense exists in this group
      const expenseExists = await expenseExistsInGroup(expenseId, groupId!);
      if (!expenseExists) {
        set.status = 404;
        return error(ErrorCodes.NOT_FOUND, "Expense not found");
      }

      // Check comment exists
      const comment = await getCommentById(commentId, groupId!);
      if (!comment) {
        set.status = 404;
        return error(ErrorCodes.NOT_FOUND, "Comment not found");
      }

      // Check comment belongs to this expense
      if (comment.expenseId !== expenseId) {
        set.status = 404;
        return error(ErrorCodes.NOT_FOUND, "Comment not found");
      }

      // AC-1.8: Check if user is the author (using memberId from middleware)
      const isAuthor = await isCommentAuthor(commentId, memberId!);
      if (!isAuthor) {
        set.status = 403;
        return error(ErrorCodes.FORBIDDEN, "You can only edit your own comments");
      }

      // Validate content
      const validation = validateCommentContent(body.content);
      if (!validation.valid) {
        set.status = 400;
        return error(ErrorCodes.VALIDATION_ERROR, validation.error!);
      }

      // Update comment
      const result = await updateComment(commentId, groupId!, {
        content: body.content,
      });

      if ("error" in result) {
        set.status = 400;
        return error(ErrorCodes.VALIDATION_ERROR, result.error);
      }

      return success({
        id: result.comment.id,
        content: result.comment.content,
        createdAt: result.comment.createdAt,
        updatedAt: result.comment.updatedAt,
      });
    },
    updateCommentSchema
  )

  // ========================================================================
  // DELETE /groups/:groupId/expenses/:expenseId/comments/:commentId - Delete Comment
  // AC-1.7: DELETE soft-deletes comment
  // AC-1.8: Only comment author can edit/delete their own comments
  // Sprint 009: Group membership validated by middleware
  // ========================================================================
  .delete(
    "/:commentId",
    async ({ params, groupId, memberId, set }) => {
      const { expenseId, commentId } = params;

      // Check expense exists in this group
      const expenseExists = await expenseExistsInGroup(expenseId, groupId!);
      if (!expenseExists) {
        set.status = 404;
        return error(ErrorCodes.NOT_FOUND, "Expense not found");
      }

      // Check comment exists
      const comment = await getCommentById(commentId, groupId!);
      if (!comment) {
        set.status = 404;
        return error(ErrorCodes.NOT_FOUND, "Comment not found");
      }

      // Check comment belongs to this expense
      if (comment.expenseId !== expenseId) {
        set.status = 404;
        return error(ErrorCodes.NOT_FOUND, "Comment not found");
      }

      // AC-1.8: Check if user is the author (using memberId from middleware)
      const isAuthor = await isCommentAuthor(commentId, memberId!);
      if (!isAuthor) {
        set.status = 403;
        return error(ErrorCodes.FORBIDDEN, "You can only delete your own comments");
      }

      // Delete comment
      const result = await deleteComment(commentId, groupId!);

      if (!result.success) {
        set.status = 400;
        return error(ErrorCodes.VALIDATION_ERROR, result.error!);
      }

      return success({
        message: "Comment deleted",
        deletedAt: new Date().toISOString(),
      });
    },
    {
      params: commentIdParamsSchema,
    }
  );
