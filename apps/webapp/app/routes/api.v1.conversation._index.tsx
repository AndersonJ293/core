import {
  convertToModelMessages,
  streamText,
  validateUIMessages,
  type LanguageModel,
  experimental_createMCPClient as createMCPClient,
  generateId,
  stepCountIs,
} from "ai";
import { z } from "zod";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";

/**
 * Strip HTML tags from a string and decode HTML entities
 */
function stripHtml(html: string): string {
  return html
    .replace(/<[^>]*>/g, '') // Remove HTML tags
    .replace(/&nbsp;/g, ' ') // Replace &nbsp; with space
    .replace(/&lt;/g, '<')   // Decode HTML entities
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .trim();
}

import { createHybridActionApiRoute } from "~/services/routeBuilders/apiBuilder.server";
import {
  createConversationHistory,
  getConversationAndHistory,
} from "~/services/conversation.server";

import { getModel } from "~/lib/model.server";
import { UserTypeEnum } from "@core/types";
import {
  getOrCreatePersonalAccessToken,
  deletePersonalAccessTokenByName,
} from "~/services/personalAccessToken.server";
import {
  hasAnswer,
  hasQuestion,
  REACT_SYSTEM_PROMPT,
} from "~/lib/prompt.server";
import { enqueueCreateConversationTitle } from "~/lib/queue-adapter.server";
import { env } from "~/env.server";
import { logger } from "~/services/logger.service";

const ChatRequestSchema = z.object({
  message: z.object({
    id: z.string().optional(),
    parts: z.array(z.any()),
    role: z.string(),
  }),
  id: z.string(),
});

const { loader, action } = createHybridActionApiRoute(
  {
    body: ChatRequestSchema,
    allowJWT: true,
    authorization: {
      action: "conversation",
    },
    corsStrategy: "all",
  },
  async ({ body, authentication }) => {
    // Delete existing token (if any) and create a new one to get the unencrypted token
    // PAT tokens only return the unencrypted value on creation, not on retrieval
    await deletePersonalAccessTokenByName({
      name: "internal_chat_session",
      userId: authentication.userId,
    });

    const pat = await getOrCreatePersonalAccessToken({
      name: "internal_chat_session",
      userId: authentication.userId,
    });

    // Ensure we have a token
    if (!pat.token) {
      logger.error("Failed to get PAT token for MCP authentication");
      throw new Error("Authentication token unavailable");
    }

    const message = body.message.parts[0].text;
    const id = body.message.id;

    // Prefer explicit API_BASE_URL when present, else fallback to APP_ORIGIN, then localhost
    const apiBase =
      env.API_BASE_URL && env.API_BASE_URL !== ""
        ? env.API_BASE_URL
        : env.API_BASE_URL === ""
        ? env.APP_ORIGIN
        : env.APP_ORIGIN ?? "http://localhost:3000";

    const apiEndpoint = `${apiBase.replace(/\/$/, "")}/api/v1/mcp?source=core`;
    const url = new URL(apiEndpoint);



    // Create MCP client with robust error handling. If creation fails, surface a clear error.
    let mcpClient;
    try {
      mcpClient = await createMCPClient({
        transport: new StreamableHTTPClientTransport(url, {
          requestInit: {
            headers: {
              Authorization: `Bearer ${pat.token}`,
            },
          },
        }),
      });
    } catch (err: any) {
      logger.error("Failed to create MCP client", { error: err?.message ?? err });
      // Return a friendly error response for the API client
      throw new Error("Internal error: unable to connect to internal MCP service");
    }

    // Attempt to fetch tools immediately but tolerate failure (log and continue with empty tools)
    let tools: Record<string, any> = {};
    try {
      tools = { ...(await mcpClient.tools()) };
    } catch (err: any) {
      logger.warn("Failed to fetch MCP tools; continuing with empty tools set", {
        error: err?.message ?? err,
      });
      tools = {};
    }

    const conversation = await getConversationAndHistory(
      body.id,
      authentication.userId,
    );

    let conversationHistory = conversation?.ConversationHistory ?? [];




    // Always save the user message to history
    const savedHistory = await createConversationHistory(message, body.id, UserTypeEnum.User);


    if (conversationHistory.length === 0) {
      // Trigger conversation title task (only on first message)
      // Strip HTML from message before sending to title generator
      const cleanMessage = stripHtml(message);

      const result = await enqueueCreateConversationTitle({
        conversationId: body.id,
        message: cleanMessage,
      });
    } else {

    }

    // Add the current message to history array for processing
    // (it was just saved to DB but not in the array we fetched)
    conversationHistory = [
      ...conversationHistory,
      {
        message,
        userType: UserTypeEnum.User,
        id: id ?? generateId(),
      },
    ];

    const messages = conversationHistory.map((history: any) => {
      return {
        parts: [{ text: history.message, type: "text" }],
        role: history.userType === UserTypeEnum.Agent ? "assistant" : "user",
        id: history.id,
      };
    });

    // MCP tools were fetched during client initialization above


    const finalMessages = messages;


    const validatedMessages = await validateUIMessages({
      messages: finalMessages,
    });



    const result = streamText({
      model: getModel() as LanguageModel,
      messages: [
        {
          role: "system",
          content: REACT_SYSTEM_PROMPT,
        },
        ...convertToModelMessages(validatedMessages),
      ],
      tools,
      stopWhen: [stepCountIs(10), hasAnswer, hasQuestion],
    });


    result.consumeStream(); // no await


    return result.toUIMessageStreamResponse({
      originalMessages: validatedMessages,
      onFinish: async ({ messages }) => {

        const lastMessage = messages.pop();
        let message = "";
        lastMessage?.parts.forEach((part) => {
          if (part.type === "text") {
            message += part.text;
          }
        });


        const savedResponse = await createConversationHistory(message, body.id, UserTypeEnum.Agent);

      },
      // async consumeSseStream({ stream }) {
      //   // Create a resumable stream from the SSE stream
      //   const streamContext = createResumableStreamContext({ waitUntil: null });
      //   await streamContext.createNewResumableStream(
      //     conversation.conversationHistoryId,
      //     () => stream,
      //   );
      // },
    });
  },
);

export { loader, action };
