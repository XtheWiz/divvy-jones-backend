/**
 * Group Authorization Middleware
 * Sprint 009 - TASK-005, TASK-006
 *
 * Provides reusable middleware for group authorization:
 * - AC-2.1: requireGroupMember validates user is member of group
 * - AC-2.2: requireGroupAdmin validates user is admin of group
 * - AC-2.3: Middleware returns proper 403/404 errors with standard error codes
 * - AC-2.4: Middleware adds groupId and memberId to context for downstream use
 */

import { Elysia } from "elysia";
import { error, ErrorCodes } from "../lib/responses";
import { requireAuth, type AuthContext } from "./auth";
import { findGroupById, isMemberOfGroup, getMemberRole, isAdminRole } from "../services/group.service";

// ============================================================================
// Context Types
// ============================================================================

/**
 * Group membership context added by requireGroupMember middleware
 */
export interface GroupMemberContext {
  /** The validated group ID from the route params */
  groupId: string;
  /** The current user's membership ID in this group */
  memberId: string;
  /** The current user's role in this group */
  memberRole: string;
}

/**
 * Group admin context - same as member but with admin role verified
 */
export interface GroupAdminContext extends GroupMemberContext {
  /** Whether the user is the group owner (not just admin) */
  isOwner: boolean;
}

// ============================================================================
// Group Member Middleware (TASK-005)
// AC-2.1, AC-2.3, AC-2.4
// ============================================================================

/**
 * Middleware that validates user is a member of the group
 *
 * Usage:
 * ```typescript
 * new Elysia()
 *   .use(requireGroupMember)
 *   .get("/groups/:groupId/resource", ({ groupId, memberId, memberRole }) => {
 *     // groupId and memberId are guaranteed valid here
 *   });
 * ```
 *
 * This middleware:
 * - Requires authentication (uses requireAuth internally)
 * - Validates groupId param exists and group exists
 * - Validates user is an active member of the group
 * - Adds groupId, memberId, and memberRole to context
 *
 * Returns:
 * - 401 if not authenticated
 * - 404 if group not found (AC-2.3)
 * - 403 if user is not a member (AC-2.3)
 */
export const requireGroupMember = new Elysia({ name: "requireGroupMember" })
  .use(requireAuth)
  .derive(async ({ auth, authError, request, set }) => {
    // Auth is already validated by requireAuth, but check for null
    if (!auth) {
      return {
        groupId: null as string | null,
        memberId: null as string | null,
        memberRole: null as string | null,
        groupError: authError,
      };
    }

    // Extract groupId from URL path
    // Supports both /groups/:groupId/... and nested routes
    const url = new URL(request.url);
    const pathParts = url.pathname.split("/");
    const groupsIndex = pathParts.indexOf("groups");

    if (groupsIndex === -1 || groupsIndex + 1 >= pathParts.length) {
      set.status = 400;
      return {
        groupId: null as string | null,
        memberId: null as string | null,
        memberRole: null as string | null,
        groupError: error(ErrorCodes.VALIDATION_ERROR, "Missing groupId in URL"),
      };
    }

    const groupId = pathParts[groupsIndex + 1];

    // Validate group exists (AC-2.3 - returns 404 if not found)
    const group = await findGroupById(groupId);
    if (!group) {
      set.status = 404;
      return {
        groupId: null as string | null,
        memberId: null as string | null,
        memberRole: null as string | null,
        groupError: error(ErrorCodes.NOT_FOUND, "Group not found"),
      };
    }

    // Validate user is a member (AC-2.3 - returns 403 if not member)
    const { isMember, membership } = await isMemberOfGroup(auth.userId, groupId);
    if (!isMember || !membership) {
      set.status = 403;
      return {
        groupId: null as string | null,
        memberId: null as string | null,
        memberRole: null as string | null,
        groupError: error(ErrorCodes.NOT_MEMBER, "You are not a member of this group"),
      };
    }

    // AC-2.4: Add groupId, memberId, and memberRole to context
    return {
      groupId,
      memberId: membership.id,
      memberRole: membership.role,
      groupError: null,
    };
  })
  .onBeforeHandle(({ groupId, groupError, set }) => {
    if (!groupId) {
      // Status already set in derive
      return groupError;
    }
  })
  .as("scoped");

// ============================================================================
// Group Admin Middleware (TASK-006)
// AC-2.2
// ============================================================================

/**
 * Middleware that validates user is an admin of the group
 *
 * Usage:
 * ```typescript
 * new Elysia()
 *   .use(requireGroupAdmin)
 *   .delete("/groups/:groupId", ({ groupId, isOwner }) => {
 *     // User is guaranteed to be admin or owner here
 *   });
 * ```
 *
 * This middleware:
 * - Includes all requireGroupMember functionality
 * - Additionally validates user has admin or owner role
 *
 * Returns:
 * - All errors from requireGroupMember
 * - 403 if user is not an admin (AC-2.2)
 */
export const requireGroupAdmin = new Elysia({ name: "requireGroupAdmin" })
  .use(requireGroupMember)
  .derive(async ({ groupId, memberId, memberRole, groupError, auth, set }) => {
    // If group member validation failed, pass through
    if (!groupId || !memberId || !memberRole) {
      return {
        isOwner: false,
        adminError: groupError,
      };
    }

    // Check if user has admin role (AC-2.2)
    if (!isAdminRole(memberRole)) {
      set.status = 403;
      return {
        isOwner: false,
        adminError: error(ErrorCodes.FORBIDDEN, "You must be an admin to perform this action"),
      };
    }

    return {
      isOwner: memberRole === "owner",
      adminError: null,
    };
  })
  .onBeforeHandle(({ adminError }) => {
    if (adminError) {
      return adminError;
    }
  })
  .as("scoped");

// ============================================================================
// Helper Types for Route Handlers
// ============================================================================

/**
 * Type helper for handlers that use requireGroupMember
 * Use this to properly type your handler parameters
 */
export type GroupMemberHandler = {
  auth: AuthContext;
  groupId: string;
  memberId: string;
  memberRole: string;
};

/**
 * Type helper for handlers that use requireGroupAdmin
 */
export type GroupAdminHandler = GroupMemberHandler & {
  isOwner: boolean;
};
