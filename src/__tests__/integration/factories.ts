/**
 * Test Data Factories
 * Sprint 003 - TASK-012
 *
 * Provides factory functions for creating test data in the database.
 * Each factory returns the created record with its ID for use in tests.
 */

import { eq } from "drizzle-orm";
import { getTestDb, testId, testEmail, schema } from "./setup";
import * as bcrypt from "bcryptjs";

// ============================================================================
// Types
// ============================================================================

interface CreateTestUserOptions {
  email?: string;
  displayName?: string;
  password?: string;
}

interface CreateTestGroupOptions {
  name?: string;
  defaultCurrencyCode?: string;
}

interface CreateTestExpenseOptions {
  name?: string;
  amount?: number;
  currencyCode?: string;
  category?: string;
}

interface CreateTestSettlementOptions {
  amount?: number;
  currencyCode?: string;
  status?: "pending" | "confirmed" | "rejected" | "cancelled";
  note?: string;
}

// ============================================================================
// User Factories
// ============================================================================

/**
 * Create a test user with optional overrides
 */
export async function createTestUser(options: CreateTestUserOptions = {}) {
  const db = getTestDb();

  const email = options.email || testEmail();
  const displayName = options.displayName || `Test User ${testId()}`;
  const password = options.password || "TestPassword123!";

  // Hash password
  const passwordHash = await bcrypt.hash(password, 10);

  const [user] = await db
    .insert(schema.users)
    .values({
      email,
      displayName,
      passwordHash,
      primaryAuthProvider: "password",
    })
    .returning();

  return {
    ...user,
    plainPassword: password, // Return plain password for login tests
  };
}

/**
 * Create multiple test users
 */
export async function createTestUsers(count: number) {
  const users = [];
  for (let i = 0; i < count; i++) {
    const user = await createTestUser({
      displayName: `Test User ${i + 1}`,
    });
    users.push(user);
  }
  return users;
}

// ============================================================================
// Group Factories
// ============================================================================

/**
 * Create a test group with an owner
 */
export async function createTestGroup(
  ownerUserId: string,
  options: CreateTestGroupOptions = {}
) {
  const db = getTestDb();

  const name = options.name || `Test Group ${testId()}`;
  const defaultCurrencyCode = options.defaultCurrencyCode || "USD";

  // Create the group
  const [group] = await db
    .insert(schema.groups)
    .values({
      ownerUserId,
      name,
      defaultCurrencyCode,
      joinCode: testId("join"),
    })
    .returning();

  // Add owner as a member
  const [ownerMember] = await db
    .insert(schema.groupMembers)
    .values({
      groupId: group.id,
      userId: ownerUserId,
      role: "owner",
      status: "active",
    })
    .returning();

  return {
    ...group,
    ownerMemberId: ownerMember.id,
  };
}

/**
 * Add a member to a group
 */
export async function addTestMember(
  groupId: string,
  userId: string,
  role: "admin" | "member" | "viewer" = "member"
) {
  const db = getTestDb();

  const [member] = await db
    .insert(schema.groupMembers)
    .values({
      groupId,
      userId,
      role,
      status: "active",
    })
    .returning();

  return member;
}

/**
 * Create a group with multiple members
 */
export async function createTestGroupWithMembers(memberCount: number) {
  // Create users
  const users = await createTestUsers(memberCount);
  const owner = users[0];

  // Create group
  const group = await createTestGroup(owner.id);

  // Add other users as members
  const members = [{ ...users[0], memberId: group.ownerMemberId }];
  for (let i = 1; i < users.length; i++) {
    const member = await addTestMember(group.id, users[i].id);
    members.push({ ...users[i], memberId: member.id });
  }

  return {
    group,
    members,
    owner: members[0],
  };
}

// ============================================================================
// Expense Factories
// ============================================================================

/**
 * Create a test expense
 */
export async function createTestExpense(
  groupId: string,
  createdByMemberId: string,
  payerMemberId: string,
  options: CreateTestExpenseOptions = {}
) {
  const db = getTestDb();

  const name = options.name || `Test Expense ${testId()}`;
  const amount = options.amount || 100;
  const currencyCode = options.currencyCode || "USD";
  const category = options.category || "other";

  // Create expense
  const [expense] = await db
    .insert(schema.expenses)
    .values({
      groupId,
      createdByMemberId,
      name,
      subtotal: amount.toFixed(4),
      currencyCode,
      category,
      expenseDate: new Date(),
    })
    .returning();

  // Create expense item
  const [item] = await db
    .insert(schema.expenseItems)
    .values({
      expenseId: expense.id,
      name: name,
      unitValue: amount.toFixed(4),
      quantity: "1",
      currencyCode,
    })
    .returning();

  // Create payer record
  const [payer] = await db
    .insert(schema.expensePayers)
    .values({
      expenseId: expense.id,
      memberId: payerMemberId,
      amount: amount.toFixed(4),
      currencyCode,
    })
    .returning();

  return {
    ...expense,
    itemId: item.id,
    payerId: payer.id,
  };
}

