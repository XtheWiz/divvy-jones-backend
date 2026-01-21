/**
 * Recurring Expenses Service
 * Sprint 007 - TASK-013, TASK-015
 *
 * Service for managing recurring expenses and generating expense entries.
 *
 * AC-3.4 to AC-3.8: CRUD operations for recurring expense rules
 * AC-3.9: Recurring expense job generates expenses when due
 * AC-3.10: Generated expenses use the recurring rule's split configuration
 * AC-3.11: Job can be triggered manually via admin endpoint
 * AC-3.12: Job can run on a schedule (cron-compatible)
 */

import { eq, and, lte, isNull, inArray } from "drizzle-orm";
import {
  db,
  recurringExpenses,
  recurringExpensePayers,
  recurringExpenseSplits,
  expenses,
  expenseItems,
  expenseItemMembers,
  expensePayers,
  groupMembers,
  groups,
  users,
} from "../db";
import type { RecurringFrequency } from "../db/schema/enums";

// ============================================================================
// Types
// ============================================================================

export interface CreateRecurringExpenseInput {
  groupId: string;
  createdByMemberId: string;
  name: string;
  description?: string;
  category?: string;
  amount: number;
  currencyCode: string;
  frequency: RecurringFrequency;
  dayOfWeek?: number;
  dayOfMonth?: number;
  monthOfYear?: number;
  splitMode?: string;
  startDate: Date;
  endDate?: Date;
  payers: Array<{ memberId: string; amount: number }>;
  splits: Array<{
    memberId: string;
    shareMode?: string;
    weight?: number;
    exactAmount?: number;
  }>;
}

export interface UpdateRecurringExpenseInput {
  name?: string;
  description?: string;
  category?: string;
  amount?: number;
  currencyCode?: string;
  frequency?: RecurringFrequency;
  dayOfWeek?: number;
  dayOfMonth?: number;
  monthOfYear?: number;
  splitMode?: string;
  endDate?: Date;
  isActive?: boolean;
}

export interface RecurringExpenseWithDetails {
  id: string;
  groupId: string;
  createdByMemberId: string;
  name: string;
  description: string | null;
  category: string | null;
  amount: number;
  currencyCode: string;
  frequency: string;
  dayOfWeek: number | null;
  dayOfMonth: number | null;
  monthOfYear: number | null;
  splitMode: string;
  startDate: Date;
  endDate: Date | null;
  nextOccurrence: Date;
  lastGeneratedAt: Date | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  payers: Array<{ memberId: string; displayName: string; amount: number }>;
  splits: Array<{
    memberId: string;
    displayName: string;
    shareMode: string;
    weight: number | null;
    exactAmount: number | null;
  }>;
}

export interface GenerationResult {
  processed: number;
  generated: number;
  skipped: number;
  errors: Array<{ recurringId: string; error: string }>;
}

// ============================================================================
// CRUD Operations
// ============================================================================

/**
 * Create a new recurring expense rule
 * AC-3.4: POST creates recurring rule
 */
export async function createRecurringExpense(
  input: CreateRecurringExpenseInput
): Promise<{ id: string }> {
  const {
    groupId,
    createdByMemberId,
    name,
    description,
    category,
    amount,
    currencyCode,
    frequency,
    dayOfWeek,
    dayOfMonth,
    monthOfYear,
    splitMode = "equal",
    startDate,
    endDate,
    payers,
    splits,
  } = input;

  // Calculate first occurrence
  const nextOccurrence = calculateNextOccurrence(
    startDate,
    frequency,
    dayOfWeek,
    dayOfMonth,
    monthOfYear
  );

  // Create the recurring expense
  const [created] = await db
    .insert(recurringExpenses)
    .values({
      groupId,
      createdByMemberId,
      name,
      description,
      category,
      amount: amount.toString(),
      currencyCode,
      frequency,
      dayOfWeek,
      dayOfMonth,
      monthOfYear,
      splitMode,
      startDate,
      endDate,
      nextOccurrence,
      isActive: true,
    })
    .returning({ id: recurringExpenses.id });

  // Add payers
  if (payers.length > 0) {
    await db.insert(recurringExpensePayers).values(
      payers.map((p) => ({
        recurringExpenseId: created.id,
        memberId: p.memberId,
        amount: p.amount.toString(),
      }))
    );
  }

  // Add splits
  if (splits.length > 0) {
    await db.insert(recurringExpenseSplits).values(
      splits.map((s) => ({
        recurringExpenseId: created.id,
        memberId: s.memberId,
        shareMode: s.shareMode || "equal",
        weight: s.weight?.toString(),
        exactAmount: s.exactAmount?.toString(),
      }))
    );
  }

  return { id: created.id };
}

