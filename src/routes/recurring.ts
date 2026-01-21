/**
 * Recurring Expenses Routes
 * Sprint 007 - TASK-014
 *
 * CRUD API for recurring expense rules.
 *
 * AC-3.4: POST /groups/:groupId/recurring-expenses creates recurring rule
 * AC-3.5: GET /groups/:groupId/recurring-expenses lists all recurring rules
 * AC-3.6: GET /groups/:groupId/recurring-expenses/:id returns single rule
 * AC-3.7: PUT /groups/:groupId/recurring-expenses/:id updates rule
 * AC-3.8: DELETE /groups/:groupId/recurring-expenses/:id deactivates rule
 */

import { Elysia, t } from "elysia";
import { success, error, ErrorCodes } from "../lib/responses";
import { requireAuth } from "../middleware/auth";
import { findGroupById, isMemberOfGroup } from "../services/group.service";
import { getMemberIdForUser } from "../services/expense.service";
import {
  createRecurringExpense,
  listRecurringExpenses,
  getRecurringExpense,
  updateRecurringExpense,
  deactivateRecurringExpense,
  findRecurringExpenseById,
} from "../services/recurring.service";
import { RECURRING_FREQUENCIES } from "../db/schema/enums";

// ============================================================================
// Request Schemas
// ============================================================================

const groupParamsSchema = t.Object({
  groupId: t.String(),
});

const recurringParamsSchema = t.Object({
  groupId: t.String(),
  recurringId: t.String(),
});

const createRecurringSchema = t.Object({
  name: t.String({ minLength: 1, maxLength: 255 }),
  description: t.Optional(t.String({ maxLength: 1000 })),
  category: t.Optional(t.String()),
  amount: t.Number({ minimum: 0.01 }),
  currencyCode: t.String({ minLength: 3, maxLength: 3 }),
  frequency: t.Union([
    t.Literal("daily"),
    t.Literal("weekly"),
    t.Literal("biweekly"),
    t.Literal("monthly"),
    t.Literal("yearly"),
  ]),
  dayOfWeek: t.Optional(t.Integer({ minimum: 0, maximum: 6 })),
  dayOfMonth: t.Optional(t.Integer({ minimum: 1, maximum: 31 })),
  monthOfYear: t.Optional(t.Integer({ minimum: 1, maximum: 12 })),
  splitMode: t.Optional(
    t.Union([
      t.Literal("equal"),
      t.Literal("weight"),
      t.Literal("exact"),
      t.Literal("percent"),
    ])
  ),
  startDate: t.String(), // ISO date string
  endDate: t.Optional(t.String()),
  payers: t.Array(
    t.Object({
      memberId: t.String(),
      amount: t.Number({ minimum: 0.01 }),
    })
  ),
  splits: t.Array(
    t.Object({
      memberId: t.String(),
      shareMode: t.Optional(t.String()),
      weight: t.Optional(t.Number({ minimum: 0 })),
      exactAmount: t.Optional(t.Number({ minimum: 0 })),
    })
  ),
});

const updateRecurringSchema = t.Object({
  name: t.Optional(t.String({ minLength: 1, maxLength: 255 })),
  description: t.Optional(t.String({ maxLength: 1000 })),
  category: t.Optional(t.String()),
  amount: t.Optional(t.Number({ minimum: 0.01 })),
  currencyCode: t.Optional(t.String({ minLength: 3, maxLength: 3 })),
  frequency: t.Optional(
    t.Union([
      t.Literal("daily"),
      t.Literal("weekly"),
      t.Literal("biweekly"),
      t.Literal("monthly"),
      t.Literal("yearly"),
    ])
  ),
  dayOfWeek: t.Optional(t.Integer({ minimum: 0, maximum: 6 })),
  dayOfMonth: t.Optional(t.Integer({ minimum: 1, maximum: 31 })),
  monthOfYear: t.Optional(t.Integer({ minimum: 1, maximum: 12 })),
  splitMode: t.Optional(t.String()),
  endDate: t.Optional(t.String()),
  isActive: t.Optional(t.Boolean()),
});

// ============================================================================
// Recurring Expenses Routes
// ============================================================================

