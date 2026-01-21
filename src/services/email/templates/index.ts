/**
 * Email Templates
 * Sprint 006 - TASK-007
 *
 * AC-1.10: Email templates exist for: expense_added, settlement_requested, settlement_confirmed
 */

export { expenseAddedTemplate, type ExpenseAddedTemplateData } from "./expense-added";
export { settlementRequestedTemplate, type SettlementRequestedTemplateData } from "./settlement-requested";
export { settlementConfirmedTemplate, type SettlementConfirmedTemplateData } from "./settlement-confirmed";
export { passwordResetTemplate, type PasswordResetTemplateData } from "./password-reset";

// ============================================================================
// Template Utilities
// ============================================================================

/**
 * Common email styles
 */
export const emailStyles = `
  body {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
    line-height: 1.6;
    color: #333;
    margin: 0;
    padding: 0;
    background-color: #f5f5f5;
  }
  .container {
    max-width: 600px;
    margin: 0 auto;
    background-color: #ffffff;
    border-radius: 8px;
    overflow: hidden;
  }
  .header {
    background-color: #4F46E5;
    color: white;
    padding: 24px;
    text-align: center;
  }
  .header h1 {
    margin: 0;
    font-size: 24px;
    font-weight: 600;
  }
  .content {
    padding: 32px 24px;
  }
  .highlight {
    background-color: #F3F4F6;
    border-radius: 8px;
    padding: 16px;
    margin: 16px 0;
  }
  .amount {
    font-size: 28px;
    font-weight: 700;
    color: #4F46E5;
  }
  .button {
    display: inline-block;
    background-color: #4F46E5;
    color: white;
    padding: 12px 24px;
    text-decoration: none;
    border-radius: 6px;
    margin-top: 16px;
  }
  .footer {
    background-color: #F9FAFB;
    padding: 24px;
    text-align: center;
    font-size: 12px;
    color: #6B7280;
  }
  .footer a {
    color: #4F46E5;
  }
`;

/**
 * Base HTML template wrapper
 */
export function wrapInHtmlTemplate(title: string, content: string): string {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <style>${emailStyles}</style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Divvy Jones</h1>
    </div>
    ${content}
    <div class="footer">
      <p>This email was sent by Divvy Jones.</p>
      <p>If you didn't expect this email, you can safely ignore it.</p>
    </div>
  </div>
</body>
</html>
  `.trim();
}

/**
 * Convert HTML to plain text (simple version)
 */
export function htmlToPlainText(html: string): string {
  return html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, "")
    .replace(/\s+/g, " ")
    .trim();
}