/**
 * List all recurring expenses for a group
 * AC-3.5: GET lists all recurring rules
 */
export async function listRecurringExpenses(
  groupId: string
): Promise<RecurringExpenseWithDetails[]> {
  const rules = await db
    .select()
    .from(recurringExpenses)
    .where(eq(recurringExpenses.groupId, groupId))
    .orderBy(recurringExpenses.name);

  if (rules.length === 0) {
    return [];
  }

  const ruleIds = rules.map((r) => r.id);

  // Get payers with display names
  const payerData = await db
    .select({
      recurringExpenseId: recurringExpensePayers.recurringExpenseId,
      memberId: recurringExpensePayers.memberId,
      amount: recurringExpensePayers.amount,
      displayName: users.displayName,
    })
    .from(recurringExpensePayers)
    .innerJoin(groupMembers, eq(recurringExpensePayers.memberId, groupMembers.id))
    .innerJoin(users, eq(groupMembers.userId, users.id))
    .where(inArray(recurringExpensePayers.recurringExpenseId, ruleIds));

  // Get splits with display names
  const splitData = await db
    .select({
      recurringExpenseId: recurringExpenseSplits.recurringExpenseId,
      memberId: recurringExpenseSplits.memberId,
      shareMode: recurringExpenseSplits.shareMode,
      weight: recurringExpenseSplits.weight,
      exactAmount: recurringExpenseSplits.exactAmount,
      displayName: users.displayName,
    })
    .from(recurringExpenseSplits)
    .innerJoin(groupMembers, eq(recurringExpenseSplits.memberId, groupMembers.id))
    .innerJoin(users, eq(groupMembers.userId, users.id))
    .where(inArray(recurringExpenseSplits.recurringExpenseId, ruleIds));

  // Map payers and splits by rule ID
  const payersByRule = new Map<string, typeof payerData>();
  for (const p of payerData) {
    const existing = payersByRule.get(p.recurringExpenseId) || [];
    existing.push(p);
    payersByRule.set(p.recurringExpenseId, existing);
  }

  const splitsByRule = new Map<string, typeof splitData>();
  for (const s of splitData) {
    const existing = splitsByRule.get(s.recurringExpenseId) || [];
    existing.push(s);
    splitsByRule.set(s.recurringExpenseId, existing);
  }

  return rules.map((rule) => ({
    id: rule.id,
    groupId: rule.groupId,
    createdByMemberId: rule.createdByMemberId,
    name: rule.name,
    description: rule.description,
    category: rule.category,
    amount: Number(rule.amount),
    currencyCode: rule.currencyCode,
    frequency: rule.frequency,
    dayOfWeek: rule.dayOfWeek,
    dayOfMonth: rule.dayOfMonth,
    monthOfYear: rule.monthOfYear,
    splitMode: rule.splitMode,
    startDate: rule.startDate,
    endDate: rule.endDate,
    nextOccurrence: rule.nextOccurrence,
    lastGeneratedAt: rule.lastGeneratedAt,
    isActive: rule.isActive,
    createdAt: rule.createdAt,
    updatedAt: rule.updatedAt,
    payers: (payersByRule.get(rule.id) || []).map((p) => ({
      memberId: p.memberId,
      displayName: p.displayName,
      amount: Number(p.amount),
    })),
    splits: (splitsByRule.get(rule.id) || []).map((s) => ({
      memberId: s.memberId,
      displayName: s.displayName,
      shareMode: s.shareMode,
      weight: s.weight ? Number(s.weight) : null,
      exactAmount: s.exactAmount ? Number(s.exactAmount) : null,
    })),
  }));
}

/**
 * Get a single recurring expense by ID
 * AC-3.6: GET returns single rule
 */
