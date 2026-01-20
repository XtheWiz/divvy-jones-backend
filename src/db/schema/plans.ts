import {
  pgTable,
  uuid,
  text,
  integer,
  boolean,
  timestamp,
  index,
  uniqueIndex,
  check,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { users } from "./users";

// ============================================================================
// PLANS
// ============================================================================

export const plans = pgTable("plans", {
  id: uuid("id").primaryKey().defaultRandom(),
  code: text("code").notNull().unique(),
  name: text("name").notNull(),
  priceCentsMonth: integer("price_cents_month").notNull().default(0),
  adsEnabled: boolean("ads_enabled").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// ============================================================================
// PLAN FEATURES
// ============================================================================

export const planFeatures = pgTable(
  "plan_features",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    planId: uuid("plan_id")
      .notNull()
      .references(() => plans.id, { onDelete: "cascade" }),
    key: text("key").notNull(),
    intValue: integer("int_value"),
    boolValue: boolean("bool_value"),
    textValue: text("text_value"),
  },
  (table) => ({
    plan_features_unique_key: uniqueIndex("plan_features_unique_key").on(table.planId, table.key),
  })
);

// ============================================================================
// SUBSCRIPTIONS
// ============================================================================

export const subscriptions = pgTable(
  "subscriptions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    planId: uuid("plan_id")
      .notNull()
      .references(() => plans.id),
    startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    cancelledAt: timestamp("cancelled_at", { withTimezone: true }),
  },
  (table) => ({
    idx_subscriptions_user_id: index("idx_subscriptions_user_id").on(table.userId),
    idx_subscriptions_expires_at: index("idx_subscriptions_expires_at")
      .on(table.expiresAt)
      .where(sql`expires_at IS NOT NULL`),
    subscriptions_valid_dates: check(
      "subscriptions_valid_dates",
      sql`${table.expiresAt} IS NULL OR ${table.expiresAt} > ${table.startedAt}`
    ),
  })
);

// ============================================================================
// Types
// ============================================================================

export type Plan = typeof plans.$inferSelect;
export type NewPlan = typeof plans.$inferInsert;

export type PlanFeature = typeof planFeatures.$inferSelect;
export type NewPlanFeature = typeof planFeatures.$inferInsert;

export type Subscription = typeof subscriptions.$inferSelect;
export type NewSubscription = typeof subscriptions.$inferInsert;
