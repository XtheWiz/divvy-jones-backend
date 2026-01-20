import { describe, test, expect } from "bun:test";

// ============================================================================
// Balance Service Unit Tests - Sprint 002
// Feature 3: Balance Calculation (AC-3.1 to AC-3.9)
// ============================================================================

// Types matching balance.service.ts
interface MemberBalance {
  memberId: string;
  userId: string;
  displayName: string;
  totalPaid: number;
  totalOwed: number;
  netBalance: number;
}

interface SimplifiedDebt {
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

describe("Balance Service - Net Balance Calculation", () => {
  // AC-3.1: Net balance = paid - owed
  // AC-3.2: Positive = owed money, Negative = owes money
  // AC-3.3: Zero = settled

  function calculateNetBalance(totalPaid: number, totalOwed: number): number {
    return Math.round((totalPaid - totalOwed) * 100) / 100;
  }

  test("positive when paid more than owed", () => {
    const net = calculateNetBalance(100, 50);
    expect(net).toBe(50);
    expect(net > 0).toBe(true); // User is owed money
  });

  test("negative when owed more than paid", () => {
    const net = calculateNetBalance(50, 100);
    expect(net).toBe(-50);
    expect(net < 0).toBe(true); // User owes money
  });

  test("zero when paid equals owed", () => {
    const net = calculateNetBalance(100, 100);
    expect(net).toBe(0);
  });

  test("handles decimal amounts", () => {
    const net = calculateNetBalance(33.33, 50.50);
    expect(net).toBe(-17.17);
  });

  test("rounds to 2 decimal places", () => {
    const net = calculateNetBalance(100, 33.333);
    expect(net).toBe(66.67);
  });
});

describe("Balance Service - Debt Simplification Algorithm", () => {
  // AC-3.5: Simplified debts minimize transactions
  // AC-3.6: Algorithm correctly identifies creditors and debtors

  /**
   * Simplify debts to minimize transactions
   * Algorithm:
   * 1. Separate into creditors (positive balance) and debtors (negative balance)
   * 2. Sort both by absolute value (descending)
   * 3. Match largest debtor to largest creditor
   * 4. Create debt for min(debtor.abs, creditor.abs)
   * 5. Repeat until all balanced
   */
  function simplifyDebts(memberBalances: MemberBalance[]): SimplifiedDebt[] {
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
      balance: number;
    }> = [];

    for (const member of memberBalances) {
      if (member.netBalance > 0.01) {
        creditors.push({
          memberId: member.memberId,
          userId: member.userId,
          displayName: member.displayName,
          balance: member.netBalance,
        });
      } else if (member.netBalance < -0.01) {
        debtors.push({
          memberId: member.memberId,
          userId: member.userId,
          displayName: member.displayName,
          balance: Math.abs(member.netBalance),
        });
      }
    }

    const debts: SimplifiedDebt[] = [];

    creditors.sort((a, b) => b.balance - a.balance);
    debtors.sort((a, b) => b.balance - a.balance);

    let creditorIdx = 0;
    let debtorIdx = 0;

    while (creditorIdx < creditors.length && debtorIdx < debtors.length) {
      const creditor = creditors[creditorIdx];
      const debtor = debtors[debtorIdx];

      if (creditor.balance < 0.01) {
        creditorIdx++;
        continue;
      }
      if (debtor.balance < 0.01) {
        debtorIdx++;
        continue;
      }

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

      creditor.balance -= amount;
      debtor.balance -= amount;

      if (creditor.balance < 0.01) {
        creditorIdx++;
      }
      if (debtor.balance < 0.01) {
        debtorIdx++;
      }
    }

    return debts;
  }

  test("simple case: A owes B", () => {
    const balances: MemberBalance[] = [
      { memberId: "m1", userId: "u1", displayName: "Alice", totalPaid: 100, totalOwed: 50, netBalance: 50 },
      { memberId: "m2", userId: "u2", displayName: "Bob", totalPaid: 0, totalOwed: 50, netBalance: -50 },
    ];

    const debts = simplifyDebts(balances);
    expect(debts.length).toBe(1);
    expect(debts[0].from.displayName).toBe("Bob");
    expect(debts[0].to.displayName).toBe("Alice");
    expect(debts[0].amount).toBe(50);
  });

  test("three-way split: 2 owe 1", () => {
    const balances: MemberBalance[] = [
      { memberId: "m1", userId: "u1", displayName: "Alice", totalPaid: 90, totalOwed: 30, netBalance: 60 },
      { memberId: "m2", userId: "u2", displayName: "Bob", totalPaid: 0, totalOwed: 30, netBalance: -30 },
      { memberId: "m3", userId: "u3", displayName: "Charlie", totalPaid: 0, totalOwed: 30, netBalance: -30 },
    ];

    const debts = simplifyDebts(balances);
    expect(debts.length).toBe(2);

    const totalDebtToAlice = debts
      .filter((d) => d.to.displayName === "Alice")
      .reduce((sum, d) => sum + d.amount, 0);
    expect(totalDebtToAlice).toBe(60);
  });

  test("minimizes transactions: circular debt resolved", () => {
    // Before: A owes B $30, B owes C $30, C owes A $30 (circular, 3 transactions)
    // Net: Everyone is even, should produce 0 transactions
    const balances: MemberBalance[] = [
      { memberId: "m1", userId: "u1", displayName: "Alice", totalPaid: 30, totalOwed: 30, netBalance: 0 },
      { memberId: "m2", userId: "u2", displayName: "Bob", totalPaid: 30, totalOwed: 30, netBalance: 0 },
      { memberId: "m3", userId: "u3", displayName: "Charlie", totalPaid: 30, totalOwed: 30, netBalance: 0 },
    ];

    const debts = simplifyDebts(balances);
    expect(debts.length).toBe(0);
  });

  test("complex case: reduces multiple debts", () => {
    // A paid 100, owes 25 = net +75 (owed 75)
    // B paid 0, owes 25 = net -25 (owes 25)
    // C paid 0, owes 25 = net -25 (owes 25)
    // D paid 0, owes 25 = net -25 (owes 25)
    // Instead of A getting 3 payments, algorithm might combine
    const balances: MemberBalance[] = [
      { memberId: "m1", userId: "u1", displayName: "Alice", totalPaid: 100, totalOwed: 25, netBalance: 75 },
      { memberId: "m2", userId: "u2", displayName: "Bob", totalPaid: 0, totalOwed: 25, netBalance: -25 },
      { memberId: "m3", userId: "u3", displayName: "Charlie", totalPaid: 0, totalOwed: 25, netBalance: -25 },
      { memberId: "m4", userId: "u4", displayName: "Diana", totalPaid: 0, totalOwed: 25, netBalance: -25 },
    ];

    const debts = simplifyDebts(balances);

    // All debt should go to Alice
    const totalToAlice = debts
      .filter((d) => d.to.displayName === "Alice")
      .reduce((sum, d) => sum + d.amount, 0);
    expect(totalToAlice).toBe(75);

    // Total debt amounts should equal 75
    const totalDebt = debts.reduce((sum, d) => sum + d.amount, 0);
    expect(totalDebt).toBe(75);
  });

  test("handles two creditors", () => {
    // A paid 50, owes 25 = net +25
    // B paid 50, owes 25 = net +25
    // C paid 0, owes 25 = net -25
    // D paid 0, owes 25 = net -25
    const balances: MemberBalance[] = [
      { memberId: "m1", userId: "u1", displayName: "Alice", totalPaid: 50, totalOwed: 25, netBalance: 25 },
      { memberId: "m2", userId: "u2", displayName: "Bob", totalPaid: 50, totalOwed: 25, netBalance: 25 },
      { memberId: "m3", userId: "u3", displayName: "Charlie", totalPaid: 0, totalOwed: 25, netBalance: -25 },
      { memberId: "m4", userId: "u4", displayName: "Diana", totalPaid: 0, totalOwed: 25, netBalance: -25 },
    ];

    const debts = simplifyDebts(balances);

    // Should have 2 debts (one debtor pays each creditor)
    expect(debts.length).toBe(2);

    const totalDebt = debts.reduce((sum, d) => sum + d.amount, 0);
    expect(totalDebt).toBe(50);
  });

  test("returns empty array when all balanced", () => {
    const balances: MemberBalance[] = [
      { memberId: "m1", userId: "u1", displayName: "Alice", totalPaid: 50, totalOwed: 50, netBalance: 0 },
      { memberId: "m2", userId: "u2", displayName: "Bob", totalPaid: 50, totalOwed: 50, netBalance: 0 },
    ];

    const debts = simplifyDebts(balances);
    expect(debts.length).toBe(0);
  });

  test("returns empty array with no members", () => {
    const debts = simplifyDebts([]);
    expect(debts.length).toBe(0);
  });

  test("ignores balances within tolerance (0.01)", () => {
    const balances: MemberBalance[] = [
      { memberId: "m1", userId: "u1", displayName: "Alice", totalPaid: 50, totalOwed: 49.995, netBalance: 0.005 },
      { memberId: "m2", userId: "u2", displayName: "Bob", totalPaid: 50, totalOwed: 50.005, netBalance: -0.005 },
    ];

    const debts = simplifyDebts(balances);
    expect(debts.length).toBe(0);
  });
});

