/**
 * Exchange Rate Service
 * Sprint 005 - TASK-006
 *
 * Fetches and caches exchange rates from external API.
 * AC-1.1: Exchange rate service fetches rates from external API (exchangerate-api.com)
 * AC-1.2: Exchange rates are cached for 1 hour to minimize API calls
 * AC-1.3: Fallback to last known rates if API is unavailable
 * AC-1.4: Service supports conversion between any two supported currencies
 */

import {
  SUPPORTED_CURRENCIES,
  CURRENCY_CODES,
  BASE_CURRENCY,
  DEFAULT_CACHE_TTL,
  isSupportedCurrency,
  type CurrencyInfo,
} from "./currency.constants";

// ============================================================================
// Types
// ============================================================================

export interface ExchangeRates {
  base: string;
  rates: Record<string, number>;
  timestamp: Date;
  expiresAt: Date;
  isFallback?: boolean;
}

interface ExchangeRateApiResponse {
  result: string;
  "error-type"?: string;
  conversion_rates?: Record<string, number>;
}

export interface ConvertedAmount {
  originalAmount: number;
  originalCurrency: string;
  convertedAmount: number;
  targetCurrency: string;
  rate: number;
  rateTimestamp: Date;
}

export interface ExchangeRateServiceConfig {
  apiKey?: string;
  apiUrl?: string;
  cacheTtl?: number; // milliseconds
}

// ============================================================================
// Exchange Rate Service
// ============================================================================

class ExchangeRateService {
  private cache: ExchangeRates | null = null;
  private fallbackRates: ExchangeRates | null = null;
  private fetchPromise: Promise<ExchangeRates> | null = null;
  private config: Required<ExchangeRateServiceConfig>;

  constructor(config: ExchangeRateServiceConfig = {}) {
    this.config = {
      apiKey: config.apiKey || process.env.EXCHANGE_RATE_API_KEY || "",
      apiUrl:
        config.apiUrl ||
        process.env.EXCHANGE_RATE_API_URL ||
        "https://v6.exchangerate-api.com/v6",
      cacheTtl:
        config.cacheTtl ||
        parseInt(process.env.EXCHANGE_RATE_CACHE_TTL || "") ||
        DEFAULT_CACHE_TTL,
    };
  }

  /**
   * Get current exchange rates
   * AC-1.1: Fetches rates from external API
   * AC-1.2: Uses cached rates if not expired
   * AC-1.3: Falls back to last known rates on error
   */
  async getRates(): Promise<ExchangeRates> {
    // Check if cache is still valid
    if (this.cache && new Date() < this.cache.expiresAt) {
      return this.cache;
    }

    // If a fetch is already in progress, wait for it
    if (this.fetchPromise) {
      return this.fetchPromise;
    }

    // Fetch new rates
    this.fetchPromise = this.fetchRates();

    try {
      const rates = await this.fetchPromise;
      this.cache = rates;
      this.fallbackRates = rates; // Update fallback on success
      return rates;
    } catch (error) {
      // AC-1.3: Fallback to last known rates
      if (this.fallbackRates) {
        console.warn(
          "Exchange rate API unavailable, using fallback rates from",
          this.fallbackRates.timestamp
        );
        return this.fallbackRates;
      }

      // No fallback available, return hardcoded rates as last resort
      console.warn("No cached rates available, using hardcoded fallback rates");
      return this.getHardcodedFallbackRates();
    } finally {
      this.fetchPromise = null;
    }
  }

  /**
   * Fetch rates from external API
   * AC-1.1: Exchange rate service fetches rates from external API
   */
  private async fetchRates(): Promise<ExchangeRates> {
    const url = this.config.apiKey
      ? `${this.config.apiUrl}/${this.config.apiKey}/latest/${BASE_CURRENCY}`
      : `${this.config.apiUrl}/latest/${BASE_CURRENCY}`;

    const response = await fetch(url, {
      headers: {
        Accept: "application/json",
      },
    });

    if (!response.ok) {
      throw new Error(
        `Exchange rate API error: ${response.status} ${response.statusText}`
      );
    }

    const data = (await response.json()) as ExchangeRateApiResponse;

    if (data.result !== "success") {
      throw new Error(`Exchange rate API error: ${data["error-type"] || "Unknown error"}`);
    }

    const now = new Date();
    const rates: ExchangeRates = {
      base: BASE_CURRENCY,
      rates: {},
      timestamp: now,
      expiresAt: new Date(now.getTime() + this.config.cacheTtl),
    };

    // Extract only supported currencies
    for (const code of CURRENCY_CODES) {
      if (data.conversion_rates && data.conversion_rates[code] !== undefined) {
        rates.rates[code] = data.conversion_rates[code];
      }
    }

    // Ensure base currency is always 1
    rates.rates[BASE_CURRENCY] = 1;

    return rates;
  }

