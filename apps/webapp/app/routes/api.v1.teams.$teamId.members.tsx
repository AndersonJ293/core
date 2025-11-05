import { z } from "zod";
import { json } from "@remix-run/node";
import { createHybridActionApiRoute } from "~/services/routeBuilders/apiBuilder.server";
import { prisma } from "~/db.server";
import { permissionService } from "~/services/permission.server";
import { inviteService } from "~/services/inviteService.server";
import { requireUser } from "~/services/session.server";
import { logger } from "~/services/logger.service";

// Schema for team params
const TeamParamsSchema = z.object({
  teamId: z.string(),
});

// Schema for inviting members
const InviteMemberSchema = z.object({
  email: z.string().email(),
  role: z.enum(["OWNER", "MEMBER"]).default("MEMBER"),
});

// POST /api/v1/teams/:teamId/members - Create a team invite (now uses invite system)
const { action } = createHybridActionApiRoute(
  {
    body: InviteMemberSchema,
    params: TeamParamsSchema,
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

      const { email, role } = body;

      // Use invite service to create invite instead of direct member creation
      const invite = await inviteService.createInvite(
        teamId,
        userId,
        email,
        role,
      );

      return json({
        invite: {
          id: invite.id,
          teamId: invite.teamId,
          invitedUserEmail: invite.invitedUserEmail,
          role: invite.role,
          status: invite.status,
          expiresAt: invite.expiresAt,
          createdAt: invite.createdAt,
          team: invite.team,
          inviter: invite.inviter,
        },
        success: true,
        message: "Invite sent! User needs to accept to join the team.",
      });
    } catch (error) {
      logger.error("Error creating team invite:", error as any);
      const errorMessage =
        error instanceof Error ? error.message : "Failed to create invite";
      return json({ error: errorMessage }, { status: 400 });
    }
  },
);

// GET /api/v1/teams/:teamId/members - List team members
export const loader = async ({
  params,
  request,
}: {
  params: any;
  request: Request;
}) => {
  try {
    const user = await requireUser(request);
    const { teamId } = params;

    if (!teamId) {
      return json({ error: "Team ID is required" }, { status: 400 });
    }

    // Check if user is team member
    const membership = await prisma.teamMember.findFirst({
      where: {
        teamId,
        userId: user.id,
        deleted: null,
      },
    });

    if (!membership) {
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
    logger.error("Error fetching team members:", error as any);
    return json({ error: "Failed to fetch members" }, { status: 500 });
  }
};

export { action };
