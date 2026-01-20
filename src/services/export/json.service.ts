/**
 * JSON Export Service
 * Sprint 005 - TASK-012
 *
 * Service to generate JSON exports of group expenses.
 */

import {
  db,
  expenses,
  expensePayers,
  expenseItems,
  expenseItemMembers,
  groups,
  groupMembers,
  users,
  evidences,
} from "../../db";
import { eq, and, isNull, gte, lte, inArray } from "drizzle-orm";

// ============================================================================
// Types
// ============================================================================

export interface JsonExportOptions {
  groupId: string;
  dateFrom?: Date;
  dateTo?: Date;
}

export interface JsonExportResult {
  json: ExportData;
  filename: string;
  expenseCount: number;
}

export interface ExportMetadata {
  exportedAt: string;
  exportVersion: string;
  group: {
    id: string;
    name: string;
    currency: string;
  };
  dateRange?: {
    from?: string;
    to?: string;
  };
  totalExpenses: number;
}

export interface ExportedExpense {
  id: string;
  title: string;
  description: string | null;
  amount: number;
  currency: string;
  category: string | null;
  date: string;
  payers: Array<{
    displayName: string;
    userId: string;
    amount: number;
  }>;
  splits: Array<{
    displayName: string;
    userId: string;
    amount: number;
    shareMode: string;
  }>;
  attachments: Array<{
    id: string;
    mimeType: string;
    sizeBytes: number;
    createdAt: string;
  }>;
  createdAt: string;
  updatedAt: string;
}

export interface ExportData {
  metadata: ExportMetadata;
  expenses: ExportedExpense[];
}

// ============================================================================
// Export Service
// ============================================================================

/**
 * Get expenses for JSON export with full details
 * AC-2.6: JSON includes all expense details including attachments metadata
 * AC-2.8: Export includes only active (non-deleted) expenses
 */
async function getExpensesForJsonExport(
  options: JsonExportOptions
): Promise<ExportedExpense[]> {
  const { groupId, dateFrom, dateTo } = options;

  // Build query conditions
  const conditions = [
    eq(expenses.groupId, groupId),
    isNull(expenses.deletedAt),
  ];

  if (dateFrom) {
    conditions.push(gte(expenses.expenseDate, dateFrom));
  }
  if (dateTo) {
    conditions.push(lte(expenses.expenseDate, dateTo));
  }

  // Get expenses
  const expenseList = await db
    .select({
      id: expenses.id,
      title: expenses.name,
      description: expenses.label,
      amount: expenses.subtotal,
      currency: expenses.currencyCode,
      category: expenses.category,
      date: expenses.expenseDate,
      createdAt: expenses.createdAt,
      updatedAt: expenses.updatedAt,
    })
    .from(expenses)
    .where(and(...conditions))
    .orderBy(expenses.expenseDate);

  if (expenseList.length === 0) {
    return [];
  }

  const expenseIds = expenseList.map((e) => e.id);

  // Get payers for all expenses
  const payerData = await db
    .select({
      expenseId: expensePayers.expenseId,
      amount: expensePayers.amount,
      displayName: users.displayName,
      userId: groupMembers.userId,
    })
    .from(expensePayers)
    .innerJoin(groupMembers, eq(expensePayers.memberId, groupMembers.id))
    .innerJoin(users, eq(groupMembers.userId, users.id))
    .where(inArray(expensePayers.expenseId, expenseIds));

  // Get splits (expense item members) with share mode
  const splitData = await db
    .select({
      expenseId: expenseItems.expenseId,
      exactAmount: expenseItemMembers.exactAmount,
      weight: expenseItemMembers.weight,
      shareMode: expenseItemMembers.shareMode,
      displayName: users.displayName,
      userId: groupMembers.userId,
    })
    .from(expenseItemMembers)
    .innerJoin(expenseItems, eq(expenseItemMembers.itemId, expenseItems.id))
    .innerJoin(groupMembers, eq(expenseItemMembers.memberId, groupMembers.id))
    .innerJoin(users, eq(groupMembers.userId, users.id))
    .where(inArray(expenseItems.expenseId, expenseIds));

  // Get attachments (evidences with target='expense')
  const attachmentData = await db
    .select({
      expenseId: evidences.expenseId,
      id: evidences.id,
      mimeType: evidences.mimeType,
      sizeBytes: evidences.sizeBytes,
      createdAt: evidences.createdAt,
    })
    .from(evidences)
    .where(
      and(
        eq(evidences.target, "expense"),
        inArray(evidences.expenseId, expenseIds)
      )
    );

  // Group data by expense
  const payersByExpense = new Map<
    string,
    Array<{ displayName: string; userId: string; amount: number }>
  >();
  const splitsByExpense = new Map<
    string,
    Array<{ displayName: string; userId: string; amount: number; shareMode: string }>
  >();
  const attachmentsByExpense = new Map<
    string,
    Array<{ id: string; mimeType: string; sizeBytes: number; createdAt: string }>
  >();

  for (const payer of payerData) {
    const existing = payersByExpense.get(payer.expenseId) || [];
    existing.push({
      displayName: payer.displayName,
      userId: payer.userId,
      amount: Number(payer.amount),
    });
    payersByExpense.set(payer.expenseId, existing);
  }

  for (const split of splitData) {
    const existing = splitsByExpense.get(split.expenseId) || [];
    // Use exactAmount if available, otherwise weight as placeholder
    const amount = split.exactAmount ? Number(split.exactAmount) : Number(split.weight || 1);
    existing.push({
      displayName: split.displayName,
      userId: split.userId,
      amount,
      shareMode: split.shareMode || "equal",
    });
    splitsByExpense.set(split.expenseId, existing);
  }

  for (const attachment of attachmentData) {
    if (!attachment.expenseId) continue; // Skip if no expenseId
    const existing = attachmentsByExpense.get(attachment.expenseId) || [];
    existing.push({
      id: attachment.id,
      mimeType: attachment.mimeType,
      sizeBytes: attachment.sizeBytes,
      createdAt: attachment.createdAt.toISOString(),
    });
    attachmentsByExpense.set(attachment.expenseId, existing);
  }

  // Build result
  return expenseList.map((expense) => ({
    id: expense.id,
    title: expense.title,
    description: expense.description,
    amount: Number(expense.amount),
    currency: expense.currency,
    category: expense.category,
    date: expense.date.toISOString().split("T")[0],
    payers: payersByExpense.get(expense.id) || [],
    splits: splitsByExpense.get(expense.id) || [],
    attachments: attachmentsByExpense.get(expense.id) || [],
    createdAt: expense.createdAt.toISOString(),
    updatedAt: expense.updatedAt.toISOString(),
  }));
}