export const recurringExpenseRoutes = new Elysia({
  prefix: "/groups/:groupId/recurring-expenses",
})
  .use(requireAuth)

  // ========================================================================
  // POST /groups/:groupId/recurring-expenses - Create Recurring Expense
  // AC-3.4: POST creates recurring rule
  // ========================================================================
  .post(
    "/",
    async ({ params, body, auth, authError, set }) => {
      if (!auth) {
        set.status = 401;
        return authError;
      }

      const { groupId } = params;

      // Check group exists
      const group = await findGroupById(groupId);
      if (!group) {
        set.status = 404;
        return error(ErrorCodes.NOT_FOUND, "Group not found");
      }

      // Check user is a member and get member ID
      const memberId = await getMemberIdForUser(auth.userId, groupId);
      if (!memberId) {
        set.status = 403;
        return error(ErrorCodes.FORBIDDEN, "You are not a member of this group");
      }

      // Parse dates
      const startDate = new Date(body.startDate);
      if (isNaN(startDate.getTime())) {
        set.status = 400;
        return error(ErrorCodes.VALIDATION_ERROR, "Invalid startDate format");
      }

      let endDate: Date | undefined;
      if (body.endDate) {
        endDate = new Date(body.endDate);
        if (isNaN(endDate.getTime())) {
          set.status = 400;
          return error(ErrorCodes.VALIDATION_ERROR, "Invalid endDate format");
        }
      }

      // Validate payers sum equals amount
      const payerTotal = body.payers.reduce((sum, p) => sum + p.amount, 0);
      if (Math.abs(payerTotal - body.amount) > 0.01) {
        set.status = 400;
        return error(
          ErrorCodes.VALIDATION_ERROR,
          "Payer amounts must sum to the expense amount"
        );
      }

      // Create recurring expense
      const result = await createRecurringExpense({
        groupId,
        createdByMemberId: memberId,
        name: body.name,
        description: body.description,
        category: body.category,
        amount: body.amount,
        currencyCode: body.currencyCode,
        frequency: body.frequency,
        dayOfWeek: body.dayOfWeek,
        dayOfMonth: body.dayOfMonth,
        monthOfYear: body.monthOfYear,
        splitMode: body.splitMode,
        startDate,
        endDate,
        payers: body.payers,
        splits: body.splits,
      });

      set.status = 201;
      return success(result);
    },
    {
      params: groupParamsSchema,
      body: createRecurringSchema,
      detail: {
        summary: "Create recurring expense",
        description: "Create a new recurring expense rule for automatic expense generation.",
        tags: ["Recurring Expenses"],
      },
    }
  )

  // ========================================================================
  // GET /groups/:groupId/recurring-expenses - List Recurring Expenses
  // AC-3.5: GET lists all recurring rules
  // ========================================================================
  .get(
    "/",
    async ({ params, auth, authError, set }) => {
      if (!auth) {
        set.status = 401;
        return authError;
      }

      const { groupId } = params;

      // Check group exists
      const group = await findGroupById(groupId);
      if (!group) {
        set.status = 404;
        return error(ErrorCodes.NOT_FOUND, "Group not found");
      }

      // Check user is a member
      const isMember = await isMemberOfGroup(auth.userId, groupId);
      if (!isMember) {
        set.status = 403;
        return error(ErrorCodes.FORBIDDEN, "You are not a member of this group");
      }

      const recurringExpenses = await listRecurringExpenses(groupId);

      return success({
        recurringExpenses,
        count: recurringExpenses.length,
      });
    },
    {
      params: groupParamsSchema,
      detail: {
        summary: "List recurring expenses",
        description: "Get all recurring expense rules for a group.",
        tags: ["Recurring Expenses"],
      },
    }
  )

  // ========================================================================
  // GET /groups/:groupId/recurring-expenses/:recurringId - Get Single Rule
  // AC-3.6: GET returns single rule
  // ========================================================================
  .get(
    "/:recurringId",
    async ({ params, auth, authError, set }) => {
      if (!auth) {
        set.status = 401;
        return authError;
      }

      const { groupId, recurringId } = params;

      // Check group exists
      const group = await findGroupById(groupId);
      if (!group) {
        set.status = 404;
        return error(ErrorCodes.NOT_FOUND, "Group not found");
      }

      // Check user is a member
      const isMember = await isMemberOfGroup(auth.userId, groupId);
      if (!isMember) {
        set.status = 403;
        return error(ErrorCodes.FORBIDDEN, "You are not a member of this group");
      }

      const recurringExpense = await getRecurringExpense(recurringId);
      if (!recurringExpense) {
        set.status = 404;
        return error(ErrorCodes.NOT_FOUND, "Recurring expense not found");
      }

      // Verify it belongs to this group
      if (recurringExpense.groupId !== groupId) {
        set.status = 404;
        return error(ErrorCodes.NOT_FOUND, "Recurring expense not found");
      }

      return success(recurringExpense);
    },
    {
      params: recurringParamsSchema,
      detail: {
        summary: "Get recurring expense",
        description: "Get details of a single recurring expense rule.",
        tags: ["Recurring Expenses"],
      },
    }
  )

  // ========================================================================
  // PUT /groups/:groupId/recurring-expenses/:recurringId - Update Rule
  // AC-3.7: PUT updates rule
  // ========================================================================
  .put(
    "/:recurringId",
    async ({ params, body, auth, authError, set }) => {
      if (!auth) {
        set.status = 401;
        return authError;
      }

      const { groupId, recurringId } = params;

      // Check group exists
      const group = await findGroupById(groupId);
      if (!group) {
        set.status = 404;
        return error(ErrorCodes.NOT_FOUND, "Group not found");
      }

      // Check user is a member
      const isMember = await isMemberOfGroup(auth.userId, groupId);
      if (!isMember) {
        set.status = 403;
        return error(ErrorCodes.FORBIDDEN, "You are not a member of this group");
      }

      // Check recurring expense exists and belongs to group
      const existing = await findRecurringExpenseById(recurringId);
      if (!existing || existing.groupId !== groupId) {
        set.status = 404;
        return error(ErrorCodes.NOT_FOUND, "Recurring expense not found");
      }

      // Parse end date if provided
      let endDate: Date | undefined;
      if (body.endDate) {
        endDate = new Date(body.endDate);
        if (isNaN(endDate.getTime())) {
          set.status = 400;
          return error(ErrorCodes.VALIDATION_ERROR, "Invalid endDate format");
        }
      }

      const updated = await updateRecurringExpense(recurringId, {
        ...body,
        endDate,
      });

      if (!updated) {
        set.status = 500;
        return error(ErrorCodes.INTERNAL_ERROR, "Failed to update recurring expense");
      }

      const recurringExpense = await getRecurringExpense(recurringId);
      return success(recurringExpense);
    },
    {
      params: recurringParamsSchema,
      body: updateRecurringSchema,
      detail: {
        summary: "Update recurring expense",
        description: "Update a recurring expense rule.",
        tags: ["Recurring Expenses"],
      },
    }
  )

  // ========================================================================
  // DELETE /groups/:groupId/recurring-expenses/:recurringId - Deactivate
  // AC-3.8: DELETE deactivates rule
  // ========================================================================
  .delete(
    "/:recurringId",
    async ({ params, auth, authError, set }) => {
      if (!auth) {
        set.status = 401;
        return authError;
      }

      const { groupId, recurringId } = params;

      // Check group exists
      const group = await findGroupById(groupId);
      if (!group) {
        set.status = 404;
        return error(ErrorCodes.NOT_FOUND, "Group not found");
      }

      // Check user is a member
      const isMember = await isMemberOfGroup(auth.userId, groupId);
      if (!isMember) {
        set.status = 403;
        return error(ErrorCodes.FORBIDDEN, "You are not a member of this group");
      }

      // Check recurring expense exists and belongs to group
      const existing = await findRecurringExpenseById(recurringId);
      if (!existing || existing.groupId !== groupId) {
        set.status = 404;
        return error(ErrorCodes.NOT_FOUND, "Recurring expense not found");
      }

      const deactivated = await deactivateRecurringExpense(recurringId);

      if (!deactivated) {
        set.status = 500;
        return error(ErrorCodes.INTERNAL_ERROR, "Failed to deactivate recurring expense");
      }

      return success({ message: "Recurring expense deactivated" });
    },
    {
      params: recurringParamsSchema,
      detail: {
        summary: "Deactivate recurring expense",
        description: "Deactivate a recurring expense rule. The rule will no longer generate expenses.",
        tags: ["Recurring Expenses"],
      },
    }
  );
