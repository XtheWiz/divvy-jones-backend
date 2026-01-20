/**
 * Expense Added Email Template
 * Sprint 006 - TASK-007
 *
 * AC-1.10: Email templates exist for: expense_added
 */

import { wrapInHtmlTemplate, htmlToPlainText } from "./index";

// ============================================================================
// Types
// ============================================================================

export interface ExpenseAddedTemplateData {
  recipientName: string;
  actorName: string;
  groupName: string;
  expenseName: string;
  amount: number;
  currency: string;
  yourShare: number;
  category?: string;
  expenseDate?: string;
  appUrl?: string;
}

// ============================================================================
// Template
// ============================================================================

/**
 * Generate expense added email content
 */
export function expenseAddedTemplate(data: ExpenseAddedTemplateData): {
  subject: string;
  html: string;
  text: string;
} {
  const {
    recipientName,
    actorName,
    groupName,
    expenseName,
    amount,
    currency,
    yourShare,
    category,
    expenseDate,
    appUrl = "https://divvy-jones.app",
  } = data;

  const formattedAmount = `${currency} ${amount.toFixed(2)}`;
  const formattedShare = `${currency} ${yourShare.toFixed(2)}`;
  const formattedDate = expenseDate || new Date().toLocaleDateString();

  const subject = `New expense added in ${groupName}: ${expenseName}`;

  const content = `
    <div class="content">
      <p>Hi ${recipientName},</p>

      <p><strong>${actorName}</strong> added a new expense in <strong>${groupName}</strong>.</p>

      <div class="highlight">
        <p style="margin: 0 0 8px 0; font-weight: 600;">${expenseName}</p>
        <p class="amount" style="margin: 0 0 8px 0;">${formattedAmount}</p>
        ${category ? `<p style="margin: 0 0 8px 0; color: #6B7280;">Category: ${category}</p>` : ""}
        <p style="margin: 0; color: #6B7280;">Date: ${formattedDate}</p>
      </div>

      <p><strong>Your share:</strong> ${formattedShare}</p>

      <p>
        <a href="${appUrl}/groups" class="button">View in App</a>
      </p>
    </div>
  `;

  const html = wrapInHtmlTemplate(subject, content);

  const text = `
Hi ${recipientName},

${actorName} added a new expense in ${groupName}.

Expense: ${expenseName}
Amount: ${formattedAmount}
${category ? `Category: ${category}\n` : ""}Date: ${formattedDate}

Your share: ${formattedShare}

View the expense at: ${appUrl}/groups

---
This email was sent by Divvy Jones.
  `.trim();

  return { subject, html, text };
}
