/**
 * PDF Export Service Tests
 * Sprint 007 - TASK-006
 *
 * Tests for PDF export utilities and filename generation.
 */

import { describe, it, expect } from "bun:test";
import { generatePdfFilename } from "../services/export/pdf.service";

describe("PDF Export Utilities", () => {
  describe("generatePdfFilename", () => {
    it("should include sanitized group name", () => {
      const filename = generatePdfFilename("My Group");
      expect(filename).toContain("my-group");
      expect(filename).toEndWith(".pdf");
    });

    it("should include date range when both dates provided", () => {
      const from = new Date("2025-01-01");
      const to = new Date("2025-01-31");
      const filename = generatePdfFilename("Group", from, to);
      expect(filename).toBe("group_report_2025-01-01_to_2025-01-31.pdf");
    });

    it("should include 'from' date when only start date provided", () => {
      const from = new Date("2025-01-01");
      const filename = generatePdfFilename("Group", from, undefined);
      expect(filename).toBe("group_report_from_2025-01-01.pdf");
    });

    it("should include 'until' date when only end date provided", () => {
      const to = new Date("2025-01-31");
      const filename = generatePdfFilename("Group", undefined, to);
      expect(filename).toBe("group_report_until_2025-01-31.pdf");
    });

    it("should generate dated filename when no date range", () => {
      const filename = generatePdfFilename("Test Group");
      // Should contain today's date in format YYYY-MM-DD
      const today = new Date().toISOString().split("T")[0];
      expect(filename).toBe(`test-group_report_${today}.pdf`);
    });

    it("should sanitize special characters in group name", () => {
      const filename = generatePdfFilename("Test/Group@2025!");
      expect(filename).toContain("test-group-2025");
      expect(filename).toEndWith(".pdf");
    });

    it("should handle multiple spaces and special chars", () => {
      const filename = generatePdfFilename("   My   Group!!!   ");
      expect(filename).toContain("my-group");
      expect(filename).toEndWith(".pdf");
    });

    it("should handle empty group name", () => {
      const filename = generatePdfFilename("");
      expect(filename).toMatch(/_report_/);
      expect(filename).toEndWith(".pdf");
    });

    it("should convert uppercase to lowercase", () => {
      const filename = generatePdfFilename("MY GROUP NAME");
      expect(filename).toContain("my-group-name");
    });

    it("should handle numbers in group name", () => {
      const filename = generatePdfFilename("Group 2025");
      expect(filename).toContain("group-2025");
    });

    it("should handle dashes in group name", () => {
      const filename = generatePdfFilename("Team-Alpha");
      expect(filename).toContain("team-alpha");
    });

    it("should remove leading and trailing dashes", () => {
      const filename = generatePdfFilename("-Group-");
      expect(filename).toContain("group_report");
      expect(filename).not.toContain("--");
    });
  });
});

describe("PDF Export Format", () => {
  it("should produce .pdf extension", () => {
    const filename = generatePdfFilename("Test Group");
    expect(filename.split(".").pop()).toBe("pdf");
  });

  it("should produce valid filename characters", () => {
    const filename = generatePdfFilename("Test Group with @#$% chars");
    // Filename should only contain safe characters
    expect(filename).toMatch(/^[a-z0-9_\-.]+$/);
  });

  it("should include 'report' in filename to distinguish from CSV exports", () => {
    const filename = generatePdfFilename("Test");
    expect(filename).toContain("_report_");
  });
});

describe("PDF Export Date Handling", () => {
  it("should handle year boundary dates", () => {
    const from = new Date("2024-12-31");
    const to = new Date("2025-01-01");
    const filename = generatePdfFilename("Group", from, to);
    expect(filename).toBe("group_report_2024-12-31_to_2025-01-01.pdf");
  });

  it("should handle same day date range", () => {
    const date = new Date("2025-06-15");
    const filename = generatePdfFilename("Group", date, date);
    expect(filename).toBe("group_report_2025-06-15_to_2025-06-15.pdf");
  });

  it("should format dates in ISO format", () => {
    const from = new Date("2025-03-05");
    const to = new Date("2025-03-10");
    const filename = generatePdfFilename("Test", from, to);
    // Should use YYYY-MM-DD format with zero-padded month/day
    expect(filename).toContain("2025-03-05");
    expect(filename).toContain("2025-03-10");
  });
});
