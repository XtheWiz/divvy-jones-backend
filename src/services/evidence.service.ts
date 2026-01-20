/**
 * Evidence Service
 * Sprint 004 - TASK-006
 *
 * Handles CRUD operations for file attachments (evidences) on expenses and settlements.
 */

import { eq, and, count } from "drizzle-orm";
import {
  db,
  evidences,
  expenses,
  settlements,
  groupMembers,
  users,
  type Evidence,
  type NewEvidence,
  EVIDENCE_TARGETS,
} from "../db";
import {
  getStorage,
  generateFileKey,
  validateFile,
  validateFileAsync,
  MAX_EXPENSE_ATTACHMENTS,
  MAX_SETTLEMENT_ATTACHMENTS,
} from "../lib/storage";

// ============================================================================
// Types
// ============================================================================

export type EvidenceTarget = (typeof EVIDENCE_TARGETS)[number];

export interface UploadEvidenceParams {
  target: EvidenceTarget;
  targetId: string;
  file: Buffer;
  mimeType: string;
  originalName: string;
  createdByUserId: string;
}

export interface EvidenceWithCreator extends Evidence {
  createdBy: {
    id: string;
    displayName: string;
  };
}

// ============================================================================
// Validation Functions
// ============================================================================

/**
 * Validate file for upload
 */
export function validateEvidenceFile(
  buffer: Buffer,
  mimeType: string
): { valid: boolean; error?: string } {
  return validateFile(buffer, mimeType);
}

/**
 * Check if attachment limit is reached for a target
 */
export async function checkAttachmentLimit(
  target: EvidenceTarget,
  targetId: string
): Promise<{ allowed: boolean; current: number; max: number }> {
  const max =
    target === "expense" ? MAX_EXPENSE_ATTACHMENTS : MAX_SETTLEMENT_ATTACHMENTS;

  const [result] = await db
    .select({ count: count() })
    .from(evidences)
    .where(
      target === "expense"
        ? eq(evidences.expenseId, targetId)
        : eq(evidences.settlementId, targetId)
    );

  const current = result?.count || 0;

  return {
    allowed: current < max,
    current,
    max,
  };
}

// ============================================================================
// CRUD Operations
// ============================================================================

/**
 * Upload an evidence/attachment
 * AC-1.1, AC-1.3, AC-1.4, AC-1.5, AC-1.6, AC-1.13, AC-1.20
 * Sprint 005: AC-0.6, AC-0.7, AC-0.8, AC-0.9 (magic number validation)
 */
export async function uploadEvidence(
  params: UploadEvidenceParams
): Promise<Evidence> {
  const { target, targetId, file, mimeType, originalName, createdByUserId } =
    params;

  // Validate file with magic number verification
  const validation = await validateFileAsync(file, mimeType);
  if (!validation.valid) {
    throw new Error(validation.error);
  }

  // Check attachment limit
  const limitCheck = await checkAttachmentLimit(target, targetId);
  if (!limitCheck.allowed) {
    throw new Error(
      `Maximum ${limitCheck.max} attachments allowed per ${target}. Current: ${limitCheck.current}`
    );
  }

  // Generate unique file key
  const fileKey = generateFileKey(target, mimeType);

  // Upload to storage
  const storage = getStorage();
  await storage.upload(file, fileKey, mimeType);

  // Create evidence record
  const [evidence] = await db
    .insert(evidences)
    .values({
      target,
      expenseId: target === "expense" ? targetId : null,
      settlementId: target === "settlement" ? targetId : null,
      fileKey,
      mimeType,
      sizeBytes: file.length,
      createdByUserId,
    })
    .returning();

  return evidence;
}

/**
 * List all evidences for a target (expense or settlement)
 * AC-1.8, AC-1.15
 */
