/**
 * File Validation Utilities
 * Sprint 005 - TASK-002
 *
 * Magic number validation to verify file content matches declared MIME type.
 * This prevents malicious files from being uploaded with spoofed extensions.
 */

import { fileTypeFromBuffer } from "file-type";

// ============================================================================
// Magic Number Constants
// ============================================================================

/**
 * Known magic numbers for supported file types
 * Reference: https://en.wikipedia.org/wiki/List_of_file_signatures
 */
export const MAGIC_NUMBERS = {
  // PNG: 89 50 4E 47 0D 0A 1A 0A (first 8 bytes)
  PNG: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a],
  // JPEG: FF D8 FF (first 3 bytes)
  JPEG: [0xff, 0xd8, 0xff],
  // PDF: 25 50 44 46 (%PDF)
  PDF: [0x25, 0x50, 0x44, 0x46],
  // HEIC/HEIF: Contains "ftyp" followed by "heic" or "mif1"
  // More complex, handled by file-type library
} as const;

/**
 * Mapping of MIME types to their expected file-type library results
 */
export const MIME_TO_FILETYPE: Record<string, string[]> = {
  "image/jpeg": ["image/jpeg"],
  "image/png": ["image/png"],
  "image/heic": ["image/heic"],
  "image/heif": ["image/heif"],
  "application/pdf": ["application/pdf"],
};

/**
 * Text-based MIME types that don't have magic numbers
 * These are allowed to pass without magic number validation
 */
export const TEXT_MIME_TYPES = [
  "text/plain",
  "text/csv",
  "application/json",
  "text/xml",
  "application/xml",
] as const;

// ============================================================================
// Validation Functions
// ============================================================================

export interface MagicNumberValidationResult {
  valid: boolean;
  detectedType?: string;
  error?: string;
}

/**
 * Check if a buffer starts with a specific magic number sequence
 * AC-0.7, AC-0.8, AC-0.9: Validates specific magic numbers
 */
export function checkMagicNumber(
  buffer: Buffer,
  magicBytes: readonly number[]
): boolean {
  if (buffer.length < magicBytes.length) {
    return false;
  }

  for (let i = 0; i < magicBytes.length; i++) {
    if (buffer[i] !== magicBytes[i]) {
      return false;
    }
  }

  return true;
}

/**
 * Validate PNG file by magic number
 * AC-0.7: PNG files validated by magic number (89 50 4E 47)
 */
export function validatePngMagicNumber(buffer: Buffer): boolean {
  return checkMagicNumber(buffer, MAGIC_NUMBERS.PNG);
}

/**
 * Validate JPEG file by magic number
 * AC-0.8: JPEG files validated by magic number (FF D8 FF)
 */
export function validateJpegMagicNumber(buffer: Buffer): boolean {
  return checkMagicNumber(buffer, MAGIC_NUMBERS.JPEG);
}

/**
 * Validate PDF file by magic number
 * AC-0.9: PDF files validated by magic number (%PDF-)
 */
export function validatePdfMagicNumber(buffer: Buffer): boolean {
  return checkMagicNumber(buffer, MAGIC_NUMBERS.PDF);
}

/**
 * Check if a MIME type is text-based (no magic number)
 */
export function isTextMimeType(mimeType: string): boolean {
  return TEXT_MIME_TYPES.includes(mimeType as (typeof TEXT_MIME_TYPES)[number]);
}

/**
 * Validate file content matches declared MIME type using magic numbers
 * AC-0.6: Magic number validation verifies actual file content matches declared MIME type
 *
 * @param buffer - File content as Buffer
 * @param declaredMimeType - The MIME type declared by the client
 * @returns Validation result with detected type and error message if invalid
 */
export async function validateMagicNumber(
  buffer: Buffer,
  declaredMimeType: string
): Promise<MagicNumberValidationResult> {
  // Empty buffer is invalid
  if (buffer.length === 0) {
    return {
      valid: false,
      error: "File is empty",
    };
  }

  // Text-based files don't have magic numbers, allow them through
  if (isTextMimeType(declaredMimeType)) {
    return { valid: true };
  }

  // Use file-type library for comprehensive detection
  const detected = await fileTypeFromBuffer(buffer);

  // If file-type couldn't detect anything, check our manual magic numbers
  if (!detected) {
    // Manual validation for known types
    switch (declaredMimeType) {
      case "image/png":
        if (validatePngMagicNumber(buffer)) {
          return { valid: true, detectedType: "image/png" };
        }
        break;
      case "image/jpeg":
        if (validateJpegMagicNumber(buffer)) {
          return { valid: true, detectedType: "image/jpeg" };
        }
        break;
      case "application/pdf":
        if (validatePdfMagicNumber(buffer)) {
          return { valid: true, detectedType: "application/pdf" };
        }
        break;
    }

    return {
      valid: false,
      error: `Unable to verify file type. Expected ${declaredMimeType} but could not detect file signature.`,
    };
  }

  // Check if detected type matches declared type
  const expectedTypes = MIME_TO_FILETYPE[declaredMimeType];
  if (!expectedTypes) {
    // Unknown declared type - allow if detected type is valid
    return {
      valid: true,
      detectedType: detected.mime,
    };
  }

  if (expectedTypes.includes(detected.mime)) {
    return {
      valid: true,
      detectedType: detected.mime,
    };
  }

  // Mismatch detected
  return {
    valid: false,
    detectedType: detected.mime,
    error: `File content does not match declared type. Expected ${declaredMimeType} but detected ${detected.mime}.`,
  };
}

/**
 * Quick validation that only checks magic numbers without full file-type detection
 * Faster but less comprehensive - use for performance-critical paths
 */
export function quickValidateMagicNumber(
  buffer: Buffer,
  declaredMimeType: string
): MagicNumberValidationResult {
  // Empty buffer is invalid
  if (buffer.length === 0) {
    return {
      valid: false,
      error: "File is empty",
    };
  }

  // Text-based files don't have magic numbers
  if (isTextMimeType(declaredMimeType)) {
    return { valid: true };
  }

  switch (declaredMimeType) {
    case "image/png":
      if (validatePngMagicNumber(buffer)) {
        return { valid: true, detectedType: "image/png" };
      }
      return {
        valid: false,
        error: "File does not have valid PNG signature (expected 89 50 4E 47).",
      };

    case "image/jpeg":
      if (validateJpegMagicNumber(buffer)) {
        return { valid: true, detectedType: "image/jpeg" };
      }
      return {
        valid: false,
        error: "File does not have valid JPEG signature (expected FF D8 FF).",
      };

    case "application/pdf":
      if (validatePdfMagicNumber(buffer)) {
        return { valid: true, detectedType: "application/pdf" };
      }
      return {
        valid: false,
        error: "File does not have valid PDF signature (expected %PDF).",
      };

    case "image/heic":
    case "image/heif":
      // HEIC/HEIF has more complex magic number detection
      // Require full file-type validation for these
      return {
        valid: false,
        error: "HEIC/HEIF files require full validation. Use validateMagicNumber instead.",
      };

    default:
      // Unknown type - cannot validate
      return {
        valid: false,
        error: `Unknown MIME type for magic number validation: ${declaredMimeType}`,
      };
  }
}
