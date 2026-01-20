/**
 * Currency Utilities
 * Sprint 005 - TASK-007
 *
 * Utility functions for currency conversion, formatting, and validation.
 */

import {
  SUPPORTED_CURRENCIES,
  CURRENCY_CODES,
  isSupportedCurrency,
  getCurrencyInfo,
  formatCurrency,
  type CurrencyInfo,
} from "../services/currency/currency.constants";

// Re-export from constants for convenience
export {
  SUPPORTED_CURRENCIES,
  CURRENCY_CODES,
  isSupportedCurrency,
  getCurrencyInfo,
  formatCurrency,
};
export type { CurrencyInfo };

/**
 * Round amount to the correct number of decimal places for a currency
 */
export function roundToCurrencyDecimals(
  amount: number,
  currencyCode: string
): number {
  const info = getCurrencyInfo(currencyCode);
  const decimals = info?.decimals ?? 2;
  const factor = Math.pow(10, decimals);
  return Math.round(amount * factor) / factor;
}

/**
 * Parse a currency amount string to number
 * Handles various formats like "$100.00", "100,00", "1,000.50"
 */
export function parseCurrencyAmount(input: string): number | null {
  if (!input || typeof input !== "string") {
    return null;
  }

  // Remove currency symbols and whitespace
  let cleaned = input.replace(/[$\u20AC\u00A3\u00A5CHF\sA-Za-z]/g, "").trim();

  // Handle European format (comma as decimal separator)
  // If there's a comma and no period, or comma comes after period, it's European
  if (cleaned.includes(",")) {
    const lastComma = cleaned.lastIndexOf(",");
    const lastPeriod = cleaned.lastIndexOf(".");

    if (lastPeriod === -1 || lastComma > lastPeriod) {
      // European format: replace comma with period, remove periods (thousands)
      cleaned = cleaned.replace(/\./g, "").replace(",", ".");
    } else {
      // US format: remove commas (thousands)
      cleaned = cleaned.replace(/,/g, "");
    }
  }

  const parsed = parseFloat(cleaned);
  return isNaN(parsed) ? null : parsed;
}

/**
 * Validate a currency code
 */
export function validateCurrencyCode(code: string): {
  valid: boolean;
  error?: string;
  normalized?: string;
} {
  if (!code || typeof code !== "string") {
    return { valid: false, error: "Currency code is required" };
  }

  const normalized = code.toUpperCase().trim();

  if (normalized.length !== 3) {
    return { valid: false, error: "Currency code must be 3 characters" };
  }

  if (!isSupportedCurrency(normalized)) {
    return {
      valid: false,
      error: `Currency '${normalized}' is not supported. Supported: ${CURRENCY_CODES.join(", ")}`,
    };
  }

  return { valid: true, normalized };
}

/**
 * Format amount with full currency name
 */
export function formatCurrencyLong(
  amount: number,
  currencyCode: string
): string {
  const info = getCurrencyInfo(currencyCode);
  if (!info) {
    return `${amount.toFixed(2)} ${currencyCode}`;
  }

  const rounded = roundToCurrencyDecimals(amount, currencyCode);
  return `${rounded.toFixed(info.decimals)} ${info.name}`;
}

/**
 * Format amount with ISO code
 */
export function formatCurrencyISO(
  amount: number,
  currencyCode: string
): string {
  const info = getCurrencyInfo(currencyCode);
  const decimals = info?.decimals ?? 2;
  const rounded = roundToCurrencyDecimals(amount, currencyCode);
  return `${rounded.toFixed(decimals)} ${currencyCode.toUpperCase()}`;
}

/**
 * Calculate percentage of amount
 */
export function calculatePercentage(
  amount: number,
  percentage: number,
  currencyCode: string
): number {
  const result = (amount * percentage) / 100;
  return roundToCurrencyDecimals(result, currencyCode);
}

/**
 * Split amount evenly among N parties
 * Handles rounding to ensure total matches original
 */
export function splitAmountEvenly(
  amount: number,
  parties: number,
  currencyCode: string
): number[] {
  if (parties <= 0) {
    return [];
  }

  const info = getCurrencyInfo(currencyCode);
  const decimals = info?.decimals ?? 2;
  const factor = Math.pow(10, decimals);

  // Work in smallest units (cents)
  const totalUnits = Math.round(amount * factor);
  const baseShare = Math.floor(totalUnits / parties);
  const remainder = totalUnits - baseShare * parties;

  const shares: number[] = [];
  for (let i = 0; i < parties; i++) {
    // Distribute remainder to first N parties
    const extra = i < remainder ? 1 : 0;
    shares.push((baseShare + extra) / factor);
  }

  return shares;
}

/**
 * Check if two amounts are equal within currency precision
 */
export function amountsEqual(
  a: number,
  b: number,
  currencyCode: string
): boolean {
  const roundedA = roundToCurrencyDecimals(a, currencyCode);
  const roundedB = roundToCurrencyDecimals(b, currencyCode);
  return roundedA === roundedB;
}

/**
 * Get the minimum amount for a currency (smallest unit)
 */
export function getMinimumAmount(currencyCode: string): number {
  const info = getCurrencyInfo(currencyCode);
  const decimals = info?.decimals ?? 2;
  return Math.pow(10, -decimals);
}

/**
 * Check if amount is valid (positive, not too small)
 */
export function isValidAmount(
  amount: number,
  currencyCode: string
): { valid: boolean; error?: string } {
  if (typeof amount !== "number" || isNaN(amount)) {
    return { valid: false, error: "Amount must be a number" };
  }

  if (amount < 0) {
    return { valid: false, error: "Amount cannot be negative" };
  }

  const min = getMinimumAmount(currencyCode);
  if (amount > 0 && amount < min) {
    return {
      valid: false,
      error: `Amount must be at least ${formatCurrency(min, currencyCode)}`,
    };
  }

  return { valid: true };
}
