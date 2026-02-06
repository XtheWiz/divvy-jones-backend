/**
 * Utility Functions Unit Tests
 *
 * Tests for money math utilities (toCents, fromCents, splitEqual, splitByWeights)
 * and IP validation (isValidIP).
 */

import { describe, it, expect } from "bun:test";
import {
  toCents,
  fromCents,
  splitEqual,
  splitByWeights,
} from "../lib/utils";
import { isValidIP } from "../services/rate-limiter.service";

// ============================================================================
// toCents
// ============================================================================

describe("toCents", () => {
  it("converts whole dollar amounts", () => {
    expect(toCents(1)).toBe(100);
    expect(toCents(10)).toBe(1000);
    expect(toCents(0)).toBe(0);
  });

  it("converts fractional dollar amounts", () => {
    expect(toCents(1.5)).toBe(150);
    expect(toCents(9.99)).toBe(999);
    expect(toCents(0.01)).toBe(1);
    expect(toCents(0.1)).toBe(10);
  });

  it("rounds to nearest cent", () => {
    // Note: 1.005 * 100 = 100.49999... in IEEE 754, so Math.round gives 100
    // This is expected — use string input "1.005" if exact rounding is needed
    expect(toCents(1.005)).toBe(100);
    expect(toCents(1.004)).toBe(100);
    expect(toCents(33.335)).toBe(3334);
  });

  it("handles string inputs", () => {
    expect(toCents("10.50")).toBe(1050);
    expect(toCents("0.99")).toBe(99);
    expect(toCents("100")).toBe(10000);
  });

  it("handles negative amounts", () => {
    expect(toCents(-5.50)).toBe(-550);
    expect(toCents("-3.25")).toBe(-325);
  });

  it("avoids floating-point errors on classic problem values", () => {
    // 0.1 + 0.2 !== 0.3 in float, but toCents should still work
    expect(toCents(0.1)).toBe(10);
    expect(toCents(0.2)).toBe(20);
    expect(toCents(19.99)).toBe(1999);
  });
});

// ============================================================================
// fromCents
// ============================================================================

describe("fromCents", () => {
  it("converts cents to dollars", () => {
    expect(fromCents(100)).toBe(1);
    expect(fromCents(1050)).toBe(10.5);
    expect(fromCents(999)).toBe(9.99);
    expect(fromCents(0)).toBe(0);
  });

  it("handles single cent", () => {
    expect(fromCents(1)).toBe(0.01);
  });

  it("handles negative cents", () => {
    expect(fromCents(-550)).toBe(-5.5);
  });
});

// ============================================================================
// splitEqual
// ============================================================================

describe("splitEqual", () => {
  it("splits evenly when divisible", () => {
    expect(splitEqual(1000, 2)).toEqual([500, 500]);
    expect(splitEqual(900, 3)).toEqual([300, 300, 300]);
    expect(splitEqual(1200, 4)).toEqual([300, 300, 300, 300]);
  });

  it("distributes remainder one cent at a time", () => {
    // 1001 / 2 = 500 remainder 1
    expect(splitEqual(1001, 2)).toEqual([501, 500]);
    // 1000 / 3 = 333 remainder 1
    expect(splitEqual(1000, 3)).toEqual([334, 333, 333]);
    // 100 / 3 = 33 remainder 1
    expect(splitEqual(100, 3)).toEqual([34, 33, 33]);
  });

  it("all amounts sum to total", () => {
    const amounts = splitEqual(9999, 7);
    expect(amounts.reduce((s, a) => s + a, 0)).toBe(9999);
    expect(amounts.length).toBe(7);
  });

  it("handles single participant", () => {
    expect(splitEqual(1500, 1)).toEqual([1500]);
  });

  it("handles zero total", () => {
    expect(splitEqual(0, 3)).toEqual([0, 0, 0]);
  });

  it("large amounts split correctly", () => {
    const amounts = splitEqual(100001, 100);
    expect(amounts.reduce((s, a) => s + a, 0)).toBe(100001);
    // First participant gets extra cent
    expect(amounts[0]).toBe(1001);
    expect(amounts[99]).toBe(1000);
  });
});

