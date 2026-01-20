/**
 * Attachment Routes
 * Sprint 004 - TASK-007, TASK-008
 *
 * REST endpoints for expense and settlement attachments.
 */

import { Elysia, t } from "elysia";
import { success, error, ErrorCodes } from "../lib/responses";
import { requireAuth } from "../middleware/auth";
import {
  uploadEvidence,
  listEvidences,
  getEvidence,
  downloadEvidence,
  deleteEvidence,
  canUploadToExpense,
  canUploadToSettlement,
  canDeleteEvidence,
  canViewAttachments,
  getEvidenceDownloadUrl,
} from "../services/evidence.service";
import { ALLOWED_MIME_TYPES, MAX_FILE_SIZE } from "../lib/storage";

// ============================================================================
// Expense Attachment Routes
// ============================================================================

export const expenseAttachmentRoutes = new Elysia({
  prefix: "/groups/:groupId/expenses/:expenseId/attachments",
})
  .use(requireAuth)

  // ========================================================================
  // POST /groups/:groupId/expenses/:expenseId/attachments - Upload Attachment
  // AC-1.1: File upload endpoint accepts multipart/form-data
  // AC-1.7: Upload attachment to expense
  // AC-1.12: Only group members can upload
  // ========================================================================
  .post(
    "/",
    async ({ params, body, auth, authError, set }) => {
      if (!auth) {
        set.status = 401;
        return authError;
      }

      const { expenseId } = params;
      const file = body.file;

      if (!file) {
        set.status = 400;
        return error(ErrorCodes.VALIDATION_ERROR, "No file provided");
      }

      // Check authorization
      const authCheck = await canUploadToExpense(auth.userId, expenseId);
      if (!authCheck.allowed) {
        set.status = 403;
        return error(
          ErrorCodes.FORBIDDEN,
          "You do not have permission to upload attachments to this expense"
        );
      }

      try {
        // Convert Bun File to Buffer
        const buffer = Buffer.from(await file.arrayBuffer());
        const mimeType = file.type;
        const originalName = file.name;

        const evidence = await uploadEvidence({
          target: "expense",
          targetId: expenseId,
          file: buffer,
          mimeType,
          originalName,
          createdByUserId: auth.userId,
        });

        const downloadUrl = await getEvidenceDownloadUrl(evidence.id);

        set.status = 201;
        return success({
          id: evidence.id,
          mimeType: evidence.mimeType,
          sizeBytes: evidence.sizeBytes,
          downloadUrl,
          createdAt: evidence.createdAt,
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : "Upload failed";
        set.status = 400;
        return error(ErrorCodes.VALIDATION_ERROR, message);
      }
    },
    {
      params: t.Object({
        groupId: t.String(),
        expenseId: t.String(),
      }),
      body: t.Object({
        file: t.File({
          maxSize: MAX_FILE_SIZE,
        }),
      }),
    }
  )

  // ========================================================================
  // GET /groups/:groupId/expenses/:expenseId/attachments - List Attachments
  // AC-1.8: List attachments for expense
  // AC-1.12: Only group members can view
  // ========================================================================
  .get(
    "/",
    async ({ params, auth, authError, set }) => {
      if (!auth) {
        set.status = 401;
        return authError;
      }

      const { expenseId } = params;

      // Check authorization
      const canView = await canViewAttachments(auth.userId, "expense", expenseId);
      if (!canView) {
        set.status = 403;
        return error(
          ErrorCodes.FORBIDDEN,
          "You do not have permission to view attachments for this expense"
        );
      }

      const evidences = await listEvidences("expense", expenseId);

      return success(
        await Promise.all(
          evidences.map(async (e) => ({
            id: e.id,
            mimeType: e.mimeType,
            sizeBytes: e.sizeBytes,
            downloadUrl: await getEvidenceDownloadUrl(e.id),
            createdBy: e.createdBy,
            createdAt: e.createdAt,
          }))
        )
      );
    },
    {
      params: t.Object({
        groupId: t.String(),
        expenseId: t.String(),
      }),
    }
  )

  // ========================================================================
  // GET /groups/:groupId/expenses/:expenseId/attachments/:attachmentId - Download
  // AC-1.9: Download attachment
  // AC-1.12: Only group members can download
  // ========================================================================
  .get(
    "/:attachmentId",
    async ({ params, auth, authError, set }) => {
      if (!auth) {
        set.status = 401;
        return authError;
      }

      const { expenseId, attachmentId } = params;

      // Check authorization
      const canView = await canViewAttachments(auth.userId, "expense", expenseId);
      if (!canView) {
        set.status = 403;
        return error(
          ErrorCodes.FORBIDDEN,
          "You do not have permission to download this attachment"
        );
      }

      // Verify attachment belongs to this expense
      const evidence = await getEvidence(attachmentId);
      if (!evidence || evidence.expenseId !== expenseId) {
        set.status = 404;
        return error(ErrorCodes.NOT_FOUND, "Attachment not found");
      }

      const download = await downloadEvidence(attachmentId);
      if (!download) {
        set.status = 404;
        return error(ErrorCodes.NOT_FOUND, "Attachment file not found");
      }

      // Return file as response
      set.headers["content-type"] = download.mimeType;
      set.headers["content-disposition"] =
        'attachment; filename="' + download.filename + '"';

      return download.buffer;
    },
    {
      params: t.Object({
        groupId: t.String(),
        expenseId: t.String(),
        attachmentId: t.String(),
      }),
    }
  )

  // ========================================================================
  // DELETE /groups/:groupId/expenses/:expenseId/attachments/:attachmentId - Delete
  // AC-1.10: Delete attachment
  // AC-1.11: Only expense creator and group admins can delete
  // ========================================================================
  .delete(
    "/:attachmentId",
    async ({ params, auth, authError, set }) => {
      if (!auth) {
        set.status = 401;
        return authError;
      }

      const { expenseId, attachmentId } = params;

      // Verify attachment belongs to this expense
      const evidence = await getEvidence(attachmentId);
      if (!evidence || evidence.expenseId !== expenseId) {
        set.status = 404;
        return error(ErrorCodes.NOT_FOUND, "Attachment not found");
      }

      // Check authorization
      const canDelete = await canDeleteEvidence(auth.userId, attachmentId);
      if (!canDelete) {
        set.status = 403;
        return error(
          ErrorCodes.FORBIDDEN,
          "You do not have permission to delete this attachment"
        );
      }

      const deleted = await deleteEvidence(attachmentId);
      if (!deleted) {
        set.status = 500;
        return error(ErrorCodes.INTERNAL_ERROR, "Failed to delete attachment");
      }

      return success({ message: "Attachment deleted successfully" });
    },
    {
      params: t.Object({
        groupId: t.String(),
        expenseId: t.String(),
        attachmentId: t.String(),
      }),
    }
  );

// ============================================================================
// Settlement Attachment Routes
// ============================================================================

export const settlementAttachmentRoutes = new Elysia({
  prefix: "/groups/:groupId/settlements/:settlementId/attachments",
})
  .use(requireAuth)

  // ========================================================================
  // POST /groups/:groupId/settlements/:settlementId/attachments - Upload
  // AC-1.14: Upload attachment to settlement
  // AC-1.18: Only payer can upload
  // ========================================================================
  .post(
    "/",
    async ({ params, body, auth, authError, set }) => {
      if (!auth) {
        set.status = 401;
        return authError;
      }

      const { settlementId } = params;
      const file = body.file;

      if (!file) {
        set.status = 400;
        return error(ErrorCodes.VALIDATION_ERROR, "No file provided");
      }

      // Check authorization - only payer can upload
      const authCheck = await canUploadToSettlement(auth.userId, settlementId);
      if (!authCheck.allowed) {
        set.status = 403;
        return error(
          ErrorCodes.FORBIDDEN,
          "Only the payer can upload attachments to a settlement"
        );
      }

      try {
        // Convert Bun File to Buffer
        const buffer = Buffer.from(await file.arrayBuffer());
        const mimeType = file.type;
        const originalName = file.name;

        const evidence = await uploadEvidence({
          target: "settlement",
          targetId: settlementId,
          file: buffer,
          mimeType,
          originalName,
          createdByUserId: auth.userId,
        });

        const downloadUrl = await getEvidenceDownloadUrl(evidence.id);

        set.status = 201;
        return success({
          id: evidence.id,
          mimeType: evidence.mimeType,
          sizeBytes: evidence.sizeBytes,
          downloadUrl,
          createdAt: evidence.createdAt,
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : "Upload failed";
        set.status = 400;
        return error(ErrorCodes.VALIDATION_ERROR, message);
      }
    },
    {
      params: t.Object({
        groupId: t.String(),
        settlementId: t.String(),
      }),
      body: t.Object({
        file: t.File({
          maxSize: MAX_FILE_SIZE,
        }),
      }),
    }
  )

  // ========================================================================
  // GET /groups/:groupId/settlements/:settlementId/attachments - List
  // AC-1.15: List settlement attachments
  // ========================================================================
  .get(
    "/",
    async ({ params, auth, authError, set }) => {
      if (!auth) {
        set.status = 401;
        return authError;
      }

      const { settlementId } = params;

      // Check authorization
      const canView = await canViewAttachments(
        auth.userId,
        "settlement",
        settlementId
      );
      if (!canView) {
        set.status = 403;
        return error(
          ErrorCodes.FORBIDDEN,
          "You do not have permission to view attachments for this settlement"
        );
      }

      const evidences = await listEvidences("settlement", settlementId);

      return success(
        await Promise.all(
          evidences.map(async (e) => ({
            id: e.id,
            mimeType: e.mimeType,
            sizeBytes: e.sizeBytes,
            downloadUrl: await getEvidenceDownloadUrl(e.id),
            createdBy: e.createdBy,
            createdAt: e.createdAt,
          }))
        )
      );
    },
    {
      params: t.Object({
        groupId: t.String(),
        settlementId: t.String(),
      }),
    }
  )

  // ========================================================================
  // GET /groups/:groupId/settlements/:settlementId/attachments/:attachmentId - Download
  // AC-1.16: Download settlement attachment
  // ========================================================================
  .get(
    "/:attachmentId",
    async ({ params, auth, authError, set }) => {
      if (!auth) {
        set.status = 401;
        return authError;
      }

      const { settlementId, attachmentId } = params;

      // Check authorization
      const canView = await canViewAttachments(
        auth.userId,
        "settlement",
        settlementId
      );
      if (!canView) {
        set.status = 403;
        return error(
          ErrorCodes.FORBIDDEN,
          "You do not have permission to download this attachment"
        );
      }

      // Verify attachment belongs to this settlement
      const evidence = await getEvidence(attachmentId);
      if (!evidence || evidence.settlementId !== settlementId) {
        set.status = 404;
        return error(ErrorCodes.NOT_FOUND, "Attachment not found");
      }

      const download = await downloadEvidence(attachmentId);
      if (!download) {
        set.status = 404;
        return error(ErrorCodes.NOT_FOUND, "Attachment file not found");
      }

      // Return file as response
      set.headers["content-type"] = download.mimeType;
      set.headers["content-disposition"] =
        'attachment; filename="' + download.filename + '"';

      return download.buffer;
    },
    {
      params: t.Object({
        groupId: t.String(),
        settlementId: t.String(),
        attachmentId: t.String(),
      }),
    }
  )

  // ========================================================================
  // DELETE /groups/:groupId/settlements/:settlementId/attachments/:attachmentId - Delete
  // AC-1.17: Delete settlement attachment
  // AC-1.18: Only payer can delete
  // ========================================================================
  .delete(
    "/:attachmentId",
    async ({ params, auth, authError, set }) => {
      if (!auth) {
        set.status = 401;
        return authError;
      }

      const { settlementId, attachmentId } = params;

      // Verify attachment belongs to this settlement
      const evidence = await getEvidence(attachmentId);
      if (!evidence || evidence.settlementId !== settlementId) {
        set.status = 404;
        return error(ErrorCodes.NOT_FOUND, "Attachment not found");
      }

      // Check authorization
      const canDelete = await canDeleteEvidence(auth.userId, attachmentId);
      if (!canDelete) {
        set.status = 403;
        return error(
          ErrorCodes.FORBIDDEN,
          "You do not have permission to delete this attachment"
        );
      }

      const deleted = await deleteEvidence(attachmentId);
      if (!deleted) {
        set.status = 500;
        return error(ErrorCodes.INTERNAL_ERROR, "Failed to delete attachment");
      }

      return success({ message: "Attachment deleted successfully" });
    },
    {
      params: t.Object({
        groupId: t.String(),
        settlementId: t.String(),
        attachmentId: t.String(),
      }),
    }
  );
