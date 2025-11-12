import { z } from "zod";
import {
  createActionApiRoute,
  createHybridActionApiRoute,
  createHybridLoaderApiRoute,
} from "~/services/routeBuilders/apiBuilder.server";
import { SpaceService } from "~/services/space.server";
import { json } from "@remix-run/node";
import { apiCors } from "~/utils/apiCors";
import { getSpace } from "~/trigger/utils/space-utils";
import { permissionService } from "~/services/permission.server";
import { requireSpaceReadAccess, requireSpaceWriteAccess } from "~/utils/team-permissions.server";
import { checkRateLimit } from "~/utils/rate-limit.server";
import { AuditService } from "~/services/audit.service";
import { prisma } from "~/db.server";

const spaceService = new SpaceService();

// Schema for space ID parameter
const SpaceParamsSchema = z.object({
  spaceId: z.string(),
});

// Schema for updating spaces
const UpdateSpaceSchema = z.object({
  name: z.string().optional(),
  description: z.string().optional(),
});

const { action } = createHybridActionApiRoute(
  {
    params: SpaceParamsSchema,
    allowJWT: true,
    authorization: {
      action: "manage",
    },
    corsStrategy: "all",
  },
  async ({ authentication, params, body, request }) => {
    const userId = authentication.userId;
    const { spaceId } = params;

    if (request.method === "PUT") {
      // Update space
      if (!body || Object.keys(body).length === 0) {
        return json({ error: "No updates provided" }, { status: 400 });
      }

      // Apply rate limiting: 20 space updates per minute
      await checkRateLimit(request, 20, 60);

      const parseResult = UpdateSpaceSchema.safeParse(body);
      if (!parseResult.success) {
        return json(
          { error: "Invalid update data", details: parseResult.error.errors },
          { status: 400 },
        );
      }

      // Get space to check if it's a Profile space
      const space = await prisma.space.findUnique({
        where: { id: spaceId },
      });

      if (!space) {
        return json({ error: "Space not found" }, { status: 404 });
      }

      // Check if Profile space
      if (space.name.toLowerCase() === "profile") {
        return json(
          { error: "Can't modify Profile space" },
          { status: 403 },
        );
      }

      // Use middleware to require write access
      const { user } = await requireSpaceWriteAccess(request);

      const updates: any = {};
      if (parseResult.data.name !== undefined)
        updates.name = parseResult.data.name;

      if (parseResult.data.description !== undefined)
        updates.description = parseResult.data.description;

      const updatedSpace = await spaceService.updateSpace(spaceId, updates, userId);

      // Log audit trail
      await AuditService.logSpaceUpdate({
        userId,
        spaceId,
        changes: updates,
        request,
      });

      return json({ space: updatedSpace, success: true });
    }

    if (request.method === "DELETE") {
      try {
        // Apply rate limiting: 10 space deletions per minute
        await checkRateLimit(request, 10, 60);

        // Get space with team information
        const space = await prisma.space.findUnique({
          where: { id: spaceId },
        });

        if (!space) {
          return json({ error: "Space not found" }, { status: 404 });
        }

        if (space.name.toLowerCase() === "profile") {
          return json(
            { error: "You can't delete Profile space" },
            { status: 403 },
          );
        }

        // Check if user is team owner if it's a team space
        if (space.teamId) {
          const isOwner = await permissionService.isTeamOwner(userId, space.teamId);
          if (!isOwner) {
            return json(
              { error: "You must be a team owner to delete team spaces" },
              { status: 403 },
            );
          }
        } else {
          // For non-team spaces, use middleware to check write permission
          const { user } = await requireSpaceWriteAccess(request);
        }

        // Soft delete: update deletedAt timestamp
        await prisma.space.update({
          where: { id: spaceId },
          data: { deletedAt: new Date() },
        });

        // Log audit trail
        await AuditService.logSpaceDelete({
          userId,
          spaceId,
          request,
        });

        return json({
          success: true,
          message: "Space deleted successfully",
        });
      } catch (error) {
        return json(
          { error: "Failed to delete space" },
          { status: 400 },
        );
      }
    }

    return json({ error: "Method not allowed" }, { status: 405 });
  },
);

const loader = createHybridLoaderApiRoute(
  {
    allowJWT: true,
    params: SpaceParamsSchema,
    corsStrategy: "all",
    findResource: async () => 1,
  },
  async ({ authentication, request, params }) => {
    if (request.method.toUpperCase() === "OPTIONS") {
      return apiCors(request, json({}));
    }

    const userId = authentication.userId;
    const { spaceId } = params;

    if (!spaceId) {
      return json({ error: "Space ID is required" }, { status: 400 });
    }

    // Use middleware to require read access
    await permissionService.checkSpaceAccess(userId, spaceId, 'read');

    // Get space details
    const space = await spaceService.getSpace(
      spaceId,
      userId,
    );

    if (!space) {
      return json({ error: "Space not found" }, { status: 404 });
    }

    return json({ space });
  },
);

export { action, loader };
