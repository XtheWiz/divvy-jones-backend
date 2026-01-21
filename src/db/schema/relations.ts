import { relations } from "drizzle-orm";

// Import all tables
import { users, oauthAccounts, userSettings } from "./users";
import { currencies, fxRates } from "./currencies";
import { plans, planFeatures, subscriptions } from "./plans";
import {
  groups,
  groupCurrencies,
  groupMembers,
  leaveRequests,
  groupInvites,
} from "./groups";
import {
  expenses,
  expenseItems,
  expenseItemMembers,
  expensePayers,
  ocrReceipts,
} from "./expenses";
import { settlements, evidences } from "./settlements";
import { notifications, activityLog } from "./notifications";
import { expenseComments } from "./comments";
import { reactions } from "./reactions";

// ============================================================================
// USER RELATIONS
// ============================================================================

export const usersRelations = relations(users, ({ one, many }) => ({
  settings: one(userSettings, {
    fields: [users.id],
    references: [userSettings.userId],
  }),
  oauthAccounts: many(oauthAccounts),
  subscriptions: many(subscriptions),
  ownedGroups: many(groups),
  memberships: many(groupMembers),
  notifications: many(notifications),
  evidences: many(evidences),
  usedInvites: many(groupInvites),
}));

export const oauthAccountsRelations = relations(oauthAccounts, ({ one }) => ({
  user: one(users, {
    fields: [oauthAccounts.userId],
    references: [users.id],
  }),
}));

export const userSettingsRelations = relations(userSettings, ({ one }) => ({
  user: one(users, {
    fields: [userSettings.userId],
    references: [users.id],
  }),
  defaultCurrency: one(currencies, {
    fields: [userSettings.defaultCurrencyCode],
    references: [currencies.code],
  }),
}));

// ============================================================================
// CURRENCY RELATIONS
// ============================================================================

export const currenciesRelations = relations(currencies, ({ many }) => ({
  fxRatesBase: many(fxRates, { relationName: "baseCurrency" }),
  fxRatesQuote: many(fxRates, { relationName: "quoteCurrency" }),
  groupDefaults: many(groups),
  groupCurrencies: many(groupCurrencies),
  expenses: many(expenses),
  expenseItems: many(expenseItems),
  expensePayers: many(expensePayers),
  settlements: many(settlements),
}));

export const fxRatesRelations = relations(fxRates, ({ one }) => ({
  baseCurrency: one(currencies, {
    fields: [fxRates.baseCode],
    references: [currencies.code],
    relationName: "baseCurrency",
  }),
  quoteCurrency: one(currencies, {
    fields: [fxRates.quoteCode],
    references: [currencies.code],
    relationName: "quoteCurrency",
  }),
}));

// ============================================================================
// PLAN RELATIONS
// ============================================================================

export const plansRelations = relations(plans, ({ many }) => ({
  features: many(planFeatures),
  subscriptions: many(subscriptions),
}));

export const planFeaturesRelations = relations(planFeatures, ({ one }) => ({
  plan: one(plans, {
    fields: [planFeatures.planId],
    references: [plans.id],
  }),
}));

export const subscriptionsRelations = relations(subscriptions, ({ one }) => ({
  user: one(users, {
    fields: [subscriptions.userId],
    references: [users.id],
  }),
  plan: one(plans, {
    fields: [subscriptions.planId],
    references: [plans.id],
  }),
}));

// ============================================================================
// GROUP RELATIONS
// ============================================================================

export const groupsRelations = relations(groups, ({ one, many }) => ({
  owner: one(users, {
    fields: [groups.ownerUserId],
    references: [users.id],
  }),
  defaultCurrency: one(currencies, {
    fields: [groups.defaultCurrencyCode],
    references: [currencies.code],
  }),
  currencies: many(groupCurrencies),
  members: many(groupMembers),
  expenses: many(expenses),
  settlements: many(settlements),
  leaveRequests: many(leaveRequests),
  invites: many(groupInvites),
  activityLogs: many(activityLog),
  comments: many(expenseComments),
  reactions: many(reactions),
}));

export const groupCurrenciesRelations = relations(groupCurrencies, ({ one }) => ({
  group: one(groups, {
    fields: [groupCurrencies.groupId],
    references: [groups.id],
  }),
  currency: one(currencies, {
    fields: [groupCurrencies.currencyCode],
    references: [currencies.code],
  }),
}));

export const groupMembersRelations = relations(groupMembers, ({ one, many }) => ({
  group: one(groups, {
    fields: [groupMembers.groupId],
    references: [groups.id],
  }),
  user: one(users, {
    fields: [groupMembers.userId],
    references: [users.id],
  }),
  originMember: one(groupMembers, {
    fields: [groupMembers.originMemberId],
    references: [groupMembers.id],
    relationName: "guestOrigin",
  }),
  invitedGuests: many(groupMembers, { relationName: "guestOrigin" }),
  createdExpenses: many(expenses),
  expenseItemShares: many(expenseItemMembers),
  paidExpenses: many(expensePayers),
  settlementsAsPayer: many(settlements, { relationName: "payer" }),
  settlementsAsPayee: many(settlements, { relationName: "payee" }),
  leaveRequests: many(leaveRequests, { relationName: "requester" }),
  approvedLeaveRequests: many(leaveRequests, { relationName: "approver" }),
  issuedInvites: many(groupInvites),
  activityLogs: many(activityLog),
  comments: many(expenseComments),
  reactions: many(reactions),
}));