export async function getRecurringExpense(
  id: string
): Promise<RecurringExpenseWithDetails | null> {
  const [rule] = await db
    .select()
    .from(recurringExpenses)
    .where(eq(recurringExpenses.id, id))
    .limit(1);

  if (!rule) {
    return null;
  }

  // Get payers
  const payerData = await db
    .select({
      memberId: recurringExpensePayers.memberId,
      amount: recurringExpensePayers.amount,
      displayName: users.displayName,
    })
    .from(recurringExpensePayers)
    .innerJoin(groupMembers, eq(recurringExpensePayers.memberId, groupMembers.id))
    .innerJoin(users, eq(groupMembers.userId, users.id))
    .where(eq(recurringExpensePayers.recurringExpenseId, id));

  // Get splits
  const splitData = await db
    .select({
      memberId: recurringExpenseSplits.memberId,
      shareMode: recurringExpenseSplits.shareMode,
      weight: recurringExpenseSplits.weight,
      exactAmount: recurringExpenseSplits.exactAmount,
      displayName: users.displayName,
    })
    .from(recurringExpenseSplits)
    .innerJoin(groupMembers, eq(recurringExpenseSplits.memberId, groupMembers.id))
    .innerJoin(users, eq(groupMembers.userId, users.id))
    .where(eq(recurringExpenseSplits.recurringExpenseId, id));

  return {
    id: rule.id,
    groupId: rule.groupId,
    createdByMemberId: rule.createdByMemberId,
    name: rule.name,
    description: rule.description,
    category: rule.category,
    amount: Number(rule.amount),
    currencyCode: rule.currencyCode,
    frequency: rule.frequency,
    dayOfWeek: rule.dayOfWeek,
    dayOfMonth: rule.dayOfMonth,
    monthOfYear: rule.monthOfYear,
    splitMode: rule.splitMode,
    startDate: rule.startDate,
    endDate: rule.endDate,
    nextOccurrence: rule.nextOccurrence,
    lastGeneratedAt: rule.lastGeneratedAt,
    isActive: rule.isActive,
    createdAt: rule.createdAt,
    updatedAt: rule.updatedAt,
    payers: payerData.map((p) => ({
      memberId: p.memberId,
      displayName: p.displayName,
      amount: Number(p.amount),
    })),
    splits: splitData.map((s) => ({
      memberId: s.memberId,
      displayName: s.displayName,
      shareMode: s.shareMode,
      weight: s.weight ? Number(s.weight) : null,
      exactAmount: s.exactAmount ? Number(s.exactAmount) : null,
    })),
  };
}

/**
 * Update a recurring expense rule
 * AC-3.7: PUT updates rule
 */
export async function updateRecurringExpense(
  id: string,
  input: UpdateRecurringExpenseInput
): Promise<boolean> {
  const updateData: Record<string, unknown> = {
    updatedAt: new Date(),
  };

  if (input.name !== undefined) updateData.name = input.name;
  if (input.description !== undefined) updateData.description = input.description;
  if (input.category !== undefined) updateData.category = input.category;
  if (input.amount !== undefined) updateData.amount = input.amount.toString();
  if (input.currencyCode !== undefined) updateData.currencyCode = input.currencyCode;
  if (input.frequency !== undefined) updateData.frequency = input.frequency;
  if (input.dayOfWeek !== undefined) updateData.dayOfWeek = input.dayOfWeek;
  if (input.dayOfMonth !== undefined) updateData.dayOfMonth = input.dayOfMonth;
  if (input.monthOfYear !== undefined) updateData.monthOfYear = input.monthOfYear;
  if (input.splitMode !== undefined) updateData.splitMode = input.splitMode;
  if (input.endDate !== undefined) updateData.endDate = input.endDate;
  if (input.isActive !== undefined) updateData.isActive = input.isActive;

  const result = await db
    .update(recurringExpenses)
    .set(updateData)
    .where(eq(recurringExpenses.id, id));

  return (result.rowCount ?? 0) > 0;
}

/**
 * Deactivate a recurring expense rule
 * AC-3.8: DELETE deactivates rule
 */
export async function deactivateRecurringExpense(id: string): Promise<boolean> {
  const result = await db
    .update(recurringExpenses)
    .set({
      isActive: false,
      updatedAt: new Date(),
    })
    .where(eq(recurringExpenses.id, id));

  return (result.rowCount ?? 0) > 0;
}

// ============================================================================
// Expense Generation
// ============================================================================

/**
 * Generate due recurring expenses
 * AC-3.9: Job generates expenses when due
 * AC-3.10: Generated expenses use recurring rule's split configuration
 * AC-3.11: Can be triggered manually
 */
export async function generateDueExpenses(): Promise<GenerationResult> {
  const now = new Date();
  const result: GenerationResult = {
    processed: 0,
    generated: 0,
    skipped: 0,
    errors: [],
  };

  // Get all due recurring expenses
  const dueRules = await db
    .select()
    .from(recurringExpenses)
    .where(
      and(
        eq(recurringExpenses.isActive, true),
        lte(recurringExpenses.nextOccurrence, now)
      )
    );

  result.processed = dueRules.length;

  for (const rule of dueRules) {
    try {
      // Check if end date passed
      if (rule.endDate && rule.endDate < now) {
        await db
          .update(recurringExpenses)
          .set({ isActive: false, updatedAt: now })
          .where(eq(recurringExpenses.id, rule.id));
        result.skipped++;
        continue;
      }

      // Generate the expense
      await generateExpenseFromRule(rule);

      // Calculate and update next occurrence
      const nextOccurrence = calculateNextOccurrence(
        rule.nextOccurrence,
        rule.frequency as RecurringFrequency,
        rule.dayOfWeek ?? undefined,
        rule.dayOfMonth ?? undefined,
        rule.monthOfYear ?? undefined
      );

      await db
        .update(recurringExpenses)
        .set({
          nextOccurrence,
          lastGeneratedAt: now,
          updatedAt: now,
        })
        .where(eq(recurringExpenses.id, rule.id));

      result.generated++;
    } catch (err) {
      result.errors.push({
        recurringId: rule.id,
        error: err instanceof Error ? err.message : "Unknown error",
      });
    }
  }

  return result;
}

