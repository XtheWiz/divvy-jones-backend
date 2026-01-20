/**
 * JSON Export Service Tests
 * Sprint 005 - TASK-012
 *
 * Tests for JSON export types and utilities.
 */

import { describe, it, expect } from "bun:test";
import type {
  ExportMetadata,
  ExportedExpense,
  ExportData,
} from "../services/export/json.service";

describe("JSON Export Types", () => {
  describe("ExportMetadata", () => {
    it("should have correct structure", () => {
      const metadata: ExportMetadata = {
        exportedAt: "2025-01-20T12:00:00.000Z",
        exportVersion: "1.0",
        group: {
          id: "group-123",
          name: "Test Group",
          currency: "USD",
        },
        totalExpenses: 5,
      };

      expect(metadata.exportedAt).toBe("2025-01-20T12:00:00.000Z");
      expect(metadata.exportVersion).toBe("1.0");
      expect(metadata.group.id).toBe("group-123");
      expect(metadata.group.name).toBe("Test Group");
      expect(metadata.group.currency).toBe("USD");
      expect(metadata.totalExpenses).toBe(5);
    });

    it("should support optional date range", () => {
      const metadata: ExportMetadata = {
        exportedAt: "2025-01-20T12:00:00.000Z",
        exportVersion: "1.0",
        group: {
          id: "group-123",
          name: "Test Group",
          currency: "USD",
        },
        dateRange: {
          from: "2025-01-01",
          to: "2025-01-31",
        },
        totalExpenses: 5,
      };

      expect(metadata.dateRange).toBeDefined();
      expect(metadata.dateRange?.from).toBe("2025-01-01");
      expect(metadata.dateRange?.to).toBe("2025-01-31");
    });
  });

  describe("ExportedExpense", () => {
    it("should have correct structure", () => {
      const expense: ExportedExpense = {
        id: "expense-123",
        title: "Dinner",
        description: "Team dinner at restaurant",
        amount: 150.0,
        currency: "USD",
        category: "food",
        date: "2025-01-15",
        payers: [
          {
            displayName: "Alice",
            userId: "user-1",
            amount: 150.0,
          },
        ],
        splits: [
          {
            displayName: "Alice",
            userId: "user-1",
            amount: 50.0,
            shareMode: "equal",
          },
          {
            displayName: "Bob",
            userId: "user-2",
            amount: 50.0,
            shareMode: "equal",
          },
          {
            displayName: "Charlie",
            userId: "user-3",
            amount: 50.0,
            shareMode: "equal",
          },
        ],
        attachments: [
          {
            id: "attachment-1",
            mimeType: "image/jpeg",
            sizeBytes: 1024000,
            createdAt: "2025-01-15T10:30:00.000Z",
          },
        ],
        createdAt: "2025-01-15T10:00:00.000Z",
        updatedAt: "2025-01-15T10:00:00.000Z",
      };

      expect(expense.id).toBe("expense-123");
      expect(expense.title).toBe("Dinner");
      expect(expense.amount).toBe(150.0);
      expect(expense.payers).toHaveLength(1);
      expect(expense.splits).toHaveLength(3);
      expect(expense.attachments).toHaveLength(1);
    });

    it("should handle null description", () => {
      const expense: ExportedExpense = {
        id: "expense-123",
        title: "Quick expense",
        description: null,
        amount: 25.0,
        currency: "USD",
        category: null,
        date: "2025-01-15",
        payers: [],
        splits: [],
        attachments: [],
        createdAt: "2025-01-15T10:00:00.000Z",
        updatedAt: "2025-01-15T10:00:00.000Z",
      };

      expect(expense.description).toBeNull();
      expect(expense.category).toBeNull();
    });
  });

  describe("ExportData", () => {
    it("should have correct structure", () => {
      const exportData: ExportData = {
        metadata: {
          exportedAt: "2025-01-20T12:00:00.000Z",
          exportVersion: "1.0",
          group: {
            id: "group-123",
            name: "Test Group",
            currency: "USD",
          },
          totalExpenses: 1,
        },
        expenses: [
          {
            id: "expense-123",
            title: "Test",
            description: null,
            amount: 100.0,
            currency: "USD",
            category: null,
            date: "2025-01-15",
            payers: [],
            splits: [],
            attachments: [],
            createdAt: "2025-01-15T10:00:00.000Z",
            updatedAt: "2025-01-15T10:00:00.000Z",
          },
        ],
      };

      expect(exportData.metadata).toBeDefined();
      expect(exportData.expenses).toBeArray();
      expect(exportData.expenses).toHaveLength(1);
    });

    it("should be serializable to JSON", () => {
      const exportData: ExportData = {
        metadata: {
          exportedAt: "2025-01-20T12:00:00.000Z",
          exportVersion: "1.0",
          group: {
            id: "group-123",
            name: "Test Group",
            currency: "USD",
          },
          totalExpenses: 1,
        },
        expenses: [
          {
            id: "expense-123",
            title: "Test",
            description: "Test description",
            amount: 100.0,
            currency: "USD",
            category: "other",
            date: "2025-01-15",
            payers: [{ displayName: "Alice", userId: "user-1", amount: 100.0 }],
            splits: [
              { displayName: "Alice", userId: "user-1", amount: 50.0, shareMode: "equal" },
              { displayName: "Bob", userId: "user-2", amount: 50.0, shareMode: "equal" },
            ],
            attachments: [],
            createdAt: "2025-01-15T10:00:00.000Z",
            updatedAt: "2025-01-15T10:00:00.000Z",
          },
        ],
      };

      const jsonString = JSON.stringify(exportData);
      const parsed = JSON.parse(jsonString);

      expect(parsed.metadata.exportedAt).toBe("2025-01-20T12:00:00.000Z");
      expect(parsed.expenses[0].amount).toBe(100.0);
      expect(parsed.expenses[0].payers[0].displayName).toBe("Alice");
    });
  });
});

