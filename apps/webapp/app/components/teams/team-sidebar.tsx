import React, { useEffect, useState } from "react";
import { Link, useFetcher } from "@remix-run/react";

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
  className?: string;
};

export function TeamSidebar({
  selectedTeamId,
  onSelect,
  compact = false,
  className,
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
    <aside
      aria-label="Teams"
      className={className}
      style={{ display: "flex", flexDirection: "column", gap: 8 }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 4px" }}>
        <strong style={{ fontSize: 14 }}>Teams</strong>
        <Link
          to="/teams/new"
          style={{
            fontSize: 13,
            color: "#6366f1",
            textDecoration: "none",
            fontWeight: 500
          }}
        >
          + New
        </Link>
      </div>

      {loading && <div style={{ fontSize: 13, color: "#9ca3af", padding: "8px 4px" }}>Loading…</div>}
      {error && <div style={{ fontSize: 13, color: "#ef4444", padding: "8px 4px" }}>{error}</div>}

      {!loading && teams.length === 0 && !error && (
        <div style={{ fontSize: 13, color: "#9ca3af", padding: "8px 4px" }}>No teams yet</div>
      )}

        <ul
          style={{
            listStyle: "none",
            padding: 0,
            margin: 0,
            display: "flex",
            flexDirection: "column",
            gap: 6,
          }}
        >
          {teams.map((team) => {
            const isSelected = team.id === selectedTeamId;
            return (
              <li key={team.id}>
                <button
                  onClick={() => handleSelect(team.id)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    width: "100%",
                    textAlign: "left",
                    padding: "8px 10px",
                    borderRadius: 8,
                    background: isSelected ? "#f3f4f6" : "transparent",
                    border: "none",
                    cursor: "pointer",
                    transition: "background 0.15s",
                  }}
                  onMouseEnter={(e) => {
                    if (!isSelected) e.currentTarget.style.background = "#f9fafb";
                  }}
                  onMouseLeave={(e) => {
                    if (!isSelected) e.currentTarget.style.background = "transparent";
                  }}
                  aria-current={isSelected ? "true" : undefined}
                >
                  <span
                    style={{
                      width: 32,
                      height: 32,
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      borderRadius: 6,
                      background: "#eef2f7",
                      fontSize: 16,
                      flexShrink: 0,
                    }}
                    aria-hidden
                  >
                    {team.icon || "👥"}
                  </span>

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                        justifyContent: "space-between",
                      }}
                    >
                      <div
                        style={{
                          fontSize: 14,
                          fontWeight: 600,
                          whiteSpace: "nowrap",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                        }}
                      >
                        {team.name}
                      </div>
                      <div
                        style={{
                          fontSize: 12,
                          color: "#9ca3af",
                          minWidth: 30,
                          textAlign: "right",
                        }}
                      >
                        {Number(team.memberCount || 0)}
                      </div>
                    </div>

                    {!compact && team.description ? (
                      <div
                        style={{
                          fontSize: 12,
                          color: "#9ca3af",
                          whiteSpace: "nowrap",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          marginTop: 2,
                        }}
                      >
                        {team.description}
                      </div>
                    ) : null}
                  </div>
                </button>
              </li>
            );
          })}
        </ul>
    </aside>
  );
}
