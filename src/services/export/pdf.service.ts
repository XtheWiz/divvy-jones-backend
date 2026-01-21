/**
 * PDF Export Service
 * Sprint 007 - TASK-004
 *
 * Service to generate PDF exports of group expense reports.
 *
 * AC-1.1: PDF export service generates valid PDF documents
 * AC-1.2: PDF includes group summary header (name, date range, members)
 * AC-1.3: PDF includes expense table with all relevant columns
 * AC-1.4: PDF includes balance summary section
 */

import PDFDocument from "pdfkit";
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
import { eq, and, isNull, gte, lte, inArray, desc } from "drizzle-orm";
import { calculateGroupBalances } from "../balance.service";

// ============================================================================
// Types
// ============================================================================

export interface PdfExportOptions {
  groupId: string;
  dateFrom?: Date;
  dateTo?: Date;
}

export interface PdfExportResult {
  pdf: Buffer;
  filename: string;
  expenseCount: number;
}

interface ExpenseForPdf {
  id: string;
  title: string;
  description: string | null;
  amount: number;
  currency: string;
  category: string | null;
  date: Date;
  paidBy: string;
}

interface GroupInfo {
  name: string;
  currency: string;
  members: Array<{ displayName: string }>;
}

// ============================================================================
// Utilities
// ============================================================================

/**
 * Format a date for display
 */
