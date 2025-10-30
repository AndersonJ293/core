import { prisma } from "~/trigger/utils/prisma";
import { logger } from "./logger.service";

export class PermissionService {
  async isTeamMember(userId: string, teamId: string): Promise<boolean> {
    const membership = await prisma.teamMember.findUnique({
      where: {
        teamId_userId: {
          teamId,
          userId,
        },
        deleted: null,
      },
    });

    return membership !== null;
  }

  async isTeamOwner(userId: string, teamId: string): Promise<boolean> {
    const membership = await prisma.teamMember.findFirst({
      where: {
        teamId,
        userId,
        role: "OWNER",
        deleted: null,
      },
    });

    return membership !== null;
  }

  async getUserTeamRole(
    userId: string,
    teamId: string,
  ): Promise<string | null> {
    const membership = await prisma.teamMember.findUnique({
      where: {
        teamId_userId: {
          teamId,
          userId,
        },
        deleted: null,
      },
    });

    return membership?.role || null;
  }

  async canReadSpace(userId: string, spaceId: string): Promise<boolean> {
    const space = await prisma.space.findUnique({
      where: { id: spaceId },
      include: {
        team: {
          include: {
            members: {
              where: {
                userId,
                deleted: null,
              },
            },
          },
        },
        Workspace: {
          include: {
            user: true,
          },
        },
      },
    });

    if (!space) {
      logger.warn(`Space ${spaceId} not found`);
      return false;
    }

    // Check workspace ownership
    const isWorkspaceOwner = space.Workspace?.userId === userId;

    if (space.visibility === "PRIVATE") {
      return isWorkspaceOwner;
    }

    if (space.visibility === "TEAM" && space.teamId) {
      const isTeamMember = space.team?.members && space.team.members.length > 0;
      return isWorkspaceOwner || !!isTeamMember;
    }

    return isWorkspaceOwner;
  }

  async canWriteSpace(userId: string, spaceId: string): Promise<boolean> {
    const space = await prisma.space.findUnique({
      where: { id: spaceId },
      include: {
        team: {
          include: {
            members: {
              where: {
                userId,
                deleted: null,
              },
            },
          },
        },
        Workspace: {
          include: {
            user: true,
          },
        },
      },
    });

    if (!space) {
      logger.warn(`Space ${spaceId} not found`);
      return false;
    }

    // Check workspace ownership
    const isWorkspaceOwner = space.Workspace?.userId === userId;

    if (space.visibility === "PRIVATE") {
      return isWorkspaceOwner;
    }

    if (space.visibility === "TEAM" && space.teamId) {
      const isTeamMember = space.team?.members && space.team.members.length > 0;
      return isWorkspaceOwner || !!isTeamMember;
    }

    return isWorkspaceOwner;
  }

  async getUserReadableSpaces(
    userId: string,
    workspaceId: string,
  ): Promise<string[]> {
    const workspace = await prisma.workspace.findUnique({
      where: { id: workspaceId },
    });

    if (!workspace) {
      return [];
    }

    const isWorkspaceOwner = workspace.userId === userId;

    const teamMemberships = await prisma.teamMember.findMany({
      where: {
        userId,
        deleted: null,
      },
      select: {
        teamId: true,
      },
    });

    const teamIds = teamMemberships.map((m) => m.teamId);

    const spaces = await prisma.space.findMany({
      where: {
        workspaceId,
        OR: [
          isWorkspaceOwner ? { id: { not: undefined } } : { id: undefined },
          {
            visibility: "PRIVATE",
            Workspace: {
              userId,
            },
          },
          {
            visibility: "TEAM",
            teamId: {
              in: teamIds,
            },
          },
        ],
      },
      select: {
        id: true,
      },
    });

    return spaces.map((s) => s.id);
  }

  async getUserTeams(userId: string, workspaceId: string) {
    return await prisma.team.findMany({
      where: {
        workspaceId,
        members: {
          some: {
            userId,
            deleted: null,
          },
        },
        deleted: null,
      },
      include: {
        members: {
          where: {
            deleted: null,
          },
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
          },
        },
        _count: {
          select: {
            spaces: true,
            members: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });
  }

  async canPerformTeamAction(
    userId: string,
    teamId: string,
    action: "view" | "edit" | "delete" | "invite" | "remove_member",
  ): Promise<boolean> {
    const membership = await prisma.teamMember.findUnique({
      where: {
        teamId_userId: {
          teamId,
          userId,
        },
        deleted: null,
      },
    });

    if (!membership) {
      return false;
    }

    if (action === "view") {
      return true;
    }

    return membership.role === "OWNER";
  }

  async isWorkspaceOwner(
    userId: string,
    workspaceId: string,
  ): Promise<boolean> {
    const workspace = await prisma.workspace.findUnique({
      where: {
        id: workspaceId,
      },
    });

    return workspace?.userId === userId;
  }

  async filterEpisodesByPermission(
    userId: string,
    workspaceId: string,
    episodeIds: string[],
  ): Promise<string[]> {
    if (episodeIds.length === 0) {
      return [];
    }

    const readableSpaceIds = await this.getUserReadableSpaces(
      userId,
      workspaceId,
    );

    if (readableSpaceIds.length === 0) {
      logger.warn(`User ${userId} has no readable spaces in workspace ${workspaceId}`);
      return [];
    }

    logger.info(
      `Filtering ${episodeIds.length} episodes for user ${userId} (readable spaces: ${readableSpaceIds.length})`,
    );

    return episodeIds;
  }
}

export const permissionService = new PermissionService();
