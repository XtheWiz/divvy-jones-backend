/**
 * Attachment Integration Tests
 * Sprint 004 - TASK-015
 *
 * Tests for expense and settlement attachment endpoints:
 * - POST /v1/groups/:groupId/expenses/:expenseId/attachments
 * - GET /v1/groups/:groupId/expenses/:expenseId/attachments
 * - GET /v1/groups/:groupId/expenses/:expenseId/attachments/:attachmentId
 * - DELETE /v1/groups/:groupId/expenses/:expenseId/attachments/:attachmentId
 * - POST /v1/groups/:groupId/settlements/:settlementId/attachments
 * - GET /v1/groups/:groupId/settlements/:settlementId/attachments
 * - GET /v1/groups/:groupId/settlements/:settlementId/attachments/:attachmentId
 * - DELETE /v1/groups/:groupId/settlements/:settlementId/attachments/:attachmentId
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
  get,
  del,
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

// Note: Removed beforeEach cleanup to avoid race conditions when test files run in parallel.
// Each test creates fresh data. Cleanup happens in beforeAll/afterAll per file.

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Create a test file buffer with PNG-like content
 */
function createTestFileBuffer(size: number = 1024): Buffer {
  // PNG magic number: 89 50 4E 47 0D 0A 1A 0A
  const pngHeader = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const padding = Buffer.alloc(Math.max(0, size - pngHeader.length), 0);
  return Buffer.concat([pngHeader, padding]);
}

/**
 * Create a test PDF buffer
 */
function createTestPdfBuffer(size: number = 1024): Buffer {
  // PDF magic number: %PDF-
  const pdfHeader = Buffer.from("%PDF-1.4\n");
  const padding = Buffer.alloc(Math.max(0, size - pdfHeader.length), 0);
  return Buffer.concat([pdfHeader, padding]);
}

/**
 * Upload a file using multipart form data
 */
