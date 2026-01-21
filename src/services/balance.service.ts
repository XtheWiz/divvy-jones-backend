/**
 * Balance Service
 * Sprint 003 - Balance calculations
 * Sprint 008 - TASK-013: Added caching support
 *
 * AC-3.2: Group summary data can be cached with configurable TTL
 * AC-3.3: Cache invalidation occurs on relevant data changes
 */

import { eq, and, isNull, inArray } from "drizzle-orm";
import {
  db,
  groups,
  expenses,
  expenseItems,
  expenseItemMembers,
  expensePayers,
  groupMembers,
  users,
  settlements,
} from "../db";
import { getCacheService, CACHE_KEYS, CACHE_TTL } from "./cache.service";

// ============================================================================
// Types
// ============================================================================

export interface MemberBalance {
  memberId: string;
  userId: string;
  displayName: string;
  totalPaid: number;
  totalOwed: number;
  netBalance: number; // positive = owed money, negative = owes money
}

export interface SimplifiedDebt {
  from: {
    memberId: string;
    userId: string;
    displayName: string;
  };
  to: {
    memberId: string;
    userId: string;
    displayName: string;
  };
  amount: number;
}

export interface GroupBalances {
  groupId: string;
  currency: string;
  memberBalances: MemberBalance[];
  simplifiedDebts: SimplifiedDebt[];
  calculatedAt: Date;
}

export interface IndividualBalance {
  memberId: string;
  userId: string;
  displayName: string;
  totalPaid: number;
  totalOwed: number;
  netBalance: number;
  owesTo: Array<{
    memberId: string;
    userId: string;
    displayName: string;
    amount: number;
  }>;
  owedBy: Array<{
    memberId: string;
    userId: string;
    displayName: string;
    amount: number;
  }>;
}

// ============================================================================
// Balance Calculation Functions
// ============================================================================

/**
 * Get group balances with caching
 * AC-3.2: Group summary data can be cached with configurable TTL
 */
export async function getGroupBalances(
  groupId: string,
  options: { skipCache?: boolean } = {}
): Promise<GroupBalances> {
  const cache = getCacheService();
  const cacheKey = CACHE_KEYS.groupBalances(groupId);

  // Check cache first (unless skipCache is true)
  if (!options.skipCache) {
    const cached = cache.get<GroupBalances>(cacheKey);
    if (cached) {
      return cached;
    }
  }

  // Calculate fresh balances
  const balances = await calculateGroupBalances(groupId);

  // Cache the result
  cache.set(cacheKey, balances, CACHE_TTL.GROUP_BALANCES);

  return balances;
}

/**
 * Invalidate cached balances for a group
 * AC-3.3: Cache invalidation occurs on relevant data changes
 * Call this when expenses, settlements, or members change
 */
export function invalidateGroupBalancesCache(groupId: string): void {
  const cache = getCacheService();
  cache.invalidate(CACHE_KEYS.groupBalances(groupId));
}

/**
 * Calculate all member balances for a group
 * AC-3.1 to AC-3.4
 */
