/**
 * CSV Export Service
 * Sprint 005 - TASK-011
 *
 * Service to generate CSV exports of group expenses.
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
} from "../../db";
import { eq, and, isNull, gte, lte, inArray } from "drizzle-orm";

// ============================================================================
// Types
// ============================================================================

export interface CsvExportOptions {
  groupId: string;
  dateFrom?: Date;
  dateTo?: Date;
}

export interface CsvExportResult {
  csv: string;
  filename: string;
  expenseCount: number;
}

interface ExpenseForExport {
  id: string;
  title: string;
  description: string | null;
  amount: number;
  currency: string;
  category: string | null;
  date: Date;
  payers: Array<{ displayName: string; amount: number }>;
  splits: Array<{ displayName: string; amount: number }>;
}

// ============================================================================
// CSV Utilities
// ============================================================================

/**
 * Escape a value for CSV
 * - Wrap in quotes if contains comma, quote, or newline
 * - Double any existing quotes
 */
export function escapeCsvValue(value: string | number | null | undefined): string {
  if (value === null || value === undefined) {
    return "";
  }

  const str = String(value);

  // Check if escaping is needed
  if (str.includes(",") || str.includes('"') || str.includes("\n") || str.includes("\r")) {
    // Escape quotes by doubling them and wrap in quotes
    return `"${str.replace(/"/g, '""')}"`;
  }

  return str;
}

/**
 * Format a date for CSV (ISO date format: YYYY-MM-DD)
 */
export function formatDateForCsv(date: Date): string {
  return date.toISOString().split("T")[0];
}

/**
 * Format amount with proper decimal places
 */
export function formatAmountForCsv(amount: number): string {
  return amount.toFixed(2);
}

/**
 * Generate filename for export
 * AC-2.4: Filename includes group name and date range
 */
export function generateExportFilename(
  groupName: string,
  dateFrom?: Date,
  dateTo?: Date
): string {
  // Sanitize group name for filename (remove special chars)
  const safeName = groupName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

  const today = formatDateForCsv(new Date());

  if (dateFrom && dateTo) {
    return `${safeName}_expenses_${formatDateForCsv(dateFrom)}_to_${formatDateForCsv(dateTo)}.csv`;
  } else if (dateFrom) {
    return `${safeName}_expenses_from_${formatDateForCsv(dateFrom)}.csv`;
  } else if (dateTo) {
    return `${safeName}_expenses_until_${formatDateForCsv(dateTo)}.csv`;
  }

  return `${safeName}_expenses_${today}.csv`;
}

// ============================================================================
// Export Service
// ============================================================================

/**
 * Get expenses for export
 * AC-2.8: Export includes only active (non-deleted) expenses
 */
async function getExpensesForExport(
  options: CsvExportOptions
): Promise<ExpenseForExport[]> {
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
    })
    .from(expensePayers)
    .innerJoin(groupMembers, eq(expensePayers.memberId, groupMembers.id))
    .innerJoin(users, eq(groupMembers.userId, users.id))
    .where(inArray(expensePayers.expenseId, expenseIds));

  // Get splits (expense item members) - using weight/exactAmount since there's no direct amount
  const splitData = await db
    .select({
      expenseId: expenseItems.expenseId,
      weight: expenseItemMembers.weight,
      exactAmount: expenseItemMembers.exactAmount,
      displayName: users.displayName,
    })
    .from(expenseItemMembers)
    .innerJoin(expenseItems, eq(expenseItemMembers.itemId, expenseItems.id))
    .innerJoin(groupMembers, eq(expenseItemMembers.memberId, groupMembers.id))
    .innerJoin(users, eq(groupMembers.userId, users.id))
    .where(inArray(expenseItems.expenseId, expenseIds));

  // Group data by expense
  const payersByExpense = new Map<string, Array<{ displayName: string; amount: number }>>();
  const splitsByExpense = new Map<string, Array<{ displayName: string; amount: number }>>();

  for (const payer of payerData) {
    const existing = payersByExpense.get(payer.expenseId) || [];
    existing.push({ displayName: payer.displayName, amount: Number(payer.amount) });
    payersByExpense.set(payer.expenseId, existing);
  }

  for (const split of splitData) {
    const existing = splitsByExpense.get(split.expenseId) || [];
    // Use exactAmount if available, otherwise weight as a placeholder
    const amount = split.exactAmount ? Number(split.exactAmount) : Number(split.weight || 1);
    existing.push({ displayName: split.displayName, amount });
    splitsByExpense.set(split.expenseId, existing);
  }

  // Build result
  return expenseList.map((expense) => ({
    id: expense.id,
    title: expense.title,
    description: expense.description,
    amount: Number(expense.amount),
    currency: expense.currency,
    category: expense.category,
    date: expense.date,
    payers: payersByExpense.get(expense.id) || [],
    splits: splitsByExpense.get(expense.id) || [],
  }));
}

/**
 * Format payers as a string for CSV
 */
function formatPayers(payers: Array<{ displayName: string; amount: number }>): string {
  if (payers.length === 0) return "";
  if (payers.length === 1) return payers[0].displayName;
  return payers.map((p) => `${p.displayName} (${formatAmountForCsv(p.amount)})`).join("; ");
}

/**
 * Format splits as a string for CSV
 */
function formatSplits(splits: Array<{ displayName: string; amount: number }>): string {
  if (splits.length === 0) return "";
  return splits.map((s) => `${s.displayName}: ${formatAmountForCsv(s.amount)}`).join("; ");
}

/**
 * Generate CSV export of group expenses
 * AC-2.1: GET /groups/:groupId/export/csv exports expenses as CSV
 * AC-2.2: CSV includes: date, description, amount, currency, payer, splits
 * AC-2.3: CSV export can be filtered by date range
 */
export async function generateCsvExport(
  options: CsvExportOptions
): Promise<CsvExportResult> {
  const { groupId, dateFrom, dateTo } = options;

  // Get group info for filename
  const [group] = await db
    .select({ name: groups.name })
    .from(groups)
    .where(eq(groups.id, groupId))
    .limit(1);

  const groupName = group?.name || "expenses";

  // Get expenses
  const expenseData = await getExpensesForExport(options);

  // Build CSV
  // AC-2.2: CSV includes: date, description, amount, currency, payer, splits
  const headers = ["Date", "Title", "Description", "Amount", "Currency", "Category", "Paid By", "Splits"];
  const rows: string[] = [headers.map(escapeCsvValue).join(",")];

  for (const expense of expenseData) {
    const row = [
      formatDateForCsv(expense.date),
      expense.title,
      expense.description || "",
      formatAmountForCsv(expense.amount),
      expense.currency,
      expense.category || "",
      formatPayers(expense.payers),
      formatSplits(expense.splits),
    ];
    rows.push(row.map(escapeCsvValue).join(","));
  }

  const csv = rows.join("\n");
  const filename = generateExportFilename(groupName, dateFrom, dateTo);

  return {
    csv,
    filename,
    expenseCount: expenseData.length,
  };
}
