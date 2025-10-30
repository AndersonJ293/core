import { z } from "zod";
import { json } from "@remix-run/node";
import {
  createHybridActionApiRoute,
  createHybridLoaderApiRoute,
} from "~/services/routeBuilders/apiBuilder.server";
import { prisma } from "~/db.server";
import { permissionService } from "~/services/permission.server";
import { logger } from "~/services/logger.service";

// Schema for creating teams
const CreateTeamSchema = z.object({
  name: z.string().min(1).max(100),
  slug: z.string().min(1).max(100).regex(/^[a-z0-9-]+$/),
  description: z.string().optional(),
  icon: z.string().optional().default("👥"),
});

// GET /api/v1/teams - List user's teams
const { loader } = createHybridLoaderApiRoute(
  {
    allowJWT: true,
    corsStrategy: "all",
    findResource: async () => 1,
  },
  async ({ authentication, request }) => {
    try {
      const user = await prisma.user.findUnique({
        where: {
          id: authentication.userId,
        },
        include: {
          Workspace: true,
        },
      });

      if (!user?.Workspace?.id) {
        return json(
          { error: "Workspace not found" },
          { status: 404 },
        );
      }

      // Get all teams where user is a member
      const teams = await permissionService.getUserTeams(
        authentication.userId,
        user.Workspace.id,
      );

      logger.info(
        `User ${authentication.userId} retrieved ${teams.length} teams`,
      );

      return json({
        teams: teams.map((team) => ({
          id: team.id,
          name: team.name,
          slug: team.slug,
          description: team.description,
          icon: team.icon,
          workspaceId: team.workspaceId,
          createdAt: team.createdAt,
          updatedAt: team.updatedAt,
          memberCount: team._count.members,
          spaceCount: team._count.spaces,
          members: team.members.map((member) => ({
            id: member.id,
            role: member.role,
            userId: member.userId,
            user: {
              id: member.user.id,
              name: member.user.name,
              email: member.user.email,
            },
            createdAt: member.createdAt,
          })),
        })),
        success: true,
      });
    } catch (error) {
      logger.error(
        "Error fetching teams:",
        error as Record<string, unknown>,
      );
      return json(
        { error: "Failed to fetch teams" },
        { status: 500 },
      );
    }
  },
);

// POST /api/v1/teams - Create a new team
const { action } = createHybridActionApiRoute(
  {
    body: CreateTeamSchema,
    allowJWT: true,
    authorization: {
      action: "manage",
    },
    corsStrategy: "all",
  },
  async ({ authentication, body, request }) => {
    if (request.method !== "POST") {
      return json({ error: "Method not allowed" }, { status: 405 });
    }

    try {
      const user = await prisma.user.findUnique({
        where: {
          id: authentication.userId,
        },
        include: {
          Workspace: true,
        },
      });

      if (!user?.Workspace?.id) {
        return json(
          { error: "Workspace not found" },
          { status: 404 },
        );
      }

      // Check if slug already exists in workspace
      const existingTeam = await prisma.team.findFirst({
        where: {
          slug: body.slug,
          workspaceId: user.Workspace.id,
          deleted: null,
        },
      });

      if (existingTeam) {
        return json(
          { error: "A team with this slug already exists" },
          { status: 400 },
        );
      }

      // Create team
      const team = await prisma.team.create({
        data: {
          name: body.name,
          slug: body.slug,
          description: body.description,
          icon: body.icon || "👥",
          workspaceId: user.Workspace.id,
        },
      });

      // Add creator as team owner
      const membership = await prisma.teamMember.create({
        data: {
          teamId: team.id,
          userId: authentication.userId,
          role: "OWNER",
        },
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
      });

      logger.info(
        `Team ${team.id} created by user ${authentication.userId}`,
      );

      return json({
        team: {
          id: team.id,
          name: team.name,
          slug: team.slug,
          description: team.description,
          icon: team.icon,
          workspaceId: team.workspaceId,
          createdAt: team.createdAt,
          updatedAt: team.updatedAt,
          members: [
            {
              id: membership.id,
              role: membership.role,
              userId: membership.userId,
              user: {
                id: membership.user.id,
                name: membership.user.name,
                email: membership.user.email,
              },
              createdAt: membership.createdAt,
            },
          ],
        },
        success: true,
      });
    } catch (error) {
      logger.error(
        "Error creating team:",
        error as Record<string, unknown>,
      );
      return json(
        { error: "Failed to create team" },
        { status: 500 },
      );
    }
  },
);

export { loader, action };
