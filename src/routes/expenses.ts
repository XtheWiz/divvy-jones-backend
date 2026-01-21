import { Elysia, t } from "elysia";
import { success, error, ErrorCodes, paginated } from "../lib/responses";
import { requireAuth } from "../middleware/auth";
import { findGroupById, isMemberOfGroup, getMemberRole } from "../services/group.service";
import {
  EXPENSE_CATEGORIES,
  validateAmount,
  validateCategory,
  validateCurrency,
  validateTitle,
  getMemberIdForUser,
  createExpense,
  listExpenses,
  getExpenseDetails,
  updateExpense,
  deleteExpense,
  canModifyExpense,
  hasSettlements,
  type SplitConfig,
} from "../services/expense.service";

// ============================================================================
// Request/Response Schemas
// ============================================================================

const splitSchema = t.Object({
  type: t.Union([
    t.Literal("equal"),
    t.Literal("exact"),
    t.Literal("percent"),
    t.Literal("weight"),
  ]),
  excludeMembers: t.Optional(t.Array(t.String())),
  values: t.Optional(t.Record(t.String(), t.Number())),
});

const createExpenseSchema = {
  body: t.Object({
    title: t.String({ minLength: 1, maxLength: 200 }),
    amount: t.Number({ minimum: 0.01 }),
    currency: t.String({ minLength: 3, maxLength: 3 }),
    paidBy: t.String(), // userId
    description: t.Optional(t.String({ maxLength: 500 })),
    category: t.Optional(t.String()),
    date: t.Optional(t.String()), // ISO date string
    splits: t.Optional(splitSchema),
  }),
  params: t.Object({
    groupId: t.String(),
  }),
  detail: {
    tags: ["Expenses"],
    summary: "Create expense",
    description: "Create a new expense in a group. Supports equal, exact, percentage, or weighted splits. The payer must be a group member.",
  },
};

const listExpensesSchema = {
  params: t.Object({
    groupId: t.String(),
  }),
  query: t.Object({
    page: t.Optional(t.Numeric()),
    limit: t.Optional(t.Numeric()),
    dateFrom: t.Optional(t.String()),
    dateTo: t.Optional(t.String()),
    category: t.Optional(t.String()),
    paidBy: t.Optional(t.String()),
  }),
  detail: {
    tags: ["Expenses"],
    summary: "List expenses",
    description: "Get paginated list of expenses in a group with optional filters for date range, category, and payer.",
  },
};

const updateExpenseSchema = {
  body: t.Object({
    title: t.Optional(t.String({ minLength: 1, maxLength: 200 })),
    description: t.Optional(t.String({ maxLength: 500 })),
    amount: t.Optional(t.Number({ minimum: 0.01 })),
    category: t.Optional(t.String()),
    date: t.Optional(t.String()),
    splits: t.Optional(splitSchema),
  }),
  params: t.Object({
    groupId: t.String(),
    expenseId: t.String(),
  }),
  detail: {
    tags: ["Expenses"],
    summary: "Update expense",
    description: "Update an existing expense. Only the creator or group admins can modify expenses. Cannot modify expenses with existing settlements.",
  },
};

// ============================================================================
// Expense Routes
// ============================================================================

