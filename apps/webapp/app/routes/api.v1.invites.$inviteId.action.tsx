import { z } from "zod";
import { json } from "@remix-run/node";
import { createHybridActionApiRoute } from "~/services/routeBuilders/apiBuilder.server";
import { inviteService } from "~/services/inviteService.server";
import { logger } from "~/services/logger.service";

// POST /api/v1/invites/:inviteId/accept - Accept a team invite
const action = createHybridActionApiRoute(
  {
    allowJWT: true,
    method: "POST",
    corsStrategy: "all",
    authorization: { action: "user_invites" },
  },
  async ({ authentication, params }: { authentication: any; params: any }) => {
    try {
      const userId = authentication.userId;
      const { inviteId } = params || {};

      if (!inviteId) {
        return json({ error: "Invite ID is required" }, { status: 400 });
      }

      // Check the URL path to determine which action is being called
      const url = new URL(`http://localhost${action?.request?.url || ''}`);
      const pathname = url.pathname;

      if (pathname.endsWith('/accept')) {
        const teamMember = await inviteService.acceptInvite(inviteId, userId);
        return json({
          member: {
            id: teamMember.id,
            role: teamMember.role,
            userId: teamMember.userId,
            teamId: teamMember.teamId,
            user: teamMember.user,
            team: teamMember.team,
            createdAt: teamMember.createdAt,
            updatedAt: teamMember.updatedAt,
          },
          success: true,
        });
      } else if (pathname.endsWith('/refuse')) {
        await inviteService.refuseInvite(inviteId, userId);
        return json({ success: true });
      } else {
        return json({ error: "Invalid action" }, { status: 400 });
      }
    }
    catch (error) {
      logger.error("Error processing invite action:", error as any);
      const errorMessage =
        error instanceof Error ? error.message : "Failed to process invite";
      return json({ error: errorMessage }, { status: 400 });
    }
  }
);

export { action };