export const leaveRequestsRelations = relations(leaveRequests, ({ one }) => ({
  group: one(groups, {
    fields: [leaveRequests.groupId],
    references: [groups.id],
  }),
  member: one(groupMembers, {
    fields: [leaveRequests.memberId],
    references: [groupMembers.id],
    relationName: "requester",
  }),
  approvedBy: one(groupMembers, {
    fields: [leaveRequests.approvedByMemberId],
    references: [groupMembers.id],
    relationName: "approver",
  }),
}));

export const groupInvitesRelations = relations(groupInvites, ({ one }) => ({
  group: one(groups, {
    fields: [groupInvites.groupId],
    references: [groups.id],
  }),
  issuedBy: one(groupMembers, {
    fields: [groupInvites.issuedByMemberId],
    references: [groupMembers.id],
  }),
  usedBy: one(users, {
    fields: [groupInvites.usedByUserId],
    references: [users.id],
  }),
}));

// ============================================================================
// EXPENSE RELATIONS
// ============================================================================

export const expensesRelations = relations(expenses, ({ one, many }) => ({
  group: one(groups, {
    fields: [expenses.groupId],
    references: [groups.id],
  }),
  createdBy: one(groupMembers, {
    fields: [expenses.createdByMemberId],
    references: [groupMembers.id],
  }),
  currency: one(currencies, {
    fields: [expenses.currencyCode],
    references: [currencies.code],
  }),
  items: many(expenseItems),
  payers: many(expensePayers),
  ocrReceipts: many(ocrReceipts),
  evidences: many(evidences),
  comments: many(expenseComments),
}));

export const expenseItemsRelations = relations(expenseItems, ({ one, many }) => ({
  expense: one(expenses, {
    fields: [expenseItems.expenseId],
    references: [expenses.id],
  }),
  currency: one(currencies, {
    fields: [expenseItems.currencyCode],
    references: [currencies.code],
  }),
  memberShares: many(expenseItemMembers),
}));

export const expenseItemMembersRelations = relations(expenseItemMembers, ({ one }) => ({
  item: one(expenseItems, {
    fields: [expenseItemMembers.itemId],
    references: [expenseItems.id],
  }),
  member: one(groupMembers, {
    fields: [expenseItemMembers.memberId],
    references: [groupMembers.id],
  }),
}));

export const expensePayersRelations = relations(expensePayers, ({ one }) => ({
  expense: one(expenses, {
    fields: [expensePayers.expenseId],
    references: [expenses.id],
  }),
  member: one(groupMembers, {
    fields: [expensePayers.memberId],
    references: [groupMembers.id],
  }),
  currency: one(currencies, {
    fields: [expensePayers.currencyCode],
    references: [currencies.code],
  }),
}));

export const ocrReceiptsRelations = relations(ocrReceipts, ({ one }) => ({
  expense: one(expenses, {
    fields: [ocrReceipts.expenseId],
    references: [expenses.id],
  }),
}));

// ============================================================================
// SETTLEMENT RELATIONS
// ============================================================================

export const settlementsRelations = relations(settlements, ({ one, many }) => ({
  group: one(groups, {
    fields: [settlements.groupId],
    references: [groups.id],
  }),
  payer: one(groupMembers, {
    fields: [settlements.payerMemberId],
    references: [groupMembers.id],
    relationName: "payer",
  }),
  payee: one(groupMembers, {
    fields: [settlements.payeeMemberId],
    references: [groupMembers.id],
    relationName: "payee",
  }),
  currency: one(currencies, {
    fields: [settlements.currencyCode],
    references: [currencies.code],
  }),
  evidences: many(evidences),
}));

export const evidencesRelations = relations(evidences, ({ one }) => ({
  expense: one(expenses, {
    fields: [evidences.expenseId],
    references: [expenses.id],
  }),
  settlement: one(settlements, {
    fields: [evidences.settlementId],
    references: [settlements.id],
  }),
  createdBy: one(users, {
    fields: [evidences.createdByUserId],
    references: [users.id],
  }),
}));

// ============================================================================
// NOTIFICATION RELATIONS
// ============================================================================

export const notificationsRelations = relations(notifications, ({ one }) => ({
  user: one(users, {
    fields: [notifications.userId],
    references: [users.id],
  }),
}));

export const activityLogRelations = relations(activityLog, ({ one }) => ({
  group: one(groups, {
    fields: [activityLog.groupId],
    references: [groups.id],
  }),
  actor: one(groupMembers, {
    fields: [activityLog.actorMemberId],
    references: [groupMembers.id],
  }),
}));

// ============================================================================
// COMMENT RELATIONS
// ============================================================================

export const expenseCommentsRelations = relations(expenseComments, ({ one }) => ({
  expense: one(expenses, {
    fields: [expenseComments.expenseId],
    references: [expenses.id],
  }),
  group: one(groups, {
    fields: [expenseComments.groupId],
    references: [groups.id],
  }),
  author: one(groupMembers, {
    fields: [expenseComments.authorMemberId],
    references: [groupMembers.id],
  }),
}));

// ============================================================================
// REACTION RELATIONS
// ============================================================================

export const reactionsRelations = relations(reactions, ({ one }) => ({
  group: one(groups, {
    fields: [reactions.groupId],
    references: [groups.id],
  }),
  member: one(groupMembers, {
    fields: [reactions.memberId],
    references: [groupMembers.id],
  }),
}));
