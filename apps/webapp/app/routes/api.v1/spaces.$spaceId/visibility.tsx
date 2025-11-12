import { z } from "zod";
import { json } from "@remix-run/node";
import {
  createHybridActionApiRoute,
} from "~/services/routeBuilders/apiBuilder.server";
import { prisma } from "~/db.server";
import { permissionService } from "~/services/permission.server";
import { logger } from "~/services/logger.service";

// Schema for space ID parameter
const SpaceParamsSchema = z.object({
  spaceId: z.string(),
});

// Schema for visibility change
const ChangeVisibilitySchema = z.object({
  visibility: z.enum(["PRIVATE", "TEAM", "WORKSPACE"]),
  teamId: z.string().optional(), // Required if visibility is "TEAM"
});

// POST /api/v1/spaces/:spaceId/visibility - Change space visibility
const { action } = createHybridActionApiRoute(
  {
    body: ChangeVisibilitySchema,
    params: SpaceParamsSchema,
    allowJWT: true,
    method: "POST",
    corsStrategy: "all",
    authorization: { action: "manage" },
  },
  async ({ body, authentication, params }) => {
    try {
      const userId = authentication.userId;
      const { spaceId } = params;

      if (!spaceId) {
        return json({ error: "Space ID is required" }, { status: 400 });
      }

      const { visibility, teamId } = body;

      // Get space with team information
      const space = await prisma.space.findUnique({
        where: { id: spaceId },
        include: {
          team: {
            include: {
              members: {
                where: {
                  userId,
                  deleted: null,
                },
              },
            },
          },
          Workspace: true,
        },
      });

      if (!space) {
        return json({ error: "Space not found" }, { status: 404 });
      }

      // Check if Profile space
      if (space.name.toLowerCase() === "profile") {
        return json(
          { error: "Can't change Profile space visibility" },
          { status: 403 },
        );
      }

      // Check write permission
      const canWrite = await permissionService.canWriteSpace(userId, spaceId);
      if (!canWrite) {
        return json(
          { error: "You don't have permission to modify this space" },
          { status: 403 },
        );
      }

      // Validate team membership if changing to TEAM visibility
      if (visibility === "TEAM") {
        if (!teamId) {
          return json(
            { error: "Team ID is required for TEAM visibility" },
            { status: 400 },
          );
        }

        const isMember = await permissionService.isTeamMember(userId, teamId);
        if (!isMember) {
          return json(
            { error: "You must be a team member to set TEAM visibility" },
            { status: 403 },
          );
        }
      }

      // Update space visibility
      const updatedSpace = await prisma.space.update({
        where: { id: spaceId },
        data: {
          visibility,
          teamId: visibility === "TEAM" ? teamId : null,
        },
      });

      logger.info(
        `Space ${spaceId} visibility changed to ${visibility} by user ${userId}`,
      );

      return json({
        space: {
          id: updatedSpace.id,
          name: updatedSpace.name,
          description: updatedSpace.description,
          visibility: updatedSpace.visibility,
          icon: updatedSpace.icon,
          teamId: updatedSpace.teamId,
          workspaceId: updatedSpace.workspaceId,
          createdAt: updatedSpace.createdAt,
          updatedAt: updatedSpace.updatedAt,
        },
        success: true,
      });
    } catch (error) {
      logger.error("Error changing space visibility:", error);
      return json({ error: "Failed to change visibility" }, { status: 500 });
    }
  },
);

export { action };
