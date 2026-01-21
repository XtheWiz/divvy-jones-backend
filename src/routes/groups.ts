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
  getMemberRole,
  isAdminRole,
  updateGroup,
  regenerateGroupJoinCode,
  countGroupOwners,
  transferOwnership,
  leaveGroup,
  deleteGroup,
} from "../services/group.service";
import {
  calculateGroupBalances,
  getIndividualBalance,
} from "../services/balance.service";
import { createNotification } from "../services/notification.service";
import {
  getExchangeRateService,
  isSupportedCurrency,
  CURRENCY_CODES,
} from "../services/currency";

// ============================================================================
// Request/Response Schemas
// ============================================================================

const createGroupSchema = {
  body: t.Object({
    name: t.String({ minLength: 1, maxLength: 100 }),
    description: t.Optional(t.String({ maxLength: 500 })),
    defaultCurrencyCode: t.Optional(t.String({ minLength: 3, maxLength: 3 })),
  }),
  detail: {
    tags: ["Groups"],
    summary: "Create a new group",
    description: "Create a new expense group. The creator automatically becomes the owner. A unique 8-character join code is generated.",
  },
};

const joinGroupSchema = {
  body: t.Object({
    joinCode: t.String({ minLength: 1 }),
  }),
  detail: {
    tags: ["Groups"],
    summary: "Join a group with code",
    description: "Join an existing group using its join code. New members are assigned the 'member' role.",
  },
};

const updateGroupSchema = {
  body: t.Object({
    name: t.Optional(t.String({ minLength: 1, maxLength: 100 })),
    description: t.Optional(t.String({ maxLength: 500 })),
    defaultCurrencyCode: t.Optional(t.String({ minLength: 3, maxLength: 3 })),
  }),
  params: t.Object({
    groupId: t.String(),
  }),
  detail: {
    tags: ["Groups"],
    summary: "Update group settings",
    description: "Update group name, description, or default currency. Only owners and admins can modify group settings.",
  },
};

