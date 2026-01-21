/**
 * Email Verification Template
 * Sprint 010 - TASK-012
 *
 * AC-1.8: Email verification template created with clear CTA
 * Includes verification link with token and expiry warning (24 hours)
 */

import { wrapInHtmlTemplate } from "./index";

// ============================================================================
// Types
// ============================================================================

export interface EmailVerificationTemplateData {
  /** Recipient's display name */
  recipientName: string;
  /** Email verification URL with token */
  verificationUrl: string;
  /** How long the link is valid (e.g., "24 hours") */
  expiryTime: string;
  /** App name for branding */
  appName?: string;
}

// ============================================================================
// Template
// ============================================================================

/**
 * Generate email verification content
 *
 * @param data - Template data
 * @returns Object with subject, HTML body, and plain text body
 */
export function emailVerificationTemplate(data: EmailVerificationTemplateData) {
  const {
    recipientName,
    verificationUrl,
    expiryTime,
    appName = "Divvy Jones",
  } = data;

  const subject = `Verify your ${appName} email address`;

  const content = `
    <div class="content">
      <h2>Welcome to ${appName}!</h2>

      <p>Hi ${recipientName},</p>

      <p>Thank you for signing up! Please verify your email address by clicking the button below:</p>

      <div style="text-align: center; margin: 32px 0;">
        <a href="${verificationUrl}" class="button" style="color: white; text-decoration: none;">
          Verify Email Address
        </a>
      </div>

      <div class="highlight">
        <p style="margin: 0;">
          <strong>Note:</strong> This link will expire in <strong>${expiryTime}</strong>.
        </p>
      </div>

      <p>If the button above doesn't work, copy and paste this link into your browser:</p>

      <p style="word-break: break-all; color: #4F46E5;">
        <a href="${verificationUrl}" style="color: #4F46E5;">${verificationUrl}</a>
      </p>

      <hr style="border: none; border-top: 1px solid #E5E7EB; margin: 24px 0;" />

      <p style="color: #6B7280; font-size: 14px;">
        If you didn't create a ${appName} account, you can safely ignore this email.
      </p>

      <p style="color: #6B7280; font-size: 14px;">
        Need a new verification link? You can request one from your account settings
        or the login page.
      </p>
    </div>
  `;

  const html = wrapInHtmlTemplate(subject, content);

  // Generate plain text version
  const text = `
Welcome to ${appName}!

Hi ${recipientName},

Thank you for signing up! Please verify your email address by clicking the link below:

${verificationUrl}

NOTE: This link will expire in ${expiryTime}.

If you didn't create a ${appName} account, you can safely ignore this email.

Need a new verification link? You can request one from your account settings or the login page.

---
This email was sent by ${appName}.
  `.trim();

  return {
    subject,
    html,
    text,
  };
}

// ============================================================================
// Resend Template
// ============================================================================

/**
 * Generate resend verification email content
 *
 * @param data - Template data
 * @returns Object with subject, HTML body, and plain text body
 */
export function resendVerificationTemplate(data: EmailVerificationTemplateData) {
  const {
    recipientName,
    verificationUrl,
    expiryTime,
    appName = "Divvy Jones",
  } = data;

  const subject = `New verification link for ${appName}`;

  const content = `
    <div class="content">
      <h2>New Verification Link</h2>

      <p>Hi ${recipientName},</p>

      <p>You requested a new email verification link. Click the button below to verify your email address:</p>

      <div style="text-align: center; margin: 32px 0;">
        <a href="${verificationUrl}" class="button" style="color: white; text-decoration: none;">
          Verify Email Address
        </a>
      </div>

      <div class="highlight">
        <p style="margin: 0;">
          <strong>Note:</strong> This link will expire in <strong>${expiryTime}</strong>.
          Any previous verification links have been invalidated.
        </p>
      </div>

      <p>If the button above doesn't work, copy and paste this link into your browser:</p>

      <p style="word-break: break-all; color: #4F46E5;">
        <a href="${verificationUrl}" style="color: #4F46E5;">${verificationUrl}</a>
      </p>

      <hr style="border: none; border-top: 1px solid #E5E7EB; margin: 24px 0;" />

      <p style="color: #6B7280; font-size: 14px;">
        If you didn't request this link, you can safely ignore this email.
      </p>
    </div>
  `;

  const html = wrapInHtmlTemplate(subject, content);

  // Generate plain text version
  const text = `
New Verification Link

Hi ${recipientName},

You requested a new email verification link. Click the link below to verify your email address:

${verificationUrl}

NOTE: This link will expire in ${expiryTime}. Any previous verification links have been invalidated.

If you didn't request this link, you can safely ignore this email.

---
This email was sent by ${appName}.
  `.trim();

  return {
    subject,
    html,
    text,
  };
}
