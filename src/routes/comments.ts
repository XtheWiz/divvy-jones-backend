/**
 * Comment Routes
 * Sprint 008 - TASK-006
 *
 * Routes for expense comments.
 * AC-1.4: POST /groups/:groupId/expenses/:expenseId/comments creates a new comment
 * AC-1.5: GET /groups/:groupId/expenses/:expenseId/comments lists all comments (paginated)
 * AC-1.6: PUT /groups/:groupId/expenses/:expenseId/comments/:commentId updates comment
 * AC-1.7: DELETE /groups/:groupId/expenses/:expenseId/comments/:commentId soft-deletes comment
 * AC-1.8: Only comment author can edit/delete their own comments
 */

import { Elysia, t } from "elysia";
import { success, error, ErrorCodes, paginated } from "../lib/responses";
import { requireAuth } from "../middleware/auth";
import { findGroupById, isMemberOfGroup } from "../services/group.service";
import {
  createComment,
  listComments,
  getCommentById,
  updateComment,
  deleteComment,
  isCommentAuthor,
  expenseExistsInGroup,
  getMemberIdForUser,
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
// ============================================================================

export const commentRoutes = new Elysia({ prefix: "/groups/:groupId/expenses/:expenseId/comments" })
  .use(requireAuth)

  // ========================================================================
  // POST /groups/:groupId/expenses/:expenseId/comments - Create Comment
  // AC-1.4: POST creates a new comment
  // ========================================================================
  .post(
    "/",
    async ({ params, body, auth, authError, set }) => {
      if (!auth) {
        set.status = 401;
        return authError;
      }

      const { groupId, expenseId } = params;

      // Check group exists
      const group = await findGroupById(groupId);
      if (!group) {
        set.status = 404;
        return error(ErrorCodes.NOT_FOUND, "Group not found");
      }

      // Check user is member
      const { isMember } = await isMemberOfGroup(auth.userId, groupId);
      if (!isMember) {
        set.status = 403;
        return error(ErrorCodes.NOT_MEMBER, "You are not a member of this group");
      }

      // Check expense exists in this group
      const expenseExists = await expenseExistsInGroup(expenseId, groupId);
      if (!expenseExists) {
        set.status = 404;
        return error(ErrorCodes.NOT_FOUND, "Expense not found");
      }

      // Get user's member ID
      const memberId = await getMemberIdForUser(auth.userId, groupId);
      if (!memberId) {
        set.status = 403;
        return error(ErrorCodes.NOT_MEMBER, "You are not a member of this group");
      }

      // Validate content
      const validation = validateCommentContent(body.content);
      if (!validation.valid) {
        set.status = 400;
        return error(ErrorCodes.VALIDATION_ERROR, validation.error!);
      }

      // Create comment
      const result = await createComment({
        expenseId,
        groupId,
        authorMemberId: memberId,
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
          const expense = await getExpenseDetails(expenseId, groupId);
          if (!expense) return;

          // Get expense participants
          const participantUserIds = await getExpenseParticipantUserIds(expenseId);

          // Get group name
          const grp = await findGroupById(groupId);
          const groupName = grp?.name || "Unknown Group";

          // Notify each participant (except the author)
          for (const participantUserId of participantUserIds) {
            if (participantUserId !== auth.userId) {
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
          console.error("Error sending comment notifications:", err);
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
  // ========================================================================
  .get(
    "/",
    async ({ params, query, auth, authError, set }) => {
      if (!auth) {
        set.status = 401;
        return authError;
      }

      const { groupId, expenseId } = params;

      // Check group exists
      const group = await findGroupById(groupId);
      if (!group) {
        set.status = 404;
        return error(ErrorCodes.NOT_FOUND, "Group not found");
      }

      // Check user is member
      const { isMember } = await isMemberOfGroup(auth.userId, groupId);
      if (!isMember) {
        set.status = 403;
        return error(ErrorCodes.NOT_MEMBER, "You are not a member of this group");
      }

      // Check expense exists in this group
      const expenseExists = await expenseExistsInGroup(expenseId, groupId);
      if (!expenseExists) {
        set.status = 404;
        return error(ErrorCodes.NOT_FOUND, "Expense not found");
      }

      // Get paginated comments
      const page = query.page ? Number(query.page) : 1;
      const limit = query.limit ? Number(query.limit) : 20;

      const result = await listComments(expenseId, groupId, { page, limit });

      return paginated(result.comments, page, limit, result.total);
    },
    listCommentsSchema
  )

  // ========================================================================
  // PUT /groups/:groupId/expenses/:expenseId/comments/:commentId - Update Comment
  // AC-1.6: PUT updates comment
  // AC-1.8: Only comment author can edit/delete their own comments
  // ========================================================================
  .put(
    "/:commentId",
    async ({ params, body, auth, authError, set }) => {
      if (!auth) {
        set.status = 401;
        return authError;
      }

      const { groupId, expenseId, commentId } = params;

      // Check group exists
      const group = await findGroupById(groupId);
      if (!group) {
        set.status = 404;
        return error(ErrorCodes.NOT_FOUND, "Group not found");
      }

      // Check user is member
      const { isMember } = await isMemberOfGroup(auth.userId, groupId);
      if (!isMember) {
        set.status = 403;
        return error(ErrorCodes.NOT_MEMBER, "You are not a member of this group");
      }

      // Check expense exists in this group
      const expenseExists = await expenseExistsInGroup(expenseId, groupId);
      if (!expenseExists) {
        set.status = 404;
        return error(ErrorCodes.NOT_FOUND, "Expense not found");
      }

      // Check comment exists
      const comment = await getCommentById(commentId, groupId);
      if (!comment) {
        set.status = 404;
        return error(ErrorCodes.NOT_FOUND, "Comment not found");
      }

      // Check comment belongs to this expense
      if (comment.expenseId !== expenseId) {
        set.status = 404;
        return error(ErrorCodes.NOT_FOUND, "Comment not found");
      }

      // Get user's member ID
      const memberId = await getMemberIdForUser(auth.userId, groupId);
      if (!memberId) {
        set.status = 403;
        return error(ErrorCodes.NOT_MEMBER, "You are not a member of this group");
      }

      // AC-1.8: Check if user is the author
      const isAuthor = await isCommentAuthor(commentId, memberId);
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
      const result = await updateComment(commentId, groupId, {
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
  // ========================================================================
  .delete(
    "/:commentId",
    async ({ params, auth, authError, set }) => {
      if (!auth) {
        set.status = 401;
        return authError;
      }

      const { groupId, expenseId, commentId } = params;

      // Check group exists
      const group = await findGroupById(groupId);
      if (!group) {
        set.status = 404;
        return error(ErrorCodes.NOT_FOUND, "Group not found");
      }

      // Check user is member
      const { isMember } = await isMemberOfGroup(auth.userId, groupId);
      if (!isMember) {
        set.status = 403;
        return error(ErrorCodes.NOT_MEMBER, "You are not a member of this group");
      }

      // Check expense exists in this group
      const expenseExists = await expenseExistsInGroup(expenseId, groupId);
      if (!expenseExists) {
        set.status = 404;
        return error(ErrorCodes.NOT_FOUND, "Expense not found");
      }

      // Check comment exists
      const comment = await getCommentById(commentId, groupId);
      if (!comment) {
        set.status = 404;
        return error(ErrorCodes.NOT_FOUND, "Comment not found");
      }

      // Check comment belongs to this expense
      if (comment.expenseId !== expenseId) {
        set.status = 404;
        return error(ErrorCodes.NOT_FOUND, "Comment not found");
      }

      // Get user's member ID
      const memberId = await getMemberIdForUser(auth.userId, groupId);
      if (!memberId) {
        set.status = 403;
        return error(ErrorCodes.NOT_MEMBER, "You are not a member of this group");
      }

      // AC-1.8: Check if user is the author
      const isAuthor = await isCommentAuthor(commentId, memberId);
      if (!isAuthor) {
        set.status = 403;
        return error(ErrorCodes.FORBIDDEN, "You can only delete your own comments");
      }

      // Delete comment
      const result = await deleteComment(commentId, groupId);

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
