import { Elysia } from "elysia";

// Route modules will be imported here as they are created
// import { authRoutes } from "./auth";
// import { userRoutes } from "./users";
// import { groupRoutes } from "./groups";

export const routes = new Elysia({ prefix: "/v1" })
  // Placeholder routes - will be replaced with actual route modules
  .get("/", () => ({
    success: true,
    data: {
      message: "Welcome to Divvy-Jones API v1",
      version: "0.1.0",
    },
  }));

// Routes will be added as they are implemented:
// .use(authRoutes)
// .use(userRoutes)
// .use(groupRoutes)
