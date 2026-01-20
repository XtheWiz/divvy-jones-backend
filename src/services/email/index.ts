/**
 * Email Service
 * Sprint 006 - TASK-006
 *
 * Main entry point for the email service abstraction.
 * AC-1.9: Email service abstraction supports multiple providers (SendGrid, SES, SMTP)
 */

import type {
  EmailProvider,
  EmailMessage,
  EmailSendResult,
  EmailServiceConfig,
  EmailProviderType,
  EmailAddress,
} from "./email.types";
import { ConsoleEmailProvider } from "./console.provider";
import { SmtpEmailProvider } from "./smtp.provider";

// ============================================================================
// Re-exports
// ============================================================================

export type {
  EmailProvider,
  EmailMessage,
  EmailSendResult,
  EmailServiceConfig,
  EmailProviderType,
  EmailAddress,
} from "./email.types";

// ============================================================================
// Email Service Class
// ============================================================================

export class EmailService {
  private provider: EmailProvider;
  private defaultFrom: EmailAddress;

  constructor(provider: EmailProvider, defaultFrom: EmailAddress) {
    this.provider = provider;
    this.defaultFrom = defaultFrom;
  }

  /**
   * Get the provider name
   */
  get providerName(): string {
    return this.provider.name;
  }

  /**
   * Send an email
   */
  async send(message: EmailMessage): Promise<EmailSendResult> {
    // Apply default from address if not specified
    const messageWithDefaults: EmailMessage = {
      ...message,
      from: message.from || this.defaultFrom,
    };

    return this.provider.send(messageWithDefaults);
  }

  /**
   * Verify the email provider connection
   */
  async verify(): Promise<boolean> {
    if (this.provider.verify) {
      return this.provider.verify();
    }
    return true;
  }
}

// ============================================================================
// Factory Function
// ============================================================================

/**
 * Create an email service with the specified configuration
 */
export function createEmailService(config: EmailServiceConfig): EmailService {
  const provider = createEmailProvider(config);
  return new EmailService(provider, config.defaultFrom);
}

/**
 * Create an email provider based on configuration
 */
function createEmailProvider(config: EmailServiceConfig): EmailProvider {
  switch (config.provider) {
    case "console":
      return new ConsoleEmailProvider();

    case "smtp":
      if (!config.smtp) {
        throw new Error("SMTP configuration is required for smtp provider");
      }
      return new SmtpEmailProvider(config.smtp);

    case "sendgrid":
      // Stub for SendGrid - not implemented yet
      console.warn("SendGrid provider is not yet implemented, falling back to console");
      return new ConsoleEmailProvider();

    case "ses":
      // Stub for AWS SES - not implemented yet
      console.warn("SES provider is not yet implemented, falling back to console");
      return new ConsoleEmailProvider();

    default:
      throw new Error(`Unknown email provider: ${config.provider}`);
  }
}

// ============================================================================
// Default Configuration from Environment
// ============================================================================

let defaultEmailService: EmailService | null = null;

/**
 * Get the default email service instance
 * Creates one based on environment variables if not already created
 */
export function getEmailService(): EmailService {
  if (defaultEmailService) {
    return defaultEmailService;
  }

  const providerType = (process.env.EMAIL_PROVIDER || "console") as EmailProviderType;

  const config: EmailServiceConfig = {
    provider: providerType,
    defaultFrom: {
      email: process.env.EMAIL_FROM_ADDRESS || "noreply@divvy-jones.app",
      name: process.env.EMAIL_FROM_NAME || "Divvy Jones",
    },
  };

  // Add SMTP config if using SMTP provider
  if (providerType === "smtp") {
    config.smtp = {
      host: process.env.SMTP_HOST || "localhost",
      port: parseInt(process.env.SMTP_PORT || "587", 10),
      secure: process.env.SMTP_SECURE === "true",
      auth: process.env.SMTP_USER
        ? {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASS || "",
          }
        : undefined,
    };
  }

  // Add SendGrid config if using SendGrid provider
  if (providerType === "sendgrid" && process.env.SENDGRID_API_KEY) {
    config.sendgrid = {
      apiKey: process.env.SENDGRID_API_KEY,
    };
  }

  // Add SES config if using SES provider
  if (providerType === "ses") {
    config.ses = {
      region: process.env.AWS_REGION || "us-east-1",
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    };
  }

  defaultEmailService = createEmailService(config);
  return defaultEmailService;
}

/**
 * Reset the default email service (useful for testing)
 */
export function resetEmailService(): void {
  defaultEmailService = null;
}