async function uploadFile(
  path: string,
  fileBuffer: Buffer,
  mimeType: string,
  filename: string,
  token: string
): Promise<{ status: number; body: ApiResponse<any> }> {
  // Create a Blob from the buffer
  const blob = new Blob([fileBuffer], { type: mimeType });
  const file = new File([blob], filename, { type: mimeType });

  // Create FormData
  const formData = new FormData();
  formData.append("file", file);

  // Make request using Elysia's handle method
  const response = await app.handle(
    new Request(`http://localhost${path}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
      },
      body: formData,
    })
  );

  const text = await response.text();
  let body: ApiResponse<any>;
  try {
    body = JSON.parse(text);
  } catch {
    body = { success: false, error: { code: "PARSE_ERROR", message: text } };
  }

  return { status: response.status, body };
}

/**
 * Create a group with members and login credentials
 */
async function createGroupWithMembers() {
  const owner = await createTestUser({ displayName: "Owner" });
  const member = await createTestUser({ displayName: "Member" });

  const group = await createTestGroup(owner.id);
  const memberRecord = await addTestMember(group.id, member.id);

  const ownerTokens = await loginUser(app, owner.email!, owner.plainPassword);
  const memberTokens = await loginUser(app, member.email!, member.plainPassword);

  return {
    owner: { ...owner, memberId: group.ownerMemberId, tokens: ownerTokens! },
    member: { ...member, memberId: memberRecord.id, tokens: memberTokens! },
    group,
  };
}

// ============================================================================
// Response Types
// ============================================================================

interface Attachment {
  id: string;
  mimeType: string;
  sizeBytes: number;
  downloadUrl: string;
  createdAt: string;
  createdBy?: {
    userId: string;
    displayName: string;
  };
}

// ============================================================================
// POST /groups/:groupId/expenses/:expenseId/attachments Tests
// ============================================================================

describe("POST /v1/groups/:groupId/expenses/:expenseId/attachments", () => {
  it("should upload an attachment to an expense (AC-1.1, AC-1.7)", async () => {
    // Arrange
    const { owner, group } = await createGroupWithMembers();
    const expense = await createTestExpense(
      group.id,
      owner.memberId,
      owner.memberId,
      { amount: 100 }
    );

    const fileBuffer = createTestFileBuffer(2048);

    // Act
    const response = await uploadFile(
      `/v1/groups/${group.id}/expenses/${expense.id}/attachments`,
      fileBuffer,
      "image/png",
      "receipt.png",
      owner.tokens.accessToken
    );

    // Assert
    expect(response.status).toBe(201);
    expect(response.body.success).toBe(true);
    expect(response.body.data).toHaveProperty("id");
    expect(response.body.data.mimeType).toBe("image/png");
    expect(response.body.data.sizeBytes).toBe(2048);
  });

  it("should allow group members to upload attachments (AC-1.12)", async () => {
    // Arrange
    const { owner, member, group } = await createGroupWithMembers();
    const expense = await createTestExpense(
      group.id,
      owner.memberId,
      owner.memberId,
      { amount: 100 }
    );

    const fileBuffer = createTestPdfBuffer(1024);

    // Act - Member uploads to owner's expense
    const response = await uploadFile(
      `/v1/groups/${group.id}/expenses/${expense.id}/attachments`,
      fileBuffer,
      "application/pdf",
      "receipt.pdf",
      member.tokens.accessToken
    );

    // Assert
    expect(response.status).toBe(201);
    expect(response.body.success).toBe(true);
  });

  it("should return 403 for non-group member (AC-1.12)", async () => {
    // Arrange
    const { owner, group } = await createGroupWithMembers();
    const expense = await createTestExpense(
      group.id,
      owner.memberId,
      owner.memberId,
      { amount: 100 }
    );

    const outsider = await createTestUser({ displayName: "Outsider" });
    const outsiderTokens = await loginUser(
      app,
      outsider.email!,
      outsider.plainPassword
    );

    const fileBuffer = createTestFileBuffer(1024);

    // Act
    const response = await uploadFile(
      `/v1/groups/${group.id}/expenses/${expense.id}/attachments`,
      fileBuffer,
      "image/png",
      "receipt.png",
      outsiderTokens!.accessToken
    );

    // Assert
    expect(response.status).toBe(403);
    expect(response.body.success).toBe(false);
  });

  it("should return 401 or 422 without authentication", async () => {
    // Arrange
    const { owner, group } = await createGroupWithMembers();
    const expense = await createTestExpense(
      group.id,
      owner.memberId,
      owner.memberId,
      { amount: 100 }
    );

    // Act - No token
    const response = await app.handle(
      new Request(
        `http://localhost/v1/groups/${group.id}/expenses/${expense.id}/attachments`,
        {
          method: "POST",
          body: new FormData(),
        }
      )
    );

    // Assert - Either 401 (auth before validation) or 422 (validation before auth) is acceptable
    expect([401, 422]).toContain(response.status);
  });

  it("should reject files over 10MB (AC-1.3)", async () => {
    // Arrange
    const { owner, group } = await createGroupWithMembers();
    const expense = await createTestExpense(
      group.id,
      owner.memberId,
      owner.memberId,
      { amount: 100 }
    );

    // Create 11MB file
    const largeBuffer = createTestFileBuffer(11 * 1024 * 1024);

    // Act
    const response = await uploadFile(
      `/v1/groups/${group.id}/expenses/${expense.id}/attachments`,
      largeBuffer,
      "image/png",
      "large.png",
      owner.tokens.accessToken
    );

    // Assert - Should be rejected by Elysia validation (TypeBox returns 422)
    expect([400, 422]).toContain(response.status);
  });

  it("should reject unsupported file types (AC-1.4)", async () => {
    // Arrange
    const { owner, group } = await createGroupWithMembers();
    const expense = await createTestExpense(
      group.id,
      owner.memberId,
      owner.memberId,
      { amount: 100 }
    );

    const textBuffer = Buffer.from("This is a text file");

    // Act - Try to upload a text file
    const response = await uploadFile(
      `/v1/groups/${group.id}/expenses/${expense.id}/attachments`,
      textBuffer,
      "text/plain",
      "notes.txt",
      owner.tokens.accessToken
    );

    // Assert
    expect(response.status).toBe(400);
    expect(response.body.success).toBe(false);
    expect(response.body.error?.message).toContain("not allowed");
  });

  it("should enforce 5 attachment limit per expense (AC-1.5)", async () => {
    // Arrange
    const { owner, group } = await createGroupWithMembers();
    const expense = await createTestExpense(
      group.id,
      owner.memberId,
      owner.memberId,
      { amount: 100 }
    );

    const fileBuffer = createTestFileBuffer(512);

    // Upload 5 attachments successfully
    for (let i = 0; i < 5; i++) {
      const result = await uploadFile(
        `/v1/groups/${group.id}/expenses/${expense.id}/attachments`,
        fileBuffer,
        "image/png",
        `receipt${i}.png`,
        owner.tokens.accessToken
      );
      expect(result.status).toBe(201);
    }

    // Act - Try to upload 6th attachment
    const response = await uploadFile(
      `/v1/groups/${group.id}/expenses/${expense.id}/attachments`,
      fileBuffer,
      "image/png",
      "receipt6.png",
      owner.tokens.accessToken
    );

    // Assert
    expect(response.status).toBe(400);
    expect(response.body.success).toBe(false);
    expect(response.body.error?.message).toContain("Maximum");
  });
});

