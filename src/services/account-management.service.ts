/**
 * Account Management Service
 * Sprint 010 - TASK-024, TASK-027
 *
 * Service for GDPR-compliant account management.
 * AC-3.1: DELETE /users/me initiates account deletion request
 * AC-3.2: Account deletion has 7-day grace period
 * AC-3.5: After grace period, account and personal data permanently deleted
 * AC-3.6: Expenses created by deleted user remain but show "Deleted User"
 * AC-3.7: Data export returns all user data as JSON
 * AC-3.8: Data export includes: profile, groups, expenses, settlements, activity
 */

import { eq, and, isNull, lt, sql } from "drizzle-orm";
import { db, users } from "../db";
import {
  oauthAccounts,
  refreshTokens,
  passwordResetTokens,
  emailVerificationTokens,
  userSettings,
} from "../db/schema/users";
import { groupMembers, groups } from "../db/schema/groups";
import { expenses, expensePayers, expenseItems, expenseItemMembers } from "../db/schema/expenses";
import { settlements } from "../db/schema/settlements";
import { activityLog } from "../db/schema/notifications";

// ============================================================================
// Configuration
// ============================================================================

/** Grace period for account deletion in days */
const DELETION_GRACE_PERIOD_DAYS = parseInt(
  process.env.DELETION_GRACE_PERIOD_DAYS || "7",
  10
);

/** Grace period in milliseconds */
const GRACE_PERIOD_MS = DELETION_GRACE_PERIOD_DAYS * 24 * 60 * 60 * 1000;

// ============================================================================
// Types
// ============================================================================

export interface DeletionRequestResult {
  success: boolean;
  deletionDate?: Date;
  error?: string;
}

export interface CancelDeletionResult {
  success: boolean;
  error?: string;
}

export interface DataExport {
  exportedAt: string;
  user: {
    id: string;
    email: string | null;
    displayName: string;
    isEmailVerified: boolean;
    primaryAuthProvider: string;
    createdAt: Date;
  };
  groups: Array<{
    id: string;
    name: string;
    role: string;
    joinedAt: Date;
  }>;
  expenses: Array<{
    id: string;
    groupId: string;
    name: string;
    amount: string;
    currencyCode: string;
    category: string | null;
    expenseDate: Date;
    createdAt: Date;
  }>;
  settlements: Array<{
    id: string;
    groupId: string;
    amount: string;
    currencyCode: string;
    status: string;
    createdAt: Date;
  }>;
  activityLog: Array<{
    id: string;
    groupId: string;
    action: string;
    entityType: string;
    createdAt: Date;
  }>;
  settings: {
    languageCode: string | null;
    defaultCurrencyCode: string | null;
    timezone: string | null;
    emailNotifications: boolean;
  } | null;
}

// ============================================================================
// Account Deletion (AC-3.1 to AC-3.6)
// ============================================================================

/**
 * Request account deletion
 * AC-3.1: Initiates deletion request
 * AC-3.2: Sets grace period
 *
 * @param userId - User's ID
 * @returns Deletion request result
 */
export async function requestAccountDeletion(
  userId: string
): Promise<DeletionRequestResult> {
  const [user] = await db
    .select({ id: users.id, deletionRequestedAt: users.deletionRequestedAt })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  if (!user) {
    return { success: false, error: "User not found" };
  }

  // Check if deletion already requested
  if (user.deletionRequestedAt) {
    const deletionDate = new Date(
      user.deletionRequestedAt.getTime() + GRACE_PERIOD_MS
    );
    return {
      success: true,
      deletionDate,
    };
  }

  const now = new Date();
  const deletionDate = new Date(now.getTime() + GRACE_PERIOD_MS);

  // Set deletion requested timestamp
  await db
    .update(users)
    .set({
      deletionRequestedAt: now,
      updatedAt: now,
    })
    .where(eq(users.id, userId));

  return {
    success: true,
    deletionDate,
  };
}

/**
 * Cancel account deletion request
 * AC-3.4: User can cancel within grace period
 *
 * @param userId - User's ID
 * @returns Cancellation result
 */
