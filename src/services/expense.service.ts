import { eq, and, isNull, desc, gte, lte, count, inArray, exists } from "drizzle-orm";
import {
  db,
  expenses,
  expenseItems,
  expenseItemMembers,
  expensePayers,
  groupMembers,
  users,
  currencies,
  settlements,
  evidences,
  type Expense,
  type ExpenseItem,
  type ExpenseItemMember,
  type ExpensePayer,
  EXPENSE_CATEGORIES,
  SHARE_MODES,
} from "../db";
import {
  logExpenseCreated,
  logExpenseUpdated,
  logExpenseDeleted,
} from "./activity.service";

// ============================================================================
// Constants
// ============================================================================

export { EXPENSE_CATEGORIES, SHARE_MODES };

// ============================================================================
// Validation Functions
// ============================================================================

/**
 * Validate expense amount
 * AC-2.4: Amount must be positive with max 2 decimal places
 */
export function validateAmount(amount: number): { valid: boolean; error?: string } {
  if (typeof amount !== "number" || isNaN(amount)) {
    return { valid: false, error: "Amount must be a number" };
  }

  if (amount <= 0) {
    return { valid: false, error: "Amount must be positive" };
  }

  // Check max 2 decimal places
  const decimalPlaces = (amount.toString().split(".")[1] || "").length;
  if (decimalPlaces > 2) {
    return { valid: false, error: "Amount cannot have more than 2 decimal places" };
  }

  return { valid: true };
}

/**
 * Validate category
 * AC-2.8: Category must be from predefined list
 */
export function validateCategory(category: string): boolean {
  return EXPENSE_CATEGORIES.includes(category as any);
}

/**
 * Validate currency code exists
 * AC-2.5: Currency must be valid ISO code
 */
export async function validateCurrency(code: string): Promise<boolean> {
  const [currency] = await db
    .select({ code: currencies.code })
    .from(currencies)
    .where(eq(currencies.code, code.toUpperCase()))
    .limit(1);

  return !!currency;
}

/**
 * Validate title
 * AC-2.7: Title must be 1-200 characters
 */
export function validateTitle(title: string): { valid: boolean; error?: string } {
  const trimmed = title.trim();
  if (trimmed.length === 0) {
    return { valid: false, error: "Title cannot be empty" };
  }
  if (trimmed.length > 200) {
    return { valid: false, error: "Title cannot exceed 200 characters" };
  }
  return { valid: true };
}

/**
 * Get member ID from user ID within a group
 * AC-2.6: PaidBy must be a current member of the group
 */
export async function getMemberIdForUser(
  userId: string,
  groupId: string
): Promise<string | null> {
  const [member] = await db
    .select({ id: groupMembers.id })
    .from(groupMembers)
    .where(
      and(
        eq(groupMembers.userId, userId),
        eq(groupMembers.groupId, groupId),
        isNull(groupMembers.leftAt)
      )
    )
    .limit(1);

  return member?.id || null;
}

/**
 * Get all active members of a group
 */
export async function getGroupMemberIds(groupId: string): Promise<string[]> {
  const members = await db
    .select({ id: groupMembers.id })
    .from(groupMembers)
    .where(
      and(
        eq(groupMembers.groupId, groupId),
        isNull(groupMembers.leftAt)
      )
    );

  return members.map((m) => m.id);
}

// ============================================================================
// Split Calculation (TASK-012)
// ============================================================================

export type SplitType = "equal" | "exact" | "percent" | "weight";

export interface SplitConfig {
  type: SplitType;
  excludeMembers?: string[]; // user IDs to exclude (for equal split)
  values?: Record<string, number>; // userId -> value (amount, percent, or weight)
}

export interface CalculatedSplit {
  memberId: string;
  userId: string;
  amount: number;
  shareMode: SplitType;
  weight?: number;
  exactAmount?: number;
}

/**
 * Calculate splits based on configuration
 * AC-2.10 to AC-2.15
 */
