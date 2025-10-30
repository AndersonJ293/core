import React, { useEffect, useState } from "react";
import { useParams, useNavigate, Link } from "@remix-run/react";
import { CreateSpaceModal } from "~/components/teams/create-space-modal";

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

export default function TeamDetailRoute(): JSX.Element {
  const { teamId } = useParams();
  const navigate = useNavigate();

  const [team, setTeam] = useState<Team | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [loadingTeam, setLoadingTeam] = useState(true);
  const [loadingMembers, setLoadingMembers] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Invite form state
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<"MEMBER" | "OWNER">("MEMBER");
  const [inviteLoading, setInviteLoading] = useState(false);
  const [inviteMessage, setInviteMessage] = useState<string | null>(null);

  // Create space modal state
  const [showCreateSpace, setShowCreateSpace] = useState(false);
  const [spaces, setSpaces] = useState<any[]>([]);

  useEffect(() => {
    if (!teamId) return;
    setLoadingTeam(true);
    setError(null);

    fetch("/api/v1/teams", {
      method: "GET",
      headers: { Accept: "application/json" },
      credentials: "same-origin",
    })
      .then(async (res) => {
        if (!res.ok) {
          const txt = await res.text();
          throw new Error(`Failed to load teams: ${res.status} ${txt}`);
        }
        return res.json();
      })
      .then((data) => {
        const teams: Team[] = Array.isArray(data?.teams) ? data.teams : [];
        const found = teams.find((t) => t.id === teamId || t.slug === teamId);
        setTeam(found || null);
      })
      .catch((err: any) => {
        setError(err?.message || "Unknown error loading team");
        setTeam(null);
      })
      .finally(() => setLoadingTeam(false));
  }, [teamId]);

  useEffect(() => {
    if (!teamId) return;
    setLoadingMembers(true);

    fetch(`/api/v1/teams/${encodeURIComponent(teamId)}/members`, {
      method: "GET",
      headers: { Accept: "application/json" },
      credentials: "same-origin",
    })
      .then(async (res) => {
        if (!res.ok) {
          const txt = await res.text();
          throw new Error(`Failed to load members: ${res.status} ${txt}`);
        }
        return res.json();
      })
      .then((data) => {
        const list: Member[] = Array.isArray(data?.members) ? data.members : [];
        setMembers(list);
      })
      .catch((err: any) => {
        setError(err?.message || "Unknown error loading members");
        setMembers([]);
      })
      .finally(() => setLoadingMembers(false));
  }, [teamId]);

  const onInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    setInviteMessage(null);
    if (!inviteEmail || inviteEmail.indexOf("@") === -1) {
      setInviteMessage("Please provide a valid email address.");
      return;
    }
    if (!teamId) {
      setInviteMessage("Missing team id.");
      return;
    }

    setInviteLoading(true);
    try {
      const res = await fetch(`/api/v1/teams/${encodeURIComponent(teamId)}/members`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        credentials: "same-origin",
        body: JSON.stringify({ email: inviteEmail, role: inviteRole }),
      });

      const data = await res.json();
      if (!res.ok) {
        const errMsg = data?.error || `Invite failed (${res.status})`;
        setInviteMessage(errMsg);
      } else {
        setInviteMessage("Invite successful.");
        // Refresh members list
        setMembers((prev) => (data.member ? [data.member, ...prev] : prev));
        setInviteEmail("");
      }
    } catch (err: any) {
      setInviteMessage(err?.message || "Unknown error while inviting");
    } finally {
      setInviteLoading(false);
    }
  };

  return (
    <div style={{ padding: 24, maxWidth: 1024, margin: "0 auto" }}>
      <div style={{ marginBottom: 24, display: "flex", gap: 12, alignItems: "center" }}>
        <button
          onClick={() => navigate(-1)}
          style={{
            border: "none",
            background: "transparent",
            cursor: "pointer",
            color: "#6b7280",
            fontSize: 14,
            padding: "4px 8px",
            borderRadius: 6,
            transition: "background 0.15s",
          }}
          onMouseEnter={(e) => e.currentTarget.style.background = "#f3f4f6"}
          onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}
        >
          ← Back
        </button>
        <h1 style={{ margin: 0, fontSize: 24, fontWeight: 600 }}>
          {loadingTeam ? "Loading…" : team ? team.name : "Team not found"}
        </h1>
      </div>

      {error && (
        <div style={{ marginBottom: 16, padding: 12, background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 8, color: "#dc2626", fontSize: 14 }}>
          {error}
        </div>
      )}

      {!loadingTeam && !team && (
        <div style={{ marginBottom: 16, fontSize: 14, color: "#6b7280" }}>
          Team not found. <Link to="/teams/new" style={{ color: "#6366f1", textDecoration: "none" }}>Create a team</Link>
        </div>
      )}

      {team && (
        <>
          <div
            style={{
              marginBottom: 24,
              padding: 16,
              border: "1px solid #e5e7eb",
              borderRadius: 12,
              background: "#fff",
            }}
          >
            <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
              <div
                style={{
                  width: 64,
                  height: 64,
                  borderRadius: 12,
                  background: "#eef2f7",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 28,
                }}
              >
                {team.icon || "👥"}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 18, fontWeight: 600, marginBottom: 4 }}>{team.name}</div>
                {team.description && <div style={{ color: "#6b7280", marginBottom: 8, fontSize: 14 }}>{team.description}</div>}
                <div style={{ fontSize: 13, color: "#9ca3af" }}>
                  {team.memberCount ?? members.length} members • {team.spaceCount ?? 0} spaces
                </div>
              </div>
            </div>
          </div>

          <section style={{ display: "grid", gridTemplateColumns: "1fr 340px", gap: 24 }}>
            <div>
              <div style={{ marginBottom: 12, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <h2 style={{ margin: 0, fontSize: 16, fontWeight: 600 }}>Spaces</h2>
                <button
                  onClick={() => setShowCreateSpace(true)}
                  style={{
                    padding: "6px 12px",
                    fontSize: 13,
                    fontWeight: 500,
                    color: "#fff",
                    background: "#6366f1",
                    border: "none",
                    borderRadius: 6,
                    cursor: "pointer",
                    transition: "background 0.15s",
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.background = "#4f46e5"}
                  onMouseLeave={(e) => e.currentTarget.style.background = "#6366f1"}
                >
                  + New Space
                </button>
              </div>

              {spaces.length === 0 ? (
                <div style={{ color: "#9ca3af", fontSize: 14, padding: "12px 0" }}>
                  No spaces yet. Create one to organize team memories.
                </div>
              ) : (
                <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 10, marginBottom: 24 }}>
                  {spaces.map((space: any) => (
                    <li
                      key={space.id}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        padding: "12px",
                        borderRadius: 10,
                        border: "1px solid #e5e7eb",
                        background: "#fff",
                      }}
                    >
                      <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                        <div style={{ fontSize: 20 }}>{space.icon || "📁"}</div>
                        <div>
                          <div style={{ fontWeight: 500, fontSize: 14 }}>{space.name}</div>
                          {space.description && (
                            <div style={{ fontSize: 12, color: "#6b7280" }}>{space.description}</div>
                          )}
                        </div>
                      </div>
                      <span style={{ fontSize: 11, color: "#9ca3af", textTransform: "uppercase" }}>
                        {space.visibility}
                      </span>
                    </li>
                  ))}
                </ul>
              )}

              <div style={{ marginBottom: 12, marginTop: 24 }}>
                <h2 style={{ margin: 0, fontSize: 16, fontWeight: 600 }}>Members</h2>
              </div>

              {loadingMembers ? (
                <div style={{ fontSize: 14, color: "#9ca3af", padding: "12px 0" }}>Loading members…</div>
              ) : members.length === 0 ? (
                <div style={{ color: "#9ca3af", fontSize: 14, padding: "12px 0" }}>No members yet.</div>
              ) : (
                <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 10 }}>
                  {members.map((m) => (
                    <li
                      key={m.id}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        padding: "12px",
                        borderRadius: 10,
                        border: "1px solid #e5e7eb",
                        background: "#fff",
                      }}
                    >
                      <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                        <div
                          style={{
                            width: 44,
                            height: 44,
                            borderRadius: 10,
                            background: "#eef2f7",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            fontSize: 16,
                            fontWeight: 600,
                            color: "#6366f1",
                          }}
                        >
                          {m.user?.name ? m.user.name.charAt(0).toUpperCase() : "U"}
                        </div>
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontWeight: 600, fontSize: 14 }}>{m.user?.name || m.user?.email || "Unknown user"}</div>
                          <div style={{ fontSize: 13, color: "#9ca3af", marginTop: 2 }}>{m.user?.email}</div>
                        </div>
                      </div>
                      <div style={{
                        textAlign: "right",
                        fontSize: 12,
                        color: "#6b7280",
                        background: "#f3f4f6",
                        padding: "4px 10px",
                        borderRadius: 6,
                        fontWeight: 500
                      }}>
                        {m.role}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <aside style={{ border: "1px solid #e5e7eb", padding: 16, borderRadius: 12, background: "#fff", height: "fit-content" }}>
              <h3 style={{ marginTop: 0, marginBottom: 12, fontSize: 16, fontWeight: 600 }}>Invite member</h3>
              <form onSubmit={onInvite}>
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  <input
                    type="email"
                    placeholder="user@example.com"
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    required
                    style={{
                      padding: "10px 12px",
                      borderRadius: 8,
                      border: "1px solid #e5e7eb",
                      fontSize: 14,
                      outline: "none"
                    }}
                  />
                  <select
                    value={inviteRole}
                    onChange={(e) => setInviteRole(e.target.value as any)}
                    style={{
                      padding: "10px 12px",
                      borderRadius: 8,
                      border: "1px solid #e5e7eb",
                      fontSize: 14,
                      outline: "none"
                    }}
                  >
                    <option value="MEMBER">Member</option>
                    <option value="OWNER">Owner</option>
                  </select>

                  <div style={{ display: "flex", gap: 8 }}>
                    <button
                      type="submit"
                      disabled={inviteLoading}
                      style={{
                        flex: 1,
                        padding: "10px 14px",
                        borderRadius: 8,
                        border: "none",
                        background: "#6366f1",
                        color: "#fff",
                        cursor: inviteLoading ? "default" : "pointer",
                        fontWeight: 600,
                        fontSize: 14,
                        opacity: inviteLoading ? 0.6 : 1,
                      }}
                    >
                      {inviteLoading ? "Inviting…" : "Invite"}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setInviteEmail("");
                        setInviteMessage(null);
                      }}
                      style={{
                        padding: "10px 14px",
                        borderRadius: 8,
                        border: "1px solid #d1d5db",
                        background: "transparent",
                        cursor: "pointer",
                        fontSize: 14,
                        color: "#6b7280",
                      }}
                    >
                      Clear
                    </button>
                  </div>

                  {inviteMessage && (
                    <div style={{
                      marginTop: 4,
                      padding: 8,
                      borderRadius: 6,
                      fontSize: 13,
                      color: inviteMessage.includes("success") ? "#059669" : "#dc2626",
                      background: inviteMessage.includes("success") ? "#ecfdf5" : "#fef2f2",
                      border: inviteMessage.includes("success") ? "1px solid #a7f3d0" : "1px solid #fecaca"
                    }}>
                      {inviteMessage}
                    </div>
                  )}
                </div>
              </form>
            </aside>
          </section>
        </>
      )}

      {teamId && (
        <CreateSpaceModal
          open={showCreateSpace}
          onOpenChange={setShowCreateSpace}
          teamId={teamId}
          onSuccess={(space) => {
            setSpaces((prev) => [space, ...prev]);
          }}
        />
      )}
    </div>
  );
}
