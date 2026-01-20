import { eq, and, isNull, desc, gte, lte, or, count, inArray } from "drizzle-orm";
import {
  db,
  groups,
  settlements,
  groupMembers,
  users,
  evidences,
  type Settlement,
  SETTLEMENT_STATUSES,
  type SettlementStatus,
} from "../db";
import { calculateGroupBalances, type SimplifiedDebt } from "./balance.service";
import {
  notifySettlementRequested,
  notifySettlementConfirmed,
  notifySettlementRejected,
} from "./notification.service";
import {
  logSettlementCreated,
  logSettlementConfirmed as logSettlementConfirmedActivity,
  logSettlementRejected as logSettlementRejectedActivity,
  logSettlementCancelled,
} from "./activity.service";

// ============================================================================
// Constants
// ============================================================================

export { SETTLEMENT_STATUSES };
export type { SettlementStatus };

const VALID_STATUS_TRANSITIONS: Record<SettlementStatus, SettlementStatus[]> = {
  pending: ["confirmed", "rejected", "cancelled"],
  confirmed: [],
  rejected: [],
  cancelled: [],
};

// ============================================================================
// Types
// ============================================================================

export interface CreateSettlementInput {
  groupId: string;
  payerUserId: string; // Who is paying (from)
  payeeUserId: string; // Who is receiving (to)
  amount: number;
  currency?: string;
  note?: string;
  date?: Date;
}

export interface SettlementListFilters {
  status?: SettlementStatus | SettlementStatus[];
  involvedUserId?: string;
  dateFrom?: Date;
  dateTo?: Date;
  page?: number;
  limit?: number;
}

export interface SettlementListItem {
  id: string;
  payer: {
    memberId: string;
    userId: string;
    displayName: string;
  };
  payee: {
    memberId: string;
    userId: string;
    displayName: string;
  };
  amount: number;
  currency: string;
  status: SettlementStatus;
  note: string | null;
  createdAt: Date;
  settledAt: Date | null;
}

export interface SettlementAttachment {
  id: string;
  mimeType: string;
  sizeBytes: number;
  createdAt: Date;
  createdBy: {
    userId: string;
    displayName: string;
  };
}

export interface SettlementDetails extends SettlementListItem {
  attachments: SettlementAttachment[];
  updatedAt: Date;
}

// ============================================================================
// Validation Functions
// ============================================================================

/**
 * Validate settlement amount
 * AC-1.3: Amount must be positive with max 2 decimal places
 */
export function validateAmount(amount: number): { valid: boolean; error?: string } {
  if (typeof amount !== "number" || isNaN(amount)) {
    return { valid: false, error: "Amount must be a number" };
  }
  if (amount <= 0) {
    return { valid: false, error: "Amount must be positive" };
  }
  // Check for max 2 decimal places
  const decimalPart = amount.toString().split(".")[1];
  if (decimalPart && decimalPart.length > 2) {
    return { valid: false, error: "Amount can have at most 2 decimal places" };
  }
  return { valid: true };
}

/**
 * Get member info from user ID and group ID
 */
async function getMemberInfo(
  userId: string,
  groupId: string
): Promise<{ memberId: string; displayName: string } | null> {
  const [member] = await db
    .select({
      memberId: groupMembers.id,
      displayName: users.displayName,
    })
    .from(groupMembers)
    .innerJoin(users, eq(groupMembers.userId, users.id))
    .where(
      and(
        eq(groupMembers.userId, userId),
        eq(groupMembers.groupId, groupId),
        isNull(groupMembers.leftAt)
      )
    )
    .limit(1);

  return member || null;
}

// ============================================================================
// Settlement Service Functions
// ============================================================================

/**
 * Create a new settlement request
 * AC-1.1 to AC-1.10
 */
