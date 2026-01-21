/**
 * Password Reset Email Template
 * Sprint 009 - TASK-016
 *
 * AC-4.7: Email template for password reset created
 * Includes reset link with token and expiry warning (1 hour)
 */

import { wrapInHtmlTemplate, htmlToPlainText } from "./index";

// ============================================================================
// Types
// ============================================================================

export interface PasswordResetTemplateData {
  /** Recipient's display name */
  recipientName: string;
  /** Password reset URL with token */
  resetUrl: string;
  /** How long the link is valid (e.g., "1 hour") */
  expiryTime: string;
  /** App name for branding */
  appName?: string;
}

// ============================================================================
// Template
// ============================================================================

/**
 * Generate password reset email content
 *
 * @param data - Template data
 * @returns Object with subject, HTML body, and plain text body
 */
export function passwordResetTemplate(data: PasswordResetTemplateData) {
  const {
    recipientName,
    resetUrl,
    expiryTime,
    appName = "Divvy Jones",
  } = data;

  const subject = `Reset your ${appName} password`;

  const content = `
    <div class="content">
      <h2>Password Reset Request</h2>

      <p>Hi ${recipientName},</p>

      <p>We received a request to reset your password for your ${appName} account.
      Click the button below to set a new password:</p>

      <div style="text-align: center; margin: 32px 0;">
        <a href="${resetUrl}" class="button" style="color: white; text-decoration: none;">
          Reset Password
        </a>
      </div>

      <div class="highlight">
        <p style="margin: 0;">
          <strong>Important:</strong> This link will expire in <strong>${expiryTime}</strong>.
        </p>
      </div>

      <p>If the button above doesn't work, copy and paste this link into your browser:</p>

      <p style="word-break: break-all; color: #4F46E5;">
        <a href="${resetUrl}" style="color: #4F46E5;">${resetUrl}</a>
      </p>

      <hr style="border: none; border-top: 1px solid #E5E7EB; margin: 24px 0;" />

      <p style="color: #6B7280; font-size: 14px;">
        If you didn't request a password reset, you can safely ignore this email.
        Your password will remain unchanged.
      </p>

      <p style="color: #6B7280; font-size: 14px;">
        For security reasons, this link can only be used once. If you need to reset
        your password again, please request a new link.
      </p>
    </div>
  `;

  const html = wrapInHtmlTemplate(subject, content);

  // Generate plain text version
  const text = `
Password Reset Request

Hi ${recipientName},

We received a request to reset your password for your ${appName} account.

Click the link below to set a new password:
${resetUrl}

IMPORTANT: This link will expire in ${expiryTime}.

If you didn't request a password reset, you can safely ignore this email. Your password will remain unchanged.

For security reasons, this link can only be used once. If you need to reset your password again, please request a new link.

---
This email was sent by ${appName}.
  `.trim();

  return {
    subject,
    html,
    text,
  };
}
