import React, { useEffect, useState } from "react";
import { Link, useFetcher } from "@remix-run/react";
import { Plus, ChevronDown, ChevronRight } from "lucide-react";
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
  spaces?: TeamSpace[];
};

type TeamSpace = {
  id: string;
  name: string;
  icon?: string | null;
  contextCount?: number;
};

type Props = {
  selectedTeamId?: string | null;
  compact?: boolean;
};

export function TeamSidebar({ selectedTeamId, compact = false }: Props) {
  const fetcher = useFetcher<{ teams: Team[]; success: boolean }>();
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedTeams, setExpandedTeams] = useState<Set<string>>(new Set());
  const [teamSpaces, setTeamSpaces] = useState<Record<string, TeamSpace[]>>({});

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
        // Auto-expand selected team or first team
        if (fetcher.data.teams.length > 0) {
          const firstTeamId = fetcher.data.teams[0].id;
          setExpandedTeams(new Set([firstTeamId]));
          // Load spaces for first team
          loadTeamSpaces(firstTeamId);
        }
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

  const loadTeamSpaces = (teamId: string) => {
    // Load spaces for a specific team
    fetch(`/api/v1/teams/${encodeURIComponent(teamId)}/spaces`, {
      method: "GET",
      headers: { Accept: "application/json" },
      credentials: "same-origin",
    })
      .then(async (res) => {
        if (!res.ok) {
          throw new Error(`Failed to load spaces: ${res.status}`);
        }
        return res.json();
      })
      .then((data) => {
        const spaces: TeamSpace[] = data?.spaces || [];
        setTeamSpaces((prev) => ({
          ...prev,
          [teamId]: spaces,
        }));
      })
      .catch((err: any) => {
        console.error("Error loading team spaces:", err);
        setTeamSpaces((prev) => ({
          ...prev,
          [teamId]: [],
        }));
      });
  };

  const toggleTeamExpansion = (teamId: string) => {
    const newExpanded = new Set(expandedTeams);
    if (newExpanded.has(teamId)) {
      newExpanded.delete(teamId);
    } else {
      newExpanded.add(teamId);
    }
    setExpandedTeams(newExpanded);

    // Load spaces if expanding
    if (!expandedTeams.has(teamId)) {
      loadTeamSpaces(teamId);
    }
  };

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

        <div className="flex flex-col gap-1">
          {teams.map((team) => {
            const isSelected = team.id === selectedTeamId;
            const isExpanded = expandedTeams.has(team.id);
            const spaces = teamSpaces[team.id] || [];

            return (
              <div key={team.id} className="flex flex-col gap-0.5">
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    className={cn(
                      "bg-grayAlpha-100 text-foreground hover:bg-accent hover:text-accent-foreground flex flex-1 cursor-pointer items-center justify-start gap-1 !rounded-md transition-colors",
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
                    <span className="truncate text-sm">{team.name}</span>
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="hover:bg-accent h-8 w-8 cursor-pointer p-0"
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleTeamExpansion(team.id);
                    }}
                  >
                    {isExpanded ? (
                      <ChevronDown size={14} />
                    ) : (
                      <ChevronRight size={14} />
                    )}
                  </Button>
                </div>

                {isExpanded && (
                  <div className="ml-6 flex flex-col gap-0.5">
                    {spaces.length === 0 ? (
                      <div className="text-muted-foreground px-2 py-1 text-xs">
                        No spaces yet
                      </div>
                    ) : (
                      spaces.map((space) => (
                        <Link
                          key={space.id}
                          to={`/home/spaces/${space.id}`}
                          className="text-muted-foreground hover:text-foreground hover:bg-accent/50 flex items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors"
                        >
                          <span className="text-xs">{space.icon || "📁"}</span>
                          <span className="truncate">{space.name}</span>
                          {space.contextCount && space.contextCount > 0 && (
                            <span className="bg-muted ml-auto rounded-full px-1.5 py-0.5 text-xs">
                              {space.contextCount}
                            </span>
                          )}
                        </Link>
                      ))
                    )}
                    <Link
                      to={`/home/teams/${team.id}/spaces/new`}
                      className="text-muted-foreground hover:text-foreground hover:bg-accent/50 flex items-center gap-2 rounded-md px-2 py-1.5 text-xs transition-colors"
                    >
                      <Plus size={12} />
                      <span>Create Space</span>
                    </Link>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </SidebarGroupContent>
    </SidebarGroup>
  );
}