/**
 * Generate a single expense from a recurring rule
 * AC-3.10: Uses recurring rule's split configuration
 */
async function generateExpenseFromRule(
  rule: typeof recurringExpenses.$inferSelect
): Promise<void> {
  // Get payers for this rule
  const payers = await db
    .select()
    .from(recurringExpensePayers)
    .where(eq(recurringExpensePayers.recurringExpenseId, rule.id));

  // Get splits for this rule
  const splits = await db
    .select()
    .from(recurringExpenseSplits)
    .where(eq(recurringExpenseSplits.recurringExpenseId, rule.id));

  // Create the expense
  const [expense] = await db
    .insert(expenses)
    .values({
      groupId: rule.groupId,
      createdByMemberId: rule.createdByMemberId,
      name: rule.name,
      label: rule.description,
      category: rule.category,
      currencyCode: rule.currencyCode,
      subtotal: rule.amount,
      expenseDate: rule.nextOccurrence,
    })
    .returning({ id: expenses.id });

  // Add payers
  if (payers.length > 0) {
    await db.insert(expensePayers).values(
      payers.map((p) => ({
        expenseId: expense.id,
        memberId: p.memberId,
        amount: p.amount,
        currencyCode: rule.currencyCode,
      }))
    );
  }

  // Create expense item for the split
  const [item] = await db
    .insert(expenseItems)
    .values({
      expenseId: expense.id,
      name: rule.name,
      quantity: "1",
      unitValue: rule.amount,
      currencyCode: rule.currencyCode,
    })
    .returning({ id: expenseItems.id });

  // Add splits (AC-3.10)
  if (splits.length > 0) {
    await db.insert(expenseItemMembers).values(
      splits.map((s) => ({
        itemId: item.id,
        memberId: s.memberId,
        shareMode: s.shareMode,
        weight: s.weight,
        exactAmount: s.exactAmount,
      }))
    );
  }
}

// ============================================================================
// Date Calculation Utilities
// ============================================================================

/**
 * Calculate the next occurrence date based on frequency
 */
function calculateNextOccurrence(
  fromDate: Date,
  frequency: RecurringFrequency,
  dayOfWeek?: number,
  dayOfMonth?: number,
  monthOfYear?: number
): Date {
  const next = new Date(fromDate);

  switch (frequency) {
    case "daily":
      next.setDate(next.getDate() + 1);
      break;

    case "weekly":
      next.setDate(next.getDate() + 7);
      if (dayOfWeek !== undefined) {
        // Adjust to specific day of week
        const currentDay = next.getDay();
        const diff = dayOfWeek - currentDay;
        next.setDate(next.getDate() + (diff >= 0 ? diff : diff + 7));
      }
      break;

    case "biweekly":
      next.setDate(next.getDate() + 14);
      if (dayOfWeek !== undefined) {
        const currentDay = next.getDay();
        const diff = dayOfWeek - currentDay;
        next.setDate(next.getDate() + (diff >= 0 ? diff : diff + 7));
      }
      break;

    case "monthly":
      next.setMonth(next.getMonth() + 1);
      if (dayOfMonth !== undefined) {
        // Handle month end edge cases
        const lastDay = new Date(next.getFullYear(), next.getMonth() + 1, 0).getDate();
        next.setDate(Math.min(dayOfMonth, lastDay));
      }
      break;

    case "yearly":
      next.setFullYear(next.getFullYear() + 1);
      if (monthOfYear !== undefined) {
        next.setMonth(monthOfYear - 1);
      }
      if (dayOfMonth !== undefined) {
        const lastDay = new Date(next.getFullYear(), next.getMonth() + 1, 0).getDate();
        next.setDate(Math.min(dayOfMonth, lastDay));
      }
      break;
  }

  return next;
}

/**
 * Get recurring expense by ID (simple check)
 */
export async function findRecurringExpenseById(
  id: string
): Promise<{ id: string; groupId: string } | null> {
  const [rule] = await db
    .select({ id: recurringExpenses.id, groupId: recurringExpenses.groupId })
    .from(recurringExpenses)
    .where(eq(recurringExpenses.id, id))
    .limit(1);

  return rule || null;
}
