import React, { useEffect, useState } from "react";
import { Link } from "@remix-run/react";
import { Users, Calendar, User, Check, X, Clock } from "lucide-react";
import { Button } from "~/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import { Badge } from "~/components/ui/badge";
import { useToast } from "~/hooks/use-toast";

interface Invite {
  id: string;
  teamId: string;
  invitedUserEmail: string;
  role: string;
  status: string;
  expiresAt: string;
  createdAt: string;
  team: {
    id: string;
    name: string;
    slug: string;
    icon?: string;
  };
  inviter: {
    id: string;
    name: string;
    email: string;
  };
}

export default function InvitesPage() {
  const [invites, setInvites] = useState<Invite[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    fetchInvites();
  }, []);

  const fetchInvites = async () => {
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
        setInvites(data.invites || []);
      }
    } catch (error) {
      console.error("Error fetching invites:", error);
      toast({
        title: "Failed to load invites",
        description: "Please refresh the page.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleInviteAction = async (
    inviteId: string,
    action: "accept" | "refuse",
  ) => {
    try {
      setProcessing(inviteId);
      const endpoint = action === "accept"
        ? `/api/v1/invites/${inviteId}/accept`
        : `/api/v1/invites/${inviteId}/refuse`;

      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "same-origin",
      });

      if (response.ok) {
        // Remove the processed invite from the list
        setInvites(invites.filter((invite) => invite.id !== inviteId));

        // Show success toast
        const teamName = invites.find(i => i.id === inviteId)?.team.name || "team";
        if (action === "accept") {
          toast({
            title: "Welcome to the team! 🎉",
            description: `You've joined ${teamName}`,
            variant: "success",
          });
        } else {
          toast({
            title: "Invite declined",
            description: `You've declined the invite to ${teamName}`,
            variant: "default",
          });
        }
      } else {
        const data = await response.json();
        toast({
          title: `Failed to ${action} invite`,
          description: data.error || "Please try again.",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error(`Error ${action}ing invite:`, error);
      toast({
        title: "Network error",
        description: "Please check your connection and try again.",
        variant: "destructive",
      });
    } finally {
      setProcessing(null);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const getExpiryStatus = (expiresAt: string) => {
    const now = new Date();
    const expiry = new Date(expiresAt);
    const diffDays = Math.ceil(
      (expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24),
    );

    if (diffDays <= 0) {
      return { status: "expired", text: "Expired" };
    } else if (diffDays <= 1) {
      return { status: "expiring", text: "Expires today" };
    } else if (diffDays <= 3) {
      return { status: "expiring", text: `Expires in ${diffDays} days` };
    } else {
      return { status: "valid", text: `Expires ${formatDate(expiresAt)}` };
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto max-w-4xl p-6">
        <div className="flex h-64 items-center justify-center">
          <div className="text-center">
            <div className="border-primary mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-b-2"></div>
            <p className="text-muted-foreground">Loading invites...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto max-w-4xl p-6">
      <div className="mb-8">
        <h1 className="mb-2 text-3xl font-bold">Team Invites</h1>
        <p className="text-muted-foreground">
          Manage your pending team invitations
        </p>
      </div>

      {invites.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Users className="text-muted-foreground mb-4 h-12 w-12" />
            <h3 className="mb-2 text-lg font-medium">No pending invites</h3>
            <p className="text-muted-foreground max-w-md text-center">
              You don't have any pending team invitations at the moment.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {invites.map((invite) => {
            const expiryStatus = getExpiryStatus(invite.expiresAt);

            return (
              <Card
                key={invite.id}
                className="transition-shadow hover:shadow-md"
              >
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <CardTitle className="flex items-center gap-2 text-lg">
                        <Users className="h-5 w-5" />
                        {invite.team.name}
                      </CardTitle>
                      <CardDescription className="mt-1">
                        Invited by {invite.inviter.name || invite.inviter.email}
                      </CardDescription>
                    </div>
                    <Badge variant="secondary" className="capitalize">
                      {invite.role.toLowerCase()}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="flex items-center justify-between">
                    <div className="text-muted-foreground flex items-center gap-4 text-sm">
                      <div className="flex items-center gap-1">
                        <User className="h-4 w-4" />
                        {invite.invitedUserEmail}
                      </div>
                      <div className="flex items-center gap-1">
                        <Calendar className="h-4 w-4" />
                        Invited {formatDate(invite.createdAt)}
                      </div>
                      <div
                        className={`flex items-center gap-1 ${
                          expiryStatus.status === "expired"
                            ? "text-destructive"
                            : expiryStatus.status === "expiring"
                              ? "text-amber-600"
                              : "text-muted-foreground"
                        }`}
                      >
                        <Clock className="h-4 w-4" />
                        {expiryStatus.text}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleInviteAction(invite.id, "refuse")}
                        disabled={processing === invite.id}
                        className="text-destructive hover:text-destructive hover:bg-destructive/10"
                      >
                        {processing === invite.id ? (
                          <div className="h-4 w-4 animate-spin rounded-full border-b-2 border-current"></div>
                        ) : (
                          <X className="h-4 w-4" />
                        )}
                        Decline
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => handleInviteAction(invite.id, "accept")}
                        disabled={
                          processing === invite.id ||
                          expiryStatus.status === "expired"
                        }
                      >
                        {processing === invite.id ? (
                          <div className="h-4 w-4 animate-spin rounded-full border-b-2 border-current"></div>
                        ) : (
                          <Check className="h-4 w-4" />
                        )}
                        Accept
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
