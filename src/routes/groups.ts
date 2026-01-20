import { Elysia, t } from "elysia";
import { success, error, ErrorCodes } from "../lib/responses";
import { requireAuth } from "../middleware/auth";
import {
  createGroup,
  findGroupByJoinCode,
  findGroupById,
  isMemberOfGroup,
  joinGroup,
  getGroupsByUser,
  getGroupWithMemberCount,
  getGroupMembers,
} from "../services/group.service";

// ============================================================================
// Request/Response Schemas
// ============================================================================

const createGroupSchema = {
  body: t.Object({
    name: t.String({ minLength: 1, maxLength: 100 }),
    description: t.Optional(t.String({ maxLength: 500 })),
    defaultCurrencyCode: t.Optional(t.String({ minLength: 3, maxLength: 3 })),
  }),
};

const joinGroupSchema = {
  body: t.Object({
    joinCode: t.String({ minLength: 1 }),
  }),
};

// ============================================================================
// Group Routes
// ============================================================================

export const groupRoutes = new Elysia({ prefix: "/groups" })
  .use(requireAuth)

  // ========================================================================
  // POST /groups - Create a New Group
  // AC-2.1: Authenticated user can create a new group
  // AC-2.2: Group requires: name (required), description (optional)
  // AC-2.3: Group name must be 1-100 characters
  // AC-2.4: Creator automatically becomes group owner/member
  // AC-2.5: Group receives a unique 8-character join code
  // AC-2.6: Group receives a default currency (USD default)
  // AC-2.7: Creation returns group details including join code
  // ========================================================================
  .post(
    "/",
    async ({ body, auth, authError, set }) => {
      if (!auth) {
        set.status = 401;
        return authError;
      }

      const { name, description, defaultCurrencyCode } = body;

      // AC-2.3: Validate name length (TypeBox handles min/max)
      const trimmedName = name.trim();
      if (trimmedName.length === 0) {
        set.status = 400;
        return error(ErrorCodes.VALIDATION_ERROR, "Group name cannot be empty");
      }

      // Create group with owner membership
      const { group, membership } = await createGroup({
        name: trimmedName,
        description,
        defaultCurrencyCode: defaultCurrencyCode || "USD",
        ownerUserId: auth.userId,
      });

      set.status = 201;

      // AC-2.7: Return group details including join code
      return success({
        id: group.id,
        name: group.name,
        description: group.label,
        joinCode: group.joinCode,
        defaultCurrencyCode: group.defaultCurrencyCode,
        role: membership.role,
        createdAt: group.createdAt,
      });
    },
    createGroupSchema
  )

  // ========================================================================
  // POST /groups/join - Join a Group via Code
  // AC-2.8: Authenticated user can join group using join code
  // AC-2.9: Invalid join code returns 404
  // AC-2.10: User cannot join a group they're already a member of
  // AC-2.11: Joining returns group details
  // AC-2.12: New member has "member" role (not owner/admin)
  // ========================================================================
  .post(
    "/join",
    async ({ body, auth, authError, set }) => {
      if (!auth) {
        set.status = 401;
        return authError;
      }

      const { joinCode } = body;

      // AC-2.9: Find group by join code
      const group = await findGroupByJoinCode(joinCode);
      if (!group) {
        set.status = 404;
        return error(ErrorCodes.NOT_FOUND, "Invalid join code");
      }

      // AC-2.10: Check if user is already a member
      const { isMember, membership: existingMembership } = await isMemberOfGroup(
        auth.userId,
        group.id
      );

      if (isMember) {
        set.status = 409;
        return error(ErrorCodes.CONFLICT, "You are already a member of this group");
      }

      // AC-2.12: Add user as member (not owner/admin)
      const membership = await joinGroup(auth.userId, group.id, "member");

      // AC-2.11: Return group details
      return success({
        id: group.id,
        name: group.name,
        description: group.label,
        defaultCurrencyCode: group.defaultCurrencyCode,
        role: membership.role,
        joinedAt: membership.joinedAt,
      });
    },
    joinGroupSchema
  )

  // ========================================================================
  // GET /groups - List User's Groups
  // AC-2.13: User can list all groups they belong to
  // AC-2.14: Group list includes: id, name, description, role, memberCount, createdAt
  // AC-2.15: Groups sorted by most recent activity
  // ========================================================================
  .get("/", async ({ auth, authError, set }) => {
    if (!auth) {
      set.status = 401;
      return authError;
    }

    const groups = await getGroupsByUser(auth.userId);

    // AC-2.14: Return required fields
    return success(
      groups.map((g) => ({
        id: g.id,
        name: g.name,
        description: g.label,
        role: g.userRole,
        memberCount: g.memberCount,
        createdAt: g.createdAt,
      }))
    );
  })

  // ========================================================================
  // GET /groups/:id - Get Group Details
  // AC-2.16: User can view single group details
  // AC-2.17: Non-members cannot view group details (403)
  // ========================================================================
  .get(
    "/:id",
    async ({ params, auth, authError, set }) => {
      if (!auth) {
        set.status = 401;
        return authError;
      }

      const { id: groupId } = params;

      // Check if group exists
      const group = await getGroupWithMemberCount(groupId);
      if (!group) {
        set.status = 404;
        return error(ErrorCodes.NOT_FOUND, "Group not found");
      }

      // AC-2.17: Check membership
      const { isMember, membership } = await isMemberOfGroup(auth.userId, groupId);
      if (!isMember) {
        set.status = 403;
        return error(ErrorCodes.NOT_MEMBER, "You are not a member of this group");
      }

      return success({
        id: group.id,
        name: group.name,
        description: group.label,
        joinCode: group.joinCode,
        defaultCurrencyCode: group.defaultCurrencyCode,
        role: membership?.role,
        memberCount: group.memberCount,
        createdAt: group.createdAt,
        updatedAt: group.updatedAt,
      });
    },
    {
      params: t.Object({
        id: t.String(),
      }),
    }
  )

  // ========================================================================
  // GET /groups/:id/members - List Group Members
  // AC-2.18: Member can list all members of their group
  // AC-2.19: Member list includes: userId, displayName, role, joinedAt
  // ========================================================================
  .get(
    "/:id/members",
    async ({ params, auth, authError, set }) => {
      if (!auth) {
        set.status = 401;
        return authError;
      }

      const { id: groupId } = params;

      // Check if group exists
      const group = await findGroupById(groupId);
      if (!group) {
        set.status = 404;
        return error(ErrorCodes.NOT_FOUND, "Group not found");
      }

      // Check membership
      const { isMember } = await isMemberOfGroup(auth.userId, groupId);
      if (!isMember) {
        set.status = 403;
        return error(ErrorCodes.NOT_MEMBER, "You are not a member of this group");
      }

      const members = await getGroupMembers(groupId);

      // AC-2.19: Return required fields
      return success(
        members.map((m) => ({
          userId: m.userId,
          displayName: m.displayName,
          role: m.role,
          joinedAt: m.joinedAt,
        }))
      );
    },
    {
      params: t.Object({
        id: t.String(),
      }),
    }
  );
