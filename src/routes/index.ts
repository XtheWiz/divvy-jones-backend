import { Elysia } from "elysia";
import { authRoutes } from "./auth";
import { userRoutes } from "./users";
// import { groupRoutes } from "./groups";

export const routes = new Elysia({ prefix: "/v1" })
  .get("/", () => ({
    success: true,
    data: {
      message: "Welcome to Divvy-Jones API v1",
      version: "0.1.0",
    },
  }))
  .use(authRoutes)
  .use(userRoutes);

// Routes will be added as they are implemented:
// .use(groupRoutes)
