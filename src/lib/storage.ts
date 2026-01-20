/**
 * Storage Provider Interface
 * Sprint 004 - TASK-005, Sprint 005 - TASK-001
 *
 * Abstracted storage interface for file uploads.
 * Supports local filesystem (development) and S3-compatible storage (production).
 */

import { mkdir, writeFile, readFile, unlink, access } from "fs/promises";
import { join, dirname } from "path";
import { nanoid } from "nanoid";
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  HeadObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import {
  validateMagicNumber,
  type MagicNumberValidationResult,
} from "../utils/file-validation";

// ============================================================================
// Storage Provider Interface
// ============================================================================

export interface StorageProvider {
  /**
   * Upload a file to storage
   * @param buffer - File content as Buffer
   * @param key - Storage key (unique identifier)
   * @param mimeType - MIME type of the file
   * @returns The storage key
   */
  upload(buffer: Buffer, key: string, mimeType: string): Promise<string>;

  /**
   * Download a file from storage
   * @param key - Storage key
   * @returns File content as Buffer
   */
  download(key: string): Promise<Buffer>;

  /**
   * Delete a file from storage
   * @param key - Storage key
   */
  delete(key: string): Promise<void>;

  /**
   * Check if a file exists in storage
   * @param key - Storage key
   */
  exists(key: string): Promise<boolean>;

  /**
   * Get a URL for accessing the file
   * @param key - Storage key
   * @param expiresIn - Optional expiration time in seconds (for signed URLs)
   */
  getUrl(key: string, expiresIn?: number): Promise<string>;
}

// ============================================================================
// File Key Generation
// ============================================================================

/**
 * Generate a unique, non-guessable file key
 * Format: {target}/{year}/{month}/{nanoid}.{extension}
 */
export function generateFileKey(
  target: "expense" | "settlement",
  mimeType: string
): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const id = nanoid(21); // 21 chars = 126 bits of entropy
  const extension = getExtensionFromMimeType(mimeType);

  return `${target}/${year}/${month}/${id}.${extension}`;
}

/**
 * Get file extension from MIME type
 */
function getExtensionFromMimeType(mimeType: string): string {
  const mimeToExt: Record<string, string> = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/heic": "heic",
    "image/heif": "heif",
    "application/pdf": "pdf",
  };

  return mimeToExt[mimeType] || "bin";
}

// ============================================================================
// Local Storage Provider (Development)
// ============================================================================

export class LocalStorageProvider implements StorageProvider {
  private basePath: string;

  constructor(basePath: string = "./uploads") {
    this.basePath = basePath;
  }

  async upload(buffer: Buffer, key: string, _mimeType: string): Promise<string> {
    const filePath = this.getFilePath(key);
    const dir = dirname(filePath);

    // Ensure directory exists
    await mkdir(dir, { recursive: true });

    // Write file
    await writeFile(filePath, buffer);

    return key;
  }

  async download(key: string): Promise<Buffer> {
    const filePath = this.getFilePath(key);
    return readFile(filePath);
  }

  async delete(key: string): Promise<void> {
    const filePath = this.getFilePath(key);
    try {
      await unlink(filePath);
    } catch (err) {
      // Ignore error if file doesn't exist
      const error = err as NodeJS.ErrnoException;
      if (error.code !== "ENOENT") {
        throw err;
      }
    }
  }

  async exists(key: string): Promise<boolean> {
    const filePath = this.getFilePath(key);
    try {
      await access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  async getUrl(key: string, _expiresIn?: number): Promise<string> {
    // For local storage, return a relative path that the API can serve
    // In production, this would be a signed S3 URL
    return `/uploads/${key}`;
  }

  private getFilePath(key: string): string {
    return join(this.basePath, key);
  }
}

// ============================================================================
// S3 Storage Provider (Production)
// Sprint 005 - TASK-001
// ============================================================================

export interface S3StorageConfig {
  bucket: string;
  region: string;
  accessKeyId?: string;
  secretAccessKey?: string;
  urlExpiry?: number; // seconds, default 3600 (1 hour)
}

export class S3StorageProvider implements StorageProvider {
  private client: S3Client;
  private bucket: string;
  private urlExpiry: number;

  constructor(config: S3StorageConfig) {
    this.bucket = config.bucket;
    this.urlExpiry = config.urlExpiry || 3600;

    // Configure S3 client
    // Uses environment variables AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY
    // if not explicitly provided, or IAM role credentials in production
    const clientConfig: {
      region: string;
      credentials?: { accessKeyId: string; secretAccessKey: string };
    } = {
      region: config.region,
    };

    if (config.accessKeyId && config.secretAccessKey) {
      clientConfig.credentials = {
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey,
      };
    }

    this.client = new S3Client(clientConfig);
  }

  /**
   * Upload a file to S3
   * AC-0.1, AC-0.2: Implements StorageProvider interface with correct content type
   */
  async upload(buffer: Buffer, key: string, mimeType: string): Promise<string> {
    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: key,
      Body: buffer,
      ContentType: mimeType,
    });

    await this.client.send(command);
    return key;
  }