export async function createSettlement(
  input: CreateSettlementInput,
  createdByUserId: string
): Promise<{ data?: SettlementDetails; error?: string }> {
  // AC-1.5: Payer and payee cannot be the same person
  if (input.payerUserId === input.payeeUserId) {
    return { error: "Payer and payee cannot be the same person" };
  }

  // AC-1.3: Validate amount
  const amountValidation = validateAmount(input.amount);
  if (!amountValidation.valid) {
    return { error: amountValidation.error };
  }

  // AC-1.4: Get payer's member info (must be active member)
  const payerInfo = await getMemberInfo(input.payerUserId, input.groupId);
  if (!payerInfo) {
    return { error: "Payer is not an active member of the group" };
  }

  // AC-1.4: Get payee's member info (must be active member)
  const payeeInfo = await getMemberInfo(input.payeeUserId, input.groupId);
  if (!payeeInfo) {
    return { error: "Payee is not an active member of the group" };
  }

  // AC-1.6: Get default currency if not provided
  let currency = input.currency;
  if (!currency) {
    const [group] = await db
      .select({ currency: groups.defaultCurrencyCode })
      .from(groups)
      .where(eq(groups.id, input.groupId))
      .limit(1);
    currency = group?.currency || "USD";
  }

  // AC-1.9: Create settlement with status "pending"
  const [settlement] = await db
    .insert(settlements)
    .values({
      groupId: input.groupId,
      payerMemberId: payerInfo.memberId,
      payeeMemberId: payeeInfo.memberId,
      amount: input.amount.toFixed(4),
      currencyCode: currency,
      note: input.note || null,
      status: "pending",
    })
    .returning();

  // AC-2.4: Notify payee that settlement was requested
  await notifySettlementRequested(
    input.payeeUserId,
    payerInfo.displayName,
    input.amount,
    currency,
    settlement.id
  );

  // Log activity (AC-2.4: Log settlement creation)
  await logSettlementCreated(input.groupId, payerInfo.memberId, settlement.id, {
    amount: input.amount,
    currency,
    payerUserId: input.payerUserId,
    payeeUserId: input.payeeUserId,
  });

  // AC-1.10: Return created settlement with ID and timestamp
  return {
    data: {
      id: settlement.id,
      payer: {
        memberId: payerInfo.memberId,
        userId: input.payerUserId,
        displayName: payerInfo.displayName,
      },
      payee: {
        memberId: payeeInfo.memberId,
        userId: input.payeeUserId,
        displayName: payeeInfo.displayName,
      },
      amount: parseFloat(settlement.amount),
      currency: settlement.currencyCode,
      status: settlement.status as SettlementStatus,
      note: settlement.note,
      attachments: [], // New settlement has no attachments
      createdAt: settlement.createdAt,
      settledAt: settlement.settledAt,
      updatedAt: settlement.updatedAt,
    },
  };
}

/**
 * Confirm a settlement (payee only)
 * AC-1.11 to AC-1.15
 */
export async function confirmSettlement(
  settlementId: string,
  userId: string
): Promise<{ data?: SettlementDetails; error?: string }> {
  // Get the settlement
  const settlementData = await getSettlementWithMembers(settlementId);
  if (!settlementData) {
    return { error: "Settlement not found" };
  }

  // AC-1.11: Only payee can confirm
  if (settlementData.payeeUserId !== userId) {
    return { error: "Only the payee can confirm a settlement" };
  }

  // AC-1.13: Only pending settlements can be confirmed
  if (settlementData.status !== "pending") {
    return { error: `Cannot confirm a settlement with status '${settlementData.status}'` };
  }

  // AC-1.12: Update status to confirmed
  const now = new Date();
  const [updated] = await db
    .update(settlements)
    .set({
      status: "confirmed",
      settledAt: now,
      updatedAt: now,
    })
    .where(eq(settlements.id, settlementId))
    .returning();

  // AC-2.5: Notify payer that settlement was confirmed
  await notifySettlementConfirmed(
    settlementData.payerUserId,
    settlementData.payeeDisplayName,
    parseFloat(settlementData.amount),
    settlementData.currencyCode,
    settlementId
  );

  // Log activity (AC-2.5: Log settlement confirmation)
  await logSettlementConfirmedActivity(
    settlementData.groupId,
    settlementData.payeeMemberId,
    settlementId
  );

  // Return updated settlement details (use getSettlementDetails to get attachments)
  return {
    data: {
      id: updated.id,
      payer: {
        memberId: settlementData.payerMemberId,
        userId: settlementData.payerUserId,
        displayName: settlementData.payerDisplayName,
      },
      payee: {
        memberId: settlementData.payeeMemberId,
        userId: settlementData.payeeUserId,
        displayName: settlementData.payeeDisplayName,
      },
      amount: parseFloat(updated.amount),
      currency: updated.currencyCode,
      status: updated.status as SettlementStatus,
      note: updated.note,
      attachments: [], // Call getSettlementDetails for full attachments
      createdAt: updated.createdAt,
      settledAt: updated.settledAt,
      updatedAt: updated.updatedAt,
    },
  };
}