/**
 * Add splits to an expense item
 */
export async function addTestSplits(
  itemId: string,
  memberIds: string[],
  splitType: "equal" | "exact" = "equal",
  amounts?: number[]
) {
  const db = getTestDb();

  const splits = [];
  for (let i = 0; i < memberIds.length; i++) {
    const [split] = await db
      .insert(schema.expenseItemMembers)
      .values({
        itemId,
        memberId: memberIds[i],
        shareMode: splitType,
        weight: splitType === "equal" ? "1" : undefined,
        exactAmount: splitType === "exact" && amounts ? amounts[i].toFixed(4) : undefined,
      })
      .returning();
    splits.push(split);
  }

  return splits;
}

// ============================================================================
// Settlement Factories
// ============================================================================

/**
 * Create a test settlement
 */
export async function createTestSettlement(
  groupId: string,
  payerMemberId: string,
  payeeMemberId: string,
  options: CreateTestSettlementOptions = {}
) {
  const db = getTestDb();

  const amount = options.amount || 50;
  const currencyCode = options.currencyCode || "USD";
  const status = options.status || "pending";

  const [settlement] = await db
    .insert(schema.settlements)
    .values({
      groupId,
      payerMemberId,
      payeeMemberId,
      amount: amount.toFixed(4),
      currencyCode,
      status,
      note: options.note,
      settledAt: status === "confirmed" ? new Date() : null,
    })
    .returning();

  return settlement;
}

// ============================================================================
// Notification Factories
// ============================================================================

/**
 * Create a test notification
 */
export async function createTestNotification(
  userId: string,
  type: string = "settlement_requested",
  options: { title?: string; body?: string; isRead?: boolean } = {}
) {
  const db = getTestDb();

  const [notification] = await db
    .insert(schema.notifications)
    .values({
      userId,
      type,
      title: options.title || `Test Notification ${testId()}`,
      body: options.body,
      isRead: options.isRead || false,
    })
    .returning();

  return notification;
}

/**
 * Create multiple notifications for a user
 */
export async function createTestNotifications(
  userId: string,
  count: number,
  unreadCount?: number
) {
  const notifications = [];
  const actualUnreadCount = unreadCount ?? count;

  for (let i = 0; i < count; i++) {
    const notification = await createTestNotification(userId, "settlement_requested", {
      title: `Notification ${i + 1}`,
      isRead: i >= actualUnreadCount,
    });
    notifications.push(notification);
  }

  return notifications;
}

// ============================================================================
// Complex Scenario Factories
// ============================================================================

/**
 * Create a complete test scenario with a group, expenses, and members
 * Useful for balance calculation tests
 */
export async function createTestScenario() {
  // Create 3 users
  const users = await createTestUsers(3);

  // Create group with first user as owner
  const group = await createTestGroup(users[0].id);

  // Add other users as members
  const member2 = await addTestMember(group.id, users[1].id);
  const member3 = await addTestMember(group.id, users[2].id);

  const members = [
    { user: users[0], memberId: group.ownerMemberId },
    { user: users[1], memberId: member2.id },
    { user: users[2], memberId: member3.id },
  ];

  return {
    group,
    users,
    members,
  };
}

/**
 * Create a scenario with expenses for balance testing
 */
export async function createTestScenarioWithExpenses() {
  const scenario = await createTestScenario();
  const { group, members } = scenario;

  // Member 0 pays $90, split equally among 3 members (each owes $30)
  const expense1 = await createTestExpense(
    group.id,
    members[0].memberId,
    members[0].memberId,
    { amount: 90 }
  );

  // Add splits for all members
  await addTestSplits(
    expense1.itemId,
    members.map((m) => m.memberId),
    "equal"
  );

  // Expected balances after this:
  // Member 0: paid 90, owes 30 = +60 (is owed 60)
  // Member 1: paid 0, owes 30 = -30 (owes 30)
  // Member 2: paid 0, owes 30 = -30 (owes 30)

  return {
    ...scenario,
    expense: expense1,
    expectedBalances: {
      [members[0].memberId]: 60,
      [members[1].memberId]: -30,
      [members[2].memberId]: -30,
    },
  };
}
