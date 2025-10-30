import { z } from "zod";
import { json } from "@remix-run/node";
import {
  createHybridActionApiRoute,
  createHybridLoaderApiRoute,
} from "~/services/routeBuilders/apiBuilder.server";
import { prisma } from "~/db.server";
import { permissionService } from "~/services/permission.server";
import { logger } from "~/services/logger.service";

// Schema for creating spaces
const CreateSpaceSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().optional(),
  visibility: z.enum(["PRIVATE", "TEAM", "WORKSPACE"]).default("TEAM"),
  icon: z.string().optional().default("📁"),
});

// POST /api/v1/teams/:teamId/spaces - Create a new space for team
const { action } = createHybridActionApiRoute(
  {
    body: CreateSpaceSchema,
    allowJWT: true,
    method: "POST",
    corsStrategy: "all",
    authorization: { action: "create_space" },
  },
  async ({ body, authentication, params }) => {
    try {
      const userId = authentication.userId;
      const { teamId } = params;

      if (!teamId) {
        return json({ error: "Team ID is required" }, { status: 400 });
      }

      // Check if user is a member of this team
      const isMember = await permissionService.isTeamMember(userId, teamId);

      if (!isMember) {
        return json(
          { error: "You must be a team member to create spaces" },
          { status: 403 },
        );
      }

      // Get team to find workspace
      const team = await prisma.team.findUnique({
        where: { id: teamId },
        include: {
          workspace: true,
        },
      });

      if (!team) {
        return json({ error: "Team not found" }, { status: 404 });
      }

      const { name, description, visibility, icon } = body;

      // Create the space
      const space = await prisma.space.create({
        data: {
          name,
          description,
          visibility,
          icon,
          teamId,
          workspaceId: team.workspaceId,
        },
      });

      logger.info(
        `Space ${space.id} created for team ${teamId} by user ${userId}`,
      );

      return json({
        space: {
          id: space.id,
          name: space.name,
          description: space.description,
          visibility: space.visibility,
          icon: space.icon,
          teamId: space.teamId,
          workspaceId: space.workspaceId,
          createdAt: space.createdAt,
          updatedAt: space.updatedAt,
        },
        success: true,
      });
    } catch (error) {
      logger.error(
        "Error creating space:",
        error as Record<string, unknown>,
      );
      return json({ error: "Failed to create space" }, { status: 500 });
    }
  },
);

// GET /api/v1/teams/:teamId/spaces - List team spaces
const { loader } = createHybridLoaderApiRoute(
  {
    allowJWT: true,
    corsStrategy: "all",
    findResource: async () => 1,
  },
  async ({ authentication, params }) => {
    try {
      const userId = authentication.userId;
      const { teamId } = params;

      if (!teamId) {
        return json({ error: "Team ID is required" }, { status: 400 });
      }

      // Check if user can view this team
      const canView = await permissionService.canPerformTeamAction(
        userId,
        teamId,
        "view",
      );

      if (!canView) {
        return json(
          { error: "You don't have permission to view this team" },
          { status: 403 },
        );
      }

      // Get team spaces
      const spaces = await prisma.space.findMany({
        where: {
          teamId,
          deleted: null,
        },
        orderBy: {
          createdAt: "desc",
        },
      });

      return json({
        spaces: spaces.map((space) => ({
          id: space.id,
          name: space.name,
          description: space.description,
          visibility: space.visibility,
          icon: space.icon,
          teamId: space.teamId,
          workspaceId: space.workspaceId,
          createdAt: space.createdAt,
          updatedAt: space.updatedAt,
        })),
        success: true,
      });
    } catch (error) {
      logger.error(
        "Error fetching team spaces:",
        error as Record<string, unknown>,
      );
      return json({ error: "Failed to fetch spaces" }, { status: 500 });
    }
  },
);

export { action, loader };
