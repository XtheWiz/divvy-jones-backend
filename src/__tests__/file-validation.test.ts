/**
 * File Validation Tests
 * Sprint 005 - TASK-002
 *
 * Tests for magic number validation utilities.
 */

import { describe, it, expect } from "bun:test";
import {
  validateMagicNumber,
  validatePngMagicNumber,
  validateJpegMagicNumber,
  validatePdfMagicNumber,
  quickValidateMagicNumber,
  checkMagicNumber,
  isTextMimeType,
  MAGIC_NUMBERS,
} from "../utils/file-validation";

describe("Magic Number Constants", () => {
  it("should have correct PNG magic number", () => {
    expect(MAGIC_NUMBERS.PNG).toEqual([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  });

  it("should have correct JPEG magic number", () => {
    expect(MAGIC_NUMBERS.JPEG).toEqual([0xff, 0xd8, 0xff]);
  });

  it("should have correct PDF magic number", () => {
    expect(MAGIC_NUMBERS.PDF).toEqual([0x25, 0x50, 0x44, 0x46]);
  });
});

describe("checkMagicNumber", () => {
  it("should return true when buffer starts with magic bytes", () => {
    const buffer = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00]);
    expect(checkMagicNumber(buffer, MAGIC_NUMBERS.PNG)).toBe(true);
  });

  it("should return false when buffer does not start with magic bytes", () => {
    const buffer = Buffer.from([0x00, 0x50, 0x4e, 0x47]);
    expect(checkMagicNumber(buffer, MAGIC_NUMBERS.PNG)).toBe(false);
  });

  it("should return false when buffer is too short", () => {
    const buffer = Buffer.from([0x89, 0x50]);
    expect(checkMagicNumber(buffer, MAGIC_NUMBERS.PNG)).toBe(false);
  });
});

describe("validatePngMagicNumber", () => {
  it("should return true for valid PNG header (AC-0.7)", () => {
    // Real PNG header: 89 50 4E 47 0D 0A 1A 0A
    const pngBuffer = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00]);
    expect(validatePngMagicNumber(pngBuffer)).toBe(true);
  });

  it("should return false for non-PNG file", () => {
    const jpegBuffer = Buffer.from([0xff, 0xd8, 0xff, 0xe0]);
    expect(validatePngMagicNumber(jpegBuffer)).toBe(false);
  });

  it("should return false for empty buffer", () => {
    const emptyBuffer = Buffer.from([]);
    expect(validatePngMagicNumber(emptyBuffer)).toBe(false);
  });
});

describe("validateJpegMagicNumber", () => {
  it("should return true for valid JPEG header (AC-0.8)", () => {
    // Real JPEG header: FF D8 FF
    const jpegBuffer = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]);
    expect(validateJpegMagicNumber(jpegBuffer)).toBe(true);
  });

  it("should return true for JPEG with different APP marker", () => {
    // JPEG with APP1 marker (EXIF): FF D8 FF E1
    const jpegBuffer = Buffer.from([0xff, 0xd8, 0xff, 0xe1, 0x00, 0x10]);
    expect(validateJpegMagicNumber(jpegBuffer)).toBe(true);
  });

  it("should return false for non-JPEG file", () => {
    const pngBuffer = Buffer.from([0x89, 0x50, 0x4e, 0x47]);
    expect(validateJpegMagicNumber(pngBuffer)).toBe(false);
  });
});

describe("validatePdfMagicNumber", () => {
  it("should return true for valid PDF header (AC-0.9)", () => {
    // Real PDF header: %PDF-1.7
    const pdfBuffer = Buffer.from("%PDF-1.7\n");
    expect(validatePdfMagicNumber(pdfBuffer)).toBe(true);
  });

  it("should return true for older PDF version", () => {
    const pdfBuffer = Buffer.from("%PDF-1.4\n");
    expect(validatePdfMagicNumber(pdfBuffer)).toBe(true);
  });

  it("should return false for non-PDF file", () => {
    const textBuffer = Buffer.from("Hello World");
    expect(validatePdfMagicNumber(textBuffer)).toBe(false);
  });
});

