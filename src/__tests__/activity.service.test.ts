/**
 * Activity Service Unit Tests
 * Sprint 004 - TASK-014
 *
 * Tests for activity logging and retrieval functionality.
 */

import { describe, test, expect } from "bun:test";
import { formatActivitySummary, type ActivityWithActor } from "../services/activity.service";

// ============================================================================
// Activity Summary Formatting Tests
// ============================================================================

describe("Activity Service - formatActivitySummary", () => {
  const baseActivity: ActivityWithActor = {
    id: "test-id",
    groupId: "group-1",
    actorMemberId: "member-1",
    action: "create",
    entityType: "expense",
    entityId: "entity-1",
    oldValues: null,
    newValues: null,
    createdAt: new Date(),
    actor: {
      id: "user-1",
      displayName: "John Doe",
    },
  };

  test("formats expense creation correctly", () => {
    const activity = { ...baseActivity, action: "create", entityType: "expense" };
    const summary = formatActivitySummary(activity);
    expect(summary).toBe("John Doe created an expense");
  });

  test("formats expense update correctly", () => {
    const activity = { ...baseActivity, action: "update", entityType: "expense" };
    const summary = formatActivitySummary(activity);
    expect(summary).toBe("John Doe updated an expense");
  });

  test("formats expense deletion correctly", () => {
    const activity = { ...baseActivity, action: "delete", entityType: "expense" };
    const summary = formatActivitySummary(activity);
    expect(summary).toBe("John Doe deleted an expense");
  });

  test("formats settlement creation correctly", () => {
    const activity = { ...baseActivity, action: "create", entityType: "settlement" };
    const summary = formatActivitySummary(activity);
    expect(summary).toBe("John Doe created a settlement");
  });

  test("formats settlement confirmation correctly", () => {
    const activity = { ...baseActivity, action: "confirm", entityType: "settlement" };
    const summary = formatActivitySummary(activity);
    expect(summary).toBe("John Doe confirmed a settlement");
  });

  test("formats settlement rejection correctly", () => {
    const activity = { ...baseActivity, action: "reject", entityType: "settlement" };
    const summary = formatActivitySummary(activity);
    expect(summary).toBe("John Doe rejected a settlement");
  });

  test("formats settlement cancellation correctly", () => {
    const activity = { ...baseActivity, action: "cancel", entityType: "settlement" };
    const summary = formatActivitySummary(activity);
    expect(summary).toBe("John Doe cancelled a settlement");
  });

  test("formats member join correctly", () => {
    const activity = { ...baseActivity, action: "join", entityType: "member" };
    const summary = formatActivitySummary(activity);
    expect(summary).toBe("John Doe joined the group");
  });

  test("formats member leave correctly", () => {
    const activity = { ...baseActivity, action: "leave", entityType: "member" };
    const summary = formatActivitySummary(activity);
    expect(summary).toBe("John Doe left the group");
  });

  test("formats attachment creation correctly", () => {
    const activity = { ...baseActivity, action: "create", entityType: "attachment" };
    const summary = formatActivitySummary(activity);
    expect(summary).toBe("John Doe created an attachment");
  });

  test("formats group update correctly", () => {
    const activity = { ...baseActivity, action: "update", entityType: "group" };
    const summary = formatActivitySummary(activity);
    expect(summary).toBe("John Doe updated the group");
  });

  test("uses System when actor is null", () => {
    const activity = { ...baseActivity, actor: null };
    const summary = formatActivitySummary(activity);
    expect(summary).toBe("System created an expense");
  });

  test("handles unknown action gracefully", () => {
    const activity = { ...baseActivity, action: "unknown_action" };
    const summary = formatActivitySummary(activity);
    expect(summary).toBe("John Doe unknown_action an expense");
  });

  test("handles unknown entity type gracefully", () => {
    const activity = { ...baseActivity, entityType: "unknown_type" };
    const summary = formatActivitySummary(activity);
    expect(summary).toBe("John Doe created unknown_type");
  });

  test("formats member invite correctly", () => {
    const activity = { ...baseActivity, action: "invite", entityType: "member" };
    const summary = formatActivitySummary(activity);
    expect(summary).toBe("John Doe invited the group");
  });

  test("formats member removal correctly", () => {
    const activity = { ...baseActivity, action: "remove", entityType: "member" };
    const summary = formatActivitySummary(activity);
    expect(summary).toBe("John Doe removed the group");
  });

  test("formats expense restore correctly", () => {
    const activity = { ...baseActivity, action: "restore", entityType: "expense" };
    const summary = formatActivitySummary(activity);
    expect(summary).toBe("John Doe restored an expense");
  });

  test("formats settle action correctly", () => {
    const activity = { ...baseActivity, action: "settle", entityType: "settlement" };
    const summary = formatActivitySummary(activity);
    expect(summary).toBe("John Doe settled a settlement");
  });

  test("formats approve action correctly", () => {
    const activity = { ...baseActivity, action: "approve", entityType: "expense" };
    const summary = formatActivitySummary(activity);
    expect(summary).toBe("John Doe approved an expense");
  });
});

// ============================================================================
// Activity Types Tests
// ============================================================================

