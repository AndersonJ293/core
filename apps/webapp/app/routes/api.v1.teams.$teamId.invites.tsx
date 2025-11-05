import { z } from "zod";
import { json } from "@remix-run/node";
import {
  createHybridActionApiRoute,
  createHybridLoaderApiRoute,
} from "~/services/routeBuilders/apiBuilder.server";
import { prisma } from "~/db.server";
import { inviteService } from "~/services/inviteService.server";
import { requireUser } from "~/services/session.server";
import { logger } from "~/services/logger.service";

// Schema for team params
const TeamParamsSchema = z.object({
  teamId: z.string(),
});

// Schema for creating invites
const CreateInviteSchema = z.object({
  email: z.string().email(),
  role: z.enum(["OWNER", "MEMBER"]).default("MEMBER"),
});

// POST /api/v1/teams/:teamId/invites - Create a new team invite
const { action } = createHybridActionApiRoute(
  {
    body: CreateInviteSchema,
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
      });
    } catch (error) {
      logger.error("Error creating team invite:", error as any);
      const errorMessage =
        error instanceof Error ? error.message : "Failed to create invite";
      return json({ error: errorMessage }, { status: 400 });
    }
  },
);

// GET /api/v1/teams/:teamId/invites - List team invites
const loader = createHybridLoaderApiRoute(
  {
    params: TeamParamsSchema,
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

      const invites = (await inviteService.getTeamInvites(
        teamId,
        userId,
      )) as any[];

      return json({
        invites: invites.map((invite: any) => ({
          id: invite.id,
          teamId: invite.teamId,
          invitedUserEmail: invite.invitedUserEmail,
          invitedUserId: invite.invitedUserId,
          role: invite.role,
          status: invite.status,
          expiresAt: invite.expiresAt,
          respondedAt: invite.respondedAt,
          createdAt: invite.createdAt,
          updatedAt: invite.updatedAt,
          inviter: invite.inviter,
          invitedUser: invite.invitedUser,
        })),
        success: true,
      });
    } catch (error) {
      logger.error("Error fetching team invites:", error as any);
      const errorMessage =
        error instanceof Error ? error.message : "Failed to fetch invites";
      return json({ error: errorMessage }, { status: 400 });
    }
  },
);

export { action };
export { loader };