// ============================================================================
// GET /groups/:groupId/expenses/:expenseId/attachments Tests
// ============================================================================

describe("GET /v1/groups/:groupId/expenses/:expenseId/attachments", () => {
  it("should list all attachments for an expense (AC-1.8)", async () => {
    // Arrange
    const { owner, group } = await createGroupWithMembers();
    const expense = await createTestExpense(
      group.id,
      owner.memberId,
      owner.memberId,
      { amount: 100 }
    );

    const fileBuffer = createTestFileBuffer(1024);

    // Upload 2 attachments
    await uploadFile(
      `/v1/groups/${group.id}/expenses/${expense.id}/attachments`,
      fileBuffer,
      "image/png",
      "receipt1.png",
      owner.tokens.accessToken
    );
    await uploadFile(
      `/v1/groups/${group.id}/expenses/${expense.id}/attachments`,
      createTestPdfBuffer(1024),
      "application/pdf",
      "receipt2.pdf",
      owner.tokens.accessToken
    );

    // Act
    const response = await get<ApiResponse<Attachment[]>>(
      app,
      `/v1/groups/${group.id}/expenses/${expense.id}/attachments`,
      { headers: authHeader(owner.tokens.accessToken) }
    );

    // Assert
    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data).toHaveLength(2);
    expect(response.body.data![0]).toHaveProperty("id");
    expect(response.body.data![0]).toHaveProperty("mimeType");
    expect(response.body.data![0]).toHaveProperty("sizeBytes");
    expect(response.body.data![0]).toHaveProperty("downloadUrl");
  });

  it("should return empty array for expense with no attachments", async () => {
    // Arrange
    const { owner, group } = await createGroupWithMembers();
    const expense = await createTestExpense(
      group.id,
      owner.memberId,
      owner.memberId,
      { amount: 100 }
    );

    // Act
    const response = await get<ApiResponse<Attachment[]>>(
      app,
      `/v1/groups/${group.id}/expenses/${expense.id}/attachments`,
      { headers: authHeader(owner.tokens.accessToken) }
    );

    // Assert
    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data).toHaveLength(0);
  });

  it("should return 403 for non-group member (AC-1.12)", async () => {
    // Arrange
    const { owner, group } = await createGroupWithMembers();
    const expense = await createTestExpense(
      group.id,
      owner.memberId,
      owner.memberId,
      { amount: 100 }
    );

    const outsider = await createTestUser({ displayName: "Outsider" });
    const outsiderTokens = await loginUser(
      app,
      outsider.email!,
      outsider.plainPassword
    );

    // Act
    const response = await get<ApiResponse>(
      app,
      `/v1/groups/${group.id}/expenses/${expense.id}/attachments`,
      { headers: authHeader(outsiderTokens!.accessToken) }
    );

    // Assert
    assertError(response, 403, "FORBIDDEN");
  });
});

// ============================================================================
// GET /groups/:groupId/expenses/:expenseId/attachments/:attachmentId Tests
// ============================================================================

