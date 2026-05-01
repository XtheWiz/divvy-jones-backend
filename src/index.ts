import { app } from "./app";

// ============================================================================
// Server Startup
// ============================================================================

const port = process.env.PORT || 3000;
const hostname = process.env.HOST || "0.0.0.0";

app.listen({ port, hostname }, () => {
  console.log(`🚀 Divvy-Jones API running at http://${hostname}:${port}`);
  console.log(`🔗 Local API URL: http://localhost:${port}`);
  console.log(`📚 Swagger docs at http://localhost:${port}/swagger`);
});
