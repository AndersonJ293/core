import { z } from "zod";
import { json } from "@remix-run/node";
import { createHybridActionApiRoute } from "~/services/routeBuilders/apiBuilder.server";
import { inviteService } from "~/services/inviteService.server";
import { logger } from "~/services/logger.service";

// POST /api/v1/invites/:inviteId/refuse - Refuse a team invite
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

      await inviteService.refuseInvite(inviteId, userId);
      return json({ success: true });
    }
    catch (error) {
      logger.error("Error refusing team invite:", error as any);
      const errorMessage =
        error instanceof Error ? error.message : "Failed to refuse invite";
      return json({ error: errorMessage }, { status: 400 });
    }
  }
);

export { action };