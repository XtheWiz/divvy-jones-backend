/**
 * Evidence Service Unit Tests
 * Sprint 004 - TASK-009
 *
 * Tests for file attachment validation and business logic.
 */

import { describe, test, expect } from "bun:test";
import {
  validateFile,
  generateFileKey,
  ALLOWED_MIME_TYPES,
  MAX_FILE_SIZE,
  MAX_EXPENSE_ATTACHMENTS,
  MAX_SETTLEMENT_ATTACHMENTS,
} from "../lib/storage";

// ============================================================================
// File Validation Tests
// ============================================================================

describe("Evidence Service - File Size Validation", () => {
  test("accepts file under size limit", () => {
    const buffer = Buffer.alloc(1024 * 1024); // 1MB
    const result = validateFile(buffer, "image/jpeg");
    expect(result.valid).toBe(true);
    expect(result.error).toBeUndefined();
  });

  test("accepts file at exactly size limit", () => {
    const buffer = Buffer.alloc(MAX_FILE_SIZE); // 10MB
    const result = validateFile(buffer, "image/png");
    expect(result.valid).toBe(true);
  });

  test("rejects file over size limit", () => {
    const buffer = Buffer.alloc(MAX_FILE_SIZE + 1); // 10MB + 1 byte
    const result = validateFile(buffer, "image/jpeg");
    expect(result.valid).toBe(false);
    expect(result.error).toContain("exceeds maximum");
  });

  test("rejects very large file", () => {
    const buffer = Buffer.alloc(20 * 1024 * 1024); // 20MB
    const result = validateFile(buffer, "image/jpeg");
    expect(result.valid).toBe(false);
    expect(result.error).toContain("10MB");
  });

  test("accepts empty file with valid mime type", () => {
    const buffer = Buffer.alloc(0);
    const result = validateFile(buffer, "image/jpeg");
    expect(result.valid).toBe(true);
  });
});

describe("Evidence Service - MIME Type Validation", () => {
  test("accepts JPEG images", () => {
    const buffer = Buffer.alloc(1024);
    const result = validateFile(buffer, "image/jpeg");
    expect(result.valid).toBe(true);
  });

  test("accepts PNG images", () => {
    const buffer = Buffer.alloc(1024);
    const result = validateFile(buffer, "image/png");
    expect(result.valid).toBe(true);
  });

  test("accepts PDF documents", () => {
    const buffer = Buffer.alloc(1024);
    const result = validateFile(buffer, "application/pdf");
    expect(result.valid).toBe(true);
  });

  test("accepts HEIC images", () => {
    const buffer = Buffer.alloc(1024);
    const result = validateFile(buffer, "image/heic");
    expect(result.valid).toBe(true);
  });

  test("accepts HEIF images", () => {
    const buffer = Buffer.alloc(1024);
    const result = validateFile(buffer, "image/heif");
    expect(result.valid).toBe(true);
  });

  test("rejects GIF images", () => {
    const buffer = Buffer.alloc(1024);
    const result = validateFile(buffer, "image/gif");
    expect(result.valid).toBe(false);
    expect(result.error).toContain("not allowed");
  });

  test("rejects BMP images", () => {
    const buffer = Buffer.alloc(1024);
    const result = validateFile(buffer, "image/bmp");
    expect(result.valid).toBe(false);
  });

  test("rejects WebP images", () => {
    const buffer = Buffer.alloc(1024);
    const result = validateFile(buffer, "image/webp");
    expect(result.valid).toBe(false);
  });

  test("rejects text files", () => {
    const buffer = Buffer.alloc(1024);
    const result = validateFile(buffer, "text/plain");
    expect(result.valid).toBe(false);
    expect(result.error).toContain("text/plain");
  });

  test("rejects HTML files", () => {
    const buffer = Buffer.alloc(1024);
    const result = validateFile(buffer, "text/html");
    expect(result.valid).toBe(false);
  });

  test("rejects executable files", () => {
    const buffer = Buffer.alloc(1024);
    const result = validateFile(buffer, "application/x-executable");
    expect(result.valid).toBe(false);
  });

  test("rejects ZIP archives", () => {
    const buffer = Buffer.alloc(1024);
    const result = validateFile(buffer, "application/zip");
    expect(result.valid).toBe(false);
  });

  test("rejects JSON files", () => {
    const buffer = Buffer.alloc(1024);
    const result = validateFile(buffer, "application/json");
    expect(result.valid).toBe(false);
  });

  test("lists allowed types in error message", () => {
    const buffer = Buffer.alloc(1024);
    const result = validateFile(buffer, "text/plain");
    expect(result.error).toContain("image/jpeg");
    expect(result.error).toContain("image/png");
    expect(result.error).toContain("application/pdf");
  });
});

// ============================================================================
// File Key Generation Tests
// ============================================================================

