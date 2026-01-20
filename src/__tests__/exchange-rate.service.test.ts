/**
 * Exchange Rate Service Tests
 * Sprint 005 - TASK-006
 *
 * Tests for exchange rate fetching, caching, and conversion.
 */

import { describe, it, expect, beforeEach, mock, spyOn } from "bun:test";
import {
  createExchangeRateService,
  ExchangeRateService,
  type ExchangeRates,
} from "../services/currency/exchange-rate.service";
import {
  SUPPORTED_CURRENCIES,
  CURRENCY_CODES,
  BASE_CURRENCY,
  isSupportedCurrency,
  getCurrencyInfo,
  formatCurrency,
} from "../services/currency/currency.constants";

describe("Currency Constants", () => {
  describe("SUPPORTED_CURRENCIES", () => {
    it("should have all required currencies (AC-1.11)", () => {
      const requiredCurrencies = ["USD", "EUR", "GBP", "JPY", "CAD", "AUD", "CHF", "CNY"];

      for (const code of requiredCurrencies) {
        expect(SUPPORTED_CURRENCIES[code]).toBeDefined();
        expect(SUPPORTED_CURRENCIES[code].code).toBe(code);
        expect(SUPPORTED_CURRENCIES[code].name).toBeTruthy();
        expect(SUPPORTED_CURRENCIES[code].symbol).toBeTruthy();
      }
    });

    it("should have correct decimals for JPY", () => {
      expect(SUPPORTED_CURRENCIES.JPY.decimals).toBe(0);
    });

    it("should have 2 decimals for USD", () => {
      expect(SUPPORTED_CURRENCIES.USD.decimals).toBe(2);
    });
  });

  describe("isSupportedCurrency", () => {
    it("should return true for supported currencies", () => {
      expect(isSupportedCurrency("USD")).toBe(true);
      expect(isSupportedCurrency("EUR")).toBe(true);
      expect(isSupportedCurrency("usd")).toBe(true); // case insensitive
    });

    it("should return false for unsupported currencies", () => {
      expect(isSupportedCurrency("XYZ")).toBe(false);
      expect(isSupportedCurrency("BTC")).toBe(false);
    });
  });

  describe("getCurrencyInfo", () => {
    it("should return currency info for valid code", () => {
      const info = getCurrencyInfo("USD");
      expect(info).not.toBeNull();
      expect(info?.code).toBe("USD");
      expect(info?.name).toBe("US Dollar");
      expect(info?.symbol).toBe("$");
    });

    it("should return null for invalid code", () => {
      expect(getCurrencyInfo("XYZ")).toBeNull();
    });

    it("should be case insensitive", () => {
      const info = getCurrencyInfo("eur");
      expect(info?.code).toBe("EUR");
    });
  });

  describe("formatCurrency", () => {
    it("should format USD correctly", () => {
      expect(formatCurrency(100, "USD")).toBe("$100.00");
      expect(formatCurrency(99.99, "USD")).toBe("$99.99");
    });

    it("should format JPY without decimals", () => {
      expect(formatCurrency(1000, "JPY")).toBe("\u00A51000");
    });

    it("should handle unknown currency", () => {
      expect(formatCurrency(100, "XYZ")).toBe("100.00 XYZ");
    });
  });
});

