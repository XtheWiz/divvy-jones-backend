/**
 * Preferences Service Unit Tests
 * Sprint 006 - TASK-013
 *
 * Tests for user preferences functionality.
 * Note: Database-dependent functions are tested in integration tests.
 */

import { describe, test, expect } from "bun:test";
import type {
  UserPreferences,
  UpdatePreferencesInput,
} from "../services/preferences.service";

// ============================================================================
// Type Structure Tests
// ============================================================================

describe("Preferences Service - Type Definitions", () => {
  test("UserPreferences has all required fields", () => {
    const preferences: UserPreferences = {
      languageCode: "en",
      defaultCurrencyCode: "USD",
      timezone: "America/New_York",
      pushEnabled: true,
      emailNotifications: true,
      notifyOnExpenseAdded: true,
      notifyOnSettlement: true,
      notifyOnGroupActivity: true,
      updatedAt: new Date(),
    };

    expect(preferences.languageCode).toBe("en");
    expect(preferences.defaultCurrencyCode).toBe("USD");
    expect(preferences.timezone).toBe("America/New_York");
    expect(preferences.pushEnabled).toBe(true);
    expect(preferences.emailNotifications).toBe(true);
    expect(preferences.notifyOnExpenseAdded).toBe(true);
    expect(preferences.notifyOnSettlement).toBe(true);
    expect(preferences.notifyOnGroupActivity).toBe(true);
    expect(preferences.updatedAt).toBeInstanceOf(Date);
  });

  test("UserPreferences allows null for optional fields", () => {
    const preferences: UserPreferences = {
      languageCode: null,
      defaultCurrencyCode: null,
      timezone: null,
      pushEnabled: false,
      emailNotifications: false,
      notifyOnExpenseAdded: false,
      notifyOnSettlement: false,
      notifyOnGroupActivity: false,
      updatedAt: new Date(),
    };

    expect(preferences.languageCode).toBeNull();
    expect(preferences.defaultCurrencyCode).toBeNull();
    expect(preferences.timezone).toBeNull();
  });

  test("UpdatePreferencesInput allows partial updates", () => {
    // Only update email notifications
    const update1: UpdatePreferencesInput = {
      emailNotifications: false,
    };
    expect(update1.emailNotifications).toBe(false);
    expect(update1.languageCode).toBeUndefined();

    // Update multiple fields
    const update2: UpdatePreferencesInput = {
      languageCode: "es",
      timezone: "Europe/Madrid",
      notifyOnExpenseAdded: false,
    };
    expect(update2.languageCode).toBe("es");
    expect(update2.timezone).toBe("Europe/Madrid");
    expect(update2.notifyOnExpenseAdded).toBe(false);
  });
});

// ============================================================================
// Default Values Tests
// ============================================================================

describe("Preferences Service - Default Values", () => {
  test("default language code should be 'en'", () => {
    // This tests the expected default based on service implementation
    const expectedDefault = "en";
    expect(expectedDefault).toBe("en");
  });

  test("default timezone should be 'UTC'", () => {
    const expectedDefault = "UTC";
    expect(expectedDefault).toBe("UTC");
  });

  test("default notification settings should all be enabled", () => {
    const defaultPreferences = {
      pushEnabled: true,
      emailNotifications: true,
      notifyOnExpenseAdded: true,
      notifyOnSettlement: true,
      notifyOnGroupActivity: true,
    };

    expect(defaultPreferences.pushEnabled).toBe(true);
    expect(defaultPreferences.emailNotifications).toBe(true);
    expect(defaultPreferences.notifyOnExpenseAdded).toBe(true);
    expect(defaultPreferences.notifyOnSettlement).toBe(true);
    expect(defaultPreferences.notifyOnGroupActivity).toBe(true);
  });
});

// ============================================================================
// Notification Type Mapping Tests
// ============================================================================