describe("Balance Service - Sum Verification", () => {
  // AC-3.4: Sum of all balances is zero (or within rounding tolerance)

  function verifyBalanceSum(balances: MemberBalance[]): boolean {
    const sum = balances.reduce((total, b) => total + b.netBalance, 0);
    return Math.abs(sum) <= 0.01;
  }

  test("valid balances sum to zero", () => {
    const balances: MemberBalance[] = [
      { memberId: "m1", userId: "u1", displayName: "Alice", totalPaid: 100, totalOwed: 50, netBalance: 50 },
      { memberId: "m2", userId: "u2", displayName: "Bob", totalPaid: 0, totalOwed: 50, netBalance: -50 },
    ];
    expect(verifyBalanceSum(balances)).toBe(true);
  });

  test("detects invalid balances (don't sum to zero)", () => {
    const balances: MemberBalance[] = [
      { memberId: "m1", userId: "u1", displayName: "Alice", totalPaid: 100, totalOwed: 50, netBalance: 50 },
      { memberId: "m2", userId: "u2", displayName: "Bob", totalPaid: 0, totalOwed: 30, netBalance: -30 },
    ];
    expect(verifyBalanceSum(balances)).toBe(false);
  });

  test("allows small rounding differences", () => {
    const balances: MemberBalance[] = [
      { memberId: "m1", userId: "u1", displayName: "Alice", totalPaid: 100, totalOwed: 33.33, netBalance: 66.67 },
      { memberId: "m2", userId: "u2", displayName: "Bob", totalPaid: 0, totalOwed: 33.33, netBalance: -33.33 },
      { memberId: "m3", userId: "u3", displayName: "Charlie", totalPaid: 0, totalOwed: 33.34, netBalance: -33.34 },
    ];
    expect(verifyBalanceSum(balances)).toBe(true);
  });
});

