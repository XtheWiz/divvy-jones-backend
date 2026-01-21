/**
 * Reaction Routes
 * Sprint 008 - TASK-011
 *
 * Routes for reactions on expenses and settlements.
 * AC-2.3: POST adds or toggles a reaction
 * AC-2.4: DELETE removes a reaction
 * AC-2.5: GET includes reaction counts and current user's reactions
 * AC-2.6: Settlement endpoints also support reactions
 * AC-2.7: Support reaction types: thumbsUp, thumbsDown, heart, laugh, surprised, angry
 * AC-2.8: Reaction type is validated against allowed enum values
 */

import { Elysia, t } from "elysia";
import { success, error, ErrorCodes } from "../lib/responses";
import { requireAuth } from "../middleware/auth";
import { findGroupById, isMemberOfGroup } from "../services/group.service";
import {
  toggleReaction,
  removeReaction,
  getReactionSummary,
  getReactionsGroupedByType,
  expenseExistsInGroup,
  settlementExistsInGroup,
  getMemberIdForUser,
  validateReactionType,
  REACTION_TYPES,
} from "../services/reaction.service";

// ============================================================================
// Request/Response Schemas
// ============================================================================

const expenseReactionParamsSchema = t.Object({
  groupId: t.String(),
  expenseId: t.String(),
});

const expenseReactionTypeParamsSchema = t.Object({
  groupId: t.String(),
  expenseId: t.String(),
  type: t.String(),
});

const settlementReactionParamsSchema = t.Object({
  groupId: t.String(),
  settlementId: t.String(),
});

const settlementReactionTypeParamsSchema = t.Object({
  groupId: t.String(),
  settlementId: t.String(),
  type: t.String(),
});

const addReactionSchema = {
  body: t.Object({
    type: t.String(),
  }),
};

// ============================================================================
// Expense Reaction Routes
// ============================================================================

export const expenseReactionRoutes = new Elysia({ prefix: "/groups/:groupId/expenses/:expenseId/reactions" })
  .use(requireAuth)

  // ========================================================================
  // POST /groups/:groupId/expenses/:expenseId/reactions - Toggle Reaction
  // AC-2.3: POST adds or toggles a reaction
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

      // AC-2.8: Validate reaction type
      if (!validateReactionType(body.type)) {
        set.status = 400;
        return error(
          ErrorCodes.VALIDATION_ERROR,
          `Invalid reaction type. Must be one of: ${REACTION_TYPES.join(", ")}`
        );
      }

      // Get user's member ID
      const memberId = await getMemberIdForUser(auth.userId, groupId);
      if (!memberId) {
        set.status = 403;
        return error(ErrorCodes.NOT_MEMBER, "You are not a member of this group");
      }

      // Toggle reaction
      const result = await toggleReaction("expense", expenseId, groupId, memberId, body.type);

      return success({
        added: result.added,
        type: body.type,
        reaction: result.reaction
          ? {
              id: result.reaction.id,
              createdAt: result.reaction.createdAt,
            }
          : null,
      });
    },
    {
      params: expenseReactionParamsSchema,
      ...addReactionSchema,
    }
  )

  // ========================================================================
  // GET /groups/:groupId/expenses/:expenseId/reactions - Get Reactions
  // AC-2.5: GET includes reaction counts and current user's reactions
  // ========================================================================
  .get(
    "/",
    async ({ params, auth, authError, set }) => {
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

      // Get reaction summary
      const summary = await getReactionSummary("expense", expenseId, memberId || undefined);

      // Get detailed reactions (who reacted)
      const details = await getReactionsGroupedByType("expense", expenseId);

      return success({
        counts: summary.counts,
        userReactions: summary.userReactions,
        details,
      });
    },
    {
      params: expenseReactionParamsSchema,
    }
  )

  // ========================================================================
  // DELETE /groups/:groupId/expenses/:expenseId/reactions/:type - Remove Reaction
  // AC-2.4: DELETE removes a reaction
  // ========================================================================
  .delete(
    "/:type",
    async ({ params, auth, authError, set }) => {
      if (!auth) {
        set.status = 401;
        return authError;
      }

      const { groupId, expenseId, type } = params;

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

      // AC-2.8: Validate reaction type
      if (!validateReactionType(type)) {
        set.status = 400;
        return error(
          ErrorCodes.VALIDATION_ERROR,
          `Invalid reaction type. Must be one of: ${REACTION_TYPES.join(", ")}`
        );
      }

      // Get user's member ID
      const memberId = await getMemberIdForUser(auth.userId, groupId);
      if (!memberId) {
        set.status = 403;
        return error(ErrorCodes.NOT_MEMBER, "You are not a member of this group");
      }

      // Remove reaction
      const result = await removeReaction("expense", expenseId, memberId, type);

      if (!result.success) {
        set.status = 404;
        return error(ErrorCodes.NOT_FOUND, "Reaction not found");
      }

      return success({
        message: "Reaction removed",
        type,
      });
    },
    {
      params: expenseReactionTypeParamsSchema,
    }
  );

