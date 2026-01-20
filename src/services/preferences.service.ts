/**
 * Preferences Service
 * Sprint 006 - User Preferences Business Logic
 *
 * Handles user preferences CRUD operations.
 */

import { eq } from "drizzle-orm";
import { db, userSettings, type UserSettings } from "../db";

// ============================================================================
// Types
// ============================================================================

export interface UserPreferences {
  languageCode: string | null;
  defaultCurrencyCode: string | null;
  timezone: string | null;
  pushEnabled: boolean;
  emailNotifications: boolean;
  notifyOnExpenseAdded: boolean;
  notifyOnSettlement: boolean;
  notifyOnGroupActivity: boolean;
  updatedAt: Date;
}

export interface UpdatePreferencesInput {
  languageCode?: string;
  defaultCurrencyCode?: string;
  timezone?: string;
  pushEnabled?: boolean;
  emailNotifications?: boolean;
  notifyOnExpenseAdded?: boolean;
  notifyOnSettlement?: boolean;
  notifyOnGroupActivity?: boolean;
}

// ============================================================================
// Preferences Service Functions
// ============================================================================

/**
 * Get user preferences
 * AC-1.5: GET /users/me/preferences returns current user preferences
 */
export async function getUserPreferences(
  userId: string
): Promise<UserPreferences | null> {
  const [preferences] = await db
    .select({
      languageCode: userSettings.languageCode,
      defaultCurrencyCode: userSettings.defaultCurrencyCode,
      timezone: userSettings.timezone,
      pushEnabled: userSettings.pushEnabled,
      emailNotifications: userSettings.emailNotifications,
      notifyOnExpenseAdded: userSettings.notifyOnExpenseAdded,
      notifyOnSettlement: userSettings.notifyOnSettlement,
      notifyOnGroupActivity: userSettings.notifyOnGroupActivity,
      updatedAt: userSettings.updatedAt,
    })
    .from(userSettings)
    .where(eq(userSettings.userId, userId))
    .limit(1);

  return preferences || null;
}

/**
 * Update user preferences
 * AC-1.6: PUT /users/me/preferences updates user preferences
 */
export async function updateUserPreferences(
  userId: string,
  input: UpdatePreferencesInput
): Promise<UserPreferences> {
  // Check if preferences exist
  const [existing] = await db
    .select({ id: userSettings.id })
    .from(userSettings)
    .where(eq(userSettings.userId, userId))
    .limit(1);

  if (!existing) {
    // Create preferences if they don't exist (migration scenario)
    // AC-1.4: Default preferences are created when user registers
    await db.insert(userSettings).values({
      userId,
      ...input,
    });
  } else {
    // Update existing preferences
    await db
      .update(userSettings)
      .set({
        ...input,
        updatedAt: new Date(),
      })
      .where(eq(userSettings.userId, userId));
  }

  // Fetch and return updated preferences
  const updated = await getUserPreferences(userId);

  // This should never happen after insert/update
  if (!updated) {
    throw new Error("Failed to retrieve updated preferences");
  }

  return updated;
}

/**
 * Create default preferences for a new user
 * AC-1.4: Default preferences are created when user registers
 */
export async function createDefaultPreferences(
  userId: string
): Promise<UserPreferences> {
  await db.insert(userSettings).values({
    userId,
    languageCode: "en",
    timezone: "UTC",
    pushEnabled: true,
    emailNotifications: true,
    notifyOnExpenseAdded: true,
    notifyOnSettlement: true,
    notifyOnGroupActivity: true,
  });

  const preferences = await getUserPreferences(userId);

  if (!preferences) {
    throw new Error("Failed to create default preferences");
  }

  return preferences;
}

/**
 * Check if user has email notifications enabled
 * AC-1.11: Emails respect user preferences
 */
export async function isEmailNotificationsEnabled(
  userId: string
): Promise<boolean> {
  const preferences = await getUserPreferences(userId);
  return preferences?.emailNotifications ?? true;
}

/**
 * Check if user wants a specific notification type
 * AC-1.13: In-app notifications respect user preference settings
 * AC-1.14: Users can disable specific notification types
 */
export async function shouldNotify(
  userId: string,
  notificationType: "expense_added" | "settlement" | "group_activity"
): Promise<boolean> {
  const preferences = await getUserPreferences(userId);

  if (!preferences) {
    // Default to true if no preferences exist
    return true;
  }

  switch (notificationType) {
    case "expense_added":
      return preferences.notifyOnExpenseAdded;
    case "settlement":
      return preferences.notifyOnSettlement;
    case "group_activity":
      return preferences.notifyOnGroupActivity;
    default:
      return true;
  }
}
