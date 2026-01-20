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
      documentation: {
        info: {
          title: "Divvy-Jones API",
          version: "0.1.0",
          description: "Expense splitting application API",
        },
        tags: [
          { name: "Health", description: "Health check endpoints" },
          { name: "Auth", description: "Authentication endpoints" },
          { name: "Users", description: "User management endpoints" },
          { name: "Groups", description: "Group management endpoints" },
          { name: "Currencies", description: "Currency and exchange rate endpoints" },
          { name: "Export", description: "Data export endpoints" },
        ],
      },
    })
  )
  .get("/health", () => ({ status: "ok", timestamp: new Date().toISOString() }), {
    detail: {
      tags: ["Health"],
      summary: "Health check",
      description: "Check if the API is running",
    },
  })
  .use(routes);

export type App = typeof app;
