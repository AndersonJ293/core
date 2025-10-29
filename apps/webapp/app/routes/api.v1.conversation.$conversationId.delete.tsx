import { json } from "@remix-run/node";
import { z } from "zod";
import { createHybridActionApiRoute } from "~/services/routeBuilders/apiBuilder.server";
import { deleteConversation } from "~/services/conversation.server";

export const ConversationIdSchema = z.object({
  conversationId: z.string(),
});

const { action, loader } = createHybridActionApiRoute(
  {
    params: ConversationIdSchema,
    allowJWT: true,
    method: "DELETE",
    authorization: {
      action: "delete",
    },
    corsStrategy: "all",
  },
  async ({ params }) => {
    try {
      await deleteConversation(params.conversationId);

      return json({
        success: true,
        message: "Conversation deleted successfully",
      });
    } catch (error) {
      console.error("Error deleting conversation:", error);
      return json(
        {
          error: "Failed to delete conversation",
          code: "internal_error",
        },
        { status: 500 },
      );
    }
  },
);

export { action, loader };
