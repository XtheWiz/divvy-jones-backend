/**
 * Common utility functions
 */

/**
 * Omit sensitive fields from user object
 */
export function sanitizeUser<T extends { passwordHash?: string | null }>(
  user: T
): Omit<T, "passwordHash"> {
  const { passwordHash, ...sanitized } = user;
  return sanitized;
}

/**
 * Parse boolean from environment variable
 */
export function envBool(value: string | undefined, defaultValue = false): boolean {
  if (!value) return defaultValue;
  return value.toLowerCase() === "true" || value === "1";
}

/**
 * Parse number from environment variable
 */
export function envNumber(value: string | undefined, defaultValue: number): number {
  if (!value) return defaultValue;
  const parsed = parseInt(value, 10);
  return isNaN(parsed) ? defaultValue : parsed;
}

/**
 * Sleep for specified milliseconds
 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Check if value is a valid UUID
 */
export function isValidUUID(value: string): boolean {
  const uuidRegex =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(value);
}

/**
 * Normalize email (lowercase, trim)
 */
export function normalizeEmail(email: string): string {
  return email.toLowerCase().trim();
}