describe("isTextMimeType", () => {
  it("should return true for text/plain", () => {
    expect(isTextMimeType("text/plain")).toBe(true);
  });

  it("should return true for text/csv", () => {
    expect(isTextMimeType("text/csv")).toBe(true);
  });

  it("should return true for application/json", () => {
    expect(isTextMimeType("application/json")).toBe(true);
  });

  it("should return false for image/png", () => {
    expect(isTextMimeType("image/png")).toBe(false);
  });

  it("should return false for application/pdf", () => {
    expect(isTextMimeType("application/pdf")).toBe(false);
  });
});

describe("quickValidateMagicNumber", () => {
  it("should validate PNG files (AC-0.7)", () => {
    const pngBuffer = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    const result = quickValidateMagicNumber(pngBuffer, "image/png");
    expect(result.valid).toBe(true);
    expect(result.detectedType).toBe("image/png");
  });

  it("should reject invalid PNG file", () => {
    const fakeBuffer = Buffer.from("not a png file");
    const result = quickValidateMagicNumber(fakeBuffer, "image/png");
    expect(result.valid).toBe(false);
    expect(result.error).toContain("PNG signature");
  });

  it("should validate JPEG files (AC-0.8)", () => {
    const jpegBuffer = Buffer.from([0xff, 0xd8, 0xff, 0xe0]);
    const result = quickValidateMagicNumber(jpegBuffer, "image/jpeg");
    expect(result.valid).toBe(true);
    expect(result.detectedType).toBe("image/jpeg");
  });

  it("should reject invalid JPEG file", () => {
    const fakeBuffer = Buffer.from("not a jpeg file");
    const result = quickValidateMagicNumber(fakeBuffer, "image/jpeg");
    expect(result.valid).toBe(false);
    expect(result.error).toContain("JPEG signature");
  });

  it("should validate PDF files (AC-0.9)", () => {
    const pdfBuffer = Buffer.from("%PDF-1.7\n");
    const result = quickValidateMagicNumber(pdfBuffer, "application/pdf");
    expect(result.valid).toBe(true);
    expect(result.detectedType).toBe("application/pdf");
  });

  it("should reject invalid PDF file", () => {
    const fakeBuffer = Buffer.from("not a pdf file");
    const result = quickValidateMagicNumber(fakeBuffer, "application/pdf");
    expect(result.valid).toBe(false);
    expect(result.error).toContain("PDF signature");
  });

  it("should reject empty buffer", () => {
    const emptyBuffer = Buffer.from([]);
    const result = quickValidateMagicNumber(emptyBuffer, "image/png");
    expect(result.valid).toBe(false);
    expect(result.error).toBe("File is empty");
  });

  it("should pass text-based MIME types without validation", () => {
    const textBuffer = Buffer.from("hello world");
    const result = quickValidateMagicNumber(textBuffer, "text/plain");
    expect(result.valid).toBe(true);
  });

  it("should require full validation for HEIC files", () => {
    const heicBuffer = Buffer.from([0x00, 0x00, 0x00, 0x18]);
    const result = quickValidateMagicNumber(heicBuffer, "image/heic");
    expect(result.valid).toBe(false);
    expect(result.error).toContain("HEIC/HEIF files require full validation");
  });

  it("should reject unknown MIME types", () => {
    const buffer = Buffer.from("some data");
    const result = quickValidateMagicNumber(buffer, "application/unknown");
    expect(result.valid).toBe(false);
    expect(result.error).toContain("Unknown MIME type");
  });
});

