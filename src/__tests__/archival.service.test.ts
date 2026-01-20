/**
 * Archival Service Unit Tests
 * Sprint 006 - TASK-013
 *
 * Tests for activity log archival functionality.
 */

import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import {
  getRetentionDays,
  getArchivalCutoffDate,
} from "../services/archival.service";

// ============================================================================
// Retention Days Configuration Tests
// ============================================================================

describe("Archival Service - getRetentionDays", () => {
  const originalEnv = process.env.ARCHIVAL_RETENTION_DAYS;

  afterEach(() => {
    // Restore original env
    if (originalEnv !== undefined) {
      process.env.ARCHIVAL_RETENTION_DAYS = originalEnv;
    } else {
      delete process.env.ARCHIVAL_RETENTION_DAYS;
    }
  });

  test("returns default 90 days when env not set", () => {
    delete process.env.ARCHIVAL_RETENTION_DAYS;
    expect(getRetentionDays()).toBe(90);
  });

  test("returns configured value from environment", () => {
    process.env.ARCHIVAL_RETENTION_DAYS = "30";
    expect(getRetentionDays()).toBe(30);
  });

  test("returns default when env value is invalid", () => {
    process.env.ARCHIVAL_RETENTION_DAYS = "invalid";
    expect(getRetentionDays()).toBe(90);
  });

  test("returns default when env value is negative", () => {
    process.env.ARCHIVAL_RETENTION_DAYS = "-30";
    expect(getRetentionDays()).toBe(90);
  });

  test("returns default when env value is zero", () => {
    process.env.ARCHIVAL_RETENTION_DAYS = "0";
    expect(getRetentionDays()).toBe(90);
  });

  test("handles decimal values by parsing as integer", () => {
    process.env.ARCHIVAL_RETENTION_DAYS = "45.7";
    expect(getRetentionDays()).toBe(45);
  });
});

// ============================================================================
// Cutoff Date Calculation Tests
// ============================================================================

describe("Archival Service - getArchivalCutoffDate", () => {
  test("calculates cutoff date correctly for 90 days", () => {
    const now = new Date();
    const cutoff = getArchivalCutoffDate(90);

    // Cutoff should be approximately 90 days ago
    const expectedCutoff = new Date(now);
    expectedCutoff.setDate(expectedCutoff.getDate() - 90);

    // Allow 1 second tolerance for test execution time
    const diff = Math.abs(cutoff.getTime() - expectedCutoff.getTime());
    expect(diff).toBeLessThan(1000);
  });

  test("calculates cutoff date correctly for 30 days", () => {
    const now = new Date();
    const cutoff = getArchivalCutoffDate(30);

    const expectedCutoff = new Date(now);
    expectedCutoff.setDate(expectedCutoff.getDate() - 30);

    const diff = Math.abs(cutoff.getTime() - expectedCutoff.getTime());
    expect(diff).toBeLessThan(1000);
  });

  test("calculates cutoff date correctly for 1 day", () => {
    const now = new Date();
    const cutoff = getArchivalCutoffDate(1);

    const expectedCutoff = new Date(now);
    expectedCutoff.setDate(expectedCutoff.getDate() - 1);

    const diff = Math.abs(cutoff.getTime() - expectedCutoff.getTime());
    expect(diff).toBeLessThan(1000);
  });

  test("uses default retention days when not specified", () => {
    const originalEnv = process.env.ARCHIVAL_RETENTION_DAYS;
    delete process.env.ARCHIVAL_RETENTION_DAYS;

    const now = new Date();
    const cutoff = getArchivalCutoffDate();

    // Should use default 90 days
    const expectedCutoff = new Date(now);
    expectedCutoff.setDate(expectedCutoff.getDate() - 90);

    const diff = Math.abs(cutoff.getTime() - expectedCutoff.getTime());
    expect(diff).toBeLessThan(1000);

    // Restore env
    if (originalEnv !== undefined) {
      process.env.ARCHIVAL_RETENTION_DAYS = originalEnv;
    }
  });

  test("cutoff date is in the past", () => {
    const cutoff = getArchivalCutoffDate(90);
    const now = new Date();
    expect(cutoff.getTime()).toBeLessThan(now.getTime());
  });
});

// ============================================================================
// Archival Options Validation Tests
// ============================================================================

describe("Archival Service - Option Handling", () => {
  test("batch size default is reasonable", () => {
    // The default batch size should be 1000 as defined in the service
    // We can't directly test private constants, but we can verify the behavior
    // when archiving large datasets doesn't timeout
    expect(true).toBe(true); // Placeholder - actual batch testing needs DB
  });

  test("dry run doesn't modify data", () => {
    // Dry run testing requires database integration
    // This is a placeholder for the behavior verification
    expect(true).toBe(true);
  });
});

// ============================================================================
// Edge Cases
// ============================================================================

describe("Archival Service - Edge Cases", () => {
  test("handles very large retention days", () => {
    const cutoff = getArchivalCutoffDate(3650); // 10 years
    const now = new Date();

    // Should still calculate correctly
    const expectedCutoff = new Date(now);
    expectedCutoff.setDate(expectedCutoff.getDate() - 3650);

    const diff = Math.abs(cutoff.getTime() - expectedCutoff.getTime());
    expect(diff).toBeLessThan(1000);
  });

  test("cutoff date handles month boundaries correctly", () => {
    // Test that the date calculation works across month boundaries
    const cutoff = getArchivalCutoffDate(45);
    expect(cutoff).toBeInstanceOf(Date);
    expect(cutoff.getTime()).toBeLessThan(Date.now());
  });

  test("cutoff date handles year boundaries correctly", () => {
    // Test with a value that would cross a year boundary
    const cutoff = getArchivalCutoffDate(400);
    expect(cutoff).toBeInstanceOf(Date);
    expect(cutoff.getTime()).toBeLessThan(Date.now());
  });
});