describe("GET /v1/groups/:groupId/expenses/:expenseId/attachments/:attachmentId", () => {
  it("should download an attachment (AC-1.9)", async () => {
    // Arrange
    const { owner, group } = await createGroupWithMembers();
    const expense = await createTestExpense(
      group.id,
      owner.memberId,
      owner.memberId,
      { amount: 100 }
    );

    const originalBuffer = createTestFileBuffer(2048);
    const uploadResponse = await uploadFile(
      `/v1/groups/${group.id}/expenses/${expense.id}/attachments`,
      originalBuffer,
      "image/png",
      "receipt.png",
      owner.tokens.accessToken
    );
    const attachmentId = uploadResponse.body.data.id;

    // Act
    const response = await app.handle(
      new Request(
        `http://localhost/v1/groups/${group.id}/expenses/${expense.id}/attachments/${attachmentId}`,
        {
          method: "GET",
          headers: {
            Authorization: `Bearer ${owner.tokens.accessToken}`,
          },
        }
      )
    );

    // Assert
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("image/png");

    const downloadedBuffer = Buffer.from(await response.arrayBuffer());
    expect(downloadedBuffer.length).toBe(originalBuffer.length);
  });

  it("should return 404 for non-existent attachment", async () => {
    // Arrange
    const { owner, group } = await createGroupWithMembers();
    const expense = await createTestExpense(
      group.id,
      owner.memberId,
      owner.memberId,
      { amount: 100 }
    );
    const fakeAttachmentId = "00000000-0000-0000-0000-000000000000";

    // Act
    const response = await get<ApiResponse>(
      app,
      `/v1/groups/${group.id}/expenses/${expense.id}/attachments/${fakeAttachmentId}`,
      { headers: authHeader(owner.tokens.accessToken) }
    );

    // Assert
    assertError(response, 404, "NOT_FOUND");
  });

  it("should return 403 for non-group member (AC-1.12)", async () => {
    // Arrange
    const { owner, group } = await createGroupWithMembers();
    const expense = await createTestExpense(
      group.id,
      owner.memberId,
      owner.memberId,
      { amount: 100 }
    );

    const uploadResponse = await uploadFile(
      `/v1/groups/${group.id}/expenses/${expense.id}/attachments`,
      createTestFileBuffer(1024),
      "image/png",
      "receipt.png",
      owner.tokens.accessToken
    );
    const attachmentId = uploadResponse.body.data.id;

    const outsider = await createTestUser({ displayName: "Outsider" });
    const outsiderTokens = await loginUser(
      app,
      outsider.email!,
      outsider.plainPassword
    );

    // Act
    const response = await get<ApiResponse>(
      app,
      `/v1/groups/${group.id}/expenses/${expense.id}/attachments/${attachmentId}`,
      { headers: authHeader(outsiderTokens!.accessToken) }
    );

    // Assert
    assertError(response, 403, "FORBIDDEN");
  });
});

// ============================================================================
// DELETE /groups/:groupId/expenses/:expenseId/attachments/:attachmentId Tests
// ============================================================================

