/**
 * Currency Routes Tests
 * Sprint 005 - TASK-010
 *
 * Tests for GET /currencies endpoint.
 */

import { describe, it, expect, mock, beforeEach, afterEach } from "bun:test";

// Type for API responses
interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: { code: string; message: string };
}

interface CurrencyInfo {
  code: string;
  name: string;
  symbol: string;
  decimals: number;
  rate: number;
}

interface CurrenciesData {
  currencies: CurrencyInfo[];
  baseCurrency: string;
  lastUpdated: string;
  isFallback?: boolean;
}

interface CurrencyDetailData extends CurrencyInfo {
  baseCurrency: string;
}

// Mock exchange rate service before importing routes
const mockGetRates = mock(() =>
  Promise.resolve({
    baseCurrency: "USD",
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
    timestamp: new Date("2025-01-20T12:00:00Z"),
    expiresAt: new Date("2025-01-20T13:00:00Z"),
    isFallback: false,
  })
);

mock.module("../services/currency", () => ({
  SUPPORTED_CURRENCIES: {
    USD: { code: "USD", name: "US Dollar", symbol: "$", decimals: 2 },
    EUR: { code: "EUR", name: "Euro", symbol: "\u20AC", decimals: 2 },
    GBP: { code: "GBP", name: "British Pound", symbol: "\u00A3", decimals: 2 },
    JPY: { code: "JPY", name: "Japanese Yen", symbol: "\u00A5", decimals: 0 },
    CAD: { code: "CAD", name: "Canadian Dollar", symbol: "CA$", decimals: 2 },
    AUD: { code: "AUD", name: "Australian Dollar", symbol: "A$", decimals: 2 },
    CHF: { code: "CHF", name: "Swiss Franc", symbol: "CHF", decimals: 2 },
    CNY: { code: "CNY", name: "Chinese Yuan", symbol: "\u00A5", decimals: 2 },
  },
  CURRENCY_CODES: ["USD", "EUR", "GBP", "JPY", "CAD", "AUD", "CHF", "CNY"],
  isSupportedCurrency: (code: string) =>
    ["USD", "EUR", "GBP", "JPY", "CAD", "AUD", "CHF", "CNY"].includes(code),
  getExchangeRateService: () => ({
    getRates: mockGetRates,
  }),
}));

import { Elysia } from "elysia";
import { currencyRoutes } from "../routes/currencies";

const createTestApp = () => {
  return new Elysia().use(currencyRoutes);
};

