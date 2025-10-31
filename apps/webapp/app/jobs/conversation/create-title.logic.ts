import { conversationTitlePrompt } from "~/trigger/conversation/prompt";
import { prisma } from "~/trigger/utils/prisma";
import { logger } from "~/services/logger.service";
import { generateText, type LanguageModel } from "ai";
import { getModel } from "~/lib/model.server";

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

export interface CreateConversationTitlePayload {
  conversationId: string;
  message: string;
}

export interface CreateConversationTitleResult {
  success: boolean;
  title?: string;
  error?: string;
}

/**
 * Core business logic for creating conversation titles
 * This is shared between Trigger.dev and BullMQ implementations
 */
export async function processConversationTitleCreation(
  payload: CreateConversationTitlePayload,
): Promise<CreateConversationTitleResult> {
  try {
    const { text } = await generateText({
      model: getModel() as LanguageModel,
      messages: [
        {
          role: "user",
          content: conversationTitlePrompt.replace(
            "{{message}}",
            payload.message,
          ),
        },
      ],
    });

    let title: string | undefined;

    // Try to extract from <output> tags first
    const outputMatch = text.match(/<output>(.*?)<\/output>/s);

    if (outputMatch) {
      try {
        const jsonStr = outputMatch[1].trim();
        const parsed = JSON.parse(jsonStr);
        title = parsed.title;
      } catch (parseError) {
        logger.warn(`Failed to parse JSON from <output> tags: ${parseError}`);
      }
    }

    // Fallback: try to parse the entire response as JSON
    if (!title) {
      try {
        const parsed = JSON.parse(text);
        title = parsed.title;
      } catch (parseError) {
        logger.warn(`Failed to parse response as JSON: ${parseError}`);
      }
    }

    // Fallback: use first line of text if it's reasonable length
    if (!title) {
      const firstLine = text.split('\n')[0].trim();
      // Remove common prefixes, quotes, and HTML tags
      const cleaned = stripHtml(firstLine)
        .replace(/^(title:|Title:)\s*/i, '')
        .replace(/^["']|["']$/g, '')
        .trim();

      if (cleaned.length > 0 && cleaned.length <= 100) {
        title = cleaned;
      }
    }

    if (!title || title.length === 0) {
      logger.error(`No valid title could be extracted from response: ${text}`);
      return {
        success: false,
        error: "Could not extract title from AI response",
      };
    }

    // Strip any remaining HTML and truncate if too long
    const finalTitle = stripHtml(title).substring(0, 100);

    await prisma.conversation.update({
      where: {
        id: payload.conversationId,
      },
      data: {
        title: finalTitle,
      },
    });

    return {
      success: true,
      title: finalTitle,
    };
  } catch (error: any) {
    logger.error(
      `Error creating conversation title for ${payload.conversationId}:`,
      error,
    );
    return {
      success: false,
      error: error.message,
    };
  }
}