export async function calculateSplits(
  totalAmount: number,
  splitConfig: SplitConfig,
  groupId: string
): Promise<{ splits: CalculatedSplit[]; error?: string }> {
  // Get all active members with their user IDs
  const members = await db
    .select({
      memberId: groupMembers.id,
      userId: groupMembers.userId,
    })
    .from(groupMembers)
    .where(
      and(
        eq(groupMembers.groupId, groupId),
        isNull(groupMembers.leftAt)
      )
    );

  if (members.length === 0) {
    return { splits: [], error: "No active members in group" };
  }

  const memberMap = new Map(members.map((m) => [m.userId, m.memberId]));
  const splits: CalculatedSplit[] = [];

  switch (splitConfig.type) {
    case "equal": {
      // AC-2.10, AC-2.15: Equal split, optionally excluding members
      const excludeSet = new Set(splitConfig.excludeMembers || []);
      const participatingMembers = members.filter((m) => !excludeSet.has(m.userId));

      if (participatingMembers.length === 0) {
        return { splits: [], error: "No members to split among" };
      }

      const shareAmount = totalAmount / participatingMembers.length;
      // Round to 2 decimal places, handle rounding errors
      const roundedShare = Math.round(shareAmount * 100) / 100;
      const remainder = Math.round((totalAmount - roundedShare * participatingMembers.length) * 100) / 100;

      participatingMembers.forEach((member, index) => {
        // Give any rounding remainder to the first person
        const amount = index === 0 ? roundedShare + remainder : roundedShare;
        splits.push({
          memberId: member.memberId,
          userId: member.userId,
          amount,
          shareMode: "equal",
          weight: 1,
        });
      });
      break;
    }

    case "exact": {
      // AC-2.11: Exact amounts per member
      if (!splitConfig.values) {
        return { splits: [], error: "Exact split requires values" };
      }

      let total = 0;
      for (const [userId, amount] of Object.entries(splitConfig.values)) {
        const memberId = memberMap.get(userId);
        if (!memberId) {
          return { splits: [], error: `User ${userId} is not a member of the group` };
        }
        total += amount;
        splits.push({
          memberId,
          userId,
          amount,
          shareMode: "exact",
          exactAmount: amount,
        });
      }

      // AC-2.14: Verify sum equals total
      if (Math.abs(total - totalAmount) > 0.01) {
        return {
          splits: [],
          error: `Split amounts (${total}) must equal total (${totalAmount})`,
        };
      }
      break;
    }

    case "percent": {
      // AC-2.12: Percentage split
      if (!splitConfig.values) {
        return { splits: [], error: "Percent split requires values" };
      }

      let totalPercent = 0;
      for (const [userId, percent] of Object.entries(splitConfig.values)) {
        const memberId = memberMap.get(userId);
        if (!memberId) {
          return { splits: [], error: `User ${userId} is not a member of the group` };
        }
        totalPercent += percent;
        const amount = Math.round((totalAmount * percent / 100) * 100) / 100;
        splits.push({
          memberId,
          userId,
          amount,
          shareMode: "percent",
          weight: percent,
        });
      }

      // Verify percentages sum to 100
      if (Math.abs(totalPercent - 100) > 0.01) {
        return {
          splits: [],
          error: `Percentages (${totalPercent}%) must sum to 100%`,
        };
      }

      // Handle rounding to ensure sum equals total
      const currentSum = splits.reduce((sum, s) => sum + s.amount, 0);
      const diff = Math.round((totalAmount - currentSum) * 100) / 100;
      if (diff !== 0 && splits.length > 0) {
        splits[0].amount = Math.round((splits[0].amount + diff) * 100) / 100;
      }
      break;
    }

    case "weight": {
      // AC-2.13: Weight/shares split
      if (!splitConfig.values) {
        return { splits: [], error: "Weight split requires values" };
      }

      let totalWeight = 0;
      const weightEntries: Array<{ userId: string; memberId: string; weight: number }> = [];

      for (const [userId, weight] of Object.entries(splitConfig.values)) {
        const memberId = memberMap.get(userId);
        if (!memberId) {
          return { splits: [], error: `User ${userId} is not a member of the group` };
        }
        if (weight < 0) {
          return { splits: [], error: "Weights cannot be negative" };
        }
        totalWeight += weight;
        weightEntries.push({ userId, memberId, weight });
      }

      if (totalWeight === 0) {
        return { splits: [], error: "Total weight cannot be zero" };
      }

      let runningTotal = 0;
      weightEntries.forEach((entry, index) => {
        const isLast = index === weightEntries.length - 1;
        let amount: number;

        if (isLast) {
          // Last person gets remainder to handle rounding
          amount = Math.round((totalAmount - runningTotal) * 100) / 100;
        } else {
          amount = Math.round((totalAmount * entry.weight / totalWeight) * 100) / 100;
          runningTotal += amount;
        }

        splits.push({
          memberId: entry.memberId,
          userId: entry.userId,
          amount,
          shareMode: "weight",
          weight: entry.weight,
        });
      });
      break;
    }

    default:
      return { splits: [], error: `Unknown split type: ${splitConfig.type}` };
  }

  return { splits };
}