describe("Activity Service - Entity Types", () => {
  test("expense entity type is supported", () => {
    const activity: ActivityWithActor = {
      id: "test-id",
      groupId: "group-1",
      actorMemberId: "member-1",
      action: "create",
      entityType: "expense",
      entityId: "entity-1",
      oldValues: null,
      newValues: null,
      createdAt: new Date(),
      actor: { id: "user-1", displayName: "Test User" },
    };
    const summary = formatActivitySummary(activity);
    expect(summary).toContain("an expense");
  });

  test("settlement entity type is supported", () => {
    const activity: ActivityWithActor = {
      id: "test-id",
      groupId: "group-1",
      actorMemberId: "member-1",
      action: "create",
      entityType: "settlement",
      entityId: "entity-1",
      oldValues: null,
      newValues: null,
      createdAt: new Date(),
      actor: { id: "user-1", displayName: "Test User" },
    };
    const summary = formatActivitySummary(activity);
    expect(summary).toContain("a settlement");
  });

  test("member entity type is supported", () => {
    const activity: ActivityWithActor = {
      id: "test-id",
      groupId: "group-1",
      actorMemberId: "member-1",
      action: "join",
      entityType: "member",
      entityId: "entity-1",
      oldValues: null,
      newValues: null,
      createdAt: new Date(),
      actor: { id: "user-1", displayName: "Test User" },
    };
    const summary = formatActivitySummary(activity);
    expect(summary).toContain("the group");
  });

  test("group entity type is supported", () => {
    const activity: ActivityWithActor = {
      id: "test-id",
      groupId: "group-1",
      actorMemberId: "member-1",
      action: "update",
      entityType: "group",
      entityId: "entity-1",
      oldValues: null,
      newValues: null,
      createdAt: new Date(),
      actor: { id: "user-1", displayName: "Test User" },
    };
    const summary = formatActivitySummary(activity);
    expect(summary).toContain("the group");
  });

  test("attachment entity type is supported", () => {
    const activity: ActivityWithActor = {
      id: "test-id",
      groupId: "group-1",
      actorMemberId: "member-1",
      action: "create",
      entityType: "attachment",
      entityId: "entity-1",
      oldValues: null,
      newValues: null,
      createdAt: new Date(),
      actor: { id: "user-1", displayName: "Test User" },
    };
    const summary = formatActivitySummary(activity);
    expect(summary).toContain("an attachment");
  });
});

// ============================================================================
// Action Verbs Tests
// ============================================================================

describe("Activity Service - Action Verbs", () => {
  const createActivity = (action: string): ActivityWithActor => ({
    id: "test-id",
    groupId: "group-1",
    actorMemberId: "member-1",
    action,
    entityType: "expense",
    entityId: "entity-1",
    oldValues: null,
    newValues: null,
    createdAt: new Date(),
    actor: { id: "user-1", displayName: "Actor" },
  });

  test("create maps to created", () => {
    const summary = formatActivitySummary(createActivity("create"));
    expect(summary).toContain("created");
  });

  test("update maps to updated", () => {
    const summary = formatActivitySummary(createActivity("update"));
    expect(summary).toContain("updated");
  });

  test("delete maps to deleted", () => {
    const summary = formatActivitySummary(createActivity("delete"));
    expect(summary).toContain("deleted");
  });

  test("restore maps to restored", () => {
    const summary = formatActivitySummary(createActivity("restore"));
    expect(summary).toContain("restored");
  });

  test("join maps to joined", () => {
    const summary = formatActivitySummary(createActivity("join"));
    expect(summary).toContain("joined");
  });

  test("leave maps to left", () => {
    const summary = formatActivitySummary(createActivity("leave"));
    expect(summary).toContain("left");
  });

  test("invite maps to invited", () => {
    const summary = formatActivitySummary(createActivity("invite"));
    expect(summary).toContain("invited");
  });

  test("remove maps to removed", () => {
    const summary = formatActivitySummary(createActivity("remove"));
    expect(summary).toContain("removed");
  });

  test("approve maps to approved", () => {
    const summary = formatActivitySummary(createActivity("approve"));
    expect(summary).toContain("approved");
  });

  test("reject maps to rejected", () => {
    const summary = formatActivitySummary(createActivity("reject"));
    expect(summary).toContain("rejected");
  });

  test("settle maps to settled", () => {
    const summary = formatActivitySummary(createActivity("settle"));
    expect(summary).toContain("settled");
  });

  test("confirm maps to confirmed", () => {
    const summary = formatActivitySummary(createActivity("confirm"));
    expect(summary).toContain("confirmed");
  });

  test("cancel maps to cancelled", () => {
    const summary = formatActivitySummary(createActivity("cancel"));
    expect(summary).toContain("cancelled");
  });
});

// ============================================================================
// Edge Cases
// ============================================================================

describe("Activity Service - Edge Cases", () => {
  test("handles empty display name with fallback to System", () => {
    const activity: ActivityWithActor = {
      id: "test-id",
      groupId: "group-1",
      actorMemberId: "member-1",
      action: "create",
      entityType: "expense",
      entityId: "entity-1",
      oldValues: null,
      newValues: null,
      createdAt: new Date(),
      actor: { id: "user-1", displayName: "" },
    };
    const summary = formatActivitySummary(activity);
    // Empty string is falsy, so falls back to "System"
    expect(summary).toBe("System created an expense");
  });

  test("handles actor with special characters in name", () => {
    const activity: ActivityWithActor = {
      id: "test-id",
      groupId: "group-1",
      actorMemberId: "member-1",
      action: "create",
      entityType: "expense",
      entityId: "entity-1",
      oldValues: null,
      newValues: null,
      createdAt: new Date(),
      actor: { id: "user-1", displayName: "John O'Connor-Smith" },
    };
    const summary = formatActivitySummary(activity);
    expect(summary).toBe("John O'Connor-Smith created an expense");
  });

  test("handles unicode characters in actor name", () => {
    const activity: ActivityWithActor = {
      id: "test-id",
      groupId: "group-1",
      actorMemberId: "member-1",
      action: "create",
      entityType: "expense",
      entityId: "entity-1",
      oldValues: null,
      newValues: null,
      createdAt: new Date(),
      actor: { id: "user-1", displayName: "田中太郎" },
    };
    const summary = formatActivitySummary(activity);
    expect(summary).toBe("田中太郎 created an expense");
  });
});
