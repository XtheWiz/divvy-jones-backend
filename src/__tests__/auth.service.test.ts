import { describe, test, expect } from "bun:test";
import {
  validatePasswordStrength,
  isValidEmail,
  normalizeEmail,
  hashPassword,
  verifyPassword,
} from "../services/auth.service";

describe("Auth Service - Password Validation", () => {
  // AC-1.3: Password must meet security requirements (min 8 chars, mixed case, number)

  test("rejects password shorter than 8 characters", () => {
    const result = validatePasswordStrength("Short1A");
    expect(result.valid).toBe(false);
    expect(result.errors).toContain("Password must be at least 8 characters");
  });

  test("rejects password without uppercase letter", () => {
    const result = validatePasswordStrength("lowercase123");
    expect(result.valid).toBe(false);
    expect(result.errors).toContain("Password must contain at least one uppercase letter");
  });

  test("rejects password without lowercase letter", () => {
    const result = validatePasswordStrength("UPPERCASE123");
    expect(result.valid).toBe(false);
    expect(result.errors).toContain("Password must contain at least one lowercase letter");
  });

  test("rejects password without number", () => {
    const result = validatePasswordStrength("NoNumbersHere");
    expect(result.valid).toBe(false);
    expect(result.errors).toContain("Password must contain at least one number");
  });

  test("accepts valid password meeting all requirements", () => {
    const result = validatePasswordStrength("ValidPass123");
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  test("returns multiple errors for multiple violations", () => {
    const result = validatePasswordStrength("short");
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(1);
  });
});

describe("Auth Service - Email Validation", () => {
  // AC-1.2: Email must be validated (format check)

  test("accepts valid email format", () => {
    expect(isValidEmail("user@example.com")).toBe(true);
    expect(isValidEmail("user.name@domain.co.uk")).toBe(true);
    expect(isValidEmail("user+tag@example.org")).toBe(true);
  });

  test("rejects invalid email format", () => {
    expect(isValidEmail("invalid")).toBe(false);
    expect(isValidEmail("@domain.com")).toBe(false);
    expect(isValidEmail("user@")).toBe(false);
    expect(isValidEmail("user @domain.com")).toBe(false);
    expect(isValidEmail("")).toBe(false);
  });
});

describe("Auth Service - Email Normalization", () => {
  test("converts email to lowercase", () => {
    expect(normalizeEmail("USER@EXAMPLE.COM")).toBe("user@example.com");
  });

  test("trims whitespace", () => {
    expect(normalizeEmail("  user@example.com  ")).toBe("user@example.com");
  });

  test("handles mixed case with whitespace", () => {
    expect(normalizeEmail("  User@Example.COM  ")).toBe("user@example.com");
  });
});

describe("Auth Service - Password Hashing", () => {
  // AC-1.5: Password is hashed using bcrypt before storage

  test("hashes password and verifies correctly", async () => {
    const password = "TestPassword123";
    const hash = await hashPassword(password);

    // Hash should be different from original
    expect(hash).not.toBe(password);

    // Hash should start with bcrypt identifier
    expect(hash.startsWith("$2")).toBe(true);

    // Verification should work
    const isValid = await verifyPassword(password, hash);
    expect(isValid).toBe(true);
  });

  test("rejects incorrect password", async () => {
    const password = "TestPassword123";
    const hash = await hashPassword(password);

    const isValid = await verifyPassword("WrongPassword123", hash);
    expect(isValid).toBe(false);
  });

  test("generates different hashes for same password (salt)", async () => {
    const password = "TestPassword123";
    const hash1 = await hashPassword(password);
    const hash2 = await hashPassword(password);

    // Hashes should be different due to random salt
    expect(hash1).not.toBe(hash2);

    // But both should verify correctly
    expect(await verifyPassword(password, hash1)).toBe(true);
    expect(await verifyPassword(password, hash2)).toBe(true);
  });
});
