import { type LoaderFunctionArgs } from "@remix-run/server-runtime";

import { useParams, useNavigate, useRevalidator } from "@remix-run/react";
import { requireUser, requireWorkpace } from "~/services/session.server";
import { getConversationAndHistory } from "~/services/conversation.server";
import {
  ConversationItem,
  ConversationTextarea,
} from "~/components/conversation";
import { useTypedLoaderData } from "remix-typedjson";
import { ScrollAreaWithAutoScroll } from "~/components/use-auto-scroll";
import { PageHeader } from "~/components/common/page-header";
import { Plus } from "lucide-react";

import { type UIMessage, useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { UserTypeEnum } from "@core/types";
import React, { useEffect, useRef, useState } from "react";
import { LoaderCircle } from "lucide-react";

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

// Example loader accessing params
export async function loader({ params, request }: LoaderFunctionArgs) {
  const user = await requireUser(request);

  const conversation = await getConversationAndHistory(
    params.conversationId as string,
    user.id,
  );

  if (!conversation) {
    throw new Error("No conversation found");
  }

  return { conversation };
}

// Accessing params in the component
export default function SingleConversation() {
  const { conversation } = useTypedLoaderData<typeof loader>();
  const navigate = useNavigate();
  const revalidator = useRevalidator();
  const { conversationId } = useParams();
  const hasAutoStartedRef = useRef(false);
  const [retryCount, setRetryCount] = useState(0);
  const [mounted, setMounted] = useState(false);
  const statusTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastStatusChangeRef = useRef<Date>(new Date());

  // Check if this is a brand new conversation that needs auto-start
  const isNewConversation = conversation.ConversationHistory.length === 1;
  const firstMessage = conversation.ConversationHistory[0];
  const needsAutoStart = isNewConversation && firstMessage?.userType === UserTypeEnum.User;

  const { sendMessage, messages, status, stop, error } = useChat({
    id: conversationId, // use the provided chat ID
    // For new conversations, start with empty messages - sendMessage will add them
    // For existing conversations, load full history
    messages: needsAutoStart ? [] : conversation.ConversationHistory.map(
      (history) =>
        ({
          role: history.userType === UserTypeEnum.Agent ? "assistant" : "user",
          parts: [{ text: history.message, type: "text" }],
        }) as UIMessage,
    ),
    transport: new DefaultChatTransport({
      api: "/api/v1/conversation",
      prepareSendMessagesRequest({ messages, id }) {
        return { body: { message: messages[messages.length - 1], id } };
      },
    }),
    onError: (error) => {
      // Try auto-recovery on error
      if (retryCount < 2) {
        setRetryCount(prev => prev + 1);

        // Wait a bit then revalidate to reload fresh data
        setTimeout(() => {
          revalidator.revalidate();
        }, 1000);
      } else {
        setTimeout(() => {
          window.location.reload();
        }, 2000);
      }
    },
  });

  // Timeout watchdog: detect if streaming is stuck
  useEffect(() => {
    // Track when status changes
    lastStatusChangeRef.current = new Date();

    // Clear existing timeout
    if (statusTimeoutRef.current) {
      clearTimeout(statusTimeoutRef.current);
      statusTimeoutRef.current = null;
    }

    // Only monitor "submitted" or "streaming" status
    if (status === "submitted" || status === "streaming") {
      // Set timeout to detect stuck streaming (30 seconds)
      statusTimeoutRef.current = setTimeout(() => {
        const elapsedSeconds = (new Date().getTime() - lastStatusChangeRef.current.getTime()) / 1000;

        // Try to recover
        if (retryCount < 2) {
          setRetryCount(prev => prev + 1);

          // Stop current stream and reload data
          stop();
          setTimeout(() => {
            revalidator.revalidate();
          }, 1000);
        } else {
          window.location.reload();
        }
      }, 30000); // 30 second timeout
    }

    // Cleanup timeout on unmount
    return () => {
      if (statusTimeoutRef.current) {
        clearTimeout(statusTimeoutRef.current);
      }
    };
  }, [status, retryCount, stop, revalidator]);

  // Mount detection for SSR
  useEffect(() => {
    setMounted(true);
  }, []);

  // Auto-start streaming for new conversations with only the first user message
  useEffect(() => {
    // Only run once per conversation load
    if (hasAutoStartedRef.current) {
      return;
    }

    // Check if this is a new conversation with only 1 message from the user
    const isNewConversation = conversation.ConversationHistory.length === 1;
    const firstMessage = conversation.ConversationHistory[0];
    const isUserMessage = firstMessage?.userType === UserTypeEnum.User;

    // Auto-send the first message to trigger assistant response
    // messages.length === 0 because we initialized with empty array for new conversations
    if (needsAutoStart && messages.length === 0 && (status === "idle" || status === "ready")) {
      hasAutoStartedRef.current = true;

      // Send the user's message to get assistant response
      sendMessage({ text: firstMessage.message });
    }
  }, [conversation.ConversationHistory, messages.length, sendMessage, status, conversationId, error, needsAutoStart, firstMessage]);

  // Reset retry count when conversation changes or status becomes idle/success
  useEffect(() => {
    if (status === "idle" || status === "success") {
      if (retryCount > 0) {
        setRetryCount(0);
      }
    }
  }, [status, retryCount]);

  if (!mounted) {
    return (
      <>
        <PageHeader title="Conversation" />
        <div className="flex h-[calc(100vh_-_56px)] w-full items-center justify-center">
          <LoaderCircle className="text-primary h-6 w-6 animate-spin" />
        </div>
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="Conversation"
        breadcrumbs={[
          { label: "Conversations", href: "/home/conversation" },
          { label: stripHtml(conversation.title) || "Untitled" },
        ]}
        actions={[
          {
            label: "New conversation",
            icon: <Plus size={14} />,
            onClick: () => navigate("/home/conversation"),
            variant: "secondary",
          },
        ]}
      />

      <div className="relative flex h-[calc(100vh_-_56px)] w-full flex-col items-center justify-center overflow-auto">
        <div className="flex h-[calc(100vh_-_80px)] w-full flex-col justify-end overflow-hidden">
          <ScrollAreaWithAutoScroll>
            {messages.map((message: UIMessage, index: number) => {
              return <ConversationItem key={index} message={message} />;
            })}
          </ScrollAreaWithAutoScroll>

          <div className="flex w-full flex-col items-center">
            <div className="w-full max-w-[80ch] px-1 pr-2">
              {/* Auto-recovery status indicators */}
              {error && retryCount > 0 && (
                <div className="mb-2 rounded-md bg-red-100 border border-red-300 p-3 text-sm text-red-800 flex items-center gap-2">
                  <span className="animate-spin">🔄</span>
                  <span>
                    {retryCount < 2
                      ? `Connection issue detected. Auto-retrying (${retryCount}/2)...`
                      : "Max retries reached. Reloading page..."}
                  </span>
                </div>
              )}

              {revalidator.state === "loading" && (
                <div className="mb-2 rounded-md bg-blue-100 border border-blue-300 p-2 text-sm text-blue-800 flex items-center gap-2">
                  <span className="animate-pulse">🔄</span>
                  <span>Refreshing conversation...</span>
                </div>
              )}

              {(status === "streaming" || status === "submitted") && (
                <div className="mb-2 rounded-md bg-gray-100 border border-gray-300 p-2 text-sm text-gray-700 flex items-center gap-2">
                  <span className="animate-pulse">💭</span>
                  <span>{status === "streaming" ? "Assistant is responding..." : "Processing your message..."}</span>
                </div>
              )}

              <ConversationTextarea
                className="bg-background-3 w-full border-1 border-gray-300"
                isLoading={status === "streaming" || status === "submitted"}
                onConversationCreated={(message) => {
                  if (message) {
                    sendMessage({ text: message });
                  }
                }}
                stop={() => stop()}
              />
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
