import { app } from "./app";

// ============================================================================
// Production Security Checks
// ============================================================================

// AC-0.3: JWT_SECRET is required in production
if (process.env.NODE_ENV === "production" && !process.env.JWT_SECRET) {
  throw new Error(
    "JWT_SECRET environment variable is required in production. " +
    "Please set a secure, random secret (minimum 32 characters recommended)."
  );
}

// ============================================================================
// Server Startup
// ============================================================================

const port = process.env.PORT || 3000;

app.listen(port, () => {
  console.log(`🚀 Divvy-Jones API running at http://localhost:${port}`);
  console.log(`📚 Swagger docs at http://localhost:${port}/swagger`);
});
