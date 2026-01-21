import { Elysia } from "elysia";
import { authRoutes } from "./auth";
import { userRoutes } from "./users";
import { groupRoutes } from "./groups";
import { expenseRoutes } from "./expenses";
import { settlementRoutes } from "./settlements";
import { notificationRoutes } from "./notifications";
import {
  expenseAttachmentRoutes,
  settlementAttachmentRoutes,
} from "./attachments";
import { activityRoutes } from "./activity";
import { currencyRoutes } from "./currencies";
import { exportRoutes } from "./export";
import { analyticsRoutes } from "./analytics";
import { recurringExpenseRoutes } from "./recurring";
import { adminRoutes } from "./admin";

export const routes = new Elysia({ prefix: "/v1" })
  .get("/", () => ({
    success: true,
    data: {
      message: "Welcome to Divvy-Jones API v1",
      version: "0.1.0",
    },
  }))
  .use(authRoutes)
  .use(userRoutes)
  .use(groupRoutes)
  .use(expenseRoutes)
  .use(settlementRoutes)
  .use(notificationRoutes)
  .use(expenseAttachmentRoutes)
  .use(settlementAttachmentRoutes)
  .use(activityRoutes)
  .use(currencyRoutes)
  .use(exportRoutes)
  .use(analyticsRoutes)
  .use(recurringExpenseRoutes)
  .use(adminRoutes);