function formatDate(date: Date): string {
  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

/**
 * Format amount with currency
 */
function formatAmount(amount: number, currency: string): string {
  return `${currency} ${amount.toFixed(2)}`;
}

/**
 * Generate filename for PDF export
 * AC-1.8: PDF filename includes group name and date range
 */
export function generatePdfFilename(
  groupName: string,
  dateFrom?: Date,
  dateTo?: Date
): string {
  // Sanitize group name for filename
  const safeName = groupName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

  const today = new Date().toISOString().split("T")[0];

  if (dateFrom && dateTo) {
    const from = dateFrom.toISOString().split("T")[0];
    const to = dateTo.toISOString().split("T")[0];
    return `${safeName}_report_${from}_to_${to}.pdf`;
  } else if (dateFrom) {
    const from = dateFrom.toISOString().split("T")[0];
    return `${safeName}_report_from_${from}.pdf`;
  } else if (dateTo) {
    const to = dateTo.toISOString().split("T")[0];
    return `${safeName}_report_until_${to}.pdf`;
  }

  return `${safeName}_report_${today}.pdf`;
}

// ============================================================================
// Data Fetching
// ============================================================================

/**
 * Get group information including members
 */
async function getGroupInfo(groupId: string): Promise<GroupInfo | null> {
  const [group] = await db
    .select({
      name: groups.name,
      currency: groups.defaultCurrencyCode,
    })
    .from(groups)
    .where(eq(groups.id, groupId))
    .limit(1);

  if (!group) return null;

  const members = await db
    .select({ displayName: users.displayName })
    .from(groupMembers)
    .innerJoin(users, eq(groupMembers.userId, users.id))
    .where(
      and(eq(groupMembers.groupId, groupId), isNull(groupMembers.leftAt))
    );

  return {
    name: group.name,
    currency: group.currency || "USD",
    members,
  };
}

/**
 * Get expenses for PDF report
 */
async function getExpensesForPdf(
  options: PdfExportOptions
): Promise<ExpenseForPdf[]> {
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
    .orderBy(desc(expenses.expenseDate));

  if (expenseList.length === 0) {
    return [];
  }

  const expenseIds = expenseList.map((e) => e.id);

  // Get primary payer for each expense
  const payerData = await db
    .select({
      expenseId: expensePayers.expenseId,
      displayName: users.displayName,
    })
    .from(expensePayers)
    .innerJoin(groupMembers, eq(expensePayers.memberId, groupMembers.id))
    .innerJoin(users, eq(groupMembers.userId, users.id))
    .where(inArray(expensePayers.expenseId, expenseIds));

  // Map payers by expense
  const payersByExpense = new Map<string, string>();
  for (const payer of payerData) {
    // Use first payer if multiple
    if (!payersByExpense.has(payer.expenseId)) {
      payersByExpense.set(payer.expenseId, payer.displayName);
    }
  }

  return expenseList.map((expense) => ({
    id: expense.id,
    title: expense.title,
    description: expense.description,
    amount: Number(expense.amount),
    currency: expense.currency,
    category: expense.category,
    date: expense.date,
    paidBy: payersByExpense.get(expense.id) || "Unknown",
  }));
}

// ============================================================================
// PDF Generation
// ============================================================================

/**
 * Generate PDF document
 * AC-1.1: PDF export service generates valid PDF documents
 */
export async function generatePdfExport(
  options: PdfExportOptions
): Promise<PdfExportResult> {
  const { groupId, dateFrom, dateTo } = options;

  // Get group info
  const groupInfo = await getGroupInfo(groupId);
  if (!groupInfo) {
    throw new Error("Group not found");
  }

  // Get expenses
  const expenseData = await getExpensesForPdf(options);

  // Get balances
  const balances = await calculateGroupBalances(groupId);

  // Create PDF document
  const doc = new PDFDocument({
    size: "A4",
    margin: 50,
    info: {
      Title: `${groupInfo.name} - Expense Report`,
      Author: "Divvy Jones",
      Creator: "Divvy Jones Export Service",
    },
  });

  // Collect PDF chunks
  const chunks: Buffer[] = [];
  doc.on("data", (chunk: Buffer) => chunks.push(chunk));

  // ========================================================================
  // Header Section
  // AC-1.2: PDF includes group summary header (name, date range, members)
  // ========================================================================

  // Title
  doc
    .fontSize(24)
    .font("Helvetica-Bold")
    .text("Expense Report", { align: "center" });

  doc.moveDown(0.5);

  // Group name
  doc
    .fontSize(18)
    .font("Helvetica")
    .text(groupInfo.name, { align: "center" });

  doc.moveDown(0.5);

  // Date range
  let dateRangeText = "All expenses";
  if (dateFrom && dateTo) {
    dateRangeText = `${formatDate(dateFrom)} - ${formatDate(dateTo)}`;
  } else if (dateFrom) {
    dateRangeText = `From ${formatDate(dateFrom)}`;
  } else if (dateTo) {
    dateRangeText = `Until ${formatDate(dateTo)}`;
  }

  doc
    .fontSize(12)
    .fillColor("#666666")
    .text(dateRangeText, { align: "center" });

  doc.moveDown(0.3);

  // Generated date
  doc
    .fontSize(10)
    .text(`Generated: ${formatDate(new Date())}`, { align: "center" });

  doc.moveDown(1);

  // Members
  doc
    .fontSize(12)
    .fillColor("#000000")
    .font("Helvetica-Bold")
    .text("Members:");

  doc
    .fontSize(11)
    .font("Helvetica")
    .text(groupInfo.members.map((m) => m.displayName).join(", "));

  doc.moveDown(1);

  // Divider line
  doc
    .strokeColor("#cccccc")
    .lineWidth(1)
    .moveTo(50, doc.y)
    .lineTo(545, doc.y)
    .stroke();

  doc.moveDown(1);

  // ========================================================================
  // Expense Table
  // AC-1.3: PDF includes expense table with all relevant columns
  // ========================================================================

  doc
    .fontSize(14)
    .font("Helvetica-Bold")
    .fillColor("#000000")
    .text("Expenses");

  doc.moveDown(0.5);

  if (expenseData.length === 0) {
    doc
      .fontSize(11)
      .font("Helvetica")
      .fillColor("#666666")
      .text("No expenses found for the selected period.");
  } else {
    // Table header
    const tableTop = doc.y;
    const colWidths = [70, 150, 80, 80, 80]; // Date, Title, Category, Amount, Paid By
    const colX = [50, 120, 270, 350, 430];

    doc
      .fontSize(10)
      .font("Helvetica-Bold")
      .fillColor("#333333");

    doc.text("Date", colX[0], tableTop);
    doc.text("Title", colX[1], tableTop);
    doc.text("Category", colX[2], tableTop);
    doc.text("Amount", colX[3], tableTop);
    doc.text("Paid By", colX[4], tableTop);

    doc.moveDown(0.3);

    // Table header line
    doc
      .strokeColor("#cccccc")
      .lineWidth(0.5)
      .moveTo(50, doc.y)
      .lineTo(545, doc.y)
      .stroke();

    doc.moveDown(0.3);

    // Table rows
    doc.font("Helvetica").fontSize(9);

    let totalAmount = 0;

    for (const expense of expenseData) {
      const rowY = doc.y;

      // Check if we need a new page
      if (rowY > 750) {
        doc.addPage();
      }

      doc.fillColor("#000000");
      doc.text(formatDate(expense.date), colX[0], doc.y, { width: colWidths[0] });

      const currentY = doc.y - 10; // Align with date

      doc.text(expense.title.substring(0, 25), colX[1], currentY, {
        width: colWidths[1],
      });
      doc.text(expense.category || "-", colX[2], currentY, {
        width: colWidths[2],
      });
      doc.text(formatAmount(expense.amount, expense.currency), colX[3], currentY, {
        width: colWidths[3],
      });
      doc.text(expense.paidBy.substring(0, 15), colX[4], currentY, {
        width: colWidths[4],
      });

      totalAmount += expense.amount;

      doc.moveDown(0.5);
    }

    // Total row
    doc.moveDown(0.3);
    doc
      .strokeColor("#cccccc")
      .lineWidth(0.5)
      .moveTo(50, doc.y)
      .lineTo(545, doc.y)
      .stroke();

    doc.moveDown(0.3);

    doc
      .font("Helvetica-Bold")
      .fontSize(10)
      .text(`Total: ${expenseData.length} expenses`, colX[0], doc.y);

    doc.text(
      formatAmount(totalAmount, groupInfo.currency),
      colX[3],
      doc.y - 12
    );
  }

  doc.moveDown(2);

  // ========================================================================
  // Balance Summary
  // AC-1.4: PDF includes balance summary section
  // ========================================================================

  // Check if we need a new page
  if (doc.y > 650) {
    doc.addPage();
  }

  doc
    .strokeColor("#cccccc")
    .lineWidth(1)
    .moveTo(50, doc.y)
    .lineTo(545, doc.y)
    .stroke();

  doc.moveDown(1);

  doc
    .fontSize(14)
    .font("Helvetica-Bold")
    .fillColor("#000000")
    .text("Balance Summary");

  doc.moveDown(0.5);

  // Member balances
  doc
    .fontSize(11)
    .font("Helvetica-Bold")
    .text("Individual Balances:");

  doc.moveDown(0.3);

  doc.font("Helvetica").fontSize(10);

  for (const member of balances.memberBalances) {
    const balanceText =
      member.netBalance >= 0
        ? `is owed ${formatAmount(member.netBalance, balances.currency)}`
        : `owes ${formatAmount(Math.abs(member.netBalance), balances.currency)}`;

    doc.text(`${member.displayName}: ${balanceText}`);
    doc.moveDown(0.2);
  }

  doc.moveDown(0.5);

  // Simplified debts
  if (balances.simplifiedDebts.length > 0) {
    doc
      .fontSize(11)
      .font("Helvetica-Bold")
      .text("Suggested Settlements:");

    doc.moveDown(0.3);

    doc.font("Helvetica").fontSize(10);

    for (const debt of balances.simplifiedDebts) {
      doc.text(
        `${debt.from.displayName} pays ${debt.to.displayName}: ${formatAmount(debt.amount, balances.currency)}`
      );
      doc.moveDown(0.2);
    }
  } else {
    doc
      .fontSize(10)
      .fillColor("#666666")
      .text("All balances are settled!");
  }

  // ========================================================================
  // Footer
  // ========================================================================

  doc.moveDown(2);

  doc
    .fontSize(8)
    .fillColor("#999999")
    .text("Generated by Divvy Jones", { align: "center" });

  // Finalize PDF
  doc.end();

  // Wait for PDF to be fully generated
  return new Promise((resolve, reject) => {
    doc.on("end", () => {
      const pdf = Buffer.concat(chunks);
      const filename = generatePdfFilename(groupInfo.name, dateFrom, dateTo);

      resolve({
        pdf,
        filename,
        expenseCount: expenseData.length,
      });
    });

    doc.on("error", reject);
  });
}
