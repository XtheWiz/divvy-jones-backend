/**
 * Analytics Routes
 * Sprint 007 - TASK-010
 *
 * Routes for spending analytics and reporting.
 *
 * AC-2.1: GET /groups/:groupId/analytics/summary returns spending summary
 * AC-2.4: Summary supports date range filtering (from, to)
 * AC-2.5: Summary supports period grouping (daily, weekly, monthly)
 * AC-2.6: GET /groups/:groupId/analytics/categories returns category breakdown
 * AC-2.9: GET /groups/:groupId/analytics/trends returns spending trends
 */

import { Elysia, t } from "elysia";
import { error, ErrorCodes } from "../lib/responses";
import { requireAuth } from "../middleware/auth";
import { findGroupById, isMemberOfGroup } from "../services/group.service";
import {
  getSpendingSummary,
  getCategoryAnalytics,
  getSpendingTrends,
  type PeriodType,
} from "../services/analytics.service";

// ============================================================================
// Request Schemas
// ============================================================================

const analyticsParamsSchema = t.Object({
  groupId: t.String(),
});

const analyticsQuerySchema = t.Object({
  startDate: t.Optional(t.String()),
  endDate: t.Optional(t.String()),
  period: t.Optional(t.Union([
    t.Literal("daily"),
    t.Literal("weekly"),
    t.Literal("monthly"),
  ])),
});

// ============================================================================
// Analytics Routes
// ============================================================================

export const analyticsRoutes = new Elysia({ prefix: "/groups/:groupId/analytics" })
  .use(requireAuth)

  // ========================================================================
  // GET /groups/:groupId/analytics/summary - Spending Summary
  // AC-2.1: Returns spending summary
  // AC-2.2: Includes total, average, count
  // AC-2.3: Includes per-member breakdown
  // AC-2.4: Supports date range filtering
  // ========================================================================
  .get(
    "/summary",
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

      // Only group members can view analytics
      const isMember = await isMemberOfGroup(auth.userId, groupId);
      if (!isMember) {
        set.status = 403;
        return error(ErrorCodes.FORBIDDEN, "You are not a member of this group");
      }

      // Parse date filters (AC-2.4)
      const dateFrom = query.startDate ? new Date(query.startDate) : undefined;
      const dateTo = query.endDate ? new Date(query.endDate) : undefined;

      // Validate dates
      if (dateFrom && isNaN(dateFrom.getTime())) {
        set.status = 400;
        return error(ErrorCodes.VALIDATION_ERROR, "Invalid startDate format");
      }
      if (dateTo && isNaN(dateTo.getTime())) {
        set.status = 400;
        return error(ErrorCodes.VALIDATION_ERROR, "Invalid endDate format");
      }

      // Get spending summary
      const summary = await getSpendingSummary({
        groupId,
        dateFrom,
        dateTo,
      });

      return {
        success: true,
        data: summary,
      };
    },
    {
      params: analyticsParamsSchema,
      query: analyticsQuerySchema,
      detail: {
        summary: "Get spending summary",
        description:
          "Get spending summary including totals and per-member breakdown. Supports date range filtering.",
        tags: ["Analytics"],
      },
    }
  )

  // ========================================================================
  // GET /groups/:groupId/analytics/categories - Category Breakdown
  // AC-2.6: Returns category breakdown
  // AC-2.7: Shows amount and percentage per category
  // AC-2.8: Sorted by total amount descending
  // ========================================================================
  .get(
    "/categories",
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

      // Only group members can view analytics
      const isMember = await isMemberOfGroup(auth.userId, groupId);
      if (!isMember) {
        set.status = 403;
        return error(ErrorCodes.FORBIDDEN, "You are not a member of this group");
      }

      // Parse date filters
      const dateFrom = query.startDate ? new Date(query.startDate) : undefined;
      const dateTo = query.endDate ? new Date(query.endDate) : undefined;

      // Validate dates
      if (dateFrom && isNaN(dateFrom.getTime())) {
        set.status = 400;
        return error(ErrorCodes.VALIDATION_ERROR, "Invalid startDate format");
      }
      if (dateTo && isNaN(dateTo.getTime())) {
        set.status = 400;
        return error(ErrorCodes.VALIDATION_ERROR, "Invalid endDate format");
      }

      // Get category analytics
      const categories = await getCategoryAnalytics({
        groupId,
        dateFrom,
        dateTo,
      });

      return {
        success: true,
        data: categories,
      };
    },
    {
      params: analyticsParamsSchema,
      query: analyticsQuerySchema,
      detail: {
        summary: "Get category breakdown",
        description:
          "Get spending breakdown by category with amounts and percentages. Categories are sorted by total amount descending.",
        tags: ["Analytics"],
      },
    }
  )

  // ========================================================================
  // GET /groups/:groupId/analytics/trends - Spending Trends
  // AC-2.9: Returns spending trends
  // AC-2.10: Shows spending over time for requested period
  // AC-2.5: Supports period grouping (daily, weekly, monthly)
  // ========================================================================
  .get(
    "/trends",
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

      // Only group members can view analytics
      const isMember = await isMemberOfGroup(auth.userId, groupId);
      if (!isMember) {
        set.status = 403;
        return error(ErrorCodes.FORBIDDEN, "You are not a member of this group");
      }

      // Parse date filters
      const dateFrom = query.startDate ? new Date(query.startDate) : undefined;
      const dateTo = query.endDate ? new Date(query.endDate) : undefined;

      // Validate dates
      if (dateFrom && isNaN(dateFrom.getTime())) {
        set.status = 400;
        return error(ErrorCodes.VALIDATION_ERROR, "Invalid startDate format");
      }
      if (dateTo && isNaN(dateTo.getTime())) {
        set.status = 400;
        return error(ErrorCodes.VALIDATION_ERROR, "Invalid endDate format");
      }

      // Validate period (AC-2.5)
      const period = (query.period as PeriodType) || "monthly";

      // Get spending trends
      const trends = await getSpendingTrends({
        groupId,
        dateFrom,
        dateTo,
        period,
      });

      return {
        success: true,
        data: trends,
      };
    },
    {
      params: analyticsParamsSchema,
      query: analyticsQuerySchema,
      detail: {
        summary: "Get spending trends",
        description:
          "Get spending trends over time. Supports daily, weekly, or monthly grouping via the 'period' query parameter.",
        tags: ["Analytics"],
      },
    }
  );
