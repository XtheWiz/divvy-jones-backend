/**
 * Export Routes
 * Sprint 005 - TASK-013
 * Sprint 007 - TASK-005 (PDF Export)
 *
 * Routes for exporting group expenses in CSV, JSON, and PDF formats.
 */

import { Elysia, t } from "elysia";
import { success, error, ErrorCodes } from "../lib/responses";
import { requireAuth } from "../middleware/auth";
import { findGroupById, isMemberOfGroup } from "../services/group.service";
import {
  generateCsvExport,
  generateJsonExport,
  generatePdfExport,
} from "../services/export";

// ============================================================================
// Request Schemas
// ============================================================================

const exportParamsSchema = t.Object({
  groupId: t.String(),
});

const exportQuerySchema = t.Object({
  startDate: t.Optional(t.String()),
  endDate: t.Optional(t.String()),
});

// ============================================================================
// Export Routes
// ============================================================================

export const exportRoutes = new Elysia({ prefix: "/groups/:groupId/export" })
  .use(requireAuth)

  // ========================================================================
  // GET /groups/:groupId/export/csv - Export Expenses as CSV
  // AC-2.1: GET /groups/:groupId/export/csv exports expenses as CSV
  // AC-2.2: CSV includes: date, description, amount, currency, payer, splits
  // AC-2.3: CSV export can be filtered by date range
  // AC-2.4: Filename includes group name and date range
  // AC-2.7: Only group members can export group data
  // AC-2.8: Export includes only active (non-deleted) expenses
  // ========================================================================
  .get(
    "/csv",
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

      // AC-2.7: Only group members can export
      const { isMember } = await isMemberOfGroup(auth.userId, groupId);
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

      // Generate CSV export
      const result = await generateCsvExport({
        groupId,
        dateFrom,
        dateTo,
      });

      // Set headers for file download
      set.headers = {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${result.filename}"`,
      };

      return result.csv;
    },
    {
      params: exportParamsSchema,
      query: exportQuerySchema,
      detail: {
        summary: "Export expenses as CSV",
        description: "Export all group expenses as a CSV file. Supports date range filtering.",
        tags: ["Export"],
      },
    }
  )

  // ========================================================================
  // GET /groups/:groupId/export/json - Export Expenses as JSON
  // AC-2.5: GET /groups/:groupId/export/json exports full expense data
  // AC-2.6: JSON includes all expense details including attachments metadata
  // AC-2.7: Only group members can export group data
  // AC-2.8: Export includes only active (non-deleted) expenses
  // ========================================================================
  .get(
    "/json",
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

      // AC-2.7: Only group members can export
      const { isMember } = await isMemberOfGroup(auth.userId, groupId);
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

      // Generate JSON export
      const result = await generateJsonExport({
        groupId,
        dateFrom,
        dateTo,
      });

      // Set headers for file download
      set.headers = {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": `attachment; filename="${result.filename}"`,
      };

      return result.json;
    },
    {
      params: exportParamsSchema,
      query: exportQuerySchema,
      detail: {
        summary: "Export expenses as JSON",
        description:
          "Export all group expenses as a JSON file with full details including attachments metadata.",
        tags: ["Export"],
      },
    }
  )

  // ========================================================================
  // GET /groups/:groupId/export/pdf - Export Expenses as PDF Report
  // Sprint 007 - TASK-005
  // AC-1.5: GET /groups/:groupId/export/pdf exports expenses as PDF
  // AC-1.6: PDF export can be filtered by date range
  // AC-1.7: Only group members can export group data
  // AC-1.8: PDF filename includes group name and date range
  // ========================================================================
  .get(
    "/pdf",
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

      // AC-1.7: Only group members can export
      const { isMember } = await isMemberOfGroup(auth.userId, groupId);
      if (!isMember) {
        set.status = 403;
        return error(ErrorCodes.FORBIDDEN, "You are not a member of this group");
      }

      // Parse date filters (AC-1.6)
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

      // Generate PDF export (AC-1.5)
      const result = await generatePdfExport({
        groupId,
        dateFrom,
        dateTo,
      });

      // Set headers for file download (AC-1.8)
      set.headers = {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${result.filename}"`,
      };

      return result.pdf;
    },
    {
      params: exportParamsSchema,
      query: exportQuerySchema,
      detail: {
        summary: "Export expenses as PDF",
        description:
          "Export group expense report as a PDF file with summary, expense table, and balance summary. Supports date range filtering.",
        tags: ["Export"],
      },
    }
  );
