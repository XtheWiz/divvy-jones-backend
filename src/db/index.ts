import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";

// Create connection pool
// Use DATABASE_URL_TEST only in test environment
const connectionString = process.env.DATABASE_URL_TEST || process.env.DATABASE_URL;

const pool = new Pool({
  connectionString,
  max: 20,                     // Maximum pool size
  idleTimeoutMillis: 30000,    // Close idle clients after 30s
  connectionTimeoutMillis: 5000, // Timeout if no connection available in 5s
});

// Create drizzle instance with schema
export const db = drizzle(pool, { schema });

// Export schema for convenience
export * from "./schema";

// Export types
export type Database = typeof db;
