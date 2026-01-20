import { pgTable, uuid, text, boolean, timestamp, index, uniqueIndex } from "drizzle-orm/pg-core";
import { authProviderType } from "./enums";
import { currencies } from "./currencies";

// ============================================================================
// USERS
// ============================================================================

export const users = pgTable(
  "users",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    email: text("email").unique(),
    displayName: text("display_name").notNull(),
    passwordHash: text("password_hash"), // nullable for OAuth-only users
    primaryAuthProvider: text("primary_auth_provider")
      .notNull()
      .references(() => authProviderType.value),
    isEmailVerified: boolean("is_email_verified").notNull().default(false),
    adsOptOut: boolean("ads_opt_out").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }), // soft delete
  },
  (table) => [
    uniqueIndex("idx_users_email")
      .on(table.email)
      .where("email IS NOT NULL AND deleted_at IS NULL"),
    index("idx_users_deleted_at")
      .on(table.deletedAt)
      .where("deleted_at IS NOT NULL"),
  ]
);

// ============================================================================
// OAUTH ACCOUNTS
// ============================================================================

export const oauthAccounts = pgTable(
  "oauth_accounts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    provider: text("provider")
      .notNull()
      .references(() => authProviderType.value),
    providerUid: text("provider_uid").notNull(),
    emailAtProvider: text("email_at_provider"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("oauth_accounts_unique_provider").on(table.provider, table.providerUid),
    index("idx_oauth_accounts_user_id").on(table.userId),
  ]
);

// ============================================================================
// USER SETTINGS
// ============================================================================

export const userSettings = pgTable("user_settings", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .unique()
    .references(() => users.id, { onDelete: "cascade" }),
  languageCode: text("language_code").default("en"),
  defaultCurrencyCode: text("default_currency_code").references(() => currencies.code),
  pushEnabled: boolean("push_enabled").notNull().default(true),
  emailNotifications: boolean("email_notifications").notNull().default(true),
  timezone: text("timezone").default("UTC"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

// ============================================================================
// REFRESH TOKENS
// ============================================================================

export const refreshTokens = pgTable(
  "refresh_tokens",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    tokenHash: text("token_hash").notNull(), // hashed token for secure lookup
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    revokedAt: timestamp("revoked_at", { withTimezone: true }), // null if active
  },
  (table) => [
    index("idx_refresh_tokens_user_id").on(table.userId),
    index("idx_refresh_tokens_token_hash").on(table.tokenHash),
  ]
);

// ============================================================================
// Types
// ============================================================================

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;

export type RefreshToken = typeof refreshTokens.$inferSelect;
export type NewRefreshToken = typeof refreshTokens.$inferInsert;

export type OauthAccount = typeof oauthAccounts.$inferSelect;
export type NewOauthAccount = typeof oauthAccounts.$inferInsert;

export type UserSettings = typeof userSettings.$inferSelect;
export type NewUserSettings = typeof userSettings.$inferInsert;