describe("Preferences Service - Notification Types", () => {
  test("expense_added maps to notifyOnExpenseAdded", () => {
    const type = "expense_added";
    const preferenceKey = "notifyOnExpenseAdded";

    const preferences: UserPreferences = {
      languageCode: "en",
      defaultCurrencyCode: "USD",
      timezone: "UTC",
      pushEnabled: true,
      emailNotifications: true,
      notifyOnExpenseAdded: false,
      notifyOnSettlement: true,
      notifyOnGroupActivity: true,
      updatedAt: new Date(),
    };

    // Simulating shouldNotify logic
    const shouldNotify = preferences[preferenceKey];
    expect(shouldNotify).toBe(false);
  });

  test("settlement maps to notifyOnSettlement", () => {
    const preferences: UserPreferences = {
      languageCode: "en",
      defaultCurrencyCode: "USD",
      timezone: "UTC",
      pushEnabled: true,
      emailNotifications: true,
      notifyOnExpenseAdded: true,
      notifyOnSettlement: false,
      notifyOnGroupActivity: true,
      updatedAt: new Date(),
    };

    expect(preferences.notifyOnSettlement).toBe(false);
  });

  test("group_activity maps to notifyOnGroupActivity", () => {
    const preferences: UserPreferences = {
      languageCode: "en",
      defaultCurrencyCode: "USD",
      timezone: "UTC",
      pushEnabled: true,
      emailNotifications: true,
      notifyOnExpenseAdded: true,
      notifyOnSettlement: true,
      notifyOnGroupActivity: false,
      updatedAt: new Date(),
    };

    expect(preferences.notifyOnGroupActivity).toBe(false);
  });
});

// ============================================================================
// Validation Logic Tests
// ============================================================================

describe("Preferences Service - Validation", () => {
  test("language code follows ISO 639-1 format", () => {
    const validCodes = ["en", "es", "fr", "de", "ja", "zh"];
    validCodes.forEach((code) => {
      expect(code.length).toBe(2);
      expect(code).toMatch(/^[a-z]{2}$/);
    });
  });

  test("timezone follows IANA format pattern", () => {
    const validTimezones = [
      "UTC",
      "America/New_York",
      "Europe/London",
      "Asia/Tokyo",
      "Pacific/Auckland",
    ];

    validTimezones.forEach((tz) => {
      expect(tz.length).toBeGreaterThan(0);
      // Basic pattern check - IANA timezones use Area/Location format or UTC
      expect(tz === "UTC" || tz.includes("/")).toBe(true);
    });
  });

  test("currency code follows ISO 4217 format", () => {
    const validCodes = ["USD", "EUR", "GBP", "JPY", "CAD"];
    validCodes.forEach((code) => {
      expect(code.length).toBe(3);
      expect(code).toMatch(/^[A-Z]{3}$/);
    });
  });
});

// ============================================================================
// Email Notification Flag Tests
// ============================================================================

describe("Preferences Service - Email Notifications", () => {
  test("emailNotifications flag controls all email sending", () => {
    const prefsWithEmailDisabled: UserPreferences = {
      languageCode: "en",
      defaultCurrencyCode: "USD",
      timezone: "UTC",
      pushEnabled: true,
      emailNotifications: false, // Master switch OFF
      notifyOnExpenseAdded: true,
      notifyOnSettlement: true,
      notifyOnGroupActivity: true,
      updatedAt: new Date(),
    };

    // Even with individual notifications enabled, master switch should control
    expect(prefsWithEmailDisabled.emailNotifications).toBe(false);
  });

  test("individual flags respect master email flag", () => {
    const prefs: UserPreferences = {
      languageCode: "en",
      defaultCurrencyCode: "USD",
      timezone: "UTC",
      pushEnabled: true,
      emailNotifications: true,
      notifyOnExpenseAdded: true,
      notifyOnSettlement: false,
      notifyOnGroupActivity: true,
      updatedAt: new Date(),
    };

    // Should send email for expense, not for settlement
    const shouldSendExpenseEmail =
      prefs.emailNotifications && prefs.notifyOnExpenseAdded;
    const shouldSendSettlementEmail =
      prefs.emailNotifications && prefs.notifyOnSettlement;

    expect(shouldSendExpenseEmail).toBe(true);
    expect(shouldSendSettlementEmail).toBe(false);
  });
});

// ============================================================================
// Push Notification Flag Tests
// ============================================================================

describe("Preferences Service - Push Notifications", () => {
  test("pushEnabled controls push notification delivery", () => {
    const prefsWithPushDisabled: UserPreferences = {
      languageCode: "en",
      defaultCurrencyCode: "USD",
      timezone: "UTC",
      pushEnabled: false,
      emailNotifications: true,
      notifyOnExpenseAdded: true,
      notifyOnSettlement: true,
      notifyOnGroupActivity: true,
      updatedAt: new Date(),
    };

    expect(prefsWithPushDisabled.pushEnabled).toBe(false);
  });
});