export async function listEvidences(
  target: EvidenceTarget,
  targetId: string
): Promise<EvidenceWithCreator[]> {
  const results = await db
    .select({
      id: evidences.id,
      target: evidences.target,
      expenseId: evidences.expenseId,
      settlementId: evidences.settlementId,
      fileKey: evidences.fileKey,
      mimeType: evidences.mimeType,
      sizeBytes: evidences.sizeBytes,
      createdByUserId: evidences.createdByUserId,
      createdAt: evidences.createdAt,
      creatorId: users.id,
      creatorDisplayName: users.displayName,
    })
    .from(evidences)
    .innerJoin(users, eq(users.id, evidences.createdByUserId))
    .where(
      target === "expense"
        ? eq(evidences.expenseId, targetId)
        : eq(evidences.settlementId, targetId)
    )
    .orderBy(evidences.createdAt);

  return results.map((r) => ({
    id: r.id,
    target: r.target,
    expenseId: r.expenseId,
    settlementId: r.settlementId,
    fileKey: r.fileKey,
    mimeType: r.mimeType,
    sizeBytes: r.sizeBytes,
    createdByUserId: r.createdByUserId,
    createdAt: r.createdAt,
    createdBy: {
      id: r.creatorId,
      displayName: r.creatorDisplayName,
    },
  }));
}

/**
 * Get a single evidence by ID
 * AC-1.9, AC-1.16
 */
export async function getEvidence(
  evidenceId: string
): Promise<EvidenceWithCreator | null> {
  const [result] = await db
    .select({
      id: evidences.id,
      target: evidences.target,
      expenseId: evidences.expenseId,
      settlementId: evidences.settlementId,
      fileKey: evidences.fileKey,
      mimeType: evidences.mimeType,
      sizeBytes: evidences.sizeBytes,
      createdByUserId: evidences.createdByUserId,
      createdAt: evidences.createdAt,
      creatorId: users.id,
      creatorDisplayName: users.displayName,
    })
    .from(evidences)
    .innerJoin(users, eq(users.id, evidences.createdByUserId))
    .where(eq(evidences.id, evidenceId))
    .limit(1);

  if (!result) {
    return null;
  }

  return {
    id: result.id,
    target: result.target,
    expenseId: result.expenseId,
    settlementId: result.settlementId,
    fileKey: result.fileKey,
    mimeType: result.mimeType,
    sizeBytes: result.sizeBytes,
    createdByUserId: result.createdByUserId,
    createdAt: result.createdAt,
    createdBy: {
      id: result.creatorId,
      displayName: result.creatorDisplayName,
    },
  };
}

/**
 * Download evidence file
 */
export async function downloadEvidence(evidenceId: string): Promise<{
  buffer: Buffer;
  mimeType: string;
  filename: string;
} | null> {
  const evidence = await getEvidence(evidenceId);
  if (!evidence) {
    return null;
  }

  const storage = getStorage();
  const buffer = await storage.download(evidence.fileKey);

  // Generate a readable filename
  const extension = evidence.fileKey.split(".").pop() || "bin";
  const filename = "attachment-" + evidenceId.slice(0, 8) + "." + extension;

  return {
    buffer,
    mimeType: evidence.mimeType,
    filename,
  };
}

/**
 * Delete an evidence
 * AC-1.10, AC-1.17
 */
export async function deleteEvidence(evidenceId: string): Promise<boolean> {
  const evidence = await getEvidence(evidenceId);
  if (!evidence) {
    return false;
  }

  // Delete from storage
  const storage = getStorage();
  await storage.delete(evidence.fileKey);

  // Delete from database
  await db.delete(evidences).where(eq(evidences.id, evidenceId));

  return true;
}

/**
 * Count evidences for a target
 */
export async function countEvidences(
  target: EvidenceTarget,
  targetId: string
): Promise<number> {
  const [result] = await db
    .select({ count: count() })
    .from(evidences)
    .where(
      target === "expense"
        ? eq(evidences.expenseId, targetId)
        : eq(evidences.settlementId, targetId)
    );

  return result?.count || 0;
}

// ============================================================================
// Authorization Helpers
// ============================================================================

/**
 * Check if user can upload attachment to an expense
 * AC-1.12: Only group members can upload
 */
export async function canUploadToExpense(
  userId: string,
  expenseId: string
): Promise<{ allowed: boolean; expense?: any; membership?: any }> {
  // Get expense with group info
  const [expense] = await db
    .select({
      id: expenses.id,
      groupId: expenses.groupId,
      createdByMemberId: expenses.createdByMemberId,
    })
    .from(expenses)
    .where(eq(expenses.id, expenseId))
    .limit(1);

  if (!expense) {
    return { allowed: false };
  }

  // Check if user is a group member
  const [membership] = await db
    .select()
    .from(groupMembers)
    .where(
      and(
        eq(groupMembers.groupId, expense.groupId),
        eq(groupMembers.userId, userId),
        eq(groupMembers.status, "active")
      )
    )
    .limit(1);

  if (!membership) {
    return { allowed: false };
  }

  return { allowed: true, expense, membership };
}

