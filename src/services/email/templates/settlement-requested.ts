/**
 * Settlement Requested Email Template
 * Sprint 006 - TASK-007
 *
 * AC-1.10: Email templates exist for: settlement_requested
 */

import { wrapInHtmlTemplate } from "./index";

// ============================================================================
// Types
// ============================================================================

export interface SettlementRequestedTemplateData {
  recipientName: string;
  payerName: string;
  groupName: string;
  amount: number;
  currency: string;
  note?: string;
  settlementId?: string;
  appUrl?: string;
}

// ============================================================================
// Template
// ============================================================================

/**
 * Generate settlement requested email content
 */
export function settlementRequestedTemplate(data: SettlementRequestedTemplateData): {
  subject: string;
  html: string;
  text: string;
} {
  const {
    recipientName,
    payerName,
    groupName,
    amount,
    currency,
    note,
    appUrl = "https://divvy-jones.app",
  } = data;

  const formattedAmount = `${currency} ${amount.toFixed(2)}`;

  const subject = `${payerName} requested to settle ${formattedAmount}`;

  const content = `
    <div class="content">
      <p>Hi ${recipientName},</p>

      <p><strong>${payerName}</strong> wants to settle a debt with you in <strong>${groupName}</strong>.</p>

      <div class="highlight">
        <p style="margin: 0 0 8px 0;">Settlement Request</p>
        <p class="amount" style="margin: 0 0 8px 0;">${formattedAmount}</p>
        ${note ? `<p style="margin: 0; color: #6B7280;">Note: ${note}</p>` : ""}
      </div>

      <p>Please confirm this settlement once you receive the payment.</p>

      <p>
        <a href="${appUrl}/settlements" class="button">Review Settlement</a>
      </p>
    </div>
  `;

  const html = wrapInHtmlTemplate(subject, content);

  const text = `
Hi ${recipientName},

${payerName} wants to settle a debt with you in ${groupName}.

Amount: ${formattedAmount}
${note ? `Note: ${note}\n` : ""}

Please confirm this settlement once you receive the payment.

Review the settlement at: ${appUrl}/settlements

---
This email was sent by Divvy Jones.
  `.trim();

  return { subject, html, text };
}
