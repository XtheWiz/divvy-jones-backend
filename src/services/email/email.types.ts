/**
 * Email Service Types
 * Sprint 006 - TASK-006
 *
 * Type definitions and interfaces for the email service abstraction.
 */

// ============================================================================
// Email Message Types
// ============================================================================

export interface EmailAddress {
  email: string;
  name?: string;
}

export interface EmailAttachment {
  filename: string;
  content: Buffer | string;
  contentType?: string;
}

export interface EmailMessage {
  to: EmailAddress | EmailAddress[];
  from?: EmailAddress;
  subject: string;
  html: string;
  text?: string;
  replyTo?: EmailAddress;
  attachments?: EmailAttachment[];
  headers?: Record<string, string>;
}

export interface EmailSendResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

// ============================================================================
// Email Provider Interface
// ============================================================================

/**
 * Interface for email providers
 * AC-1.9: Email service abstraction supports multiple providers
 */
export interface EmailProvider {
  /**
   * Provider name for logging/debugging
   */
  readonly name: string;

  /**
   * Send an email message
   */
  send(message: EmailMessage): Promise<EmailSendResult>;

  /**
   * Verify the provider connection (optional)
   */
  verify?(): Promise<boolean>;
}

// ============================================================================
// Configuration Types
// ============================================================================

export type EmailProviderType = "console" | "smtp" | "sendgrid" | "ses";

export interface SmtpConfig {
  host: string;
  port: number;
  secure?: boolean;
  auth?: {
    user: string;
    pass: string;
  };
}

export interface SendGridConfig {
  apiKey: string;
}

export interface SesConfig {
  region: string;
  accessKeyId?: string;
  secretAccessKey?: string;
}

export interface EmailServiceConfig {
  provider: EmailProviderType;
  defaultFrom: EmailAddress;
  smtp?: SmtpConfig;
  sendgrid?: SendGridConfig;
  ses?: SesConfig;
}
