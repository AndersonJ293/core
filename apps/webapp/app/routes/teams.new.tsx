import React, { useEffect, useMemo, useState } from "react";
import { useFetcher, useNavigate } from "@remix-run/react";

const SLUG_REGEX = /^[a-z0-9-]+$/;

export default function NewTeamRoute(): JSX.Element {
  const fetcher = useFetcher();
  const navigate = useNavigate();

  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [description, setDescription] = useState("");
  const [icon, setIcon] = useState("👥");

  const [clientError, setClientError] = useState<string | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);

  const isSubmitting = fetcher.state !== "idle" || fetcher.formData !== undefined;

  const nameDerivedSlug = useMemo(() => {
    return name
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60);
  }, [name]);

  useEffect(() => {
    if (!slug || slug === nameDerivedSlug || slug === "") {
      setSlug(nameDerivedSlug);
    }
  }, [nameDerivedSlug]);

  useEffect(() => {
    setServerError(null);
  }, [name, slug, description, icon]);

  const validate = (): boolean => {
    setClientError(null);
    if (!name || name.trim().length === 0) {
      setClientError("Name is required");
      return false;
    }
    if (name.length > 100) {
      setClientError("Name must be at most 100 characters");
      return false;
    }
    if (!slug || slug.trim().length === 0) {
      setClientError("Slug is required");
      return false;
    }
    if (!SLUG_REGEX.test(slug)) {
      setClientError(
        "Slug must be lowercase letters, numbers or hyphens (a-z0-9-)",
      );
      return false;
    }
    return true;
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setClientError(null);
    setServerError(null);

    if (!validate()) return;

    const payload = {
      name: name.trim(),
      slug: slug.trim(),
      description: description.trim() || undefined,
      icon: icon || undefined,
    };

    fetcher.submit(payload, {
      method: "post",
      action: "/api/v1/teams",
      encType: "application/json",
    });
  };

  useEffect(() => {
    if (!fetcher.data) return;

    const data = fetcher.data as any;

    if (data?.success && data.team) {
      const teamId = data.team.id || data.team.uuid || data.team.slug;
      navigate(`/teams/${teamId}`);
    } else if (data?.error) {
      setServerError(
        typeof data.error === "string" ? data.error : JSON.stringify(data.error),
      );
    } else {
      setServerError("Unexpected server response while creating team");
    }
  }, [fetcher.data]);

  return (
    <div style={{ maxWidth: 760, margin: "0 auto", padding: "24px" }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ margin: 0, fontSize: 24, fontWeight: 600 }}>Create a new team</h1>
        <p style={{ marginTop: 8, color: "#6b7280", fontSize: 14 }}>
          Teams let you share memories and spaces with a group of users.
        </p>
      </div>

      <fetcher.Form method="post" action="/api/v1/teams" onSubmit={onSubmit}>
        <div
          style={{
            display: "grid",
            gap: 12,
            gridTemplateColumns: "1fr",
            marginBottom: 12,
          }}
        >
          <label style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <span style={{ fontSize: 14, fontWeight: 600, color: "#374151" }}>Team name</span>
            <input
              name="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Engineering, Marketing, Product..."
              maxLength={100}
              required
              style={{
                padding: "10px 12px",
                borderRadius: 8,
                border: "1px solid #e5e7eb",
                fontSize: 14,
                outline: "none",
              }}
            />
          </label>

          <label style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <span style={{ fontSize: 14, fontWeight: 600, color: "#374151" }}>Slug</span>
            <input
              name="slug"
              value={slug}
              onChange={(e) => setSlug(e.target.value.toLowerCase())}
              placeholder="engineering"
              maxLength={60}
              style={{
                padding: "10px 12px",
                borderRadius: 8,
                border: "1px solid #e5e7eb",
                fontSize: 14,
                outline: "none",
              }}
            />
            <div style={{ fontSize: 13, color: "#6b7280" }}>
              Used in URLs. Lowercase letters, numbers, or hyphens only.
            </div>
          </label>

          <label style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <span style={{ fontSize: 14, fontWeight: 600, color: "#374151" }}>Description</span>
            <textarea
              name="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Short description (optional)"
              rows={3}
              style={{
                padding: "10px 12px",
                borderRadius: 8,
                border: "1px solid #e5e7eb",
                fontSize: 14,
                outline: "none",
                resize: "vertical",
              }}
            />
          </label>

          <label style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <span style={{ fontSize: 14, fontWeight: 600, color: "#374151" }}>Icon</span>
            <input
              name="icon"
              value={icon}
              onChange={(e) => setIcon(e.target.value)}
              placeholder="👥"
              maxLength={3}
              style={{
                width: 120,
                padding: "10px 12px",
                borderRadius: 8,
                border: "1px solid #e5e7eb",
                fontSize: 18,
                outline: "none",
              }}
            />
            <div style={{ fontSize: 13, color: "#6b7280" }}>
              Emoji to represent the team (optional).
            </div>
          </label>
        </div>

        {(clientError || serverError) && (
          <div
            role="alert"
            style={{
              marginBottom: 16,
              color: "#dc2626",
              background: "#fef2f2",
              padding: 12,
              borderRadius: 8,
              border: "1px solid #fecaca",
            }}
          >
            <strong style={{ display: "block", marginBottom: 4, fontSize: 14 }}>
              {clientError ? "Validation error" : "Server error"}
            </strong>
            <div style={{ fontSize: 13 }}>
              {clientError || serverError || "Unknown error"}
            </div>
          </div>
        )}

        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <button
            type="submit"
            disabled={isSubmitting}
            style={{
              padding: "10px 16px",
              background: "#6366f1",
              color: "#fff",
              borderRadius: 8,
              border: "none",
              cursor: isSubmitting ? "default" : "pointer",
              fontWeight: 600,
              fontSize: 14,
              opacity: isSubmitting ? 0.6 : 1,
            }}
          >
            {isSubmitting ? "Creating…" : "Create team"}
          </button>

          <button
            type="button"
            onClick={() => navigate(-1)}
            style={{
              padding: "10px 16px",
              background: "transparent",
              color: "#374151",
              borderRadius: 8,
              border: "1px solid #d1d5db",
              cursor: "pointer",
              fontSize: 14,
              fontWeight: 500,
            }}
          >
            Cancel
          </button>
        </div>
      </fetcher.Form>
    </div>
  );
}