/**
 * Cancel a settlement (payer only)
 * AC-1.16
 */
export async function cancelSettlement(
  settlementId: string,
  userId: string
): Promise<{ data?: SettlementDetails; error?: string }> {
  const settlementData = await getSettlementWithMembers(settlementId);
  if (!settlementData) {
    return { error: "Settlement not found" };
  }

  // AC-1.16: Only payer can cancel
  if (settlementData.payerUserId !== userId) {
    return { error: "Only the payer can cancel a settlement" };
  }

  // Only pending settlements can be cancelled
  if (settlementData.status !== "pending") {
    return { error: `Cannot cancel a settlement with status '${settlementData.status}'` };
  }

  // AC-1.19: Update status to cancelled
  const now = new Date();
  const [updated] = await db
    .update(settlements)
    .set({
      status: "cancelled",
      updatedAt: now,
    })
    .where(eq(settlements.id, settlementId))
    .returning();

  // Log activity (AC-2.7: Log settlement cancellation)
  await logSettlementCancelled(
    settlementData.groupId,
    settlementData.payerMemberId,
    settlementId
  );

  return {
    data: {
      id: updated.id,
      payer: {
        memberId: settlementData.payerMemberId,
        userId: settlementData.payerUserId,
        displayName: settlementData.payerDisplayName,
      },
      payee: {
        memberId: settlementData.payeeMemberId,
        userId: settlementData.payeeUserId,
        displayName: settlementData.payeeDisplayName,
      },
      amount: parseFloat(updated.amount),
      currency: updated.currencyCode,
      status: updated.status as SettlementStatus,
      note: updated.note,
      attachments: [], // Call getSettlementDetails for full attachments
      createdAt: updated.createdAt,
      settledAt: updated.settledAt,
      updatedAt: updated.updatedAt,
    },
  };
}

/**
 * Reject a settlement (payee only)
 * AC-1.17 to AC-1.20
 */
export async function rejectSettlement(
  settlementId: string,
  userId: string,
  reason?: string
): Promise<{ data?: SettlementDetails; error?: string }> {
  const settlementData = await getSettlementWithMembers(settlementId);
  if (!settlementData) {
    return { error: "Settlement not found" };
  }

  // AC-1.17: Only payee can reject
  if (settlementData.payeeUserId !== userId) {
    return { error: "Only the payee can reject a settlement" };
  }

  // Only pending settlements can be rejected
  if (settlementData.status !== "pending") {
    return { error: `Cannot reject a settlement with status '${settlementData.status}'` };
  }

  // AC-1.19, AC-1.20: Update status to rejected, optionally store reason in note
  const now = new Date();
  const [updated] = await db
    .update(settlements)
    .set({
      status: "rejected",
      note: reason ? `${settlementData.note ? settlementData.note + " | " : ""}Rejected: ${reason}` : settlementData.note,
      updatedAt: now,
    })
    .where(eq(settlements.id, settlementId))
    .returning();

  // AC-2.6: Notify payer that settlement was rejected
  await notifySettlementRejected(
    settlementData.payerUserId,
    settlementData.payeeDisplayName,
    parseFloat(settlementData.amount),
    settlementData.currencyCode,
    settlementId,
    reason
  );

  // Log activity (AC-2.6: Log settlement rejection)
  await logSettlementRejectedActivity(
    settlementData.groupId,
    settlementData.payeeMemberId,
    settlementId
  );

  return {
    data: {
      id: updated.id,
      payer: {
        memberId: settlementData.payerMemberId,
        userId: settlementData.payerUserId,
        displayName: settlementData.payerDisplayName,
      },
      payee: {
        memberId: settlementData.payeeMemberId,
        userId: settlementData.payeeUserId,
        displayName: settlementData.payeeDisplayName,
      },
      amount: parseFloat(updated.amount),
      currency: updated.currencyCode,
      status: updated.status as SettlementStatus,
      note: updated.note,
      attachments: [], // Call getSettlementDetails for full attachments
      createdAt: updated.createdAt,
      settledAt: updated.settledAt,
      updatedAt: updated.updatedAt,
    },
  };
}

