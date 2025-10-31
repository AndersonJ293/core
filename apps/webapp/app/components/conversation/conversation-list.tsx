import { useFetcher, useNavigate } from "@remix-run/react";
import { useEffect, useState, useCallback, useRef } from "react";
import { AutoSizer, List, type ListRowRenderer } from "react-virtualized";
import { cn } from "~/lib/utils";
import { Button } from "../ui";
import { LoaderCircle, Trash2 } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "~/components/ui/alert-dialog";
import { type ConversationItem } from "~/services/conversation.server";

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

type ConversationItem = {
  id: string;
  title: string | null;
  createdAt: string;
  updatedAt: string;
  unread: boolean;
  status: string;
  ConversationHistory: Array<{
    id: string;
    message: string;
    userType: string;
    createdAt: string;
  }>;
};

type ConversationListResponse = {
  conversations: ConversationItem[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
};

export const ConversationList = ({
  currentConversationId,
}: {
  currentConversationId?: string;
}) => {
  const fetcher = useFetcher<ConversationListResponse>();
  const deleteFetcher = useFetcher();
  const navigate = useNavigate();
  const [conversations, setConversations] = useState<ConversationItem[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [hasNextPage, setHasNextPage] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [conversationToDelete, setConversationToDelete] = useState<string | null>(null);

  const loadedConversationIds = useRef<Set<string>>(new Set());
  const listRef = useRef<List>(null);
  const lastDeletedIdRef = useRef<string | null>(null);

  const loadMoreConversations = useCallback(
    (page: number) => {
      if (isLoading) return;

      setIsLoading(true);
      const searchParams = new URLSearchParams({
        page: page.toString(),
        limit: "5", // Increased for better density
      });

      fetcher.load(`/api/v1/conversations?${searchParams}`);
    },
    [isLoading, fetcher],
  );

  // Initial load
  useEffect(() => {
    loadMoreConversations(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Handle delete success
  useEffect(() => {
    if (
      deleteFetcher.state === "idle" &&
      conversationToDelete &&
      deleteFetcher.data?.success &&
      lastDeletedIdRef.current !== conversationToDelete // Only process if not already processed
    ) {
      // Mark this as processed
      lastDeletedIdRef.current = conversationToDelete;

      // Remove from local state
      setConversations((prev) =>
        prev.filter((c) => c.id !== conversationToDelete)
      );
      loadedConversationIds.current.delete(conversationToDelete);

      // Force list to re-render with new data
      // Call multiple times to ensure virtual list updates correctly
      if (listRef.current) {
        listRef.current.forceUpdateGrid();
        // Second call after a micro-task to ensure DOM has updated
        setTimeout(() => {
          if (listRef.current) {
            listRef.current.forceUpdateGrid();
          }
        }, 0);
      }

      // If it was the current conversation, redirect to conversation list
      if (currentConversationId === conversationToDelete) {
        navigate("/home/conversation");
      }

      // Close dialog and reset state
      setDeleteDialogOpen(false);
      setConversationToDelete(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deleteFetcher.data, deleteFetcher.state, conversationToDelete, currentConversationId]);

  const handleDeleteClick = (conversationId: string, e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent navigation
    // Reset last deleted ref and clear stale fetcher data when opening new dialog
    lastDeletedIdRef.current = null;
    deleteFetcher.data = undefined;
    setConversationToDelete(conversationId);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = () => {
    if (conversationToDelete) {
      deleteFetcher.submit(
        {},
        {
          method: "DELETE",
          action: `/api/v1/conversation/${conversationToDelete}/delete`,
        }
      );
      // Don't close dialog immediately - let the useEffect handle it after success
    }
  };

  // Handle fetcher response
  useEffect(() => {
    if (fetcher.data && fetcher.state === "idle") {
      setIsLoading(false);
      const response = fetcher.data;

      // Prevent duplicate conversations
      const newConversations = response.conversations.filter(
        (c) => !loadedConversationIds.current.has(c.id),
      );
      newConversations.forEach((c) => loadedConversationIds.current.add(c.id));

      setConversations((prev) => [...prev, ...newConversations]);
      setHasNextPage(response.pagination.hasNext);
      setCurrentPage(response.pagination.page);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fetcher.data, fetcher.state]);

  // The row count is conversations.length + 1 if hasNextPage, else just conversations.length
  const rowCount = hasNextPage
    ? conversations.length + 1
    : conversations.length;

  const rowRenderer: ListRowRenderer = useCallback(
    ({ index, key, style }) => {
      // If this is the last row and hasNextPage, show the Load More button
      if (hasNextPage && index === conversations.length) {
        return (
          <div
            key={key}
            style={style}
            className="-mt-1 ml-1 hidden items-center justify-start p-0 text-sm group-hover:flex"
          >
            <Button
              variant="link"
              onClick={() => loadMoreConversations(currentPage + 1)}
              disabled={isLoading}
              className="w-fit underline underline-offset-4"
            >
              {isLoading ? (
                <>
                  <div className="border-primary mr-2 h-4 w-4 animate-spin rounded-full border-2 border-t-transparent" />
                  Loading...
                </>
              ) : (
                "Load More"
              )}
            </Button>
          </div>
        );
      }

      const conversation = conversations[index];

      if (!conversation) {
        return (
          <div key={key} style={style}>
            <div className="flex items-center justify-center p-4">
              <div className="border-primary h-4 w-4 animate-spin rounded-full border-2 border-t-transparent" />
            </div>
          </div>
        );
      }

      return (
        <div key={key} style={style}>
          <div className="px-1 pr-2">
            <div className="group/item relative">
              <Button
                variant="ghost"
                className={cn(
                  "border-border h-auto w-full justify-start rounded p-2 py-1 text-left",
                  currentConversationId === conversation.id &&
                    "bg-accent font-semibold",
                )}
                onClick={() => {
                  navigate(`/home/conversation/${conversation.id}`);
                }}
                tabIndex={0}
                aria-current={
                  currentConversationId === conversation.id ? "page" : undefined
                }
              >
                <div className="flex w-full items-start space-x-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <p className={cn("text-foreground truncate font-normal")}>
                        {stripHtml(conversation.title) || "Untitled Conversation"}
                      </p>
                    </div>
                  </div>
                </div>
              </Button>

              <Button
                variant="ghost"
                size="sm"
                className="absolute right-1 top-1/2 -translate-y-1/2 opacity-0 group-hover/item:opacity-100 transition-opacity h-6 w-6 p-0"
                onClick={(e) => handleDeleteClick(conversation.id, e)}
                aria-label="Delete conversation"
              >
                <Trash2 className="h-3 w-3 text-destructive" />
              </Button>
            </div>
          </div>
        </div>
      );
    },
    [
      conversations,
      currentConversationId,
      hasNextPage,
      isLoading,
      currentPage,
      loadMoreConversations,
      navigate,
    ],
  );

  return (
    <div className="flex h-full flex-col pt-1 pl-1">
      {!isLoading && conversations.length > 0 && (
        <div className="group grow overflow-hidden">
          <AutoSizer>
            {({ height, width }) => (
              <List
                ref={listRef}
                height={height}
                width={width}
                rowCount={rowCount}
                rowHeight={32} // Slightly taller for better click area
                rowRenderer={rowRenderer}
                overscanRowCount={5}
              />
            )}
          </AutoSizer>
        </div>
      )}

      {isLoading && conversations.length === 0 && (
        <div className="flex items-center justify-center p-8">
          <div className="flex flex-col items-center gap-2">
            <LoaderCircle className="text-primary h-4 w-4 animate-spin" />
          </div>
        </div>
      )}

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Conversation?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete this conversation
              and all its messages.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteFetcher.state === "submitting"}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              disabled={deleteFetcher.state === "submitting"}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteFetcher.state === "submitting" ? (
                <span className="flex items-center gap-2">
                  <LoaderCircle className="h-4 w-4 animate-spin" />
                  Deleting...
                </span>
              ) : (
                "Delete"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};
