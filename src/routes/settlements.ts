import { Elysia, t } from "elysia";
import { success, error, ErrorCodes, paginated } from "../lib/responses";
import { requireAuth } from "../middleware/auth";
import { findGroupById, isMemberOfGroup } from "../services/group.service";
import {
  SETTLEMENT_STATUSES,
  validateAmount,
  createSettlement,
  confirmSettlement,
  cancelSettlement,
  rejectSettlement,
  listSettlements,
  getSettlementDetails,
  getSuggestedSettlements,
  isGroupMember,
  getSettlementGroupId,
  type SettlementStatus,
} from "../services/settlement.service";
import {
  getExchangeRateService,
  isSupportedCurrency,
  CURRENCY_CODES,
} from "../services/currency";

// ============================================================================
// Request/Response Schemas
// ============================================================================

const createSettlementSchema = {
  body: t.Object({
    payerUserId: t.String(), // Who is paying (from)
    payeeUserId: t.String(), // Who is receiving (to)
    amount: t.Number({ minimum: 0.01 }),
    currency: t.Optional(t.String({ minLength: 3, maxLength: 3 })),
    note: t.Optional(t.String({ maxLength: 500 })),
  }),
  params: t.Object({
    groupId: t.String(),
  }),
  detail: {
    tags: ["Settlements"],
    summary: "Create settlement",
    description: "Create a new settlement (payment) between two group members. The settlement starts in 'pending' status until confirmed by the payee.",
  },
};

const listSettlementsSchema = {
  params: t.Object({
    groupId: t.String(),
  }),
  query: t.Object({
    page: t.Optional(t.Numeric()),
    limit: t.Optional(t.Numeric()),
    status: t.Optional(t.String()), // Can be single or comma-separated
    involvedUserId: t.Optional(t.String()),
    dateFrom: t.Optional(t.String()),
    dateTo: t.Optional(t.String()),
  }),
  detail: {
    tags: ["Settlements"],
    summary: "List settlements",
    description: "Get paginated list of settlements in a group with optional filters for status, involved user, and date range.",
  },
};

const settlementIdSchema = {
  params: t.Object({
    groupId: t.String(),
    settlementId: t.String(),
  }),
  detail: {
    tags: ["Settlements"],
    summary: "Get settlement details",
    description: "Get detailed information about a specific settlement including status history.",
  },
};

const rejectSettlementSchema = {
  params: t.Object({
    groupId: t.String(),
    settlementId: t.String(),
  }),
  body: t.Object({
    reason: t.Optional(t.String({ maxLength: 500 })),
  }),
  detail: {
    tags: ["Settlements"],
    summary: "Reject settlement",
    description: "Reject a pending settlement. Only the payee can reject. An optional reason can be provided.",
  },
};

// ============================================================================
// Settlement Routes
// ============================================================================