/**
 * List settlements for a group
 * AC-1.21 to AC-1.26
 */
export async function listSettlements(
  groupId: string,
  filters: SettlementListFilters = {}
): Promise<{ settlements: SettlementListItem[]; total: number }> {
  // AC-1.22: Pagination defaults
  const page = filters.page || 1;
  const limit = Math.min(filters.limit || 20, 100);
  const offset = (page - 1) * limit;

  // Build conditions
  const conditions = [eq(settlements.groupId, groupId)];

  // AC-1.23: Filter by status
  if (filters.status) {
    if (Array.isArray(filters.status)) {
      conditions.push(inArray(settlements.status, filters.status));
    } else {
      conditions.push(eq(settlements.status, filters.status));
    }
  }

  // AC-1.24: Filter by date range
  if (filters.dateFrom) {
    conditions.push(gte(settlements.createdAt, filters.dateFrom));
  }
  if (filters.dateTo) {
    conditions.push(lte(settlements.createdAt, filters.dateTo));
  }

  // AC-1.25: Filter by involved user (as payer or payee)
  if (filters.involvedUserId) {
    // Get member ID for the user in this group
    const [member] = await db
      .select({ id: groupMembers.id })
      .from(groupMembers)
      .where(
        and(
          eq(groupMembers.userId, filters.involvedUserId),
          eq(groupMembers.groupId, groupId)
        )
      )
      .limit(1);

    if (member) {
      conditions.push(
        or(
          eq(settlements.payerMemberId, member.id),
          eq(settlements.payeeMemberId, member.id)
        )!
      );
    } else {
      // User is not a member, return empty
      return { settlements: [], total: 0 };
    }
  }

  // Get total count
  const [countResult] = await db
    .select({ count: count() })
    .from(settlements)
    .where(and(...conditions));

  const total = countResult?.count || 0;

  // Get settlements with member info
  // Using aliases for payer and payee joins
  const payerMembers = db
    .select({
      id: groupMembers.id,
      userId: groupMembers.userId,
    })
    .from(groupMembers)
    .as("payerMembers");

  const payeeMembers = db
    .select({
      id: groupMembers.id,
      userId: groupMembers.userId,
    })
    .from(groupMembers)
    .as("payeeMembers");

  // AC-1.26: Sorted by date (newest first)
  const settlementList = await db
    .select({
      id: settlements.id,
      amount: settlements.amount,
      currency: settlements.currencyCode,
      status: settlements.status,
      note: settlements.note,
      createdAt: settlements.createdAt,
      settledAt: settlements.settledAt,
      payerMemberId: settlements.payerMemberId,
      payeeMemberId: settlements.payeeMemberId,
    })
    .from(settlements)
    .where(and(...conditions))
    .orderBy(desc(settlements.createdAt))
    .limit(limit)
    .offset(offset);

  if (settlementList.length === 0) {
    return { settlements: [], total };
  }

  // Get all unique member IDs
  const memberIds = [
    ...new Set([
      ...settlementList.map((s) => s.payerMemberId),
      ...settlementList.map((s) => s.payeeMemberId),
    ]),
  ];

  // Get member details
  const memberDetails = await db
    .select({
      memberId: groupMembers.id,
      userId: groupMembers.userId,
      displayName: users.displayName,
    })
    .from(groupMembers)
    .innerJoin(users, eq(groupMembers.userId, users.id))
    .where(inArray(groupMembers.id, memberIds));

  const memberMap = new Map(
    memberDetails.map((m) => [m.memberId, m])
  );

  const result: SettlementListItem[] = settlementList.map((s) => {
    const payer = memberMap.get(s.payerMemberId);
    const payee = memberMap.get(s.payeeMemberId);

    return {
      id: s.id,
      payer: {
        memberId: s.payerMemberId,
        userId: payer?.userId || "",
        displayName: payer?.displayName || "Unknown",
      },
      payee: {
        memberId: s.payeeMemberId,
        userId: payee?.userId || "",
        displayName: payee?.displayName || "Unknown",
      },
      amount: parseFloat(s.amount),
      currency: s.currency,
      status: s.status as SettlementStatus,
      note: s.note,
      createdAt: s.createdAt,
      settledAt: s.settledAt,
    };
  });

  return { settlements: result, total };
}

/**
 * Get settlement details
 * AC-1.27 to AC-1.30
 */
