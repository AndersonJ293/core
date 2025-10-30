import React, { useState } from "react";
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

type CreateSpaceModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  teamId: string;
  onSuccess?: (space: any) => void;
};

export function CreateSpaceModal({
  open,
  onOpenChange,
  teamId,
  onSuccess,
}: CreateSpaceModalProps) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [visibility, setVisibility] = useState<"PRIVATE" | "TEAM" | "WORKSPACE">("TEAM");
  const [icon, setIcon] = useState("📁");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim()) {
      setError("Space name is required");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/v1/teams/${encodeURIComponent(teamId)}/spaces`, {
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
      });

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
      <DialogContent className="sm:max-w-[500px]">
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

            <div className="grid gap-2">
              <Label htmlFor="space-icon">Icon</Label>
              <Input
                id="space-icon"
                value={icon}
                onChange={(e) => setIcon(e.target.value)}
                placeholder="📁"
                maxLength={2}
                disabled={loading}
                className="w-20"
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="space-name">
                Name <span className="text-destructive">*</span>
              </Label>
              <Input
                id="space-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Engineering Notes"
                maxLength={100}
                required
                disabled={loading}
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="space-description">Description</Label>
              <Textarea
                id="space-description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="A space for engineering team documentation and technical notes"
                rows={3}
                disabled={loading}
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="space-visibility">Visibility</Label>
              <Select
                value={visibility}
                onValueChange={(value: any) => setVisibility(value)}
                disabled={loading}
              >
                <SelectTrigger id="space-visibility">
                  <SelectValue placeholder="Select visibility" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="TEAM">
                    <div className="flex flex-col items-start">
                      <span className="font-medium">Team</span>
                      <span className="text-muted-foreground text-xs">
                        All team members can access
                      </span>
                    </div>
                  </SelectItem>
                  <SelectItem value="PRIVATE">
                    <div className="flex flex-col items-start">
                      <span className="font-medium">Private</span>
                      <span className="text-muted-foreground text-xs">
                        Only you can access
                      </span>
                    </div>
                  </SelectItem>
                  <SelectItem value="WORKSPACE">
                    <div className="flex flex-col items-start">
                      <span className="font-medium">Workspace</span>
                      <span className="text-muted-foreground text-xs">
                        Everyone in workspace can access
                      </span>
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={handleClose}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Creating..." : "Create Space"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