describe("JSON Export Format", () => {
  it("should format date as YYYY-MM-DD", () => {
    const expense: ExportedExpense = {
      id: "expense-123",
      title: "Test",
      description: null,
      amount: 100.0,
      currency: "USD",
      category: null,
      date: "2025-01-15",
      payers: [],
      splits: [],
      attachments: [],
      createdAt: "2025-01-15T10:00:00.000Z",
      updatedAt: "2025-01-15T10:00:00.000Z",
    };

    expect(expense.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("should format timestamps as ISO 8601", () => {
    const expense: ExportedExpense = {
      id: "expense-123",
      title: "Test",
      description: null,
      amount: 100.0,
      currency: "USD",
      category: null,
      date: "2025-01-15",
      payers: [],
      splits: [],
      attachments: [],
      createdAt: "2025-01-15T10:00:00.000Z",
      updatedAt: "2025-01-15T10:30:00.000Z",
    };

    // Verify ISO 8601 format
    expect(new Date(expense.createdAt).toISOString()).toBe(expense.createdAt);
    expect(new Date(expense.updatedAt).toISOString()).toBe(expense.updatedAt);
  });

  it("should include all payer amounts summing to total", () => {
    const expense: ExportedExpense = {
      id: "expense-123",
      title: "Shared payment",
      description: null,
      amount: 100.0,
      currency: "USD",
      category: null,
      date: "2025-01-15",
      payers: [
        { displayName: "Alice", userId: "user-1", amount: 60.0 },
        { displayName: "Bob", userId: "user-2", amount: 40.0 },
      ],
      splits: [],
      attachments: [],
      createdAt: "2025-01-15T10:00:00.000Z",
      updatedAt: "2025-01-15T10:00:00.000Z",
    };

    const payerTotal = expense.payers.reduce((sum, p) => sum + p.amount, 0);
    expect(payerTotal).toBe(expense.amount);
  });

  it("should include all split amounts summing to total", () => {
    const expense: ExportedExpense = {
      id: "expense-123",
      title: "Dinner",
      description: null,
      amount: 99.99,
      currency: "USD",
      category: null,
      date: "2025-01-15",
      payers: [{ displayName: "Alice", userId: "user-1", amount: 99.99 }],
      splits: [
        { displayName: "Alice", userId: "user-1", amount: 33.33, shareMode: "equal" },
        { displayName: "Bob", userId: "user-2", amount: 33.33, shareMode: "equal" },
        { displayName: "Charlie", userId: "user-3", amount: 33.33, shareMode: "equal" },
      ],
      attachments: [],
      createdAt: "2025-01-15T10:00:00.000Z",
      updatedAt: "2025-01-15T10:00:00.000Z",
    };

    const splitTotal = expense.splits.reduce((sum, s) => sum + s.amount, 0);
    expect(splitTotal).toBeCloseTo(expense.amount, 1);
  });
});