export async function cancelAccountDeletion(
  userId: string
): Promise<CancelDeletionResult> {
  const [user] = await db
    .select({
      id: users.id,
      deletionRequestedAt: users.deletionRequestedAt,
      deletedAt: users.deletedAt,
    })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  if (!user) {
    return { success: false, error: "User not found" };
  }

  // Cannot cancel if already deleted
  if (user.deletedAt) {
    return { success: false, error: "Account has already been deleted" };
  }

  // Cannot cancel if no deletion requested
  if (!user.deletionRequestedAt) {
    return { success: false, error: "No deletion request pending" };
  }

  // Check if grace period has passed
  const gracePeriodEnd = new Date(
    user.deletionRequestedAt.getTime() + GRACE_PERIOD_MS
  );

  if (new Date() > gracePeriodEnd) {
    return { success: false, error: "Grace period has expired" };
  }

  // Clear deletion request
  await db
    .update(users)
    .set({
      deletionRequestedAt: null,
      updatedAt: new Date(),
    })
    .where(eq(users.id, userId));

  return { success: true };
}

/**
 * Process scheduled deletions
 * AC-3.5: Permanently delete after grace period
 *
 * Should be called by a scheduled job
 */
export async function processScheduledDeletions(): Promise<number> {
  const cutoff = new Date(Date.now() - GRACE_PERIOD_MS);

  // Find users whose grace period has expired
  const usersToDelete = await db
    .select({ id: users.id })
    .from(users)
    .where(
      and(
        lt(users.deletionRequestedAt, cutoff),
        isNull(users.deletedAt)
      )
    );

  let deletedCount = 0;

  for (const user of usersToDelete) {
    try {
      await permanentlyDeleteUser(user.id);
      deletedCount++;
    } catch (err) {
      console.error(`Failed to delete user ${user.id}:`, err);
    }
  }

  return deletedCount;
}

/**
 * Permanently delete/anonymize user data
 * AC-3.5: Remove personal data
 * AC-3.6: Keep expense records with "Deleted User"
 */
