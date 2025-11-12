import React, { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { Textarea } from "~/components/ui/textarea";

type Team = {
  id: string;
  name: string;
  icon?: string | null;
};

type CreateSpaceModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  teamId?: string;
  onSuccess?: (space: any) => void;
};

export function CreateSpaceModal({
  open,
  onOpenChange,
  teamId: initialTeamId,
  onSuccess,
}: CreateSpaceModalProps) {
  const [teams, setTeams] = useState<Team[]>([]);
  const [loadingTeams, setLoadingTeams] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [visibility, setVisibility] = useState<"PRIVATE" | "TEAM" | "WORKSPACE">("TEAM");
  const [teamId, setTeamId] = useState(initialTeamId || "");
  const [icon, setIcon] = useState("📁");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load teams when modal opens
  useEffect(() => {
    if (open && !initialTeamId) {
      setLoadingTeams(true);
      fetch("/api/v1/teams", {
        method: "GET",
        headers: { Accept: "application/json" },
        credentials: "same-origin",
      })
        .then(async (res) => {
          if (!res.ok) {
            throw new Error(`Failed to load teams: ${res.status}`);
          }
          return res.json();
        })
        .then((data) => {
          const teamList: Team[] = data?.teams || [];
          setTeams(teamList);
          if (teamList.length > 0 && !teamId) {
            setTeamId(teamList[0].id);
          }
        })
        .catch((err: any) => {
          console.error("Error loading teams:", err);
        })
        .finally(() => setLoadingTeams(false));
    }
  }, [open, initialTeamId]);

  // Reset form when modal closes
  useEffect(() => {
    if (!open) {
      setName("");
      setDescription("");
      setVisibility("TEAM");
      setIcon("📁");
      setError(null);
    }
  }, [open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim()) {
      setError("Space name is required");
      return;
    }

    if (!initialTeamId && !teamId) {
      setError("Please select a team");
      return;
    }

    const selectedTeamId = initialTeamId || teamId;

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(
        `/api/v1/teams/${encodeURIComponent(selectedTeamId)}/spaces`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
          },
          credentials: "same-origin",
          body: JSON.stringify({
            name: name.trim(),
            description: description.trim() || undefined,
            visibility,
            icon,
          }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Failed to create space: ${response.status}`);
      }

      const data = await response.json();

      // Reset form
      setName("");
      setDescription("");
      setVisibility("TEAM");
      setIcon("📁");
      setError(null);

      // Close modal
      onOpenChange(false);

      // Call success callback
      if (onSuccess && data.space) {
        onSuccess(data.space);
      }
    } catch (err: any) {
      setError(err.message || "Failed to create space");
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    if (!loading) {
      setName("");
      setDescription("");
      setVisibility("TEAM");
      setIcon("📁");
      setError(null);
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[500px] p-6">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Create New Space</DialogTitle>
            <DialogDescription>
              Create a shared space for your team to organize memories and knowledge.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            {error && (
              <div className="bg-destructive/10 text-destructive rounded-md p-3 text-sm">
                {error}
              </div>
            )}

            {!initialTeamId && (
              <div className="grid gap-2">
                <Label htmlFor="team-select">Team</Label>
                {loadingTeams ? (
                  <div className="w-full px-3 py-2 border rounded-md text-sm text-muted-foreground">
                    Loading teams...
                  </div>
                ) : (
                  <select
                    id="team-select"
                    value={teamId}
                    onChange={(e) => setTeamId(e.target.value)}
                    disabled={loading || loadingTeams}
                    className="w-full px-3 py-2 h-12 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
                  >
                    <option value="">Select a team</option>
                    {teams.map((team) => (
                      <option key={team.id} value={team.id}>
                        {team.icon || "👥"} {team.name}
                      </option>
                    ))}
                  </select>
                )}
              </div>
            )}

            <div className="grid gap-2">
              <Label htmlFor="space-icon">Icon</Label>
              <input
                id="space-icon"
                type="text"
                value={icon}
                onChange={(e) => setIcon(e.target.value)}
                placeholder="📁"
                maxLength={2}
                disabled={loading}
                className="w-20 px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="space-name">
                Name <span className="text-destructive">*</span>
              </Label>
              <input
                id="space-name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Engineering Notes"
                maxLength={100}
                required
                disabled={loading}
                className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                list="space-name-suggestions"
              />
              <datalist id="space-name-suggestions">
                <option value="API Documentation" />
                <option value="Architecture Decisions" />
                <option value="Best Practices" />
                <option value="Meeting Notes" />
                <option value="Project Planning" />
                <option value="Technical Specs" />
                <option value="Team Onboarding" />
                <option value="Troubleshooting Guide" />
              </datalist>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="space-description">Description</Label>
              <textarea
                id="space-description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="A space for engineering team documentation and technical notes"
                rows={3}
                disabled={loading}
                className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="space-visibility">Visibility</Label>
              <select
                id="space-visibility"
                value={visibility}
                onChange={(e) => setVisibility(e.target.value)}
                disabled={loading}
                className="w-full px-3 py-2 h-12 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
              >
                <option value="">Select visibility</option>
                <option value="TEAM">
                  Team - All team members can access
                </option>
                <option value="PRIVATE">
                  Private - Only you can access
                </option>
                <option value="WORKSPACE">
                  Workspace - All workspace members can access
                </option>
              </select>
            </div>

            {visibility === "TEAM" && (
              <div className="bg-blue-50 dark:bg-blue-950/50 p-4 rounded-md border border-blue-200 dark:border-blue-900">
                <p className="font-medium text-blue-900 dark:text-blue-100 text-sm mb-2">
                  🤖 Automatic Classification
                </p>
                <p className="text-blue-800 dark:text-blue-200 text-sm">
                  Memories will be automatically classified to this space based on keywords and content.
                  Team members can still manually organize memories.
                </p>
                {name && (
                  <div className="mt-2 p-2 bg-white dark:bg-blue-900/30 rounded border border-blue-200 dark:border-blue-800">
                    <p className="text-xs text-blue-700 dark:text-blue-300">
                      <strong>Preview:</strong> "{name}" will receive memories containing keywords from the description and space name.
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={handleClose}
              disabled={loading}
              className="cursor-pointer"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={loading || loadingTeams || (!initialTeamId && !teamId)}
              className="cursor-pointer"
            >
              {loading ? "Creating..." : "Create Space"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