/**
 * Check if user can upload attachment to a settlement
 * AC-1.18: Only payer can upload attachments to their settlements
 */
export async function canUploadToSettlement(
  userId: string,
  settlementId: string
): Promise<{ allowed: boolean; settlement?: any; membership?: any }> {
  // Get settlement with payer info
  const [settlement] = await db
    .select({
      id: settlements.id,
      groupId: settlements.groupId,
      payerMemberId: settlements.payerMemberId,
    })
    .from(settlements)
    .where(eq(settlements.id, settlementId))
    .limit(1);

  if (!settlement) {
    return { allowed: false };
  }

  // Get the payer's membership
  const [payerMembership] = await db
    .select()
    .from(groupMembers)
    .where(eq(groupMembers.id, settlement.payerMemberId))
    .limit(1);

  if (!payerMembership) {
    return { allowed: false };
  }

  // Check if the user is the payer
  if (payerMembership.userId !== userId) {
    return { allowed: false };
  }

  return { allowed: true, settlement, membership: payerMembership };
}

/**
 * Check if user can delete an attachment
 * AC-1.11: Only expense creator and group admins can delete expense attachments
 */
export async function canDeleteEvidence(
  userId: string,
  evidenceId: string
): Promise<boolean> {
  const evidence = await getEvidence(evidenceId);
  if (!evidence) {
    return false;
  }

  // User who created the evidence can always delete it
  if (evidence.createdByUserId === userId) {
    return true;
  }

  // For expense attachments, check if user is expense creator or admin
  if (evidence.target === "expense" && evidence.expenseId) {
    const [expense] = await db
      .select({
        createdByMemberId: expenses.createdByMemberId,
        groupId: expenses.groupId,
      })
      .from(expenses)
      .where(eq(expenses.id, evidence.expenseId))
      .limit(1);

    if (!expense) {
      return false;
    }

    // Check if user is expense creator
    const [creatorMembership] = await db
      .select()
      .from(groupMembers)
      .where(eq(groupMembers.id, expense.createdByMemberId))
      .limit(1);

    if (creatorMembership?.userId === userId) {
      return true;
    }

    // Check if user is admin/owner
    const [userMembership] = await db
      .select()
      .from(groupMembers)
      .where(
        and(
          eq(groupMembers.groupId, expense.groupId),
          eq(groupMembers.userId, userId),
          eq(groupMembers.status, "active")
        )
      )
      .limit(1);

    if (
      userMembership?.role === "owner" ||
      userMembership?.role === "admin"
    ) {
      return true;
    }
  }

  // For settlement attachments, only the payer (uploader) can delete
  // This is already handled by the createdByUserId check above

  return false;
}

/**
 * Check if user can view attachments for a target
 * AC-1.12: Only group members can view attachments
 */
export async function canViewAttachments(
  userId: string,
  target: EvidenceTarget,
  targetId: string
): Promise<boolean> {
  let groupId: string | null = null;

  if (target === "expense") {
    const [expense] = await db
      .select({ groupId: expenses.groupId })
      .from(expenses)
      .where(eq(expenses.id, targetId))
      .limit(1);
    groupId = expense?.groupId || null;
  } else {
    const [settlement] = await db
      .select({ groupId: settlements.groupId })
      .from(settlements)
      .where(eq(settlements.id, targetId))
      .limit(1);
    groupId = settlement?.groupId || null;
  }

  if (!groupId) {
    return false;
  }

  const [membership] = await db
    .select()
    .from(groupMembers)
    .where(
      and(
        eq(groupMembers.groupId, groupId),
        eq(groupMembers.userId, userId),
        eq(groupMembers.status, "active")
      )
    )
    .limit(1);

  return !!membership;
}

// ============================================================================
// URL Generation
// ============================================================================

/**
 * Get download URL for an evidence
 */
export async function getEvidenceDownloadUrl(
  evidenceId: string,
  expiresIn?: number
): Promise<string | null> {
  const evidence = await getEvidence(evidenceId);
  if (!evidence) {
    return null;
  }

  const storage = getStorage();
  return storage.getUrl(evidence.fileKey, expiresIn);
}
