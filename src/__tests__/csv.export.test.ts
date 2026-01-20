/**
 * CSV Export Service Tests
 * Sprint 005 - TASK-011
 *
 * Tests for CSV export utilities and service.
 */

import { describe, it, expect } from "bun:test";
import {
  escapeCsvValue,
  formatDateForCsv,
  formatAmountForCsv,
  generateExportFilename,
} from "../services/export/csv.service";

describe("CSV Export Utilities", () => {
  describe("escapeCsvValue", () => {
    it("should return empty string for null", () => {
      expect(escapeCsvValue(null)).toBe("");
    });

    it("should return empty string for undefined", () => {
      expect(escapeCsvValue(undefined)).toBe("");
    });

    it("should return simple strings unchanged", () => {
      expect(escapeCsvValue("Hello")).toBe("Hello");
      expect(escapeCsvValue("Simple text")).toBe("Simple text");
    });

    it("should convert numbers to strings", () => {
      expect(escapeCsvValue(100)).toBe("100");
      expect(escapeCsvValue(100.5)).toBe("100.5");
    });

    it("should wrap strings with commas in quotes", () => {
      expect(escapeCsvValue("Hello, World")).toBe('"Hello, World"');
    });

    it("should wrap strings with quotes in quotes and double the quotes", () => {
      expect(escapeCsvValue('He said "hello"')).toBe('"He said ""hello"""');
    });

    it("should wrap strings with newlines in quotes", () => {
      expect(escapeCsvValue("Line 1\nLine 2")).toBe('"Line 1\nLine 2"');
    });

    it("should handle carriage returns", () => {
      expect(escapeCsvValue("Line 1\r\nLine 2")).toBe('"Line 1\r\nLine 2"');
    });

    it("should handle multiple special characters", () => {
      expect(escapeCsvValue('Name, "Quoted", multi\nline')).toBe(
        '"Name, ""Quoted"", multi\nline"'
      );
    });
  });

  describe("formatDateForCsv", () => {
    it("should format date as YYYY-MM-DD", () => {
      const date = new Date("2025-03-15T10:30:00Z");
      expect(formatDateForCsv(date)).toBe("2025-03-15");
    });

    it("should handle single-digit months", () => {
      const date = new Date("2025-01-05T00:00:00Z");
      expect(formatDateForCsv(date)).toBe("2025-01-05");
    });

    it("should handle end of year", () => {
      const date = new Date("2025-12-31T23:59:59Z");
      expect(formatDateForCsv(date)).toBe("2025-12-31");
    });
  });

  describe("formatAmountForCsv", () => {
    it("should format whole numbers with 2 decimal places", () => {
      expect(formatAmountForCsv(100)).toBe("100.00");
    });

    it("should format decimals with 2 decimal places", () => {
      expect(formatAmountForCsv(100.5)).toBe("100.50");
      expect(formatAmountForCsv(100.55)).toBe("100.55");
    });

    it("should round to 2 decimal places", () => {
      expect(formatAmountForCsv(100.555)).toBe("100.56");
      expect(formatAmountForCsv(100.554)).toBe("100.55");
    });

    it("should handle small amounts", () => {
      expect(formatAmountForCsv(0.01)).toBe("0.01");
    });

    it("should handle zero", () => {
      expect(formatAmountForCsv(0)).toBe("0.00");
    });
  });

  describe("generateExportFilename", () => {
    it("should include sanitized group name", () => {
      const filename = generateExportFilename("My Group");
      expect(filename).toContain("my-group");
      expect(filename).toEndWith(".csv");
    });

    it("should include date range when both dates provided", () => {
      const from = new Date("2025-01-01");
      const to = new Date("2025-01-31");
      const filename = generateExportFilename("Group", from, to);
      expect(filename).toBe("group_expenses_2025-01-01_to_2025-01-31.csv");
    });

    it("should include 'from' date when only start date provided", () => {
      const from = new Date("2025-01-01");
      const filename = generateExportFilename("Group", from, undefined);
      expect(filename).toBe("group_expenses_from_2025-01-01.csv");
    });

    it("should include 'until' date when only end date provided", () => {
      const to = new Date("2025-01-31");
      const filename = generateExportFilename("Group", undefined, to);
      expect(filename).toBe("group_expenses_until_2025-01-31.csv");
    });

    it("should sanitize special characters in group name", () => {
      const filename = generateExportFilename("Test/Group@2025!");
      expect(filename).toContain("test-group-2025");
    });

    it("should handle multiple spaces and special chars", () => {
      const filename = generateExportFilename("   My   Group!!!   ");
      expect(filename).toContain("my-group");
    });

    it("should handle empty group name", () => {
      const filename = generateExportFilename("");
      expect(filename).toMatch(/_expenses_/);
      expect(filename).toEndWith(".csv");
    });
  });
});

describe("CSV Export Format", () => {
  it("should produce valid CSV structure", () => {
    // Test that CSV utilities produce proper format
    const headers = ["Date", "Title", "Amount", "Currency"];
    const row = [
      formatDateForCsv(new Date("2025-01-15")),
      escapeCsvValue("Dinner, Restaurant"),
      formatAmountForCsv(50.25),
      "USD",
    ];

    const headerLine = headers.join(",");
    const dataLine = row.join(",");

    expect(headerLine).toBe("Date,Title,Amount,Currency");
    expect(dataLine).toBe('2025-01-15,"Dinner, Restaurant",50.25,USD');
  });

  it("should handle complex split formatting", () => {
    const splits = [
      { displayName: "Alice", amount: 33.33 },
      { displayName: "Bob", amount: 33.33 },
      { displayName: "Charlie", amount: 33.34 },
    ];

    const formatted = splits
      .map((s) => `${s.displayName}: ${formatAmountForCsv(s.amount)}`)
      .join("; ");

    expect(formatted).toBe("Alice: 33.33; Bob: 33.33; Charlie: 33.34");
  });

  it("should escape splits with special characters", () => {
    const formatted = "Alice, Bob: 50.00; Charlie: 50.00";
    const escaped = escapeCsvValue(formatted);

    expect(escaped).toBe('"Alice, Bob: 50.00; Charlie: 50.00"');
  });
});