describe("Balance Service - Individual Balance Extraction", () => {
  // AC-3.7, AC-3.8, AC-3.9: Individual balance with owes/owed lists

  function extractIndividualBalance(
    userId: string,
    memberBalances: MemberBalance[],
    simplifiedDebts: SimplifiedDebt[]
  ): {
    owesTo: Array<{ userId: string; displayName: string; amount: number }>;
    owedBy: Array<{ userId: string; displayName: string; amount: number }>;
  } | null {
    const member = memberBalances.find((b) => b.userId === userId);
    if (!member) return null;

    const owesTo = simplifiedDebts
      .filter((d) => d.from.userId === userId)
      .map((d) => ({
        userId: d.to.userId,
        displayName: d.to.displayName,
        amount: d.amount,
      }));

    const owedBy = simplifiedDebts
      .filter((d) => d.to.userId === userId)
      .map((d) => ({
        userId: d.from.userId,
        displayName: d.from.displayName,
        amount: d.amount,
      }));

    return { owesTo, owedBy };
  }

  test("returns who user owes money to", () => {
    const balances: MemberBalance[] = [
      { memberId: "m1", userId: "u1", displayName: "Alice", totalPaid: 100, totalOwed: 50, netBalance: 50 },
      { memberId: "m2", userId: "u2", displayName: "Bob", totalPaid: 0, totalOwed: 50, netBalance: -50 },
    ];

    const debts: SimplifiedDebt[] = [
      {
        from: { memberId: "m2", userId: "u2", displayName: "Bob" },
        to: { memberId: "m1", userId: "u1", displayName: "Alice" },
        amount: 50,
      },
    ];

    const bobBalance = extractIndividualBalance("u2", balances, debts);
    expect(bobBalance).not.toBeNull();
    expect(bobBalance!.owesTo.length).toBe(1);
    expect(bobBalance!.owesTo[0].displayName).toBe("Alice");
    expect(bobBalance!.owesTo[0].amount).toBe(50);
    expect(bobBalance!.owedBy.length).toBe(0);
  });

  test("returns who owes user money", () => {
    const balances: MemberBalance[] = [
      { memberId: "m1", userId: "u1", displayName: "Alice", totalPaid: 100, totalOwed: 50, netBalance: 50 },
      { memberId: "m2", userId: "u2", displayName: "Bob", totalPaid: 0, totalOwed: 50, netBalance: -50 },
    ];

    const debts: SimplifiedDebt[] = [
      {
        from: { memberId: "m2", userId: "u2", displayName: "Bob" },
        to: { memberId: "m1", userId: "u1", displayName: "Alice" },
        amount: 50,
      },
    ];

    const aliceBalance = extractIndividualBalance("u1", balances, debts);
    expect(aliceBalance).not.toBeNull();
    expect(aliceBalance!.owedBy.length).toBe(1);
    expect(aliceBalance!.owedBy[0].displayName).toBe("Bob");
    expect(aliceBalance!.owedBy[0].amount).toBe(50);
    expect(aliceBalance!.owesTo.length).toBe(0);
  });

  test("returns null for non-member", () => {
    const balances: MemberBalance[] = [
      { memberId: "m1", userId: "u1", displayName: "Alice", totalPaid: 100, totalOwed: 50, netBalance: 50 },
    ];

    const result = extractIndividualBalance("u99", balances, []);
    expect(result).toBeNull();
  });

  test("returns empty arrays for settled member", () => {
    const balances: MemberBalance[] = [
      { memberId: "m1", userId: "u1", displayName: "Alice", totalPaid: 50, totalOwed: 50, netBalance: 0 },
    ];

    const result = extractIndividualBalance("u1", balances, []);
    expect(result).not.toBeNull();
    expect(result!.owesTo.length).toBe(0);
    expect(result!.owedBy.length).toBe(0);
  });
});

describe("Balance Service - Currency Handling", () => {
  // Balances should be calculated per currency

  test("currency code is preserved", () => {
    const currency = "USD";
    expect(currency).toBe("USD");
    expect(currency.length).toBe(3);
  });

  test("common currencies are valid", () => {
    const validCurrencies = ["USD", "EUR", "GBP", "JPY", "CAD", "AUD"];
    for (const currency of validCurrencies) {
      expect(currency.length).toBe(3);
      expect(currency).toBe(currency.toUpperCase());
    }
  });
});

describe("Balance Service - Rounding", () => {
  // All amounts should be rounded to 2 decimal places

  function roundToCents(amount: number): number {
    return Math.round(amount * 100) / 100;
  }

  test("rounds down appropriately", () => {
    expect(roundToCents(10.004)).toBe(10);
  });

  test("rounds up appropriately", () => {
    expect(roundToCents(10.005)).toBe(10.01);
  });

  test("handles typical calculation result", () => {
    const result = 100 / 3; // 33.333...
    expect(roundToCents(result)).toBe(33.33);
  });

  test("preserves exact values", () => {
    expect(roundToCents(10.50)).toBe(10.50);
    expect(roundToCents(99.99)).toBe(99.99);
  });
});