describe("DELETE /v1/groups/:groupId/expenses/:expenseId/attachments/:attachmentId", () => {
  it("should delete an attachment as expense creator (AC-1.10, AC-1.11)", async () => {
    // Arrange
    const { owner, group } = await createGroupWithMembers();
    const expense = await createTestExpense(
      group.id,
      owner.memberId,
      owner.memberId,
      { amount: 100 }
    );

    const uploadResponse = await uploadFile(
      `/v1/groups/${group.id}/expenses/${expense.id}/attachments`,
      createTestFileBuffer(1024),
      "image/png",
      "receipt.png",
      owner.tokens.accessToken
    );
    const attachmentId = uploadResponse.body.data.id;

    // Act
    const response = await del<ApiResponse>(
      app,
      `/v1/groups/${group.id}/expenses/${expense.id}/attachments/${attachmentId}`,
      { headers: authHeader(owner.tokens.accessToken) }
    );

    // Assert
    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);

    // Verify attachment is deleted
    const listResponse = await get<ApiResponse<Attachment[]>>(
      app,
      `/v1/groups/${group.id}/expenses/${expense.id}/attachments`,
      { headers: authHeader(owner.tokens.accessToken) }
    );
    expect(listResponse.body.data).toHaveLength(0);
  });

  it("should return 403 when non-creator tries to delete (AC-1.11)", async () => {
    // Arrange
    const { owner, member, group } = await createGroupWithMembers();
    const expense = await createTestExpense(
      group.id,
      owner.memberId,
      owner.memberId,
      { amount: 100 }
    );

    const uploadResponse = await uploadFile(
      `/v1/groups/${group.id}/expenses/${expense.id}/attachments`,
      createTestFileBuffer(1024),
      "image/png",
      "receipt.png",
      owner.tokens.accessToken
    );
    const attachmentId = uploadResponse.body.data.id;

    // Act - Member tries to delete owner's attachment
    const response = await del<ApiResponse>(
      app,
      `/v1/groups/${group.id}/expenses/${expense.id}/attachments/${attachmentId}`,
      { headers: authHeader(member.tokens.accessToken) }
    );

    // Assert
    assertError(response, 403, "FORBIDDEN");
  });

  it("should return 404 for non-existent attachment", async () => {
    // Arrange
    const { owner, group } = await createGroupWithMembers();
    const expense = await createTestExpense(
      group.id,
      owner.memberId,
      owner.memberId,
      { amount: 100 }
    );
    const fakeAttachmentId = "00000000-0000-0000-0000-000000000000";

    // Act
    const response = await del<ApiResponse>(
      app,
      `/v1/groups/${group.id}/expenses/${expense.id}/attachments/${fakeAttachmentId}`,
      { headers: authHeader(owner.tokens.accessToken) }
    );

    // Assert
    assertError(response, 404, "NOT_FOUND");
  });
});

// ============================================================================
// Settlement Attachment Tests
// ============================================================================

describe("POST /v1/groups/:groupId/settlements/:settlementId/attachments", () => {
  it("should allow payer to upload attachment (AC-1.14, AC-1.18)", async () => {
    // Arrange
    const { owner, member, group } = await createGroupWithMembers();

    // Create settlement where member pays owner
    const settlement = await createTestSettlement(
      group.id,
      member.memberId, // payer
      owner.memberId, // payee
      { status: "pending", amount: 50 }
    );

    const fileBuffer = createTestFileBuffer(1024);

    // Act - Payer (member) uploads
    const response = await uploadFile(
      `/v1/groups/${group.id}/settlements/${settlement.id}/attachments`,
      fileBuffer,
      "image/png",
      "payment-proof.png",
      member.tokens.accessToken
    );

    // Assert
    expect(response.status).toBe(201);
    expect(response.body.success).toBe(true);
    expect(response.body.data.mimeType).toBe("image/png");
  });

  it("should return 403 when non-payer tries to upload (AC-1.18)", async () => {
    // Arrange
    const { owner, member, group } = await createGroupWithMembers();

    // Create settlement where member pays owner
    const settlement = await createTestSettlement(
      group.id,
      member.memberId, // payer
      owner.memberId, // payee
      { status: "pending", amount: 50 }
    );

    const fileBuffer = createTestFileBuffer(1024);

    // Act - Payee (owner) tries to upload
    const response = await uploadFile(
      `/v1/groups/${group.id}/settlements/${settlement.id}/attachments`,
      fileBuffer,
      "image/png",
      "payment-proof.png",
      owner.tokens.accessToken
    );

    // Assert
    expect(response.status).toBe(403);
    expect(response.body.success).toBe(false);
  });

  it("should enforce 3 attachment limit per settlement", async () => {
    // Arrange
    const { owner, member, group } = await createGroupWithMembers();
    const settlement = await createTestSettlement(
      group.id,
      member.memberId,
      owner.memberId,
      { status: "pending", amount: 50 }
    );

    const fileBuffer = createTestFileBuffer(512);

    // Upload 3 attachments successfully
    for (let i = 0; i < 3; i++) {
      const result = await uploadFile(
        `/v1/groups/${group.id}/settlements/${settlement.id}/attachments`,
        fileBuffer,
        "image/png",
        `proof${i}.png`,
        member.tokens.accessToken
      );
      expect(result.status).toBe(201);
    }

    // Act - Try to upload 4th attachment
    const response = await uploadFile(
      `/v1/groups/${group.id}/settlements/${settlement.id}/attachments`,
      fileBuffer,
      "image/png",
      "proof4.png",
      member.tokens.accessToken
    );

    // Assert
    expect(response.status).toBe(400);
    expect(response.body.success).toBe(false);
    expect(response.body.error?.message).toContain("Maximum");
  });
});

