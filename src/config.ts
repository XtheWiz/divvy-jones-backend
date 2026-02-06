/**
 * Centralized Configuration
 *
 * Validates all required environment variables at startup and exports
 * typed configuration. Fails fast with clear error messages.
 */

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Required environment variable ${name} is not set`);
  }
  return value;
}

function optionalEnv(name: string, defaultValue: string): string {
  return process.env[name] || defaultValue;
}

function optionalEnvInt(name: string, defaultValue: number): number {
  const value = process.env[name];
  if (!value) return defaultValue;
  const parsed = parseInt(value, 10);
  return isNaN(parsed) ? defaultValue : parsed;
}

// ============================================================================
// Validate and export configuration
// ============================================================================

export const config = {
  /** Node environment */
  nodeEnv: optionalEnv("NODE_ENV", "development"),

  /** Server port */
  port: optionalEnvInt("PORT", 3000),

  /** Database connection string */
  databaseUrl: requireEnv("DATABASE_URL"),

  /** JWT configuration */
  jwt: {
    secret: requireEnv("JWT_SECRET"),
    accessExpiry: optionalEnv("JWT_ACCESS_EXPIRY", "15m"),
  },

  /** CORS allowed origins */
  corsOrigins: process.env.CORS_ORIGINS?.split(",") || undefined,

  /** Whether to trust proxy headers (X-Forwarded-For, etc.) */
  trustProxy: process.env.TRUST_PROXY === "true",

  /** Storage configuration */
  storage: {
    provider: optionalEnv("STORAGE_PROVIDER", "local") as "local" | "s3",
    localPath: optionalEnv("STORAGE_LOCAL_PATH", "./uploads"),
  },

  /** Admin API key (optional - disables admin endpoints if not set) */
  adminApiKey: process.env.ADMIN_API_KEY || undefined,

  /** App URL for building links in emails */
  appUrl: optionalEnv("APP_URL", "http://localhost:3000"),

  /** Frontend URL for building links in emails */
  frontendUrl: optionalEnv("FRONTEND_URL", "http://localhost:5173"),
} as const;
