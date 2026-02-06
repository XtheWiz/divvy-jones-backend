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

// ============================================================================
// Money Math Utilities
// ============================================================================
// All financial calculations must avoid floating-point arithmetic.
// These helpers convert to integer cents, perform the math, then convert back.

/**
 * Convert a dollar amount (number or string) to integer cents.
 * Rounds to nearest cent to avoid floating-point drift.
 */
export function toCents(amount: number | string): number {
  const num = typeof amount === "string" ? parseFloat(amount) : amount;
  return Math.round(num * 100);
}

/**
 * Convert integer cents back to a dollar amount (2 decimal places).
 */
export function fromCents(cents: number): number {
  return cents / 100;
}

/**
 * Divide a total (in cents) equally among `count` participants.
 * Returns an array of cent amounts that sum exactly to `totalCents`.
 * The remainder is distributed one cent at a time to the first participants.
 */
export function splitEqual(totalCents: number, count: number): number[] {
  const base = Math.floor(totalCents / count);
  const remainder = totalCents - base * count;
  return Array.from({ length: count }, (_, i) => base + (i < remainder ? 1 : 0));
}

/**
 * Distribute a total (in cents) by weights.
 * Returns an array of cent amounts that sum exactly to `totalCents`.
 */
export function splitByWeights(totalCents: number, weights: number[]): number[] {
  const totalWeight = weights.reduce((s, w) => s + w, 0);
  if (totalWeight === 0) return weights.map(() => 0);

  const amounts = weights.map((w) => Math.floor((totalCents * w) / totalWeight));
  let distributed = amounts.reduce((s, a) => s + a, 0);
  let remainder = totalCents - distributed;

  // Distribute remainder by largest fractional part
  const fractions = weights.map((w, i) => ({
    i,
    frac: ((totalCents * w) / totalWeight) - amounts[i],
  }));
  fractions.sort((a, b) => b.frac - a.frac);
  for (const { i } of fractions) {
    if (remainder <= 0) break;
    amounts[i]++;
    remainder--;
  }

  return amounts;
}