// ============================================================================
// splitByWeights
// ============================================================================

describe("splitByWeights", () => {
  it("splits by equal weights", () => {
    const result = splitByWeights(1000, [1, 1]);
    expect(result).toEqual([500, 500]);
  });

  it("splits by unequal weights", () => {
    // 70/30 split of 1000
    const result = splitByWeights(1000, [70, 30]);
    expect(result).toEqual([700, 300]);
  });

  it("all amounts sum to total (with remainder)", () => {
    const result = splitByWeights(1000, [1, 1, 1]);
    expect(result.reduce((s, a) => s + a, 0)).toBe(1000);
    // 1000/3 = 333.33... each, remainder distributed
    expect(result).toEqual([334, 333, 333]);
  });

  it("handles percentage-based weights", () => {
    // 50%, 30%, 20% of $100.00 (10000 cents)
    const result = splitByWeights(10000, [50, 30, 20]);
    expect(result).toEqual([5000, 3000, 2000]);
  });

  it("handles all-zero weights", () => {
    expect(splitByWeights(1000, [0, 0, 0])).toEqual([0, 0, 0]);
  });

  it("throws on negative weights", () => {
    expect(() => splitByWeights(1000, [50, -10, 60])).toThrow(
      "Weights must not be negative"
    );
  });

  it("handles a single weight", () => {
    expect(splitByWeights(999, [1])).toEqual([999]);
  });

  it("distributes remainder by largest fractional part", () => {
    // 1001 split [1, 2]: expected 333.67, 667.33
    // floor: 333, 667 => remainder 1 goes to index 0 (frac 0.67 > 0.33)
    const result = splitByWeights(1001, [1, 2]);
    expect(result).toEqual([334, 667]);
    expect(result.reduce((s, a) => s + a, 0)).toBe(1001);
  });

  it("handles zero total", () => {
    expect(splitByWeights(0, [1, 2, 3])).toEqual([0, 0, 0]);
  });

  it("handles large number of weights", () => {
    const weights = Array.from({ length: 50 }, (_, i) => i + 1);
    const result = splitByWeights(100000, weights);
    expect(result.reduce((s, a) => s + a, 0)).toBe(100000);
    expect(result.length).toBe(50);
  });
});

// ============================================================================
// isValidIP
// ============================================================================

describe("isValidIP", () => {
  it("accepts valid IPv4 addresses", () => {
    expect(isValidIP("192.168.1.1")).toBe(true);
    expect(isValidIP("10.0.0.1")).toBe(true);
    expect(isValidIP("0.0.0.0")).toBe(true);
    expect(isValidIP("255.255.255.255")).toBe(true);
    expect(isValidIP("127.0.0.1")).toBe(true);
  });

  it("rejects IPv4 with out-of-range octets", () => {
    expect(isValidIP("256.0.0.1")).toBe(false);
    expect(isValidIP("999.999.999.999")).toBe(false);
    expect(isValidIP("192.168.1.300")).toBe(false);
    expect(isValidIP("1.2.3.999")).toBe(false);
  });

  it("rejects malformed IPv4", () => {
    expect(isValidIP("1.2.3")).toBe(false);
    expect(isValidIP("1.2.3.4.5")).toBe(false);
    expect(isValidIP("abc.def.ghi.jkl")).toBe(false);
    expect(isValidIP("")).toBe(false);
  });

  it("accepts valid IPv6 addresses", () => {
    expect(isValidIP("::1")).toBe(true);
    expect(isValidIP("2001:db8::1")).toBe(true);
    expect(isValidIP("fe80::1")).toBe(true);
    expect(isValidIP("::")).toBe(true);
  });

  it("rejects strings that aren't IPs", () => {
    expect(isValidIP("not-an-ip")).toBe(false);
    expect(isValidIP("hello world")).toBe(false);
    expect(isValidIP("12345")).toBe(false);
  });
});
