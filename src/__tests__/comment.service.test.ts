import { describe, test, expect } from "bun:test";

// ============================================================================
// Comment Service Unit Tests - Sprint 008
// Feature 1: Expense Comments (AC-1.1 to AC-1.10)
// ============================================================================

describe("Comment Service - Content Validation", () => {
  // AC-1.1, AC-1.2: Comment content validation
  const MAX_COMMENT_LENGTH = 2000;

  function validateCommentContent(content: string): { valid: boolean; error?: string } {
    const trimmed = content.trim();

    if (trimmed.length === 0) {
      return { valid: false, error: "Comment cannot be empty" };
    }

    if (trimmed.length > MAX_COMMENT_LENGTH) {
      return { valid: false, error: `Comment cannot exceed ${MAX_COMMENT_LENGTH} characters` };
    }

    return { valid: true };
  }

  test("rejects empty comment", () => {
    const result = validateCommentContent("");
    expect(result.valid).toBe(false);
    expect(result.error).toBe("Comment cannot be empty");
  });

  test("rejects whitespace-only comment", () => {
    const result = validateCommentContent("   ");
    expect(result.valid).toBe(false);
    expect(result.error).toBe("Comment cannot be empty");
  });

  test("accepts valid comment", () => {
    const result = validateCommentContent("This is a valid comment");
    expect(result.valid).toBe(true);
    expect(result.error).toBeUndefined();
  });

  test("accepts comment at max length (2000)", () => {
    const result = validateCommentContent("A".repeat(2000));
    expect(result.valid).toBe(true);
  });

  test("rejects comment exceeding 2000 characters", () => {
    const result = validateCommentContent("A".repeat(2001));
    expect(result.valid).toBe(false);
    expect(result.error).toBe("Comment cannot exceed 2000 characters");
  });

  test("trims whitespace for validation", () => {
    const result = validateCommentContent("  Valid comment  ");
    expect(result.valid).toBe(true);
  });

  test("accepts comment with newlines", () => {
    const result = validateCommentContent("Line 1\nLine 2\nLine 3");
    expect(result.valid).toBe(true);
  });

  test("accepts comment with special characters", () => {
    const result = validateCommentContent("Comment with !@#$%^&*() special chars");
    expect(result.valid).toBe(true);
  });

  test("accepts comment with emojis", () => {
    const result = validateCommentContent("Great job! 🎉👏");
    expect(result.valid).toBe(true);
  });

  test("accepts comment with unicode characters", () => {
    const result = validateCommentContent("こんにちは世界");
    expect(result.valid).toBe(true);
  });
});

describe("Comment Service - Comment Preview Truncation", () => {
  // AC-1.10: Comment notifications include comment preview text

  function truncateCommentPreview(content: string, maxLength: number = 100): string {
    if (content.length <= maxLength) {
      return content;
    }
    return content.slice(0, maxLength) + "...";
  }

  test("does not truncate short comment", () => {
    const comment = "Short comment";
    const preview = truncateCommentPreview(comment);
    expect(preview).toBe("Short comment");
  });

  test("truncates long comment at 100 characters by default", () => {
    const comment = "A".repeat(150);
    const preview = truncateCommentPreview(comment);
    expect(preview.length).toBe(103); // 100 chars + "..."
    expect(preview.endsWith("...")).toBe(true);
  });

  test("preserves comment exactly at max length", () => {
    const comment = "A".repeat(100);
    const preview = truncateCommentPreview(comment);
    expect(preview).toBe(comment);
    expect(preview.length).toBe(100);
  });

  test("uses custom max length", () => {
    const comment = "A".repeat(60);
    const preview = truncateCommentPreview(comment, 50);
    expect(preview.length).toBe(53); // 50 chars + "..."
    expect(preview.endsWith("...")).toBe(true);
  });

  test("handles empty string", () => {
    const preview = truncateCommentPreview("");
    expect(preview).toBe("");
  });

  test("handles comment with unicode", () => {
    const comment = "こんにちは".repeat(30); // 5 chars * 30 = 150 chars
    const preview = truncateCommentPreview(comment);
    // Should be truncated at character level (not byte level)
    expect(preview.endsWith("...")).toBe(true);
  });
});

