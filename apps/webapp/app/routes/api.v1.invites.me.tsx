import { json } from "@remix-run/node";
import { createHybridLoaderApiRoute } from "~/services/routeBuilders/apiBuilder.server";
import { inviteService } from "~/services/inviteService.server";
import { logger } from "~/services/logger.service";

// GET /api/v1/invites/me - Get user's pending invites
const loader = createHybridLoaderApiRoute(
  {
    allowJWT: true,
    corsStrategy: "all",
    findResource: async () => 1,
  },
  async ({ authentication }) => {
    try {
      const userId = authentication.userId;

      const invites = (await inviteService.getUserPendingInvites(
        userId,
      )) as any[];

      return json({
        invites: invites.map((invite: any) => ({
          id: invite.id,
          teamId: invite.teamId,
          invitedUserEmail: invite.invitedUserEmail,
          role: invite.role,
          status: invite.status,
          expiresAt: invite.expiresAt,
          createdAt: invite.createdAt,
          team: invite.team,
          inviter: invite.inviter,
        })),
        success: true,
      });
    } catch (error) {
      logger.error("Error fetching user invites:", error as any);
      const errorMessage =
        error instanceof Error ? error.message : "Failed to fetch invites";
      return json({ error: errorMessage }, { status: 400 });
    }
  },
);

export { loader };
