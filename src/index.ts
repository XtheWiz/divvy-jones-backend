import { app } from "./app";

// ============================================================================
// Server Startup
// ============================================================================

const port = process.env.PORT || 3000;

app.listen(port, () => {
  console.log(`🚀 Divvy-Jones API running at http://localhost:${port}`);
  console.log(`📚 Swagger docs at http://localhost:${port}/swagger`);
});