  /**
   * Hardcoded fallback rates (approximate values)
   * Used only when API is unavailable and no cached rates exist
   */
  private getHardcodedFallbackRates(): ExchangeRates {
    const now = new Date();
    return {
      base: BASE_CURRENCY,
      rates: {
        USD: 1,
        EUR: 0.92,
        GBP: 0.79,
        JPY: 149.5,
        CAD: 1.36,
        AUD: 1.53,
        CHF: 0.88,
        CNY: 7.24,
      },
      timestamp: now,
      expiresAt: new Date(now.getTime() + this.config.cacheTtl),
    };
  }

  /**
   * Get exchange rate between two currencies
   * AC-1.4: Service supports conversion between any two supported currencies
   */
  async getRate(from: string, to: string): Promise<number> {
    const fromUpper = from.toUpperCase();
    const toUpper = to.toUpperCase();

    if (!isSupportedCurrency(fromUpper)) {
      throw new Error(`Unsupported currency: ${from}`);
    }
    if (!isSupportedCurrency(toUpper)) {
      throw new Error(`Unsupported currency: ${to}`);
    }

    if (fromUpper === toUpper) {
      return 1;
    }

    const rates = await this.getRates();

    // Convert through base currency (USD)
    // from -> USD -> to
    const fromToUsd = 1 / rates.rates[fromUpper];
    const usdToTo = rates.rates[toUpper];
    const rate = fromToUsd * usdToTo;

    return rate;
  }

  /**
   * Convert amount from one currency to another
   * AC-1.4: Service supports conversion between any two supported currencies
   */
  async convert(
    amount: number,
    from: string,
    to: string
  ): Promise<ConvertedAmount> {
    const rate = await this.getRate(from, to);
    const rates = await this.getRates();

    const convertedAmount = amount * rate;

    return {
      originalAmount: amount,
      originalCurrency: from.toUpperCase(),
      convertedAmount: Math.round(convertedAmount * 100) / 100, // Round to 2 decimals
      targetCurrency: to.toUpperCase(),
      rate,
      rateTimestamp: rates.timestamp,
    };
  }

  /**
   * Get all supported currencies with current rates
   * AC-1.12: Currency list endpoint with current rates
   */
  async getCurrenciesWithRates(): Promise<
    Array<CurrencyInfo & { rate: number; rateTimestamp: Date }>
  > {
    const rates = await this.getRates();

    return CURRENCY_CODES.map((code) => ({
      ...SUPPORTED_CURRENCIES[code],
      rate: rates.rates[code] || 1,
      rateTimestamp: rates.timestamp,
    }));
  }

  /**
   * Get the timestamp of the last rate update
   */
  getLastUpdated(): Date | null {
    return this.cache?.timestamp || this.fallbackRates?.timestamp || null;
  }

  /**
   * Check if rates are currently cached
   */
  isCached(): boolean {
    return this.cache !== null && new Date() < this.cache.expiresAt;
  }

  /**
   * Clear the cache (useful for testing)
   */
  clearCache(): void {
    this.cache = null;
  }

  /**
   * Set fallback rates manually (useful for testing)
   */
  setFallbackRates(rates: ExchangeRates): void {
    this.fallbackRates = rates;
  }
}

// ============================================================================
// Singleton Instance
// ============================================================================

let exchangeRateServiceInstance: ExchangeRateService | null = null;

/**
 * Get the exchange rate service singleton
 */
export function getExchangeRateService(
  config?: ExchangeRateServiceConfig
): ExchangeRateService {
  if (!exchangeRateServiceInstance) {
    exchangeRateServiceInstance = new ExchangeRateService(config);
  }
  return exchangeRateServiceInstance;
}

/**
 * Create a new exchange rate service instance (for testing)
 */
export function createExchangeRateService(
  config?: ExchangeRateServiceConfig
): ExchangeRateService {
  return new ExchangeRateService(config);
}

/**
 * Reset the singleton (for testing)
 */
export function resetExchangeRateService(): void {
  exchangeRateServiceInstance = null;
}

export { ExchangeRateService };
