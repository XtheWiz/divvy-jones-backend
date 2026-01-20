/**
 * Settlement Integration Tests
 * Sprint 003 - TASK-014
 *
 * Tests for settlement endpoints:
 * - POST /v1/groups/:groupId/settlements
 * - GET /v1/groups/:groupId/settlements
 * - PUT /v1/groups/:groupId/settlements/:id/confirm
 * - PUT /v1/groups/:groupId/settlements/:id/reject
 * - GET /v1/groups/:groupId/balances (settlements affect balances)
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from "bun:test";
import {
  beforeAllTests,
  afterAllTests,
  cleanupTestData,
} from "./setup";
import {
  createTestUser,
  createTestGroup,
  addTestMember,
  createTestExpense,
  addTestSplits,
  createTestSettlement,
} from "./factories";
import {
  createTestApp,
  post,
  get,
  put,
  authHeader,
  loginUser,
  assertSuccess,
  assertError,
  type ApiResponse,
} from "./helpers";

// ============================================================================
// Test Setup
// ============================================================================

const app = createTestApp();

beforeAll(async () => {
  await beforeAllTests();
});

afterAll(async () => {
  await afterAllTests();
});

beforeEach(async () => {
  // Clean up between tests for isolation
  await cleanupTestData();
});

// ============================================================================
// Response Types
// ============================================================================

interface Settlement {
  id: string;
  groupId: string;
  payer: { userId: string; displayName: string };
  payee: { userId: string; displayName: string };
  amount: string;
  currency: string;
  status: string;
  note?: string;
  createdAt: string;
  settledAt?: string;
}

interface MemberBalance {
  memberId: string;
  userId: string;
  displayName: string;
  totalPaid: number;
  totalOwed: number;
  netBalance: number;
}

interface SimplifiedDebt {
  from: { userId: string; displayName: string };
  to: { userId: string; displayName: string };
  amount: number;
}

interface GroupBalances {
  groupId: string;
  currency: string;
  memberBalances: MemberBalance[];
  simplifiedDebts: SimplifiedDebt[];
  calculatedAt: string;
}

// ============================================================================
// Helper Functions
// ============================================================================

async function createGroupWithMembers() {
  // Create users
  const owner = await createTestUser({ displayName: "Owner" });
  const member = await createTestUser({ displayName: "Member" });

  // Create group
  const group = await createTestGroup(owner.id);

  // Add member
  const memberRecord = await addTestMember(group.id, member.id);

  // Login both users
  const ownerTokens = await loginUser(app, owner.email!, owner.plainPassword);
  const memberTokens = await loginUser(app, member.email!, member.plainPassword);

  return {
    owner: { ...owner, memberId: group.ownerMemberId, tokens: ownerTokens! },
    member: { ...member, memberId: memberRecord.id, tokens: memberTokens! },
    group,
  };
}

// ============================================================================
// POST /v1/groups/:groupId/settlements Tests
// ============================================================================

describe("POST /v1/groups/:groupId/settlements", () => {
  it("should create a settlement successfully", async () => {
    // Arrange
    const { owner, member, group } = await createGroupWithMembers();

    // Act - Owner creates settlement requesting payment from member
    const response = await post<ApiResponse<Settlement>>(
      app,
      `/v1/groups/${group.id}/settlements`,
      {
        payerUserId: member.id, // Member pays
        payeeUserId: owner.id,  // Owner receives
        amount: 50.00,
        note: "Dinner split",
      },
      { headers: authHeader(owner.tokens.accessToken) }
    );

    // Assert
    expect(response.status).toBe(201);
    expect(response.body.success).toBe(true);

    const settlement = assertSuccess(response);
    expect(settlement.payer.userId).toBe(member.id);
    expect(settlement.payee.userId).toBe(owner.id);
    expect(parseFloat(settlement.amount)).toBe(50.00);
    expect(settlement.status).toBe("pending");
    expect(settlement.note).toBe("Dinner split");
  });

  it("should return 400 for invalid amount (negative)", async () => {
    // Arrange
    const { owner, member, group } = await createGroupWithMembers();

    // Act
    const response = await post<ApiResponse>(
      app,
      `/v1/groups/${group.id}/settlements`,
      {
        payerUserId: member.id,
        payeeUserId: owner.id,
        amount: -10.00,
      },
      { headers: authHeader(owner.tokens.accessToken) }
    );

    // Assert
    expect(response.status).toBe(400);
    expect(response.body.success).toBe(false);
  });

  it("should return 400 when payer equals payee", async () => {
    // Arrange
    const { owner, group } = await createGroupWithMembers();

    // Act - Try to create settlement with same person as payer and payee
    const response = await post<ApiResponse>(
      app,
      `/v1/groups/${group.id}/settlements`,
      {
        payerUserId: owner.id,
        payeeUserId: owner.id,
        amount: 50.00,
      },
      { headers: authHeader(owner.tokens.accessToken) }
    );

    // Assert
    expect(response.status).toBe(400);
    expect(response.body.success).toBe(false);
    expect(response.body.error?.message).toContain("same person");
  });

  it("should return 403 for non-member user", async () => {
    // Arrange
    const { owner, group } = await createGroupWithMembers();
    const outsider = await createTestUser({ displayName: "Outsider" });
    const outsiderTokens = await loginUser(app, outsider.email!, outsider.plainPassword);

    // Act
    const response = await post<ApiResponse>(
      app,
      `/v1/groups/${group.id}/settlements`,
      {
        payerUserId: owner.id,
        payeeUserId: outsider.id,
        amount: 50.00,
      },
      { headers: authHeader(outsiderTokens!.accessToken) }
    );

    // Assert
    assertError(response, 403, "FORBIDDEN");
  });
});

// ============================================================================
// GET /v1/groups/:groupId/settlements Tests
// ============================================================================

describe("GET /v1/groups/:groupId/settlements", () => {
  it("should list all settlements in a group", async () => {
    // Arrange
    const { owner, member, group } = await createGroupWithMembers();

    // Create some settlements
    await createTestSettlement(group.id, owner.memberId, member.memberId, { amount: 25 });
    await createTestSettlement(group.id, member.memberId, owner.memberId, { amount: 30 });

    // Act
    const response = await get<ApiResponse<{ data: Settlement[] }>>(
      app,
      `/v1/groups/${group.id}/settlements`,
      { headers: authHeader(owner.tokens.accessToken) }
    );

    // Assert
    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data).toHaveLength(2);
  });

  it("should filter settlements by status", async () => {
    // Arrange
    const { owner, member, group } = await createGroupWithMembers();

    // Create settlements with different statuses
    await createTestSettlement(group.id, owner.memberId, member.memberId, {
      status: "pending",
      amount: 25
    });
    await createTestSettlement(group.id, member.memberId, owner.memberId, {
      status: "confirmed",
      amount: 30
    });

    // Act - Filter by pending status
    const response = await get<ApiResponse<Settlement[]>>(
      app,
      `/v1/groups/${group.id}/settlements`,
      {
        headers: authHeader(owner.tokens.accessToken),
        query: { status: "pending" }
      }
    );

    // Assert
    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data!).toHaveLength(1);
    expect(response.body.data![0].status).toBe("pending");
  });
});

// ============================================================================
// PUT /v1/groups/:groupId/settlements/:id/confirm Tests
// ============================================================================

describe("PUT /v1/groups/:groupId/settlements/:id/confirm", () => {
  it("should confirm a pending settlement as the payee", async () => {
    // Arrange
    const { owner, member, group } = await createGroupWithMembers();

    // Create a pending settlement (owner pays, member receives)
    const settlement = await createTestSettlement(
      group.id,
      owner.memberId, // payer
      member.memberId, // payee
      { status: "pending", amount: 75 }
    );

    // Act - Payee (member) confirms the settlement
    const response = await put<ApiResponse<Settlement>>(
      app,
      `/v1/groups/${group.id}/settlements/${settlement.id}/confirm`,
      {},
      { headers: authHeader(member.tokens.accessToken) }
    );

    // Assert
    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);

    const confirmed = assertSuccess(response);
    expect(confirmed.status).toBe("confirmed");
    expect(confirmed.settledAt).toBeDefined();
  });

  it("should return 400 when non-payee tries to confirm", async () => {
    // Arrange
    const { owner, member, group } = await createGroupWithMembers();

    // Create settlement where member receives
    const settlement = await createTestSettlement(
      group.id,
      owner.memberId, // payer
      member.memberId, // payee
      { status: "pending" }
    );

    // Act - Payer (owner) tries to confirm (only payee should confirm)
    const response = await put<ApiResponse>(
      app,
      `/v1/groups/${group.id}/settlements/${settlement.id}/confirm`,
      {},
      { headers: authHeader(owner.tokens.accessToken) }
    );

    // Assert
    expect(response.status).toBe(400);
    expect(response.body.success).toBe(false);
  });
});

// ============================================================================
// PUT /v1/groups/:groupId/settlements/:id/reject Tests
// ============================================================================

describe("PUT /v1/groups/:groupId/settlements/:id/reject", () => {
  it("should reject a pending settlement as the payee", async () => {
    // Arrange
    const { owner, member, group } = await createGroupWithMembers();

    // Create a pending settlement
    const settlement = await createTestSettlement(
      group.id,
      owner.memberId,
      member.memberId,
      { status: "pending", amount: 100 }
    );

    // Act - Payee (member) rejects the settlement with reason
    const response = await put<ApiResponse<Settlement>>(
      app,
      `/v1/groups/${group.id}/settlements/${settlement.id}/reject`,
      { reason: "Amount is incorrect" },
      { headers: authHeader(member.tokens.accessToken) }
    );

    // Assert
    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);

    const rejected = assertSuccess(response);
    expect(rejected.status).toBe("rejected");
  });

  it("should return 400 when rejecting an already confirmed settlement", async () => {
    // Arrange
    const { owner, member, group } = await createGroupWithMembers();

    // Create an already confirmed settlement
    const settlement = await createTestSettlement(
      group.id,
      owner.memberId,
      member.memberId,
      { status: "confirmed" }
    );

    // Act - Try to reject a confirmed settlement
    const response = await put<ApiResponse>(
      app,
      `/v1/groups/${group.id}/settlements/${settlement.id}/reject`,
      {},
      { headers: authHeader(member.tokens.accessToken) }
    );

    // Assert
    expect(response.status).toBe(400);
    expect(response.body.success).toBe(false);
  });
});

// ============================================================================
// Settlement Impact on Balances Tests
// ============================================================================

describe("Settlement Impact on Balances", () => {
  it("should reflect confirmed settlements in group balances", async () => {
    // Arrange
    const { owner, member, group } = await createGroupWithMembers();

    // Create an expense: Owner pays $100, split equally between owner and member
    // This means member owes owner $50
    const expense = await createTestExpense(
      group.id,
      owner.memberId,
      owner.memberId,
      { amount: 100 }
    );

    await addTestSplits(
      expense.itemId,
      [owner.memberId, member.memberId],
      "equal"
    );

    // Get initial balances - member should owe $50
    const initialResponse = await get<ApiResponse<GroupBalances>>(
      app,
      `/v1/groups/${group.id}/balances`,
      { headers: authHeader(owner.tokens.accessToken) }
    );

    expect(initialResponse.status).toBe(200);
    const initialBalances = assertSuccess(initialResponse);

    // Find member's balance
    const memberInitialBalance = initialBalances.memberBalances.find(
      (b) => b.userId === member.id
    );
    expect(memberInitialBalance?.netBalance).toBe(-50); // Owes $50

    // Now create and confirm a settlement: member pays owner $50
    const settlement = await createTestSettlement(
      group.id,
      member.memberId, // payer
      owner.memberId,  // payee
      { status: "confirmed", amount: 50 }
    );

    // Act - Get balances after settlement
    const finalResponse = await get<ApiResponse<GroupBalances>>(
      app,
      `/v1/groups/${group.id}/balances`,
      { headers: authHeader(owner.tokens.accessToken) }
    );

    // Assert
    expect(finalResponse.status).toBe(200);
    const finalBalances = assertSuccess(finalResponse);

    // Member's balance should now be $0 (paid off the debt)
    const memberFinalBalance = finalBalances.memberBalances.find(
      (b) => b.userId === member.id
    );
    expect(memberFinalBalance?.netBalance).toBe(0);

    // Owner's balance should also be $0
    const ownerFinalBalance = finalBalances.memberBalances.find(
      (b) => b.userId === owner.id
    );
    expect(ownerFinalBalance?.netBalance).toBe(0);
  });

  it("should not affect balances for pending settlements", async () => {
    // Arrange
    const { owner, member, group } = await createGroupWithMembers();

    // Create an expense: Owner pays $60, split equally
    const expense = await createTestExpense(
      group.id,
      owner.memberId,
      owner.memberId,
      { amount: 60 }
    );

    await addTestSplits(
      expense.itemId,
      [owner.memberId, member.memberId],
      "equal"
    );

    // Create a PENDING settlement (not confirmed)
    await createTestSettlement(
      group.id,
      member.memberId,
      owner.memberId,
      { status: "pending", amount: 30 }
    );

    // Act
    const response = await get<ApiResponse<GroupBalances>>(
      app,
      `/v1/groups/${group.id}/balances`,
      { headers: authHeader(owner.tokens.accessToken) }
    );

    // Assert - Balance should still show member owes $30 (pending doesn't count)
    expect(response.status).toBe(200);
    const balances = assertSuccess(response);

    const memberBalance = balances.memberBalances.find(
      (b) => b.userId === member.id
    );
    expect(memberBalance?.netBalance).toBe(-30); // Still owes $30
  });
});

// ============================================================================
// Authorization Tests
// ============================================================================

describe("Settlement Authorization", () => {
  it("should return 401 without authentication", async () => {
    // Arrange
    const { group } = await createGroupWithMembers();

    // Act - No auth header
    const response = await get<ApiResponse>(
      app,
      `/v1/groups/${group.id}/settlements`
    );

    // Assert
    expect(response.status).toBe(401);
  });

  it("should return 404 for non-existent group", async () => {
    // Arrange
    const { owner } = await createGroupWithMembers();
    const fakeGroupId = "00000000-0000-0000-0000-000000000000";

    // Act
    const response = await get<ApiResponse>(
      app,
      `/v1/groups/${fakeGroupId}/settlements`,
      { headers: authHeader(owner.tokens.accessToken) }
    );

    // Assert
    assertError(response, 404, "NOT_FOUND");
  });
});
