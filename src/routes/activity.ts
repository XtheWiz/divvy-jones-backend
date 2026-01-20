/**
 * Activity Routes
 * Sprint 004 - TASK-012
 *
 * REST endpoint for retrieving group activity log.
 */

import { Elysia, t } from "elysia";
import { success, error, ErrorCodes } from "../lib/responses";
import { requireAuth } from "../middleware/auth";
import { isMemberOfGroup, findGroupById } from "../services/group.service";
import {
  listActivity,
  formatActivitySummary,
  type EntityType,
} from "../services/activity.service";

// ============================================================================
// Activity Routes
// ============================================================================

export const activityRoutes = new Elysia({ prefix: "/groups/:groupId/activity" })
  .use(requireAuth)

  // ========================================================================
  // GET /groups/:groupId/activity - List Group Activity
  // AC-2.10: GET /groups/:groupId/activity - List group activity
  // AC-2.11: Activity list is paginated (default 20, max 100)
  // AC-2.12: Activity sorted by timestamp descending (newest first)
  // AC-2.13: Each activity shows: actor, action type, target, timestamp
  // AC-2.14: Activity can be filtered by type (expense, settlement, member)
  // AC-2.15: Activity can be filtered by date range
  // ========================================================================
  .get(
    "/",
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

      // Parse query parameters
      const limit = query?.limit ? parseInt(query.limit, 10) : 20;
      const offset = query?.offset ? parseInt(query.offset, 10) : 0;
      const entityType = query?.type as EntityType | undefined;
      const from = query?.from ? new Date(query.from) : undefined;
      const to = query?.to ? new Date(query.to) : undefined;
      // AC-2.6: Include archived activity logs when requested
      const includeArchived = query?.includeArchived === "true";

      // Validate date range
      if (from && isNaN(from.getTime())) {
        set.status = 400;
        return error(ErrorCodes.VALIDATION_ERROR, "Invalid 'from' date format");
      }
      if (to && isNaN(to.getTime())) {
        set.status = 400;
        return error(ErrorCodes.VALIDATION_ERROR, "Invalid 'to' date format");
      }

      // Get activity
      // AC-2.6: Pass includeArchived to include archived records
      const result = await listActivity({
        groupId,
        limit,
        offset,
        entityType,
        from,
        to,
        includeArchived,
      });

      // Format response
      return success({
        activities: result.activities.map((a) => ({
          id: a.id,
          actor: a.actor,
          action: a.action,
          entityType: a.entityType,
          entityId: a.entityId,
          summary: formatActivitySummary(a),
          timestamp: a.createdAt.toISOString(),
        })),
        pagination: {
          total: result.total,
          limit: result.limit,
          offset: result.offset,
          hasMore: result.offset + result.activities.length < result.total,
        },
      });
    },
    {
      params: t.Object({
        groupId: t.String(),
      }),
      query: t.Optional(
        t.Object({
          limit: t.Optional(t.String()),
          offset: t.Optional(t.String()),
          type: t.Optional(
            t.Union([
              t.Literal("expense"),
              t.Literal("settlement"),
              t.Literal("member"),
              t.Literal("group"),
              t.Literal("attachment"),
            ])
          ),
          from: t.Optional(t.String()),
          to: t.Optional(t.String()),
          // AC-2.6: Include archived activity logs
          includeArchived: t.Optional(t.String()),
        })
      ),
    }
  );