describe("GET /v1/groups/:groupId/settlements/:settlementId/attachments", () => {
  it("should list settlement attachments for group members (AC-1.15)", async () => {
    // Arrange
    const { owner, member, group } = await createGroupWithMembers();
    const settlement = await createTestSettlement(
      group.id,
      member.memberId,
      owner.memberId,
      { status: "pending", amount: 50 }
    );

    // Payer uploads an attachment
    await uploadFile(
      `/v1/groups/${group.id}/settlements/${settlement.id}/attachments`,
      createTestFileBuffer(1024),
      "image/png",
      "payment-proof.png",
      member.tokens.accessToken
    );

    // Act - Payee (owner) lists attachments
    const response = await get<ApiResponse<Attachment[]>>(
      app,
      `/v1/groups/${group.id}/settlements/${settlement.id}/attachments`,
      { headers: authHeader(owner.tokens.accessToken) }
    );

    // Assert
    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data).toHaveLength(1);
  });

  it("should return 403 for non-group member", async () => {
    // Arrange
    const { owner, member, group } = await createGroupWithMembers();
    const settlement = await createTestSettlement(
      group.id,
      member.memberId,
      owner.memberId,
      { status: "pending", amount: 50 }
    );

    const outsider = await createTestUser({ displayName: "Outsider" });
    const outsiderTokens = await loginUser(
      app,
      outsider.email!,
      outsider.plainPassword
    );

    // Act
    const response = await get<ApiResponse>(
      app,
      `/v1/groups/${group.id}/settlements/${settlement.id}/attachments`,
      { headers: authHeader(outsiderTokens!.accessToken) }
    );

    // Assert
    assertError(response, 403, "FORBIDDEN");
  });
});

describe("GET /v1/groups/:groupId/settlements/:settlementId/attachments/:attachmentId", () => {
  it("should download settlement attachment (AC-1.16)", async () => {
    // Arrange
    const { owner, member, group } = await createGroupWithMembers();
    const settlement = await createTestSettlement(
      group.id,
      member.memberId,
      owner.memberId,
      { status: "pending", amount: 50 }
    );

    const originalBuffer = createTestPdfBuffer(2048);
    const uploadResponse = await uploadFile(
      `/v1/groups/${group.id}/settlements/${settlement.id}/attachments`,
      originalBuffer,
      "application/pdf",
      "payment-proof.pdf",
      member.tokens.accessToken
    );
    const attachmentId = uploadResponse.body.data.id;

    // Act - Payee downloads
    const response = await app.handle(
      new Request(
        `http://localhost/v1/groups/${group.id}/settlements/${settlement.id}/attachments/${attachmentId}`,
        {
          method: "GET",
          headers: {
            Authorization: `Bearer ${owner.tokens.accessToken}`,
          },
        }
      )
    );

    // Assert
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("application/pdf");

    const downloadedBuffer = Buffer.from(await response.arrayBuffer());
    expect(downloadedBuffer.length).toBe(originalBuffer.length);
  });
});

