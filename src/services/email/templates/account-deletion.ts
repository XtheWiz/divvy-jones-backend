/**
 * Account Deletion Email Template
 * Sprint 010 - TASK-026
 *
 * AC-3.3: User receives confirmation email when deletion requested
 */

import { wrapInHtmlTemplate } from "./index";

// ============================================================================
// Types
// ============================================================================

export interface AccountDeletionTemplateData {
  /** Recipient's display name */
  recipientName: string;
  /** When the account will be permanently deleted */
  deletionDate: string;
  /** URL to cancel the deletion */
  cancelUrl: string;
  /** App name for branding */
  appName?: string;
}

// ============================================================================
// Template
// ============================================================================

/**
 * Generate account deletion confirmation email content
 *
 * @param data - Template data
 * @returns Object with subject, HTML body, and plain text body
 */
export function accountDeletionTemplate(data: AccountDeletionTemplateData) {
  const {
    recipientName,
    deletionDate,
    cancelUrl,
    appName = "Divvy Jones",
  } = data;

  const subject = `Your ${appName} account is scheduled for deletion`;

  const content = `
    <div class="content">
      <h2>Account Deletion Requested</h2>

      <p>Hi ${recipientName},</p>

      <p>We received a request to delete your ${appName} account. Your account and all personal data will be permanently deleted on:</p>

      <div class="highlight">
        <p style="margin: 0; font-size: 18px; font-weight: bold; text-align: center;">
          ${deletionDate}
        </p>
      </div>

      <p>If you didn't request this, or if you've changed your mind, you can cancel the deletion by clicking the button below:</p>

      <div style="text-align: center; margin: 32px 0;">
        <a href="${cancelUrl}" class="button" style="color: white; text-decoration: none;">
          Cancel Account Deletion
        </a>
      </div>

      <p>If the button above doesn't work, copy and paste this link into your browser:</p>

      <p style="word-break: break-all; color: #4F46E5;">
        <a href="${cancelUrl}" style="color: #4F46E5;">${cancelUrl}</a>
      </p>

      <hr style="border: none; border-top: 1px solid #E5E7EB; margin: 24px 0;" />

      <p style="color: #6B7280; font-size: 14px;">
        <strong>What happens when your account is deleted:</strong>
      </p>

      <ul style="color: #6B7280; font-size: 14px;">
        <li>Your email and personal information will be removed</li>
        <li>You will be removed from all groups</li>
        <li>Your login credentials will be deleted</li>
        <li>Expenses you created will show "Deleted User" as the creator</li>
      </ul>

      <p style="color: #6B7280; font-size: 14px;">
        If you want to download your data before deletion, please do so from your account settings.
      </p>
    </div>
  `;

  const html = wrapInHtmlTemplate(subject, content);

  // Generate plain text version
  const text = `
Account Deletion Requested

Hi ${recipientName},

We received a request to delete your ${appName} account. Your account and all personal data will be permanently deleted on:

${deletionDate}

If you didn't request this, or if you've changed your mind, you can cancel the deletion by visiting:
${cancelUrl}

What happens when your account is deleted:
- Your email and personal information will be removed
- You will be removed from all groups
- Your login credentials will be deleted
- Expenses you created will show "Deleted User" as the creator

If you want to download your data before deletion, please do so from your account settings.

---
This email was sent by ${appName}.
  `.trim();

  return {
    subject,
    html,
    text,
  };
}