// ============================================================================
// Expense CRUD Functions
// ============================================================================

export interface CreateExpenseInput {
  groupId: string;
  createdByMemberId: string;
  title: string;
  amount: number;
  currency: string;
  paidByUserId: string;
  description?: string;
  category?: string;
  date?: Date;
  splits: SplitConfig;
}

/**
 * Create a new expense with splits
 * AC-2.1 to AC-2.9, AC-2.16
 */
export async function createExpense(input: CreateExpenseInput): Promise<{
  expense: Expense;
  splits: CalculatedSplit[];
} | { error: string }> {
  // Calculate splits first
  const splitResult = await calculateSplits(input.amount, input.splits, input.groupId);
  if (splitResult.error) {
    return { error: splitResult.error };
  }

  // Get payer's member ID
  const payerMemberId = await getMemberIdForUser(input.paidByUserId, input.groupId);
  if (!payerMemberId) {
    return { error: "Payer is not a member of the group" };
  }

  return await db.transaction(async (tx) => {
    // Create the expense
    const [expense] = await tx
      .insert(expenses)
      .values({
        groupId: input.groupId,
        createdByMemberId: input.createdByMemberId,
        name: input.title.trim(),
        label: input.description?.trim() || null,
        category: input.category || "other",
        currencyCode: input.currency.toUpperCase(),
        subtotal: input.amount.toString(),
        expenseDate: input.date || new Date(),
      })
      .returning();

    // Create a single expense item for the whole expense
    const [item] = await tx
      .insert(expenseItems)
      .values({
        expenseId: expense.id,
        name: input.title.trim(),
        quantity: "1",
        unitValue: input.amount.toString(),
        currencyCode: input.currency.toUpperCase(),
      })
      .returning();

    // Create expense item members (who owes what) - AC-2.16
    if (splitResult.splits.length > 0) {
      await tx.insert(expenseItemMembers).values(
        splitResult.splits.map((split) => ({
          itemId: item.id,
          memberId: split.memberId,
          shareMode: split.shareMode,
          weight: split.weight?.toString(),
          exactAmount: split.exactAmount?.toString(),
        }))
      );
    }

    // Create expense payer record
    await tx.insert(expensePayers).values({
      expenseId: expense.id,
      memberId: payerMemberId,
      amount: input.amount.toString(),
      currencyCode: input.currency.toUpperCase(),
    });

    // Log activity (AC-2.1: Log expense creation)
    await logExpenseCreated(input.groupId, input.createdByMemberId, expense.id, {
      title: input.title,
      amount: input.amount,
      currency: input.currency,
      category: input.category,
    });

    return { expense, splits: splitResult.splits };
  });
}

export interface ExpenseListFilters {
  page?: number;
  limit?: number;
  dateFrom?: Date;
  dateTo?: Date;
  category?: string;
  paidByUserId?: string;
}

export interface ExpenseListItem {
  id: string;
  title: string;
  amount: number;
  currency: string;
  category: string | null;
  date: Date;
  paidBy: {
    userId: string;
    displayName: string;
  };
  createdAt: Date;
}

/**
 * List expenses for a group with filters
 * AC-2.17 to AC-2.23
 */