describe("DELETE /v1/groups/:groupId/settlements/:settlementId/attachments/:attachmentId", () => {
  it("should allow payer to delete attachment (AC-1.17, AC-1.18)", async () => {
    // Arrange
    const { owner, member, group } = await createGroupWithMembers();
    const settlement = await createTestSettlement(
      group.id,
      member.memberId,
      owner.memberId,
      { status: "pending", amount: 50 }
    );

    const uploadResponse = await uploadFile(
      `/v1/groups/${group.id}/settlements/${settlement.id}/attachments`,
      createTestFileBuffer(1024),
      "image/png",
      "payment-proof.png",
      member.tokens.accessToken
    );
    const attachmentId = uploadResponse.body.data.id;

    // Act - Payer deletes
    const response = await del<ApiResponse>(
      app,
      `/v1/groups/${group.id}/settlements/${settlement.id}/attachments/${attachmentId}`,
      { headers: authHeader(member.tokens.accessToken) }
    );

    // Assert
    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
  });

  it("should return 403 when non-payer tries to delete (AC-1.18)", async () => {
    // Arrange
    const { owner, member, group } = await createGroupWithMembers();
    const settlement = await createTestSettlement(
      group.id,
      member.memberId,
      owner.memberId,
      { status: "pending", amount: 50 }
    );

    const uploadResponse = await uploadFile(
      `/v1/groups/${group.id}/settlements/${settlement.id}/attachments`,
      createTestFileBuffer(1024),
      "image/png",
      "payment-proof.png",
      member.tokens.accessToken
    );
    const attachmentId = uploadResponse.body.data.id;

    // Act - Payee tries to delete
    const response = await del<ApiResponse>(
      app,
      `/v1/groups/${group.id}/settlements/${settlement.id}/attachments/${attachmentId}`,
      { headers: authHeader(owner.tokens.accessToken) }
    );

    // Assert
    assertError(response, 403, "FORBIDDEN");
  });
});

// ============================================================================
// File Type Validation Tests
// ============================================================================

describe("Attachment File Type Validation", () => {
  it("should accept JPEG files", async () => {
    // Arrange
    const { owner, group } = await createGroupWithMembers();
    const expense = await createTestExpense(
      group.id,
      owner.memberId,
      owner.memberId,
      { amount: 100 }
    );

    // JPEG magic number: FF D8 FF
    const jpegBuffer = Buffer.alloc(1024);
    jpegBuffer[0] = 0xff;
    jpegBuffer[1] = 0xd8;
    jpegBuffer[2] = 0xff;

    // Act
    const response = await uploadFile(
      `/v1/groups/${group.id}/expenses/${expense.id}/attachments`,
      jpegBuffer,
      "image/jpeg",
      "receipt.jpg",
      owner.tokens.accessToken
    );

    // Assert
    expect(response.status).toBe(201);
  });

  it("should accept PDF files", async () => {
    // Arrange
    const { owner, group } = await createGroupWithMembers();
    const expense = await createTestExpense(
      group.id,
      owner.memberId,
      owner.memberId,
      { amount: 100 }
    );

    const pdfBuffer = createTestPdfBuffer(1024);

    // Act
    const response = await uploadFile(
      `/v1/groups/${group.id}/expenses/${expense.id}/attachments`,
      pdfBuffer,
      "application/pdf",
      "receipt.pdf",
      owner.tokens.accessToken
    );

    // Assert
    expect(response.status).toBe(201);
    expect(response.body.data.mimeType).toBe("application/pdf");
  });

  it("should reject executable files", async () => {
    // Arrange
    const { owner, group } = await createGroupWithMembers();
    const expense = await createTestExpense(
      group.id,
      owner.memberId,
      owner.memberId,
      { amount: 100 }
    );

    const exeBuffer = Buffer.from("MZ"); // DOS executable magic

    // Act
    const response = await uploadFile(
      `/v1/groups/${group.id}/expenses/${expense.id}/attachments`,
      exeBuffer,
      "application/x-msdownload",
      "malware.exe",
      owner.tokens.accessToken
    );

    // Assert
    expect(response.status).toBe(400);
    expect(response.body.error?.message).toContain("not allowed");
  });

  it("should reject HTML files", async () => {
    // Arrange
    const { owner, group } = await createGroupWithMembers();
    const expense = await createTestExpense(
      group.id,
      owner.memberId,
      owner.memberId,
      { amount: 100 }
    );

    const htmlBuffer = Buffer.from("<html><script>alert('xss')</script></html>");

    // Act
    const response = await uploadFile(
      `/v1/groups/${group.id}/expenses/${expense.id}/attachments`,
      htmlBuffer,
      "text/html",
      "page.html",
      owner.tokens.accessToken
    );

    // Assert
    expect(response.status).toBe(400);
    expect(response.body.error?.message).toContain("not allowed");
  });
});