// ============================================================================
// Settlement Reaction Routes
// AC-2.6: Settlement endpoints also support reactions
// ============================================================================

export const settlementReactionRoutes = new Elysia({ prefix: "/groups/:groupId/settlements/:settlementId/reactions" })
  .use(requireAuth)

  // ========================================================================
  // POST /groups/:groupId/settlements/:settlementId/reactions - Toggle Reaction
  // ========================================================================
  .post(
    "/",
    async ({ params, body, auth, authError, set }) => {
      if (!auth) {
        set.status = 401;
        return authError;
      }

      const { groupId, settlementId } = params;

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

      // Check settlement exists in this group
      const settlementExists = await settlementExistsInGroup(settlementId, groupId);
      if (!settlementExists) {
        set.status = 404;
        return error(ErrorCodes.NOT_FOUND, "Settlement not found");
      }

      // AC-2.8: Validate reaction type
      if (!validateReactionType(body.type)) {
        set.status = 400;
        return error(
          ErrorCodes.VALIDATION_ERROR,
          `Invalid reaction type. Must be one of: ${REACTION_TYPES.join(", ")}`
        );
      }

      // Get user's member ID
      const memberId = await getMemberIdForUser(auth.userId, groupId);
      if (!memberId) {
        set.status = 403;
        return error(ErrorCodes.NOT_MEMBER, "You are not a member of this group");
      }

      // Toggle reaction
      const result = await toggleReaction("settlement", settlementId, groupId, memberId, body.type);

      return success({
        added: result.added,
        type: body.type,
        reaction: result.reaction
          ? {
              id: result.reaction.id,
              createdAt: result.reaction.createdAt,
            }
          : null,
      });
    },
    {
      params: settlementReactionParamsSchema,
      ...addReactionSchema,
    }
  )

  // ========================================================================
  // GET /groups/:groupId/settlements/:settlementId/reactions - Get Reactions
  // ========================================================================
  .get(
    "/",
    async ({ params, auth, authError, set }) => {
      if (!auth) {
        set.status = 401;
        return authError;
      }

      const { groupId, settlementId } = params;

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

      // Check settlement exists in this group
      const settlementExists = await settlementExistsInGroup(settlementId, groupId);
      if (!settlementExists) {
        set.status = 404;
        return error(ErrorCodes.NOT_FOUND, "Settlement not found");
      }

      // Get user's member ID
      const memberId = await getMemberIdForUser(auth.userId, groupId);

      // Get reaction summary
      const summary = await getReactionSummary("settlement", settlementId, memberId || undefined);

      // Get detailed reactions (who reacted)
      const details = await getReactionsGroupedByType("settlement", settlementId);

      return success({
        counts: summary.counts,
        userReactions: summary.userReactions,
        details,
      });
    },
    {
      params: settlementReactionParamsSchema,
    }
  )

  // ========================================================================
  // DELETE /groups/:groupId/settlements/:settlementId/reactions/:type - Remove Reaction
  // ========================================================================
  .delete(
    "/:type",
    async ({ params, auth, authError, set }) => {
      if (!auth) {
        set.status = 401;
        return authError;
      }

      const { groupId, settlementId, type } = params;

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

      // Check settlement exists in this group
      const settlementExists = await settlementExistsInGroup(settlementId, groupId);
      if (!settlementExists) {
        set.status = 404;
        return error(ErrorCodes.NOT_FOUND, "Settlement not found");
      }

      // AC-2.8: Validate reaction type
      if (!validateReactionType(type)) {
        set.status = 400;
        return error(
          ErrorCodes.VALIDATION_ERROR,
          `Invalid reaction type. Must be one of: ${REACTION_TYPES.join(", ")}`
        );
      }

      // Get user's member ID
      const memberId = await getMemberIdForUser(auth.userId, groupId);
      if (!memberId) {
        set.status = 403;
        return error(ErrorCodes.NOT_MEMBER, "You are not a member of this group");
      }

      // Remove reaction
      const result = await removeReaction("settlement", settlementId, memberId, type);

      if (!result.success) {
        set.status = 404;
        return error(ErrorCodes.NOT_FOUND, "Reaction not found");
      }

      return success({
        message: "Reaction removed",
        type,
      });
    },
    {
      params: settlementReactionTypeParamsSchema,
    }
  );