describe("Currency Routes", () => {
  beforeEach(() => {
    mockGetRates.mockClear();
  });

  describe("GET /currencies", () => {
    it("should return list of supported currencies with rates", async () => {
      const app = createTestApp();
      const response = await app.handle(
        new Request("http://localhost/currencies")
      );

      expect(response.status).toBe(200);
      const body = (await response.json()) as ApiResponse<CurrenciesData>;

      expect(body.success).toBe(true);
      expect(body.data!.currencies).toBeArray();
      expect(body.data!.currencies.length).toBe(8);
      expect(body.data!.baseCurrency).toBe("USD");
      expect(body.data!.lastUpdated).toBe("2025-01-20T12:00:00.000Z");
    });

    it("should include all currency fields", async () => {
      const app = createTestApp();
      const response = await app.handle(
        new Request("http://localhost/currencies")
      );

      const body = (await response.json()) as ApiResponse<CurrenciesData>;
      const usd = body.data!.currencies.find(
        (c) => c.code === "USD"
      );

      expect(usd).toBeDefined();
      expect(usd!.code).toBe("USD");
      expect(usd!.name).toBe("US Dollar");
      expect(usd!.symbol).toBe("$");
      expect(usd!.decimals).toBe(2);
      expect(usd!.rate).toBe(1);
    });

    it("should include correct rates for all currencies", async () => {
      const app = createTestApp();
      const response = await app.handle(
        new Request("http://localhost/currencies")
      );

      const body = (await response.json()) as ApiResponse<CurrenciesData>;
      const currencies = body.data!.currencies;

      const eur = currencies.find((c) => c.code === "EUR");
      expect(eur!.rate).toBe(0.92);

      const gbp = currencies.find((c) => c.code === "GBP");
      expect(gbp!.rate).toBe(0.79);

      const jpy = currencies.find((c) => c.code === "JPY");
      expect(jpy!.rate).toBe(149.5);
    });

    it("should indicate when using fallback rates", async () => {
      mockGetRates.mockResolvedValueOnce({
        baseCurrency: "USD",
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
        timestamp: new Date("2025-01-20T12:00:00Z"),
        expiresAt: new Date("2025-01-20T13:00:00Z"),
        isFallback: true,
      });

      const app = createTestApp();
      const response = await app.handle(
        new Request("http://localhost/currencies")
      );

      const body = (await response.json()) as ApiResponse<CurrenciesData>;
      expect(body.data!.isFallback).toBe(true);
    });
  });

  describe("GET /currencies/:code", () => {
    it("should return details for a valid currency", async () => {
      const app = createTestApp();
      const response = await app.handle(
        new Request("http://localhost/currencies/EUR")
      );

      expect(response.status).toBe(200);
      const body = (await response.json()) as ApiResponse<CurrencyDetailData>;

      expect(body.success).toBe(true);
      expect(body.data!.code).toBe("EUR");
      expect(body.data!.name).toBe("Euro");
      expect(body.data!.symbol).toBe("\u20AC");
      expect(body.data!.decimals).toBe(2);
      expect(body.data!.rate).toBe(0.92);
      expect(body.data!.baseCurrency).toBe("USD");
    });

    it("should normalize currency code to uppercase", async () => {
      const app = createTestApp();
      const response = await app.handle(
        new Request("http://localhost/currencies/eur")
      );

      expect(response.status).toBe(200);
      const body = (await response.json()) as ApiResponse<CurrencyDetailData>;
      expect(body.data!.code).toBe("EUR");
    });

    it("should return 404 for unsupported currency", async () => {
      const app = createTestApp();
      const response = await app.handle(
        new Request("http://localhost/currencies/XYZ")
      );

      expect(response.status).toBe(404);
      const body = (await response.json()) as ApiResponse;

      expect(body.success).toBe(false);
      expect(body.error!.message).toContain("not supported");
    });

    it("should handle JPY with 0 decimals", async () => {
      const app = createTestApp();
      const response = await app.handle(
        new Request("http://localhost/currencies/JPY")
      );

      expect(response.status).toBe(200);
      const body = (await response.json()) as ApiResponse<CurrencyDetailData>;

      expect(body.data!.decimals).toBe(0);
      expect(body.data!.rate).toBe(149.5);
    });
  });

  describe("AC-1.11: Support major currencies", () => {
    it("should support USD", async () => {
      const app = createTestApp();
      const response = await app.handle(
        new Request("http://localhost/currencies/USD")
      );
      expect(response.status).toBe(200);
    });

    it("should support EUR", async () => {
      const app = createTestApp();
      const response = await app.handle(
        new Request("http://localhost/currencies/EUR")
      );
      expect(response.status).toBe(200);
    });

    it("should support GBP", async () => {
      const app = createTestApp();
      const response = await app.handle(
        new Request("http://localhost/currencies/GBP")
      );
      expect(response.status).toBe(200);
    });

    it("should support JPY", async () => {
      const app = createTestApp();
      const response = await app.handle(
        new Request("http://localhost/currencies/JPY")
      );
      expect(response.status).toBe(200);
    });

    it("should support CAD", async () => {
      const app = createTestApp();
      const response = await app.handle(
        new Request("http://localhost/currencies/CAD")
      );
      expect(response.status).toBe(200);
    });

    it("should support AUD", async () => {
      const app = createTestApp();
      const response = await app.handle(
        new Request("http://localhost/currencies/AUD")
      );
      expect(response.status).toBe(200);
    });

    it("should support CHF", async () => {
      const app = createTestApp();
      const response = await app.handle(
        new Request("http://localhost/currencies/CHF")
      );
      expect(response.status).toBe(200);
    });

    it("should support CNY", async () => {
      const app = createTestApp();
      const response = await app.handle(
        new Request("http://localhost/currencies/CNY")
      );
      expect(response.status).toBe(200);
    });
  });
});
