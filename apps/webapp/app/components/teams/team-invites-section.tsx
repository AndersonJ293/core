import React, { useEffect, useState } from "react";
import { Users, X, Calendar, User, Mail } from "lucide-react";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card";
import { Badge } from "~/components/ui/badge";
import { useToast } from "~/hooks/use-toast";

interface TeamInvite {
  id: string;
  teamId: string;
  invitedUserEmail: string;
  invitedUserId?: string;
  role: string;
  status: string;
  expiresAt: string;
  createdAt: string;
  respondedAt?: string;
  inviter: {
    id: string;
    name: string;
    email: string;
  };
  invitedUser?: {
    id: string;
    name: string;
    email: string;
  };
}

interface TeamInvitesSectionProps {
  teamId: string;
  canManage?: boolean;
}

export function TeamInvitesSection({ teamId, canManage = false }: TeamInvitesSectionProps) {
  const [invites, setInvites] = useState<TeamInvite[]>([]);
  const [loading, setLoading] = useState(true);
  const [canceling, setCanceling] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    fetchTeamInvites();
  }, [teamId]);

  const fetchTeamInvites = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/v1/teams/${teamId}/invites`, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "same-origin",
      });

      if (response.ok) {
        const data = await response.json();
        // Filter to show only pending invites in the UI
        const pendingInvites = data.invites?.filter((invite: TeamInvite) =>
          invite.status === "PENDING"
        ) || [];
        setInvites(pendingInvites);
      }
    } catch (error) {
      console.error("Error fetching team invites:", error);
      toast({
        title: "Failed to load invites",
        description: "Please refresh the page.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCancelInvite = async (inviteId: string) => {
    try {
      setCanceling(inviteId);
      const response = await fetch(`/api/v1/invites/${inviteId}`, {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "same-origin",
      });

      if (response.ok) {
        // Remove the canceled invite from the list
        setInvites(invites.filter(invite => invite.id !== inviteId));
        toast({
          title: "Invite cancelled",
          description: "The invite has been successfully cancelled.",
          variant: "default",
        });
      } else {
        const data = await response.json();
        toast({
          title: "Failed to cancel invite",
          description: data.error || "Please try again.",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Error canceling invite:", error);
      toast({
        title: "Network error",
        description: "Please check your connection and try again.",
        variant: "destructive",
      });
    } finally {
      setCanceling(null);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  const getExpiryStatus = (expiresAt: string) => {
    const now = new Date();
    const expiry = new Date(expiresAt);
    const diffDays = Math.ceil((expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

    if (diffDays <= 0) {
      return { status: 'expired', text: 'Expired', color: 'text-destructive' };
    } else if (diffDays <= 1) {
      return { status: 'expiring', text: 'Expires today', color: 'text-amber-600' };
    } else if (diffDays <= 3) {
      return { status: 'expiring', text: `Expires in ${diffDays} days`, color: 'text-amber-600' };
    } else {
      return { status: 'valid', text: `Expires ${formatDate(expiresAt)}`, color: 'text-muted-foreground' };
    }
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Pending Invites
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-4">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (invites.length === 0) {
    return null;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Users className="h-5 w-5" />
          Pending Invites
          <Badge variant="secondary" className="ml-2">
            {invites.length}
          </Badge>
        </CardTitle>
        <CardDescription>
          Invitations waiting for user acceptance
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {invites.map((invite) => {
          const expiryStatus = getExpiryStatus(invite.expiresAt);

          return (
            <div
              key={invite.id}
              className="flex items-center justify-between p-3 border rounded-lg hover:bg-accent/50 transition-colors"
            >
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <Mail className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium">{invite.invitedUserEmail}</span>
                  <Badge variant="outline" className="text-xs capitalize">
                    {invite.role.toLowerCase()}
                  </Badge>
                </div>
                <div className="flex items-center gap-4 text-sm text-muted-foreground">
                  <div className="flex items-center gap-1">
                    <User className="h-3 w-3" />
                    Invited by {invite.inviter.name || invite.inviter.email}
                  </div>
                  <div className="flex items-center gap-1">
                    <Calendar className="h-3 w-3" />
                    {formatDate(invite.createdAt)}
                  </div>
                  <div className={`flex items-center gap-1 ${expiryStatus.color}`}>
                    <Calendar className="h-3 w-3" />
                    {expiryStatus.text}
                  </div>
                </div>
              </div>

              {canManage && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleCancelInvite(invite.id)}
                  disabled={canceling === invite.id}
                  className="text-destructive hover:text-destructive hover:bg-destructive/10"
                >
                  {canceling === invite.id ? (
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current"></div>
                  ) : (
                    <X className="h-4 w-4" />
                  )}
                  Cancel
                </Button>
              )}
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
