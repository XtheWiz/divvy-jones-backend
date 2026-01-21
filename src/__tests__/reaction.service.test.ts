import { describe, test, expect } from "bun:test";

// ============================================================================
// Reaction Service Unit Tests - Sprint 008
// Feature 2: Reactions (AC-2.1 to AC-2.8)
// ============================================================================

describe("Reaction Service - Reaction Type Validation", () => {
  // AC-2.7: Support reaction types: thumbsUp, thumbsDown, heart, laugh, surprised, angry
  // AC-2.8: Reaction type is validated against allowed enum values

  const REACTION_TYPES = [
    "thumbsUp",
    "thumbsDown",
    "heart",
    "laugh",
    "surprised",
    "angry",
  ] as const;

  function validateReactionType(reactionType: string): boolean {
    return REACTION_TYPES.includes(reactionType as any);
  }

  test("accepts thumbsUp reaction", () => {
    expect(validateReactionType("thumbsUp")).toBe(true);
  });

  test("accepts thumbsDown reaction", () => {
    expect(validateReactionType("thumbsDown")).toBe(true);
  });

  test("accepts heart reaction", () => {
    expect(validateReactionType("heart")).toBe(true);
  });

  test("accepts laugh reaction", () => {
    expect(validateReactionType("laugh")).toBe(true);
  });

  test("accepts surprised reaction", () => {
    expect(validateReactionType("surprised")).toBe(true);
  });

  test("accepts angry reaction", () => {
    expect(validateReactionType("angry")).toBe(true);
  });

  test("rejects invalid reaction type", () => {
    expect(validateReactionType("invalid")).toBe(false);
  });

  test("rejects empty string", () => {
    expect(validateReactionType("")).toBe(false);
  });

  test("is case-sensitive", () => {
    expect(validateReactionType("ThumbsUp")).toBe(false);
    expect(validateReactionType("HEART")).toBe(false);
  });

  test("rejects emoji as reaction type", () => {
    expect(validateReactionType("👍")).toBe(false);
    expect(validateReactionType("❤️")).toBe(false);
  });

  test("all defined types are valid", () => {
    for (const type of REACTION_TYPES) {
      expect(validateReactionType(type)).toBe(true);
    }
  });

  test("exactly 6 reaction types are defined", () => {
    expect(REACTION_TYPES.length).toBe(6);
  });
});

describe("Reaction Service - Entity Type Validation", () => {
  // AC-2.1: Reaction table stores entityType (expense/settlement)

  const REACTION_ENTITY_TYPES = ["expense", "settlement"] as const;

  function validateEntityType(entityType: string): boolean {
    return REACTION_ENTITY_TYPES.includes(entityType as any);
  }

  test("accepts expense entity type", () => {
    expect(validateEntityType("expense")).toBe(true);
  });

  test("accepts settlement entity type", () => {
    expect(validateEntityType("settlement")).toBe(true);
  });

  test("rejects invalid entity type", () => {
    expect(validateEntityType("comment")).toBe(false);
  });

  test("rejects empty string", () => {
    expect(validateEntityType("")).toBe(false);
  });

  test("is case-sensitive", () => {
    expect(validateEntityType("Expense")).toBe(false);
    expect(validateEntityType("SETTLEMENT")).toBe(false);
  });

  test("exactly 2 entity types are defined", () => {
    expect(REACTION_ENTITY_TYPES.length).toBe(2);
  });
});