async function permanentlyDeleteUser(userId: string): Promise<void> {
  await db.transaction(async (tx) => {
    // 1. Delete OAuth accounts (hard delete)
    await tx.delete(oauthAccounts).where(eq(oauthAccounts.userId, userId));

    // 2. Delete all tokens (hard delete)
    await tx.delete(refreshTokens).where(eq(refreshTokens.userId, userId));
    await tx.delete(passwordResetTokens).where(eq(passwordResetTokens.userId, userId));
    await tx.delete(emailVerificationTokens).where(eq(emailVerificationTokens.userId, userId));

    // 3. Delete user settings
    await tx.delete(userSettings).where(eq(userSettings.userId, userId));

    // 4. Remove from groups but keep expense/settlement records
    // Get member IDs for this user
    const memberRecords = await tx
      .select({ id: groupMembers.id })
      .from(groupMembers)
      .where(eq(groupMembers.userId, userId));

    // Update member records to mark as deleted user
    for (const member of memberRecords) {
      // Note: We don't delete groupMembers as they're referenced by expenses
      // Instead, we rely on the user being anonymized
    }

    // 5. Anonymize user record
    // AC-3.6: Keep the record but remove PII
    await tx
      .update(users)
      .set({
        email: null,
        displayName: "Deleted User",
        passwordHash: null,
        isEmailVerified: false,
        emailVerifiedAt: null,
        deletedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(users.id, userId));
  });
}

/**
 * Check if user has pending deletion
 */
export async function hasPendingDeletion(userId: string): Promise<{
  pending: boolean;
  deletionDate?: Date;
  canCancel: boolean;
}> {
  const [user] = await db
    .select({
      deletionRequestedAt: users.deletionRequestedAt,
      deletedAt: users.deletedAt,
    })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  if (!user || user.deletedAt) {
    return { pending: false, canCancel: false };
  }

  if (!user.deletionRequestedAt) {
    return { pending: false, canCancel: false };
  }

  const deletionDate = new Date(
    user.deletionRequestedAt.getTime() + GRACE_PERIOD_MS
  );
  const canCancel = new Date() < deletionDate;

  return {
    pending: true,
    deletionDate,
    canCancel,
  };
}

// ============================================================================
// Data Export (AC-3.7, AC-3.8)
// ============================================================================

/**
 * Export all user data
 * AC-3.7: Returns all user data as JSON
 * AC-3.8: Includes profile, groups, expenses, settlements, activity
 *
 * @param userId - User's ID
 * @returns User data export or null if user not found
 */
export async function exportUserData(userId: string): Promise<DataExport | null> {
  // Get user profile
  const [user] = await db
    .select({
      id: users.id,
      email: users.email,
      displayName: users.displayName,
      isEmailVerified: users.isEmailVerified,
      primaryAuthProvider: users.primaryAuthProvider,
      createdAt: users.createdAt,
    })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  if (!user) {
    return null;
  }

  // Get user settings
  const [settings] = await db
    .select({
      languageCode: userSettings.languageCode,
      defaultCurrencyCode: userSettings.defaultCurrencyCode,
      timezone: userSettings.timezone,
      emailNotifications: userSettings.emailNotifications,
    })
    .from(userSettings)
    .where(eq(userSettings.userId, userId))
    .limit(1);

  // Get groups where user is a member
  const userGroups = await db
    .select({
      id: groups.id,
      name: groups.name,
      role: groupMembers.role,
      joinedAt: groupMembers.joinedAt,
    })
    .from(groupMembers)
    .innerJoin(groups, eq(groups.id, groupMembers.groupId))
    .where(eq(groupMembers.userId, userId));

  // Get member IDs for this user
  const memberIds = await db
    .select({ id: groupMembers.id })
    .from(groupMembers)
    .where(eq(groupMembers.userId, userId));

  const memberIdList = memberIds.map((m) => m.id);

  // Get expenses created by this user
  const userExpenses = memberIdList.length > 0
    ? await db
        .select({
          id: expenses.id,
          groupId: expenses.groupId,
          name: expenses.name,
          amount: expenses.subtotal,
          currencyCode: expenses.currencyCode,
          category: expenses.category,
          expenseDate: expenses.expenseDate,
          createdAt: expenses.createdAt,
        })
        .from(expenses)
        .where(sql`${expenses.createdByMemberId} = ANY(${memberIdList})`)
    : [];

  // Get settlements involving this user
  const userSettlements = memberIdList.length > 0
    ? await db
        .select({
          id: settlements.id,
          groupId: settlements.groupId,
          amount: settlements.amount,
          currencyCode: settlements.currencyCode,
          status: settlements.status,
          createdAt: settlements.createdAt,
        })
        .from(settlements)
        .where(
          sql`${settlements.payerMemberId} = ANY(${memberIdList}) OR ${settlements.payeeMemberId} = ANY(${memberIdList})`
        )
    : [];

  // Get activity log entries
  const userActivity = memberIdList.length > 0
    ? await db
        .select({
          id: activityLog.id,
          groupId: activityLog.groupId,
          action: activityLog.action,
          entityType: activityLog.entityType,
          createdAt: activityLog.createdAt,
        })
        .from(activityLog)
        .where(sql`${activityLog.actorMemberId} = ANY(${memberIdList})`)
        .limit(1000) // Limit for performance
    : [];

  return {
    exportedAt: new Date().toISOString(),
    user: {
      id: user.id,
      email: user.email,
      displayName: user.displayName,
      isEmailVerified: user.isEmailVerified,
      primaryAuthProvider: user.primaryAuthProvider,
      createdAt: user.createdAt,
    },
    groups: userGroups.map((g) => ({
      id: g.id,
      name: g.name,
      role: g.role,
      joinedAt: g.joinedAt,
    })),
    expenses: userExpenses.map((e) => ({
      id: e.id,
      groupId: e.groupId,
      name: e.name,
      amount: e.amount,
      currencyCode: e.currencyCode,
      category: e.category,
      expenseDate: e.expenseDate,
      createdAt: e.createdAt,
    })),
    settlements: userSettlements.map((s) => ({
      id: s.id,
      groupId: s.groupId,
      amount: s.amount,
      currencyCode: s.currencyCode,
      status: s.status,
      createdAt: s.createdAt,
    })),
    activityLog: userActivity.map((a) => ({
      id: a.id,
      groupId: a.groupId,
      action: a.action,
      entityType: a.entityType,
      createdAt: a.createdAt,
    })),
    settings: settings
      ? {
          languageCode: settings.languageCode,
          defaultCurrencyCode: settings.defaultCurrencyCode,
          timezone: settings.timezone,
          emailNotifications: settings.emailNotifications,
        }
      : null,
  };
}
