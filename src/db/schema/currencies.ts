import {
  pgTable,
  text,
  smallint,
  bigserial,
  numeric,
  timestamp,
  index,
  check,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

// ============================================================================
// CURRENCIES
// ============================================================================

export const currencies = pgTable("currencies", {
  code: text("code").primaryKey(),
  name: text("name").notNull(),
  symbol: text("symbol").notNull(),
  decimals: smallint("decimals").notNull().default(2),
});

// ============================================================================
// FX RATES
// ============================================================================

export const fxRates = pgTable(
  "fx_rates",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    baseCode: text("base_code")
      .notNull()
      .references(() => currencies.code),
    quoteCode: text("quote_code")
      .notNull()
      .references(() => currencies.code),
    rate: numeric("rate", { precision: 20, scale: 10 }).notNull(),
    asOf: timestamp("as_of", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    idx_fx_rates_pair_date: index("idx_fx_rates_pair_date").on(table.baseCode, table.quoteCode, table.asOf),
    idx_fx_rates_as_of: index("idx_fx_rates_as_of").on(table.asOf),
    fx_rates_different_currencies: check("fx_rates_different_currencies", sql`${table.baseCode} <> ${table.quoteCode}`),
  })
);

// ============================================================================
// Types
// ============================================================================

export type Currency = typeof currencies.$inferSelect;
export type NewCurrency = typeof currencies.$inferInsert;

export type FxRate = typeof fxRates.$inferSelect;
export type NewFxRate = typeof fxRates.$inferInsert;
