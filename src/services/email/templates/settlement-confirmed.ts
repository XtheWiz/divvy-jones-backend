/**
 * Settlement Confirmed Email Template
 * Sprint 006 - TASK-007
 *
 * AC-1.10: Email templates exist for: settlement_confirmed
 */

import { wrapInHtmlTemplate } from "./index";

// ============================================================================
// Types
// ============================================================================

export interface SettlementConfirmedTemplateData {
  recipientName: string;
  payeeName: string;
  groupName: string;
  amount: number;
  currency: string;
  confirmedAt?: string;
  appUrl?: string;
}

// ============================================================================
// Template
// ============================================================================

/**
 * Generate settlement confirmed email content
 */
export function settlementConfirmedTemplate(data: SettlementConfirmedTemplateData): {
  subject: string;
  html: string;
  text: string;
} {
  const {
    recipientName,
    payeeName,
    groupName,
    amount,
    currency,
    confirmedAt,
    appUrl = "https://divvy-jones.app",
  } = data;

  const formattedAmount = `${currency} ${amount.toFixed(2)}`;
  const formattedDate = confirmedAt || new Date().toLocaleDateString();

  const subject = `Settlement confirmed: ${formattedAmount} to ${payeeName}`;

  const content = `
    <div class="content">
      <p>Hi ${recipientName},</p>

      <p>Great news! <strong>${payeeName}</strong> has confirmed your settlement in <strong>${groupName}</strong>.</p>

      <div class="highlight" style="border-left: 4px solid #10B981; background-color: #ECFDF5;">
        <p style="margin: 0 0 8px 0; color: #059669; font-weight: 600;">Settlement Confirmed</p>
        <p class="amount" style="margin: 0 0 8px 0; color: #059669;">${formattedAmount}</p>
        <p style="margin: 0; color: #6B7280;">Confirmed on: ${formattedDate}</p>
      </div>

      <p>Your balance in the group has been updated accordingly.</p>

      <p>
        <a href="${appUrl}/groups" class="button" style="background-color: #10B981;">View Group</a>
      </p>
    </div>
  `;

  const html = wrapInHtmlTemplate(subject, content);

  const text = `
Hi ${recipientName},

Great news! ${payeeName} has confirmed your settlement in ${groupName}.

Amount: ${formattedAmount}
Confirmed on: ${formattedDate}

Your balance in the group has been updated accordingly.

View the group at: ${appUrl}/groups

---
This email was sent by Divvy Jones.
  `.trim();

  return { subject, html, text };
}
