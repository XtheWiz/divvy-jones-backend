/**
 * Integration Test Setup
 * Sprint 003 - TASK-011
 *
 * Provides test database connection, cleanup utilities, and test helpers
 * for running integration tests against a real database.
 *
 * IMPORTANT: Tests should use DATABASE_URL_TEST to avoid affecting development data.
 */

import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "../../db/schema";
import { sql } from "drizzle-orm";

// ============================================================================
// Test Database Connection
// ============================================================================

/**
 * Create a test database connection pool
 * Uses DATABASE_URL_TEST environment variable
 */
function createTestPool(): Pool {
  const connectionString = process.env.DATABASE_URL_TEST;

  if (!connectionString) {
    throw new Error(
      "DATABASE_URL_TEST environment variable is required for integration tests.\n" +
      "Please set it in your .env file or environment."
    );
  }

  // Ensure we're not accidentally using the production database
  if (connectionString.includes("production") || connectionString.includes("prod")) {
    throw new Error(
      "Refusing to run tests against what appears to be a production database.\n" +
      "DATABASE_URL_TEST should point to a test database."
    );
  }

  return new Pool({
    connectionString,
    max: 5, // Limit connections for tests
  });
}

// Lazy initialization of test pool and db
let testPool: Pool | null = null;
let testDb: ReturnType<typeof drizzle<typeof schema>> | null = null;

/**
 * Get the test database instance
 * Lazily initialized on first call
 */
export function getTestDb() {
  if (!testDb) {
    testPool = createTestPool();
    testDb = drizzle(testPool, { schema });
  }
  return testDb;
}

/**
 * Close the test database connection
 * Should be called after all tests complete
 */
export async function closeTestDb() {
  if (testPool) {
    await testPool.end();
    testPool = null;
    testDb = null;
  }
}

// ============================================================================
// Database Cleanup
// ============================================================================

/**
 * Table names in dependency order (children first, parents last)
 * This ensures foreign key constraints are satisfied during deletion
 */
const TABLES_IN_DELETE_ORDER = [
  // Activity and notifications (no dependencies to other main tables)
  "activity_log",
  "notifications",

  // Evidences (depends on expenses and settlements)
  "evidences",

  // Settlements (depends on groups, group_members)
  "settlements",

  // Expense-related (most dependent)
  "expense_item_members",
  "expense_payers",
  "expense_items",
  "expense_sources",
  "expenses",

  // Group-related
  "leave_requests",
  "group_invites",
  "group_currencies",
  "group_members",
  "groups",

  // User-related
  "refresh_tokens",
  "user_auth_providers",
  "user_settings",
  "users",

  // Lookup tables (usually don't need to be cleaned)
  // "currencies",
  // "plans",
];

/**
 * Clean all test data from the database
 * Truncates tables in the correct order to respect foreign key constraints
 *
 * @param preserveLookupTables - If true, don't truncate lookup/enum tables (default: true)
 */
export async function cleanupTestData(preserveLookupTables = true) {
  const db = getTestDb();

  for (const tableName of TABLES_IN_DELETE_ORDER) {
    try {
      // Use TRUNCATE with CASCADE for faster cleanup
      await db.execute(sql.raw(`TRUNCATE TABLE "${tableName}" CASCADE`));
    } catch (error) {
      // Table might not exist in test database, which is fine
      const err = error as Error;
      if (!err.message.includes("does not exist")) {
        console.warn(`Warning: Could not truncate ${tableName}:`, err.message);
      }
    }
  }
}

/**
 * Delete specific test data by IDs
 * Useful for cleaning up after individual tests
 */
export async function deleteTestUser(userId: string) {
  const db = getTestDb();
  // Cascade will handle related records
  await db.execute(sql`DELETE FROM users WHERE id = ${userId}`);
}

export async function deleteTestGroup(groupId: string) {
  const db = getTestDb();
  // Cascade will handle related records
  await db.execute(sql`DELETE FROM groups WHERE id = ${groupId}`);
}

// ============================================================================
// Test Lifecycle Hooks
// ============================================================================

/**
 * Setup function to run before all tests in a file
 */
export async function beforeAllTests() {
  // Ensure test database is connected
  getTestDb();

  // Clean any stale test data
  await cleanupTestData();
}

/**
 * Cleanup function to run after all tests in a file
 */
export async function afterAllTests() {
  // Clean up test data
  await cleanupTestData();

  // Close database connection
  await closeTestDb();
}

/**
 * Cleanup function to run after each test
 * Can be used for per-test isolation
 */
export async function afterEachTest() {
  // Optionally clean up after each test for full isolation
  // Uncomment if needed:
  // await cleanupTestData();
}

// ============================================================================
// Test Utilities
// ============================================================================

/**
 * Generate a unique test identifier
 * Useful for creating unique emails, names, etc.
 */
export function testId(prefix = "test"): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
}

/**
 * Create a test email address
 */
export function testEmail(): string {
  return `${testId("user")}@test.divvyjones.local`;
}

/**
 * Wait for a specified number of milliseconds
 * Useful for testing time-dependent behavior
 */
export function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ============================================================================
// Exports for Test Files
// ============================================================================

export { schema };
export type TestDb = ReturnType<typeof getTestDb>;
