import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";

// Create connection pool
// Prefer DATABASE_URL_TEST in test environment to ensure app and tests use same DB
const connectionString = process.env.DATABASE_URL_TEST || process.env.DATABASE_URL;

const pool = new Pool({
  connectionString,
});

// Create drizzle instance with schema
export const db = drizzle(pool, { schema });

// Export schema for convenience
export * from "./schema";

// Export types
export type Database = typeof db;
