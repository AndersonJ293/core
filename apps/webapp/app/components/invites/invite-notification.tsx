import React, { useEffect, useState } from "react";
import { Link } from "@remix-run/react";
import { Bell } from "lucide-react";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";

interface InviteNotificationProps {
  className?: string;
}

export function InviteNotification({ className }: InviteNotificationProps) {
  const [pendingCount, setPendingCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchPendingInvites = async () => {
      try {
        setLoading(true);
        const response = await fetch("/api/v1/invites/me", {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
          },
          credentials: "same-origin",
        });

        if (response.ok) {
          const data = await response.json();
          setPendingCount(data.invites?.length || 0);
        }
      } catch (error) {
        console.error("Error fetching pending invites:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchPendingInvites();

    // Poll for new invites every 30 seconds
    const interval = setInterval(fetchPendingInvites, 30000);

    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return null;
  }

  if (pendingCount === 0) {
    return null;
  }

  return (
    <div className={className}>
      <Link to="/invites">
        <Button
          variant="ghost"
          size="sm"
          className="relative p-2 hover:bg-accent rounded-full"
        >
          <Bell className="h-4 w-4" />
          <Badge
            variant="destructive"
            className="absolute -top-1 -right-1 h-4 w-4 min-w-0 p-0 flex items-center justify-center text-xs"
          >
            {pendingCount}
          </Badge>
        </Button>
      </Link>
    </div>
  );
}
