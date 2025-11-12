import React, { useEffect, useState } from "react";
import { useParams, useNavigate, Link } from "@remix-run/react";
import { CreateSpaceModal } from "~/components/teams/create-space-modal";
import { TeamInvitesSection } from "~/components/teams/team-invites-section";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import { Button } from "~/components/ui/button";
import { useToast } from "~/hooks/use-toast";

// Add Member Dialog Component
interface AddMemberDialogProps {
  teamId: string;
  onClose: () => void;
  onSuccess: () => void;
}

function AddMemberDialog({ teamId, onClose, onSuccess }: AddMemberDialogProps) {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;

    setLoading(true);
    setError("");

    try {
      const response = await fetch(`/api/v1/teams/${teamId}/invites`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "same-origin",
        body: JSON.stringify({ email: email.trim() }),
      });

      const data = await response.json();

      if (response.ok) {
        onSuccess();
        setEmail("");
        toast({
          title: "Invite sent! 🎉",
          description: `User needs to accept to join the team.`,
          variant: "success",
        });
      } else {
        setError(data.error || "Failed to send invite");
        toast({
          title: "Failed to send invite",
          description: data.error || "Please try again.",
          variant: "destructive",
        });
      }
    } catch (err) {
      setError("Failed to send invite");
      toast({
        title: "Network error",
        description: "Please check your connection and try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="p-6 sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Invite Team Member</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium">
              Email Address
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-md border px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:outline-none"
              placeholder="Enter email to invite"
              disabled={loading}
              required
            />
          </div>

          {error && <div className="text-sm text-red-500">{error}</div>}

          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={loading}
              className="cursor-pointer"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={loading || !email.trim()}
              className="cursor-pointer"
            >
              {loading ? "Inviting..." : "Invite Member"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

type Team = {
  id: string;
  name: string;
  slug: string;
  description?: string | null;
  icon?: string | null;
  memberCount?: number;
  spaceCount?: number;
  createdAt?: string;
  updatedAt?: string;
  members?: Array<any>;
};

type Member = {
  id: string;
  role: string;
  userId: string;
  user: {
    id: string;
    name?: string | null;
    email?: string | null;
  };
  createdAt?: string;
  updatedAt?: string;
};

type Space = {
  id: string;
  name: string;
  description?: string | null;
  autoMode?: boolean;
  icon?: string | null;
  contextCount?: number;
  createdAt?: string;
  updatedAt?: string;
};

export default function TeamDetailRoute(): JSX.Element {
  const { teamId } = useParams<{ teamId: string }>();
  const navigate = useNavigate();

  const [team, setTeam] = useState<Team | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [spaces, setSpaces] = useState<Space[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreateSpace, setShowCreateSpace] = useState(false);
  const [showAddMember, setShowAddMember] = useState(false);

  useEffect(() => {
    if (!teamId) return;

    const fetchTeamData = async () => {
      try {
        setLoading(true);
        setError(null);

        // Fetch team details
        const teamResponse = await fetch(`/api/v1/teams/${teamId}`);
        if (!teamResponse.ok) {
          throw new Error("Team not found");
        }
        const teamData = await teamResponse.json();
        setTeam(teamData.team);

        // Fetch members
        const membersResponse = await fetch(`/api/v1/teams/${teamId}/members`);
        if (membersResponse.ok) {
          const membersData = await membersResponse.json();
          setMembers(membersData.members || []);
        }

        // Fetch spaces
        const spacesResponse = await fetch(`/api/v1/teams/${teamId}/spaces`);
        if (spacesResponse.ok) {
          const spacesData = await spacesResponse.json();
          setSpaces(spacesData.spaces || []);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load team");
      } finally {
        setLoading(false);
      }
    };

    fetchTeamData();
  }, [teamId]);

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="text-muted-foreground">Loading team...</div>
      </div>
    );
  }

  if (error || !team) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="text-center">
          <div className="text-destructive mb-4">
            {error || "Team not found"}
          </div>
          <Link to="/home" className="text-primary hover:underline">
            Go back to dashboard
          </Link>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="px-4 pt-4 pb-2">
        <div className="mb-4 flex items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-lg text-2xl">
            {team.icon || "👥"}
          </div>
          <div>
            <h1 className="text-2xl font-semibold">{team.name}</h1>
            {team.description && (
              <p className="text-muted-foreground">{team.description}</p>
            )}
          </div>
        </div>

        <div className="text-muted-foreground flex items-center gap-6 text-sm">
          <span>{members.length} members</span>
          <span>{spaces.length} spaces</span>
          <span>
            Created {new Date(team.createdAt || "").toLocaleDateString()}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Members Section */}
        <div className="bg-background-2 rounded-lg p-4">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-medium">Members</h2>
            <button
              onClick={() => setShowAddMember(true)}
              className="text-primary cursor-pointer text-sm hover:underline"
            >
              Add member
            </button>
          </div>

          {members.length === 0 ? (
            <div className="text-muted-foreground py-8 text-center">
              No members yet
            </div>
          ) : (
            <div className="space-y-3">
              {members.map((member) => (
                <div
                  key={member.id}
                  className="flex items-center justify-between"
                >
                  <div className="flex items-center gap-3">
                    <div className="bg-primary/10 flex h-8 w-8 items-center justify-center rounded-full text-sm">
                      {(member.user.name || member.user.email || "U")
                        .charAt(0)
                        .toUpperCase()}
                    </div>
                    <div>
                      <div className="font-medium">
                        {member.user.name || member.user.email}
                      </div>
                      {member.user.name && member.user.email && (
                        <div className="text-muted-foreground text-sm">
                          {member.user.email}
                        </div>
                      )}
                    </div>
                  </div>
                  <span className="text-muted-foreground text-sm capitalize">
                    {member.role.toLowerCase()}
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* Pending Invites Section */}
          <div className="mt-6">
            <TeamInvitesSection teamId={teamId || ""} canManage={true} />
          </div>
        </div>

        {/* Spaces Section */}
        <div className="bg-background-2 rounded-lg p-4">
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-medium">Spaces</h2>
              <Link
                to={`/home/teams/${teamId}/spaces`}
                className="text-xs text-muted-foreground hover:text-primary cursor-pointer"
              >
                View all
              </Link>
            </div>
            <button
              onClick={() => setShowCreateSpace(true)}
              className="text-primary cursor-pointer text-sm hover:underline"
            >
              Create space
            </button>
          </div>

          {spaces.length === 0 ? (
            <div className="text-muted-foreground py-8 text-center">
              No spaces yet
              <div className="mt-2">
                <button
                  onClick={() => setShowCreateSpace(true)}
                  className="text-primary cursor-pointer hover:underline"
                >
                  Create your first space
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {spaces.map((space) => (
                <Link
                  key={space.id}
                  to={`/home/space/${space.id}`}
                  className="bg-background hover:bg-muted flex items-center justify-between rounded-lg p-3 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="bg-muted flex h-8 w-8 items-center justify-center rounded-lg text-sm">
                      {space.icon || "📁"}
                    </div>
                    <div>
                      <div className="font-medium">{space.name}</div>
                      {space.description && (
                        <div className="text-muted-foreground text-sm">
                          {space.description}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="text-muted-foreground text-sm">
                    {space.contextCount || 0} items
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>

      {showCreateSpace && (
        <CreateSpaceModal
          open={showCreateSpace}
          onOpenChange={setShowCreateSpace}
          teamId={teamId || ""}
          onSuccess={() => {
            setShowCreateSpace(false);
            // Refresh spaces
            fetch(`/api/v1/teams/${teamId}/spaces`)
              .then((res) => res.json())
              .then((data) => setSpaces(data.spaces || []));
          }}
        />
      )}

      {showAddMember && (
        <AddMemberDialog
          teamId={teamId || ""}
          onClose={() => setShowAddMember(false)}
          onSuccess={() => {
            setShowAddMember(false);
            // Refresh members
            fetch(`/api/v1/teams/${teamId}/members`)
              .then((res) => res.json())
              .then((data) => setMembers(data.members || []));
          }}
        />
      )}
    </>
  );
}