export async function listExpenses(
  groupId: string,
  filters: ExpenseListFilters = {}
): Promise<{ expenses: ExpenseListItem[]; total: number }> {
  const page = filters.page || 1;
  const limit = Math.min(filters.limit || 20, 100);
  const offset = (page - 1) * limit;

  // Build base conditions
  const conditions: ReturnType<typeof eq>[] = [
    eq(expenses.groupId, groupId),
    isNull(expenses.deletedAt),
  ];

  // Add date filters
  if (filters.dateFrom) {
    conditions.push(gte(expenses.expenseDate, filters.dateFrom));
  }
  if (filters.dateTo) {
    conditions.push(lte(expenses.expenseDate, filters.dateTo));
  }

  // Add category filter
  if (filters.category) {
    conditions.push(eq(expenses.category, filters.category));
  }

  // AC-0.4: Add paidByUserId filter at database level using EXISTS subquery
  if (filters.paidByUserId) {
    conditions.push(
      exists(
        db.select({ one: expensePayers.id })
          .from(expensePayers)
          .innerJoin(groupMembers, eq(expensePayers.memberId, groupMembers.id))
          .where(and(
            eq(expensePayers.expenseId, expenses.id),
            eq(groupMembers.userId, filters.paidByUserId)
          ))
      )
    );
  }

  // Get total count
  const [countResult] = await db
    .select({ count: count() })
    .from(expenses)
    .where(and(...conditions));

  const total = countResult?.count || 0;

  // Get expenses with payer info
  // First get the expenses
  const expenseList = await db
    .select({
      id: expenses.id,
      title: expenses.name,
      amount: expenses.subtotal,
      currency: expenses.currencyCode,
      category: expenses.category,
      date: expenses.expenseDate,
      createdAt: expenses.createdAt,
    })
    .from(expenses)
    .where(and(...conditions))
    .orderBy(desc(expenses.expenseDate))
    .limit(limit)
    .offset(offset);

  // Get payer info for each expense
  const expenseIds = expenseList.map((e) => e.id);

  if (expenseIds.length === 0) {
    return { expenses: [], total };
  }

  // Get payers with user info
  const payersData = await db
    .select({
      expenseId: expensePayers.expenseId,
      userId: groupMembers.userId,
      displayName: users.displayName,
    })
    .from(expensePayers)
    .innerJoin(groupMembers, eq(expensePayers.memberId, groupMembers.id))
    .innerJoin(users, eq(groupMembers.userId, users.id))
    .where(inArray(expensePayers.expenseId, expenseIds));

  const payerMap = new Map(
    payersData.map((p) => [p.expenseId, { userId: p.userId, displayName: p.displayName }])
  );

  const result: ExpenseListItem[] = expenseList.map((e) => ({
    id: e.id,
    title: e.title,
    amount: parseFloat(e.amount),
    currency: e.currency,
    category: e.category,
    date: e.date,
    paidBy: payerMap.get(e.id) || { userId: "", displayName: "Unknown" },
    createdAt: e.createdAt,
  }));

  return {
    expenses: result,
    total,
  };
}

export interface ExpenseAttachment {
  id: string;
  mimeType: string;
  sizeBytes: number;
  createdAt: Date;
  createdBy: {
    userId: string;
    displayName: string;
  };
}

