/**
 * SMTP Email Provider
 * Sprint 006 - TASK-006
 *
 * Production-ready provider using nodemailer for SMTP transport.
 */

import nodemailer, { type Transporter } from "nodemailer";
import type SMTPTransport from "nodemailer/lib/smtp-transport";
import type {
  EmailProvider,
  EmailMessage,
  EmailSendResult,
  SmtpConfig,
  EmailAddress,
} from "./email.types";

// ============================================================================
// SMTP Provider Implementation
// ============================================================================

export class SmtpEmailProvider implements EmailProvider {
  readonly name = "smtp";
  private transporter: Transporter<SMTPTransport.SentMessageInfo>;

  constructor(config: SmtpConfig) {
    this.transporter = nodemailer.createTransport({
      host: config.host,
      port: config.port,
      secure: config.secure ?? config.port === 465,
      auth: config.auth,
    });
  }

  async send(message: EmailMessage): Promise<EmailSendResult> {
    try {
      const formatAddress = (addr: EmailAddress): string =>
        addr.name ? `${addr.name} <${addr.email}>` : addr.email;

      const recipients = Array.isArray(message.to)
        ? message.to.map(formatAddress)
        : [formatAddress(message.to)];

      const mailOptions: SMTPTransport.Options = {
        to: recipients,
        subject: message.subject,
        html: message.html,
        text: message.text,
      };

      if (message.from) {
        mailOptions.from = formatAddress(message.from);
      }

      if (message.replyTo) {
        mailOptions.replyTo = formatAddress(message.replyTo);
      }

      if (message.attachments) {
        mailOptions.attachments = message.attachments.map((att) => ({
          filename: att.filename,
          content: att.content,
          contentType: att.contentType,
        }));
      }

      if (message.headers) {
        mailOptions.headers = message.headers;
      }

      const info = await this.transporter.sendMail(mailOptions);

      return {
        success: true,
        messageId: info.messageId,
      };
    } catch (err) {
      const error = err instanceof Error ? err.message : "Unknown error";
      console.error(`[SMTP] Failed to send email: ${error}`);

      return {
        success: false,
        error,
      };
    }
  }

  async verify(): Promise<boolean> {
    try {
      await this.transporter.verify();
      return true;
    } catch (err) {
      const error = err instanceof Error ? err.message : "Unknown error";
      console.error(`[SMTP] Verification failed: ${error}`);
      return false;
    }
  }
}
