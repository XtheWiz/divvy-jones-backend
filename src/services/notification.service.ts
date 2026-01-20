import { eq, and, desc, count } from "drizzle-orm";
import {
  db,
  notifications,
  type Notification,
  type NewNotification,
  NOTIFICATION_TYPES,
  type NotificationType,
} from "../db";

// ============================================================================
// Constants
// ============================================================================

export { NOTIFICATION_TYPES };

// ============================================================================
// Types
// ============================================================================

export interface NotificationListItem {
  id: string;
  type: NotificationType;
  title: string;
  body: string | null;
  data: unknown;
  referenceId: string | null;
  referenceType: string | null;
  isRead: boolean;
  readAt: Date | null;
  createdAt: Date;
}

export interface NotificationListResult {
  notifications: NotificationListItem[];
  unreadCount: number;
  total: number;
}

export interface CreateNotificationInput {
  userId: string;
  type: NotificationType;
  title: string;
  body?: string;
  data?: Record<string, unknown>;
  referenceId?: string;
  referenceType?: string;
}

// ============================================================================
// Notification Service Functions
// ============================================================================

/**
 * Create a notification
 */
export async function createNotification(
  input: CreateNotificationInput
): Promise<Notification> {
  const [notification] = await db
    .insert(notifications)
    .values({
      userId: input.userId,
      type: input.type,
      title: input.title,
      body: input.body || null,
      data: input.data || null,
      referenceId: input.referenceId || null,
      referenceType: input.referenceType || null,
      isRead: false,
    })
    .returning();

  return notification;
}

/**
 * List notifications for a user
 * AC-2.7: GET /notifications - list user's notifications
 * AC-2.8: Paginated response with unread count
 */
export async function listNotifications(
  userId: string,
  options: { page?: number; limit?: number } = {}
): Promise<NotificationListResult> {
  const page = options.page || 1;
  const limit = Math.min(options.limit || 20, 100);
  const offset = (page - 1) * limit;

  // Get total count
  const [totalResult] = await db
    .select({ count: count() })
    .from(notifications)
    .where(eq(notifications.userId, userId));

  const total = totalResult?.count || 0;

  // Get unread count (total unread, not just current page)
  const [unreadResult] = await db
    .select({ count: count() })
    .from(notifications)
    .where(
      and(
        eq(notifications.userId, userId),
        eq(notifications.isRead, false)
      )
    );

  const unreadCount = unreadResult?.count || 0;

  // Get notifications (sorted by created date, newest first)
  const notificationList = await db
    .select({
      id: notifications.id,
      type: notifications.type,
      title: notifications.title,
      body: notifications.body,
      data: notifications.data,
      referenceId: notifications.referenceId,
      referenceType: notifications.referenceType,
      isRead: notifications.isRead,
      readAt: notifications.readAt,
      createdAt: notifications.createdAt,
    })
    .from(notifications)
    .where(eq(notifications.userId, userId))
    .orderBy(desc(notifications.createdAt))
    .limit(limit)
    .offset(offset);

  return {
    notifications: notificationList.map((n) => ({
      id: n.id,
      type: n.type as NotificationType,
      title: n.title,
      body: n.body,
      data: n.data,
      referenceId: n.referenceId,
      referenceType: n.referenceType,
      isRead: n.isRead,
      readAt: n.readAt,
      createdAt: n.createdAt,
    })),
    unreadCount,
    total,
  };
}

/**
 * Get a single notification
 */
export async function getNotification(
  notificationId: string,
  userId: string
): Promise<Notification | null> {
  const [notification] = await db
    .select()
    .from(notifications)
    .where(
      and(
        eq(notifications.id, notificationId),
        eq(notifications.userId, userId)
      )
    )
    .limit(1);

  return notification || null;
}

/**
 * Mark a notification as read
 * AC-2.9: PUT /notifications/:id/read - mark as read
 */
export async function markAsRead(
  notificationId: string,
  userId: string
): Promise<{ success: boolean; error?: string }> {
  const notification = await getNotification(notificationId, userId);
  if (!notification) {
    return { success: false, error: "Notification not found" };
  }

  if (notification.isRead) {
    // Already read, return success
    return { success: true };
  }

  await db
    .update(notifications)
    .set({
      isRead: true,
      readAt: new Date(),
    })
    .where(
      and(
        eq(notifications.id, notificationId),
        eq(notifications.userId, userId)
      )
    );

  return { success: true };
}

/**
 * Mark all notifications as read
 * AC-2.10: PUT /notifications/read-all - mark all as read
 */
export async function markAllAsRead(userId: string): Promise<{ count: number }> {
  const now = new Date();

  // Update all unread notifications for the user
  const result = await db
    .update(notifications)
    .set({
      isRead: true,
      readAt: now,
    })
    .where(
      and(
        eq(notifications.userId, userId),
        eq(notifications.isRead, false)
      )
    )
    .returning({ id: notifications.id });

  return { count: result.length };
}

/**
 * Get unread count for a user
 */
export async function getUnreadCount(userId: string): Promise<number> {
  const [result] = await db
    .select({ count: count() })
    .from(notifications)
    .where(
      and(
        eq(notifications.userId, userId),
        eq(notifications.isRead, false)
      )
    );

  return result?.count || 0;
}

// ============================================================================
// Settlement Notification Helpers
// ============================================================================

/**
 * Create notification for settlement request
 * AC-2.4: Payee notified when settlement is requested
 */
export async function notifySettlementRequested(
  payeeUserId: string,
  payerDisplayName: string,
  amount: number,
  currency: string,
  settlementId: string
): Promise<Notification> {
  return createNotification({
    userId: payeeUserId,
    type: "settlement_requested",
    title: `${payerDisplayName} requested a settlement`,
    body: `${payerDisplayName} wants to pay you ${currency} ${amount.toFixed(2)}`,
    data: { amount, currency, payerDisplayName },
    referenceId: settlementId,
    referenceType: "settlement",
  });
}

/**
 * Create notification for settlement confirmation
 * AC-2.5: Payer notified when settlement is confirmed
 */
export async function notifySettlementConfirmed(
  payerUserId: string,
  payeeDisplayName: string,
  amount: number,
  currency: string,
  settlementId: string
): Promise<Notification> {
  return createNotification({
    userId: payerUserId,
    type: "settlement_confirmed",
    title: `${payeeDisplayName} confirmed your settlement`,
    body: `Your payment of ${currency} ${amount.toFixed(2)} to ${payeeDisplayName} has been confirmed`,
    data: { amount, currency, payeeDisplayName },
    referenceId: settlementId,
    referenceType: "settlement",
  });
}

/**
 * Create notification for settlement rejection
 * AC-2.6: Payer notified when settlement is rejected
 */
export async function notifySettlementRejected(
  payerUserId: string,
  payeeDisplayName: string,
  amount: number,
  currency: string,
  settlementId: string,
  reason?: string
): Promise<Notification> {
  return createNotification({
    userId: payerUserId,
    type: "settlement_rejected",
    title: `${payeeDisplayName} rejected your settlement`,
    body: reason
      ? `Your payment of ${currency} ${amount.toFixed(2)} was rejected: ${reason}`
      : `Your payment of ${currency} ${amount.toFixed(2)} to ${payeeDisplayName} was rejected`,
    data: { amount, currency, payeeDisplayName, reason },
    referenceId: settlementId,
    referenceType: "settlement",
  });
}