export async function getSettlementDetails(
  settlementId: string
): Promise<{ data?: SettlementDetails; error?: string }> {
  const settlementData = await getSettlementWithMembers(settlementId);
  if (!settlementData) {
    return { error: "Settlement not found" };
  }

  // Get attachments (AC-1.15: Response includes attachments array)
  const attachmentsData = await db
    .select({
      id: evidences.id,
      mimeType: evidences.mimeType,
      sizeBytes: evidences.sizeBytes,
      createdAt: evidences.createdAt,
      creatorUserId: users.id,
      creatorDisplayName: users.displayName,
    })
    .from(evidences)
    .innerJoin(users, eq(users.id, evidences.createdByUserId))
    .where(eq(evidences.settlementId, settlementId))
    .orderBy(evidences.createdAt);

  const attachments: SettlementAttachment[] = attachmentsData.map((a) => ({
    id: a.id,
    mimeType: a.mimeType,
    sizeBytes: a.sizeBytes,
    createdAt: a.createdAt,
    createdBy: {
      userId: a.creatorUserId,
      displayName: a.creatorDisplayName,
    },
  }));

  return {
    data: {
      id: settlementData.id,
      payer: {
        memberId: settlementData.payerMemberId,
        userId: settlementData.payerUserId,
        displayName: settlementData.payerDisplayName,
      },
      payee: {
        memberId: settlementData.payeeMemberId,
        userId: settlementData.payeeUserId,
        displayName: settlementData.payeeDisplayName,
      },
      amount: parseFloat(settlementData.amount),
      currency: settlementData.currencyCode,
      status: settlementData.status as SettlementStatus,
      note: settlementData.note,
      attachments,
      createdAt: settlementData.createdAt,
      settledAt: settlementData.settledAt,
      updatedAt: settlementData.updatedAt,
    },
  };
}

/**
 * Get suggested settlements (uses simplified debts from balance service)
 * AC-1.31 to AC-1.33
 */
export async function getSuggestedSettlements(
  groupId: string
): Promise<{ suggestions: SimplifiedDebt[]; currency: string }> {
  // AC-1.33: Based on current (real-time) balances
  const balances = await calculateGroupBalances(groupId);

  // AC-1.31, AC-1.32: Return simplified debts as suggestions
  return {
    suggestions: balances.simplifiedDebts,
    currency: balances.currency,
  };
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Get settlement with payer and payee member info
 */
async function getSettlementWithMembers(settlementId: string) {
  // Get settlement
  const [settlement] = await db
    .select()
    .from(settlements)
    .where(eq(settlements.id, settlementId))
    .limit(1);

  if (!settlement) {
    return null;
  }

  // Get payer info
  const [payer] = await db
    .select({
      userId: groupMembers.userId,
      displayName: users.displayName,
    })
    .from(groupMembers)
    .innerJoin(users, eq(groupMembers.userId, users.id))
    .where(eq(groupMembers.id, settlement.payerMemberId))
    .limit(1);

  // Get payee info
  const [payee] = await db
    .select({
      userId: groupMembers.userId,
      displayName: users.displayName,
    })
    .from(groupMembers)
    .innerJoin(users, eq(groupMembers.userId, users.id))
    .where(eq(groupMembers.id, settlement.payeeMemberId))
    .limit(1);

  return {
    ...settlement,
    payerUserId: payer?.userId || "",
    payerDisplayName: payer?.displayName || "Unknown",
    payeeUserId: payee?.userId || "",
    payeeDisplayName: payee?.displayName || "Unknown",
  };
}

/**
 * Check if a user is a member of a group
 */
export async function isGroupMember(
  userId: string,
  groupId: string
): Promise<boolean> {
  const [member] = await db
    .select({ id: groupMembers.id })
    .from(groupMembers)
    .where(
      and(
        eq(groupMembers.userId, userId),
        eq(groupMembers.groupId, groupId),
        isNull(groupMembers.leftAt)
      )
    )
    .limit(1);

  return !!member;
}

/**
 * Get the group ID for a settlement
 */
export async function getSettlementGroupId(
  settlementId: string
): Promise<string | null> {
  const [settlement] = await db
    .select({ groupId: settlements.groupId })
    .from(settlements)
    .where(eq(settlements.id, settlementId))
    .limit(1);

  return settlement?.groupId || null;
}
