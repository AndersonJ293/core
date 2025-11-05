import { z } from "zod";
import { json } from "@remix-run/node";
import { prisma } from "~/db.server";
import { requireUser } from "~/services/session.server";
import { logger } from "~/services/logger.service";

const TeamParamsSchema = z.object({
  teamId: z.string(),
});

// GET /api/v1/teams/:teamId - Get team details
export const loader = async ({ params, request }) => {
  try {
    console.log("DEBUG: params:", params);
    const { teamId } = TeamParamsSchema.parse(params || {});
    console.log("DEBUG: teamId:", teamId);

    if (!teamId) {
      return json(
        { error: "Team ID is required" },
        { status: 400 },
      );
    }

    // Authenticate the request
    const user = await requireUser(request);

    // Get user's workspace
    const workspace = await prisma.workspace.findFirst({
      where: {
        userId: user.id,
      },
    });

    if (!workspace) {
      return json(
        { error: "Workspace not found" },
        { status: 404 },
      );
    }

    // Get team with member count
    const team = await prisma.team.findFirst({
      where: {
        id: teamId,
        workspaceId: workspace.id,
        deleted: null,
      },
      include: {
        members: {
          where: {
            deleted: null,
          },
        },
        _count: {
          select: {
            members: {
              where: {
                deleted: null,
              },
            },
            spaces: {}, // Space doesn't have deleted field
          },
        },
      },
    });

    if (!team) {
      return json(
        { error: "Team not found" },
        { status: 404 },
      );
    }

    // Check if user is member of this team
    const userMembership = team.members.find(
      member => member.userId === user.id
    );

    if (!userMembership) {
      return json(
        { error: "Access denied" },
        { status: 403 },
      );
    }

    return json({
      success: true,
      team: {
        id: team.id,
        name: team.name,
        slug: team.slug,
        description: team.description,
        icon: team.icon,
        memberCount: team._count.members,
        spaceCount: team._count.spaces,
        createdAt: team.createdAt.toISOString(),
        updatedAt: team.updatedAt.toISOString(),
      },
    });

  } catch (error) {
    logger.error("Error fetching team", { error, teamId: params?.teamId });
    return json(
      { error: "Failed to fetch team" },
      { status: 500 },
    );
  }
};