export interface ExpenseDetails {
  id: string;
  title: string;
  description: string | null;
  amount: number;
  currency: string;
  category: string | null;
  date: Date;
  paidBy: Array<{
    userId: string;
    displayName: string;
    amount: number;
  }>;
  splits: Array<{
    userId: string;
    displayName: string;
    amount: number;
    shareMode: string;
  }>;
  attachments: ExpenseAttachment[];
  createdBy: {
    userId: string;
    displayName: string;
  };
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Get expense details with full breakdown
 * AC-2.24 to AC-2.26
 */
export async function getExpenseDetails(
  expenseId: string,
  groupId: string
): Promise<ExpenseDetails | null> {
  // Get expense
  const [expense] = await db
    .select()
    .from(expenses)
    .where(
      and(
        eq(expenses.id, expenseId),
        eq(expenses.groupId, groupId),
        isNull(expenses.deletedAt)
      )
    )
    .limit(1);

  if (!expense) {
    return null;
  }

  // Get payers
  const payers = await db
    .select({
      userId: groupMembers.userId,
      displayName: users.displayName,
      amount: expensePayers.amount,
    })
    .from(expensePayers)
    .innerJoin(groupMembers, eq(expensePayers.memberId, groupMembers.id))
    .innerJoin(users, eq(groupMembers.userId, users.id))
    .where(eq(expensePayers.expenseId, expenseId));

  // Get items and splits
  const items = await db
    .select({ id: expenseItems.id })
    .from(expenseItems)
    .where(eq(expenseItems.expenseId, expenseId));

  const itemIds = items.map((i) => i.id);

  let splits: ExpenseDetails["splits"] = [];
  if (itemIds.length > 0) {
    const splitData = await db
      .select({
        userId: groupMembers.userId,
        displayName: users.displayName,
        shareMode: expenseItemMembers.shareMode,
        weight: expenseItemMembers.weight,
        exactAmount: expenseItemMembers.exactAmount,
      })
      .from(expenseItemMembers)
      .innerJoin(groupMembers, eq(expenseItemMembers.memberId, groupMembers.id))
      .innerJoin(users, eq(groupMembers.userId, users.id))
      .where(inArray(expenseItemMembers.itemId, itemIds));

    // Calculate actual amounts for each split
    const totalAmount = parseFloat(expense.subtotal);
    const totalWeight = splitData.reduce(
      (sum, s) => sum + parseFloat(s.weight || "1"),
      0
    );

    splits = splitData.map((s) => {
      let amount: number;
      if (s.shareMode === "exact" && s.exactAmount) {
        amount = parseFloat(s.exactAmount);
      } else {
        const weight = parseFloat(s.weight || "1");
        amount = Math.round((totalAmount * weight / totalWeight) * 100) / 100;
      }

      return {
        userId: s.userId,
        displayName: s.displayName,
        amount,
        shareMode: s.shareMode,
      };
    });
  }

  // Get creator info
  const [creator] = await db
    .select({
      userId: groupMembers.userId,
      displayName: users.displayName,
    })
    .from(groupMembers)
    .innerJoin(users, eq(groupMembers.userId, users.id))
    .where(eq(groupMembers.id, expense.createdByMemberId))
    .limit(1);

  // Get attachments (AC-1.8: Response includes attachments array)
  const attachmentsData = await db
    .select({
      id: evidences.id,
      mimeType: evidences.mimeType,
      sizeBytes: evidences.sizeBytes,
      createdAt: evidences.createdAt,
      creatorUserId: users.id,
      creatorDisplayName: users.displayName,
    })
    .from(evidences)
    .innerJoin(users, eq(users.id, evidences.createdByUserId))
    .where(eq(evidences.expenseId, expenseId))
    .orderBy(evidences.createdAt);

  const attachments: ExpenseAttachment[] = attachmentsData.map((a) => ({
    id: a.id,
    mimeType: a.mimeType,
    sizeBytes: a.sizeBytes,
    createdAt: a.createdAt,
    createdBy: {
      userId: a.creatorUserId,
      displayName: a.creatorDisplayName,
    },
  }));

  return {
    id: expense.id,
    title: expense.name,
    description: expense.label,
    amount: parseFloat(expense.subtotal),
    currency: expense.currencyCode,
    category: expense.category,
    date: expense.expenseDate,
    paidBy: payers.map((p) => ({
      userId: p.userId,
      displayName: p.displayName,
      amount: parseFloat(p.amount),
    })),
    splits,
    attachments,
    createdBy: creator || { userId: "", displayName: "Unknown" },
    createdAt: expense.createdAt,
    updatedAt: expense.updatedAt,
  };
}

/**
 * Check if expense has settlements (cannot edit/delete if settled)
 * AC-2.31, AC-2.35
 * Note: Settlements don't directly link to expenses - checking via evidences table
 */
export async function hasSettlements(expenseId: string): Promise<boolean> {
  const [evidence] = await db
    .select({ id: evidences.id })
    .from(evidences)
    .where(
      and(
        eq(evidences.expenseId, expenseId),
        eq(evidences.target, "expense")
      )
    )
    .limit(1);

  return !!evidence;
}

export interface UpdateExpenseInput {
  title?: string;
  description?: string;
  amount?: number;
  category?: string;
  date?: Date;
  splits?: SplitConfig;
}

/**
 * Update an expense
 * AC-2.28 to AC-2.32
 */
export async function updateExpense(
  expenseId: string,
  groupId: string,
  updatedByMemberId: string,
  input: UpdateExpenseInput
): Promise<{ expense: Expense } | { error: string }> {
  // Check if expense has settlements
  if (await hasSettlements(expenseId)) {
    return { error: "Cannot edit expense with settlements" };
  }

  return await db.transaction(async (tx) => {
    // Build update object
    const updates: Partial<{
      name: string;
      label: string | null;
      subtotal: string;
      category: string;
      expenseDate: Date;
      updatedAt: Date;
    }> = {
      updatedAt: new Date(),
    };

    if (input.title !== undefined) {
      updates.name = input.title.trim();
    }
    if (input.description !== undefined) {
      updates.label = input.description.trim() || null;
    }
    if (input.amount !== undefined) {
      updates.subtotal = input.amount.toString();
    }
    if (input.category !== undefined) {
      updates.category = input.category;
    }
    if (input.date !== undefined) {
      updates.expenseDate = input.date;
    }

    // Update expense
    const [expense] = await tx
      .update(expenses)
      .set(updates)
      .where(
        and(
          eq(expenses.id, expenseId),
          eq(expenses.groupId, groupId),
          isNull(expenses.deletedAt)
        )
      )
      .returning();

    if (!expense) {
      return { error: "Expense not found" };
    }

    // If splits are updated, recalculate
    if (input.splits && input.amount !== undefined) {
      const splitResult = await calculateSplits(input.amount, input.splits, groupId);
      if (splitResult.error) {
        throw new Error(splitResult.error);
      }

      // Get existing items
      const items = await tx
        .select({ id: expenseItems.id })
        .from(expenseItems)
        .where(eq(expenseItems.expenseId, expenseId));

      // Delete old splits
      for (const item of items) {
        await tx
          .delete(expenseItemMembers)
          .where(eq(expenseItemMembers.itemId, item.id));
      }

      // Update item amount
      if (items.length > 0) {
        await tx
          .update(expenseItems)
          .set({
            unitValue: input.amount.toString(),
            updatedAt: new Date(),
          })
          .where(eq(expenseItems.id, items[0].id));

        // Insert new splits
        if (splitResult.splits.length > 0) {
          await tx.insert(expenseItemMembers).values(
            splitResult.splits.map((split) => ({
              itemId: items[0].id,
              memberId: split.memberId,
              shareMode: split.shareMode,
              weight: split.weight?.toString(),
              exactAmount: split.exactAmount?.toString(),
            }))
          );
        }
      }
    }

    // Log activity (AC-2.2: Log expense update)
    await logExpenseUpdated(groupId, updatedByMemberId, expenseId, {}, {
      title: input.title,
      amount: input.amount,
      category: input.category,
      date: input.date,
    });

    return { expense };
  });
}

/**
 * Soft delete an expense
 * AC-2.33 to AC-2.36
 */
export async function deleteExpense(
  expenseId: string,
  groupId: string,
  deletedByMemberId?: string
): Promise<{ success: boolean; error?: string }> {
  // Check if expense has settlements
  if (await hasSettlements(expenseId)) {
    return { success: false, error: "Cannot delete expense with settlements" };
  }

  const [deleted] = await db
    .update(expenses)
    .set({ deletedAt: new Date() })
    .where(
      and(
        eq(expenses.id, expenseId),
        eq(expenses.groupId, groupId),
        isNull(expenses.deletedAt)
      )
    )
    .returning();

  if (deleted && deletedByMemberId) {
    // Log activity (AC-2.3: Log expense deletion)
    await logExpenseDeleted(groupId, deletedByMemberId, expenseId, {
      title: deleted.name,
    });
  }

  return { success: !!deleted };
}

/**
 * Check if user can edit/delete expense (creator or admin)
 */
export async function canModifyExpense(
  expenseId: string,
  userId: string,
  groupId: string
): Promise<boolean> {
  // Get expense creator
  const [expense] = await db
    .select({
      createdByMemberId: expenses.createdByMemberId,
    })
    .from(expenses)
    .where(
      and(
        eq(expenses.id, expenseId),
        eq(expenses.groupId, groupId),
        isNull(expenses.deletedAt)
      )
    )
    .limit(1);

  if (!expense) {
    return false;
  }

  // Get user's member info
  const [userMember] = await db
    .select({
      id: groupMembers.id,
      role: groupMembers.role,
    })
    .from(groupMembers)
    .where(
      and(
        eq(groupMembers.userId, userId),
        eq(groupMembers.groupId, groupId),
        isNull(groupMembers.leftAt)
      )
    )
    .limit(1);

  if (!userMember) {
    return false;
  }

  // Creator can always modify
  if (userMember.id === expense.createdByMemberId) {
    return true;
  }

  // Admin or owner can modify
  return userMember.role === "admin" || userMember.role === "owner";
}
