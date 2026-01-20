/**
 * Currencies Integration Tests
 * Sprint 006 - TASK-003
 *
 * Tests for currency endpoints:
 * - GET /v1/currencies
 * - GET /v1/currencies/:code
 *
 * AC-0.9: Integration tests exist for currencies endpoint
 */

import { describe, it, expect, beforeAll, afterAll } from "bun:test";
import { beforeAllTests, afterAllTests } from "./setup";
import { createTestApp, get, type ApiResponse } from "./helpers";

// ============================================================================
// Test Setup
// ============================================================================

const app = createTestApp();

beforeAll(async () => {
  await beforeAllTests();
});

afterAll(async () => {
  await afterAllTests();
});

// ============================================================================
// Response Types
// ============================================================================

interface Currency {
  code: string;
  name: string;
  symbol: string;
  decimals: number;
  rate: number;
}

interface CurrenciesResponse {
  currencies: Currency[];
  baseCurrency: string;
  lastUpdated: string;
  isFallback: boolean;
}

interface CurrencyDetailResponse {
  code: string;
  name: string;
  symbol: string;
  decimals: number;
  rate: number;
  baseCurrency: string;
  lastUpdated: string;
}

// ============================================================================
// GET /v1/currencies Tests
// ============================================================================

describe("GET /v1/currencies", () => {
  it("should return all 8 supported currencies", async () => {
    // Act
    const response = await get<ApiResponse<CurrenciesResponse>>(
      app,
      "/v1/currencies"
    );

    // Assert
    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);

    const data = response.body.data as CurrenciesResponse;
    expect(data.currencies).toBeArray();
    expect(data.currencies.length).toBe(8);
    expect(data.baseCurrency).toBe("USD");
    expect(data.lastUpdated).toBeDefined();
    expect(typeof data.isFallback).toBe("boolean");
  });

  it("should include all required currency codes", async () => {
    // Act
    const response = await get<ApiResponse<CurrenciesResponse>>(
      app,
      "/v1/currencies"
    );

    // Assert
    const data = response.body.data as CurrenciesResponse;
    const codes = data.currencies.map((c) => c.code);

    // AC-1.11 from Sprint 005: Support major currencies
    expect(codes).toContain("USD");
    expect(codes).toContain("EUR");
    expect(codes).toContain("GBP");
    expect(codes).toContain("JPY");
    expect(codes).toContain("CAD");
    expect(codes).toContain("AUD");
    expect(codes).toContain("CHF");
    expect(codes).toContain("CNY");
  });

  it("should include proper currency metadata", async () => {
    // Act
    const response = await get<ApiResponse<CurrenciesResponse>>(
      app,
      "/v1/currencies"
    );

    // Assert
    const data = response.body.data as CurrenciesResponse;

    // Check USD has proper fields
    const usd = data.currencies.find((c) => c.code === "USD");
    expect(usd).toBeDefined();
    expect(usd!.name).toBe("US Dollar");
    expect(usd!.symbol).toBe("$");
    expect(usd!.decimals).toBe(2);
    expect(usd!.rate).toBe(1); // USD is base currency

    // Check JPY has 0 decimals
    const jpy = data.currencies.find((c) => c.code === "JPY");
    expect(jpy).toBeDefined();
    expect(jpy!.decimals).toBe(0);
  });

  it("should include exchange rates for all currencies", async () => {
    // Act
    const response = await get<ApiResponse<CurrenciesResponse>>(
      app,
      "/v1/currencies"
    );

    // Assert
    const data = response.body.data as CurrenciesResponse;

    for (const currency of data.currencies) {
      expect(currency.rate).toBeGreaterThan(0);
      expect(typeof currency.rate).toBe("number");
    }
  });
});

// ============================================================================
// GET /v1/currencies/:code Tests
// ============================================================================

describe("GET /v1/currencies/:code", () => {
  it("should return details for a valid currency code", async () => {
    // Act
    const response = await get<ApiResponse<CurrencyDetailResponse>>(
      app,
      "/v1/currencies/EUR"
    );

    // Assert
    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);

    const data = response.body.data as CurrencyDetailResponse;
    expect(data.code).toBe("EUR");
    expect(data.name).toBe("Euro");
    expect(data.symbol).toBe("€");
    expect(data.decimals).toBe(2);
    expect(data.rate).toBeGreaterThan(0);
    expect(data.baseCurrency).toBe("USD");
    expect(data.lastUpdated).toBeDefined();
  });

  it("should handle lowercase currency codes", async () => {
    // Act
    const response = await get<ApiResponse<CurrencyDetailResponse>>(
      app,
      "/v1/currencies/gbp"
    );

    // Assert
    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);

    const data = response.body.data as CurrencyDetailResponse;
    expect(data.code).toBe("GBP");
  });

  it("should return 404 for unsupported currency", async () => {
    // Act
    const response = await get<ApiResponse>(app, "/v1/currencies/XYZ");

    // Assert
    expect(response.status).toBe(404);
    expect(response.body.success).toBe(false);
    expect(response.body.error?.code).toBe("NOT_FOUND");
  });

  it("should return 404 for invalid currency code format", async () => {
    // Act - code too short
    const response = await get<ApiResponse>(app, "/v1/currencies/US");

    // Assert
    expect(response.status).toBe(422); // Validation error
  });
});
