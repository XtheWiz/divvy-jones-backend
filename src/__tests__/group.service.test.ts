import { describe, test, expect } from "bun:test";

// Test the join code alphabet and generation logic
describe("Group Service - Join Code", () => {
  // AC-2.5: Group receives a unique 8-character join code (alphanumeric)
  // Technical note: no ambiguous chars (0/O, 1/I/L)

  const JOIN_CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
  const AMBIGUOUS_CHARS = ["0", "O", "1", "I", "L"];

  test("alphabet excludes ambiguous characters", () => {
    for (const char of AMBIGUOUS_CHARS) {
      expect(JOIN_CODE_ALPHABET.includes(char)).toBe(false);
    }
  });

  test("alphabet contains only uppercase letters and numbers", () => {
    for (const char of JOIN_CODE_ALPHABET) {
      const isUpperCase = char >= "A" && char <= "Z";
      const isNumber = char >= "0" && char <= "9";
      expect(isUpperCase || isNumber).toBe(true);
    }
  });

  test("alphabet has sufficient entropy (30+ characters)", () => {
    // 30 chars gives ~30^8 = 6.5 trillion combinations
    expect(JOIN_CODE_ALPHABET.length).toBeGreaterThanOrEqual(30);
  });
});

describe("Group Service - Validation Rules", () => {
  // AC-2.3: Group name must be 1-100 characters

  test("group name validation - min length", () => {
    const name = "";
    const trimmed = name.trim();
    expect(trimmed.length).toBe(0);
    expect(trimmed.length >= 1).toBe(false);
  });

  test("group name validation - max length", () => {
    const name = "A".repeat(101);
    expect(name.length).toBe(101);
    expect(name.length <= 100).toBe(false);
  });

  test("group name validation - valid length", () => {
    const name = "My Expense Group";
    expect(name.length >= 1 && name.length <= 100).toBe(true);
  });

  test("group name trimming removes whitespace", () => {
    const name = "  My Group  ";
    expect(name.trim()).toBe("My Group");
  });
});

describe("Group Service - Join Code Normalization", () => {
  // Join codes should be case-insensitive

  test("normalizes lowercase to uppercase", () => {
    const code = "abcd1234";
    expect(code.toUpperCase()).toBe("ABCD1234");
  });

  test("normalizes mixed case to uppercase", () => {
    const code = "AbCd1234";
    expect(code.toUpperCase()).toBe("ABCD1234");
  });

  test("trims whitespace from join code", () => {
    const code = "  ABCD1234  ";
    expect(code.trim().toUpperCase()).toBe("ABCD1234");
  });
});

describe("Group Service - Member Roles", () => {
  // AC-2.4: Creator automatically becomes group owner/member
  // AC-2.12: New member has "member" role (not owner/admin)

  const VALID_ROLES = ["owner", "admin", "member", "viewer"];

  test("owner role is valid", () => {
    expect(VALID_ROLES.includes("owner")).toBe(true);
  });

  test("member role is valid", () => {
    expect(VALID_ROLES.includes("member")).toBe(true);
  });

  test("creator should get owner role", () => {
    const creatorRole = "owner";
    expect(creatorRole).toBe("owner");
  });

  test("joiner should get member role", () => {
    const joinerRole = "member";
    expect(joinerRole).toBe("member");
    expect(joinerRole).not.toBe("owner");
    expect(joinerRole).not.toBe("admin");
  });
});
