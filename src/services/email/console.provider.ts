/**
 * Console Email Provider
 * Sprint 006 - TASK-006
 *
 * Development provider that logs emails to console instead of sending.
 * Useful for local development and testing.
 */

import type {
  EmailProvider,
  EmailMessage,
  EmailSendResult,
  EmailAddress,
} from "./email.types";

// ============================================================================
// Console Provider Implementation
// ============================================================================

export class ConsoleEmailProvider implements EmailProvider {
  readonly name = "console";

  async send(message: EmailMessage): Promise<EmailSendResult> {
    const messageId = `console-${Date.now()}-${Math.random().toString(36).slice(2)}`;

    const formatAddress = (addr: EmailAddress): string =>
      addr.name ? `${addr.name} <${addr.email}>` : addr.email;

    const recipients = Array.isArray(message.to)
      ? message.to.map(formatAddress).join(", ")
      : formatAddress(message.to);

    console.log("\n" + "=".repeat(60));
    console.log("📧 EMAIL (Console Provider - Not Sent)");
    console.log("=".repeat(60));
    console.log(`Message ID: ${messageId}`);
    console.log(`To:         ${recipients}`);
    if (message.from) {
      console.log(`From:       ${formatAddress(message.from)}`);
    }
    console.log(`Subject:    ${message.subject}`);
    console.log("-".repeat(60));
    console.log("HTML Body:");
    console.log(message.html);
    if (message.text) {
      console.log("-".repeat(60));
      console.log("Text Body:");
      console.log(message.text);
    }
    if (message.attachments && message.attachments.length > 0) {
      console.log("-".repeat(60));
      console.log(`Attachments: ${message.attachments.map((a) => a.filename).join(", ")}`);
    }
    console.log("=".repeat(60) + "\n");

    return {
      success: true,
      messageId,
    };
  }

  async verify(): Promise<boolean> {
    console.log("📧 Console Email Provider: Verification skipped (development mode)");
    return true;
  }
}
