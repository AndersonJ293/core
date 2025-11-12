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

// Slug generation utility
function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '') // Remove special characters
    .replace(/[\s_-]+/g, '-') // Replace spaces and underscores with hyphens
    .replace(/^-+|-+$/g, ''); // Remove leading/trailing hyphens
}

// Function to generate unique slug by checking for duplicates
async function generateUniqueSlug(name: string, workspaceId: string, teamId?: string): Promise<string> {
  let slug = generateSlug(name);
  let counter = 1;
  let isUnique = false;

  while (!isUnique) {
    const existingSpace = await prisma.space.findFirst({
      where: {
        slug,
        workspaceId,
        teamId,
      },
    });

    if (!existingSpace) {
      isUnique = true;
    } else {
      slug = `${generateSlug(name)}-${counter}`;
      counter++;
    }
  }

  return slug;
}

// Schema for creating spaces
const CreateSpaceSchema = z.object({
  name: z.string().min(3).max(100), // Fixed: Require at least 3 characters
  description: z.string().max(500).optional(), // Fixed: Add max length validation
  visibility: z.enum(['PRIVATE', 'TEAM', 'WORKSPACE']).optional().default('TEAM'), // Added: Space visibility
  icon: z.string().max(5).optional().default("📁"), // Fixed: Add max length for icon (accounting for emoji length)
  autoMode: z.boolean().optional().default(false), // Added: Allow setting auto mode
  themes: z.array(z.string()).optional().default([]), // Added: Allow setting themes
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

      const { name, description, visibility, icon, autoMode, themes } = body;

      // Generate unique slug for the space
      const slug = await generateUniqueSlug(name, team.workspaceId, teamId);

      // Create the space with all fields from Prisma schema
      const space = await prisma.space.create({
        data: {
          name,
          slug,
          description,
          visibility: visibility || 'TEAM',
          icon,
          autoMode,
          themes,
          teamId,
          workspaceId: team.workspaceId,
        },
      });

      logger.info(
        `Space ${space.id} created for team ${teamId} by user ${userId}`,
      );

      // Log audit trail (use 'team' as visibility since spaces are team-scoped)
      await AuditService.logSpaceCreate({
        userId,
        spaceId: space.id,
        teamId,
        visibility: 'team', // Team spaces are always team-scoped
        request,
      });

      return json({
        space: {
          id: space.id,
          name: space.name,
          slug: space.slug,
          description: space.description,
          visibility: space.visibility,
          icon: space.icon,
          autoMode: space.autoMode,
          themes: space.themes,
          teamId: space.teamId,
          workspaceId: space.workspaceId,
          createdAt: space.createdAt,
          updatedAt: space.updatedAt,
        },
        success: true,
      }, { status: 201 });
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
        slug: space.slug,
        description: space.description,
        visibility: space.visibility,
        icon: space.icon,
        autoMode: space.autoMode,
        themes: space.themes,
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