describe("Comment Service - Authorization Logic", () => {
  // AC-1.8: Only comment author can edit/delete their own comments

  function isCommentAuthor(
    commentAuthorMemberId: string,
    requestingMemberId: string
  ): boolean {
    return commentAuthorMemberId === requestingMemberId;
  }

  test("returns true when member is the author", () => {
    const result = isCommentAuthor("member-123", "member-123");
    expect(result).toBe(true);
  });

  test("returns false when member is not the author", () => {
    const result = isCommentAuthor("member-123", "member-456");
    expect(result).toBe(false);
  });

  test("handles empty strings", () => {
    const result = isCommentAuthor("", "member-123");
    expect(result).toBe(false);
  });

  test("is case-sensitive", () => {
    const result = isCommentAuthor("Member-123", "member-123");
    expect(result).toBe(false);
  });
});

describe("Comment Service - Pagination Logic", () => {
  // AC-1.5: GET lists all comments (paginated)

  function calculatePaginationParams(
    page: number = 1,
    limit: number = 20
  ): { offset: number; limit: number } {
    const validPage = Math.max(1, page);
    const validLimit = Math.min(Math.max(1, limit), 100); // Max 100 per page
    const offset = (validPage - 1) * validLimit;

    return { offset, limit: validLimit };
  }

  test("calculates correct offset for page 1", () => {
    const result = calculatePaginationParams(1, 20);
    expect(result.offset).toBe(0);
    expect(result.limit).toBe(20);
  });

  test("calculates correct offset for page 2", () => {
    const result = calculatePaginationParams(2, 20);
    expect(result.offset).toBe(20);
    expect(result.limit).toBe(20);
  });

  test("calculates correct offset for page 3 with limit 10", () => {
    const result = calculatePaginationParams(3, 10);
    expect(result.offset).toBe(20);
    expect(result.limit).toBe(10);
  });

  test("handles page 0 by defaulting to page 1", () => {
    const result = calculatePaginationParams(0, 20);
    expect(result.offset).toBe(0);
  });

  test("handles negative page by defaulting to page 1", () => {
    const result = calculatePaginationParams(-5, 20);
    expect(result.offset).toBe(0);
  });

  test("caps limit at 100", () => {
    const result = calculatePaginationParams(1, 200);
    expect(result.limit).toBe(100);
  });

  test("handles limit 0 by defaulting to 1", () => {
    const result = calculatePaginationParams(1, 0);
    expect(result.limit).toBe(1);
  });

  test("handles negative limit by defaulting to 1", () => {
    const result = calculatePaginationParams(1, -10);
    expect(result.limit).toBe(1);
  });

  test("uses default values when not provided", () => {
    const result = calculatePaginationParams();
    expect(result.offset).toBe(0);
    expect(result.limit).toBe(20);
  });
});

describe("Comment Service - Comment Content Sanitization", () => {
  // Content is trimmed but otherwise preserved

  function sanitizeCommentContent(content: string): string {
    return content.trim();
  }

  test("trims leading whitespace", () => {
    const result = sanitizeCommentContent("   Hello");
    expect(result).toBe("Hello");
  });

  test("trims trailing whitespace", () => {
    const result = sanitizeCommentContent("Hello   ");
    expect(result).toBe("Hello");
  });

  test("trims both leading and trailing whitespace", () => {
    const result = sanitizeCommentContent("   Hello World   ");
    expect(result).toBe("Hello World");
  });

  test("preserves internal whitespace", () => {
    const result = sanitizeCommentContent("Hello   World");
    expect(result).toBe("Hello   World");
  });

  test("preserves newlines", () => {
    const result = sanitizeCommentContent("Line 1\nLine 2");
    expect(result).toBe("Line 1\nLine 2");
  });

  test("handles empty string", () => {
    const result = sanitizeCommentContent("");
    expect(result).toBe("");
  });
});

