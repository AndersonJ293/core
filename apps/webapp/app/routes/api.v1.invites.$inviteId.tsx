import { z } from "zod";
import { json } from "@remix-run/node";
import { createHybridActionApiRoute } from "~/services/routeBuilders/apiBuilder.server";
import { inviteService } from "~/services/inviteService.server";
import { logger } from "~/services/logger.service";

// Schema for invite ID params
const InviteParamsSchema = z.object({
  inviteId: z.string(),
});

// DELETE /api/v1/invites/:inviteId - Cancel a team invite
const { action } = createHybridActionApiRoute(
  {
    params: InviteParamsSchema,
    allowJWT: true,
    method: "DELETE",
    corsStrategy: "all",
    authorization: { action: "team_invite" },
  },
  async ({ authentication, params }: { authentication: any; params: any }) => {
    try {
      console.log("DEBUG - Params recebidos:", params);
      console.log("DEBUG - Authentication:", authentication);

      const userId = authentication.userId;
      const { inviteId } = params || {};

      console.log("DEBUG - inviteId extraído:", inviteId);

      if (!inviteId) {
        return json({ error: "Invite ID is required" }, { status: 400 });
      }

      await inviteService.cancelInvite(inviteId, userId);

      return json({ success: true });
    } catch (error) {
      logger.error("Error canceling team invite:", error as any);
      const errorMessage =
        error instanceof Error ? error.message : "Failed to cancel invite";
      return json({ error: errorMessage }, { status: 400 });
    }
  },
);

export { action };
