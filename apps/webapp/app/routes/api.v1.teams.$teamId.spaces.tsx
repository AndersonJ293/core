import { z } from "zod";
import { json } from "@remix-run/node";
import {
  createHybridActionApiRoute,
  createHybridLoaderApiRoute,
} from "~/services/routeBuilders/apiBuilder.server";
import { prisma } from "~/db.server";
import { permissionService } from "~/services/permission.server";
import { requireUser } from "~/services/session.server";
import { requireTeamAdmin, requireTeamMember } from "~/utils/team-permissions.server";
import { checkRateLimit } from "~/utils/rate-limit.server";
import { AuditService } from "~/services/audit.service";
import { logger } from "~/services/logger.service";

// Schema for team params
const TeamParamsSchema = z.object({
  teamId: z.string(),
});

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
    params: TeamParamsSchema,
    allowJWT: true,
    method: "POST",
    corsStrategy: "all",
    authorization: { action: "create_space" },
  },
  async ({ body, authentication, params, request }) => {
    try {
      const userId = authentication.userId;
      const { teamId } = params;

      if (!teamId) {
        return json({ error: "Team ID is required" }, { status: 400 });
      }

      // Apply rate limiting: 10 team space creations per minute
      await checkRateLimit(request, 10, 60);

      // Use middleware to require team admin access
      await permissionService.requireTeamAdmin(userId, teamId);

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

      // Log audit trail
      await AuditService.logSpaceCreate({
        userId,
        spaceId: space.id,
        teamId,
        visibility,
        request,
      });

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
      logger.error("Error creating space:", error as Record<string, unknown>);
      const errorMessage = error instanceof Response ? error : { error: "Failed to create space" };
      const status = error instanceof Response ? error.status : 500;
      return json(errorMessage, { status });
    }
  },
);

// GET /api/v1/teams/:teamId/spaces - List team spaces
export const loader = async ({
  params,
  request,
}: {
  params: any;
  request: Request;
}) => {
  try {
    // Use middleware to require team member access
    const { user, teamId } = await requireTeamMember(request, params.teamId);

    // Get team spaces
    const spaces = await prisma.space.findMany({
      where: {
        teamId,
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
    logger.error("Error fetching team spaces:", error);
    const errorMessage = error instanceof Response ? error : { error: "Failed to fetch spaces" };
    const status = error instanceof Response ? error.status : 500;
    return json(errorMessage, { status });
  }
};

export { action };