const leaveGroupSchema = {
  body: t.Optional(
    t.Object({
      transferOwnershipTo: t.Optional(t.String()),
    })
  ),
  params: t.Object({
    groupId: t.String(),
  }),
  detail: {
    tags: ["Groups"],
    summary: "Leave a group",
    description: "Leave the specified group. Owners must transfer ownership before leaving if they are the only owner. Users with unsettled balances receive a warning but can still leave.",
  },
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
  }, {
    detail: {
      tags: ["Groups"],
      summary: "List user's groups",
      description: "Get all groups the authenticated user belongs to, sorted by most recent activity.",
    },
  })

  // ========================================================================
  // GET /groups/:groupId - Get Group Details
  // AC-2.16: User can view single group details
  // AC-2.17: Non-members cannot view group details (403)
  // ========================================================================
  .get(
    "/:groupId",
    async ({ params, auth, authError, set }) => {
      if (!auth) {
        set.status = 401;
        return authError;
      }

      const { groupId } = params;

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
        groupId: t.String(),
      }),
      detail: {
        tags: ["Groups"],
        summary: "Get group details",
        description: "Get detailed information about a specific group including join code. Only accessible to group members.",
      },
    }
  )

  // ========================================================================
  // GET /groups/:groupId/members - List Group Members
  // AC-2.18: Member can list all members of their group
  // AC-2.19: Member list includes: userId, displayName, role, joinedAt
  // ========================================================================
  .get(
    "/:groupId/members",
    async ({ params, auth, authError, set }) => {
      if (!auth) {
        set.status = 401;
        return authError;
      }

      const { groupId } = params;

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
        groupId: t.String(),
      }),
      detail: {
        tags: ["Groups"],
        summary: "List group members",
        description: "Get all members of a group with their roles and join dates. Only accessible to group members.",
      },
    }
  )

  // ========================================================================
  // PUT /groups/:groupId - Update Group Details
  // AC-1.1: Owner/admin can update group name
  // AC-1.2: Owner/admin can update group description
  // AC-1.3: Owner/admin can change default currency
  // AC-1.4: Regular members cannot edit group settings (403)
  // AC-1.5: Group name validation same as create (1-100 chars)
  // AC-1.6: Returns updated group details on success
  // ========================================================================
  .put(
    "/:groupId",
    async ({ params, body, auth, authError, set }) => {
      if (!auth) {
        set.status = 401;
        return authError;
      }

      const { groupId } = params;

      // Check if group exists
      const group = await findGroupById(groupId);
      if (!group) {
        set.status = 404;
        return error(ErrorCodes.NOT_FOUND, "Group not found");
      }

      // AC-1.4: Check if user is owner or admin
      const role = await getMemberRole(auth.userId, groupId);
      if (!isAdminRole(role)) {
        set.status = 403;
        return error(
          ErrorCodes.FORBIDDEN,
          "Only group owners and admins can edit group settings"
        );
      }

      // AC-1.5: Validate name if provided
      if (body.name !== undefined) {
        const trimmedName = body.name.trim();
        if (trimmedName.length === 0 || trimmedName.length > 100) {
          set.status = 400;
          return error(
            ErrorCodes.VALIDATION_ERROR,
            "Group name must be 1-100 characters"
          );
        }
      }

      // Update group
      const updated = await updateGroup(groupId, {
        name: body.name,
        description: body.description,
        defaultCurrencyCode: body.defaultCurrencyCode,
      });

      if (!updated) {
        set.status = 500;
        return error(ErrorCodes.INTERNAL_ERROR, "Failed to update group");
      }

      // AC-1.6: Return updated group details
      return success({
        id: updated.id,
        name: updated.name,
        description: updated.label,
        defaultCurrencyCode: updated.defaultCurrencyCode,
        updatedAt: updated.updatedAt,
      });
    },
    updateGroupSchema
  )

  // ========================================================================
  // POST /groups/:groupId/leave - Leave a Group
  // AC-1.7: Member can leave a group they belong to
  // AC-1.8: Owner cannot leave if they are the only owner
  // AC-1.9: Owner can transfer ownership before leaving
  // AC-1.10: Member with unsettled debts receives warning but can still leave
  // AC-1.11: Left member no longer appears in member list
  // AC-1.12: Left member can rejoin via join code
  // ========================================================================
  .post(
    "/:groupId/leave",
    async ({ params, body, auth, authError, set }) => {
      if (!auth) {
        set.status = 401;
        return authError;
      }

      const { groupId } = params;

      // Check if group exists
      const group = await findGroupById(groupId);
      if (!group) {
        set.status = 404;
        return error(ErrorCodes.NOT_FOUND, "Group not found");
      }

      // Check membership and role
      const role = await getMemberRole(auth.userId, groupId);
      if (!role) {
        set.status = 403;
        return error(ErrorCodes.NOT_MEMBER, "You are not a member of this group");
      }

      // AC-1.8, AC-1.9: Handle owner leaving
      if (role === "owner") {
        const ownerCount = await countGroupOwners(groupId);

        if (ownerCount <= 1) {
          // Only owner - must transfer ownership first
          const transferTo = body?.transferOwnershipTo;

          if (!transferTo) {
            set.status = 400;
            return error(
              ErrorCodes.VALIDATION_ERROR,
              "You are the only owner. Transfer ownership to another member before leaving.",
              { requiresOwnershipTransfer: true }
            );
          }

          // AC-1.9: Transfer ownership
          const transferred = await transferOwnership(groupId, auth.userId, transferTo);
          if (!transferred) {
            set.status = 400;
            return error(
              ErrorCodes.VALIDATION_ERROR,
              "Could not transfer ownership. Target user must be a member of the group."
            );
          }
        }
      }

      // AC-1.10, AC-2.11: Check for unsettled balances and include warning
      let warning: string | undefined;
      const balance = await getIndividualBalance(groupId, auth.userId);
      if (balance && balance.netBalance !== 0) {
        if (balance.netBalance < 0) {
          // User owes money
          const totalOwed = balance.owesTo.reduce((sum, d) => sum + d.amount, 0);
          warning = `Warning: You still owe ${group.defaultCurrencyCode || 'USD'} ${Math.abs(balance.netBalance).toFixed(2)} to other members. Please settle your debts.`;
        } else {
          // User is owed money
          const totalOwedToUser = balance.owedBy.reduce((sum, d) => sum + d.amount, 0);
          warning = `Warning: Other members still owe you ${group.defaultCurrencyCode || 'USD'} ${balance.netBalance.toFixed(2)}. Consider settling before leaving.`;
        }
      }

      // AC-1.7, AC-1.11: Leave the group
      const result = await leaveGroup(auth.userId, groupId);

      if (!result.success) {
        set.status = 400;
        return error(ErrorCodes.VALIDATION_ERROR, result.error || "Failed to leave group");
      }

      // AC-1.12: User can rejoin via join code (handled by existing join logic)
      return success({
        message: "Successfully left the group",
        warning,
      });
    },
    leaveGroupSchema
  )

  // ========================================================================
  // POST /groups/:groupId/regenerate-code - Regenerate Join Code
  // AC-1.13: Owner/admin can regenerate join code
  // AC-1.14: Old join code becomes invalid after regeneration
  // AC-1.15: Returns new join code on success
  // ========================================================================
  .post(
    "/:groupId/regenerate-code",
    async ({ params, auth, authError, set }) => {
      if (!auth) {
        set.status = 401;
        return authError;
      }

      const { groupId } = params;

      // Check if group exists
      const group = await findGroupById(groupId);
      if (!group) {
        set.status = 404;
        return error(ErrorCodes.NOT_FOUND, "Group not found");
      }

      // AC-1.13: Check if user is owner or admin
      const role = await getMemberRole(auth.userId, groupId);
      if (!isAdminRole(role)) {
        set.status = 403;
        return error(
          ErrorCodes.FORBIDDEN,
          "Only group owners and admins can regenerate join codes"
        );
      }

      // AC-1.14, AC-1.15: Generate and return new code
      const newCode = await regenerateGroupJoinCode(groupId);

      if (!newCode) {
        set.status = 500;
        return error(ErrorCodes.INTERNAL_ERROR, "Failed to regenerate join code");
      }

      return success({
        joinCode: newCode,
        message: "Join code regenerated. The old code is no longer valid.",
      });
    },
    {
      params: t.Object({
        groupId: t.String(),
      }),
      detail: {
        tags: ["Groups"],
        summary: "Regenerate join code",
        description: "Generate a new join code for the group. The old code becomes invalid immediately. Only owners and admins can regenerate codes.",
      },
    }
  )

  // ========================================================================
  // DELETE /groups/:groupId - Delete Group
  // AC-1.16: Only owner can delete group
  // AC-1.17: Deletion is soft delete (sets deletedAt)
  // AC-1.18: Deleted group no longer appears in any member's group list
  // AC-1.19: Members are notified of deletion (stub - when notifications exist)
  // ========================================================================
  .delete(
    "/:groupId",
    async ({ params, auth, authError, set }) => {
      if (!auth) {
        set.status = 401;
        return authError;
      }

      const { groupId } = params;

      // Check if group exists
      const group = await findGroupById(groupId);
      if (!group) {
        set.status = 404;
        return error(ErrorCodes.NOT_FOUND, "Group not found");
      }

      // AC-1.16: Check if user is owner (not just admin)
      const role = await getMemberRole(auth.userId, groupId);
      if (role !== "owner") {
        set.status = 403;
        return error(ErrorCodes.FORBIDDEN, "Only the group owner can delete the group");
      }

      // AC-1.19, AC-2.12: Notify all members before deletion
      // Get all members first (before soft delete makes them harder to query)
      const members = await getGroupMembers(groupId);
      const groupName = group.name;

      // AC-1.17: Soft delete
      const deleted = await deleteGroup(groupId);

      if (!deleted) {
        set.status = 500;
        return error(ErrorCodes.INTERNAL_ERROR, "Failed to delete group");
      }

      // AC-1.19, AC-2.12: Notify all members (except the owner who deleted it)
      for (const member of members) {
        if (member.userId !== auth.userId) {
          await createNotification({
            userId: member.userId,
            type: "member_removed", // Using existing type for group-related notifications
            title: `Group "${groupName}" was deleted`,
            body: `The group "${groupName}" has been deleted by the owner.`,
            data: { groupId, groupName },
          });
        }
      }

      // AC-1.18: Group will no longer appear in queries (handled by isNull(deletedAt) filters)
      return success({
        message: "Group has been deleted",
        deletedAt: new Date().toISOString(),
      });
    },
    {
      params: t.Object({
        groupId: t.String(),
      }),
      detail: {
        tags: ["Groups"],
        summary: "Delete group",
        description: "Soft delete a group. Only the owner can delete a group. All members are notified of the deletion.",
      },
    }
  )

  // ========================================================================
  // GET /groups/:groupId/balances - Get Group Balances
  // AC-3.1: Calculate net balance for each member
  // AC-3.2: Positive balance = member is owed money
  // AC-3.3: Negative balance = member owes money
  // AC-3.4: Sum of all balances equals zero
  // AC-3.5: Returns simplified debts (who pays whom)
  // AC-3.6: Simplified debts minimize number of transactions
  // AC-3.7 to AC-3.9: Individual balance view
  // Sprint 005:
  // AC-1.5: Accepts optional `currency` query parameter
  // AC-1.6: When currency specified, all balances converted
  // AC-1.7: Conversion rate and timestamp included in response
  // AC-1.8: Default behavior returns balances in original currencies
  // ========================================================================
  .get(
    "/:groupId/balances",
    async ({ params, query, auth, authError, set }) => {
      if (!auth) {
        set.status = 401;
        return authError;
      }

      const { groupId } = params;

      // Check if group exists
      const group = await findGroupById(groupId);
      if (!group) {
        set.status = 404;
        return error(ErrorCodes.NOT_FOUND, "Group not found");
      }

      // Check if user is a member
      const { isMember } = await isMemberOfGroup(auth.userId, groupId);
      if (!isMember) {
        set.status = 403;
        return error(ErrorCodes.NOT_MEMBER, "You are not a member of this group");
      }

      // AC-1.5: Optional currency parameter for conversion
      const targetCurrency = query?.currency?.toUpperCase();
      if (targetCurrency && !isSupportedCurrency(targetCurrency)) {
        set.status = 400;
        return error(
          ErrorCodes.VALIDATION_ERROR,
          `Currency '${targetCurrency}' is not supported. Supported: ${CURRENCY_CODES.join(", ")}`
        );
      }

      // Check if requesting individual balance or full group balances
      const userId = query?.userId;

      if (userId) {
        // AC-3.7 to AC-3.9: Individual balance view
        const individualBalance = await getIndividualBalance(groupId, userId);

        if (!individualBalance) {
          set.status = 404;
          return error(ErrorCodes.NOT_FOUND, "User is not a member of this group");
        }

        return success({
          memberId: individualBalance.memberId,
          userId: individualBalance.userId,
          displayName: individualBalance.displayName,
          totalPaid: individualBalance.totalPaid,
          totalOwed: individualBalance.totalOwed,
          netBalance: individualBalance.netBalance,
          owesTo: individualBalance.owesTo,
          owedBy: individualBalance.owedBy,
        });
      }

      // AC-3.1 to AC-3.6: Full group balances
      const balances = await calculateGroupBalances(groupId);

      // AC-1.6, AC-1.7, AC-1.8: Currency conversion
      let conversionInfo: {
        targetCurrency: string;
        originalCurrency: string;
        conversionRate: number;
        rateTimestamp: string;
      } | null = null;

      let memberBalancesResult = balances.memberBalances.map((b) => ({
        memberId: b.memberId,
        userId: b.userId,
        displayName: b.displayName,
        totalPaid: b.totalPaid,
        totalOwed: b.totalOwed,
        netBalance: b.netBalance,
      }));

      let simplifiedDebtsResult = balances.simplifiedDebts.map((d) => ({
        from: {
          userId: d.from.userId,
          displayName: d.from.displayName,
        },
        to: {
          userId: d.to.userId,
          displayName: d.to.displayName,
        },
        amount: d.amount,
      }));

      // AC-1.6: Convert balances if currency is specified
      if (targetCurrency && targetCurrency !== balances.currency) {
        try {
          const exchangeService = getExchangeRateService();
          const conversionRate = await exchangeService.getRate(
            balances.currency,
            targetCurrency
          );
          const rates = await exchangeService.getRates();

          // Convert all amounts
          memberBalancesResult = balances.memberBalances.map((b) => ({
            memberId: b.memberId,
            userId: b.userId,
            displayName: b.displayName,
            totalPaid: Math.round(b.totalPaid * conversionRate * 100) / 100,
            totalOwed: Math.round(b.totalOwed * conversionRate * 100) / 100,
            netBalance: Math.round(b.netBalance * conversionRate * 100) / 100,
          }));

          simplifiedDebtsResult = balances.simplifiedDebts.map((d) => ({
            from: {
              userId: d.from.userId,
              displayName: d.from.displayName,
            },
            to: {
              userId: d.to.userId,
              displayName: d.to.displayName,
            },
            amount: Math.round(d.amount * conversionRate * 100) / 100,
          }));

          // AC-1.7: Include conversion rate and timestamp
          conversionInfo = {
            targetCurrency,
            originalCurrency: balances.currency,
            conversionRate,
            rateTimestamp: rates.timestamp.toISOString(),
          };
        } catch (err) {
          // If conversion fails, return original currency with warning
          console.error("Currency conversion failed:", err);
        }
      }

      return success({
        groupId: balances.groupId,
        currency: conversionInfo?.targetCurrency || balances.currency,
        memberBalances: memberBalancesResult,
        simplifiedDebts: simplifiedDebtsResult,
        calculatedAt: balances.calculatedAt.toISOString(),
        // AC-1.7: Include conversion info when conversion was applied
        ...(conversionInfo && { conversion: conversionInfo }),
      });
    },
    {
      params: t.Object({
        groupId: t.String(),
      }),
      query: t.Optional(
        t.Object({
          userId: t.Optional(t.String()),
          currency: t.Optional(t.String({ minLength: 3, maxLength: 3 })),
        })
      ),
      detail: {
        tags: ["Balances"],
        summary: "Get group balances",
        description: "Calculate and return net balances for all group members, including simplified debt suggestions that minimize the number of transactions needed to settle debts. Optionally convert to a different currency or get individual user balances.",
      },
    }
  );