/**
 * Generate filename for JSON export
 */
function generateJsonFilename(
  groupName: string,
  dateFrom?: Date,
  dateTo?: Date
): string {
  // Sanitize group name for filename
  const safeName = groupName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

  const formatDate = (d: Date) => d.toISOString().split("T")[0];
  const today = formatDate(new Date());

  if (dateFrom && dateTo) {
    return `${safeName}_expenses_${formatDate(dateFrom)}_to_${formatDate(dateTo)}.json`;
  } else if (dateFrom) {
    return `${safeName}_expenses_from_${formatDate(dateFrom)}.json`;
  } else if (dateTo) {
    return `${safeName}_expenses_until_${formatDate(dateTo)}.json`;
  }

  return `${safeName}_expenses_${today}.json`;
}

/**
 * Generate JSON export of group expenses
 * AC-2.5: GET /groups/:groupId/export/json exports full expense data
 * AC-2.6: JSON includes all expense details including attachments metadata
 */
export async function generateJsonExport(
  options: JsonExportOptions
): Promise<JsonExportResult> {
  const { groupId, dateFrom, dateTo } = options;

  // Get group info
  const [group] = await db
    .select({
      id: groups.id,
      name: groups.name,
      currency: groups.defaultCurrencyCode,
    })
    .from(groups)
    .where(eq(groups.id, groupId))
    .limit(1);

  const groupInfo = group || { id: groupId, name: "Unknown", currency: "USD" };

  // Get expenses
  const expenseData = await getExpensesForJsonExport(options);

  // Build metadata
  const metadata: ExportMetadata = {
    exportedAt: new Date().toISOString(),
    exportVersion: "1.0",
    group: groupInfo,
    totalExpenses: expenseData.length,
  };

  if (dateFrom || dateTo) {
    metadata.dateRange = {};
    if (dateFrom) metadata.dateRange.from = dateFrom.toISOString().split("T")[0];
    if (dateTo) metadata.dateRange.to = dateTo.toISOString().split("T")[0];
  }

  const json: ExportData = {
    metadata,
    expenses: expenseData,
  };

  const filename = generateJsonFilename(groupInfo.name, dateFrom, dateTo);

  return {
    json,
    filename,
    expenseCount: expenseData.length,
  };
}
