/**
 * Reaction Routes
 * Sprint 008 - TASK-011
 * Sprint 009 - Refactored to use group middleware (TASK-007)
 *
 * Routes for reactions on expenses and settlements.
 * AC-2.3: POST adds or toggles a reaction
 * AC-2.4: DELETE removes a reaction
 * AC-2.5: GET includes reaction counts and current user's reactions
 * AC-2.6: Settlement endpoints also support reactions
 * AC-2.7: Support reaction types: thumbsUp, thumbsDown, heart, laugh, surprised, angry
 * AC-2.8: Reaction type is validated against allowed enum values
 *
 * Sprint 009 - AC-2.5: Routes refactored to use requireGroupMember middleware
 */

import { Elysia, t } from "elysia";
import { success, error, ErrorCodes } from "../lib/responses";
import { requireGroupMember } from "../middleware/group";
import {
  toggleReaction,
  removeReaction,
  getReactionSummary,
  getReactionsGroupedByType,
  expenseExistsInGroup,
  settlementExistsInGroup,
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
// Sprint 009 - AC-2.5: Using requireGroupMember middleware
// ============================================================================

export const expenseReactionRoutes = new Elysia({ prefix: "/groups/:groupId/expenses/:expenseId/reactions" })
  .use(requireGroupMember)

  // ========================================================================
  // POST /groups/:groupId/expenses/:expenseId/reactions - Toggle Reaction
  // AC-2.3: POST adds or toggles a reaction
  // Sprint 009: Group membership validated by middleware
  // ========================================================================
  .post(
    "/",
    async ({ params, body, groupId, memberId, set }) => {
      const { expenseId } = params;

      // Check expense exists in this group
      const expenseExists = await expenseExistsInGroup(expenseId, groupId!);
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

      // Toggle reaction (Sprint 009: memberId from middleware)
      const result = await toggleReaction("expense", expenseId, groupId!, memberId!, body.type);

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
  // Sprint 009: Group membership validated by middleware
  // ========================================================================
  .get(
    "/",
    async ({ params, groupId, memberId, set }) => {
      const { expenseId } = params;

      // Check expense exists in this group
      const expenseExists = await expenseExistsInGroup(expenseId, groupId!);
      if (!expenseExists) {
        set.status = 404;
        return error(ErrorCodes.NOT_FOUND, "Expense not found");
      }

      // Get reaction summary (Sprint 009: memberId from middleware)
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
  // Sprint 009: Group membership validated by middleware
  // ========================================================================
  .delete(
    "/:type",
    async ({ params, groupId, memberId, set }) => {
      const { expenseId, type } = params;

      // Check expense exists in this group
      const expenseExists = await expenseExistsInGroup(expenseId, groupId!);
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

      // Remove reaction (Sprint 009: memberId from middleware)
      const result = await removeReaction("expense", expenseId, memberId!, type);

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
// Sprint 009 - AC-2.5: Using requireGroupMember middleware
// ============================================================================

export const settlementReactionRoutes = new Elysia({ prefix: "/groups/:groupId/settlements/:settlementId/reactions" })
  .use(requireGroupMember)

  // ========================================================================
  // POST /groups/:groupId/settlements/:settlementId/reactions - Toggle Reaction
  // Sprint 009: Group membership validated by middleware
  // ========================================================================
  .post(
    "/",
    async ({ params, body, groupId, memberId, set }) => {
      const { settlementId } = params;

      // Check settlement exists in this group
      const settlementExists = await settlementExistsInGroup(settlementId, groupId!);
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

      // Toggle reaction (Sprint 009: memberId from middleware)
      const result = await toggleReaction("settlement", settlementId, groupId!, memberId!, body.type);

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
  // Sprint 009: Group membership validated by middleware
  // ========================================================================
  .get(
    "/",
    async ({ params, groupId, memberId, set }) => {
      const { settlementId } = params;

      // Check settlement exists in this group
      const settlementExists = await settlementExistsInGroup(settlementId, groupId!);
      if (!settlementExists) {
        set.status = 404;
        return error(ErrorCodes.NOT_FOUND, "Settlement not found");
      }

      // Get reaction summary (Sprint 009: memberId from middleware)
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
  // Sprint 009: Group membership validated by middleware
  // ========================================================================
  .delete(
    "/:type",
    async ({ params, groupId, memberId, set }) => {
      const { settlementId, type } = params;

      // Check settlement exists in this group
      const settlementExists = await settlementExistsInGroup(settlementId, groupId!);
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

      // Remove reaction (Sprint 009: memberId from middleware)
      const result = await removeReaction("settlement", settlementId, memberId!, type);

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
