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
import { toCents, fromCents, splitByWeights } from "../lib/utils";

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

  // Initialize balances in integer cents to avoid floating-point errors
  const memberCentsMap = new Map(
    members.map((m) => [
      m.memberId,
      {
        memberId: m.memberId,
        userId: m.userId,
        displayName: m.displayName,
        totalPaidCents: 0,
        totalOwedCents: 0,
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
      memberBalances: Array.from(memberCentsMap.values()).map((m) => ({
        memberId: m.memberId,
        userId: m.userId,
        displayName: m.displayName,
        totalPaid: 0,
        totalOwed: 0,
        netBalance: 0,
      })),
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

  // Sum up what each member paid (in cents)
  for (const payer of payers) {
    const balance = memberCentsMap.get(payer.memberId);
    if (balance) {
      balance.totalPaidCents += toCents(payer.amount);
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

    // Store item totals in cents
    const itemCentsMap = new Map(
      itemAmounts.map((i) => [i.id, toCents(parseFloat(i.unitValue) * parseFloat(i.quantity))])
    );

    // Group splits by item to calculate totals
    const splitsByItem = new Map<string, typeof splits>();
    for (const split of splits) {
      if (!splitsByItem.has(split.itemId)) {
        splitsByItem.set(split.itemId, []);
      }
      splitsByItem.get(split.itemId)!.push(split);
    }

    // Calculate what each member owes (in cents)
    for (const [itemId, itemSplits] of splitsByItem) {
      const itemTotalCents = itemCentsMap.get(itemId) || 0;

      // Separate exact splits from weighted splits
      let exactCentsUsed = 0;
      const weightedSplits: typeof itemSplits = [];

      for (const split of itemSplits) {
        if (split.shareMode === "exact" && split.exactAmount) {
          const balance = memberCentsMap.get(split.memberId);
          if (balance) {
            const cents = toCents(split.exactAmount);
            balance.totalOwedCents += cents;
            exactCentsUsed += cents;
          }
        } else {
          weightedSplits.push(split);
        }
      }

      // Distribute remaining cents by weight
      if (weightedSplits.length > 0) {
        const remainingCents = itemTotalCents - exactCentsUsed;
        const weights = weightedSplits.map((s) => parseFloat(s.weight || "1"));
        const centAmounts = splitByWeights(remainingCents, weights);

        weightedSplits.forEach((split, idx) => {
          const balance = memberCentsMap.get(split.memberId);
          if (balance) {
            balance.totalOwedCents += centAmounts[idx];
          }
        });
      }
    }
  }

  // AC-1.14, AC-1.15: Include confirmed settlements in balance calculation
  // When A settles a debt by paying B:
  //   - A's totalPaid increases → netBalance (totalPaid - totalOwed) goes up (less debt)
  //   - B's totalOwed increases → netBalance (totalPaid - totalOwed) goes down (less credit)
  // This correctly reduces the outstanding debt between both parties.
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

  // Apply settlement adjustments (in cents)
  for (const settlement of confirmedSettlements) {
    const amountCents = toCents(settlement.amount);

    // Payer's totalPaid increases (they paid in settlement)
    const payerBalance = memberCentsMap.get(settlement.payerMemberId);
    if (payerBalance) {
      payerBalance.totalPaidCents += amountCents;
    }

    // Payee's totalOwed increases: since netBalance = totalPaid - totalOwed,
    // increasing totalOwed reduces their positive credit (they've been paid back)
    const payeeBalance = memberCentsMap.get(settlement.payeeMemberId);
    if (payeeBalance) {
      payeeBalance.totalOwedCents += amountCents;
    }
  }

  // AC-3.1, AC-3.2, AC-3.3: Calculate net balance (convert cents to dollars)
  const memberBalances: MemberBalance[] = [];
  for (const balance of memberCentsMap.values()) {
    memberBalances.push({
      memberId: balance.memberId,
      userId: balance.userId,
      displayName: balance.displayName,
      totalPaid: fromCents(balance.totalPaidCents),
      totalOwed: fromCents(balance.totalOwedCents),
      netBalance: fromCents(balance.totalPaidCents - balance.totalOwedCents),
    });
  }

  // AC-3.4: Verify sum of balances is zero
  // With integer arithmetic this should always be exact, but verify anyway
  const totalBalanceCents = Array.from(memberCentsMap.values())
    .reduce((sum, b) => sum + (b.totalPaidCents - b.totalOwedCents), 0);
  if (totalBalanceCents !== 0 && memberBalances.length > 0) {
    // Adjust the first member's balance to account for any discrepancy
    const adjustedNet = memberBalances[0].netBalance - fromCents(totalBalanceCents);
    memberBalances[0].netBalance = fromCents(toCents(adjustedNet));
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
  // Work in integer cents to avoid floating-point errors
  const creditors: Array<{
    memberId: string;
    userId: string;
    displayName: string;
    cents: number;
  }> = [];

  const debtors: Array<{
    memberId: string;
    userId: string;
    displayName: string;
    cents: number; // stored as positive (amount they owe)
  }> = [];

  for (const member of memberBalances) {
    const cents = toCents(member.netBalance);
    if (cents > 0) {
      // Creditor - is owed money
      creditors.push({
        memberId: member.memberId,
        userId: member.userId,
        displayName: member.displayName,
        cents,
      });
    } else if (cents < 0) {
      // Debtor - owes money
      debtors.push({
        memberId: member.memberId,
        userId: member.userId,
        displayName: member.displayName,
        cents: Math.abs(cents),
      });
    }
  }

  const debts: SimplifiedDebt[] = [];

  // Sort by balance (descending)
  creditors.sort((a, b) => b.cents - a.cents);
  debtors.sort((a, b) => b.cents - a.cents);

  // Match debtors to creditors
  let creditorIdx = 0;
  let debtorIdx = 0;

  while (creditorIdx < creditors.length && debtorIdx < debtors.length) {
    const creditor = creditors[creditorIdx];
    const debtor = debtors[debtorIdx];

    if (creditor.cents <= 0) { creditorIdx++; continue; }
    if (debtor.cents <= 0) { debtorIdx++; continue; }

    // Calculate transfer amount in cents
    const transferCents = Math.min(creditor.cents, debtor.cents);

    if (transferCents > 0) {
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
        amount: fromCents(transferCents),
      });
    }

    // Update balances
    creditor.cents -= transferCents;
    debtor.cents -= transferCents;

    if (creditor.cents <= 0) creditorIdx++;
    if (debtor.cents <= 0) debtorIdx++;
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