describe("ExchangeRateService", () => {
  let service: ExchangeRateService;
  let mockFetch: ReturnType<typeof mock>;

  const mockApiResponse = {
    result: "success",
    base_code: "USD",
    conversion_rates: {
      USD: 1,
      EUR: 0.92,
      GBP: 0.79,
      JPY: 149.5,
      CAD: 1.36,
      AUD: 1.53,
      CHF: 0.88,
      CNY: 7.24,
    },
  };

  beforeEach(() => {
    service = createExchangeRateService({ cacheTtl: 3600000 });
    service.clearCache();

    // Mock fetch
    mockFetch = mock(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve(mockApiResponse),
      } as Response)
    );
    // Add preconnect to satisfy fetch type
    (mockFetch as unknown as { preconnect: () => void }).preconnect = () => {};
    globalThis.fetch = mockFetch as unknown as typeof fetch;
  });

  describe("getRates", () => {
    it("should fetch rates from API (AC-1.1)", async () => {
      const rates = await service.getRates();

      expect(mockFetch).toHaveBeenCalled();
      expect(rates.base).toBe(BASE_CURRENCY);
      expect(rates.rates.USD).toBe(1);
      expect(rates.rates.EUR).toBe(0.92);
    });

    it("should cache rates (AC-1.2)", async () => {
      // First call - fetches from API
      await service.getRates();
      expect(mockFetch).toHaveBeenCalledTimes(1);

      // Second call - should use cache
      await service.getRates();
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it("should use fallback rates when API fails (AC-1.3)", async () => {
      // Set up fallback rates
      const fallbackRates: ExchangeRates = {
        base: "USD",
        rates: { USD: 1, EUR: 0.9 },
        timestamp: new Date(),
        expiresAt: new Date(Date.now() + 3600000),
      };
      service.setFallbackRates(fallbackRates);

      // Make fetch fail
      mockFetch.mockImplementationOnce(() =>
        Promise.reject(new Error("Network error"))
      );

      const rates = await service.getRates();

      expect(rates.rates.EUR).toBe(0.9);
    });

    it("should use hardcoded fallback when no cache exists", async () => {
      // Make fetch fail
      mockFetch.mockImplementationOnce(() =>
        Promise.reject(new Error("Network error"))
      );

      const rates = await service.getRates();

      expect(rates.base).toBe("USD");
      expect(rates.rates.USD).toBe(1);
      expect(rates.rates.EUR).toBeDefined();
    });

    it("should only extract supported currencies", async () => {
      mockFetch.mockImplementationOnce(() =>
        Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              result: "success",
              conversion_rates: {
                USD: 1,
                EUR: 0.92,
                XYZ: 999, // Unsupported currency
              },
            }),
        } as Response)
      );

      const rates = await service.getRates();

      expect(rates.rates.USD).toBe(1);
      expect(rates.rates.EUR).toBe(0.92);
      expect(rates.rates.XYZ).toBeUndefined();
    });
  });

  describe("getRate", () => {
    it("should return rate between two currencies (AC-1.4)", async () => {
      const rate = await service.getRate("USD", "EUR");

      expect(rate).toBeCloseTo(0.92, 2);
    });

    it("should return 1 for same currency", async () => {
      const rate = await service.getRate("USD", "USD");

      expect(rate).toBe(1);
    });

    it("should convert through base currency", async () => {
      // EUR to GBP should go EUR -> USD -> GBP
      const rate = await service.getRate("EUR", "GBP");

      // EUR/USD = 0.92, so USD/EUR = 1/0.92 = 1.087
      // GBP/USD = 0.79
      // EUR to GBP = (1/0.92) * 0.79 = 0.858
      expect(rate).toBeCloseTo(0.858, 2);
    });

    it("should throw for unsupported currency", async () => {
      await expect(service.getRate("USD", "XYZ")).rejects.toThrow(
        "Unsupported currency: XYZ"
      );
    });

    it("should be case insensitive", async () => {
      const rate = await service.getRate("usd", "eur");

      expect(rate).toBeCloseTo(0.92, 2);
    });
  });

  describe("convert", () => {
    it("should convert amount between currencies (AC-1.4)", async () => {
      const result = await service.convert(100, "USD", "EUR");

      expect(result.originalAmount).toBe(100);
      expect(result.originalCurrency).toBe("USD");
      expect(result.convertedAmount).toBeCloseTo(92, 0);
      expect(result.targetCurrency).toBe("EUR");
      expect(result.rate).toBeCloseTo(0.92, 2);
      expect(result.rateTimestamp).toBeInstanceOf(Date);
    });

    it("should round to 2 decimal places", async () => {
      const result = await service.convert(100, "USD", "JPY");

      // 100 * 149.5 = 14950
      expect(result.convertedAmount).toBe(14950);
    });

    it("should convert EUR to GBP correctly", async () => {
      const result = await service.convert(100, "EUR", "GBP");

      // EUR/GBP rate is approximately 0.858-0.859
      expect(result.convertedAmount).toBeCloseTo(85.87, 1);
    });
  });

  describe("getCurrenciesWithRates", () => {
    it("should return all currencies with rates (AC-1.12)", async () => {
      const currencies = await service.getCurrenciesWithRates();

      expect(currencies.length).toBe(CURRENCY_CODES.length);

      const usd = currencies.find((c) => c.code === "USD");
      expect(usd).toBeDefined();
      expect(usd?.rate).toBe(1);
      expect(usd?.name).toBe("US Dollar");
      expect(usd?.rateTimestamp).toBeInstanceOf(Date);
    });
  });

  describe("cache management", () => {
    it("should report cached status correctly", async () => {
      expect(service.isCached()).toBe(false);

      await service.getRates();

      expect(service.isCached()).toBe(true);
    });

    it("should clear cache", async () => {
      await service.getRates();
      expect(service.isCached()).toBe(true);

      service.clearCache();
      expect(service.isCached()).toBe(false);
    });

    it("should return last updated timestamp", async () => {
      expect(service.getLastUpdated()).toBeNull();

      await service.getRates();

      expect(service.getLastUpdated()).toBeInstanceOf(Date);
    });
  });

  describe("API error handling", () => {
    it("should handle API returning error result", async () => {
      mockFetch.mockImplementationOnce(() =>
        Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              result: "error",
              "error-type": "invalid-key",
            }),
        } as Response)
      );

      // Should use hardcoded fallback
      const rates = await service.getRates();
      expect(rates.base).toBe("USD");
    });

    it("should handle non-OK response", async () => {
      mockFetch.mockImplementationOnce(() =>
        Promise.resolve({
          ok: false,
          status: 500,
          statusText: "Internal Server Error",
        } as Response)
      );

      // Should use hardcoded fallback
      const rates = await service.getRates();
      expect(rates.base).toBe("USD");
    });
  });

  describe("concurrent requests", () => {
    it("should deduplicate concurrent fetch requests", async () => {
      // Create a slow fetch that we can control
      let resolveCount = 0;
      mockFetch.mockImplementation(
        () =>
          new Promise((resolve) => {
            resolveCount++;
            setTimeout(
              () =>
                resolve({
                  ok: true,
                  json: () => Promise.resolve(mockApiResponse),
                } as Response),
              50
            );
          })
      );

      // Make multiple concurrent requests
      const promises = [
        service.getRates(),
        service.getRates(),
        service.getRates(),
      ];

      const results = await Promise.all(promises);

      // All should get the same result
      expect(results[0]).toBe(results[1]);
      expect(results[1]).toBe(results[2]);

      // But fetch should only be called once
      expect(resolveCount).toBe(1);
    });
  });
});

describe("ExchangeRateService configuration", () => {
  it("should use custom API URL", async () => {
    const mockFetch = mock(() =>
      Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve({
            result: "success",
            conversion_rates: { USD: 1 },
          }),
      } as Response)
    );
    (mockFetch as unknown as { preconnect: () => void }).preconnect = () => {};
    globalThis.fetch = mockFetch as unknown as typeof fetch;

    const service = createExchangeRateService({
      apiUrl: "https://custom-api.com",
      apiKey: "test-key",
    });

    await service.getRates();

    expect(mockFetch).toHaveBeenCalledWith(
      "https://custom-api.com/test-key/latest/USD",
      expect.any(Object)
    );
  });

  it("should work without API key", async () => {
    const mockFetch = mock(() =>
      Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve({
            result: "success",
            conversion_rates: { USD: 1 },
          }),
      } as Response)
    );
    (mockFetch as unknown as { preconnect: () => void }).preconnect = () => {};
    globalThis.fetch = mockFetch as unknown as typeof fetch;

    const service = createExchangeRateService({
      apiUrl: "https://custom-api.com",
    });

    await service.getRates();

    expect(mockFetch).toHaveBeenCalledWith(
      "https://custom-api.com/latest/USD",
      expect.any(Object)
    );
  });
});