export const expenseRoutes = new Elysia({ prefix: "/groups/:groupId/expenses" })
  .use(requireAuth)

  // ========================================================================
  // POST /groups/:groupId/expenses - Create Expense
  // AC-2.1 to AC-2.9, AC-2.10 to AC-2.16
  // ========================================================================
  .post(
    "/",
    async ({ params, body, auth, authError, set }) => {
      if (!auth) {
        set.status = 401;
        return authError;
      }

      const { groupId } = params;

      // Check if group exists
      const group = await findGroupById(groupId);
      if (!group) {
        set.status = 404;
        return error(ErrorCodes.NOT_FOUND, "Group not found");
      }

      // AC-2.1: Check if user is a member
      const { isMember } = await isMemberOfGroup(auth.userId, groupId);
      if (!isMember) {
        set.status = 403;
        return error(ErrorCodes.NOT_MEMBER, "You are not a member of this group");
      }

      // Get user's member ID for createdBy
      const creatorMemberId = await getMemberIdForUser(auth.userId, groupId);
      if (!creatorMemberId) {
        set.status = 403;
        return error(ErrorCodes.NOT_MEMBER, "You are not a member of this group");
      }

      // AC-2.7: Validate title
      const titleValidation = validateTitle(body.title);
      if (!titleValidation.valid) {
        set.status = 400;
        return error(ErrorCodes.VALIDATION_ERROR, titleValidation.error!);
      }

      // AC-2.4: Validate amount
      const amountValidation = validateAmount(body.amount);
      if (!amountValidation.valid) {
        set.status = 400;
        return error(ErrorCodes.VALIDATION_ERROR, amountValidation.error!);
      }

      // AC-2.5: Validate currency
      const validCurrency = await validateCurrency(body.currency);
      if (!validCurrency) {
        set.status = 400;
        return error(ErrorCodes.VALIDATION_ERROR, "Invalid currency code");
      }

      // AC-2.6: Validate paidBy is a member
      const payerMemberId = await getMemberIdForUser(body.paidBy, groupId);
      if (!payerMemberId) {
        set.status = 400;
        return error(ErrorCodes.VALIDATION_ERROR, "Payer is not a member of the group");
      }

      // AC-2.8: Validate category if provided
      if (body.category && !validateCategory(body.category)) {
        set.status = 400;
        return error(
          ErrorCodes.VALIDATION_ERROR,
          `Invalid category. Must be one of: ${EXPENSE_CATEGORIES.join(", ")}`
        );
      }

      // Parse date if provided
      let expenseDate: Date | undefined;
      if (body.date) {
        expenseDate = new Date(body.date);
        if (isNaN(expenseDate.getTime())) {
          set.status = 400;
          return error(ErrorCodes.VALIDATION_ERROR, "Invalid date format");
        }
      }

      // Default splits to equal if not provided
      const splits: SplitConfig = body.splits || { type: "equal" };

      // Create expense
      const result = await createExpense({
        groupId,
        createdByMemberId: creatorMemberId,
        title: body.title,
        amount: body.amount,
        currency: body.currency,
        paidByUserId: body.paidBy,
        description: body.description,
        category: body.category,
        date: expenseDate,
        splits,
      });

      if ("error" in result) {
        set.status = 400;
        return error(ErrorCodes.VALIDATION_ERROR, result.error);
      }

      // AC-2.9: Return created expense with ID and timestamp
      set.status = 201;
      return success({
        id: result.expense.id,
        title: result.expense.name,
        amount: parseFloat(result.expense.subtotal),
        currency: result.expense.currencyCode,
        category: result.expense.category,
        date: result.expense.expenseDate,
        createdAt: result.expense.createdAt,
        splits: result.splits.map((s) => ({
          userId: s.userId,
          amount: s.amount,
          shareMode: s.shareMode,
        })),
      });
    },
    createExpenseSchema
  )

  // ========================================================================
  // GET /groups/:groupId/expenses - List Expenses
  // AC-2.17 to AC-2.23
  // ========================================================================
  .get(
    "/",
    async ({ params, query, auth, authError, set }) => {
      if (!auth) {
        set.status = 401;
        return authError;
      }

      const { groupId } = params;

      // Check if group exists
      const group = await findGroupById(groupId);
      if (!group) {
        set.status = 404;
        return error(ErrorCodes.NOT_FOUND, "Group not found");
      }

      // AC-2.17: Check if user is a member
      const { isMember } = await isMemberOfGroup(auth.userId, groupId);
      if (!isMember) {
        set.status = 403;
        return error(ErrorCodes.NOT_MEMBER, "You are not a member of this group");
      }

      // Parse filters
      const filters: Parameters<typeof listExpenses>[1] = {
        page: query.page ? Number(query.page) : 1,
        limit: query.limit ? Number(query.limit) : 20,
      };

      // AC-2.19: Date range filters
      if (query.dateFrom) {
        const dateFrom = new Date(query.dateFrom);
        if (!isNaN(dateFrom.getTime())) {
          filters.dateFrom = dateFrom;
        }
      }
      if (query.dateTo) {
        const dateTo = new Date(query.dateTo);
        if (!isNaN(dateTo.getTime())) {
          filters.dateTo = dateTo;
        }
      }

      // AC-2.20: Category filter
      if (query.category) {
        filters.category = query.category;
      }

      // AC-2.21: PaidBy filter
      if (query.paidBy) {
        filters.paidByUserId = query.paidBy;
      }

      // AC-2.22, AC-2.23: Get expenses (sorted by date desc)
      const result = await listExpenses(groupId, filters);

      // AC-2.18: Return paginated response
      return paginated(
        result.expenses,
        filters.page || 1,
        filters.limit || 20,
        result.total
      );
    },
    listExpensesSchema
  )

  // ========================================================================
  // GET /groups/:groupId/expenses/:expenseId - View Expense Details
  // AC-2.24 to AC-2.27
  // ========================================================================
  .get(
    "/:expenseId",
    async ({ params, auth, authError, set }) => {
      if (!auth) {
        set.status = 401;
        return authError;
      }

      const { groupId, expenseId } = params;

      // Check if group exists
      const group = await findGroupById(groupId);
      if (!group) {
        set.status = 404;
        return error(ErrorCodes.NOT_FOUND, "Group not found");
      }

      // AC-2.27: Check if user is a member
      const { isMember } = await isMemberOfGroup(auth.userId, groupId);
      if (!isMember) {
        set.status = 403;
        return error(ErrorCodes.NOT_MEMBER, "You are not a member of this group");
      }

      // AC-2.24, AC-2.25, AC-2.26: Get expense details
      const expense = await getExpenseDetails(expenseId, groupId);

      if (!expense) {
        set.status = 404;
        return error(ErrorCodes.NOT_FOUND, "Expense not found");
      }

      return success(expense);
    },
    {
      params: t.Object({
        groupId: t.String(),
        expenseId: t.String(),
      }),
      detail: {
        tags: ["Expenses"],
        summary: "Get expense details",
        description: "Get detailed information about a specific expense including all splits and who paid.",
      },
    }
  )

  // ========================================================================
  // PUT /groups/:groupId/expenses/:expenseId - Edit Expense
  // AC-2.28 to AC-2.32
  // ========================================================================
  .put(
    "/:expenseId",
    async ({ params, body, auth, authError, set }) => {
      if (!auth) {
        set.status = 401;
        return authError;
      }

      const { groupId, expenseId } = params;

      // Check if group exists
      const group = await findGroupById(groupId);
      if (!group) {
        set.status = 404;
        return error(ErrorCodes.NOT_FOUND, "Group not found");
      }

      // AC-2.28: Check if user can modify (creator or admin)
      const canModify = await canModifyExpense(expenseId, auth.userId, groupId);
      if (!canModify) {
        set.status = 403;
        return error(
          ErrorCodes.FORBIDDEN,
          "Only the expense creator or group admin can edit this expense"
        );
      }

      // AC-2.31: Check for settlements
      if (await hasSettlements(expenseId)) {
        set.status = 400;
        return error(
          ErrorCodes.VALIDATION_ERROR,
          "Cannot edit expense with settlements"
        );
      }

      // Validate fields if provided
      if (body.title) {
        const titleValidation = validateTitle(body.title);
        if (!titleValidation.valid) {
          set.status = 400;
          return error(ErrorCodes.VALIDATION_ERROR, titleValidation.error!);
        }
      }

      if (body.amount !== undefined) {
        const amountValidation = validateAmount(body.amount);
        if (!amountValidation.valid) {
          set.status = 400;
          return error(ErrorCodes.VALIDATION_ERROR, amountValidation.error!);
        }
      }

      if (body.category && !validateCategory(body.category)) {
        set.status = 400;
        return error(
          ErrorCodes.VALIDATION_ERROR,
          `Invalid category. Must be one of: ${EXPENSE_CATEGORIES.join(", ")}`
        );
      }

      // Parse date if provided
      let expenseDate: Date | undefined;
      if (body.date) {
        expenseDate = new Date(body.date);
        if (isNaN(expenseDate.getTime())) {
          set.status = 400;
          return error(ErrorCodes.VALIDATION_ERROR, "Invalid date format");
        }
      }

      // Get user's member ID
      const updaterMemberId = await getMemberIdForUser(auth.userId, groupId);
      if (!updaterMemberId) {
        set.status = 403;
        return error(ErrorCodes.NOT_MEMBER, "You are not a member of this group");
      }

      // AC-2.29, AC-2.30, AC-2.32: Update expense
      const result = await updateExpense(expenseId, groupId, updaterMemberId, {
        title: body.title,
        description: body.description,
        amount: body.amount,
        category: body.category,
        date: expenseDate,
        splits: body.splits as SplitConfig | undefined,
      });

      if ("error" in result) {
        set.status = 400;
        return error(ErrorCodes.VALIDATION_ERROR, result.error);
      }

      return success({
        id: result.expense.id,
        title: result.expense.name,
        description: result.expense.label,
        amount: parseFloat(result.expense.subtotal),
        currency: result.expense.currencyCode,
        category: result.expense.category,
        date: result.expense.expenseDate,
        updatedAt: result.expense.updatedAt,
      });
    },
    updateExpenseSchema
  )

  // ========================================================================
  // DELETE /groups/:groupId/expenses/:expenseId - Delete Expense
  // AC-2.33 to AC-2.36
  // ========================================================================
  .delete(
    "/:expenseId",
    async ({ params, auth, authError, set }) => {
      if (!auth) {
        set.status = 401;
        return authError;
      }

      const { groupId, expenseId } = params;

      // Check if group exists
      const group = await findGroupById(groupId);
      if (!group) {
        set.status = 404;
        return error(ErrorCodes.NOT_FOUND, "Group not found");
      }

      // AC-2.33: Check if user can modify (creator or admin)
      const canModify = await canModifyExpense(expenseId, auth.userId, groupId);
      if (!canModify) {
        set.status = 403;
        return error(
          ErrorCodes.FORBIDDEN,
          "Only the expense creator or group admin can delete this expense"
        );
      }

      // AC-2.35: Check for settlements
      if (await hasSettlements(expenseId)) {
        set.status = 400;
        return error(
          ErrorCodes.VALIDATION_ERROR,
          "Cannot delete expense with settlements"
        );
      }

      // Get member ID for activity logging
      const deleterMemberId = await getMemberIdForUser(auth.userId, groupId);

      // AC-2.34, AC-2.36: Soft delete
      const result = await deleteExpense(expenseId, groupId, deleterMemberId || undefined);

      if (!result.success) {
        if (result.error) {
          set.status = 400;
          return error(ErrorCodes.VALIDATION_ERROR, result.error);
        }
        set.status = 404;
        return error(ErrorCodes.NOT_FOUND, "Expense not found");
      }

      return success({
        message: "Expense deleted",
        deletedAt: new Date().toISOString(),
      });
    },
    {
      params: t.Object({
        groupId: t.String(),
        expenseId: t.String(),
      }),
      detail: {
        tags: ["Expenses"],
        summary: "Delete expense",
        description: "Soft delete an expense. Only the creator or group admins can delete expenses. Cannot delete expenses with existing settlements.",
      },
    }
  );
