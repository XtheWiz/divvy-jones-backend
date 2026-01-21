/**
 * Settlements Workflow Integration Tests
 * E2E Test Plan - Phase 1
 *
 * Tests for /v1/groups/:groupId/settlements endpoints (create, confirm, reject, cancel)
 */

import { describe, it, expect, beforeAll, afterAll } from "bun:test";
import {
  beforeAllTests,
  afterAllTests,
  testId,
} from "./setup";
import {
  createTestUser,
  createTestGroup,
  addTestMember,
  createTestSettlement,
} from "./factories";
import {
  createTestApp,
  post,
  get,
  put,
  authHeader,
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

// ============================================================================
// Response Types
// ============================================================================

interface SettlementResponse {
  id: string;
  groupId?: string;
  payer: {
    userId: string;
    displayName: string;
  };
  payee: {
    userId: string;
    displayName: string;
  };
  amount: number;
  currency: string;
  status: string;
  note?: string;
  createdAt: string;
  settledAt?: string;
}

interface SettlementListResponse {
  success: boolean;
  data: SettlementResponse[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

// ============================================================================
// Helper: Login Test User
// ============================================================================

async function loginTestUser(user: { email: string | null; plainPassword: string }) {
  const loginResponse = await post<ApiResponse<{ tokens: { accessToken: string } }>>(
    app,
    "/v1/auth/login",
    { email: user.email, password: user.plainPassword }
  );
  return assertSuccess(loginResponse).tokens.accessToken;
}

// ============================================================================
// POST /v1/groups/:groupId/settlements Tests (Create Settlement)
// ============================================================================

describe("POST /v1/groups/:groupId/settlements", () => {
  it("should create pending settlement", async () => {
    // Arrange
    const owner = await createTestUser();
    const member = await createTestUser();
    const group = await createTestGroup(owner.id);
    await addTestMember(group.id, member.id, "member");
    const token = await loginTestUser(owner);

    // Act - Member pays owner
    const response = await post<ApiResponse<SettlementResponse>>(
      app,
      `/v1/groups/${group.id}/settlements`,
      {
        payerUserId: member.id,
        payeeUserId: owner.id,
        amount: 25.00,
        currency: "USD",
        note: "Test settlement",
      },
      { headers: authHeader(token) }
    );

    // Assert
    expect(response.status).toBe(201);
    const data = assertSuccess(response);
    expect(data.id).toBeDefined();
    expect(data.status).toBe("pending");
    expect(data.amount).toBe(25);
  });

  it("should reject self-payment (400)", async () => {
    // Arrange
    const owner = await createTestUser();
    const group = await createTestGroup(owner.id);
    const token = await loginTestUser(owner);

    // Act - Try to pay self
    const response = await post<ApiResponse>(
      app,
      `/v1/groups/${group.id}/settlements`,
      {
        payerUserId: owner.id,
        payeeUserId: owner.id,
        amount: 25.00,
      },
      { headers: authHeader(token) }
    );

    // Assert
    expect(response.status).toBe(400);
    expect(response.body.error?.message).toContain("same person");
  });

  it("should reject non-members as payer/payee (400)", async () => {
    // Arrange
    const owner = await createTestUser();
    const nonMember = await createTestUser();
    const group = await createTestGroup(owner.id);
    const token = await loginTestUser(owner);

    // Act - Try with non-member as payer
    const response = await post<ApiResponse>(
      app,
      `/v1/groups/${group.id}/settlements`,
      {
        payerUserId: nonMember.id,
        payeeUserId: owner.id,
        amount: 25.00,
      },
      { headers: authHeader(token) }
    );

    // Assert
    expect(response.status).toBe(400);
    expect(response.body.error?.message).toContain("not an active member");
  });
});

// ============================================================================
// PUT /v1/groups/:groupId/settlements/:settlementId/confirm Tests
// ============================================================================

describe("PUT /v1/groups/:groupId/settlements/:settlementId/confirm", () => {
  it("should confirm settlement as payee", async () => {
    // Arrange
    const owner = await createTestUser();
    const member = await createTestUser();
    const group = await createTestGroup(owner.id);
    const memberRecord = await addTestMember(group.id, member.id, "member");

    // Create settlement where member pays owner
    const settlement = await createTestSettlement(
      group.id,
      memberRecord.id,
      group.ownerMemberId,
      { amount: 50, status: "pending" }
    );

    // Payee (owner) confirms
    const ownerToken = await loginTestUser(owner);

    // Act
    const response = await put<ApiResponse<SettlementResponse>>(
      app,
      `/v1/groups/${group.id}/settlements/${settlement.id}/confirm`,
      {},
      { headers: authHeader(ownerToken) }
    );

    // Assert
    expect(response.status).toBe(200);
    const data = assertSuccess(response);
    expect(data.status).toBe("confirmed");
    expect(data.settledAt).toBeDefined();
  });

  it("should reject confirm from non-payee (400)", async () => {
    // Arrange
    const owner = await createTestUser();
    const member = await createTestUser();
    const thirdParty = await createTestUser();
    const group = await createTestGroup(owner.id);
    const memberRecord = await addTestMember(group.id, member.id, "member");
    await addTestMember(group.id, thirdParty.id, "member");

    // Create settlement where member pays owner
    const settlement = await createTestSettlement(
      group.id,
      memberRecord.id,
      group.ownerMemberId,
      { amount: 50, status: "pending" }
    );

    // Third party (not payee) tries to confirm
    const thirdPartyToken = await loginTestUser(thirdParty);

    // Act
    const response = await put<ApiResponse>(
      app,
      `/v1/groups/${group.id}/settlements/${settlement.id}/confirm`,
      {},
      { headers: authHeader(thirdPartyToken) }
    );

    // Assert
    expect(response.status).toBe(400);
    expect(response.body.error?.message).toContain("payee");
  });

  it("should reject confirm of non-pending settlement (400)", async () => {
    // Arrange
    const owner = await createTestUser();
    const member = await createTestUser();
    const group = await createTestGroup(owner.id);
    const memberRecord = await addTestMember(group.id, member.id, "member");

    // Create already confirmed settlement
    const settlement = await createTestSettlement(
      group.id,
      memberRecord.id,
      group.ownerMemberId,
      { amount: 50, status: "confirmed" }
    );

    const ownerToken = await loginTestUser(owner);

    // Act - Try to confirm again
    const response = await put<ApiResponse>(
      app,
      `/v1/groups/${group.id}/settlements/${settlement.id}/confirm`,
      {},
      { headers: authHeader(ownerToken) }
    );

    // Assert
    expect(response.status).toBe(400);
    expect(response.body.error?.message).toContain("status");
  });
});

// ============================================================================
// PUT /v1/groups/:groupId/settlements/:settlementId/reject Tests
// ============================================================================

describe("PUT /v1/groups/:groupId/settlements/:settlementId/reject", () => {
  it("should reject settlement with reason", async () => {
    // Arrange
    const owner = await createTestUser();
    const member = await createTestUser();
    const group = await createTestGroup(owner.id);
    const memberRecord = await addTestMember(group.id, member.id, "member");

    const settlement = await createTestSettlement(
      group.id,
      memberRecord.id,
      group.ownerMemberId,
      { amount: 50, status: "pending" }
    );

    const ownerToken = await loginTestUser(owner);

    // Act
    const response = await put<ApiResponse<SettlementResponse>>(
      app,
      `/v1/groups/${group.id}/settlements/${settlement.id}/reject`,
      { reason: "Payment not received" },
      { headers: authHeader(ownerToken) }
    );

    // Assert
    expect(response.status).toBe(200);
    const data = assertSuccess(response);
    expect(data.status).toBe("rejected");
    // Rejection reason is stored in note field with "Rejected: " prefix
    expect(data.note).toContain("Rejected: Payment not received");
  });

  it("should reject rejection from non-payee (400)", async () => {
    // Arrange
    const owner = await createTestUser();
    const member = await createTestUser();
    const thirdParty = await createTestUser();
    const group = await createTestGroup(owner.id);
    const memberRecord = await addTestMember(group.id, member.id, "member");
    await addTestMember(group.id, thirdParty.id, "member");

    const settlement = await createTestSettlement(
      group.id,
      memberRecord.id,
      group.ownerMemberId,
      { amount: 50, status: "pending" }
    );

    const thirdPartyToken = await loginTestUser(thirdParty);

    // Act
    const response = await put<ApiResponse>(
      app,
      `/v1/groups/${group.id}/settlements/${settlement.id}/reject`,
      { reason: "Some reason" },
      { headers: authHeader(thirdPartyToken) }
    );

    // Assert
    expect(response.status).toBe(400);
    expect(response.body.error?.message).toContain("payee");
  });
});

// ============================================================================
// PUT /v1/groups/:groupId/settlements/:settlementId/cancel Tests
// ============================================================================

describe("PUT /v1/groups/:groupId/settlements/:settlementId/cancel", () => {
  it("should cancel pending settlement as creator", async () => {
    // Arrange
    const owner = await createTestUser();
    const member = await createTestUser();
    const group = await createTestGroup(owner.id);
    const memberRecord = await addTestMember(group.id, member.id, "member");

    const settlement = await createTestSettlement(
      group.id,
      memberRecord.id,
      group.ownerMemberId,
      { amount: 50, status: "pending" }
    );

    // The payer can cancel
    const memberToken = await loginTestUser(member);

    // Act
    const response = await put<ApiResponse<SettlementResponse>>(
      app,
      `/v1/groups/${group.id}/settlements/${settlement.id}/cancel`,
      {},
      { headers: authHeader(memberToken) }
    );

    // Assert
    expect(response.status).toBe(200);
    const data = assertSuccess(response);
    expect(data.status).toBe("cancelled");
  });

  it("should reject cancel of confirmed settlement (400)", async () => {
    // Arrange
    const owner = await createTestUser();
    const member = await createTestUser();
    const group = await createTestGroup(owner.id);
    const memberRecord = await addTestMember(group.id, member.id, "member");

    const settlement = await createTestSettlement(
      group.id,
      memberRecord.id,
      group.ownerMemberId,
      { amount: 50, status: "confirmed" }
    );

    const memberToken = await loginTestUser(member);

    // Act
    const response = await put<ApiResponse>(
      app,
      `/v1/groups/${group.id}/settlements/${settlement.id}/cancel`,
      {},
      { headers: authHeader(memberToken) }
    );

    // Assert
    expect(response.status).toBe(400);
    expect(response.body.error?.message).toContain("status");
  });
});

// ============================================================================
// GET /v1/groups/:groupId/settlements Tests (List with Filters)
// ============================================================================

describe("GET /v1/groups/:groupId/settlements", () => {
  it("should list settlements with filters", async () => {
    // Arrange
    const owner = await createTestUser();
    const member = await createTestUser();
    const group = await createTestGroup(owner.id);
    const memberRecord = await addTestMember(group.id, member.id, "member");

    // Create multiple settlements with different statuses
    await createTestSettlement(group.id, memberRecord.id, group.ownerMemberId, { status: "pending", amount: 20 });
    await createTestSettlement(group.id, memberRecord.id, group.ownerMemberId, { status: "confirmed", amount: 30 });

    const ownerToken = await loginTestUser(owner);

    // Act - Filter by status
    const response = await get<SettlementListResponse>(
      app,
      `/v1/groups/${group.id}/settlements`,
      {
        headers: authHeader(ownerToken),
        query: { status: "pending" },
      }
    );

    // Assert
    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data).toBeDefined();
    // All returned settlements should be pending
    for (const settlement of response.body.data) {
      expect(settlement.status).toBe("pending");
    }
  });

  it("should show settlement in list after creation", async () => {
    // Arrange
    const owner = await createTestUser();
    const member = await createTestUser();
    const group = await createTestGroup(owner.id);
    await addTestMember(group.id, member.id, "member");
    const ownerToken = await loginTestUser(owner);

    // Create settlement via API
    const createResponse = await post<ApiResponse<SettlementResponse>>(
      app,
      `/v1/groups/${group.id}/settlements`,
      {
        payerUserId: member.id,
        payeeUserId: owner.id,
        amount: 75.00,
        note: "List test settlement",
      },
      { headers: authHeader(ownerToken) }
    );
    const created = assertSuccess(createResponse);

    // Act - List settlements
    const response = await get<SettlementListResponse>(
      app,
      `/v1/groups/${group.id}/settlements`,
      { headers: authHeader(ownerToken) }
    );

    // Assert
    expect(response.status).toBe(200);
    const found = response.body.data.find(s => s.id === created.id);
    expect(found).toBeDefined();
    expect(found?.amount).toBe(75);
  });
});