  /**
   * Download a file from S3
   */
  async download(key: string): Promise<Buffer> {
    const command = new GetObjectCommand({
      Bucket: this.bucket,
      Key: key,
    });

    const response = await this.client.send(command);

    if (!response.Body) {
      throw new Error(`File not found: ${key}`);
    }

    // Convert stream to buffer
    const chunks: Uint8Array[] = [];
    const stream = response.Body as AsyncIterable<Uint8Array>;
    for await (const chunk of stream) {
      chunks.push(chunk);
    }
    return Buffer.concat(chunks);
  }

  /**
   * Delete a file from S3
   * AC-0.4: S3 deletes files when evidence is deleted
   */
  async delete(key: string): Promise<void> {
    const command = new DeleteObjectCommand({
      Bucket: this.bucket,
      Key: key,
    });

    await this.client.send(command);
  }

  /**
   * Check if a file exists in S3
   */
  async exists(key: string): Promise<boolean> {
    try {
      const command = new HeadObjectCommand({
        Bucket: this.bucket,
        Key: key,
      });
      await this.client.send(command);
      return true;
    } catch (error) {
      const err = error as { name?: string };
      if (err.name === "NotFound") {
        return false;
      }
      throw error;
    }
  }

  /**
   * Generate a pre-signed URL for downloading from S3
   * AC-0.3: S3 generates pre-signed URLs for downloads (configurable expiry)
   */
  async getUrl(key: string, expiresIn?: number): Promise<string> {
    const command = new GetObjectCommand({
      Bucket: this.bucket,
      Key: key,
    });

    const expiry = expiresIn || this.urlExpiry;
    const url = await getSignedUrl(this.client, command, { expiresIn: expiry });
    return url;
  }
}

// ============================================================================
// File Validation
// ============================================================================

export const ALLOWED_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/heic",
  "image/heif",
  "application/pdf",
] as const;

export type AllowedMimeType = (typeof ALLOWED_MIME_TYPES)[number];

export const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

export interface FileValidationResult {
  valid: boolean;
  error?: string;
}

/**
 * Validate file for upload (synchronous basic checks only)
 * For full validation including magic numbers, use validateFileAsync
 */
export function validateFile(
  buffer: Buffer,
  mimeType: string
): FileValidationResult {
  // Check file size
  if (buffer.length > MAX_FILE_SIZE) {
    return {
      valid: false,
      error: `File size exceeds maximum of ${MAX_FILE_SIZE / (1024 * 1024)}MB`,
    };
  }

  // Check MIME type
  if (!ALLOWED_MIME_TYPES.includes(mimeType as AllowedMimeType)) {
    return {
      valid: false,
      error: `File type ${mimeType} is not allowed. Allowed types: ${ALLOWED_MIME_TYPES.join(", ")}`,
    };
  }

  return { valid: true };
}

/**
 * Validate file for upload with magic number verification
 * AC-0.6: Magic number validation verifies actual file content matches declared MIME type
 * AC-0.7: PNG files validated by magic number (89 50 4E 47)
 * AC-0.8: JPEG files validated by magic number (FF D8 FF)
 * AC-0.9: PDF files validated by magic number (%PDF-)
 */
export async function validateFileAsync(
  buffer: Buffer,
  mimeType: string
): Promise<FileValidationResult> {
  // Basic validation first
  const basicResult = validateFile(buffer, mimeType);
  if (!basicResult.valid) {
    return basicResult;
  }

  // Magic number validation
  const magicResult = await validateMagicNumber(buffer, mimeType);
  if (!magicResult.valid) {
    return {
      valid: false,
      error: magicResult.error || "File content does not match declared type",
    };
  }

  return { valid: true };
}

// ============================================================================
// Storage Instance
// ============================================================================

/**
 * Get the configured storage provider
 * AC-0.5: Storage provider is selected via STORAGE_PROVIDER env variable
 */
export function getStorageProvider(): StorageProvider {
  const provider = process.env.STORAGE_PROVIDER || "local";

  if (provider === "local") {
    const basePath = process.env.STORAGE_LOCAL_PATH || "./uploads";
    return new LocalStorageProvider(basePath);
  }

  if (provider === "s3") {
    const bucket = process.env.AWS_S3_BUCKET;
    const region = process.env.AWS_S3_REGION;

    if (!bucket) {
      throw new Error("AWS_S3_BUCKET environment variable is required for S3 storage");
    }
    if (!region) {
      throw new Error("AWS_S3_REGION environment variable is required for S3 storage");
    }

    return new S3StorageProvider({
      bucket,
      region,
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
      urlExpiry: process.env.AWS_S3_URL_EXPIRY
        ? parseInt(process.env.AWS_S3_URL_EXPIRY, 10)
        : 3600,
    });
  }

  throw new Error(`Unknown storage provider: ${provider}`);
}

// Default instance for convenience
let storageInstance: StorageProvider | null = null;

export function getStorage(): StorageProvider {
  if (!storageInstance) {
    storageInstance = getStorageProvider();
  }
  return storageInstance;
}

// ============================================================================
// Attachment Limits
// ============================================================================

export const MAX_EXPENSE_ATTACHMENTS = 5;
export const MAX_SETTLEMENT_ATTACHMENTS = 3;
