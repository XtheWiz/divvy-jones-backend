/**
 * Test Setup - Preload File
 *
 * This file is loaded before any tests run to ensure real modules
 * are imported before any mock.module() calls can pollute the cache.
 *
 * Usage: bun test --preload ./src/__tests__/setup.ts
 */

// Import real modules first to prevent mock pollution
// These imports cache the real implementations before any test file
// can call mock.module() on them

import "../services/auth.service";
import "bcryptjs";
import "nanoid";

// Export a flag to indicate setup is complete
export const setupComplete = true;
