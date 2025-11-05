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
  compact?: boolean;
};

export function TeamSidebar({
  selectedTeamId,
  compact = false,
}: Props) {
  const fetcher = useFetcher<{ teams: Team[]; success: boolean }>();
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
        setError(
          typeof fetcher.data.error === "string"
            ? fetcher.data.error
            : "Failed to load teams",
        );
        setTeams([]);
      } else {
        setTeams([]);
      }
    }
  }, [fetcher.state, fetcher.data]);

  return (
    <SidebarGroup>
      <SidebarGroupContent className="flex flex-col gap-2">
        <div className="flex items-center justify-between px-1">
          <h2 className="text-foreground text-sm font-medium">Teams</h2>
          <Link to="/home/teams/new">
            <Button
              variant="secondary"
              isActive
              size="sm"
              className="cursor-pointer rounded"
            >
              <Plus size={16} />
            </Button>
          </Link>
        </div>

        {loading && (
          <div className="text-muted-foreground px-1 text-sm">Loading…</div>
        )}
        {error && <div className="text-destructive px-1 text-sm">{error}</div>}

        {!loading && teams.length === 0 && !error && (
          <div className="text-muted-foreground px-1 text-sm">No teams yet</div>
        )}

        <SidebarMenu className="gap-0.5">
          {teams.map((team) => {
            const isSelected = team.id === selectedTeamId;
            return (
              <SidebarMenuItem key={team.id}>
                <Button
                  variant="ghost"
                  className={cn(
                    "bg-grayAlpha-100 text-foreground cursor-pointer gap-1 !rounded-md flex items-center hover:bg-accent hover:text-accent-foreground transition-colors",
                    isSelected && "!bg-accent !text-accent-foreground",
                  )}
                  onClick={() => {
                    const currentPath = window.location.pathname;
                    if (currentPath !== `/home/teams/${team.id}`) {
                      window.location.href = `/home/teams/${team.id}`;
                    }
                  }}
                >
                  <span className="flex h-4 w-4 items-start justify-center rounded text-xs leading-none">
                    {team.icon || "👥"}
                  </span>
                  <span className="truncate text-sm">
                    {team.name}
                  </span>
                </Button>
              </SidebarMenuItem>
            );
          })}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  );
}