describe("Evidence Service - File Key Generation", () => {
  test("generates key with expense prefix for expense target", () => {
    const key = generateFileKey("expense", "image/jpeg");
    expect(key.startsWith("expense/")).toBe(true);
  });

  test("generates key with settlement prefix for settlement target", () => {
    const key = generateFileKey("settlement", "image/png");
    expect(key.startsWith("settlement/")).toBe(true);
  });

  test("includes year and month in key path", () => {
    const key = generateFileKey("expense", "image/jpeg");
    const parts = key.split("/");
    expect(parts.length).toBe(4); // target/year/month/filename
    expect(parts[1]).toMatch(/^\d{4}$/); // year
    expect(parts[2]).toMatch(/^\d{2}$/); // month
  });

  test("generates jpg extension for JPEG mime type", () => {
    const key = generateFileKey("expense", "image/jpeg");
    expect(key.endsWith(".jpg")).toBe(true);
  });

  test("generates png extension for PNG mime type", () => {
    const key = generateFileKey("expense", "image/png");
    expect(key.endsWith(".png")).toBe(true);
  });

  test("generates pdf extension for PDF mime type", () => {
    const key = generateFileKey("expense", "application/pdf");
    expect(key.endsWith(".pdf")).toBe(true);
  });

  test("generates heic extension for HEIC mime type", () => {
    const key = generateFileKey("expense", "image/heic");
    expect(key.endsWith(".heic")).toBe(true);
  });

  test("generates unique keys for same inputs", () => {
    const key1 = generateFileKey("expense", "image/jpeg");
    const key2 = generateFileKey("expense", "image/jpeg");
    expect(key1).not.toBe(key2);
  });

  test("generates keys with sufficient entropy", () => {
    const key = generateFileKey("expense", "image/jpeg");
    const filename = key.split("/").pop() || "";
    const nameWithoutExt = filename.replace(/\.\w+$/, "");
    // nanoid(21) generates 21 chars = 126 bits of entropy
    expect(nameWithoutExt.length).toBe(21);
  });

  test("generates bin extension for unknown mime type", () => {
    const key = generateFileKey("expense", "application/octet-stream");
    expect(key.endsWith(".bin")).toBe(true);
  });
});

// ============================================================================
// Attachment Limits Tests
// ============================================================================

describe("Evidence Service - Attachment Limits", () => {
  test("expense attachment limit is 5", () => {
    expect(MAX_EXPENSE_ATTACHMENTS).toBe(5);
  });

  test("settlement attachment limit is 3", () => {
    expect(MAX_SETTLEMENT_ATTACHMENTS).toBe(3);
  });

  test("expense limit is greater than settlement limit", () => {
    expect(MAX_EXPENSE_ATTACHMENTS).toBeGreaterThan(MAX_SETTLEMENT_ATTACHMENTS);
  });
});

// ============================================================================
// Allowed MIME Types Tests
// ============================================================================

describe("Evidence Service - Allowed MIME Types", () => {
  test("includes exactly 5 allowed mime types", () => {
    expect(ALLOWED_MIME_TYPES.length).toBe(5);
  });

  test("includes image/jpeg", () => {
    expect(ALLOWED_MIME_TYPES).toContain("image/jpeg");
  });

  test("includes image/png", () => {
    expect(ALLOWED_MIME_TYPES).toContain("image/png");
  });

  test("includes application/pdf", () => {
    expect(ALLOWED_MIME_TYPES).toContain("application/pdf");
  });

  test("includes image/heic", () => {
    expect(ALLOWED_MIME_TYPES).toContain("image/heic");
  });

  test("includes image/heif", () => {
    expect(ALLOWED_MIME_TYPES).toContain("image/heif");
  });

  test("does not include image/gif", () => {
    expect(ALLOWED_MIME_TYPES).not.toContain("image/gif");
  });

  test("does not include video types", () => {
    expect(ALLOWED_MIME_TYPES).not.toContain("video/mp4");
    expect(ALLOWED_MIME_TYPES).not.toContain("video/webm");
  });
});

// ============================================================================
// Max File Size Tests
// ============================================================================

describe("Evidence Service - Max File Size", () => {
  test("max file size is 10MB", () => {
    expect(MAX_FILE_SIZE).toBe(10 * 1024 * 1024);
  });

  test("max file size is exactly 10485760 bytes", () => {
    expect(MAX_FILE_SIZE).toBe(10485760);
  });
});

// ============================================================================
// Combined Validation Tests
// ============================================================================

describe("Evidence Service - Combined Validation", () => {
  test("rejects oversized file even with valid mime type", () => {
    const buffer = Buffer.alloc(MAX_FILE_SIZE + 1);
    const result = validateFile(buffer, "image/jpeg");
    expect(result.valid).toBe(false);
    expect(result.error).toContain("exceeds");
  });

  test("rejects small file with invalid mime type", () => {
    const buffer = Buffer.alloc(100);
    const result = validateFile(buffer, "text/plain");
    expect(result.valid).toBe(false);
    expect(result.error).toContain("not allowed");
  });

  test("accepts valid file with all checks passing", () => {
    const buffer = Buffer.alloc(5 * 1024 * 1024); // 5MB
    const result = validateFile(buffer, "application/pdf");
    expect(result.valid).toBe(true);
    expect(result.error).toBeUndefined();
  });
});