export async function calculateGroupBalances(groupId: string): Promise<GroupBalances> {
  // Get group's default currency
  const [group] = await db
    .select({ currency: groups.defaultCurrencyCode })
    .from(groups)
    .where(eq(groups.id, groupId))
    .limit(1);

  const currency = group?.currency || "USD";

  // Get all active members with user info
  const members = await db
    .select({
      memberId: groupMembers.id,
      userId: groupMembers.userId,
      displayName: users.displayName,
    })
    .from(groupMembers)
    .innerJoin(users, eq(groupMembers.userId, users.id))
    .where(
      and(
        eq(groupMembers.groupId, groupId),
        isNull(groupMembers.leftAt)
      )
    );

  if (members.length === 0) {
    return {
      groupId,
      currency,
      memberBalances: [],
      simplifiedDebts: [],
      calculatedAt: new Date(),
    };
  }

  // Initialize balances
  const memberMap = new Map(
    members.map((m) => [
      m.memberId,
      {
        memberId: m.memberId,
        userId: m.userId,
        displayName: m.displayName,
        totalPaid: 0,
        totalOwed: 0,
        netBalance: 0,
      },
    ])
  );

  // Get all active expenses for the group
  const expenseList = await db
    .select({
      id: expenses.id,
      subtotal: expenses.subtotal,
    })
    .from(expenses)
    .where(
      and(
        eq(expenses.groupId, groupId),
        isNull(expenses.deletedAt)
      )
    );

  if (expenseList.length === 0) {
    return {
      groupId,
      currency,
      memberBalances: Array.from(memberMap.values()),
      simplifiedDebts: [],
      calculatedAt: new Date(),
    };
  }

  const expenseIds = expenseList.map((e) => e.id);

  // Get all payers
  const payers = await db
    .select({
      memberId: expensePayers.memberId,
      amount: expensePayers.amount,
    })
    .from(expensePayers)
    .where(inArray(expensePayers.expenseId, expenseIds));

  // Sum up what each member paid
  for (const payer of payers) {
    const balance = memberMap.get(payer.memberId);
    if (balance) {
      balance.totalPaid += parseFloat(payer.amount);
    }
  }

  // Get all expense items
  const items = await db
    .select({ id: expenseItems.id })
    .from(expenseItems)
    .where(inArray(expenseItems.expenseId, expenseIds));

  const itemIds = items.map((i) => i.id);

  if (itemIds.length > 0) {
    // Get all splits
    const splits = await db
      .select({
        memberId: expenseItemMembers.memberId,
        shareMode: expenseItemMembers.shareMode,
        weight: expenseItemMembers.weight,
        exactAmount: expenseItemMembers.exactAmount,
        itemId: expenseItemMembers.itemId,
      })
      .from(expenseItemMembers)
      .where(inArray(expenseItemMembers.itemId, itemIds));

    // Get item amounts
    const itemAmounts = await db
      .select({
        id: expenseItems.id,
        unitValue: expenseItems.unitValue,
        quantity: expenseItems.quantity,
      })
      .from(expenseItems)
      .where(inArray(expenseItems.id, itemIds));

    const itemAmountMap = new Map(
      itemAmounts.map((i) => [i.id, parseFloat(i.unitValue) * parseFloat(i.quantity)])
    );

    // Group splits by item to calculate totals
    const splitsByItem = new Map<string, typeof splits>();
    for (const split of splits) {
      if (!splitsByItem.has(split.itemId)) {
        splitsByItem.set(split.itemId, []);
      }
      splitsByItem.get(split.itemId)!.push(split);
    }

    // Calculate what each member owes
    for (const [itemId, itemSplits] of splitsByItem) {
      const itemTotal = itemAmountMap.get(itemId) || 0;

      // Calculate total weight for this item
      const totalWeight = itemSplits.reduce(
        (sum, s) => sum + parseFloat(s.weight || "1"),
        0
      );

      for (const split of itemSplits) {
        const balance = memberMap.get(split.memberId);
        if (!balance) continue;

        let owedAmount: number;
        if (split.shareMode === "exact" && split.exactAmount) {
          owedAmount = parseFloat(split.exactAmount);
        } else {
          const weight = parseFloat(split.weight || "1");
          owedAmount = (itemTotal * weight) / totalWeight;
        }

        balance.totalOwed += owedAmount;
      }
    }
  }

  // AC-1.14, AC-1.15: Include confirmed settlements in balance calculation
  // When A pays B in a settlement:
  //   - A's balance decreases (they paid out money)
  //   - B's balance increases (they received money)
  const confirmedSettlements = await db
    .select({
      payerMemberId: settlements.payerMemberId,
      payeeMemberId: settlements.payeeMemberId,
      amount: settlements.amount,
    })
    .from(settlements)
    .where(
      and(
        eq(settlements.groupId, groupId),
        eq(settlements.status, "confirmed")
      )
    );

  // Apply settlement adjustments
  for (const settlement of confirmedSettlements) {
    const amount = parseFloat(settlement.amount);

    // Payer's totalPaid increases (they paid in settlement)
    const payerBalance = memberMap.get(settlement.payerMemberId);
    if (payerBalance) {
      payerBalance.totalPaid += amount;
    }

    // Payee's totalOwed increases (settlement received reduces what they're owed)
    // This effectively reduces their positive balance
    const payeeBalance = memberMap.get(settlement.payeeMemberId);
    if (payeeBalance) {
      payeeBalance.totalOwed += amount;
    }
  }

  // AC-3.1, AC-3.2, AC-3.3: Calculate net balance
  const memberBalances: MemberBalance[] = [];
  for (const balance of memberMap.values()) {
    balance.netBalance = Math.round((balance.totalPaid - balance.totalOwed) * 100) / 100;
    balance.totalPaid = Math.round(balance.totalPaid * 100) / 100;
    balance.totalOwed = Math.round(balance.totalOwed * 100) / 100;
    memberBalances.push(balance);
  }

  // AC-3.4: Verify sum of balances is zero (within rounding tolerance)
  const totalBalance = memberBalances.reduce((sum, b) => sum + b.netBalance, 0);
  if (Math.abs(totalBalance) > 0.01) {
    // Adjust the first member's balance to account for rounding
    if (memberBalances.length > 0) {
      memberBalances[0].netBalance = Math.round(
        (memberBalances[0].netBalance - totalBalance) * 100
      ) / 100;
    }
  }

  // AC-3.5, AC-3.6: Calculate simplified debts
  const simplifiedDebts = simplifyDebts(memberBalances);

  return {
    groupId,
    currency,
    memberBalances,
    simplifiedDebts,
    calculatedAt: new Date(),
  };
}

