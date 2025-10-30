import { z } from "zod";
import { json } from "@remix-run/node";
import {
  createHybridActionApiRoute,
  createHybridLoaderApiRoute,
} from "~/services/routeBuilders/apiBuilder.server";
import { prisma } from "~/db.server";
import { permissionService } from "~/services/permission.server";
import { logger } from "~/services/logger.service";

// Schema for inviting members
const InviteMemberSchema = z.object({
  email: z.string().email(),
  role: z.enum(["OWNER", "MEMBER"]).default("MEMBER"),
});

// POST /api/v1/teams/:teamId/members - Invite a member to team
const { action } = createHybridActionApiRoute(
  {
    body: InviteMemberSchema,
    allowJWT: true,
    method: "POST",
    corsStrategy: "all",
    authorization: { action: "team_invite" },
  },
  async ({ body, authentication, params }) => {
    try {
      const userId = authentication.userId;
      const { teamId } = params;

      if (!teamId) {
        return json({ error: "Team ID is required" }, { status: 400 });
      }

      // Check if user can invite members to this team
      const canInvite = await permissionService.canPerformTeamAction(
        userId,
        teamId,
        "invite",
      );

      if (!canInvite) {
        return json(
          { error: "You don't have permission to invite members to this team" },
          { status: 403 },
        );
      }

      const { email, role } = body;

      // Find user by email
      const invitedUser = await prisma.user.findFirst({
        where: {
          email,
        },
      });

      if (!invitedUser) {
        return json(
          { error: "User not found with this email" },
          { status: 404 },
        );
      }

      // Check if user is already a member
      const existingMember = await prisma.teamMember.findUnique({
        where: {
          teamId_userId: {
            teamId,
            userId: invitedUser.id,
          },
        },
      });

      if (existingMember && !existingMember.deleted) {
        return json(
          { error: "User is already a member of this team" },
          { status: 400 },
        );
      }

      // If member was previously deleted, restore them
      if (existingMember && existingMember.deleted) {
        const restoredMember = await prisma.teamMember.update({
          where: {
            id: existingMember.id,
          },
          data: {
            deleted: null,
            role,
            updatedAt: new Date(),
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
          `User ${invitedUser.id} restored to team ${teamId} by ${userId}`,
        );

        return json({
          member: {
            id: restoredMember.id,
            role: restoredMember.role,
            userId: restoredMember.userId,
            teamId: restoredMember.teamId,
            user: {
              id: restoredMember.user.id,
              name: restoredMember.user.name,
              email: restoredMember.user.email,
            },
            createdAt: restoredMember.createdAt,
            updatedAt: restoredMember.updatedAt,
          },
          success: true,
        });
      }

      // Create new team member
      const member = await prisma.teamMember.create({
        data: {
          teamId,
          userId: invitedUser.id,
          role,
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
        `User ${invitedUser.id} added to team ${teamId} by ${userId} with role ${role}`,
      );

      return json({
        member: {
          id: member.id,
          role: member.role,
          userId: member.userId,
          teamId: member.teamId,
          user: {
            id: member.user.id,
            name: member.user.name,
            email: member.user.email,
          },
          createdAt: member.createdAt,
          updatedAt: member.updatedAt,
        },
        success: true,
      });
    } catch (error) {
      logger.error(
        "Error inviting team member:",
        error as Record<string, unknown>,
      );
      return json({ error: "Failed to invite member" }, { status: 500 });
    }
  },
);

// GET /api/v1/teams/:teamId/members - List team members
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

      // Get team members
      const members = await prisma.teamMember.findMany({
        where: {
          teamId,
          deleted: null,
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
        orderBy: [
          { role: "asc" }, // OWNER first
          { createdAt: "asc" },
        ],
      });

      return json({
        members: members.map((member) => ({
          id: member.id,
          role: member.role,
          userId: member.userId,
          teamId: member.teamId,
          user: {
            id: member.user.id,
            name: member.user.name,
            email: member.user.email,
          },
          createdAt: member.createdAt,
          updatedAt: member.updatedAt,
        })),
        success: true,
      });
    } catch (error) {
      logger.error(
        "Error fetching team members:",
        error as Record<string, unknown>,
      );
      return json({ error: "Failed to fetch members" }, { status: 500 });
    }
  },
);

export { action, loader };
