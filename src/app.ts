import { Elysia } from "elysia";
import { cors } from "@elysiajs/cors";
import { swagger } from "@elysiajs/swagger";
import { routes } from "./routes";

export const app = new Elysia()
  .use(
    cors({
      origin: process.env.CORS_ORIGINS?.split(",") || ["http://localhost:3000"],
      credentials: true,
    })
  )
  .use(
    swagger({
      path: "/docs",
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
      swagger: {
        displayOperationId: false,
        docExpansion: "list",
        filter: true,
        syntaxHighlight: {
          theme: "monokai",
        },
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
