import { type LoaderFunctionArgs } from "@remix-run/server-runtime";
import { requireUser, requireWorkpace } from "~/services/session.server";

import { Outlet, Link, useLoaderData, useNavigate } from "@remix-run/react";
import { typedjson } from "remix-typedjson";
import { prisma } from "~/db.server";
import { ChevronLeft, Plus } from "lucide-react";
import { Button } from "~/components/ui/button";
import { CreateSpaceModal } from "~/components/teams/create-space-modal";
import React, { useState, useEffect } from "react";

export const loader = async ({ request, params }: LoaderFunctionArgs) => {
  const user = await requireUser(request);
  const workspace = await requireWorkpace(request);
  const { teamId } = params;

  if (!teamId) {
    throw new Response("Team ID is required", { status: 400 });
  }

  // Get team with spaces and members
  const team = await prisma.team.findUnique({
    where: { id: teamId },
    include: {
      members: {
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              avatarUrl: true,
            },
          },
        },
      },
      spaces: {
        where: { deleted: null },
        orderBy: { createdAt: "desc" },
      },
    },
  });

  if (!team) {
    throw new Response("Team not found", { status: 404 });
  }

  // Check if user is a member
  const isMember = team.members.some((m) => m.userId === user.id);
  if (!isMember) {
    throw new Response("Unauthorized", { status: 403 });
  }

  const totalMemories = team.spaces.reduce(
    (sum, space) => sum + (space.contextCount || 0),
    0
  );

  return typedjson({
    team: {
      id: team.id,
      name: team.name,
      slug: team.slug,
      description: team.description,
      icon: team.icon,
      members: team.members,
      spaces: team.spaces,
      memberCount: team.members.length,
      spaceCount: team.spaces.length,
      totalMemories,
    },
  });
};

export default function TeamSpacesRoute() {
  const { team } = useLoaderData<typeof loader>();
  const navigate = useNavigate();
  const [showCreateSpace, setShowCreateSpace] = useState(false);
  const [spaces, setSpaces] = useState(team.spaces);

  useEffect(() => {
    setSpaces(team.spaces);
  }, [team.spaces]);

  const handleCreateSpaceSuccess = (newSpace: any) => {
    setSpaces((prev) => [newSpace, ...prev]);
  };

  return (
    <div className="container mx-auto p-6 max-w-6xl">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate(-1)}
          className="cursor-pointer"
        >
          <ChevronLeft size={16} />
        </Button>
        <div className="flex items-center gap-3 flex-1">
          <div className="text-4xl">{team.icon || "👥"}</div>
          <div>
            <h1 className="text-3xl font-bold">{team.name}</h1>
            {team.description && (
              <p className="text-muted-foreground">{team.description}</p>
            )}
          </div>
        </div>

        <Button
          onClick={() => setShowCreateSpace(true)}
          className="cursor-pointer"
        >
          <Plus size={16} className="mr-2" />
          Create Space
        </Button>
      </div>

      {/* Team Stats */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-card border rounded-lg p-4">
          <p className="text-sm text-muted-foreground mb-1">Members</p>
          <p className="text-2xl font-bold">{team.memberCount}</p>
        </div>
        <div className="bg-card border rounded-lg p-4">
          <p className="text-sm text-muted-foreground mb-1">Spaces</p>
          <p className="text-2xl font-bold">{team.spaceCount}</p>
        </div>
        <div className="bg-card border rounded-lg p-4">
          <p className="text-sm text-muted-foreground mb-1">Total Memories</p>
          <p className="text-2xl font-bold">{team.totalMemories}</p>
        </div>
      </div>

      {/* Spaces List */}
      <div className="bg-card border rounded-lg">
        <div className="p-4 border-b">
          <h2 className="text-xl font-semibold">Team Spaces</h2>
        </div>

        <div className="divide-y">
          {spaces.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">
              <p className="mb-4">No spaces yet. Create the first one!</p>
              <Button
                onClick={() => setShowCreateSpace(true)}
                variant="outline"
                className="cursor-pointer"
              >
                <Plus size={16} className="mr-2" />
                Create Space
              </Button>
            </div>
          ) : (
            spaces.map((space) => <SpaceCard key={space.id} space={space} />)
          )}
        </div>
      </div>

      {/* Create Space Modal */}
      <CreateSpaceModal
        open={showCreateSpace}
        onOpenChange={setShowCreateSpace}
        teamId={team.id}
        onSuccess={handleCreateSpaceSuccess}
      />
    </div>
  );
}

function SpaceCard({ space }: { space: any }) {
  return (
    <div className="p-4 hover:bg-accent/50 transition-colors">
      <div className="flex items-center justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <h3 className="font-semibold">{space.name}</h3>
            <span
              className={`px-2 py-0.5 rounded text-xs ${
                space.visibility === "TEAM"
                  ? "bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-300"
                  : space.visibility === "PRIVATE"
                  ? "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300"
                  : "bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300"
              }`}
            >
              {space.visibility}
            </span>
          </div>
          {space.description && (
            <p className="text-sm text-muted-foreground mb-2">
              {space.description}
            </p>
          )}
          <p className="text-xs text-muted-foreground">
            {space.contextCount || 0} memories
          </p>
        </div>

        <div className="flex gap-2">
          <Link
            to={`/home/spaces/${space.id}`}
            className="px-3 py-1 text-sm text-primary hover:underline"
          >
            View
          </Link>
          <Link
            to={`/home/spaces/${space.id}/settings`}
            className="px-3 py-1 text-sm text-muted-foreground hover:underline"
          >
            Settings
          </Link>
        </div>
      </div>
    </div>
  );
}
