import { eq, and, isNull, desc, count, sql } from "drizzle-orm";
import { db, groups, groupMembers, users, type Group, type GroupMember } from "../db";
import { customAlphabet } from "nanoid";

// ============================================================================
// Configuration
// ============================================================================

// Join code: 8 characters, uppercase alphanumeric, no ambiguous chars (0/O, 1/I/L)
const JOIN_CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
const JOIN_CODE_LENGTH = 8;
const generateJoinCodeRaw = customAlphabet(JOIN_CODE_ALPHABET, JOIN_CODE_LENGTH);

// ============================================================================
// Join Code Functions
// ============================================================================

/**
 * Generate a unique join code for a group
 * Retries if code already exists (extremely unlikely)
 */
export async function generateJoinCode(): Promise<string> {
  let attempts = 0;
  const maxAttempts = 3;

  while (attempts < maxAttempts) {
    const code = generateJoinCodeRaw();

    // Check if code is already in use
    const existing = await db
      .select({ id: groups.id })
      .from(groups)
      .where(and(eq(groups.joinCode, code), isNull(groups.deletedAt)))
      .limit(1);

    if (existing.length === 0) {
      return code;
    }

    attempts++;
  }

  // Fallback: append timestamp suffix (shouldn't happen)
  return generateJoinCodeRaw() + Date.now().toString(36).slice(-2).toUpperCase();
}

// ============================================================================
// Group CRUD Functions
// ============================================================================

export interface CreateGroupInput {
  name: string;
  description?: string;
  defaultCurrencyCode?: string;
  ownerUserId: string;
}

export interface GroupWithMemberCount extends Group {
  memberCount: number;
  userRole?: string;
}

/**
 * Create a new group and add the creator as owner
 */
export async function createGroup(input: CreateGroupInput): Promise<{
  group: Group;
  membership: GroupMember;
}> {
  const { name, description, defaultCurrencyCode = "USD", ownerUserId } = input;

  // Generate unique join code
  const joinCode = await generateJoinCode();

  // Create group and membership in a transaction
  const result = await db.transaction(async (tx) => {
    // Create the group
    const [newGroup] = await tx
      .insert(groups)
      .values({
        name: name.trim(),
        label: description?.trim() || null,
        ownerUserId,
        joinCode,
        defaultCurrencyCode,
      })
      .returning();

    // Add creator as owner member
    const [membership] = await tx
      .insert(groupMembers)
      .values({
        groupId: newGroup.id,
        userId: ownerUserId,
        role: "owner",
        status: "active",
      })
      .returning();

    return { group: newGroup, membership };
  });

  return result;
}

/**
 * Find a group by join code (case-insensitive)
 */
export async function findGroupByJoinCode(joinCode: string): Promise<Group | null> {
  const normalizedCode = joinCode.toUpperCase().trim();

  const [group] = await db
    .select()
    .from(groups)
    .where(
      and(
        eq(groups.joinCode, normalizedCode),
        isNull(groups.deletedAt)
      )
    )
    .limit(1);

  return group || null;
}

/**
 * Find a group by ID
 */
export async function findGroupById(groupId: string): Promise<Group | null> {
  const [group] = await db
    .select()
    .from(groups)
    .where(and(eq(groups.id, groupId), isNull(groups.deletedAt)))
    .limit(1);

  return group || null;
}

// ============================================================================
// Membership Functions
// ============================================================================

/**
 * Check if user is a member of a group
 */
export async function isMemberOfGroup(
  userId: string,
  groupId: string
): Promise<{ isMember: boolean; membership: GroupMember | null }> {
  const [membership] = await db
    .select()
    .from(groupMembers)
    .where(
      and(
        eq(groupMembers.userId, userId),
        eq(groupMembers.groupId, groupId),
        isNull(groupMembers.leftAt)
      )
    )
    .limit(1);

  return {
    isMember: !!membership,
    membership: membership || null,
  };
}

/**
 * Add a user to a group
 */
export async function joinGroup(
  userId: string,
  groupId: string,
  role: string = "member"
): Promise<GroupMember> {
  const [membership] = await db
    .insert(groupMembers)
    .values({
      groupId,
      userId,
      role,
      status: "active",
    })
    .returning();

  return membership;
}

/**
 * Get all groups for a user with member count
 */
export async function getGroupsByUser(userId: string): Promise<GroupWithMemberCount[]> {
  // First get user's group memberships
  const memberships = await db
    .select({
      groupId: groupMembers.groupId,
      role: groupMembers.role,
    })
    .from(groupMembers)
    .where(
      and(
        eq(groupMembers.userId, userId),
        isNull(groupMembers.leftAt)
      )
    );

  if (memberships.length === 0) {
    return [];
  }

  const groupIds = memberships.map((m) => m.groupId);

  // Get groups with member counts
  const groupsData = await db
    .select({
      group: groups,
      memberCount: count(groupMembers.id),
    })
    .from(groups)
    .innerJoin(
      groupMembers,
      and(
        eq(groups.id, groupMembers.groupId),
        isNull(groupMembers.leftAt)
      )
    )
    .where(
      and(
        sql`${groups.id} IN ${groupIds}`,
        isNull(groups.deletedAt)
      )
    )
    .groupBy(groups.id)
    .orderBy(desc(groups.updatedAt));

  // Map with user's role
  const roleMap = new Map(memberships.map((m) => [m.groupId, m.role]));

  return groupsData.map(({ group, memberCount }) => ({
    ...group,
    memberCount,
    userRole: roleMap.get(group.id),
  }));
}

/**
 * Get group details with member count
 */
export async function getGroupWithMemberCount(
  groupId: string
): Promise<GroupWithMemberCount | null> {
  const [result] = await db
    .select({
      group: groups,
      memberCount: count(groupMembers.id),
    })
    .from(groups)
    .leftJoin(
      groupMembers,
      and(
        eq(groups.id, groupMembers.groupId),
        isNull(groupMembers.leftAt)
      )
    )
    .where(and(eq(groups.id, groupId), isNull(groups.deletedAt)))
    .groupBy(groups.id);

  if (!result) {
    return null;
  }

  return {
    ...result.group,
    memberCount: result.memberCount,
  };
}

/**
 * Get members of a group
 */
export async function getGroupMembers(groupId: string): Promise<
  Array<{
    id: string;
    userId: string;
    displayName: string;
    email: string | null;
    role: string;
    joinedAt: Date;
  }>
> {
  const members = await db
    .select({
      id: groupMembers.id,
      userId: groupMembers.userId,
      displayName: users.displayName,
      email: users.email,
      role: groupMembers.role,
      joinedAt: groupMembers.joinedAt,
    })
    .from(groupMembers)
    .innerJoin(users, eq(groupMembers.userId, users.id))
    .where(
      and(
        eq(groupMembers.groupId, groupId),
        isNull(groupMembers.leftAt)
      )
    )
    .orderBy(desc(groupMembers.joinedAt));

  return members;
}
