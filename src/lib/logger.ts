/**
 * Structured Logger
 *
 * Lightweight JSON logger for production observability.
 * Outputs structured JSON in production, readable format in development.
 */

type LogLevel = "debug" | "info" | "warn" | "error";

const LEVEL_ORDER: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

const minLevel: LogLevel =
  (process.env.LOG_LEVEL as LogLevel) || (process.env.NODE_ENV === "production" ? "info" : "debug");

function shouldLog(level: LogLevel): boolean {
  return LEVEL_ORDER[level] >= LEVEL_ORDER[minLevel];
}

function formatLog(level: LogLevel, message: string, context?: Record<string, unknown>): string {
  const entry = {
    timestamp: new Date().toISOString(),
    level,
    message,
    ...context,
  };

  if (process.env.NODE_ENV === "production") {
    return JSON.stringify(entry);
  }

  // Readable format for development
  const prefix = `[${entry.timestamp}] ${level.toUpperCase()}:`;
  if (context && Object.keys(context).length > 0) {
    return `${prefix} ${message} ${JSON.stringify(context)}`;
  }
  return `${prefix} ${message}`;
}

export const logger = {
  debug(message: string, context?: Record<string, unknown>) {
    if (shouldLog("debug")) console.debug(formatLog("debug", message, context));
  },

  info(message: string, context?: Record<string, unknown>) {
    if (shouldLog("info")) console.info(formatLog("info", message, context));
  },

  warn(message: string, context?: Record<string, unknown>) {
    if (shouldLog("warn")) console.warn(formatLog("warn", message, context));
  },

  error(message: string, context?: Record<string, unknown>) {
    if (shouldLog("error")) console.error(formatLog("error", message, context));
  },
};