export const settlementRoutes = new Elysia({ prefix: "/groups/:groupId/settlements" })
  .use(requireAuth)

  // ========================================================================
  // GET /groups/:groupId/settlements/suggested - Get Suggested Settlements
  // AC-1.31 to AC-1.33
  // Sprint 005:
  // AC-1.9: Settlement suggestions can be displayed in a target currency
  // AC-1.10: Original currency and converted amount both shown
  // Note: This must come before /:settlementId to avoid route conflicts
  // ========================================================================
  .get(
    "/suggested",
    async ({ params, query, auth, authError, set }) => {
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
      const isMember = await isGroupMember(auth.userId, groupId);
      if (!isMember) {
        set.status = 403;
        return error(ErrorCodes.FORBIDDEN, "You are not a member of this group");
      }

      // AC-1.9: Optional currency parameter for conversion
      const targetCurrency = query?.currency?.toUpperCase();
      if (targetCurrency && !isSupportedCurrency(targetCurrency)) {
        set.status = 400;
        return error(
          ErrorCodes.VALIDATION_ERROR,
          `Currency '${targetCurrency}' is not supported. Supported: ${CURRENCY_CODES.join(", ")}`
        );
      }

      // Get suggested settlements
      const result = await getSuggestedSettlements(groupId);

      // AC-1.9, AC-1.10: Convert to target currency if specified
      if (targetCurrency && targetCurrency !== result.currency) {
        try {
          const exchangeService = getExchangeRateService();
          const conversionRate = await exchangeService.getRate(
            result.currency,
            targetCurrency
          );
          const rates = await exchangeService.getRates();

          return success({
            suggestions: result.suggestions.map((s) => ({
              from: s.from,
              to: s.to,
              // AC-1.10: Show both original and converted amounts
              originalAmount: s.amount,
              originalCurrency: result.currency,
              convertedAmount: Math.round(s.amount * conversionRate * 100) / 100,
              targetCurrency,
            })),
            currency: targetCurrency,
            conversion: {
              originalCurrency: result.currency,
              targetCurrency,
              conversionRate,
              rateTimestamp: rates.timestamp.toISOString(),
            },
          });
        } catch (err) {
          // If conversion fails, return original amounts
          console.error("Currency conversion failed:", err);
        }
      }

      return success({
        suggestions: result.suggestions.map((s) => ({
          from: s.from,
          to: s.to,
          amount: s.amount,
        })),
        currency: result.currency,
      });
    },
    {
      params: t.Object({ groupId: t.String() }),
      query: t.Optional(
        t.Object({
          currency: t.Optional(t.String({ minLength: 3, maxLength: 3 })),
        })
      ),
    }
  )

  // ========================================================================
  // POST /groups/:groupId/settlements - Create Settlement
  // AC-1.1 to AC-1.10
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

      // Check user is a member
      const isMember = await isGroupMember(auth.userId, groupId);
      if (!isMember) {
        set.status = 403;
        return error(ErrorCodes.FORBIDDEN, "You are not a member of this group");
      }

      // Validate amount
      const amountValidation = validateAmount(body.amount);
      if (!amountValidation.valid) {
        set.status = 400;
        return error(ErrorCodes.VALIDATION_ERROR, amountValidation.error!);
      }

      // Create settlement
      const result = await createSettlement(
        {
          groupId,
          payerUserId: body.payerUserId,
          payeeUserId: body.payeeUserId,
          amount: body.amount,
          currency: body.currency,
          note: body.note,
        },
        auth.userId
      );

      if (result.error) {
        set.status = 400;
        return error(ErrorCodes.VALIDATION_ERROR, result.error);
      }

      set.status = 201;
      return success(result.data);
    },
    createSettlementSchema
  )

  // ========================================================================
  // GET /groups/:groupId/settlements - List Settlements
  // AC-1.21 to AC-1.26
  // ========================================================================
  .get(
    "/",
    async ({ params, query, auth, authError, set }) => {
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
      const isMember = await isGroupMember(auth.userId, groupId);
      if (!isMember) {
        set.status = 403;
        return error(ErrorCodes.FORBIDDEN, "You are not a member of this group");
      }

      // Parse status filter (can be comma-separated)
      let statusFilter: SettlementStatus | SettlementStatus[] | undefined;
      if (query.status) {
        const statuses = query.status.split(",") as SettlementStatus[];
        // Validate statuses
        for (const s of statuses) {
          if (!SETTLEMENT_STATUSES.includes(s)) {
            set.status = 400;
            return error(
              ErrorCodes.VALIDATION_ERROR,
              `Invalid status: ${s}. Valid statuses: ${SETTLEMENT_STATUSES.join(", ")}`
            );
          }
        }
        statusFilter = statuses.length === 1 ? statuses[0] : statuses;
      }

      // List settlements
      const result = await listSettlements(groupId, {
        page: query.page,
        limit: query.limit,
        status: statusFilter,
        involvedUserId: query.involvedUserId,
        dateFrom: query.dateFrom ? new Date(query.dateFrom) : undefined,
        dateTo: query.dateTo ? new Date(query.dateTo) : undefined,
      });

      const page = query.page || 1;
      const limit = Math.min(query.limit || 20, 100);
      const totalPages = Math.ceil(result.total / limit);

      return paginated(result.settlements, page, limit, result.total);
    },
    listSettlementsSchema
  )

  // ========================================================================
  // GET /groups/:groupId/settlements/:settlementId - Get Settlement Details
  // AC-1.27 to AC-1.30
  // ========================================================================
  .get(
    "/:settlementId",
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

      // Check user is a member
      const isMember = await isGroupMember(auth.userId, groupId);
      if (!isMember) {
        set.status = 403;
        return error(ErrorCodes.FORBIDDEN, "You are not a member of this group");
      }

      // Verify settlement belongs to this group
      const settlementGroupId = await getSettlementGroupId(settlementId);
      if (!settlementGroupId || settlementGroupId !== groupId) {
        set.status = 404;
        return error(ErrorCodes.NOT_FOUND, "Settlement not found");
      }

      // Get settlement details
      const result = await getSettlementDetails(settlementId);

      if (result.error) {
        set.status = 404;
        return error(ErrorCodes.NOT_FOUND, result.error);
      }

      return success(result.data);
    },
    settlementIdSchema
  )

  // ========================================================================
  // PUT /groups/:groupId/settlements/:settlementId/confirm - Confirm Settlement
  // AC-1.11 to AC-1.15
  // ========================================================================
  .put(
    "/:settlementId/confirm",
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

      // Check user is a member
      const isMember = await isGroupMember(auth.userId, groupId);
      if (!isMember) {
        set.status = 403;
        return error(ErrorCodes.FORBIDDEN, "You are not a member of this group");
      }

      // Verify settlement belongs to this group
      const settlementGroupId = await getSettlementGroupId(settlementId);
      if (!settlementGroupId || settlementGroupId !== groupId) {
        set.status = 404;
        return error(ErrorCodes.NOT_FOUND, "Settlement not found");
      }

      // Confirm settlement
      const result = await confirmSettlement(settlementId, auth.userId);

      if (result.error) {
        set.status = 400;
        return error(ErrorCodes.VALIDATION_ERROR, result.error);
      }

      return success(result.data);
    },
    settlementIdSchema
  )

  // ========================================================================
  // PUT /groups/:groupId/settlements/:settlementId/cancel - Cancel Settlement
  // AC-1.16
  // ========================================================================
  .put(
    "/:settlementId/cancel",
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

      // Check user is a member
      const isMember = await isGroupMember(auth.userId, groupId);
      if (!isMember) {
        set.status = 403;
        return error(ErrorCodes.FORBIDDEN, "You are not a member of this group");
      }

      // Verify settlement belongs to this group
      const settlementGroupId = await getSettlementGroupId(settlementId);
      if (!settlementGroupId || settlementGroupId !== groupId) {
        set.status = 404;
        return error(ErrorCodes.NOT_FOUND, "Settlement not found");
      }

      // Cancel settlement
      const result = await cancelSettlement(settlementId, auth.userId);

      if (result.error) {
        set.status = 400;
        return error(ErrorCodes.VALIDATION_ERROR, result.error);
      }

      return success(result.data);
    },
    settlementIdSchema
  )

  // ========================================================================
  // PUT /groups/:groupId/settlements/:settlementId/reject - Reject Settlement
  // AC-1.17 to AC-1.20
  // ========================================================================
  .put(
    "/:settlementId/reject",
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

      // Check user is a member
      const isMember = await isGroupMember(auth.userId, groupId);
      if (!isMember) {
        set.status = 403;
        return error(ErrorCodes.FORBIDDEN, "You are not a member of this group");
      }

      // Verify settlement belongs to this group
      const settlementGroupId = await getSettlementGroupId(settlementId);
      if (!settlementGroupId || settlementGroupId !== groupId) {
        set.status = 404;
        return error(ErrorCodes.NOT_FOUND, "Settlement not found");
      }

      // Reject settlement
      const result = await rejectSettlement(settlementId, auth.userId, body?.reason);

      if (result.error) {
        set.status = 400;
        return error(ErrorCodes.VALIDATION_ERROR, result.error);
      }

      return success(result.data);
    },
    rejectSettlementSchema
  );
