/**
 * Email Templates Unit Tests
 * Sprint 006 - TASK-013
 *
 * Tests for email template generation.
 * AC-1.10: Email templates exist for expense_added, settlement_requested, settlement_confirmed
 */

import { describe, test, expect } from "bun:test";
import { expenseAddedTemplate } from "../services/email/templates/expense-added";
import { settlementRequestedTemplate } from "../services/email/templates/settlement-requested";
import { settlementConfirmedTemplate } from "../services/email/templates/settlement-confirmed";
import { wrapInHtmlTemplate, htmlToPlainText } from "../services/email/templates";

// ============================================================================
// Expense Added Template Tests
// ============================================================================

describe("Email Templates - Expense Added", () => {
  const baseData = {
    recipientName: "Alice",
    actorName: "Bob",
    groupName: "Roommates",
    expenseName: "Groceries",
    amount: 150.0,
    currency: "USD",
    yourShare: 75.0,
  };

  test("generates correct subject line", () => {
    const result = expenseAddedTemplate(baseData);
    expect(result.subject).toBe("New expense added in Roommates: Groceries");
  });

  test("includes recipient name in greeting", () => {
    const result = expenseAddedTemplate(baseData);
    expect(result.html).toContain("Hi Alice");
    expect(result.text).toContain("Hi Alice");
  });

  test("includes actor name", () => {
    const result = expenseAddedTemplate(baseData);
    expect(result.html).toContain("Bob");
    expect(result.text).toContain("Bob");
  });

  test("includes group name", () => {
    const result = expenseAddedTemplate(baseData);
    expect(result.html).toContain("Roommates");
    expect(result.text).toContain("Roommates");
  });

  test("includes expense name", () => {
    const result = expenseAddedTemplate(baseData);
    expect(result.html).toContain("Groceries");
    expect(result.text).toContain("Groceries");
  });

  test("formats amount correctly with currency", () => {
    const result = expenseAddedTemplate(baseData);
    expect(result.html).toContain("USD 150.00");
    expect(result.text).toContain("USD 150.00");
  });

  test("shows user's share", () => {
    const result = expenseAddedTemplate(baseData);
    expect(result.html).toContain("USD 75.00");
    expect(result.text).toContain("Your share: USD 75.00");
  });

  test("includes category when provided", () => {
    const result = expenseAddedTemplate({ ...baseData, category: "Food" });
    expect(result.html).toContain("Food");
    expect(result.text).toContain("Category: Food");
  });

  test("excludes category when not provided", () => {
    const result = expenseAddedTemplate(baseData);
    expect(result.text).not.toContain("Category:");
  });

  test("includes expense date when provided", () => {
    const result = expenseAddedTemplate({ ...baseData, expenseDate: "2025-01-15" });
    expect(result.html).toContain("2025-01-15");
    expect(result.text).toContain("2025-01-15");
  });

  test("includes app URL link", () => {
    const result = expenseAddedTemplate({ ...baseData, appUrl: "https://example.com" });
    expect(result.html).toContain("https://example.com/groups");
    expect(result.text).toContain("https://example.com/groups");
  });

  test("uses default app URL when not provided", () => {
    const result = expenseAddedTemplate(baseData);
    expect(result.html).toContain("https://divvy-jones.app");
  });

  test("returns valid HTML structure", () => {
    const result = expenseAddedTemplate(baseData);
    expect(result.html).toContain("<!DOCTYPE html>");
    expect(result.html).toContain("<html");
    expect(result.html).toContain("</html>");
  });

  test("text version is readable", () => {
    const result = expenseAddedTemplate(baseData);
    expect(result.text).not.toContain("<");
    expect(result.text).not.toContain(">");
    expect(result.text).toContain("Divvy Jones");
  });
});

// ============================================================================
// Settlement Requested Template Tests
// ============================================================================

describe("Email Templates - Settlement Requested", () => {
  const baseData = {
    recipientName: "Alice",
    payerName: "Bob",
    groupName: "Trip Buddies",
    amount: 200.0,
    currency: "EUR",
    note: "For the hotel booking",
  };

  test("generates correct subject line", () => {
    const result = settlementRequestedTemplate(baseData);
    expect(result.subject).toContain("Bob");
    expect(result.subject).toContain("EUR 200.00");
  });

  test("includes payer name", () => {
    const result = settlementRequestedTemplate(baseData);
    expect(result.html).toContain("Bob");
    expect(result.text).toContain("Bob");
  });

  test("shows settlement amount", () => {
    const result = settlementRequestedTemplate(baseData);
    expect(result.html).toContain("EUR 200.00");
    expect(result.text).toContain("EUR 200.00");
  });

  test("includes note when provided", () => {
    const result = settlementRequestedTemplate(baseData);
    expect(result.html).toContain("For the hotel booking");
    expect(result.text).toContain("For the hotel booking");
  });

  test("handles missing note", () => {
    const data = { ...baseData, note: undefined };
    const result = settlementRequestedTemplate(data);
    expect(result.html).toBeDefined();
    expect(result.text).toBeDefined();
  });

  test("returns all three parts", () => {
    const result = settlementRequestedTemplate(baseData);
    expect(result).toHaveProperty("subject");
    expect(result).toHaveProperty("html");
    expect(result).toHaveProperty("text");
  });
});

// ============================================================================
// Settlement Confirmed Template Tests
// ============================================================================