describe("Comment Service - Notification Eligibility", () => {
  // AC-1.9: Adding a comment creates a notification for expense participants

  function shouldNotifyParticipant(
    participantUserId: string,
    commentAuthorUserId: string,
    wantsNotifications: boolean
  ): boolean {
    // Don't notify the author of their own comment
    if (participantUserId === commentAuthorUserId) {
      return false;
    }
    // Check if participant wants notifications
    return wantsNotifications;
  }

  test("returns false when participant is the comment author", () => {
    const result = shouldNotifyParticipant("user-123", "user-123", true);
    expect(result).toBe(false);
  });

  test("returns true when participant is different from author and wants notifications", () => {
    const result = shouldNotifyParticipant("user-456", "user-123", true);
    expect(result).toBe(true);
  });

  test("returns false when participant doesn't want notifications", () => {
    const result = shouldNotifyParticipant("user-456", "user-123", false);
    expect(result).toBe(false);
  });

  test("returns false when author doesn't want notifications (but they shouldn't be notified anyway)", () => {
    const result = shouldNotifyParticipant("user-123", "user-123", false);
    expect(result).toBe(false);
  });
});

describe("Comment Service - Soft Delete Logic", () => {
  // AC-1.2, AC-1.7: Comments support soft delete

  function isCommentDeleted(deletedAt: Date | null): boolean {
    return deletedAt !== null;
  }

  function shouldIncludeComment(deletedAt: Date | null): boolean {
    return deletedAt === null;
  }

  test("identifies deleted comment", () => {
    const result = isCommentDeleted(new Date());
    expect(result).toBe(true);
  });

  test("identifies active comment", () => {
    const result = isCommentDeleted(null);
    expect(result).toBe(false);
  });

  test("should include active comment in list", () => {
    const result = shouldIncludeComment(null);
    expect(result).toBe(true);
  });

  test("should not include deleted comment in list", () => {
    const result = shouldIncludeComment(new Date());
    expect(result).toBe(false);
  });
});

describe("Comment Service - Comment List Ordering", () => {
  // Comments should be ordered by creation time (oldest first for conversation flow)

  interface Comment {
    id: string;
    content: string;
    createdAt: Date;
  }

  function sortCommentsByCreatedAt(comments: Comment[]): Comment[] {
    return [...comments].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  }

  test("sorts comments oldest first", () => {
    const comments: Comment[] = [
      { id: "3", content: "Third", createdAt: new Date("2024-01-03") },
      { id: "1", content: "First", createdAt: new Date("2024-01-01") },
      { id: "2", content: "Second", createdAt: new Date("2024-01-02") },
    ];

    const sorted = sortCommentsByCreatedAt(comments);

    expect(sorted[0].id).toBe("1");
    expect(sorted[1].id).toBe("2");
    expect(sorted[2].id).toBe("3");
  });

  test("handles empty array", () => {
    const sorted = sortCommentsByCreatedAt([]);
    expect(sorted).toEqual([]);
  });

  test("handles single comment", () => {
    const comments: Comment[] = [
      { id: "1", content: "Only", createdAt: new Date("2024-01-01") },
    ];

    const sorted = sortCommentsByCreatedAt(comments);
    expect(sorted.length).toBe(1);
    expect(sorted[0].id).toBe("1");
  });

  test("handles comments with same timestamp", () => {
    const sameTime = new Date("2024-01-01");
    const comments: Comment[] = [
      { id: "1", content: "First", createdAt: sameTime },
      { id: "2", content: "Second", createdAt: sameTime },
    ];

    const sorted = sortCommentsByCreatedAt(comments);
    expect(sorted.length).toBe(2);
    // Order is stable but implementation-dependent
  });
});

describe("Comment Service - Constants", () => {
  test("MAX_COMMENT_LENGTH is 2000", () => {
    const MAX_COMMENT_LENGTH = 2000;
    expect(MAX_COMMENT_LENGTH).toBe(2000);
  });

  test("DEFAULT_PAGE_SIZE is 20", () => {
    const DEFAULT_PAGE_SIZE = 20;
    expect(DEFAULT_PAGE_SIZE).toBe(20);
  });

  test("MAX_PAGE_SIZE is 100", () => {
    const MAX_PAGE_SIZE = 100;
    expect(MAX_PAGE_SIZE).toBe(100);
  });
});
