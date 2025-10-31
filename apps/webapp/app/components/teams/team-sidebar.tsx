import React, { useEffect, useState } from "react";
import { Link, useFetcher } from "@remix-run/react";
import { Plus } from "lucide-react";
import { cn } from "~/lib/utils";
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuItem,
} from "../ui/sidebar";
import { Button } from "../ui";

type Team = {
  id: string;
  name: string;
  slug: string;
  description?: string | null;
  icon?: string | null;
  memberCount?: number;
  spaceCount?: number;
};

type Props = {
  selectedTeamId?: string | null;
  onSelect?: (teamId: string) => void;
  compact?: boolean;
};

export function TeamSidebar({
  selectedTeamId,
  onSelect,
  compact = false,
}: Props) {
  const fetcher = useFetcher();
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetcher.load("/api/v1/teams");
  }, []);

  useEffect(() => {
    if (fetcher.state === "loading") {
      setLoading(true);
      setError(null);
    } else if (fetcher.state === "idle") {
      setLoading(false);
      
      if (fetcher.data?.teams && Array.isArray(fetcher.data.teams)) {
        setTeams(fetcher.data.teams);
        setError(null);
      } else if (fetcher.data?.error) {
        setError(typeof fetcher.data.error === "string" ? fetcher.data.error : "Failed to load teams");
        setTeams([]);
      } else {
        setTeams([]);
      }
    }
  }, [fetcher.state, fetcher.data]);

  const handleSelect = (teamId: string) => {
    if (onSelect) onSelect(teamId);
  };

  return (
    <SidebarGroup>
      <SidebarGroupContent className="flex flex-col gap-2">
        <div className="flex items-center justify-between px-1">
          <h2 className="text-sm font-medium text-foreground">Teams</h2>
          <Link to="/teams/new">
            <Button
              variant="secondary"
              isActive
              size="sm"
              className="rounded cursor-pointer"
            >
              <Plus size={16} />
            </Button>
          </Link>
        </div>

        {loading && (
          <div className="text-muted-foreground text-sm px-1">Loading…</div>
        )}
        {error && (
          <div className="text-destructive text-sm px-1">{error}</div>
        )}

        {!loading && teams.length === 0 && !error && (
          <div className="text-muted-foreground text-sm px-1">No teams yet</div>
        )}

        <SidebarMenu className="gap-0.5">
          {teams.map((team) => {
            const isSelected = team.id === selectedTeamId;
            return (
              <SidebarMenuItem key={team.id}>
                <Button
                  isActive={isSelected}
                  className={cn(
                    "bg-grayAlpha-100 text-foreground w-fit gap-1 !rounded-md cursor-pointer",
                    isSelected && "!bg-accent !text-accent-foreground",
                  )}
                  onClick={() => handleSelect(team.id)}
                  variant="ghost"
                >
                  <span className="flex h-6 w-6 items-center justify-center rounded bg-muted text-xs">
                    {team.icon || "👥"}
                  </span>
                  <div className="flex flex-1 flex-col min-w-0">
                    <div className="flex items-center justify-between">
                      <span className="truncate text-sm font-medium">
                        {team.name}
                      </span>
                      <span className="text-muted-foreground text-xs">
                        {Number(team.memberCount || 0)}
                      </span>
                    </div>
                    {!compact && team.description && (
                      <span className="text-muted-foreground text-xs truncate">
                        {team.description}
                      </span>
                    )}
                  </div>
                </Button>
              </SidebarMenuItem>
            );
          })}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  );
}