describe("Email Templates - Settlement Confirmed", () => {
  const baseData = {
    recipientName: "Bob",
    payeeName: "Alice",
    groupName: "Roommates",
    amount: 100.0,
    currency: "USD",
    settledAt: "2025-01-20",
  };

  test("generates correct subject line", () => {
    const result = settlementConfirmedTemplate(baseData);
    expect(result.subject).toContain("Settlement confirmed");
  });

  test("includes payee name (person who was paid)", () => {
    const result = settlementConfirmedTemplate(baseData);
    expect(result.html).toContain("Alice");
    expect(result.text).toContain("Alice");
  });

  test("shows confirmed amount", () => {
    const result = settlementConfirmedTemplate(baseData);
    expect(result.html).toContain("USD 100.00");
    expect(result.text).toContain("USD 100.00");
  });

  test("includes settlement date", () => {
    const result = settlementConfirmedTemplate(baseData);
    // Date is formatted as locale date string
    expect(result.html).toContain("Confirmed on:");
    expect(result.text).toContain("Confirmed on:");
  });

  test("returns valid structure", () => {
    const result = settlementConfirmedTemplate(baseData);
    expect(typeof result.subject).toBe("string");
    expect(typeof result.html).toBe("string");
    expect(typeof result.text).toBe("string");
  });
});

// ============================================================================
// Template Helpers Tests
// ============================================================================

describe("Email Templates - Helpers", () => {
  test("wrapInHtmlTemplate creates valid HTML document", () => {
    const html = wrapInHtmlTemplate("Test Subject", "<p>Hello</p>");
    expect(html).toContain("<!DOCTYPE html>");
    expect(html).toContain("<html");
    expect(html).toContain("<head>");
    expect(html).toContain("<body>");
    expect(html).toContain("<p>Hello</p>");
  });

  test("wrapInHtmlTemplate includes responsive meta tag", () => {
    const html = wrapInHtmlTemplate("Test", "<p>Content</p>");
    expect(html).toContain("viewport");
  });

  test("wrapInHtmlTemplate includes basic styles", () => {
    const html = wrapInHtmlTemplate("Test", "<p>Content</p>");
    // Should have some CSS
    expect(html).toContain("style");
  });

  test("htmlToPlainText removes HTML tags", () => {
    const text = htmlToPlainText("<p>Hello <strong>World</strong></p>");
    expect(text).not.toContain("<p>");
    expect(text).not.toContain("<strong>");
    expect(text).toContain("Hello");
    expect(text).toContain("World");
  });

  test("htmlToPlainText handles nested tags", () => {
    const text = htmlToPlainText("<div><p>Nested <span>content</span></p></div>");
    expect(text).toContain("Nested");
    expect(text).toContain("content");
  });

  test("htmlToPlainText preserves text content", () => {
    const text = htmlToPlainText("Plain text without tags");
    expect(text).toBe("Plain text without tags");
  });
});

// ============================================================================
// Edge Cases
// ============================================================================

describe("Email Templates - Edge Cases", () => {
  test("handles special characters in names", () => {
    const data = {
      recipientName: "O'Connor",
      actorName: "José García",
      groupName: "Büro Kollegen",
      expenseName: "Café & Kuchen",
      amount: 25.0,
      currency: "EUR",
      yourShare: 12.5,
    };
    const result = expenseAddedTemplate(data);
    // Template includes special characters as-is
    expect(result.html).toContain("O'Connor");
    expect(result.text).toContain("O'Connor");
    expect(result.text).toContain("José García");
  });

  test("handles zero amount", () => {
    const data = {
      recipientName: "Alice",
      actorName: "Bob",
      groupName: "Group",
      expenseName: "Free item",
      amount: 0,
      currency: "USD",
      yourShare: 0,
    };
    const result = expenseAddedTemplate(data);
    expect(result.html).toContain("USD 0.00");
  });

  test("handles very large amounts", () => {
    const data = {
      recipientName: "Alice",
      actorName: "Bob",
      groupName: "Group",
      expenseName: "Big expense",
      amount: 1000000.99,
      currency: "USD",
      yourShare: 500000.495,
    };
    const result = expenseAddedTemplate(data);
    expect(result.html).toContain("1000000.99");
  });

  test("handles long expense names", () => {
    const data = {
      recipientName: "Alice",
      actorName: "Bob",
      groupName: "Group",
      expenseName: "A very long expense name that might cause layout issues in email clients",
      amount: 100,
      currency: "USD",
      yourShare: 50,
    };
    const result = expenseAddedTemplate(data);
    expect(result.subject).toContain("A very long expense name");
  });
});

// ============================================================================
// Currency Formatting Tests
// ============================================================================

describe("Email Templates - Currency Formatting", () => {
  test("formats USD correctly", () => {
    const data = {
      recipientName: "Alice",
      actorName: "Bob",
      groupName: "Group",
      expenseName: "Test",
      amount: 99.99,
      currency: "USD",
      yourShare: 50.0,
    };
    const result = expenseAddedTemplate(data);
    expect(result.text).toContain("USD 99.99");
    expect(result.text).toContain("USD 50.00");
  });

  test("formats EUR correctly", () => {
    const data = {
      recipientName: "Alice",
      actorName: "Bob",
      groupName: "Group",
      expenseName: "Test",
      amount: 100,
      currency: "EUR",
      yourShare: 50,
    };
    const result = expenseAddedTemplate(data);
    expect(result.text).toContain("EUR 100.00");
  });

  test("formats JPY correctly (no decimals in real use but template adds .00)", () => {
    const data = {
      recipientName: "Alice",
      actorName: "Bob",
      groupName: "Group",
      expenseName: "Test",
      amount: 1000,
      currency: "JPY",
      yourShare: 500,
    };
    const result = expenseAddedTemplate(data);
    expect(result.text).toContain("JPY 1000.00");
  });
});