describe("validateMagicNumber (async with file-type)", () => {
  it("should validate PNG files with full file-type detection (AC-0.6, AC-0.7)", async () => {
    // Minimal valid PNG (8 byte header + IHDR chunk)
    const pngBuffer = Buffer.from([
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, // PNG signature
      0x00, 0x00, 0x00, 0x0d, // IHDR chunk length
      0x49, 0x48, 0x44, 0x52, // "IHDR"
      0x00, 0x00, 0x00, 0x01, // width
      0x00, 0x00, 0x00, 0x01, // height
      0x08, 0x02, 0x00, 0x00, 0x00, // bit depth, color type, etc.
      0x90, 0x77, 0x53, 0xde, // CRC
    ]);
    const result = await validateMagicNumber(pngBuffer, "image/png");
    expect(result.valid).toBe(true);
  });

  it("should validate JPEG files with full file-type detection (AC-0.6, AC-0.8)", async () => {
    // Minimal valid JPEG
    const jpegBuffer = Buffer.from([
      0xff, 0xd8, 0xff, 0xe0, // SOI + APP0 marker
      0x00, 0x10, // APP0 length
      0x4a, 0x46, 0x49, 0x46, 0x00, // "JFIF\0"
      0x01, 0x01, 0x00, 0x00, 0x01, 0x00, 0x01, 0x00, 0x00, // JFIF data
    ]);
    const result = await validateMagicNumber(jpegBuffer, "image/jpeg");
    expect(result.valid).toBe(true);
  });

  it("should validate PDF files with full file-type detection (AC-0.6, AC-0.9)", async () => {
    const pdfBuffer = Buffer.from("%PDF-1.7\n%\xE2\xE3\xCF\xD3\n");
    const result = await validateMagicNumber(pdfBuffer, "application/pdf");
    expect(result.valid).toBe(true);
  });

  it("should reject mismatched file content (AC-0.6)", async () => {
    // JPEG content declared as PNG
    const jpegBuffer = Buffer.from([
      0xff, 0xd8, 0xff, 0xe0,
      0x00, 0x10,
      0x4a, 0x46, 0x49, 0x46, 0x00,
      0x01, 0x01, 0x00, 0x00, 0x01, 0x00, 0x01, 0x00, 0x00,
    ]);
    const result = await validateMagicNumber(jpegBuffer, "image/png");
    expect(result.valid).toBe(false);
    expect(result.error).toContain("does not match declared type");
    expect(result.detectedType).toBe("image/jpeg");
  });

  it("should reject empty files", async () => {
    const emptyBuffer = Buffer.from([]);
    const result = await validateMagicNumber(emptyBuffer, "image/png");
    expect(result.valid).toBe(false);
    expect(result.error).toBe("File is empty");
  });

  it("should pass text-based MIME types", async () => {
    const textBuffer = Buffer.from("This is plain text content");
    const result = await validateMagicNumber(textBuffer, "text/plain");
    expect(result.valid).toBe(true);
  });

  it("should pass CSV files", async () => {
    const csvBuffer = Buffer.from("name,email,amount\nJohn,john@example.com,100");
    const result = await validateMagicNumber(csvBuffer, "text/csv");
    expect(result.valid).toBe(true);
  });

  it("should pass JSON files", async () => {
    const jsonBuffer = Buffer.from('{"name": "test", "value": 123}');
    const result = await validateMagicNumber(jsonBuffer, "application/json");
    expect(result.valid).toBe(true);
  });
});

describe("validateFileAsync integration", () => {
  it("should validate files with both basic and magic number checks", async () => {
    const { validateFileAsync } = await import("../lib/storage");

    // Valid PNG
    const pngBuffer = Buffer.from([
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
      0x00, 0x00, 0x00, 0x0d,
      0x49, 0x48, 0x44, 0x52,
      0x00, 0x00, 0x00, 0x01,
      0x00, 0x00, 0x00, 0x01,
      0x08, 0x02, 0x00, 0x00, 0x00,
      0x90, 0x77, 0x53, 0xde,
    ]);

    const result = await validateFileAsync(pngBuffer, "image/png");
    expect(result.valid).toBe(true);
  });

  it("should reject files exceeding size limit", async () => {
    const { validateFileAsync, MAX_FILE_SIZE } = await import("../lib/storage");

    // Create buffer larger than max
    const largeBuffer = Buffer.alloc(MAX_FILE_SIZE + 1, 0);

    const result = await validateFileAsync(largeBuffer, "image/png");
    expect(result.valid).toBe(false);
    expect(result.error).toContain("exceeds maximum");
  });

  it("should reject disallowed MIME types", async () => {
    const { validateFileAsync } = await import("../lib/storage");

    const buffer = Buffer.from("some content");

    const result = await validateFileAsync(buffer, "application/javascript");
    expect(result.valid).toBe(false);
    expect(result.error).toContain("not allowed");
  });
});