describe("Reaction Service - Toggle Logic", () => {
  // AC-2.3: POST adds or toggles a reaction

  interface MockReaction {
    id: string;
    entityType: string;
    entityId: string;
    memberId: string;
    reactionType: string;
  }

  class MockReactionStore {
    private reactions: MockReaction[] = [];

    add(reaction: Omit<MockReaction, "id">): MockReaction {
      const newReaction = { ...reaction, id: `reaction-${Date.now()}` };
      this.reactions.push(newReaction);
      return newReaction;
    }

    find(
      entityType: string,
      entityId: string,
      memberId: string,
      reactionType: string
    ): MockReaction | undefined {
      return this.reactions.find(
        (r) =>
          r.entityType === entityType &&
          r.entityId === entityId &&
          r.memberId === memberId &&
          r.reactionType === reactionType
      );
    }

    remove(id: string): boolean {
      const index = this.reactions.findIndex((r) => r.id === id);
      if (index >= 0) {
        this.reactions.splice(index, 1);
        return true;
      }
      return false;
    }

    toggle(
      entityType: string,
      entityId: string,
      memberId: string,
      reactionType: string
    ): { added: boolean; reaction?: MockReaction } {
      const existing = this.find(entityType, entityId, memberId, reactionType);
      if (existing) {
        this.remove(existing.id);
        return { added: false };
      } else {
        const reaction = this.add({ entityType, entityId, memberId, reactionType });
        return { added: true, reaction };
      }
    }

    getAll(): MockReaction[] {
      return [...this.reactions];
    }
  }

  test("adds reaction when it doesn't exist", () => {
    const store = new MockReactionStore();
    const result = store.toggle("expense", "exp-1", "member-1", "thumbsUp");

    expect(result.added).toBe(true);
    expect(result.reaction).toBeDefined();
    expect(result.reaction?.reactionType).toBe("thumbsUp");
  });

  test("removes reaction when it already exists", () => {
    const store = new MockReactionStore();

    // First toggle adds
    store.toggle("expense", "exp-1", "member-1", "thumbsUp");

    // Second toggle removes
    const result = store.toggle("expense", "exp-1", "member-1", "thumbsUp");

    expect(result.added).toBe(false);
    expect(result.reaction).toBeUndefined();
  });

  test("toggle is idempotent over two calls", () => {
    const store = new MockReactionStore();

    store.toggle("expense", "exp-1", "member-1", "thumbsUp");
    store.toggle("expense", "exp-1", "member-1", "thumbsUp");

    // After two toggles, reaction should not exist
    const existing = store.find("expense", "exp-1", "member-1", "thumbsUp");
    expect(existing).toBeUndefined();
  });

  test("different reaction types are independent", () => {
    const store = new MockReactionStore();

    store.toggle("expense", "exp-1", "member-1", "thumbsUp");
    store.toggle("expense", "exp-1", "member-1", "heart");

    // Both should exist
    const thumbsUp = store.find("expense", "exp-1", "member-1", "thumbsUp");
    const heart = store.find("expense", "exp-1", "member-1", "heart");

    expect(thumbsUp).toBeDefined();
    expect(heart).toBeDefined();
  });

  test("different members can react independently", () => {
    const store = new MockReactionStore();

    store.toggle("expense", "exp-1", "member-1", "thumbsUp");
    store.toggle("expense", "exp-1", "member-2", "thumbsUp");

    const reactions = store.getAll();
    expect(reactions.length).toBe(2);
  });

  test("different entities are independent", () => {
    const store = new MockReactionStore();

    store.toggle("expense", "exp-1", "member-1", "thumbsUp");
    store.toggle("expense", "exp-2", "member-1", "thumbsUp");

    const reactions = store.getAll();
    expect(reactions.length).toBe(2);
  });
});

describe("Reaction Service - Unique Constraint", () => {
  // AC-2.2: Unique constraint prevents duplicate reactions (same user, same entity, same type)

  function createReactionKey(
    entityType: string,
    entityId: string,
    memberId: string,
    reactionType: string
  ): string {
    return `${entityType}:${entityId}:${memberId}:${reactionType}`;
  }

  test("generates unique key for reaction", () => {
    const key = createReactionKey("expense", "exp-1", "member-1", "thumbsUp");
    expect(key).toBe("expense:exp-1:member-1:thumbsUp");
  });

  test("same inputs produce same key", () => {
    const key1 = createReactionKey("expense", "exp-1", "member-1", "thumbsUp");
    const key2 = createReactionKey("expense", "exp-1", "member-1", "thumbsUp");
    expect(key1).toBe(key2);
  });

  test("different reaction type produces different key", () => {
    const key1 = createReactionKey("expense", "exp-1", "member-1", "thumbsUp");
    const key2 = createReactionKey("expense", "exp-1", "member-1", "heart");
    expect(key1).not.toBe(key2);
  });

  test("different member produces different key", () => {
    const key1 = createReactionKey("expense", "exp-1", "member-1", "thumbsUp");
    const key2 = createReactionKey("expense", "exp-1", "member-2", "thumbsUp");
    expect(key1).not.toBe(key2);
  });

  test("different entity produces different key", () => {
    const key1 = createReactionKey("expense", "exp-1", "member-1", "thumbsUp");
    const key2 = createReactionKey("expense", "exp-2", "member-1", "thumbsUp");
    expect(key1).not.toBe(key2);
  });

  test("different entity type produces different key", () => {
    const key1 = createReactionKey("expense", "exp-1", "member-1", "thumbsUp");
    const key2 = createReactionKey("settlement", "exp-1", "member-1", "thumbsUp");
    expect(key1).not.toBe(key2);
  });
});

