import React, { useEffect, useMemo, useState } from "react";
import { useFetcher, useNavigate } from "@remix-run/react";
import { PageHeader } from "~/components/common/page-header";
import { Button } from "~/components/ui";

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
      navigate(`/home/teams/${teamId}`);
    } else if (data?.error) {
      setServerError(
        typeof data.error === "string" ? data.error : JSON.stringify(data.error),
      );
    } else {
      setServerError("Unexpected server response while creating team");
    }
  }, [fetcher.data]);

  return (
    <>
      <PageHeader title="Create a new team" />
      <div className="flex h-[calc(100vh_-_56px)] w-full flex-col items-center pt-3">
        <div className="w-full px-3">
          <p className="text-muted-foreground mb-6 text-sm">
            Teams let you share memories and spaces with a group of users.
          </p>

          <fetcher.Form method="post" action="/api/v1/teams" onSubmit={onSubmit} className="space-y-4">
            <div className="space-y-2">
              <label className="block">
                <span className="text-sm font-medium text-foreground">Team name</span>
                <input
                  name="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Engineering, Marketing, Product..."
                  maxLength={100}
                  required
                  className="mt-1 block w-full rounded-md border-border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </label>

              <label className="block">
                <span className="text-sm font-medium text-foreground">Slug</span>
                <input
                  name="slug"
                  value={slug}
                  onChange={(e) => setSlug(e.target.value.toLowerCase())}
                  placeholder="engineering"
                  maxLength={60}
                  className="mt-1 block w-full rounded-md border-border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </label>

              <label className="block">
                <span className="text-sm font-medium text-foreground">Description (optional)</span>
                <textarea
                  name="description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="What this team works on..."
                  maxLength={500}
                  rows={3}
                  className="mt-1 block w-full rounded-md border-border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </label>

              <label className="block">
                <span className="text-sm font-medium text-foreground">Icon</span>
                <div className="mt-2 flex items-center gap-2">
                  <input
                    name="icon"
                    value={icon}
                    onChange={(e) => setIcon(e.target.value)}
                    placeholder="👥"
                    maxLength={2}
                    className="w-16 rounded-md border-border bg-background px-2 py-1 text-center text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                  <span className="text-muted-foreground text-sm">Choose an emoji for your team</span>
                </div>
              </label>
            </div>

            {(clientError || serverError) && (
              <div
                role="alert"
                className="mb-4 rounded-md bg-error px-4 py-2 text-sm text-error"
              >
                <strong className="block mb-1 text-sm">
                  {clientError ? "Validation error" : "Server error"}
                </strong>
                <div className="text-sm">{clientError || serverError || "Unknown error"}</div>
              </div>
            )}

            <div className="flex items-center justify-end gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => navigate(-1)}
                className="cursor-pointer px-6 py-2.5 text-sm"
              >
                Cancel
              </Button>

              <Button
                type="submit"
                disabled={isSubmitting}
                className="cursor-pointer px-6 py-2.5 text-sm"
              >
                {isSubmitting ? "Creating…" : "Create team"}
              </Button>
            </div>
          </fetcher.Form>
        </div>
      </div>
    </>
  );
}
