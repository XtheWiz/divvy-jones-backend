import { Elysia, t } from "elysia";
import { success, error, ErrorCodes, paginated } from "../lib/responses";
import { requireAuth } from "../middleware/auth";
import {
  listNotifications,
  markAsRead,
  markAllAsRead,
} from "../services/notification.service";

// ============================================================================
// Request/Response Schemas
// ============================================================================

const listNotificationsSchema = {
  query: t.Object({
    page: t.Optional(t.Numeric()),
    limit: t.Optional(t.Numeric()),
  }),
};

const notificationIdSchema = {
  params: t.Object({
    id: t.String(),
  }),
};

// ============================================================================
// Notification Routes
// ============================================================================

export const notificationRoutes = new Elysia({ prefix: "/notifications" })
  .use(requireAuth)

  // ========================================================================
  // PUT /notifications/read-all - Mark All as Read
  // AC-2.10
  // Note: This must come before /:id to avoid route conflicts
  // ========================================================================
  .put(
    "/read-all",
    async ({ auth, authError, set }) => {
      if (!auth) {
        set.status = 401;
        return authError;
      }

      const result = await markAllAsRead(auth.userId);

      return success({
        message: `Marked ${result.count} notification(s) as read`,
        count: result.count,
      });
    }
  )

  // ========================================================================
  // GET /notifications - List Notifications
  // AC-2.7, AC-2.8
  // ========================================================================
  .get(
    "/",
    async ({ query, auth, authError, set }) => {
      if (!auth) {
        set.status = 401;
        return authError;
      }

      const page = query.page || 1;
      const limit = Math.min(query.limit || 20, 100);

      const result = await listNotifications(auth.userId, { page, limit });

      const totalPages = Math.ceil(result.total / limit);

      // Include unreadCount in response (AC-2.8)
      return {
        success: true,
        data: {
          notifications: result.notifications,
          pagination: {
            page,
            limit,
            total: result.total,
            totalPages,
          },
          unreadCount: result.unreadCount,
        },
      };
    },
    listNotificationsSchema
  )

  // ========================================================================
  // PUT /notifications/:id/read - Mark as Read
  // AC-2.9
  // ========================================================================
  .put(
    "/:id/read",
    async ({ params, auth, authError, set }) => {
      if (!auth) {
        set.status = 401;
        return authError;
      }

      const result = await markAsRead(params.id, auth.userId);

      if (!result.success) {
        set.status = 404;
        return error(ErrorCodes.NOT_FOUND, result.error!);
      }

      return success({ message: "Notification marked as read" });
    },
    notificationIdSchema
  );