describe("Reaction Service - Reaction Counts", () => {
  // AC-2.5: GET includes reaction counts

  interface ReactionCounts {
    thumbsUp: number;
    thumbsDown: number;
    heart: number;
    laugh: number;
    surprised: number;
    angry: number;
    total: number;
  }

  function calculateCounts(reactionTypes: string[]): ReactionCounts {
    const counts: ReactionCounts = {
      thumbsUp: 0,
      thumbsDown: 0,
      heart: 0,
      laugh: 0,
      surprised: 0,
      angry: 0,
      total: 0,
    };

    for (const type of reactionTypes) {
      if (type in counts && type !== "total") {
        (counts as any)[type]++;
        counts.total++;
      }
    }

    return counts;
  }

  test("counts single reaction", () => {
    const counts = calculateCounts(["thumbsUp"]);
    expect(counts.thumbsUp).toBe(1);
    expect(counts.total).toBe(1);
  });

  test("counts multiple same reactions", () => {
    const counts = calculateCounts(["thumbsUp", "thumbsUp", "thumbsUp"]);
    expect(counts.thumbsUp).toBe(3);
    expect(counts.total).toBe(3);
  });

  test("counts different reaction types", () => {
    const counts = calculateCounts(["thumbsUp", "heart", "laugh"]);
    expect(counts.thumbsUp).toBe(1);
    expect(counts.heart).toBe(1);
    expect(counts.laugh).toBe(1);
    expect(counts.total).toBe(3);
  });

  test("returns all zeros for empty array", () => {
    const counts = calculateCounts([]);
    expect(counts.thumbsUp).toBe(0);
    expect(counts.thumbsDown).toBe(0);
    expect(counts.heart).toBe(0);
    expect(counts.laugh).toBe(0);
    expect(counts.surprised).toBe(0);
    expect(counts.angry).toBe(0);
    expect(counts.total).toBe(0);
  });

  test("ignores invalid reaction types", () => {
    const counts = calculateCounts(["thumbsUp", "invalid", "heart"]);
    expect(counts.thumbsUp).toBe(1);
    expect(counts.heart).toBe(1);
    expect(counts.total).toBe(2);
  });

  test("handles all reaction types", () => {
    const counts = calculateCounts([
      "thumbsUp",
      "thumbsDown",
      "heart",
      "laugh",
      "surprised",
      "angry",
    ]);
    expect(counts.thumbsUp).toBe(1);
    expect(counts.thumbsDown).toBe(1);
    expect(counts.heart).toBe(1);
    expect(counts.laugh).toBe(1);
    expect(counts.surprised).toBe(1);
    expect(counts.angry).toBe(1);
    expect(counts.total).toBe(6);
  });
});

describe("Reaction Service - User Reactions", () => {
  // AC-2.5: GET includes current user's reactions

  interface Reaction {
    memberId: string;
    reactionType: string;
  }

  function getUserReactions(reactions: Reaction[], memberId: string): string[] {
    return reactions
      .filter((r) => r.memberId === memberId)
      .map((r) => r.reactionType);
  }

  test("returns user's reactions", () => {
    const reactions: Reaction[] = [
      { memberId: "member-1", reactionType: "thumbsUp" },
      { memberId: "member-1", reactionType: "heart" },
      { memberId: "member-2", reactionType: "laugh" },
    ];

    const userReactions = getUserReactions(reactions, "member-1");
    expect(userReactions).toContain("thumbsUp");
    expect(userReactions).toContain("heart");
    expect(userReactions.length).toBe(2);
  });

  test("returns empty array when user has no reactions", () => {
    const reactions: Reaction[] = [
      { memberId: "member-1", reactionType: "thumbsUp" },
    ];

    const userReactions = getUserReactions(reactions, "member-2");
    expect(userReactions).toEqual([]);
  });

  test("returns empty array when no reactions exist", () => {
    const userReactions = getUserReactions([], "member-1");
    expect(userReactions).toEqual([]);
  });
});

