/**
 * Currency Constants
 * Sprint 005 - TASK-006
 *
 * Defines supported currencies and their metadata.
 * AC-1.11: Support major currencies: USD, EUR, GBP, JPY, CAD, AUD, CHF, CNY
 */

export interface CurrencyInfo {
  code: string;
  name: string;
  symbol: string;
  decimals: number;
}

/**
 * Supported currencies with metadata
 * AC-1.11: Support major currencies
 */
export const SUPPORTED_CURRENCIES: Record<string, CurrencyInfo> = {
  USD: {
    code: "USD",
    name: "US Dollar",
    symbol: "$",
    decimals: 2,
  },
  EUR: {
    code: "EUR",
    name: "Euro",
    symbol: "\u20AC",
    decimals: 2,
  },
  GBP: {
    code: "GBP",
    name: "British Pound",
    symbol: "\u00A3",
    decimals: 2,
  },
  JPY: {
    code: "JPY",
    name: "Japanese Yen",
    symbol: "\u00A5",
    decimals: 0,
  },
  CAD: {
    code: "CAD",
    name: "Canadian Dollar",
    symbol: "C$",
    decimals: 2,
  },
  AUD: {
    code: "AUD",
    name: "Australian Dollar",
    symbol: "A$",
    decimals: 2,
  },
  CHF: {
    code: "CHF",
    name: "Swiss Franc",
    symbol: "CHF",
    decimals: 2,
  },
  CNY: {
    code: "CNY",
    name: "Chinese Yuan",
    symbol: "\u00A5",
    decimals: 2,
  },
} as const;

/**
 * Array of supported currency codes
 */
export const CURRENCY_CODES = Object.keys(SUPPORTED_CURRENCIES) as Array<
  keyof typeof SUPPORTED_CURRENCIES
>;

/**
 * Base currency for exchange rate calculations
 */
export const BASE_CURRENCY = "USD";

/**
 * Default cache TTL in milliseconds (1 hour)
 */
export const DEFAULT_CACHE_TTL = 60 * 60 * 1000; // 1 hour

/**
 * Check if a currency code is supported
 */
export function isSupportedCurrency(code: string): boolean {
  return code.toUpperCase() in SUPPORTED_CURRENCIES;
}

/**
 * Get currency info by code
 */
export function getCurrencyInfo(code: string): CurrencyInfo | null {
  const upperCode = code.toUpperCase();
  return SUPPORTED_CURRENCIES[upperCode] || null;
}

/**
 * Format amount with currency symbol
 */
export function formatCurrency(amount: number, currencyCode: string): string {
  const info = getCurrencyInfo(currencyCode);
  if (!info) {
    return `${amount.toFixed(2)} ${currencyCode}`;
  }

  const formatted = amount.toFixed(info.decimals);
  return `${info.symbol}${formatted}`;
}
