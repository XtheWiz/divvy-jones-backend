/**
 * Currency Utilities Tests
 * Sprint 005 - TASK-007
 *
 * Tests for currency conversion and formatting utilities.
 */

import { describe, it, expect } from "bun:test";
import {
  roundToCurrencyDecimals,
  parseCurrencyAmount,
  validateCurrencyCode,
  formatCurrencyLong,
  formatCurrencyISO,
  calculatePercentage,
  splitAmountEvenly,
  amountsEqual,
  getMinimumAmount,
  isValidAmount,
} from "../utils/currency.utils";

describe("Currency Utilities", () => {
  describe("roundToCurrencyDecimals", () => {
    it("should round USD to 2 decimals", () => {
      expect(roundToCurrencyDecimals(100.456, "USD")).toBe(100.46);
      expect(roundToCurrencyDecimals(100.454, "USD")).toBe(100.45);
    });

    it("should round JPY to 0 decimals", () => {
      expect(roundToCurrencyDecimals(100.6, "JPY")).toBe(101);
      expect(roundToCurrencyDecimals(100.4, "JPY")).toBe(100);
    });

    it("should default to 2 decimals for unknown currency", () => {
      expect(roundToCurrencyDecimals(100.456, "XYZ")).toBe(100.46);
    });
  });

  describe("parseCurrencyAmount", () => {
    it("should parse simple numbers", () => {
      expect(parseCurrencyAmount("100")).toBe(100);
      expect(parseCurrencyAmount("100.50")).toBe(100.5);
    });

    it("should parse amounts with currency symbols", () => {
      expect(parseCurrencyAmount("$100.00")).toBe(100);
      expect(parseCurrencyAmount("\u20AC50.00")).toBe(50);
      expect(parseCurrencyAmount("\u00A31000")).toBe(1000);
    });

    it("should parse US format with thousands separator", () => {
      expect(parseCurrencyAmount("1,000.50")).toBe(1000.5);
      expect(parseCurrencyAmount("1,234,567.89")).toBe(1234567.89);
    });

    it("should parse European format", () => {
      expect(parseCurrencyAmount("1.000,50")).toBe(1000.5);
      expect(parseCurrencyAmount("100,50")).toBe(100.5);
    });

    it("should return null for invalid input", () => {
      expect(parseCurrencyAmount("")).toBeNull();
      expect(parseCurrencyAmount("abc")).toBeNull();
      expect(parseCurrencyAmount(null as any)).toBeNull();
    });
  });

  describe("validateCurrencyCode", () => {
    it("should validate supported currencies", () => {
      const result = validateCurrencyCode("USD");
      expect(result.valid).toBe(true);
      expect(result.normalized).toBe("USD");
    });

    it("should normalize to uppercase", () => {
      const result = validateCurrencyCode("eur");
      expect(result.valid).toBe(true);
      expect(result.normalized).toBe("EUR");
    });

    it("should reject unsupported currencies", () => {
      const result = validateCurrencyCode("XYZ");
      expect(result.valid).toBe(false);
      expect(result.error).toContain("not supported");
    });

    it("should reject empty string", () => {
      const result = validateCurrencyCode("");
      expect(result.valid).toBe(false);
      expect(result.error).toContain("required");
    });

    it("should reject wrong length codes", () => {
      const result = validateCurrencyCode("US");
      expect(result.valid).toBe(false);
      expect(result.error).toContain("3 characters");
    });
  });

  describe("formatCurrencyLong", () => {
    it("should format with full currency name", () => {
      expect(formatCurrencyLong(100, "USD")).toBe("100.00 US Dollar");
      expect(formatCurrencyLong(50.5, "EUR")).toBe("50.50 Euro");
    });

    it("should handle JPY without decimals", () => {
      expect(formatCurrencyLong(1000, "JPY")).toBe("1000 Japanese Yen");
    });

    it("should handle unknown currency", () => {
      expect(formatCurrencyLong(100, "XYZ")).toBe("100.00 XYZ");
    });
  });

  describe("formatCurrencyISO", () => {
    it("should format with ISO code", () => {
      expect(formatCurrencyISO(100, "USD")).toBe("100.00 USD");
      expect(formatCurrencyISO(50.5, "EUR")).toBe("50.50 EUR");
    });

    it("should handle JPY without decimals", () => {
      expect(formatCurrencyISO(1000, "JPY")).toBe("1000 JPY");
    });

    it("should uppercase the code", () => {
      expect(formatCurrencyISO(100, "usd")).toBe("100.00 USD");
    });
  });

  describe("calculatePercentage", () => {
    it("should calculate percentage correctly", () => {
      expect(calculatePercentage(100, 10, "USD")).toBe(10);
      expect(calculatePercentage(100, 15, "USD")).toBe(15);
    });

    it("should round to currency precision", () => {
      expect(calculatePercentage(100, 33.33, "USD")).toBe(33.33);
      expect(calculatePercentage(100, 33.33, "JPY")).toBe(33);
    });
  });

  describe("splitAmountEvenly", () => {
    it("should split evenly when divisible", () => {
      const shares = splitAmountEvenly(100, 4, "USD");
      expect(shares).toEqual([25, 25, 25, 25]);
    });

    it("should distribute remainder correctly", () => {
      const shares = splitAmountEvenly(100, 3, "USD");
      // 100/3 = 33.33..., so we need 33.34 + 33.33 + 33.33 = 100
      expect(shares[0]).toBe(33.34);
      expect(shares[1]).toBe(33.33);
      expect(shares[2]).toBe(33.33);
      expect(shares.reduce((a, b) => a + b, 0)).toBeCloseTo(100, 2);
    });

    it("should handle JPY (no decimals)", () => {
      const shares = splitAmountEvenly(100, 3, "JPY");
      expect(shares[0]).toBe(34);
      expect(shares[1]).toBe(33);
      expect(shares[2]).toBe(33);
      expect(shares.reduce((a, b) => a + b, 0)).toBe(100);
    });

    it("should return empty array for 0 parties", () => {
      expect(splitAmountEvenly(100, 0, "USD")).toEqual([]);
    });

    it("should handle negative parties", () => {
      expect(splitAmountEvenly(100, -1, "USD")).toEqual([]);
    });
  });

  describe("amountsEqual", () => {
    it("should return true for equal amounts", () => {
      expect(amountsEqual(100, 100, "USD")).toBe(true);
      expect(amountsEqual(100.00, 100, "USD")).toBe(true);
    });

    it("should return true for amounts equal within precision", () => {
      expect(amountsEqual(100.001, 100.002, "USD")).toBe(true);
      expect(amountsEqual(100.003, 100.004, "USD")).toBe(true);
    });

    it("should return false for different amounts", () => {
      expect(amountsEqual(100, 100.01, "USD")).toBe(false);
      expect(amountsEqual(100, 101, "JPY")).toBe(false);
    });
  });

  describe("getMinimumAmount", () => {
    it("should return 0.01 for USD", () => {
      expect(getMinimumAmount("USD")).toBe(0.01);
    });

    it("should return 1 for JPY", () => {
      expect(getMinimumAmount("JPY")).toBe(1);
    });

    it("should default to 0.01 for unknown currency", () => {
      expect(getMinimumAmount("XYZ")).toBe(0.01);
    });
  });

  describe("isValidAmount", () => {
    it("should validate positive amounts", () => {
      expect(isValidAmount(100, "USD")).toEqual({ valid: true });
      expect(isValidAmount(0.01, "USD")).toEqual({ valid: true });
    });

    it("should allow zero", () => {
      expect(isValidAmount(0, "USD")).toEqual({ valid: true });
    });

    it("should reject negative amounts", () => {
      const result = isValidAmount(-100, "USD");
      expect(result.valid).toBe(false);
      expect(result.error).toContain("negative");
    });

    it("should reject NaN", () => {
      const result = isValidAmount(NaN, "USD");
      expect(result.valid).toBe(false);
      expect(result.error).toContain("must be a number");
    });

    it("should reject amounts below minimum", () => {
      const result = isValidAmount(0.001, "USD");
      expect(result.valid).toBe(false);
      expect(result.error).toContain("at least");
    });

    it("should accept minimum amount for JPY", () => {
      expect(isValidAmount(1, "JPY")).toEqual({ valid: true });
    });
  });
});