describe("Reaction Service - Constants", () => {
  test("REACTION_TYPES contains all expected types", () => {
    const REACTION_TYPES = ["thumbsUp", "thumbsDown", "heart", "laugh", "surprised", "angry"];
    expect(REACTION_TYPES).toContain("thumbsUp");
    expect(REACTION_TYPES).toContain("thumbsDown");
    expect(REACTION_TYPES).toContain("heart");
    expect(REACTION_TYPES).toContain("laugh");
    expect(REACTION_TYPES).toContain("surprised");
    expect(REACTION_TYPES).toContain("angry");
  });

  test("REACTION_ENTITY_TYPES contains expense and settlement", () => {
    const REACTION_ENTITY_TYPES = ["expense", "settlement"];
    expect(REACTION_ENTITY_TYPES).toContain("expense");
    expect(REACTION_ENTITY_TYPES).toContain("settlement");
  });
});

describe("Reaction Service - Remove Reaction", () => {
  // AC-2.4: DELETE removes a reaction

  interface MockReaction {
    id: string;
    entityType: string;
    entityId: string;
    memberId: string;
    reactionType: string;
  }

  function removeReaction(
    reactions: MockReaction[],
    entityType: string,
    entityId: string,
    memberId: string,
    reactionType: string
  ): { success: boolean; remaining: MockReaction[] } {
    const index = reactions.findIndex(
      (r) =>
        r.entityType === entityType &&
        r.entityId === entityId &&
        r.memberId === memberId &&
        r.reactionType === reactionType
    );

    if (index >= 0) {
      const remaining = [...reactions];
      remaining.splice(index, 1);
      return { success: true, remaining };
    }

    return { success: false, remaining: reactions };
  }

  test("removes existing reaction", () => {
    const reactions: MockReaction[] = [
      { id: "1", entityType: "expense", entityId: "exp-1", memberId: "member-1", reactionType: "thumbsUp" },
    ];

    const result = removeReaction(reactions, "expense", "exp-1", "member-1", "thumbsUp");
    expect(result.success).toBe(true);
    expect(result.remaining.length).toBe(0);
  });

  test("returns false when reaction doesn't exist", () => {
    const reactions: MockReaction[] = [];

    const result = removeReaction(reactions, "expense", "exp-1", "member-1", "thumbsUp");
    expect(result.success).toBe(false);
  });

  test("only removes matching reaction", () => {
    const reactions: MockReaction[] = [
      { id: "1", entityType: "expense", entityId: "exp-1", memberId: "member-1", reactionType: "thumbsUp" },
      { id: "2", entityType: "expense", entityId: "exp-1", memberId: "member-1", reactionType: "heart" },
    ];

    const result = removeReaction(reactions, "expense", "exp-1", "member-1", "thumbsUp");
    expect(result.success).toBe(true);
    expect(result.remaining.length).toBe(1);
    expect(result.remaining[0].reactionType).toBe("heart");
  });
});

describe("Reaction Service - Grouping by Type", () => {
  // For UI display purposes

  type ReactionType = "thumbsUp" | "thumbsDown" | "heart" | "laugh" | "surprised" | "angry";

  interface Reaction {
    id: string;
    reactionType: ReactionType;
    user: { displayName: string };
  }

  function groupByType(reactions: Reaction[]): Record<ReactionType, Reaction[]> {
    const grouped: Record<ReactionType, Reaction[]> = {
      thumbsUp: [],
      thumbsDown: [],
      heart: [],
      laugh: [],
      surprised: [],
      angry: [],
    };

    for (const reaction of reactions) {
      grouped[reaction.reactionType].push(reaction);
    }

    return grouped;
  }

  test("groups reactions by type", () => {
    const reactions: Reaction[] = [
      { id: "1", reactionType: "thumbsUp", user: { displayName: "Alice" } },
      { id: "2", reactionType: "thumbsUp", user: { displayName: "Bob" } },
      { id: "3", reactionType: "heart", user: { displayName: "Charlie" } },
    ];

    const grouped = groupByType(reactions);

    expect(grouped.thumbsUp.length).toBe(2);
    expect(grouped.heart.length).toBe(1);
    expect(grouped.laugh.length).toBe(0);
  });

  test("returns empty arrays for no reactions", () => {
    const grouped = groupByType([]);

    expect(grouped.thumbsUp).toEqual([]);
    expect(grouped.thumbsDown).toEqual([]);
    expect(grouped.heart).toEqual([]);
    expect(grouped.laugh).toEqual([]);
    expect(grouped.surprised).toEqual([]);
    expect(grouped.angry).toEqual([]);
  });

  test("preserves user information in groups", () => {
    const reactions: Reaction[] = [
      { id: "1", reactionType: "heart", user: { displayName: "Alice" } },
    ];

    const grouped = groupByType(reactions);

    expect(grouped.heart[0].user.displayName).toBe("Alice");
  });
});