/**
 * Simplify debts to minimize transactions
 * AC-3.5, AC-3.6
 *
 * Algorithm:
 * 1. Separate members into creditors (positive balance) and debtors (negative balance)
 * 2. Sort both lists by absolute value (descending)
 * 3. Match largest debtor to largest creditor
 * 4. Create debt record for min(debtor.abs, creditor.abs)
 * 5. Reduce both balances by that amount
 * 6. Repeat until all balanced
 */
function simplifyDebts(memberBalances: MemberBalance[]): SimplifiedDebt[] {
  // Create working copies
  const creditors: Array<{
    memberId: string;
    userId: string;
    displayName: string;
    balance: number;
  }> = [];

  const debtors: Array<{
    memberId: string;
    userId: string;
    displayName: string;
    balance: number; // stored as positive (amount they owe)
  }> = [];

  for (const member of memberBalances) {
    if (member.netBalance > 0.01) {
      // Creditor - is owed money
      creditors.push({
        memberId: member.memberId,
        userId: member.userId,
        displayName: member.displayName,
        balance: member.netBalance,
      });
    } else if (member.netBalance < -0.01) {
      // Debtor - owes money
      debtors.push({
        memberId: member.memberId,
        userId: member.userId,
        displayName: member.displayName,
        balance: Math.abs(member.netBalance),
      });
    }
  }

  const debts: SimplifiedDebt[] = [];

  // Sort by balance (descending)
  creditors.sort((a, b) => b.balance - a.balance);
  debtors.sort((a, b) => b.balance - a.balance);

  // Match debtors to creditors
  let creditorIdx = 0;
  let debtorIdx = 0;

  while (creditorIdx < creditors.length && debtorIdx < debtors.length) {
    const creditor = creditors[creditorIdx];
    const debtor = debtors[debtorIdx];

    // Skip if either is effectively zero
    if (creditor.balance < 0.01) {
      creditorIdx++;
      continue;
    }
    if (debtor.balance < 0.01) {
      debtorIdx++;
      continue;
    }

    // Calculate transfer amount
    const amount = Math.min(creditor.balance, debtor.balance);
    const roundedAmount = Math.round(amount * 100) / 100;

    if (roundedAmount > 0) {
      debts.push({
        from: {
          memberId: debtor.memberId,
          userId: debtor.userId,
          displayName: debtor.displayName,
        },
        to: {
          memberId: creditor.memberId,
          userId: creditor.userId,
          displayName: creditor.displayName,
        },
        amount: roundedAmount,
      });
    }

    // Update balances
    creditor.balance -= amount;
    debtor.balance -= amount;

    // Move to next if exhausted
    if (creditor.balance < 0.01) {
      creditorIdx++;
    }
    if (debtor.balance < 0.01) {
      debtorIdx++;
    }
  }

  return debts;
}

/**
 * Get individual member balance with who they owe and who owes them
 * AC-3.7 to AC-3.9
 */
export async function getIndividualBalance(
  groupId: string,
  userId: string
): Promise<IndividualBalance | null> {
  // Get the group balances
  const groupBalances = await calculateGroupBalances(groupId);

  // Find the member
  const memberBalance = groupBalances.memberBalances.find(
    (b) => b.userId === userId
  );

  if (!memberBalance) {
    return null;
  }

  // Extract who this member owes (debts FROM this member)
  const owesTo = groupBalances.simplifiedDebts
    .filter((d) => d.from.userId === userId)
    .map((d) => ({
      memberId: d.to.memberId,
      userId: d.to.userId,
      displayName: d.to.displayName,
      amount: d.amount,
    }));

  // Extract who owes this member (debts TO this member)
  const owedBy = groupBalances.simplifiedDebts
    .filter((d) => d.to.userId === userId)
    .map((d) => ({
      memberId: d.from.memberId,
      userId: d.from.userId,
      displayName: d.from.displayName,
      amount: d.amount,
    }));

  return {
    memberId: memberBalance.memberId,
    userId: memberBalance.userId,
    displayName: memberBalance.displayName,
    totalPaid: memberBalance.totalPaid,
    totalOwed: memberBalance.totalOwed,
    netBalance: memberBalance.netBalance,
    owesTo,
    owedBy,
  };
}
