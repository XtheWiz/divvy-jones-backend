import { Elysia } from "elysia";
import { swagger } from "@elysiajs/swagger";
import { routes } from "./routes";
import { ErrorCodes, error as errorResponse } from "./lib/responses";
import { logger } from "./lib/logger";

// Default allowed origins for development and production
const DEFAULT_CORS_ORIGINS = [
  'http://localhost:3000',
  'http://localhost:8080',
  'http://localhost:5000',
  'http://127.0.0.1:3000',
  'http://127.0.0.1:8080',
  'http://127.0.0.1:5000',
  'https://divvy-jones.vercel.app',
  'https://web-jet-six-68.vercel.app',
];

// Manual CORS middleware since @elysiajs/cors isn't setting Access-Control-Allow-Origin
const corsMiddleware = new Elysia()
  .derive(({ request }) => {
    const origin = request.headers.get('origin');
    const allowedOrigins = (process.env.CORS_ORIGINS?.split(',') || DEFAULT_CORS_ORIGINS)
      .map((o) => o.replace(/\/+$/, ''));

    // Normalize origin by stripping trailing slashes before comparison
    // Never allow wildcard with credentials (violates CORS spec)
    let allowOrigin = '';
    const normalizedOrigin = origin?.replace(/\/+$/, '');
    if (origin && normalizedOrigin && allowedOrigins.includes(normalizedOrigin)) {
      allowOrigin = origin;
    }

    return { corsOrigin: allowOrigin };
  })
  .onAfterHandle(({ set, corsOrigin }) => {
    if (corsOrigin) {
      set.headers['Access-Control-Allow-Origin'] = corsOrigin;
      set.headers['Access-Control-Allow-Credentials'] = 'true';
      set.headers['Access-Control-Allow-Methods'] = 'GET, POST, PUT, DELETE, PATCH, OPTIONS';
      set.headers['Access-Control-Allow-Headers'] = 'Content-Type, Authorization';
    }
  })
  .options('*', ({ set, corsOrigin }) => {
    if (corsOrigin) {
      set.headers['Access-Control-Allow-Origin'] = corsOrigin;
      set.headers['Access-Control-Allow-Credentials'] = 'true';
      set.headers['Access-Control-Allow-Methods'] = 'GET, POST, PUT, DELETE, PATCH, OPTIONS';
      set.headers['Access-Control-Allow-Headers'] = 'Content-Type, Authorization';
      set.headers['Access-Control-Max-Age'] = '86400';
    }
    set.status = 204;
    return '';
  });

export const app = new Elysia()
  .use(corsMiddleware)
  .onRequest(({ request }) => {
    logger.debug("HTTP request", {
      method: request.method,
      path: new URL(request.url).pathname,
      userAgent: request.headers.get("user-agent") || undefined,
    });
  })
  .onAfterHandle(({ request, set }) => {
    logger.debug("HTTP response", {
      method: request.method,
      path: new URL(request.url).pathname,
      status: set.status || 200,
    });
  })
  .onError(({ code, error, request, set }) => {
    const requestId = crypto.randomUUID();
    const isProduction = process.env.NODE_ENV === "production";
    const status = code === "NOT_FOUND" ? 404 : 500;
    const message =
      status === 404
        ? "Route not found"
        : isProduction
          ? "Internal server error"
          : error instanceof Error
            ? error.message
            : String(error);

    set.status = status;
    set.headers["x-request-id"] = requestId;

    logger.error("HTTP request failed", {
      requestId,
      code,
      method: request.method,
      path: new URL(request.url).pathname,
      status,
      error: error instanceof Error ? error.message : String(error),
      stack: !isProduction && error instanceof Error ? error.stack : undefined,
    });

    return errorResponse(
      status === 404 ? ErrorCodes.NOT_FOUND : ErrorCodes.INTERNAL_ERROR,
      message,
      isProduction ? { requestId } : { requestId, code }
    );
  })
  .use(
    swagger({
      path: "/swagger",
      documentation: {
        info: {
          title: "Divvy-Jones API",
          version: "1.0.0",
          description: `
# Divvy-Jones API

A comprehensive expense splitting application API for managing shared expenses among groups.

## Features
- **Authentication**: JWT-based auth with email/password and OAuth (Google)
- **Groups**: Create and manage expense groups with join codes
- **Expenses**: Track shared expenses with flexible splitting options
- **Settlements**: Record and confirm debt payments
- **Recurring Expenses**: Set up automatic recurring expense rules
- **Analytics**: Spending summaries, category breakdowns, and trends
- **Multi-currency**: Support for multiple currencies with exchange rates

## Authentication
Most endpoints require authentication via Bearer token:
\`\`\`
Authorization: Bearer <access_token>
\`\`\`

Access tokens expire after 15 minutes. Use the refresh token endpoint to get new tokens.

## Rate Limiting
Auth endpoints are rate limited to 5 requests per minute per IP.
          `.trim(),
          contact: {
            name: "Divvy-Jones Support",
            email: "support@divvy-jones.app",
          },
          license: {
            name: "MIT",
            url: "https://opensource.org/licenses/MIT",
          },
        },
        servers: [
          { url: "http://localhost:3000", description: "Local development" },
        ],
        tags: [
          { name: "Health", description: "Health check endpoints" },
          { name: "Auth", description: "Authentication and authorization" },
          { name: "Users", description: "User profile and settings management" },
          { name: "Groups", description: "Group creation, membership, and management" },
          { name: "Expenses", description: "Expense tracking and management" },
          { name: "Settlements", description: "Debt settlement workflow" },
          { name: "Recurring", description: "Recurring expense rules" },
          { name: "Analytics", description: "Spending analytics and reports" },
          { name: "Balances", description: "Balance calculations and debt optimization" },
          { name: "Currencies", description: "Currency and exchange rate endpoints" },
          { name: "Notifications", description: "User notifications" },
          { name: "Activity", description: "Activity logs and audit trails" },
          { name: "Attachments", description: "File attachments for expenses/settlements" },
          { name: "Comments", description: "Comments on expenses and settlements" },
          { name: "Reactions", description: "Reactions to expenses and settlements" },
          { name: "Export", description: "Data export endpoints" },
          { name: "Admin", description: "Administrative endpoints" },
        ],
        components: {
          securitySchemes: {
            bearerAuth: {
              type: "http",
              scheme: "bearer",
              bearerFormat: "JWT",
              description: "JWT access token obtained from login or refresh endpoints",
            },
          },
        },
        security: [{ bearerAuth: [] }],
      },
    })
  )
  .get("/health", () => ({ status: "ok", timestamp: new Date().toISOString() }), {
    detail: {
      tags: ["Health"],
      summary: "Health check",
      description: "Check if the API is running and responsive",
      security: [],
    },
  })
  .use(routes);

export type App = typeof app;
